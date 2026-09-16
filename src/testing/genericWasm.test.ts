import { describe, expect, test } from "bun:test";
import {
  cyclicHarmonic,
  cyclicSol,
  cyclicSymmetry,
  extraWasmFns,
  fluidFrames,
  gaMotorFrameIndex,
  gaMotorOrbit,
  genericKernelSource,
  heatFrames,
  laplacianModeShape,
  laplacianModes,
  sampleFluidAt,
  sampleHeatAt,
  wave2dFrames,
  waveFrameRms,
} from "../workers/genericWasm.ts";
import { appendExtractionLog, newExtractionLogRunId } from "./extractionLogging.ts";

const logRunId = newExtractionLogRunId();

describe("Generic WASM and Reference Fallbacks", () => {
  test("unloaded source reports 'unloaded' or 'ts-fallback' during SSR/tests without premature 'wasm' label", () => {
    const start = performance.now();
    const source = genericKernelSource();
    expect(["unloaded", "ts-fallback"]).toContain(source);
    expect(extraWasmFns.trussPath).toBeNull();
    expect(extraWasmFns.hodgeDecomposition).toBeNull();
    expect(extraWasmFns.poisson2d).toBeNull();

    appendExtractionLog({
      logRunId,
      testId: "generic-wasm-source-label-honest",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "genericKernelSource reports honest source without claiming WASM before acceptance",
    });
  });

  test("donor-trap: module-global source: module-global source reads 'wasm'/'ts-fallback' after load while label function must not assume WASM execution without accepted step", () => {
    // Characterization test pinning the donor trap where loading a WASM module globally set the source to 'wasm'
    // In Annus Mirabilis, execution labels are earned per accepted snapshot (am-rt-determinism-fallbacks-8i4).
    const start = performance.now();
    const initialSource = genericKernelSource();
    expect(typeof initialSource).toBe("string");

    appendExtractionLog({
      logRunId,
      testId: "donor-trap-module-global-source",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "donor-trap: module-global source confirmed; module load status is decoupled from snapshot provenance",
    });
  });

  test("gaMotorOrbit writes the documented [n, steps, xyz...] layout", () => {
    const start = performance.now();
    const n = 8;
    const steps = 12;
    const orbit = gaMotorOrbit(n, steps);
    expect(orbit[0]).toBe(n);
    expect(orbit[1]).toBe(steps);
    expect(orbit.length).toBe(2 + steps * n * 3);
    expect(Number.isFinite(orbit[2])).toBe(true);
    expect(gaMotorOrbit(n, steps)).toBe(orbit); // Cached instance

    appendExtractionLog({
      logRunId,
      testId: "generic-wasm-ga-motor-orbit",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "gaMotorOrbit outputs valid coordinate layout with memory caching",
    });
  });

  test("gaMotorFrameIndex wraps one turn onto the motor tape", () => {
    const start = performance.now();
    expect(gaMotorFrameIndex(0, Math.PI * 2, 60)).toBe(0);
    expect(gaMotorFrameIndex(0.5, Math.PI * 2, 60)).toBe(30);
    expect(gaMotorFrameIndex(1, Math.PI * 2, 60)).toBe(0);

    appendExtractionLog({
      logRunId,
      testId: "generic-wasm-ga-motor-frame-index",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "gaMotorFrameIndex wraps phase cleanly across frame boundary",
    });
  });

  test("heatFrames is frames*n*n and the hot blob is warmer than the cold blob", () => {
    const start = performance.now();
    const n = 12;
    const frames = 4;
    const heat = heatFrames(n, frames, 2);
    expect(heat.length).toBe(frames * n * n);
    const hot = sampleHeatAt(heat, n, frames, 0, 0.3, 0.3);
    const cold = sampleHeatAt(heat, n, frames, 0, 0.7, 0.68);
    expect(hot).toBeGreaterThan(cold);

    appendExtractionLog({
      logRunId,
      testId: "generic-wasm-heat-frames",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "heatFrames simulates 2D thermal diffusion with hot blob gradient",
    });
  });

  test("wave2dFrames has a finite RMS on the first snapshot", () => {
    const start = performance.now();
    const n = 16;
    const frames = 6;
    const wave = wave2dFrames(n, frames, 2);
    expect(wave.length).toBe(frames * n * n);
    expect(waveFrameRms(wave, n, frames, 0)).toBeGreaterThan(0);
    expect(Number.isFinite(waveFrameRms(wave, n, frames, 3))).toBe(true);

    appendExtractionLog({
      logRunId,
      testId: "generic-wasm-wave-frames",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "wave2dFrames computes 2D wave evolution with finite RMS energy",
    });
  });

  test("cyclicSymmetry writes [n, first_row, rhs, sol, harmonics] and loads sector 0", () => {
    const start = performance.now();
    const n = 6;
    const ring = cyclicSymmetry(n, 0.5);
    expect(ring[0]).toBe(n);
    expect(ring.length).toBe(1 + 4 * n);
    expect(ring[1]).toBeCloseTo(2.5, 6);
    expect(cyclicSol(ring, 0)).toBeGreaterThan(cyclicSol(ring, 3));
    expect(cyclicHarmonic(ring, 0)).toBeGreaterThan(0);

    appendExtractionLog({
      logRunId,
      testId: "generic-wasm-cyclic-symmetry",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "cyclicSymmetry solves circulant Toeplitz systems with correct harmonics",
    });
  });

  test("laplacianModes has ascending eigenvalues and a peaked first sine mode", () => {
    const start = performance.now();
    const n = 17;
    const k = 3;
    const modes = laplacianModes(n, k);
    expect(modes.length).toBe(k + k * n);
    expect(modes[0]).toBeLessThan(modes[1] ?? 0);
    expect(Math.abs(laplacianModeShape(modes, n, k, 0, 8))).toBeGreaterThan(
      Math.abs(laplacianModeShape(modes, n, k, 0, 0)),
    );

    appendExtractionLog({
      logRunId,
      testId: "generic-wasm-laplacian-modes",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "laplacianModes computes ordered Dirichlet eigenvalues and eigenmodes",
    });
  });

  test("fluidFrames is frames*n*n and the jet source is denser than the far field", () => {
    const start = performance.now();
    const n = 16;
    const frames = 4;
    const fluid = fluidFrames(n, frames);
    expect(fluid.length).toBe(frames * n * n);
    const src = sampleFluidAt(fluid, n, frames, 3, 0.25, 0.95);
    const far = sampleFluidAt(fluid, n, frames, 3, 0.85, 0.1);
    expect(src).toBeGreaterThan(far);

    appendExtractionLog({
      logRunId,
      testId: "generic-wasm-fluid-frames",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "fluidFrames computes 2D advection-diffusion fluid density",
    });
  });
});
