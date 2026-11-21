"use client";

import { roomById, type Avatar, type Expression, type RoomId } from "@tower/shared";
import { useMemo } from "react";
import { CameraRig } from "./CameraRig";
import { Character } from "./Character";
import { labelTexture } from "./sprites";

/** The candidate's animal only has five expressions; the interviewer's other two map to the nearest. */
const AVATAR_EXPRESSION: Record<Expression, "neutral" | "thinking" | "confident" | "confused" | "warm"> = {
  neutral: "neutral",
  thinking: "thinking",
  confident: "confident",
  confused: "confused",
  warm: "warm",
  shocked: "confused",
  smug: "confident",
};

export function Room({ roomId, expression, avatar, reduced }: { roomId: RoomId; expression: Expression; avatar: Avatar; reduced: boolean }) {
  const room = roomById(roomId)!;
  const board = useMemo(() => labelTexture([room.name, `Floor ${room.floor}`], { w: 640, h: 360, bg: "#fbf7f1", fg: room.color, sub: "#8a7565" }), [room]);
  const avatarExpr = AVATAR_EXPRESSION[expression];

  return (
    <>
      <color attach="background" args={["#f1e6d2"]} />
      <hemisphereLight args={["#fff4e0", "#a58a64", 1.05]} />
      <pointLight position={[0.5, 3, 1.5]} intensity={9} distance={12} color="#ffe2b0" />
      <CameraRig start={{ pos: [0, 1.7, 6.2], look: [0, 1.5, -1] }} rest={{ pos: [0, 1.55, 4.1], look: [0, 1.4, -1] }} reduced={reduced} sway={0.07} pullBack={2.6} clearOf="right" />

      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[60, 40]} />
        <meshStandardMaterial color="#c79a68" />
      </mesh>
      <mesh position={[0, 2, -3]}>
        <planeGeometry args={[60, 4]} />
        <meshStandardMaterial color="#eadcc2" />
      </mesh>
      <mesh position={[0, 0.5, -2.98]}>
        <planeGeometry args={[60, 1]} />
        <meshStandardMaterial color="#b89a73" />
      </mesh>

      <mesh position={[-2.6, 2.1, -2.95]}>
        <planeGeometry args={[1.5, 1.6]} />
        <meshBasicMaterial color="#cfe6f2" />
      </mesh>
      {[
        [0, 0.8, 1.62, 0.08],
        [0, -0.8, 1.62, 0.08],
        [-0.75, 0, 0.08, 1.62],
        [0.75, 0, 0.08, 1.62],
        [0, 0, 0.05, 1.6],
        [0, 0, 1.5, 0.05],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[-2.6 + x!, 2.1 + y!, -2.93]}>
          <planeGeometry args={[w!, h!]} />
          <meshBasicMaterial color="#8a5a3c" />
        </mesh>
      ))}
      <mesh position={[2.5, 2.2, -2.95]}>
        <planeGeometry args={[2.2, 1.24]} />
        <meshBasicMaterial map={board} />
      </mesh>

      <mesh position={[0, 0.78, -0.2]}>
        <boxGeometry args={[3.4, 0.12, 1.2]} />
        <meshStandardMaterial color="#8a5a3c" />
      </mesh>
      {[-1.5, 1.5].map((x) => (
        <mesh key={x} position={[x, 0.38, -0.2]}>
          <boxGeometry args={[0.12, 0.76, 1.0]} />
          <meshStandardMaterial color="#6f4a2d" />
        </mesh>
      ))}
      <mesh position={[-0.9, 0.93, -0.1]} rotation-x={-0.25}>
        <boxGeometry args={[0.7, 0.04, 0.5]} />
        <meshStandardMaterial color="#9aa0a6" />
      </mesh>
      <mesh position={[1.0, 0.9, -0.2]}>
        <cylinderGeometry args={[0.08, 0.07, 0.14]} />
        <meshStandardMaterial color="#f6ecdf" />
      </mesh>

      <Character spriteKey={`interviewer/${expression}`} height={2.3} position={[0, 0.45, -1.1]} popKey={expression} motion={reduced ? 0 : 1} />
      <Character spriteKey={`${avatar}/${avatarExpr}`} height={1.0} position={[-0.9, 0, 1.2]} popKey={avatarExpr} phase={2} motion={reduced ? 0 : 1} />
    </>
  );
}
