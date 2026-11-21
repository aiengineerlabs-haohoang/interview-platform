"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { spriteAspect, spriteTexture } from "./sprites";

interface Props {
  spriteKey: string;
  /** World height in metres. */
  height: number;
  /** Where the feet are. */
  position: [number, number, number];
  opacity?: number;
  /** 0 disables the idle motion. */
  motion?: number;
  phase?: number;
  /** Bump to make the character pop when its expression changes. */
  popKey?: string;
}

/** A watercolour character standing in the 3D world, always turned to the camera, breathing a little. */
export function Character({ spriteKey, height, position, opacity = 1, motion = 1, phase = 0, popKey }: Props) {
  const ref = useRef<THREE.Sprite>(null);
  const lastKey = useRef(popKey);
  const popT = useRef(1);
  const aspect = spriteAspect(spriteKey);

  useFrame((state, dt) => {
    const s = ref.current;
    if (!s) return;
    if (lastKey.current !== popKey) {
      lastKey.current = popKey;
      popT.current = 0;
    }
    popT.current = Math.min(1, popT.current + dt * 4);
    const pop = motion ? 1 + 0.07 * Math.sin(Math.PI * popT.current) : 1;
    const breathe = motion ? 1 + 0.012 * Math.sin(state.clock.elapsedTime * 1.7 + phase) : 1;
    s.scale.set(height * aspect * pop, height * breathe * pop, 1);
    s.position.y = position[1] + (height * breathe * pop) / 2;
  });

  return (
    <sprite ref={ref} position={[position[0], position[1] + height / 2, position[2]]} scale={[height * aspect, height, 1]}>
      <spriteMaterial map={spriteTexture(spriteKey)} transparent opacity={opacity} depthWrite={false} />
    </sprite>
  );
}
