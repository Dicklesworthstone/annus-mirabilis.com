import { describe, expect, test } from "bun:test";
import { at } from "./philox.ts";
import vectors from "./philox.vectors.json";

describe("Philox 4x32-10 Raw Blocks Across 315 Cross-Check Positions", () => {
  test("all 315 positions match raw block words bitwise", () => {
    expect(vectors.positions.length).toBe(315);

    for (const pos of vectors.positions) {
      const key = {
        seed: pos.seed,
        kernel: pos.streamKernel,
        tile: pos.tile,
      };
      const actualBlock = at(key, pos.index);
      const expectedWords = pos.block.map((h: string) => Number.parseInt(h, 16));

      expect(Array.from(actualBlock)).toEqual(expectedWords);
    }
  });
});
