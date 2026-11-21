import { ROOMS, type RoomId } from "@tower/shared";

export const TOWER_W = 13;
export const TOWER_H = 24;
const RADIUS = 32;
const ANGLES = [104, 142, 180, 218, 256]; // degrees from south, round the north half so all five face the starting point

export interface TowerSpot {
  id: RoomId;
  name: string;
  color: string;
  floor: number;
  /** World position of the tower's centre on the ground. */
  x: number;
  z: number;
  /** Rotation about Y that turns the tower's front (+Z) toward the plaza centre. */
  rot: number;
  /** Where a visitor stands to use the door. */
  porch: [number, number];
}

export const TOWERS: TowerSpot[] = ROOMS.map((r, i) => {
  const a = (ANGLES[i]! * Math.PI) / 180;
  const x = RADIUS * Math.sin(a);
  const z = RADIUS * Math.cos(a);
  const rot = a + Math.PI;
  const d = TOWER_W / 2 + 2.6;
  return { id: r.id, name: r.name, color: r.color, floor: r.floor, x, z, rot, porch: [x + d * Math.sin(rot), z + d * Math.cos(rot)] };
});

/** Seeded random so trees and visitors land in the same places every visit. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Circle {
  x: number;
  z: number;
  r: number;
}

export const FOUNTAIN: Circle = { x: 0, z: 0, r: 4.7 };

export const TREES: Circle[] = (() => {
  const r = rng(7);
  const out: Circle[] = [];
  let guard = 0;
  while (out.length < 46 && guard++ < 800) {
    const ang = r() * Math.PI * 2;
    const rad = 28 + r() * 48;
    const x = rad * Math.sin(ang);
    const z = rad * Math.cos(ang);
    if (TOWERS.some((t) => Math.hypot(t.x - x, t.z - z) < 13)) continue;
    if (Math.hypot(x, z) < 34 && z > -4 && Math.abs(x) < 20) continue; // keep the approach open
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 4)) continue;
    out.push({ x, z, r: 0.8 });
  }
  return out;
})();

export const LAMPS: Circle[] = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2 + 0.15;
  return { x: 21 * Math.sin(a), z: 21 * Math.cos(a), r: 0.35 };
}).filter((l) => !TOWERS.some((t) => Math.hypot(t.x - l.x, t.z - l.z) < 12) && !(l.z > 8 && Math.abs(l.x) < 9));

export const BENCHES = [0.5, 1.9, 3.2, 4.4, 5.6].map((a) => ({ x: 9.5 * Math.sin(a), z: 9.5 * Math.cos(a), rot: a + Math.PI }));

export const WORLD_RADIUS = 70;

/** Push a point out of every solid thing. Towers are oriented boxes, the rest are circles. */
export function resolve(x: number, z: number, pr = 0.45): [number, number] {
  for (const t of TOWERS) {
    const c = Math.cos(t.rot), s = Math.sin(t.rot);
    const dx = x - t.x, dz = z - t.z;
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    const h = TOWER_W / 2 + pr;
    if (Math.abs(lx) < h && Math.abs(lz) < h) {
      let nx = lx, nz = lz;
      if (h - Math.abs(lx) < h - Math.abs(lz)) nx = Math.sign(lx || 1) * h;
      else nz = Math.sign(lz || 1) * h;
      x = t.x + nx * c + nz * s;
      z = t.z - nx * s + nz * c;
    }
  }
  for (const o of [FOUNTAIN, ...TREES, ...LAMPS]) {
    const dx = x - o.x, dz = z - o.z;
    const d = Math.hypot(dx, dz);
    const min = o.r + pr;
    if (d < min) {
      const nx = d === 0 ? 1 : dx / d;
      const nz = d === 0 ? 0 : dz / d;
      // Push out along the normal, plus a little along the tangent: walking dead-centre at a round obstacle then
      // slips round it instead of sticking (a purely radial push never gives the player any sideways motion).
      const slide = (min - d) * 0.8 + 0.01;
      let tx = -nz, tz = nx;
      if (tx * dx < 0) [tx, tz] = [-tx, -tz]; // slip away from the centre line, the way the player is already leaning
      x = o.x + nx * min + tx * slide;
      z = o.z + nz * min + tz * slide;
    }
  }
  const d = Math.hypot(x, z);
  if (d > WORLD_RADIUS) {
    x *= WORLD_RADIUS / d;
    z *= WORLD_RADIUS / d;
  }
  return [x, z];
}
