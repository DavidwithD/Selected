// Generates the toolbar icons. Run: npm run icons
// No image library. Draws the pixels, then writes a PNG.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const OUT_DIR = path.join(__dirname, '..', 'icons');
const SIZES = [16, 48, 128];
const SUPERSAMPLE = 4;

const ACCENT = [47, 111, 237, 255]; // background
const BAR = [255, 255, 255, 240]; // selected lines
const RADIUS = 0.22; // corner radius, share of the icon width

// Three bars of different width, like selected lines of text.
const BARS = [
  { top: 0.28, width: 1.0 },
  { top: 0.45, width: 0.78 },
  { top: 0.62, width: 0.46 },
];
const BAR_HEIGHT = 0.1;
const PADDING = 0.2;

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // truecolour with alpha
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function insideRoundedSquare(x, y, side) {
  const r = side * RADIUS;
  const cx = Math.min(Math.max(x, r), side - r);
  const cy = Math.min(Math.max(y, r), side - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function insideBar(x, y, side) {
  const inner = side * (1 - 2 * PADDING);
  const left = side * PADDING;
  for (const bar of BARS) {
    const top = side * bar.top;
    if (
      x >= left &&
      x <= left + inner * bar.width &&
      y >= top &&
      y <= top + side * BAR_HEIGHT
    ) {
      return true;
    }
  }
  return false;
}

/** Draw at high resolution, then average down for smooth edges. */
function drawIcon(size) {
  const side = size * SUPERSAMPLE;
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const px = x * SUPERSAMPLE + sx + 0.5;
          const py = y * SUPERSAMPLE + sy + 0.5;
          if (!insideRoundedSquare(px, py, side)) continue;
          const color = insideBar(px, py, side) ? BAR : ACCENT;
          const alpha = color[3] / 255;
          r += color[0] * alpha;
          g += color[1] * alpha;
          b += color[2] * alpha;
          a += color[3];
        }
      }
      const samples = SUPERSAMPLE * SUPERSAMPLE;
      const alpha = a / samples;
      const at = (y * size + x) * 4;
      // Un-premultiply so partly covered edge pixels keep their colour.
      const scale = alpha > 0 ? 255 / alpha : 0;
      out[at] = Math.round(Math.min(255, (r / samples) * scale));
      out[at + 1] = Math.round(Math.min(255, (g / samples) * scale));
      out[at + 2] = Math.round(Math.min(255, (b / samples) * scale));
      out[at + 3] = Math.round(alpha);
    }
  }
  return out;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = path.join(OUT_DIR, `icon${size}.png`);
  fs.writeFileSync(file, encodePng(size, drawIcon(size)));
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}
