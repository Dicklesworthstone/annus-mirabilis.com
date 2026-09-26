import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The browser-tab icon. Until 2026-09-26 the site served none: /favicon.ico, /icon.png and
// /apple-icon.png were all 404 on live, and Chrome and Safari showed a blank tab. The App Router
// turns these three files in src/app into the <link rel="icon"> and apple-touch-icon tags itself.
const APP = dirname(fileURLToPath(import.meta.url));

function pngSize(bytes: Buffer): { width: number; height: number; colourType: number } {
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colourType: bytes[25] ?? -1,
  };
}

describe("the site icon", () => {
  test("favicon.ico holds 16, 32 and 48 pixel PNG images, for every tab and bookmark size", () => {
    const path = join(APP, "favicon.ico");
    expect(existsSync(path)).toBe(true);
    const ico = readFileSync(path);
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    const count = ico.readUInt16LE(4);
    const sizes: number[] = [];
    for (let i = 0; i < count; i++) {
      const at = 6 + 16 * i;
      const length = ico.readUInt32LE(at + 8);
      const offset = ico.readUInt32LE(at + 12);
      const image = pngSize(ico.subarray(offset, offset + length));
      expect(image.width).toBe(image.height);
      sizes.push(image.width);
    }
    expect(sizes).toEqual([16, 32, 48]);
  });

  test("icon.png is a 512 pixel square, for high-density tabs and installed shortcuts", () => {
    const image = pngSize(readFileSync(join(APP, "icon.png")));
    expect([image.width, image.height]).toEqual([512, 512]);
  });

  test("apple-icon.png is a 180 pixel square with no transparency, since iOS paints transparent corners black", () => {
    const image = pngSize(readFileSync(join(APP, "apple-icon.png")));
    expect([image.width, image.height]).toEqual([180, 180]);
    // PNG colour type 2 is RGB with no alpha channel; 6 would be RGBA.
    expect(image.colourType).toBe(2);
  });
});
