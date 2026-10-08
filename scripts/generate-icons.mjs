// Генерирует PNG-иконки (для iOS и манифеста) без внешних зависимостей.
// Мишень на тёмном фоне. Запуск: npm run icons
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

/** Пиксели RGBA (size × size × 4), сглаженные суперсэмплингом. */
function pixels(size, { rounded }) {
  const SS = 4;
  const out = Buffer.alloc(size * size * 4);
  const s = 512 / size;
  for (let py = 0; py < size; py++) {
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
      const t = alpha ? cov / alpha : 0;
      const o = (py * size + px) * 4;
      for (let i = 0; i < 3; i++) out[o + i] = Math.round(BG[i] + (FG[i] - BG[i]) * t);
      out[o + 3] = Math.round((alpha / (SS * SS)) * 255);
    }
  }
  return out;
}

function png(size, opts) {
  const px = pixels(size, opts);
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
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

/** Слой .ico в формате BMP: Windows понимает PNG внутри .ico только для размера 256. */
function bmp(size, opts) {
  const px = pixels(size, opts);
  const maskRow = Math.ceil(size / 32) * 4;
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8); // высота цвета + маски
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(size * size * 4 + maskRow * size, 20);
  const data = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = ((size - 1 - y) * size + x) * 4; // строки снизу вверх
      data[dst] = px[src + 2];
      data[dst + 1] = px[src + 1];
      data[dst + 2] = px[src];
      data[dst + 3] = px[src + 3];
    }
  }
  return Buffer.concat([header, data, Buffer.alloc(maskRow * size)]);
}

/** Иконка Windows (ярлык на рабочем столе): 16–48 px в BMP и 256 px в PNG. */
function ico(sizes, opts) {
  const images = sizes.map((size) => (size === 256 ? png(size, opts) : bmp(size, opts)));
  const head = Buffer.alloc(6 + 16 * sizes.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(sizes.length, 4);
  let offset = head.length;
  sizes.forEach((size, i) => {
    const e = 6 + 16 * i;
    head[e] = size === 256 ? 0 : size;
    head[e + 1] = size === 256 ? 0 : size;
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(images[i].length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += images[i].length;
  });
  return Buffer.concat([head, ...images]);
}

// iOS сам скругляет углы, поэтому apple-touch-icon и maskable — квадратные.
writeFileSync('icons/apple-touch-icon.png', png(180, { rounded: false }));
writeFileSync('icons/icon-192.png', png(192, { rounded: false }));
writeFileSync('icons/icon-512.png', png(512, { rounded: false }));
// Windows углы не скругляет — делаем это сами.
writeFileSync('icons/goals.ico', ico([16, 24, 32, 48, 64, 256], { rounded: true }));
console.log('Icons generated in icons/');
