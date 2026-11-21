/**
 * Crops each watercolour character to its ink box and writes a small WebP with alpha.
 *   node scripts/optimize-sprites.mjs <characters-dir>   (the shorts-studio assets/characters folder)
 * Output: apps/web/public/characters/<who>/<expression>.webp and apps/web/lib/sprites.generated.json (sizes).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const src = resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: optimize-sprites.mjs <characters-dir>");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "apps/web/public/characters");
const bbox = JSON.parse(readFileSync(join(src, "bbox.json"), "utf8"));

const INTERVIEWER = ["neutral", "thinking", "confident", "confused", "shocked", "smug", "warm"];
const AVATAR = ["neutral", "thinking", "confident", "confused", "warm"];
const jobs = [
  ...INTERVIEWER.map((e) => ["interviewer", e]),
  ...["owl", "fox", "cat", "rabbit"].flatMap((who) => AVATAR.map((e) => [who, e])),
];
const PAD = 12;
const MAX = 560;
const sizes = {};
for (const [who, expr] of jobs) {
  const box = bbox[`${who}/${expr}`];
  if (!box) throw new Error(`no bbox for ${who}/${expr}`);
  const left = Math.max(0, box.x0 - PAD);
  const top = Math.max(0, box.y0 - PAD);
  const width = Math.min(box.w - left, box.iw + 2 * PAD);
  const height = Math.min(box.h - top, box.ih + 2 * PAD);
  mkdirSync(join(out, who), { recursive: true });
  const buf = await sharp(join(src, who, `${expr}.png`))
    .extract({ left, top, width, height })
    .resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 90 })
    .toBuffer({ resolveWithObject: true });
  writeFileSync(join(out, who, `${expr}.webp`), buf.data);
  sizes[`${who}/${expr}`] = { w: buf.info.width, h: buf.info.height };
}
writeFileSync(join(root, "apps/web/lib/sprites.generated.json"), JSON.stringify(sizes, null, 1) + "\n");
console.log(`wrote ${jobs.length} sprites to ${out}`);
