import * as THREE from "three";

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();

/**
 * A texture from /public/world, cached by name and returned at once: the image fills in when it arrives, so no
 * Suspense is needed and a missing file leaves a flat material rather than breaking the scene.
 */
export function tex(name: string, opts: { repeat?: [number, number]; srgb?: boolean } = {}): THREE.Texture {
  const [rx, ry] = opts.repeat ?? [1, 1];
  const key = `${name}|${rx}|${ry}`;
  let t = cache.get(key);
  if (!t) {
    t = loader.load(`/world/${name}.webp`);
    t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.anisotropy = 8;
    cache.set(key, t);
  }
  return t;
}

/** Plain text on a coloured plate, for signs. Drawn in the browser so the lettering is always correct. */
export function signTexture(lines: { text: string; size: number; weight?: string; color?: string }[], bg: string, w = 1024, h = 256): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.textAlign = "center";
  g.textBaseline = "middle";
  const total = lines.reduce((a, l) => a + l.size * 1.2, 0);
  let y = (h - total) / 2;
  for (const l of lines) {
    g.font = `${l.weight ?? "700"} ${l.size}px Georgia, 'Times New Roman', serif`;
    g.fillStyle = l.color ?? "#fff8ec";
    g.fillText(l.text, w / 2, y + l.size * 0.6);
    y += l.size * 1.2;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
