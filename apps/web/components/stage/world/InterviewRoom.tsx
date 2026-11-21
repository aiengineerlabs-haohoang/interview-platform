"use client";

import { useFrame, useThree } from "@react-three/fiber";
import type { Expression } from "@tower/shared";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CameraRig } from "../CameraRig";
import { tex } from "./assets";
import { rng } from "./layout";
import { Human } from "./Human";
import { newAnimState, setEmote, type ModelId } from "./vrm";

export interface InterviewRoomProps {
  model: ModelId;
  interviewer: ModelId;
  expression: Expression;
  accent: string;
  reduced: boolean;
}

const W = 11, D = 9, H = 3.4;
const SEAT = 0.4;
const HIPS_SEATED = SEAT + 0.16;

function Shell({ accent }: { accent: string }) {
  const floor = useMemo(() => tex("floor_wood", { repeat: [5, 4] }), []);
  const plaster = useMemo(() => tex("wall_plaster", { repeat: [4, 1.5] }), []);
  const panel = useMemo(() => tex("wall_panel", { repeat: [4, 0.6] }), []);
  const view = useMemo(() => tex("window_view"), []);
  const carpet = useMemo(() => tex("carpet_grey", { repeat: [2.5, 2] }), []);
  const art = [useMemo(() => tex("poster_1"), []), useMemo(() => tex("poster_2"), []), useMemo(() => tex("poster_3"), [])];
  const frame = <meshStandardMaterial color="#2a211a" roughness={0.5} />;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={floor} roughness={0.55} color="#cdbba3" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.012} receiveShadow>
        <planeGeometry args={[5.2, 3.8]} />
        <meshStandardMaterial map={carpet} roughness={1} />
      </mesh>
      <mesh position={[0, H, 0]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#f3ece0" roughness={1} />
      </mesh>
      {/* back wall */}
      <mesh position={[0, H / 2, -D / 2]} receiveShadow>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial map={plaster} roughness={0.95} color="#f4ebdc" />
      </mesh>
      <mesh position={[0, 0.55, -D / 2 + 0.02]} receiveShadow>
        <planeGeometry args={[W, 1.1]} />
        <meshStandardMaterial map={panel} roughness={0.6} />
      </mesh>
      {/* right wall and front wall */}
      <mesh position={[W / 2, H / 2, 0]} rotation-y={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial map={plaster} roughness={0.95} color="#f1e6d3" />
      </mesh>
      <mesh position={[W / 2 - 0.02, 0.55, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[D, 1.1]} />
        <meshStandardMaterial map={panel} roughness={0.6} />
      </mesh>
      <mesh position={[0, H / 2, D / 2]} rotation-y={Math.PI}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial map={plaster} roughness={0.95} />
      </mesh>
      {/* window wall: a lit view with a frame over it */}
      <mesh position={[-W / 2, H / 2, 0]} rotation-y={Math.PI / 2} receiveShadow>
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial map={plaster} roughness={0.95} />
      </mesh>
      <mesh position={[-W / 2 + 0.03, 1.9, -0.6]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[6.4, 2.3]} />
        <meshBasicMaterial map={view} toneMapped={false} />
      </mesh>
      {[-3.8, -2.2, -0.6, 1.0, 2.6].map((z) => (
        <mesh key={z} position={[-W / 2 + 0.07, 1.9, z]}>
          <boxGeometry args={[0.08, 2.4, 0.07]} />
          {frame}
        </mesh>
      ))}
      {[0.75, 3.05].map((y) => (
        <mesh key={y} position={[-W / 2 + 0.07, y, -0.6]}>
          <boxGeometry args={[0.08, 0.07, 6.5]} />
          {frame}
        </mesh>
      ))}
      <mesh position={[-W / 2 + 0.2, 0.72, -0.6]}>
        <boxGeometry args={[0.4, 0.05, 6.7]} />
        <meshStandardMaterial color="#efe6d6" roughness={0.5} />
      </mesh>
      {/* posters */}
      {art.map((t, i) => (
        <group key={i} position={[-3 + i * 2.5, 2.05, -D / 2 + 0.05]}>
          <mesh>
            <boxGeometry args={[1.18, 1.5, 0.05]} />
            {frame}
          </mesh>
          <mesh position-z={0.03}>
            <planeGeometry args={[1.04, 1.36]} />
            <meshBasicMaterial map={t} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.06, -D / 2 + 0.02]}>
        <boxGeometry args={[W, 0.12, 0.04]} />
        <meshStandardMaterial color={accent} roughness={0.6} />
      </mesh>
      {/* ceiling lights */}
      {[-2.4, 0, 2.4].map((x) => (
        <mesh key={x} position={[x, H - 0.03, -0.2]}>
          <boxGeometry args={[1.5, 0.05, 0.5]} />
          <meshBasicMaterial color="#fff3d8" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Furniture() {
  const wood = useMemo(() => tex("table_wood", { repeat: [1.4, 1] }), []);
  const leaves = useMemo(() => tex("leaves", { repeat: [1, 1] }), []);
  const dark = <meshStandardMaterial color="#2b231d" roughness={0.5} metalness={0.2} />;
  const books = useMemo(() => {
    const r = rng(5);
    const cols = ["#a8483a", "#3f6f8f", "#4d7a52", "#c9a24b", "#6c4f8c", "#d8cdb8", "#8a5a3c"];
    return Array.from({ length: 4 * 11 }, (_, i) => ({ shelf: Math.floor(i / 11), x: (i % 11) * 0.092 - 0.46, h: 0.22 + r() * 0.12, c: cols[Math.floor(r() * cols.length)]! }));
  }, []);
  return (
    <group>
      {/* table */}
      <mesh position={[0, 0.72, -0.05]} castShadow receiveShadow>
        <boxGeometry args={[2.7, 0.07, 1.15]} />
        <meshStandardMaterial map={wood} roughness={0.35} />
      </mesh>
      {[-1.2, 1.2].flatMap((x) => [-0.45, 0.45].map((z) => (
        <mesh key={`${x}${z}`} position={[x, 0.36, -0.05 + z]} castShadow>
          <boxGeometry args={[0.07, 0.72, 0.07]} />
          {dark}
        </mesh>
      )))}
      {/* interviewer's laptop and notebook */}
      <group position={[-0.45, 0.755, -0.4]} rotation-y={0.1}>
        <mesh castShadow><boxGeometry args={[0.36, 0.015, 0.25]} />{dark}</mesh>
        <mesh position={[0, 0.12, -0.12]} rotation-x={-0.25} castShadow>
          <boxGeometry args={[0.36, 0.24, 0.012]} />
          {dark}
        </mesh>
        <mesh position={[0, 0.12, -0.113]} rotation-x={-0.25}>
          <planeGeometry args={[0.33, 0.21]} />
          <meshBasicMaterial color="#9fc2dd" toneMapped={false} />
        </mesh>
      </group>
      <mesh position={[0.5, 0.757, -0.35]} rotation-y={-0.2} castShadow>
        <boxGeometry args={[0.24, 0.016, 0.32]} />
        <meshStandardMaterial color="#f4ecdc" roughness={0.8} />
      </mesh>
      <mesh position={[0.52, 0.77, -0.35]} rotation-y={-0.2}>
        <boxGeometry args={[0.15, 0.003, 0.002]} />
        <meshStandardMaterial color="#c0392b" />
      </mesh>
      {/* water for two */}
      <mesh position={[0.05, 0.86, 0.15]} castShadow>
        <cylinderGeometry args={[0.055, 0.07, 0.24, 20]} />
        <meshStandardMaterial color="#cfe7ee" transparent opacity={0.55} roughness={0.05} />
      </mesh>
      {[-0.35, 0.4].map((x) => (
        <mesh key={x} position={[x, 0.8, 0.3]} castShadow>
          <cylinderGeometry args={[0.035, 0.03, 0.09, 16]} />
          <meshStandardMaterial color="#d9eef4" transparent opacity={0.6} roughness={0.05} />
        </mesh>
      ))}
      {/* chairs */}
      {[{ z: -1.4, ry: 0, back: true }, { z: 1.3, ry: Math.PI, back: false }].map((c) => (
        <group key={c.z} position={[0, 0, c.z]} rotation-y={c.ry}>
          <mesh position={[0, SEAT, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.62, 0.07, 0.6]} />
            <meshStandardMaterial color="#2f3b4a" roughness={0.8} />
          </mesh>
          {c.back && (
            <mesh position={[0, 0.78, -0.3]} rotation-x={-0.06} castShadow>
              <boxGeometry args={[0.6, 0.7, 0.07]} />
              <meshStandardMaterial color="#2f3b4a" roughness={0.8} />
            </mesh>
          )}
          <mesh position={[0, SEAT / 2, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, SEAT, 10]} />
            {dark}
          </mesh>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.32, 0.32, 0.04, 5]} />
            {dark}
          </mesh>
        </group>
      ))}
      {/* bookshelf on the right wall */}
      <group position={[5.5 - 0.22, 0, -1.2]} rotation-y={-Math.PI / 2}>
        <mesh position={[0, 1.1, 0]} castShadow>
          <boxGeometry args={[1.1, 2.2, 0.36]} />
          <meshStandardMaterial map={wood} roughness={0.6} />
        </mesh>
        {[0, 1, 2, 3].map((s) => (
          <group key={s} position={[0, 0.28 + s * 0.52, 0.02]}>
            <mesh position={[0, -0.02, 0.01]}><boxGeometry args={[1.0, 0.03, 0.34]} />{dark}</mesh>
            {books.filter((b) => b.shelf === s).map((b, i) => (
              <mesh key={i} position={[b.x + 0.04, b.h / 2, 0.02]}>
                <boxGeometry args={[0.07, b.h, 0.22]} />
                <meshStandardMaterial color={b.c} roughness={0.7} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      {/* a plant */}
      <group position={[4.7, 0, -3.7]}>
        <mesh position-y={0.3} castShadow>
          <cylinderGeometry args={[0.3, 0.22, 0.6, 20]} />
          <meshStandardMaterial color="#c9b9a0" roughness={0.8} />
        </mesh>
        {[[0, 1.1, 0, 0.5], [0.25, 1.5, 0.1, 0.4], [-0.22, 1.35, -0.12, 0.42], [0.05, 1.8, -0.05, 0.34]].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x!, y!, z!]} castShadow>
            <icosahedronGeometry args={[r!, 2]} />
            <meshStandardMaterial map={leaves} color="#bfe0a0" roughness={0.9} />
          </mesh>
        ))}
        <mesh position-y={0.75} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 0.9, 8]} />
          <meshStandardMaterial color="#6b4d33" />
        </mesh>
      </group>
      {/* floor lamp */}
      <group position={[-4.5, 0, -3.5]}>
        <mesh position-y={0.8}><cylinderGeometry args={[0.025, 0.025, 1.6, 8]} />{dark}</mesh>
        <mesh position-y={1.75}>
          <cylinderGeometry args={[0.2, 0.3, 0.38, 20, 1, true]} />
          <meshBasicMaterial color="#ffe3b0" side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        <pointLight position-y={1.7} color="#ffcf94" intensity={5} distance={7} decay={2} />
      </group>
    </group>
  );
}

function Scene({ model, interviewer, expression, accent, reduced }: InterviewRoomProps) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    scene.background = new THREE.Color("#2c241c");
    scene.fog = null;
  }, [scene]);

  const me = useMemo(() => { const a = newAnimState(); a.pose = "sit"; return a; }, []);
  const them = useMemo(() => { const a = newAnimState(); a.pose = "sit"; return a; }, []);
  useEffect(() => setEmote(them, expression), [expression, them]);

  const rig = useMemo(
    () => ({
      start: { pos: [3.2, 2.4, 5.2] as [number, number, number], look: [0, 1, -1] as [number, number, number] },
      rest: { pos: [3.3, 1.5, 2.5] as [number, number, number], look: [-0.15, 0.85, -0.35] as [number, number, number] },
    }),
    [],
  );

  return (
    <>
      <hemisphereLight args={["#fff1dc", "#8a6b4a", 0.9]} />
      <directionalLight position={[-6, 4, -1]} color="#ffd9a6" intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={5} shadow-camera-bottom={-3} shadow-bias={-0.0006} />
      <pointLight position={[0, 3, -0.2]} color="#fff0d6" intensity={14} distance={12} decay={2} />
      <Shell accent={accent} />
      <Furniture />
      <Human model={interviewer} anim={them} position={[0, 0, -1.4]} rotation={[0, 0, 0]} seat={HIPS_SEATED} />
      <Human model={model} anim={me} position={[0, 0, 1.3]} rotation={[0, Math.PI, 0]} seat={HIPS_SEATED} />
      <CameraRig start={rig.start} rest={rig.rest} reduced={reduced} sway={0.03} pullBack={3.6} clearOf="right" />
      <Bob target={them} />
    </>
  );
}

/** The interviewer leans a little when idle so the room is never frozen. */
function Bob({ target }: { target: ReturnType<typeof newAnimState> }) {
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    target.t = t.current;
  });
  return null;
}

export function InterviewRoom(p: InterviewRoomProps) {
  return <Scene {...p} />;
}
