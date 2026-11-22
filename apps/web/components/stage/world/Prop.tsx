"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Real scanned/modelled props (CC0, Poly Haven) packed as GLB in /public/props. See CLAUDE.md. */
const loader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Object3D | null>>();

export function loadProp(name: string): Promise<THREE.Object3D | null> {
  let p = cache.get(name);
  if (!p) {
    p = loader
      .loadAsync(`/props/${name}.glb`)
      .then((g) => {
        g.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.castShadow = true;
          m.receiveShadow = true;
          for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
            const s = mat as THREE.MeshStandardMaterial;
            // Foliage cards: cut-out alpha sorts and shadows correctly, blended alpha does neither.
            if (s.transparent && s.map) {
              s.transparent = false;
              s.alphaTest = 0.45;
              s.depthWrite = true;
              s.side = THREE.DoubleSide;
            }
          }
        });
        g.scene.updateMatrixWorld(true);
        return g.scene;
      })
      .catch(() => null); // a missing prop just leaves a gap
    cache.set(name, p);
  }
  return p;
}

export interface PropProps {
  name: string;
  position?: [number, number, number];
  rotationY?: number;
  /** Scale the model so it is this tall (metres). */
  height?: number;
  /** ...or this wide along x. */
  width?: number;
  scale?: number;
  shadows?: boolean;
}

export function Prop({ name, position = [0, 0, 0], rotationY = 0, height, width, scale = 1, shadows = true }: PropProps) {
  const [obj, setObj] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    let live = true;
    loadProp(name).then((o) => live && setObj(o ? o.clone(true) : null));
    return () => {
      live = false;
    };
  }, [name]);
  useEffect(() => {
    if (!obj) return;
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.castShadow = shadows;
    });
  }, [obj, shadows]);
  // Measured once, before the model sits inside the scaled group (a later measurement would include the scale).
  const fit = useMemo(() => {
    if (!obj) return null;
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    return { k: height ? height / size.y : width ? width / size.x : 1, minY: box.min.y };
  }, [obj, height, width]);
  if (!obj || !fit) return null;
  return (
    <group position={position} rotation-y={rotationY} scale={fit.k * scale}>
      <primitive object={obj} position-y={-fit.minY} />
    </group>
  );
}
