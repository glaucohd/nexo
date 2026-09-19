// Gera os ícones do app (PWA e iPhone) a partir da marca do Nexo: os cinco
// pontos em X, com o do centro dourado. Rode com: node scripts/generate-icons.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

// Marca original: caixa 26 × 24 com pontos de 7 px.
const DOTS = [[0, 0], [19, 0], [9.5, 8.5], [0, 17], [19, 17]];

function svg(size, { markShare }) {
  const scale = (size * markShare) / 26;
  const offsetX = (size - 26 * scale) / 2;
  const offsetY = (size - 24 * scale) / 2;
  const radius = 3.5 * scale;
  const dots = DOTS.map(([x, y], index) => {
    const color = index === 2 ? "#f2a930" : "#9677ff";
    return `<circle cx="${offsetX + (x + 3.5) * scale}" cy="${offsetY + (y + 3.5) * scale}" r="${radius}" fill="${color}"/>`;
  }).join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#0f0e15"/>${dots}</svg>`);
}

// markShare: largura da marca em relação ao ícone. Os "maskable" ficam
// menores para caber na área segura (círculo de 80%) que o Android recorta.
const outputs = [
  ["public/icons/icon-192.png", 192, 0.52],
  ["public/icons/icon-512.png", 512, 0.52],
  ["public/icons/maskable-512.png", 512, 0.42],
  ["src/app/apple-icon.png", 180, 0.52],
];

for (const [file, size, markShare] of outputs) {
  await sharp(svg(size, { markShare })).png().toFile(path.join(root, file));
  console.log(`ok ${file}`);
}
