import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decodeOutcome,
  decodeRefusal,
  decodeResult,
  encodeResult,
  parseResult,
} from "../experiments/results/codec.ts";
import {
  budgetExhaustedOutcomeExample,
  ftcsUnstableRefusalExample,
  invalidSeedRefusalExample,
  lq02DivergentExample,
  lq02FiniteCutoffExample,
  missingArtifactOutcomeExample,
  outsideWienDomainRefusalExample,
  planStatusExamples,
  superluminalObserverRefusalExample,
} from "../experiments/results/planExamples.ts";

describe("results.examples: Validation of Plan Fixtures and LQ-02 Divergent/Cutoff Payloads", () => {
  it("all plan status examples round-trip through JSON codec", () => {
    for (const example of planStatusExamples) {
      const encoded = encodeResult(example);
      const parsed = parseResult(encoded);
      assert.deepEqual(parsed, example, `Round-trip mismatch for ${example.status}`);
    }
  });

  it("LQ-02 divergent example satisfies schema and expresses classical infinite spectral total", () => {
    const decoded = decodeResult(lq02DivergentExample);
    assert.equal(decoded.status, "divergent");
    assert.equal(decoded.quantityId, "spectral-energy-density-total");
    assert.equal(decoded.divergenceKind, "integral");
    assert.equal(decoded.variable, "frequency");
    assert.deepEqual(decoded.range, { lower: 0, upper: "unbounded" });
    assert.equal(decoded.finiteUnder.parameterId, "frequencyCutoff");
    assert.equal(decoded.finiteUnder.value, 1e15);

    // Assert that divergent payload CANNOT carry a numeric value
    assert.throws(() => {
      decodeResult({ ...lq02DivergentExample, value: 0 });
    });
  });

  it("LQ-02 finite cutoff counterpart evaluates to 21.46396 J/m3 at 10^15 Hz", () => {
    const decoded = decodeResult(lq02FiniteCutoffExample);
    assert.equal(decoded.status, "value");
    assert.equal(decoded.value, 21.46396);
    assert.equal(decoded.quantityId, "spectral-energy-density-total");
    assert.ok(decoded.uncertainty);
    assert.equal(decoded.uncertainty?.kind, "numerical-error-estimate");
  });

  it("all refusal examples validate against decodeRefusal", () => {
    const refusals = [
      ftcsUnstableRefusalExample,
      superluminalObserverRefusalExample,
      outsideWienDomainRefusalExample,
      invalidSeedRefusalExample,
    ];

    for (const refusal of refusals) {
      const decoded = decodeRefusal(refusal);
      assert.deepEqual(decoded, refusal);
    }
  });

  it("all execution outcome examples validate against decodeOutcome", () => {
    const outcomes = [budgetExhaustedOutcomeExample, missingArtifactOutcomeExample];

    for (const outcome of outcomes) {
      const decoded = decodeOutcome(outcome);
      assert.deepEqual(decoded, outcome);
    }
  });
});
