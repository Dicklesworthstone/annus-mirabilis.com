import { describe, expect, test } from "bun:test";
import { createPhiloxStream, U64_MAX } from "./philox.ts";

describe("Philox 64-Bit Draw Index Natural Wrapping", () => {
  test("index increments wrap at 2^64 exactly like upstream wrapping_add", () => {
    const key = { seed: "12345", kernel: 1, tile: 1 };
    const nearEnd = U64_MAX - 1n; // 18446744073709551614

    const stream = createPhiloxStream(key, nearEnd);
    expect(stream.index).toBe(nearEnd);

    // Draw at 2^64 - 2 advances to 2^64 - 1
    stream.nextU64();
    expect(stream.index).toBe(U64_MAX);

    // Draw at 2^64 - 1 wraps to 0
    stream.nextU64();
    expect(stream.index).toBe(0n);

    // Draw at 0 advances to 1
    stream.nextU64();
    expect(stream.index).toBe(1n);
  });

  test("nextNormal wraps across 2^64 boundary seamlessly", () => {
    const key = { seed: "999", kernel: 2, tile: 4 };
    const nearEnd = U64_MAX - 1n;

    const stream = createPhiloxStream(key, nearEnd);
    // Consumes 2 draws: nearEnd and U64_MAX, ending at 0n
    const z = stream.nextNormal();
    expect(Number.isFinite(z)).toBe(true);
    expect(stream.index).toBe(0n);
  });

  test("fillF64 wraps across 2^64 boundary seamlessly", () => {
    const key = { seed: "777", kernel: 0, tile: 0 };
    const nearEnd = U64_MAX - 3n;

    const stream = createPhiloxStream(key, nearEnd);
    const out = new Float64Array(8);
    stream.fillF64(out);

    // 4 draws to reach 0n, plus 4 more draws -> ends at 4n
    expect(stream.index).toBe(4n);
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
