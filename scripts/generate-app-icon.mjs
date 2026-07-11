import { writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const size = 1024;
const padding = 96;
const inner = size - padding * 2;
const radius = 200;

const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${padding}" y="${padding}" width="${inner}" height="${inner}" rx="${radius}" fill="#1a1a22"/>
  <rect x="300" y="250" width="424" height="524" rx="28" fill="#f4f4f5"/>
  <line x1="360" y1="360" x2="664" y2="360" stroke="#d4d4d8" stroke-width="18" stroke-linecap="round"/>
  <line x1="360" y1="430" x2="664" y2="430" stroke="#d4d4d8" stroke-width="18" stroke-linecap="round"/>
  <line x1="360" y1="500" x2="600" y2="500" stroke="#d4d4d8" stroke-width="18" stroke-linecap="round"/>
  <line x1="360" y1="570" x2="640" y2="570" stroke="#d4d4d8" stroke-width="18" stroke-linecap="round"/>
  <line x1="360" y1="640" x2="560" y2="640" stroke="#d4d4d8" stroke-width="18" stroke-linecap="round"/>
  <line x1="560" y1="250" x2="560" y2="774" stroke="#14b8a6" stroke-width="6" stroke-dasharray="18 16"/>
  <circle cx="560" cy="820" r="52" fill="#14b8a6"/>
  <circle cx="536" cy="804" r="10" fill="#0f766e"/>
  <circle cx="584" cy="804" r="10" fill="#0f766e"/>
  <path d="M500 860 L560 790 L620 860 Z" fill="#ccfbf1"/>
  <path d="M520 250 L600 250 L560 190 Z" fill="#14b8a6"/>
</svg>
`;

const outputPath = join(
	import.meta.dirname,
	"../apps/web/src-tauri/app-icon.png",
);

const png = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync(outputPath, png);

console.log(`Wrote ${outputPath}`);
