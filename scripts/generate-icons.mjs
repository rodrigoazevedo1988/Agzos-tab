/**
 * Generates the PNG assets shipped in `resources/icons`.
 *
 * Uses only Node built-ins (zlib) so icons are reproducible without any binary
 * asset in the repository history: run `node scripts/generate-icons.mjs`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Alpha coverage (0–255) of a rounded square with a bar and three dots. */
function sampleShape(x, y, size) {
  const pad = size * 0.12;
  const radius = size * 0.24;
  const inner = size - pad * 2;
  const left = pad;
  const top = pad;

  const dx = Math.max(left + radius - x, 0, x - (left + inner - radius));
  const dy = Math.max(top + radius - y, 0, y - (top + inner - radius));
  const distance = Math.hypot(dx, dy);
  if (distance > radius + 0.5) return 0;
  const edge = Math.min(1, Math.max(0, radius + 0.5 - distance));
  const body = Math.round(edge * 255);

  // Command-bar "prompt" glyph: a horizontal bar plus a caret-ish block.
  const barY0 = size * 0.44;
  const barY1 = size * 0.56;
  const barX0 = size * 0.27;
  const barX1 = size * 0.73;
  let glyph = 0;
  if (y >= barY0 && y <= barY1 && x >= barX0 && x <= barX1) glyph = 1;
  const dotR = size * 0.045;
  for (const cx of [size * 0.3, size * 0.5, size * 0.7]) {
    if (Math.hypot(x - cx, y - size * 0.72) <= dotR) glyph = 1;
  }

  if (glyph) return body;
  // Hollow body: only the ring is opaque.
  return distance > radius - size * 0.1 ? body : 0;
}

function renderIcon(size, color) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const alpha = Math.round(sampleShape(x + 0.5, y + 0.5, size));
      const offset = (y * size + x) * 4;
      rgba[offset] = color[0];
      rgba[offset + 1] = color[1];
      rgba[offset + 2] = color[2];
      rgba[offset + 3] = alpha;
    }
  }
  return encodePng(size, size, rgba);
}

/** Solid rounded-square background with the glyph carved out (for the app icon). */
function renderFilledIcon(size, background, foreground) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const alpha = Math.round(sampleShape(x + 0.5, y + 0.5, size));
      const offset = (y * size + x) * 4;
      // Background plate where the ring is, foreground on the glyph.
      const isGlyph = alpha > 0 && isGlyphPixel(x + 0.5, y + 0.5, size);
      const color = isGlyph ? foreground : background;
      rgba[offset] = color[0];
      rgba[offset + 1] = color[1];
      rgba[offset + 2] = color[2];
      rgba[offset + 3] = alpha > 0 ? 255 : 0;
    }
  }
  return encodePng(size, size, rgba);
}

function isGlyphPixel(x, y, size) {
  const barY0 = size * 0.44;
  const barY1 = size * 0.56;
  if (y >= barY0 && y <= barY1 && x >= size * 0.27 && x <= size * 0.73) return true;
  const dotR = size * 0.045;
  return [size * 0.3, size * 0.5, size * 0.7].some(
    (cx) => Math.hypot(x - cx, y - size * 0.72) <= dotR,
  );
}

const outDir = path.resolve('resources', 'icons');
mkdirSync(outDir, { recursive: true });

const black = [0, 0, 0];
const white = [255, 255, 255];
const brand = [47, 107, 255];

// macOS template images must be black + alpha and end with `Template`.
writeFileSync(path.join(outDir, 'trayTemplate.png'), renderIcon(16, black));
writeFileSync(path.join(outDir, 'trayTemplate@2x.png'), renderIcon(32, black));
// Cross-platform tray/window icon (blue accents).
writeFileSync(path.join(outDir, 'icon.png'), renderIcon(32, brand));
writeFileSync(path.join(outDir, 'icon@2x.png'), renderIcon(64, brand));
// Application icon plate.
writeFileSync(path.join(outDir, 'app-icon.png'), renderFilledIcon(256, brand, white));

console.log(`Icons written to ${outDir}`);
