// Generates icon-192.png and icon-512.png without any dependencies
// (minimal PNG encoder: IHDR + IDAT(zlib) + IEND).
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  // raw scanlines with filter byte 0
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// simple icon: dark rounded square, two overlapping circles (purple + blue)
function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const bg = [0x1a, 0x1b, 0x26], purple = [0xbb, 0x9a, 0xf7], blue = [0x7a, 0xa2, 0xf7];
  const r = size * 0.235;
  const c1 = [size * 0.39, size * 0.5], c2 = [size * 0.61, size * 0.5];
  const corner = size * 0.19;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // rounded-corner mask
      const cx = Math.min(Math.max(x, corner), size - corner);
      const cy = Math.min(Math.max(y, corner), size - corner);
      const inSquare = Math.hypot(x - cx, y - cy) <= corner;
      if (!inSquare) { px[i + 3] = 0; continue; }
      let col = bg;
      const d1 = Math.hypot(x - c1[0], y - c1[1]);
      const d2 = Math.hypot(x - c2[0], y - c2[1]);
      if (d1 <= r && d2 <= r) col = [0xc9, 0xb4, 0xf9]; // overlap = lighter
      else if (d1 <= r) col = purple;
      else if (d2 <= r) col = blue;
      px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = 255;
    }
  }
  return px;
}

for (const size of [192, 512]) {
  const file = path.join(__dirname, '..', `icon-${size}.png`);
  fs.writeFileSync(file, encodePng(size, size, drawIcon(size)));
  console.log('wrote', file);
}
