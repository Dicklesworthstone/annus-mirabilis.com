import assert from "node:assert/strict";
import test from "node:test";
import { BM07_SEMANTIC_KIND_TEXT } from "../experiments/bm07/definition.ts";
import {
  EINSTEIN_PRINTED_MOLECULAR_NUMBER,
  invertEinsteinPrintedMolecularNumber,
  perrin1909DatasetStatus,
} from "../experiments/bm07/historical.ts";
import { getConstantSet, withHistoricalGuard } from "../physics/reference/constants.ts";
import {
  estimateIncrements,
  estimateSummaryStatistics,
  inverseBias,
  invertSensitivities,
  invertToMolecularNumber,
  SEMANTIC_KIND_VISITOR_TEXT,
  summaryChiSquareInterval,
} from "../physics/reference/inference.ts";
import { createPhiloxStream } from "../physics/reference/philox.ts";

const ok = (r) => {
  assert.equal(r.kind, "accepted", JSON.stringify(r));
  return r.data;
};

test("adversarial: an unbiased estimate does not stay unbiased after inversion", () => {
  const factor = ok(inverseBias(100)).meanFactor;
  assert.equal(factor, 100 / 98);
  assert.ok(Math.abs(factor - 1) > 1e-12, "the inverted mean is not 1");
  assert.equal(ok(inverseBias(10)).meanFactor, 1.25);
  assert.equal(ok(inverseBias(40)).meanFactor, 40 / 38);
  assert.equal(inverseBias(2).status, "not-applicable");
});

test("seeded chi-square inversion mean sits in the 3.3-se band at q=100", () => {
  const q = 100,
    n = 4000,
    stream = createPhiloxStream({ seed: "19050716", kernel: 1, tile: 0 });
  let sum = 0;
  for (let i = 0; i < n; i++) {
    let chi = 0;
    for (let k = 0; k < q; k++) {
      const z = stream.nextNormal();
      chi += z * z;
    }
    sum += q / chi;
  }
  const mean = sum / n;
  const halfWidth = (3.3 * 0.147283) / Math.sqrt(n);
  assert.ok(
    mean >= 1.020408 - halfWidth && mean <= 1.020408 + halfWidth,
    `mean ${mean} outside ${1.020408 - halfWidth}..${1.020408 + halfWidth}`,
  );
});

test("Einstein printed N = 6.17e23 is recovered without modern k_B or N_A", () => {
  const r = ok(invertEinsteinPrintedMolecularNumber());
  assert.equal(r.semanticKind, "independent-estimate");
  assert.equal(r.consistencyRatio, null);
  assert.equal(r.estimatedBoltzmannConstant, null);
  assert.ok(Math.abs(r.estimate / EINSTEIN_PRINTED_MOLECULAR_NUMBER - 1) < 1e-12);
  const modern = getConstantSet("modern-si-2019");
  assert.throws(
    () =>
      withHistoricalGuard(() =>
        invertToMolecularNumber(
          {
            T: 293.15,
            eta: 0.001,
            a: 0.5e-6,
            radiusProvenance: "independently-declared",
            dHat: 0.42944e-12,
            interval: {
              lower: 0.331457e-12,
              upper: 0.578589e-12,
              coverage: 0.95,
              q: 100,
              uncertaintyKind: "statistical-interval",
              coverageKind: "exact",
              estimatorId: "independent-increment-known-zero-drift",
            },
            synthetic: false,
          },
          modern,
        ),
      ),
    /modern exact avogadroConstant/,
  );
});

test("summary path equals the increment path bitwise when the count is known, and refuses a missing count", () => {
  const dt = 1,
    x = new Float64Array([1, -1, 2, -2]);
  const inc = ok(estimateIncrements(x, dt, 1, "independent-increment-known-zero-drift"));
  const meanSquare = inc.sumSquares / inc.M;
  const summary = ok(
    estimateSummaryStatistics({
      meanSquareDisplacement: meanSquare,
      observationInterval: dt,
      independentCoordinateCount: inc.q,
    }),
  );
  assert.equal(summary.dHat, inc.dHat);
  const missing = ok(
    estimateSummaryStatistics({
      meanSquareDisplacement: meanSquare,
      observationInterval: dt,
      independentCoordinateCount: null,
    }),
  );
  assert.equal(missing.dHat, inc.dHat);
  assert.equal(summaryChiSquareInterval(missing, 0.05).status, "not-applicable");
});

test("logarithmic sensitivities of N match -1, -1, +1, -2", () => {
  const s = ok(
    invertSensitivities({
      dHat: 0.42944e-12,
      T: 293.15,
      eta: 0.001,
      a: 0.5e-6,
      calibrationScale: 1,
    }),
  );
  assert.ok(Math.abs(s.particleRadius - -1) < 1e-9);
  assert.ok(Math.abs(s.viscosity - -1) < 1e-9);
  assert.ok(Math.abs(s.temperature - 1) < 1e-9);
  assert.ok(Math.abs(s.spatialCalibration - -2) < 1e-9);
});

test("visitor text never calls a consistency check a count of molecules", () => {
  assert.deepEqual(BM07_SEMANTIC_KIND_TEXT, SEMANTIC_KIND_VISITOR_TEXT);
  assert.match(SEMANTIC_KIND_VISITOR_TEXT["consistency-check"], /not an independent count/);
  assert.equal(
    SEMANTIC_KIND_VISITOR_TEXT["consistency-check"].includes("a count of molecules"),
    false,
  );
  assert.match(
    SEMANTIC_KIND_VISITOR_TEXT["synthetic-recovery"],
    /not evidence that molecules exist/,
  );
});

test("Perrin 1909 dataset status is underdetermined until the HistoricalDataset is admitted", () => {
  const r = perrin1909DatasetStatus();
  assert.equal(r.status, "underdetermined");
  assert.match(r.reason, /am-data-perrin-1909-p7ku/);
  assert.match(r.reason, /have been invented/);
});
