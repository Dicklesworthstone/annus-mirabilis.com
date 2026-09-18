import { describe, expect, test } from "bun:test";
import { createPhiloxStream } from "./philox.ts";
import vectors from "./philox.vectors.json";

function f64ToHexBits(val: number): string {
  const buf = new ArrayBuffer(8);
  new Float64Array(buf)[0] = val;
  // Rust to_bits() returns u64 integer pattern
  return new DataView(buf).getBigUint64(0, true).toString(16).padStart(16, "0");
}

describe("Philox Uniform Draws Across 315 Cross-Check Positions", () => {
  test("every nextU64 matches bitwise across all 315 positions", () => {
    for (const pos of vectors.positions) {
      const stream = createPhiloxStream(
        { seed: pos.seed, kernel: pos.streamKernel, tile: pos.tile },
        pos.index,
      );
      const actualU64 = stream.nextU64();
      expect(actualU64.toString()).toBe(pos.u64);
    }
  });

  test("every nextF64 matches IEEE-754 bit pattern exactly (53-bit ladder)", () => {
    for (const pos of vectors.positions) {
      const stream = createPhiloxStream(
        { seed: pos.seed, kernel: pos.streamKernel, tile: pos.tile },
        pos.index,
      );
      const actualF64 = stream.nextF64();
      const actualBits = f64ToHexBits(actualF64);
      expect(actualBits).toBe(pos.f64Bits);
    }
  });

  test("boundary indices and boundary seeds match bitwise", () => {
    const boundaryIndices = ["4294967295", "4294967296", "18446744073709551614"];
    const boundarySeeds = ["0", "1", "4294967295", "4294967296", "18446744073709551615"];

    for (const pos of vectors.positions) {
      if (boundaryIndices.includes(pos.index) && boundarySeeds.includes(pos.seed)) {
        const stream1 = createPhiloxStream(
          { seed: pos.seed, kernel: pos.streamKernel, tile: pos.tile },
          pos.index,
        );
        expect(stream1.nextU64().toString()).toBe(pos.u64);

        const stream2 = createPhiloxStream(
          { seed: pos.seed, kernel: pos.streamKernel, tile: pos.tile },
          pos.index,
        );
        expect(f64ToHexBits(stream2.nextF64())).toBe(pos.f64Bits);
      }
    }
  });
});
