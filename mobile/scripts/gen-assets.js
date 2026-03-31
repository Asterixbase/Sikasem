/**
 * Generates minimal solid-color PNG assets for Sikasem.
 * Brand green: #1B6B3A  White: #ffffff
 * Sizes: icon 1024x1024, splash 1284x2778, adaptive-icon 1024x1024, favicon 48x48
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height, r, g, b) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = chunk('IHDR', ihdrData);

  // Raw image data: each row = filter byte (0) + RGB pixels
  const rowSize = 1 + width * 3;
  const raw = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    const offset = y * rowSize;
    raw[offset] = 0; // filter type None
    for (let x = 0; x < width; x++) {
      raw[offset + 1 + x * 3] = r;
      raw[offset + 2 + x * 3] = g;
      raw[offset + 3 + x * 3] = b;
    }
  }
  const compressed = zlib.deflateSync(raw);
  const idat = chunk('IDAT', compressed);

  // IEND
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.concat([typeB, data]);
  const crc = Buffer.alloc(4);
  crc.writeInt32BE(crc32(crcBuf), 0);
  return Buffer.concat([len, typeB, data, crc]);
}

// CRC32
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) | 0;
}

const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });

// Brand green #1B6B3A
const [gr, gg, gb] = [0x1B, 0x6B, 0x3A];

// icon.png — 1024x1024 green
fs.writeFileSync(path.join(outDir, 'icon.png'), createPNG(1024, 1024, gr, gg, gb));
console.log('✓ icon.png');

// adaptive-icon.png — 1024x1024 green
fs.writeFileSync(path.join(outDir, 'adaptive-icon.png'), createPNG(1024, 1024, gr, gg, gb));
console.log('✓ adaptive-icon.png');

// splash.png — 1284x2778 green
fs.writeFileSync(path.join(outDir, 'splash.png'), createPNG(1284, 2778, gr, gg, gb));
console.log('✓ splash.png');

// favicon.png — 48x48 green
fs.writeFileSync(path.join(outDir, 'favicon.png'), createPNG(48, 48, gr, gg, gb));
console.log('✓ favicon.png');

console.log('All assets generated in assets/');
