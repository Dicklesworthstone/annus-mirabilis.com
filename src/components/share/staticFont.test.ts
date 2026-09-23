import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultInstance, tableTags } from "./staticFont.ts";

const VARIATION = ["fvar", "gvar", "avar", "cvar", "HVAR", "MVAR", "VVAR", "STAT"];

function tables(font: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
  const out = new Map<string, Uint8Array>();
  tableTags(font).forEach((tag, i) => {
    const offset = view.getUint32(12 + i * 16 + 8);
    const length = view.getUint32(12 + i * 16 + 12);
    out.set(tag, font.subarray(offset, offset + length));
  });
  return out;
}

describe("defaultInstance", () => {
  for (const path of [
    "newsreader/Newsreader-Variable.ttf",
    "plus-jakarta-sans/PlusJakartaSans-Variable.ttf",
  ]) {
    test(`${path}: the variation tables go, and every other table is kept byte for byte`, () => {
      const original = new Uint8Array(readFileSync(join(process.cwd(), "public/fonts", path)));
      const before = tables(original);
      // Non-vacuous: the file really is variable, so there is something to remove.
      expect([...before.keys()].filter((tag) => VARIATION.includes(tag))).toContain("fvar");
      const after = tables(defaultInstance(original));
      expect([...after.keys()].filter((tag) => VARIATION.includes(tag))).toEqual([]);
      const kept = [...before.keys()].filter((tag) => !VARIATION.includes(tag));
      expect([...after.keys()]).toEqual(kept);
      const empty = new Uint8Array();
      for (const tag of kept) {
        expect(Buffer.compare(after.get(tag) ?? empty, before.get(tag) ?? empty), tag).toBe(0);
      }
    });
  }
});
