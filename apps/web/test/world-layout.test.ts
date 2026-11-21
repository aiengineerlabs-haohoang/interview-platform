import { describe, expect, it } from "vitest";
import { ROOMS } from "@tower/shared";
import { BENCHES, FOUNTAIN, TOWERS, TOWER_W, TREES, WORLD_RADIUS, resolve } from "@/components/stage/world/layout";
import { MODELS, modelForAvatar } from "@/components/stage/world/vrm";

describe("campus layout", () => {
  it("has one tower per room, in floor order, all facing the plaza centre", () => {
    expect(TOWERS.map((t) => t.id)).toEqual(ROOMS.map((r) => r.id));
    for (const t of TOWERS) {
      // The tower's front is +Z rotated by `rot`; it must point at the origin.
      const fx = Math.sin(t.rot), fz = Math.cos(t.rot);
      const toCentre = [-t.x, -t.z];
      const len = Math.hypot(...(toCentre as [number, number]));
      expect(fx * (toCentre[0]! / len) + fz * (toCentre[1]! / len)).toBeCloseTo(1, 5);
    }
  });

  it("keeps every porch reachable: nothing solid sits on it", () => {
    for (const t of TOWERS) {
      const [x, z] = resolve(t.porch[0], t.porch[1]);
      expect(Math.hypot(x - t.porch[0], z - t.porch[1])).toBeLessThan(0.01);
    }
  });

  it("starts the player somewhere free", () => {
    const [x, z] = resolve(0, 17);
    expect([x, z]).toEqual([0, 17]);
  });

  it("pushes a visitor out of a tower wall instead of letting them walk through it", () => {
    const t = TOWERS[2]!;
    const [x, z] = resolve(t.x, t.z);
    const c = Math.cos(t.rot), s = Math.sin(t.rot);
    const lx = (x - t.x) * c - (z - t.z) * s;
    const lz = (x - t.x) * s + (z - t.z) * c;
    expect(Math.max(Math.abs(lx), Math.abs(lz))).toBeGreaterThanOrEqual(TOWER_W / 2);
  });

  it("pushes a visitor out of the fountain and keeps them inside the world", () => {
    const [x, z] = resolve(0.5, 0.5);
    expect(Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z)).toBeGreaterThanOrEqual(FOUNTAIN.r);
    const [fx, fz] = resolve(900, -900);
    expect(Math.hypot(fx, fz)).toBeLessThanOrEqual(WORLD_RADIUS + 1e-6);
  });

  it("slides you round the fountain when you walk straight at its middle, instead of sticking", () => {
    let x = 0, z = 12;
    for (let i = 0; i < 400; i++) [x, z] = resolve(x, z - 0.1);
    expect(z).toBeLessThan(-6);
  });

  it("never plants a tree in a tower or across the approach", () => {
    for (const tr of TREES) {
      for (const t of TOWERS) expect(Math.hypot(tr.x - t.x, tr.z - t.z)).toBeGreaterThan(12);
    }
    expect(BENCHES.length).toBeGreaterThan(0);
  });
});

describe("character models", () => {
  it("maps the four legacy animal avatars onto four distinct humans", () => {
    const mapped = (["owl", "fox", "cat", "rabbit"] as const).map(modelForAvatar);
    expect(new Set(mapped).size).toBe(4);
  });

  it("passes a human model name through and falls back for anything unknown", () => {
    for (const m of MODELS) expect(modelForAvatar(m)).toBe(m);
    expect(modelForAvatar("dragon")).toBe("sakura");
    expect(modelForAvatar(undefined)).toBe("sakura");
  });
});
