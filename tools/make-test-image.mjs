#!/usr/bin/env node
/**
 * 生成测试用的 PNG，避免下载外部图片来测导入链路。
 *
 *   node tools/make-test-image.mjs 输出目录
 *
 * 会写出 test-a.png 与 test-b.png（渐变图，尺寸不同）。
 */

import { writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function makePng(width, height, shade) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0; // 每行开头是过滤器类型
    offset += 1;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = shade(x / width, y / height);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      offset += 3;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 位深
  ihdr[9] = 2; // 真彩色

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outputDir = process.argv[2] ?? ".";

writeFileSync(
  path.join(outputDir, "test-a.png"),
  makePng(640, 480, (x, y) => [
    Math.round(29 + x * 60),
    Math.round(78 + y * 70),
    Math.round(137 - x * 40),
  ]),
);

writeFileSync(
  path.join(outputDir, "test-b.png"),
  makePng(480, 640, (x, y) => [
    Math.round(178 - y * 60),
    Math.round(58 + x * 120),
    Math.round(46 + y * 40),
  ]),
);

console.log(`已生成 test-a.png 与 test-b.png 到 ${outputDir}`);
