import { describe, expect, test } from "bun:test";
import {
  copyOutF64,
  copyOutVecF64,
  TrackedWasmView,
  WasmMemoryDetachedBufferError,
  WasmMemoryStaleViewError,
  WasmMemoryTracker,
} from "../experiments/memory/wasmViews.ts";

describe("WASM memory growth and generation safety", () => {
  test("generation increments and retained view throws on access after memory.grow()", () => {
    // 1 page = 64 KiB
    const memory = new WebAssembly.Memory({ initial: 1 });
    const tracker = new WasmMemoryTracker(memory);

    expect(tracker.currentGeneration).toBe(1);

    // Populate initial memory
    const initialF64 = new Float64Array(memory.buffer, 0, 4);
    initialF64[0] = 42.5;
    initialF64[1] = 137.036;
    initialF64[2] = 2.71828;
    initialF64[3] = 3.14159;

    // Create tracked view
    const trackedView = tracker.createFloat64View(0, 4);
    expect(trackedView.isValid).toBe(true);
    expect(trackedView.at(0)).toBe(42.5);
    expect(trackedView.at(1)).toBe(137.036);

    // Grow memory by 1 page (invalidates old memory.buffer)
    memory.grow(1);

    // Tracker detects generation increase
    expect(tracker.currentGeneration).toBe(2);
    expect(trackedView.isValid).toBe(false);

    // Retained view access throws WasmMemoryStaleViewError
    expect(() => trackedView.at(0)).toThrow(WasmMemoryStaleViewError);
    expect(() => trackedView.set(0, 99.9)).toThrow(WasmMemoryStaleViewError);
    expect(() => trackedView.view).toThrow(WasmMemoryStaleViewError);
    expect(() => trackedView.copy()).toThrow(WasmMemoryStaleViewError);

    try {
      trackedView.at(0);
    } catch (err) {
      expect(err instanceof WasmMemoryStaleViewError).toBe(true);
      const staleErr = err as WasmMemoryStaleViewError;
      expect(staleErr.viewGeneration).toBe(1);
      expect(staleErr.currentGeneration).toBe(2);
    }

    // Creating a fresh view at current generation succeeds
    const refreshedView = tracker.createFloat64View(0, 4);
    expect(refreshedView.isValid).toBe(true);
    expect(refreshedView.generation).toBe(2);
    expect(refreshedView.at(0)).toBe(42.5);
  });

  test("copyOutF64 produces independent copies unaffected by subsequent memory growth", () => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    const u8 = new Uint8Array(memory.buffer);
    const f64 = new Float64Array(memory.buffer, 0, 3);
    f64[0] = 10.0;
    f64[1] = 20.0;
    f64[2] = 30.0;

    // Copy out
    const copy1 = copyOutF64(memory, 0, 3);
    const copy2 = copyOutVecF64(memory, 0, 3);

    expect(copy1.buffer).not.toBe(memory.buffer);
    expect(copy2.buffer).not.toBe(memory.buffer);
    expect(Array.from(copy1)).toEqual([10.0, 20.0, 30.0]);
    expect(Array.from(copy2)).toEqual([10.0, 20.0, 30.0]);

    // Grow memory
    memory.grow(1);

    // Existing copies are completely unaffected
    expect(copy1.byteLength).toBe(3 * Float64Array.BYTES_PER_ELEMENT);
    expect(Array.from(copy1)).toEqual([10.0, 20.0, 30.0]);
    expect(Array.from(copy2)).toEqual([10.0, 20.0, 30.0]);
  });
});
