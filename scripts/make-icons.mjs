import { deflateSync } from "zlib";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(dir, { recursive: true });

function crc32(buf) {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const header = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([header, data])));
  return Buffer.concat([length, header, data, crc]);
}

function writePng(path, size, { pad = 0 } = {}) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const teal = [11, 93, 87];
  const cream = [255, 248, 236];
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const inner = x >= pad && x < size - pad && y >= pad && y < size - pad;
      const [r, g, b] = inner ? teal : cream;
      const o = row + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }

  const inset = Math.floor(size * 0.28) + pad;
  const barW = Math.max(4, Math.floor(size * 0.11));
  const barH = Math.floor(size * 0.42);
  for (let y = inset; y < inset + barH; y += 1) {
    for (let x = inset; x < inset + barW; x += 1) {
      const row = y * (size * 3 + 1);
      const o = row + 1 + x * 3;
      raw[o] = cream[0];
      raw[o + 1] = cream[1];
      raw[o + 2] = cream[2];
    }
  }
  const crossY = inset + Math.floor(barH * 0.28);
  const crossH = Math.max(4, Math.floor(size * 0.1));
  const crossW = Math.floor(size * 0.34);
  for (let y = crossY; y < crossY + crossH; y += 1) {
    for (let x = inset; x < inset + crossW; x += 1) {
      const row = y * (size * 3 + 1);
      const o = row + 1 + x * 3;
      raw[o] = cream[0];
      raw[o + 1] = cream[1];
      raw[o + 2] = cream[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
}

writePng(join(dir, "icon-192.png"), 192);
writePng(join(dir, "icon-512.png"), 512);
writePng(join(dir, "icon-maskable-512.png"), 512, { pad: 64 });
console.log("wrote PWA icons");
