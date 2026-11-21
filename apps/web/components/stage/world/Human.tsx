"use client";

import type { VRM } from "@pixiv/three-vrm";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { animate, loadVrm, type AnimState, type ModelId } from "./vrm";

interface Props {
  model: ModelId;
  anim: AnimState;
  group?: React.Ref<THREE.Group>;
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** When seated, the height the hips should sit at, in metres. The model is lowered by however tall it stands. */
  seat?: number;
  onLoaded?: () => void;
}

/** A chibi human. The parent owns `anim` (pose, speed, emote) and mutates it; this just plays it. */
export function Human({ model, anim, group, position, rotation, seat, onLoaded }: Props) {
  const lift = useRef<THREE.Group>(null);
  const [vrm, setVrm] = useState<VRM | null>(null);
  useEffect(() => {
    let alive = true;
    setVrm(null);
    loadVrm(model).then(
      (v) => {
        if (!alive) return;
        setVrm(v);
        onLoaded?.();
      },
      (e) => console.error("vrm load failed", model, e),
    );
    return () => {
      alive = false;
    };
  }, [model]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    if (!vrm) return;
    animate(vrm, anim, Math.min(dt, 0.05));
    if (lift.current) lift.current.position.y = seat !== undefined && anim.pose === "sit" ? seat - (vrm.scene.userData.hipsH as number) : 0;
  });

  return (
    <group ref={group} position={position} rotation={rotation}>
      <group ref={lift}>{vrm && <primitive object={vrm.scene} />}</group>
    </group>
  );
}
