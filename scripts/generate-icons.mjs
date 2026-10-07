// Генерирует PNG-иконки (для iOS и манифеста) без внешних зависимостей.
// Рисует тот же дизайн, что и public/icon.svg: мишень на тёмном фоне.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [15, 23, 42];
const FG = [16, 185, 129];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

// Покрытие пикселя «чернилами» мишени в координатах 512x512.
function ink(x, y) {
  const d = Math.hypot(x - 256, y - 256);
  if (Math.abs(d - 170) <= 20) return 1;
  if (Math.abs(d - 95) <= 20) return 1;
  if (d <= 30) return 1;
  return 0;
}

function render(size, { rounded }) {
  const SS = 4; // суперсэмплинг для сглаживания
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const s = 512 / size;
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      let cov = 0, alpha = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) * s;
          const y = (py + (sy + 0.5) / SS) * s;
          let inside = true;
          if (rounded) {
            const r = 96;
            const cx = Math.min(Math.max(x, r), 512 - r);
            const cy = Math.min(Math.max(y, r), 512 - r);
            inside = Math.hypot(x - cx, y - cy) <= r;
          }
          if (inside) {
            alpha++;
            cov += ink(x, y);
          }
        }
      }
      const n = SS * SS;
      const t = alpha ? cov / alpha : 0;
      const o = py * (size * 4 + 1) + 1 + px * 4;
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(BG[i] + (FG[i] - BG[i]) * t);
      raw[o + 3] = Math.round((alpha / n) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// iOS сам скругляет углы, поэтому apple-touch-icon и maskable — квадратные.
writeFileSync('public/apple-touch-icon.png', render(180, { rounded: false }));
writeFileSync('public/icon-192.png', render(192, { rounded: false }));
writeFileSync('public/icon-512.png', render(512, { rounded: false }));
console.log('Icons generated in public/');
