import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyGlueReturnsCopy } from "../experiments/memory/wasmViews.ts";
import { PINNED_ARTIFACT } from "../workers/wasm/pinnedArtifact.ts";
import { pinnedGlue as glue } from "../workers/wasm/pinnedGlue.ts";

describe("WASM glue return copy verification", () => {
  test("verifyGlueReturnsCopy correctly distinguishes independent copies from raw views", () => {
    const memory = new WebAssembly.Memory({ initial: 1 });

    // Raw view into linear memory
    const rawView = new Float64Array(memory.buffer, 0, 10);
    expect(verifyGlueReturnsCopy(rawView, memory)).toBe(false);

    // Freshly allocated copy
    const independentCopy = new Float64Array(10);
    expect(verifyGlueReturnsCopy(independentCopy, memory)).toBe(true);
  });

  test("pinned diffusion glue returns Float64Array copies not backed by module memory", () => {
    // The compiled artifact (am-frankensim-repin-and-bind-jvhg): initialize the glue on the pinned
    // bytes, then call brownian_frames. The result's values must be a copy, checked against the
    // module's own linear memory (the placeholder's version of this test could only use a dummy).
    const bytes = readFileSync(
      resolve(
        "public/wasm",
        PINNED_ARTIFACT.bundleId,
        PINNED_ARTIFACT.hashPrefix,
        PINNED_ARTIFACT.wasmFile,
      ),
    );
    const memory = (glue.initSync({ module: bytes }) as { memory: WebAssembly.Memory }).memory;
    expect(memory).toBeInstanceOf(WebAssembly.Memory);
    const result = glue.brownian_frames(
      5, // 5 particles
      10, // 10 steps
      0, // coin kernel
      137035999n, // seed, a u64 BigInt
      1.0, // diffusion
      0.01, // dt
    );
    const values = result.values;
    result.free();

    expect(values).toBeInstanceOf(Float64Array);
    expect(values.length).toBe(5 * 11);
    expect(verifyGlueReturnsCopy(values, memory)).toBe(true);
    // Buffer is a standard ArrayBuffer allocated for the copy
    expect(values.buffer).toBeInstanceOf(ArrayBuffer);
  });
});
