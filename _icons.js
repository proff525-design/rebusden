/* Генерация PNG-иконок для Android из геометрии icon.svg (без внешних зависимостей) */
const zlib = require('zlib');
const fs = require('fs');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --- геометрия icon.svg (512x512) --- */
const HEX = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const C1 = HEX('#0d1026'), C2 = HEX('#33207a');
const GRIDS = [
  [76, 150, '#3ecf7a'], [201, 150, '#ffc94a'], [326, 150, '#3ecf7a'],
  [76, 275, '#3ecf7a'], [201, 275, 'rgba255'], [326, 275, '#ffc94a'],
];
const COMMA = [[420, 416, 26], [410, 458, 14]];
const COMMA_C = HEX('#ffb648');

const lerp = (a, b, t) => a + (b - a) * t;
function inRRSDF(x, y, rx, ry, w, h, r) {
  // расстояние до границы скруглённого прямоугольника (<0 внутри)
  const qx = Math.abs(x - (rx + w / 2)) - (w / 2 - r);
  const qy = Math.abs(y - (ry + h / 2)) - (h / 2 - r);
  const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}
function distCircle(x, y, cx, cy, r) { return Math.hypot(x - cx, y - cy) - r; }

/**
 * Рисует иконку. opts: { size, maskable } — maskable: фон на весь квадрат,
 * контент ужат в безопасную зону (scale 0.72), углы не скругляются.
 */
function renderIcon(size, maskable) {
  const SS = 4; // суперсемплинг 4x4
  const S = 512;
  const out = Buffer.alloc(size * size * 4);
  const scaleContent = maskable ? 0.72 : 1;
  const roundR = maskable ? 0 : 112;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = (px + (sx + 0.5) / SS) / size; // 0..1
          const fy = (py + (sy + 0.5) / SS) / size;
          // координаты в системе viewBox 512
          let x = fx * S, y = fy * S;
          // цвет фона-градиента
          const t = Math.min(1, Math.max(0, (fx + fy) / 2));
          let col = [lerp(C1[0], C2[0], t), lerp(C1[1], C2[1], t), lerp(C1[2], C2[2], t), 255];
          // маска фона (скругление / полное поле)
          if (roundR > 0) {
            const d = inRRSDF(x, y, 0, 0, S, S, roundR);
            if (d > 0.5) col = [0, 0, 0, 0];
            else if (d > -0.5) col = [col[0], col[1], col[2], Math.round(col[3] * (0.5 - d))];
          }
          // контент: переносим в центр и масштабируем (для maskable)
          const cx = (x - S / 2) / scaleContent + S / 2;
          const cy = (y - S / 2) / scaleContent + S / 2;
          // клетки
          for (const [gx, gy, color] of GRIDS) {
            const d = inRRSDF(cx, cy, gx, gy, 110, 110, 22);
            if (d < 0.9) {
              const a = Math.min(1, Math.max(0, 0.9 - d)) * (maskable ? 1 : 1);
              let cc;
              if (color === 'rgba255') cc = [255, 255, 255, 0.10];
              else { const c = HEX(color); cc = [c[0], c[1], c[2], 1]; }
              col = blend(col, cc, a);
            }
          }
          // запятая-ребус
          for (const [mx, my, mr] of COMMA) {
            const d = distCircle(cx, cy, mx, my, mr);
            if (d < 0.9) {
              const a = Math.min(1, Math.max(0, 0.9 - d));
              col = blend(col, [COMMA_C[0], COMMA_C[1], COMMA_C[2], 1], a);
            }
          }
          // усреднение в премультиплицированных каналах
          const av = col[3];
          rSum += col[0] * av; gSum += col[1] * av; bSum += col[2] * av; aSum += av;
        }
      }
      const n = SS * SS;
      const aAvg = aSum / n;
      let r, g, b;
      if (aAvg > 0) { r = rSum / aSum; g = gSum / aSum; b = bSum / aSum; }
      else { r = g = b = 0; }
      const o = (py * size + px) * 4;
      out[o] = Math.round(r); out[o + 1] = Math.round(g);
      out[o + 2] = Math.round(b); out[o + 3] = Math.round(Math.min(255, aAvg));
    }
  }
  return encodePNG(size, size, out);
}
function blend(dst, src, a) {
  // src: [r,g,b,a01], a: коэффициент покрытия
  const sa = src[3] * a;
  const da = dst[3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) return [0, 0, 0, 0];
  const r = (src[0] * sa + dst[0] * da * (1 - sa)) / outA;
  const g = (src[1] * sa + dst[1] * da * (1 - sa)) / outA;
  const b = (src[2] * sa + dst[2] * da * (1 - sa)) / outA;
  return [r, g, b, Math.round(outA * 255)];
}

fs.writeFileSync(__dirname + '/icon-512.png', renderIcon(512, false));
fs.writeFileSync(__dirname + '/icon-192.png', renderIcon(192, false));
fs.writeFileSync(__dirname + '/icon-512-maskable.png', renderIcon(512, true));
console.log('PNG-иконки записаны:',
  fs.statSync(__dirname + '/icon-512.png').size, '/',
  fs.statSync(__dirname + '/icon-192.png').size, '/',
  fs.statSync(__dirname + '/icon-512-maskable.png').size, 'байт');
