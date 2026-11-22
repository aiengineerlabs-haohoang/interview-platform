"use client";

import { useFrame, useThree } from "@react-three/fiber";
import type { Expression } from "@tower/shared";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CameraRig } from "../CameraRig";
import { tex } from "./assets";
import { Human } from "./Human";
import { Prop } from "./Prop";
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
  const dark = <meshStandardMaterial color="#2b231d" roughness={0.5} metalness={0.2} />;
  return (
    <group>
      <Prop name="dtable" position={[0, 0, -0.05]} height={0.74} />
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
      <Prop name="chair2" position={[0, 0, -1.4]} height={0.86} />
      <Prop name="chair2" position={[0, 0, 1.3]} rotationY={Math.PI} height={0.86} />
      <Prop name="bookshelf" position={[5.5 - 0.32, 0, -1.2]} rotationY={-Math.PI / 2} height={2.1} />
      <Prop name="display" position={[-4.7, 0, -4.1]} height={1.6} />
      <Prop name="plant" position={[4.7, 0, -3.7]} height={1.6} />
      <Prop name="clock" position={[3.4, 2.75, -D / 2 + 0.02]} height={0.55} shadows={false} />
      <Prop name="mirror" position={[4.5, 1.75, -D / 2 + 0.02]} height={1.0} shadows={false} />
      <Prop name="teaset" position={[-0.55, 0.74, 0.18]} width={0.5} />
      <Prop name="stationery" position={[0.85, 0.74, 0.12]} rotationY={0.4} scale={1.6} />
      <Prop name="frame" position={[0.95, 0.74, -0.42]} rotationY={-0.5} height={0.22} />
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
