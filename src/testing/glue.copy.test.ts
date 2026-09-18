import { describe, expect, test } from "bun:test";
import { verifyGlueReturnsCopy } from "../experiments/memory/wasmViews.ts";
import * as glue from "../../public/wasm/fs-annus-diffusion/105d7ffc15414de5/fs_annus_diffusion.js";

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
    // Call brownian_frames from pinned JS/WASM glue
    const dummyMemory = new WebAssembly.Memory({ initial: 1 });
    const brownianFrames = (glue as Record<string, Function>).brownian_frames;
    if (typeof brownianFrames !== "function") {
      throw new Error("Missing brownian_frames export in pinned glue");
    }
    const result = brownianFrames(
      5, // 5 particles
      10, // 10 steps
      0, // coin kernel
      "137035999", // seed
      1.0, // diffusion
      0.01, // dt
    );

    expect(result).toBeInstanceOf(Float64Array);
    expect(result.length).toBe(5 * 11);
    expect(verifyGlueReturnsCopy(result, dummyMemory)).toBe(true);
    // Buffer is a standard ArrayBuffer allocated for the copy
    expect(result.buffer).toBeInstanceOf(ArrayBuffer);
  });
});
