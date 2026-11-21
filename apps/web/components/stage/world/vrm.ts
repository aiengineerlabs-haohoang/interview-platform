import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import type { Avatar } from "@tower/shared";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** The four human models shipped in /public/models. Their VRM licences allow commercial use and redistribution. */
export const MODELS = ["sakura", "ren", "hana", "kai"] as const;
export type ModelId = (typeof MODELS)[number];

const FILE: Record<ModelId, string> = { sakura: "a", ren: "c", hana: "b", kai: "d" };

/** Old four-animal avatar names (still what the presence API carries) map to a human model. */
const LEGACY: Record<Avatar, ModelId> = { owl: "sakura", fox: "ren", cat: "hana", rabbit: "kai" };
export function modelForAvatar(a: Avatar | string | undefined): ModelId {
  return (MODELS as readonly string[]).includes(a ?? "") ? (a as ModelId) : (LEGACY as Record<string, ModelId>)[a ?? ""] ?? "sakura";
}

export const CHIBI = { head: 1.9, legs: 0.62, arms: 0.82, body: 1.2 } as const;

const cache = new Map<ModelId, Promise<VRM>>();

/** Loads each model once. A model can only be in one place at a time, so callers must use distinct models per scene. */
export function loadVrm(model: ModelId): Promise<VRM> {
  let p = cache.get(model);
  if (!p) {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    p = loader.loadAsync(`/models/${FILE[model]}.vrm`).then((gltf) => {
      const vrm = gltf.userData.vrm as VRM;
      VRMUtils.rotateVRM0(vrm);
      vrm.scene.traverse((o) => {
        o.frustumCulled = false;
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = false;
        }
      });
      // Chibi proportions: a big head, short legs and arms. Scale on the raw bones, which the VRM rig never overwrites.
      const raw = (n: Parameters<VRM["humanoid"]["getRawBoneNode"]>[0]) => vrm.humanoid.getRawBoneNode(n);
      raw("head")?.scale.setScalar(CHIBI.head);
      raw("leftUpperLeg")?.scale.setScalar(CHIBI.legs);
      raw("rightUpperLeg")?.scale.setScalar(CHIBI.legs);
      raw("leftUpperArm")?.scale.setScalar(CHIBI.arms);
      raw("rightUpperArm")?.scale.setScalar(CHIBI.arms);
      vrm.scene.scale.setScalar(CHIBI.body);
      // Where the hips end up when standing, so a seated pose can be lowered onto a seat of any height.
      vrm.scene.userData.hipsH = (raw("hips")?.position.y ?? 0.8) * CHIBI.legs * CHIBI.body;
      vrm.scene.userData.calib = calibrate(vrm);
      return vrm;
    });
    cache.set(model, p);
  }
  return p;
}

/**
 * VRM 0 and VRM 1 models do not agree on which way a bone's axes point once loaded, so rather than trust a
 * convention we measure it: nudge a bone, see which way its child moved, and remember the sign that means
 * "forward" for legs and arms and "down" for each arm.
 */
interface Calib {
  /** Multiply an x rotation by this to swing a limb forward. */
  fwd: number;
  /** z rotation (rad) that lets the left / right arm hang down. */
  armL: number;
  armR: number;
}

function calibrate(vrm: VRM): Calib {
  const n = (b: Parameters<VRM["humanoid"]["getNormalizedBoneNode"]>[0]) => vrm.humanoid.getNormalizedBoneNode(b)!;
  const probe = (bone: Parameters<typeof n>[0], child: Parameters<typeof n>[0], axis: "x" | "z", pick: (v: THREE.Vector3) => number) => {
    const b = n(bone), c = n(child), v = new THREE.Vector3();
    vrm.scene.updateMatrixWorld(true);
    c.getWorldPosition(v);
    const before = pick(v);
    b.rotation[axis] = 0.5;
    vrm.scene.updateMatrixWorld(true);
    c.getWorldPosition(v);
    const delta = pick(v) - before;
    b.rotation[axis] = 0;
    vrm.scene.updateMatrixWorld(true);
    return delta;
  };
  // The scene has been turned to face +Z, so "forward" is +z in the world.
  const fwd = probe("leftUpperLeg", "leftLowerLeg", "x", (v) => v.z) > 0 ? 1 : -1;
  const armL = probe("leftUpperArm", "leftLowerArm", "z", (v) => v.y) < 0 ? 1.2 : -1.2;
  const armR = probe("rightUpperArm", "rightLowerArm", "z", (v) => v.y) < 0 ? 1.2 : -1.2;
  return { fwd, armL, armR };
}

export type Pose = "idle" | "walk" | "sit";

/** Reaction of the interviewer, mapped to a face and a small gesture. */
export type Emote = "neutral" | "warm" | "thinking" | "confident" | "confused" | "shocked" | "smug";

const FACE: Record<Emote, Partial<Record<"happy" | "relaxed" | "surprised" | "sad" | "angry", number>>> = {
  neutral: { relaxed: 0.25 },
  warm: { happy: 0.75 },
  thinking: { relaxed: 0.5 },
  confident: { happy: 0.45 },
  confused: { sad: 0.5, surprised: 0.2 },
  shocked: { surprised: 0.9 },
  smug: { happy: 0.3, angry: 0.15 },
};

export interface AnimState {
  pose: Pose;
  /** Distance travelled per second, drives the walk cycle speed. */
  speed: number;
  emote: Emote;
  t: number;
  phase: number;
  blink: number;
  nextBlink: number;
  gesture: number;
}

export const newAnimState = (): AnimState => ({ pose: "idle", speed: 0, emote: "neutral", t: Math.random() * 10, phase: 0, blink: 0, nextBlink: 2 + Math.random() * 3, gesture: 0 });

const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));

/** Procedural animation straight onto the normalised humanoid bones: no animation clips to download or retarget. */
export function animate(vrm: VRM, s: AnimState, dt: number): void {
  s.t += dt;
  const h = vrm.humanoid;
  const n = (name: Parameters<typeof h.getNormalizedBoneNode>[0]) => h.getNormalizedBoneNode(name);
  const { fwd: F, armL, armR } = vrm.scene.userData.calib as Calib;
  const walking = s.pose === "walk";
  const sitting = s.pose === "sit";
  if (walking) s.phase += dt * (4 + s.speed * 1.35);
  const sw = walking ? Math.sin(s.phase) : 0;
  const amp = walking ? Math.min(1, 0.55 + s.speed * 0.09) : 0;
  const breath = Math.sin(s.t * 1.8) * 0.012;

  const hips = n("hips");
  const spine = n("spine");
  const chest = n("chest");
  const head = n("head");
  const neck = n("neck");
  const lul = n("leftUpperLeg"), rul = n("rightUpperLeg"), lll = n("leftLowerLeg"), rll = n("rightLowerLeg");
  const lua = n("leftUpperArm"), rua = n("rightUpperArm"), lla = n("leftLowerArm"), rla = n("rightLowerArm");
  const lf = n("leftFoot"), rf = n("rightFoot");

  const set = (b: THREE.Object3D | null, x: number, y: number, z: number, k = 14) => {
    if (!b) return;
    b.rotation.x = damp(b.rotation.x, x, k, dt);
    b.rotation.y = damp(b.rotation.y, y, k, dt);
    b.rotation.z = damp(b.rotation.z, z, k, dt);
  };

  if (sitting) {
    set(lul, F * 1.5, 0.08, 0);
    set(rul, F * 1.5, -0.08, 0);
    set(lll, -F * 1.5, 0, 0);
    set(rll, -F * 1.5, 0, 0);
    set(lf, 0, 0, 0);
    set(rf, 0, 0, 0);
    set(hips, 0, 0, 0);
  } else {
    set(lul, F * sw * 0.75 * amp, 0, 0);
    set(rul, -F * sw * 0.75 * amp, 0, 0);
    set(lll, walking ? -F * Math.max(0, sw) * 0.9 * amp : 0, 0, 0);
    set(rll, walking ? -F * Math.max(0, -sw) * 0.9 * amp : 0, 0, 0);
    set(lf, 0, 0, 0);
    set(rf, 0, 0, 0);
    set(hips, 0, walking ? Math.sin(s.phase) * 0.1 * amp : 0, 0);
  }

  // Arms hang down (the rest pose is a T), swing opposite to the legs, and come forward to the table when seated.
  const g = s.gesture;
  if (sitting) {
    const hand = s.emote === "thinking";
    set(rua, F * (hand ? 0.7 : 0.3), 0, armR * 0.97);
    set(rla, F * (hand ? 2.0 : 1.1), 0, 0);
    set(lua, F * 0.3, 0, armL * 0.97);
    set(lla, F * 1.1, 0, 0);
  } else {
    set(rua, F * sw * 0.55 * amp, 0, armR);
    set(rla, 0, 0, 0);
    set(lua, -F * sw * 0.55 * amp, 0, armL);
    set(lla, 0, 0, 0);
  }

  const gestureNod = s.emote === "confident" || s.emote === "warm" ? Math.sin(g * Math.PI * 3) * 0.16 * Math.max(0, 1 - g) : 0;
  const gestureShake = s.emote === "confused" || s.emote === "shocked" ? Math.sin(g * Math.PI * 4) * 0.28 * Math.max(0, 1 - g) : 0;
  const tilt = s.emote === "confused" ? 0.12 : s.emote === "thinking" ? -0.06 : 0;
  set(spine, F * (breath * 2 + (sitting ? 0.04 : 0.02)), 0, 0, 8);
  set(chest, F * breath, 0, 0, 8);
  set(neck, F * (0.02 + gestureNod * 0.5), gestureShake * 0.5, tilt * 0.4, 10);
  set(head, F * (0.03 + gestureNod + (s.emote === "thinking" ? -0.1 : 0)), gestureShake + (s.emote === "thinking" ? 0.2 : 0), tilt, 10);
  s.gesture = Math.min(1, g + dt * 0.8);

  const em = vrm.expressionManager;
  if (em) {
    s.nextBlink -= dt;
    if (s.nextBlink <= 0) {
      s.blink = 1;
      s.nextBlink = 2.2 + Math.random() * 3.2;
    }
    s.blink = Math.max(0, s.blink - dt * 7);
    const target = FACE[s.emote];
    for (const k of ["happy", "relaxed", "surprised", "sad", "angry"] as const) {
      const cur = em.getValue(k) ?? 0;
      em.setValue(k, damp(cur, target[k] ?? 0, 9, dt));
    }
    em.setValue("blink", Math.sin(Math.min(1, s.blink) * Math.PI));
  }
  vrm.update(dt);

  // Lower the (now shorter-legged) hips so the feet still meet the floor.
  const rawHips = h.getRawBoneNode("hips");
  if (rawHips) rawHips.position.y *= CHIBI.legs;
}

export function setEmote(s: AnimState, e: Emote): void {
  if (s.emote !== e) {
    s.emote = e;
    s.gesture = 0;
  }
}
