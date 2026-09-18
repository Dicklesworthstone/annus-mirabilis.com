import { describe, expect, test } from "bun:test";
import { logPhilox } from "./philox.log.ts";
import { createPhiloxStream } from "./philox.ts";
import vectors from "./philox.vectors.json";

function hexBitsToF64(hex: string): number {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigUint64(0, BigInt(`0x${hex}`), true);
  return new Float64Array(buf)[0] ?? 0;
}

describe("Philox Box-Muller Normals Across 315 Positions and Sequences", () => {
  test("every nextNormal matches within tolerance |Δ| <= 8 * ε * max(1, |z|) and consumes 2 draws", () => {
    let maxObservedDeviation = 0;
    const eps = 2 ** -52;

    for (const pos of vectors.positions) {
      const startIdx = BigInt(pos.index);
      const stream = createPhiloxStream(
        { seed: pos.seed, kernel: pos.streamKernel, tile: pos.tile },
        startIdx,
      );

      const actualZ = stream.nextNormal();
      const expectedZ = hexBitsToF64(pos.normalBits);

      // Verify draw consumption: exactly two draws consumed
      expect(Number(BigInt.asUintN(64, stream.index - startIdx))).toBe(2);

      const delta = Math.abs(actualZ - expectedZ);
      if (delta > maxObservedDeviation) {
        maxObservedDeviation = delta;
      }

      const tol = 8 * eps * Math.max(1, Math.abs(expectedZ));
      expect(delta).toBeLessThanOrEqual(tol);
    }

    // Record observed max deviation with runtime engine info
    const bunVersion = (globalThis as Record<string, any>).Bun?.version;
    const engineInfo = bunVersion
      ? `Bun ${bunVersion} (JavaScriptCore)`
      : `Node ${process.version} (V8)`;
    console.log(
      `[philox.normals.test] Engine: ${engineInfo}, Max Observed Deviation: ${maxObservedDeviation.toExponential(4)}, Bound: ${(8 * eps).toExponential(4)}`,
    );

    logPhilox({
      testId: "box-muller-normals-315-positions",
      seed: "0",
      streamVersion: "philox-box-muller-host-v1",
      expected: "FrankenSim det Box-Muller normals",
      actual: "Host Math Box-Muller normals",
      comparisonKind: "tolerance",
      tolerance: 8 * eps,
      outcome: "passed",
      durationMs: 0,
      message: `315 cross-check normal positions within |Δ| <= 8*eps*max(1,|z|)`,
      extra: {
        field: "normalBits",
        maxDeviation: maxObservedDeviation,
        engine: engineInfo,
        vectorFileDigest: vectors.provenance.sha256,
      },
    });
  });

  test("draw-based indexing: normal sequence starting at draw 6 equals suffix from draw 0", () => {
    expect(vectors.normalSequences.length).toBe(2);

    const from0 = vectors.normalSequences.find((s) => s.startIndex === "0");
    const from6 = vectors.normalSequences.find((s) => s.startIndex === "6");
    expect(from0).toBeDefined();
    expect(from6).toBeDefined();
    if (!from0 || !from6) return;

    const s0 = createPhiloxStream({ seed: "1", kernel: 0, tile: 0 }, "0");
    const s6 = createPhiloxStream({ seed: "1", kernel: 0, tile: 0 }, "6");

    const vals0 = Array.from({ length: 8 }, () => s0.nextNormal());
    const vals6 = Array.from({ length: 8 }, () => s6.nextNormal());

    const eps = 2 ** -52;
    for (let i = 0; i < 8; i++) {
      const exp0 = hexBitsToF64(from0.normalBits[i] ?? "0");
      const tol0 = 8 * eps * Math.max(1, Math.abs(exp0));
      expect(Math.abs((vals0[i] ?? 0) - exp0)).toBeLessThanOrEqual(tol0);

      const exp6 = hexBitsToF64(from6.normalBits[i] ?? "0");
      const tol6 = 8 * eps * Math.max(1, Math.abs(exp6));
      expect(Math.abs((vals6[i] ?? 0) - exp6)).toBeLessThanOrEqual(tol6);
    }

    // 6 draws = 3 normals, so vals6[0..5] must equal vals0[3..8] within floating-point identity
    for (let i = 0; i < 5; i++) {
      expect(vals6[i]).toBe(vals0[i + 3]);
    }
  });
});
