"use client";

import { Canvas } from "@react-three/fiber";
import type { Avatar, Expression, RoomId } from "@tower/shared";
import { Component, useEffect, type ReactNode } from "react";
import { Lobby, type Visitor } from "./Lobby";
import { Outside } from "./Outside";
import { Room } from "./Room";
import { preload } from "./sprites";
import type { SceneName } from "./support";

export interface StageProps {
  scene: SceneName;
  roomId: RoomId | null;
  expression: Expression;
  avatar: Avatar;
  visitors: Visitor[];
  online: number;
  reduced: boolean;
  walkTo: RoomId | null;
  onEnter: () => void;
  onPickRoom: (id: RoomId) => void;
  onWalkDone: (id: RoomId) => void;
  onFailed: () => void;
}

class Boundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function Stage(p: StageProps) {
  useEffect(() => {
    preload(["interviewer/neutral", "interviewer/warm", "interviewer/thinking", "interviewer/confident", "interviewer/confused", `${p.avatar}/neutral`, `${p.avatar}/thinking`]);
  }, [p.avatar]);

  return (
    <Boundary onError={p.onFailed}>
      <Canvas
        flat
        dpr={[1, 1.75]}
        camera={{ fov: 52, near: 0.1, far: 120, position: [0, 2, 10] }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.domElement.setAttribute("data-stage", "ready");
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            p.onFailed();
          });
        }}
        aria-hidden
      >
        {p.scene === "outside" && <Outside online={p.online} reduced={p.reduced} onEnter={p.onEnter} />}
        {p.scene === "lobby" && <Lobby reduced={p.reduced} visitors={p.visitors} walkTo={p.walkTo} onPick={p.onPickRoom} onArrive={p.onWalkDone} />}
        {p.scene === "room" && p.roomId && <Room roomId={p.roomId} expression={p.expression} avatar={p.avatar} reduced={p.reduced} />}
      </Canvas>
    </Boundary>
  );
}
