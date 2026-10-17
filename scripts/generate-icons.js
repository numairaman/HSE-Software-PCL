import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createCRC32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
}

const crcTable = createCRC32Table();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

function generatePNG(size, isMaskable = false) {
  const width = size;
  const height = size;
  const rawData = Buffer.alloc((width * 4 + 1) * height);

  // Industrial Emerald / Dark Slate theme
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 4 + 1);
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const nx = (x / width) * 2 - 1; // -1 to 1
      const ny = (y / height) * 2 - 1;

      // Base background: dark slate #0f172a
      let r = 15;
      let g = 23;
      let b = 42;
      let a = 255;

      const dist = Math.sqrt(nx * nx + ny * ny);

      // Rounded rectangle badge for app icon
      const cornerRadius = isMaskable ? 0.99 : 0.75;
      const isInsideBadge = Math.abs(nx) < cornerRadius && Math.abs(ny) < cornerRadius;

      // Draw a safety shield in the center
      // Shield geometry: top flat, sides vertical, curves down to point at bottom
      const shieldScale = isMaskable ? 0.5 : 0.6;
      const sx = nx / shieldScale;
      const sy = (ny + 0.05) / shieldScale;

      const inShieldTop = sy >= -0.7 && sy <= 0.0 && Math.abs(sx) <= 0.75;
      const inShieldBottom = sy > 0.0 && sy <= 0.85 && Math.abs(sx) <= (0.75 * (1 - (sy / 0.9) * (sy / 0.9)));

      if (inShieldTop || inShieldBottom) {
        // Emerald gradient: #10b981 to #047857
        const grad = (sy + 0.7) / 1.55;
        r = Math.round(16 * (1 - grad) + 5 * grad);
        g = Math.round(185 * (1 - grad) + 120 * grad);
        b = Math.round(129 * (1 - grad) + 87 * grad);

        // White cross / checkmark inside the shield
        const inCrossV = Math.abs(sx) <= 0.16 && sy >= -0.45 && sy <= 0.45;
        const inCrossH = Math.abs(sy + 0.05) <= 0.16 && Math.abs(sx) <= 0.45;

        if (inCrossV || inCrossH) {
          r = 255;
          g = 255;
          b = 255;
        }
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'icon-192.png'), generatePNG(192, false));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), generatePNG(512, false));
fs.writeFileSync(path.join(publicDir, 'icon-maskable.png'), generatePNG(512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generatePNG(180, false));

console.log('PWA icons generated successfully in /public');
