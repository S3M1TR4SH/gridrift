import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const branding = join(root, 'branding');
mkdirSync(branding, { recursive: true });

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, { inset = 0.08 } = {}) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const margin = Math.floor(size * inset);
  const grid = 8;
  const span = size - margin * 2;
  const cell = span / grid;
  const marks = new Set(['2,2', '3,2', '4,2', '3,3', '3,4', '4,4', '5,4']);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const index = row + 1 + x * 4;
      let red = 16;
      let green = 20;
      let blue = 29;
      if (x >= margin && y >= margin && x < size - margin && y < size - margin) {
        const gx = Math.floor((x - margin) / cell);
        const gy = Math.floor((y - margin) / cell);
        const lx = (x - margin) % cell;
        const ly = (y - margin) % cell;
        const inside = lx > cell * 0.14 && lx < cell * 0.86 && ly > cell * 0.14 && ly < cell * 0.86;
        if (inside && gx >= 1 && gx <= 6 && gy >= 1 && gy <= 6) {
          if (marks.has(`${gx},${gy}`)) {
            red = 62;
            green = 207;
            blue = 142;
          } else {
            red = 32;
            green = 40;
            blue = 56;
          }
        }
      }
      raw[index] = red;
      raw[index + 1] = green;
      raw[index + 2] = blue;
      raw[index + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function ico(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, pngBuffer]);
}

const files = {
  'icon-192.png': png(192),
  'icon-512.png': png(512),
  'icon-512-maskable.png': png(512, { inset: 0.18 }),
  'apple-touch-icon.png': png(180),
  'favicon-32.png': png(32, { inset: 0.02 })
};

for (const [name, buffer] of Object.entries(files)) {
  writeFileSync(join(branding, name), buffer);
}
writeFileSync(join(branding, 'favicon.ico'), ico(files['favicon-32.png'], 32));
