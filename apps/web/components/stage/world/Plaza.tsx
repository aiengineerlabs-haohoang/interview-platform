"use client";

import { useFrame, useThree } from "@react-three/fiber";
import type { RoomId } from "@tower/shared";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { signTexture, tex } from "./assets";
import { input, useKeyboard } from "./controls";
import { Human } from "./Human";
import { BENCHES, FOUNTAIN, LAMPS, TOWER_H, TOWER_W, TOWERS, TREES, resolve, rng, type TowerSpot } from "./layout";
import { MODELS, modelForAvatar, newAnimState, type ModelId } from "./vrm";

export interface Visitor {
  avatar: string;
  room: string | null;
}

export interface PlazaProps {
  model: ModelId;
  visitors: Visitor[];
  rooms: Record<string, number>;
  /** Tower to appear in front of (coming back out of an interview), or null for the start of the plaza. */
  startAt: RoomId | null;
  active: boolean;
  reduced: boolean;
  onNear: (id: RoomId | null) => void;
  onEnter: (id: RoomId) => void;
}

const SKY_HORIZON = "#ecd1a8";

function Sky() {
  const ref = useRef<THREE.Mesh>(null);
  const map = useMemo(() => tex("sky_panorama", { srgb: true }), []);
  map.wrapS = THREE.RepeatWrapping;
  useFrame(({ camera }) => ref.current?.position.copy(camera.position));
  return (
    <mesh ref={ref} renderOrder={-1}>
      <sphereGeometry args={[220, 48, 24]} />
      <meshBasicMaterial map={map} side={THREE.BackSide} fog={false} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

function Ground() {
  const grass = useMemo(() => tex("ground_grass", { repeat: [110, 110] }), []);
  const paving = useMemo(() => tex("ground_paving", { repeat: [9, 9] }), []);
  const cobble = useMemo(() => tex("ground_cobble", { repeat: [4, 4] }), []);
  const lane = useMemo(() => tex("ground_cobble", { repeat: [1.6, 5] }), []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[300, 64]} />
        <meshStandardMaterial map={grass} roughness={1} color="#9fb384" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} receiveShadow>
        <circleGeometry args={[27, 96]} />
        <meshStandardMaterial map={paving} color="#c2bdb2" roughness={0.85} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.04} receiveShadow>
        <ringGeometry args={[5.4, 8.2, 96]} />
        <meshStandardMaterial map={cobble} roughness={0.9} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      {TOWERS.map((t) => {
        // A cobbled lane from the porch toward the fountain ring.
        const len = Math.hypot(t.porch[0], t.porch[1]) - 8;
        const mx = t.porch[0] * (1 - len / 2 / Math.hypot(t.porch[0], t.porch[1]));
        const mz = t.porch[1] * (1 - len / 2 / Math.hypot(t.porch[0], t.porch[1]));
        return (
          <mesh key={t.id} position={[mx, 0.05, mz]} rotation={[-Math.PI / 2, 0, -Math.atan2(t.porch[0], t.porch[1]) + Math.PI]} receiveShadow>
            <planeGeometry args={[4.4, len]} />
            <meshStandardMaterial map={lane} roughness={0.9} polygonOffset polygonOffsetFactor={-3} />
          </mesh>
        );
      })}
    </group>
  );
}

function Fountain() {
  const stone = useMemo(() => tex("ground_paving", { repeat: [3, 1] }), []);
  const water = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (water.current) water.current.position.y = 0.62 + Math.sin(clock.elapsedTime * 1.4) * 0.02;
  });
  return (
    <group position={[FOUNTAIN.x, 0, FOUNTAIN.z]}>
      <mesh position-y={0.35} castShadow receiveShadow>
        <cylinderGeometry args={[4.5, 4.7, 0.7, 48]} />
        <meshStandardMaterial map={stone} roughness={0.8} />
      </mesh>
      <mesh ref={water} position-y={0.62}>
        <cylinderGeometry args={[4.1, 4.1, 0.04, 48]} />
        <meshStandardMaterial color="#6fb4c9" roughness={0.05} metalness={0.2} transparent opacity={0.85} />
      </mesh>
      <mesh position-y={1.6} castShadow>
        <cylinderGeometry args={[0.45, 0.7, 2.2, 24]} />
        <meshStandardMaterial map={stone} roughness={0.8} />
      </mesh>
      <mesh position-y={2.8} castShadow>
        <cylinderGeometry args={[1.5, 0.6, 0.35, 32]} />
        <meshStandardMaterial map={stone} roughness={0.8} />
      </mesh>
      <mesh position-y={3.05}>
        <cylinderGeometry args={[1.35, 1.35, 0.06, 32]} />
        <meshStandardMaterial color="#8fc6d6" roughness={0.05} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

function Trees() {
  const trunk = useRef<THREE.InstancedMesh>(null);
  const crown = useRef<THREE.InstancedMesh>(null);
  const bark = useMemo(() => tex("bark", { repeat: [1, 2] }), []);
  const leaves = useMemo(() => tex("leaves", { repeat: [2, 2] }), []);
  useLayoutEffect(() => {
    const r = rng(11);
    const m = new THREE.Matrix4();
    TREES.forEach((t, i) => {
      const s = 0.8 + r() * 0.7;
      m.compose(new THREE.Vector3(t.x, 2.2 * s, t.z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      trunk.current?.setMatrixAt(i, m);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6, 0));
      m.compose(new THREE.Vector3(t.x, 5.6 * s, t.z), q, new THREE.Vector3(s * (1 + r() * 0.3), s * (0.9 + r() * 0.3), s * (1 + r() * 0.3)));
      crown.current?.setMatrixAt(i, m);
    });
    for (const ref of [trunk, crown]) if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group>
      <instancedMesh ref={trunk} args={[undefined, undefined, TREES.length]} castShadow>
        <cylinderGeometry args={[0.28, 0.45, 4.4, 10]} />
        <meshStandardMaterial map={bark} roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crown} args={[undefined, undefined, TREES.length]} castShadow>
        <icosahedronGeometry args={[2.9, 2]} />
        <meshStandardMaterial map={leaves} roughness={0.95} color="#cfe6b0" />
      </instancedMesh>
    </group>
  );
}

function Bushes() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const leaves = useMemo(() => tex("leaves", { repeat: [1, 1] }), []);
  const spots = useMemo(() => {
    const r = rng(23);
    const out: { x: number; z: number; s: number }[] = [];
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2 + r() * 0.05;
      const rad = 28.3 + r() * 1.2;
      const x = rad * Math.sin(a), z = rad * Math.cos(a);
      if (TOWERS.some((t) => Math.hypot(t.porch[0] - x, t.porch[1] - z) < 7 || Math.hypot(t.x - x, t.z - z) < 10)) continue;
      if (z > 8 && Math.abs(x) < 10) continue;
      out.push({ x, z, s: 0.7 + r() * 0.6 });
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    spots.forEach((b, i) => {
      m.compose(new THREE.Vector3(b.x, 0.45 * b.s, b.z), new THREE.Quaternion(), new THREE.Vector3(b.s * 1.2, b.s * 0.9, b.s * 1.2));
      ref.current?.setMatrixAt(i, m);
    });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, [spots]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, spots.length]} castShadow>
      <icosahedronGeometry args={[0.8, 2]} />
      <meshStandardMaterial map={leaves} color="#b4d49a" roughness={0.95} />
    </instancedMesh>
  );
}

function Lamps() {
  return (
    <group>
      {LAMPS.map((l, i) => (
        <group key={i} position={[l.x, 0, l.z]}>
          <mesh position-y={2.1} castShadow>
            <cylinderGeometry args={[0.07, 0.11, 4.2, 8]} />
            <meshStandardMaterial color="#2c2a28" roughness={0.5} metalness={0.6} />
          </mesh>
          <mesh position-y={4.3}>
            <sphereGeometry args={[0.32, 16, 12]} />
            <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
          </mesh>
          <pointLight position-y={4.2} color="#ffc98a" intensity={7} distance={11} decay={2} />
        </group>
      ))}
    </group>
  );
}

function Benches() {
  const wood = useMemo(() => tex("table_wood", { repeat: [1, 1] }), []);
  return (
    <group>
      {BENCHES.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]} rotation-y={b.rot}>
          <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.2, 0.09, 0.62]} />
            <meshStandardMaterial map={wood} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.88, -0.28]} rotation-x={-0.12} castShadow>
            <boxGeometry args={[2.2, 0.5, 0.07]} />
            <meshStandardMaterial map={wood} roughness={0.7} />
          </mesh>
          {[-0.95, 0.95].map((x) => (
            <mesh key={x} position={[x, 0.25, 0]} castShadow>
              <boxGeometry args={[0.09, 0.5, 0.55]} />
              <meshStandardMaterial color="#2c2a28" metalness={0.6} roughness={0.5} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

const FACADES: Record<RoomId, string> = {
  "llm-inference": "facade_glass",
  agents: "facade_brick",
  "ml-fundamentals": "facade_stone",
  "language-models": "facade_concrete",
  "reinforcement-learning": "facade_copper",
};

function Tower({ t, inside }: { t: TowerSpot; inside: number }) {
  const facade = useMemo(() => tex(FACADES[t.id], { repeat: [TOWER_W / 6.5, TOWER_H / 6.5] }), [t.id]);
  const wood = useMemo(() => tex("table_wood", { repeat: [1, 1] }), []);
  const stone = useMemo(() => tex("ground_paving", { repeat: [2, 1] }), []);
  const sign = useMemo(() => signTexture([{ text: `FLOOR ${t.floor}`, size: 46, weight: "600", color: "#fff1d6" }, { text: t.name, size: 92 }], t.color, 1024, 300), [t]);
  const count = useMemo(() => signTexture([{ text: inside > 0 ? `${inside} inside now` : "Open", size: 64, weight: "600" }], "#2a2018", 640, 120), [inside]);
  const door = useMemo(() => tex("door"), []);
  const glow = useRef<THREE.Mesh>(null);
  const side = useMemo(() => new THREE.MeshStandardMaterial({ map: facade, roughness: 0.55, metalness: 0.15 }), [facade]);
  const roof = useMemo(() => new THREE.MeshStandardMaterial({ color: "#46403a", roughness: 0.9 }), []);
  useFrame(({ clock }) => {
    if (glow.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 2.2) * 0.08;
      glow.current.scale.set(s, s, 1);
    }
  });
  const d = TOWER_W / 2;
  return (
    <group position={[t.x, 0, t.z]} rotation-y={t.rot}>
      <mesh position-y={TOWER_H / 2} material={[side, side, roof, roof, side, side]} castShadow receiveShadow>
        <boxGeometry args={[TOWER_W, TOWER_H, TOWER_W]} />
      </mesh>
      {/* relief: a ledge at every few floors and slim pilasters up the corners, so the facade is not a flat card */}
      {[6, 11, 16, 21].map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow receiveShadow>
          <boxGeometry args={[TOWER_W + 0.5, 0.3, TOWER_W + 0.5]} />
          <meshStandardMaterial map={stone} roughness={0.8} />
        </mesh>
      ))}
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
        <mesh key={`${sx}${sz}`} position={[sx * (TOWER_W / 2), TOWER_H / 2, sz * (TOWER_W / 2)]} castShadow>
          <boxGeometry args={[0.5, TOWER_H, 0.5]} />
          <meshStandardMaterial map={stone} roughness={0.8} />
        </mesh>
      )))}
      {/* plinth and crown */}
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[TOWER_W + 0.8, 1.2, TOWER_W + 0.8]} />
        <meshStandardMaterial map={stone} roughness={0.8} />
      </mesh>
      <mesh position={[0, TOWER_H + 0.4, 0]} castShadow>
        <boxGeometry args={[TOWER_W + 0.9, 0.8, TOWER_W + 0.9]} />
        <meshStandardMaterial map={stone} roughness={0.8} />
      </mesh>
      <mesh position={[0, TOWER_H + 2.2, 0]}>
        <cylinderGeometry args={[0.08, 0.14, 3.6, 8]} />
        <meshStandardMaterial color="#555" metalness={0.8} roughness={0.4} />
      </mesh>
      <mesh position={[0, TOWER_H + 4.1, 0]}>
        <sphereGeometry args={[0.3, 12, 10]} />
        <meshBasicMaterial color={t.color} toneMapped={false} />
      </mesh>

      {/* entrance */}
      <group position={[0, 0, d]}>
        <mesh position={[0, 2.1, 0.12]} castShadow>
          <boxGeometry args={[3.5, 4.2, 0.3]} />
          <meshStandardMaterial map={wood} color="#8a6a4a" roughness={0.6} />
        </mesh>
        <mesh position={[0, 2.1, 0.3]}>
          <planeGeometry args={[3.5, 4.2]} />
          <meshBasicMaterial map={door} toneMapped={false} />
        </mesh>
        <mesh position={[0, 4.75, 1.5]} castShadow receiveShadow>
          <boxGeometry args={[6.4, 0.28, 3.4]} />
          <meshStandardMaterial color={t.color} roughness={0.5} />
        </mesh>
        {[-2.9, 2.9].map((x) => (
          <mesh key={x} position={[x, 2.4, 2.9]} castShadow>
            <cylinderGeometry args={[0.13, 0.13, 4.8, 12]} />
            <meshStandardMaterial color="#ece4d4" roughness={0.6} />
          </mesh>
        ))}
        <mesh position={[0, 0.22, 1.6]} castShadow receiveShadow>
          <boxGeometry args={[6, 0.2, 3.2]} />
          <meshStandardMaterial map={stone} roughness={0.8} />
        </mesh>
        <mesh position={[0, 7.4, 0.1]}>
          <planeGeometry args={[9, 2.65]} />
          <meshBasicMaterial map={sign} toneMapped={false} />
        </mesh>
        <mesh position={[0, 5.2, 3.22]}>
          <planeGeometry args={[3.2, 0.6]} />
          <meshBasicMaterial map={count} toneMapped={false} />
        </mesh>
        <pointLight position={[0, 3.8, 2.4]} color="#ffc98a" intensity={9} distance={10} decay={2} />
        <mesh ref={glow} position={[0, 0.34, 3.6]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[1.0, 1.35, 48]} />
          <meshBasicMaterial color={t.color} toneMapped={false} transparent opacity={0.9} />
        </mesh>
      </group>
    </group>
  );
}

/** A visitor from the presence list, wandering the plaza as a person you could walk up to. */
function Wanderer({ model, seed }: { model: ModelId; seed: number }) {
  const g = useRef<THREE.Group>(null);
  const anim = useMemo(newAnimState, []);
  const st = useRef({ r: rng(seed), x: 0, z: 0, tx: 0, tz: 0, wait: 0, init: false, heading: 0 });
  useFrame((_, dt) => {
    const s = st.current;
    if (!g.current) return;
    if (!s.init) {
      s.x = s.tx = (s.r() - 0.5) * 30;
      s.z = s.tz = 6 + s.r() * 12;
      s.init = true;
    }
    dt = Math.min(dt, 0.05);
    const dx = s.tx - s.x, dz = s.tz - s.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.5) {
      anim.pose = "idle";
      anim.speed = 0;
      s.wait -= dt;
      if (s.wait <= 0) {
        const a = s.r() * Math.PI * 2, rad = 4 + s.r() * 18;
        [s.tx, s.tz] = resolve(rad * Math.sin(a) * 0.9, rad * Math.cos(a) * 0.9, 1);
        s.wait = 2 + s.r() * 5;
      }
    } else {
      anim.pose = "walk";
      anim.speed = 1.7;
      const nx = s.x + (dx / d) * 1.7 * dt, nz = s.z + (dz / d) * 1.7 * dt;
      [s.x, s.z] = resolve(nx, nz, 0.6);
      const want = Math.atan2(dx, dz);
      let diff = want - s.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      s.heading += diff * Math.min(1, dt * 6);
    }
    g.current.position.set(s.x, 0, s.z);
    g.current.rotation.y = s.heading;
  });
  return <Human model={model} anim={anim} group={g} />;
}

interface WalkerProps {
  model: ModelId;
  startAt: RoomId | null;
  active: boolean;
  onNear: (id: RoomId | null) => void;
  onEnter: (id: RoomId) => void;
  sun: React.RefObject<THREE.DirectionalLight | null>;
  reduced: boolean;
}

/** You: the chibi who walks under the arrow keys, with a camera that follows from behind. */
function Walker({ model, startAt, active, onNear, onEnter, sun }: WalkerProps) {
  const g = useRef<THREE.Group>(null);
  const anim = useMemo(newAnimState, []);
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const near = useRef<RoomId | null>(null);
  const spot = startAt ? TOWERS.find((t) => t.id === startAt) : undefined;
  const st = useRef({
    x: spot ? spot.porch[0] : 0,
    z: spot ? spot.porch[1] : 17,
    heading: spot ? spot.rot + Math.PI : Math.PI,
    yaw: spot ? spot.rot : 0,
    vx: 0,
    vz: 0,
    drag: -1,
    camInit: false,
    tick: 0,
  });
  const cam = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());

  useKeyboard(active, () => {
    if (near.current) onEnter(near.current);
  });

  useEffect(() => {
    const el = gl.domElement;
    let lastX = 0;
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      st.current.drag = e.pointerId;
      lastX = e.clientX;
    };
    const move = (e: PointerEvent) => {
      if (st.current.drag !== e.pointerId) return;
      st.current.yaw -= (e.clientX - lastX) * 0.008;
      lastX = e.clientX;
    };
    const up = (e: PointerEvent) => {
      if (st.current.drag === e.pointerId) st.current.drag = -1;
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [gl]);

  useFrame(({ camera }, dtRaw) => {
    const s = st.current;
    const dt = Math.min(dtRaw, 0.05);
    s.yaw += input.turn * dt * 1.8;
    const ix = active ? input.kx + input.tx : 0;
    const iy = active ? input.ky + input.ty : 0;
    const mag = Math.min(1, Math.hypot(ix, iy));
    const f = [-Math.sin(s.yaw), -Math.cos(s.yaw)];
    const r = [Math.cos(s.yaw), -Math.sin(s.yaw)];
    const speed = (input.run ? 9 : 5.2) * mag;
    const dx = f[0]! * iy + r[0]! * ix, dz = f[1]! * iy + r[1]! * ix;
    const len = Math.hypot(dx, dz);
    const k = 1 - Math.exp(-dt * 12);
    s.vx += (len > 0.01 ? (dx / len) * speed - s.vx : -s.vx) * k;
    s.vz += (len > 0.01 ? (dz / len) * speed - s.vz : -s.vz) * k;
    const sp = Math.hypot(s.vx, s.vz);
    [s.x, s.z] = resolve(s.x + s.vx * dt, s.z + s.vz * dt);
    if (sp > 0.25) {
      const want = Math.atan2(s.vx, s.vz);
      let diff = want - s.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      s.heading += diff * Math.min(1, dt * 12);
    }
    anim.pose = sp > 0.25 ? "walk" : "idle";
    anim.speed = sp;
    if (g.current) {
      g.current.position.set(s.x, 0, s.z);
      g.current.rotation.y = s.heading;
    }
    // Exposed for the end-to-end tests, which steer the walker by reading where it is.
    if (++s.tick % 6 === 0) gl.domElement.dataset.player = `${s.x.toFixed(1)},${s.z.toFixed(1)}`;

    // Camera: behind and above, easing toward its mark. Pulled further back on a tall (phone) screen.
    const tall = size.width / size.height < 0.9;
    const dist = tall ? 9.5 : 6.6, h = tall ? 4.8 : 3.5;
    const tx = s.x + Math.sin(s.yaw) * dist, tz = s.z + Math.cos(s.yaw) * dist;
    if (!s.camInit) {
      cam.current.set(tx, h, tz);
      look.current.set(s.x, 1.3, s.z);
      s.camInit = true;
    }
    const ck = 1 - Math.exp(-dt * 5);
    cam.current.x += (tx - cam.current.x) * ck;
    cam.current.y += (h - cam.current.y) * ck;
    cam.current.z += (tz - cam.current.z) * ck;
    look.current.x += (s.x - look.current.x) * ck * 1.4;
    look.current.z += (s.z - look.current.z) * ck * 1.4;
    look.current.y = 1.5;
    camera.position.copy(cam.current);
    camera.lookAt(look.current);

    if (sun.current) {
      sun.current.position.set(s.x - 22, 34, s.z + 18);
      sun.current.target.position.set(s.x, 0, s.z);
      sun.current.target.updateMatrixWorld();
    }

    let n: RoomId | null = null;
    for (const t of TOWERS) if (Math.hypot(s.x - t.porch[0], s.z - t.porch[1]) < 3.6) n = t.id;
    if (n !== near.current) {
      near.current = n;
      onNear(n);
    }
  });

  return <Human model={model} anim={anim} group={g} />;
}

export function Plaza({ model, visitors, rooms, startAt, active, reduced, onNear, onEnter }: PlazaProps) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.1;
    return () => {
      scene.environment = null;
      env.dispose();
      pm.dispose();
    };
  }, [gl, scene]);
  useEffect(() => {
    scene.fog = new THREE.Fog(SKY_HORIZON, 45, 150);
    scene.background = new THREE.Color(SKY_HORIZON);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  const others = MODELS.filter((m) => m !== model);
  const walkers = visitors.filter((v) => !v.room).slice(0, 3);

  return (
    <>
      <hemisphereLight args={["#cfe0ff", "#b89c6e", 0.9]} />
      <directionalLight ref={sun} color="#ffe2b8" intensity={3.1} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-26} shadow-camera-right={26} shadow-camera-top={26} shadow-camera-bottom={-26} shadow-camera-near={1} shadow-camera-far={110} shadow-bias={-0.0004} shadow-normalBias={0.04}>
        <object3D attach="target" />
      </directionalLight>
      <Sky />
      <Ground />
      <Fountain />
      <Trees />
      <Lamps />
      <Bushes />
      <Benches />
      {TOWERS.map((t) => (
        <Tower key={t.id} t={t} inside={rooms[t.id] ?? 0} />
      ))}
      {walkers.map((v, i) => (
        <Wanderer key={i} model={others[i % others.length]!} seed={101 + i * 17} />
      ))}
      <Walker model={model} startAt={startAt} active={active} onNear={onNear} onEnter={onEnter} sun={sun} reduced={reduced} />
    </>
  );
}

export { modelForAvatar };
