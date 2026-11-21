"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

export interface Pose {
  pos: [number, number, number];
  look: [number, number, number];
}

interface Props {
  /** Where the camera begins when the scene appears. It then glides to `rest`. */
  start: Pose;
  rest: Pose;
  /** While set, the camera goes here instead of `rest` (walking to a door). */
  goTo?: Pose | null;
  onArrive?: () => void;
  reduced: boolean;
  /** Gentle sway around the rest pose. */
  sway?: number;
  /** Extra distance, in metres, when the screen is taller than wide, so a wide scene still fits. */
  pullBack?: number;
  /** Which side the overlay panel is on. The picture is pushed away from it on a wide screen and up on a tall one. */
  clearOf?: "right" | "left";
}

const PANEL_PX = 460;

export function CameraRig({ start, rest, goTo, onArrive, reduced, sway = 0, pullBack = 0, clearOf }: Props) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const pos = useRef(new THREE.Vector3(...start.pos));
  const look = useRef(new THREE.Vector3(...start.look));
  const arrived = useRef(false);
  const tall = size.width / size.height < 0.9;

  useEffect(() => {
    const p = reduced ? rest.pos : start.pos;
    const l = reduced ? rest.look : start.look;
    pos.current.set(...p);
    look.current.set(...l);
    arrived.current = false;
  }, [start, rest, reduced]);

  useEffect(() => {
    arrived.current = false;
  }, [goTo]);

  useEffect(() => {
    const wide = size.width / size.height > 1.05;
    if (clearOf) {
      // setViewOffset's x is where the visible window starts: positive moves the picture left, negative right.
      const dx = Math.min(PANEL_PX / 2, size.width * 0.18);
      if (wide) camera.setViewOffset(size.width, size.height, clearOf === "right" ? dx : -dx, 0, size.width, size.height);
      else camera.setViewOffset(size.width, size.height, 0, size.height * (clearOf === "right" ? 0.27 : 0.2), size.width, size.height);
    } else {
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
    return () => {
      camera.clearViewOffset();
      camera.updateProjectionMatrix();
    };
  }, [camera, size.width, size.height, clearOf]);

  useFrame((state, dt) => {
    const target = goTo ?? rest;
    const back = tall && !goTo ? pullBack : 0;
    const k = reduced ? 1 : 1 - Math.exp(-dt * (goTo ? 2.6 : 2.2));
    const t = state.clock.elapsedTime;
    const sx = reduced ? 0 : Math.sin(t * 0.25) * sway;
    const sy = reduced ? 0 : Math.sin(t * 0.37) * sway * 0.35;
    pos.current.lerp(new THREE.Vector3(target.pos[0] + sx, target.pos[1] + sy, target.pos[2] + back), k);
    look.current.lerp(new THREE.Vector3(...target.look), k);
    camera.position.copy(pos.current);
    camera.lookAt(look.current);
    if (goTo && !arrived.current && pos.current.distanceTo(new THREE.Vector3(...goTo.pos)) < 0.12) {
      arrived.current = true;
      onArrive?.();
    }
  });
  return null;
}
