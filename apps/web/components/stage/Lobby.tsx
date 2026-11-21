"use client";

import { ROOMS, type Room, type RoomId } from "@tower/shared";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { CameraRig, type Pose } from "./CameraRig";
import { Character } from "./Character";
import { hash01, labelTexture } from "./sprites";

export const DOOR_SPACING = 4.6;
export const FIRST_DOOR_Z = -2;
export const HALF_WIDTH = 3;

export function doorPlacement(index: number): { z: number; side: -1 | 1 } {
  return { z: FIRST_DOOR_Z - index * DOOR_SPACING, side: index % 2 === 0 ? -1 : 1 };
}

export function walkPose(roomId: RoomId): Pose {
  const i = ROOMS.findIndex((r) => r.id === roomId);
  const { z, side } = doorPlacement(i);
  return { pos: [side * 0.6, 1.55, z + 0.2], look: [side * HALF_WIDTH, 1.35, z] };
}

function Door({ room, index, onPick }: { room: Room; index: number; onPick: (id: RoomId) => void }) {
  const { z, side } = doorPlacement(index);
  const [hover, setHover] = useState(false);
  const plaque = useMemo(() => labelTexture([room.name, `FLOOR ${room.floor}`], { w: 640, h: 200, bg: "#2e2018", fg: "#f6ecdf", sub: "#d8b98f" }), [room]);
  const rotY = side === -1 ? Math.PI / 2 : -Math.PI / 2;
  return (
    <group position={[side * (HALF_WIDTH - 0.05), 0, z]} rotation-y={rotY}>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[1.7, 2.55, 0.1]} />
        <meshStandardMaterial color="#d6c3a3" />
      </mesh>
      <mesh
        position={[0, 1.1, 0.08]}
        onClick={() => onPick(room.id)}
        onPointerOver={() => {
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
      >
        <boxGeometry args={[1.4, 2.25, 0.1]} />
        <meshStandardMaterial color={room.color} emissive={room.color} emissiveIntensity={hover ? 0.55 : 0.08} />
      </mesh>
      <mesh position={[0.5, 1.05, 0.16]}>
        <sphereGeometry args={[0.06]} />
        <meshStandardMaterial color="#f0d98a" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 2.72, 0.07]}>
        <planeGeometry args={[1.9, 0.6]} />
        <meshBasicMaterial map={plaque} />
      </mesh>
    </group>
  );
}

/** Lets a visitor stroll a little either side of where they stand. Still when the visitor asked for reduced motion. */
function Drift({ x, z, phase, reduced, children }: { x: number; z: number; phase: number; reduced: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current || reduced) return;
    const t = state.clock.elapsedTime;
    ref.current.position.x = x + Math.sin(t * 0.22 + phase) * 0.7;
    ref.current.position.z = z + Math.cos(t * 0.17 + phase * 1.3) * 0.5;
  });
  return (
    <group ref={ref} position={[x, 0, z]}>
      {children}
    </group>
  );
}

export interface Visitor {
  avatar: string;
  room: string | null;
}

export function Lobby({
  reduced,
  visitors,
  walkTo,
  onPick,
  onArrive,
}: {
  reduced: boolean;
  visitors: Visitor[];
  walkTo: RoomId | null;
  onPick: (id: RoomId) => void;
  onArrive: (id: RoomId) => void;
}) {
  const length = 8 + ROOMS.length * DOOR_SPACING;
  const floorTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "#c79a68";
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#b98b5b";
    g.fillRect(0, 0, 64, 64);
    g.fillRect(64, 64, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, length / 2);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [length]);

  const rest: Pose = { pos: [0, 1.6, 4], look: [0, 1.5, -12] };
  const goTo = walkTo ? walkPose(walkTo) : null;

  return (
    <>
      <color attach="background" args={["#e9dcc4"]} />
      <fog attach="fog" args={["#e9dcc4", 12, 34]} />
      <hemisphereLight args={["#fff4e0", "#a58a64", 0.95]} />
      <pointLight position={[0, 2.8, 0]} intensity={5} distance={12} color="#ffe2b0" />
      <CameraRig start={{ pos: [0, 1.6, 9], look: [0, 1.5, -10] }} rest={rest} goTo={goTo} onArrive={() => walkTo && onArrive(walkTo)} reduced={reduced} sway={0.08} clearOf="left" />

      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -length / 2 + 6]}>
        <planeGeometry args={[HALF_WIDTH * 2, length]} />
        <meshStandardMaterial map={floorTex} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, 3.3, -length / 2 + 6]}>
        <planeGeometry args={[HALF_WIDTH * 2, length]} />
        <meshStandardMaterial color="#e6d8bf" />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * HALF_WIDTH, 1.65, -length / 2 + 6]} rotation-y={s === -1 ? Math.PI / 2 : -Math.PI / 2}>
            <planeGeometry args={[length, 3.3]} />
            <meshStandardMaterial color="#eadcc2" />
          </mesh>
          <mesh position={[s * (HALF_WIDTH - 0.02), 0.45, -length / 2 + 6]} rotation-y={s === -1 ? Math.PI / 2 : -Math.PI / 2}>
            <planeGeometry args={[length, 0.9]} />
            <meshStandardMaterial color="#b89a73" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.65, -length + 6]}>
        <planeGeometry args={[HALF_WIDTH * 2, 3.3]} />
        <meshStandardMaterial color="#e2d2b4" />
      </mesh>

      {ROOMS.map((room, i) => (
        <Door key={room.id} room={room} index={i} onPick={onPick} />
      ))}

      {visitors.slice(0, 12).map((v, i) => {
        const roomIndex = ROOMS.findIndex((r) => r.id === v.room);
        const z = roomIndex >= 0 ? doorPlacement(roomIndex).z + 0.8 : -1.5 - hash01(i + 3) * (ROOMS.length * DOOR_SPACING - 2);
        const x = (hash01(i + 40) - 0.5) * 3.2;
        return (
          <Drift key={i} x={x} z={z} phase={i * 1.7} reduced={reduced}>
            <Character spriteKey={`${v.avatar}/neutral`} height={1.15 + hash01(i + 9) * 0.25} position={[0, 0, 0]} opacity={0.5} phase={i} motion={reduced ? 0 : 1} />
          </Drift>
        );
      })}
    </>
  );
}
