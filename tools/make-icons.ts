// One-off generator for public/icons/icon-{192,512}.png: a near-black rounded square with a
// cream "journal page" bar motif, in the UI contract's palette. Run: node tools/make-icons.ts
import { writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = (crcTable[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function icon(size: number): Buffer {
  const dark = [0x1c, 0x1b, 0x19, 255];
  const cream = [0xf7, 0xf3, 0xea, 255];
  const clear = [0, 0, 0, 0];
  const radius = size * 0.18;
  const rows: Buffer[] = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      const dx = Math.max(radius - x, 0, x - (size - 1 - radius));
      const dy = Math.max(radius - y, 0, y - (size - 1 - radius));
      let px = dx * dx + dy * dy > radius * radius ? clear : dark;
      const u = x / size;
      const v = y / size;
      const bar = (top: number, right: number) => v >= top && v < top + 0.08 && u >= 0.24 && u < right;
      if (px === dark && (bar(0.3, 0.76) || bar(0.46, 0.76) || bar(0.62, 0.58))) px = cream;
      row.set(px, 1 + x * 4);
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  await writeFile(`public/icons/icon-${size}.png`, icon(size));
}
