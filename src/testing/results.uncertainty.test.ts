import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeResult, encodeResult, parseResult } from "../experiments/results/codec.ts";
import type { ScientificResult, Uncertainty } from "../experiments/results/types.ts";

const baseValue: ScientificResult = {
  quantityId: "diffusion-constant",
  unit: "m2/s",
  semanticKind: "transport-coefficient",
  ownerId: "diffusion.stokesEinstein",
  status: "value",
  value: 5.2e-13,
};

describe("results.uncertainty: Validation of Uncertainty Kinds (Requirement 6)", () => {
  it("statistical-interval validates and round-trips correctly", () => {
    const uncertainty: Uncertainty = {
      kind: "statistical-interval",
      lower: 5.0e-13,
      upper: 5.4e-13,
      coverage: 0.95,
      sampleSize: 1000,
      method: "bootstrap-studentized",
    };
    const res = { ...baseValue, uncertainty };
    const decoded = decodeResult(res);
    assert.deepEqual(decoded, res);
    assert.deepEqual(parseResult(encodeResult(decoded)), res);

    // Rejects coverage >= 1 or <= 0
    assert.throws(() =>
      decodeResult({ ...baseValue, uncertainty: { ...uncertainty, coverage: 1 } }),
    );
    assert.throws(() =>
      decodeResult({ ...baseValue, uncertainty: { ...uncertainty, coverage: 0 } }),
    );
    // Rejects sampleSize <= 0 or non-integer
    assert.throws(() =>
      decodeResult({ ...baseValue, uncertainty: { ...uncertainty, sampleSize: 0 } }),
    );
    assert.throws(() =>
      decodeResult({ ...baseValue, uncertainty: { ...uncertainty, sampleSize: 10.5 } }),
    );
    // Rejects reversed bounds
    assert.throws(() =>
      decodeResult({ ...baseValue, uncertainty: { ...uncertainty, lower: 6e-13, upper: 5e-13 } }),
    );
  });

  it("enclosure validates interval-arithmetic bounds", () => {
    const uncertainty: Uncertainty = {
      kind: "enclosure",
      lower: 5.15e-13,
      upper: 5.25e-13,
      method: "interval-arithmetic-outward-rounding",
    };
    const res = { ...baseValue, uncertainty };
    assert.deepEqual(decodeResult(res), res);

    // Rejects reversed interval
    assert.throws(() =>
      decodeResult({ ...baseValue, uncertainty: { ...uncertainty, lower: 6e-13, upper: 5e-13 } }),
    );
  });

  it("numerical-error-estimate validates guarantee and magnitude", () => {
    const uncertainty: Uncertainty = {
      kind: "numerical-error-estimate",
      magnitude: 1e-15,
      method: "richardson-extrapolation",
      guarantee: "estimate",
    };
    const res = { ...baseValue, uncertainty };
    assert.deepEqual(decodeResult(res), res);

    // Rejects negative magnitude
    assert.throws(() =>
      decodeResult({ ...baseValue, uncertainty: { ...uncertainty, magnitude: -1e-15 } }),
    );
    // Rejects invalid guarantee
    assert.throws(() =>
      decodeResult({
        ...baseValue,
        uncertainty: {
          ...uncertainty,
          guarantee: "unknown" as unknown as "estimate",
        },
      }),
    );
  });

  it("input-precision validates significant figures and source", () => {
    const uncertainty: Uncertainty = {
      kind: "input-precision",
      significantFigures: 5,
      source: "table-1-viscosity-water-1905",
    };
    const res = { ...baseValue, uncertainty };
    assert.deepEqual(decodeResult(res), res);

    // Rejects non-positive significant figures
    assert.throws(() =>
      decodeResult({ ...baseValue, uncertainty: { ...uncertainty, significantFigures: 0 } }),
    );
    assert.throws(() =>
      decodeResult({ ...baseValue, uncertainty: { ...uncertainty, source: "" } }),
    );
  });

  it("measurement-uncertainty validates dataset reference and type", () => {
    const uncertainty: Uncertainty = {
      kind: "measurement-uncertainty",
      magnitude: 0.05e-13,
      datasetId: "perrin-1908-gamboge-series-1",
      uncertaintyType: "standard-error-of-mean",
    };
    const res = { ...baseValue, uncertainty };
    assert.deepEqual(decodeResult(res), res);

    // Rejects negative magnitude
    assert.throws(() =>
      decodeResult({ ...baseValue, uncertainty: { ...uncertainty, magnitude: -1 } }),
    );
    assert.throws(() =>
      decodeResult({ ...baseValue, uncertainty: { ...uncertainty, datasetId: "" } }),
    );
  });

  it("rejects unknown uncertainty kind", () => {
    assert.throws(() =>
      decodeResult({
        ...baseValue,
        uncertainty: {
          kind: "custom-uncertainty",
          value: 123,
        } as unknown as Uncertainty,
      }),
    );
  });
});
