import { writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

// Retina DMG background for a 660x400 window (2x).
const width = 1320;
const height = 800;

// Matches bundle.macOS.dmg positions in tauri.conf.json, scaled 2x.
const appCenterX = 360;
const appCenterY = 340;
const applicationsCenterX = 960;
const applicationsCenterY = 340;

const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#14141a"/>
      <stop offset="100%" stop-color="#0f1014"/>
    </linearGradient>
    <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
      <path d="M0,0 L10,5 L0,10 Z" fill="#14b8a6" opacity="0.85"/>
    </marker>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#bg)"/>

  <path
    d="M ${appCenterX + 120} ${appCenterY}
       C ${appCenterX + 220} ${appCenterY - 40}, ${applicationsCenterX - 220} ${applicationsCenterY - 40}, ${applicationsCenterX - 120} ${applicationsCenterY}"
    fill="none"
    stroke="#14b8a6"
    stroke-width="8"
    stroke-linecap="round"
    stroke-dasharray="18 16"
    opacity="0.75"
    marker-end="url(#arrowhead)"
  />

  <text
    x="${width / 2}"
    y="700"
    text-anchor="middle"
    fill="#e4e4e7"
    font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif"
    font-size="34"
    font-weight="500"
    opacity="0.92"
  >
    Drag CV Tailor to Applications
  </text>
</svg>
`;

const outputPath = join(
	import.meta.dirname,
	"../apps/web/src-tauri/icons/dmg-background.png",
);

const png = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync(outputPath, png);

console.log(`Wrote ${outputPath} (${width}x${height})`);
