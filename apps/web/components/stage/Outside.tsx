"use client";

import { ROOMS } from "@tower/shared";
import { useMemo, useState } from "react";
import * as THREE from "three";
import { CameraRig } from "./CameraRig";
import { Character } from "./Character";
import { hash01, labelTexture } from "./sprites";

const FLOOR_H = 2.4;
const COLS = 5;

/** Which windows are lit, in a fixed pseudo-random order, so the glow reads as people and not as a progress bar. */
export function litWindows(online: number, total: number): Set<number> {
  const order = Array.from({ length: total }, (_, i) => i).sort((a, b) => hash01(a) - hash01(b));
  const lit = Math.min(total, 4 + online);
  return new Set(order.slice(0, lit));
}

export function Outside({ online, reduced, onEnter }: { online: number; reduced: boolean; onEnter: () => void }) {
  const [hover, setHover] = useState(false);
  const lit = useMemo(() => litWindows(online, ROOMS.length * COLS), [online]);
  const sign = useMemo(() => labelTexture(["INTERVIEW TOWER"], { w: 768, h: 160, bg: "#3b2a1e", fg: "#f6ecdf" }), []);
  const cream = useMemo(() => new THREE.Color("#efe3d0"), []);

  return (
    <>
      <color attach="background" args={["#bcd6e2"]} />
      <fog attach="fog" args={["#bcd6e2", 28, 70]} />
      <hemisphereLight args={["#fff4e0", "#8da36f", 1.15]} />
      <directionalLight position={[8, 14, 10]} intensity={1.6} color="#fff0d6" />
      <CameraRig
        start={{ pos: [11, 3.2, 21], look: [0, 6, 0] }}
        rest={{ pos: [6.5, 4.2, 16.5], look: [0, 5.6, 0] }}
        reduced={reduced}
        sway={1.1}
      />

      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[60, 48]} />
        <meshStandardMaterial color="#9db77f" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 8]}>
        <planeGeometry args={[2.2, 16]} />
        <meshStandardMaterial color="#e6d3b3" />
      </mesh>

      {ROOMS.map((room, i) => {
        const y = i * FLOOR_H + FLOOR_H / 2;
        const tint = cream.clone().lerp(new THREE.Color(room.color), 0.28);
        return (
          <group key={room.id}>
            <mesh position={[0, y, 0]}>
              <boxGeometry args={[7, FLOOR_H, 5]} />
              <meshStandardMaterial color={tint} />
            </mesh>
            <mesh position={[0, y - FLOOR_H / 2 + 0.05, 0]}>
              <boxGeometry args={[7.2, 0.12, 5.2]} />
              <meshStandardMaterial color="#c9b89c" />
            </mesh>
            {Array.from({ length: COLS }, (_, c) => {
              const idx = i * COLS + c;
              const on = lit.has(idx);
              const isDoorSlot = i === 0 && c === 2;
              if (isDoorSlot) return null;
              return (
                <mesh key={c} position={[-2.8 + c * 1.4, y + 0.1, 2.52]}>
                  <planeGeometry args={[0.7, 1.0]} />
                  <meshStandardMaterial color={on ? "#ffd479" : "#6f8794"} emissive={on ? "#ffb84a" : "#000000"} emissiveIntensity={on ? 1.2 : 0} />
                </mesh>
              );
            })}
          </group>
        );
      })}

      <mesh position={[0, ROOMS.length * FLOOR_H + 0.15, 0]}>
        <boxGeometry args={[7.4, 0.3, 5.4]} />
        <meshStandardMaterial color="#8a5a3c" />
      </mesh>
      <mesh position={[2.4, ROOMS.length * FLOOR_H + 1.1, -1]}>
        <cylinderGeometry args={[0.04, 0.04, 1.8]} />
        <meshStandardMaterial color="#555" />
      </mesh>

      <mesh position={[0, 2.12, 2.56]}>
        <planeGeometry args={[3.6, 0.75]} />
        <meshBasicMaterial map={sign} />
      </mesh>

      <mesh
        position={[0, 0.95, 2.58]}
        onClick={onEnter}
        onPointerOver={() => {
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
      >
        <boxGeometry args={[1.4, 1.9, 0.12]} />
        <meshStandardMaterial color="#7a4a28" emissive="#ffb347" emissiveIntensity={hover ? 0.7 : 0.12} />
      </mesh>
      <mesh position={[0.5, 0.95, 2.66]}>
        <sphereGeometry args={[0.07]} />
        <meshStandardMaterial color="#e8c15a" metalness={0.6} roughness={0.3} />
      </mesh>

      <Character spriteKey="interviewer/warm" height={2.1} position={[2.9, 0, 4.4]} phase={1} motion={reduced ? 0 : 1} />

      {[
        [-6, 3],
        [-9, -2],
        [8, -4],
        [10, 6],
        [-11, 7],
      ].map(([x, z], i) => (
        <group key={i} position={[x!, 0, z!]}>
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.16, 0.2, 1.4]} />
            <meshStandardMaterial color="#6f4a2d" />
          </mesh>
          <mesh position={[0, 2.2, 0]}>
            <sphereGeometry args={[1.25, 16, 12]} />
            <meshStandardMaterial color={i % 2 ? "#6d9a57" : "#7fa862"} />
          </mesh>
        </group>
      ))}
    </>
  );
}
