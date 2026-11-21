import * as THREE from "three";
import sizes from "@/lib/sprites.generated.json";

export type SpriteKey = keyof typeof sizes;

const cache = new Map<string, THREE.Texture>();

/** One texture per sprite for the whole session. Expressions swap between already-loaded textures. */
export function spriteTexture(key: string): THREE.Texture {
  let t = cache.get(key);
  if (!t) {
    t = new THREE.TextureLoader().load(`/characters/${key}.webp`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    cache.set(key, t);
  }
  return t;
}

export function spriteAspect(key: string): number {
  const s = (sizes as Record<string, { w: number; h: number }>)[key];
  return s ? s.w / s.h : 1;
}

export function preload(keys: string[]): void {
  keys.forEach(spriteTexture);
}

/** A small canvas texture for signs, plaques and the whiteboard. Browser only. */
export function labelTexture(lines: string[], opts: { w?: number; h?: number; bg?: string; fg?: string; sub?: string } = {}): THREE.CanvasTexture {
  const { w = 512, h = 128, bg = "#f6ecdf", fg = "#2c1d14", sub = "#8a7565" } = opts;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.textAlign = "center";
  g.textBaseline = "middle";
  const step = h / (lines.length + 1);
  lines.forEach((line, i) => {
    g.fillStyle = i === 0 ? fg : sub;
    const size = i === 0 ? Math.round(h * (lines.length > 1 ? 0.34 : 0.5)) : Math.round(h * 0.2);
    g.font = `${i === 0 ? 700 : 500} ${size}px Georgia, 'Times New Roman', serif`;
    g.fillText(line, w / 2, step * (i + 1), w - 24);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function hash01(n: number): number {
  let h = Math.imul(n + 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
