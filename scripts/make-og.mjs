/** Builds apps/web/public/og.png (1200x630) from the interviewer sprite. Run once; the PNG is committed. */
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const W = 1200;
const H = 630;
const wolf = await sharp("apps/web/public/characters/interviewer/warm.webp").resize({ height: 520 }).png().toBuffer();
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><radialGradient id="g" cx="70%" cy="40%" r="80%"><stop offset="0" stop-color="#fff4e0"/><stop offset="1" stop-color="#e3d2b3"/></radialGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <text x="70" y="150" font-family="Georgia, serif" font-size="30" font-weight="700" fill="#b8401f" letter-spacing="3">INTERVIEW TOWER</text>
  <text x="70" y="250" font-family="Georgia, serif" font-size="68" font-weight="700" fill="#2c1d14">Walk in.</text>
  <text x="70" y="330" font-family="Georgia, serif" font-size="68" font-weight="700" fill="#2c1d14">Get asked.</text>
  <text x="70" y="410" font-family="Georgia, serif" font-size="68" font-weight="700" fill="#2c1d14">Find the trap.</text>
  <text x="70" y="490" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#5e4a3c">Five floors of AI interview rooms. No login.</text>
</svg>`;
const out = await sharp(Buffer.from(svg)).composite([{ input: wolf, left: 650, top: 70 }]).png({ compressionLevel: 9 }).toBuffer();
writeFileSync("apps/web/public/og.png", out);
console.log(`og.png ${out.length} bytes`);
