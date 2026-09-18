import { describe, expect, test } from "bun:test";
import { createPhiloxStream } from "./philox.ts";
import vectors from "./philox.vectors.json";

describe("Philox nextBelow Rejection Sampling Across 315 Cross-Check Positions", () => {
  test("every nextBelow value and consumed draw count match bitwise", () => {
    for (const pos of vectors.positions) {
      for (const entry of pos.below) {
        const startIdx = BigInt(pos.index);
        const stream = createPhiloxStream(
          { seed: pos.seed, kernel: pos.streamKernel, tile: pos.tile },
          startIdx,
        );

        const val = stream.nextBelow(BigInt(entry.n));
        const drawsConsumed = Number(stream.index - startIdx);

        expect(val.toString()).toBe(entry.value);
        expect(drawsConsumed).toBe(entry.drawsConsumed);
      }
    }
  });

  test("nextBelow(0) throws invalid-parameter", () => {
    const stream = createPhiloxStream({ seed: "1", kernel: 0, tile: 0 });
    expect(() => stream.nextBelow(0)).toThrow();
    expect(() => stream.nextBelow(0n)).toThrow();
  });
});
