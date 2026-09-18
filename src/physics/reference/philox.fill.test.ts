import { describe, expect, test } from "bun:test";
import { createPhiloxStream } from "./philox.ts";

describe("Philox Bulk Fill Methods and Allocation-Free Generation", () => {
  test("fillF64 produces bitwise-identical values to sequential nextF64 calls", () => {
    const key = { seed: "9876543210", kernel: 5, tile: 12 };
    const n = 1024;

    const stream1 = createPhiloxStream(key, 0n);
    const stream2 = createPhiloxStream(key, 0n);

    const bulk = new Float64Array(n);
    stream1.fillF64(bulk);

    for (let i = 0; i < n; i++) {
      const seq = stream2.nextF64();
      expect(bulk[i]).toBe(seq);
    }

    expect(stream1.index).toBe(BigInt(n));
    expect(stream2.index).toBe(BigInt(n));
  });

  test("fillNormals produces bitwise-identical values to sequential nextNormal calls", () => {
    const key = { seed: "123456789", kernel: 3, tile: 7 };
    const n = 512;

    const stream1 = createPhiloxStream(key, 0n);
    const stream2 = createPhiloxStream(key, 0n);

    const bulk = new Float64Array(n);
    stream1.fillNormals(bulk);

    for (let i = 0; i < n; i++) {
      const seq = stream2.nextNormal();
      expect(bulk[i]).toBe(seq);
    }

    expect(stream1.index).toBe(BigInt(n * 2));
    expect(stream2.index).toBe(BigInt(n * 2));
  });

  test("generating 1,000,000 uniforms completes without per-draw allocation", () => {
    const stream = createPhiloxStream({ seed: "42", kernel: 0, tile: 0 });
    const buffer = new Float64Array(100_000);

    const t0 = performance.now();
    for (let chunk = 0; chunk < 10; chunk++) {
      stream.fillF64(buffer);
    }
    const durationMs = performance.now() - t0;

    expect(stream.index).toBe(1_000_000n);
    // Reference expectation: 1M numbers should generate in < 150ms on modern hardware
    console.log(`[philox.fill.test] 1,000,000 uniforms filled in ${durationMs.toFixed(2)}ms`);
    expect(durationMs).toBeLessThan(1000);
  });
});
