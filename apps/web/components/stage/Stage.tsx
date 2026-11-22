"use client";

import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import type { Expression, RoomId } from "@tower/shared";
import { Component, useState, type ReactNode } from "react";
import * as THREE from "three";
import { InterviewRoom } from "./world/InterviewRoom";
import { Plaza, type Visitor } from "./world/Plaza";
import { MODELS, type ModelId } from "./world/vrm";
import type { SceneName } from "./support";

export interface StageProps {
  scene: SceneName;
  roomId: RoomId | null;
  roomColor: string;
  expression: Expression;
  model: ModelId;
  visitors: Visitor[];
  rooms: Record<string, number>;
  startAt: RoomId | null;
  reduced: boolean;
  controls: boolean;
  onNear: (id: RoomId | null) => void;
  onEnter: (id: RoomId) => void;
  onFailed: () => void;
}

class Boundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.error("stage failed", e);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** The interviewer is always a different person from you. */
export function interviewerFor(model: ModelId): ModelId {
  return (["ren", "hana", "sakura", "kai"] as const).find((m) => m !== model) ?? MODELS[0];
}

/** Cinematic finish: contact shadows in the creases, a soft glow on light sources, a gentle vignette. Ambient occlusion is desktop-only. */
function Finish({ ao }: { ao: boolean }) {
  return (
    <EffectComposer multisampling={4}>
      {ao ? <N8AO aoRadius={1.4} distanceFalloff={1.2} intensity={2.2} quality="medium" halfRes /> : <></>}
      <Bloom intensity={0.35} luminanceThreshold={0.92} luminanceSmoothing={0.2} mipmapBlur />
      <Vignette eskil={false} offset={0.28} darkness={0.5} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

const fine = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches;

/** A software rasteriser (headless browsers, machines with no GPU driver) cannot afford the post-processing chain. */
function isSoftware(gl: THREE.WebGLRenderer): boolean {
  const ctx = gl.getContext();
  const info = ctx.getExtension("WEBGL_debug_renderer_info");
  const name = info ? String(ctx.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
  return /swiftshader|llvmpipe|software|basic render/i.test(name);
}

export default function Stage(p: StageProps) {
  const [software, setSoftware] = useState(false);
  return (
    <Boundary onError={p.onFailed}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 52, near: 0.1, far: 400, position: [0, 4, 25] }}
        gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }}
        onCreated={({ gl }) => {
          if (isSoftware(gl)) {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            setSoftware(true);
          }
          gl.domElement.setAttribute("data-stage", "ready");
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            p.onFailed();
          });
        }}
        aria-hidden
      >
        {p.scene === "plaza" && <Plaza low={software} model={p.model} visitors={p.visitors} rooms={p.rooms} startAt={p.startAt} active={p.controls} reduced={p.reduced} onNear={p.onNear} onEnter={p.onEnter} />}
        {p.scene === "room" && p.roomId && <InterviewRoom model={p.model} interviewer={interviewerFor(p.model)} expression={p.expression} accent={p.roomColor} reduced={p.reduced} />}
        {!software && <Finish ao={!p.reduced && fine()} />}
      </Canvas>
    </Boundary>
  );
}
