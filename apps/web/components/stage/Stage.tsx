"use client";

import { Canvas } from "@react-three/fiber";
import type { Expression, RoomId } from "@tower/shared";
import { Component, type ReactNode } from "react";
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

export default function Stage(p: StageProps) {
  return (
    <Boundary onError={p.onFailed}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 52, near: 0.1, far: 400, position: [0, 4, 25] }}
        gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
        onCreated={({ gl }) => {
          gl.domElement.setAttribute("data-stage", "ready");
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            p.onFailed();
          });
        }}
        aria-hidden
      >
        {p.scene === "plaza" && <Plaza model={p.model} visitors={p.visitors} rooms={p.rooms} startAt={p.startAt} active={p.controls} reduced={p.reduced} onNear={p.onNear} onEnter={p.onEnter} />}
        {p.scene === "room" && p.roomId && <InterviewRoom model={p.model} interviewer={interviewerFor(p.model)} expression={p.expression} accent={p.roomColor} reduced={p.reduced} />}
      </Canvas>
    </Boundary>
  );
}
