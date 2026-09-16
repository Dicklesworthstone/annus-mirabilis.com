import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { StatusEnumLeakRule } from "./rules.ts";
import { loadVoiceRules } from "./rules.ts";

const REQUIRED_STATUSES = ["analytic-limit", "underdetermined", "not-applicable", "outside-domain"];

const REQUIRED_EXECUTION_OUTCOMES = [
  "transport-error",
  "protocol-mismatch",
  "malformed-response",
  "budget-exhausted",
  "missing-artifact",
  "artifact-mismatch",
  "environment-unsupported",
  "worker-crashed",
  "context-lost",
  "invariant-violation",
];

const REQUIRED_REFUSAL_CODES = [
  // am-rt-typed-results-mqb requirement 4
  "ftcs-unstable",
  "off-replay-grid",
  "superluminal-observer",
  "outside-wien-domain",
  "stokes-gas-medium",
  "invalid-seed",
  "nonfinite-input",
  "unsupported-kernel",
  "invalid-parameter",
  "stream-index-overflow",
  // am-rt-control-tapes-0gc requirement 7
  "tape-version-unsupported",
  "tape-model-mismatch",
  "tape-artifact-mismatch",
  "tape-constant-set-mismatch",
  "tape-stream-version-mismatch",
  "tape-allocation-mismatch",
  "tape-grid-mismatch",
  // am-ref-diffusion-lr3
  "drift-diffusion-unstable",
  "drift-cfl-exceeded",
  "quantile-not-converged",
  // am-ref-inference-2w9
  "circular-radius-from-displacement",
];

describe("status-enum-leak data lists", () => {
  const statusEnumLeak = loadVoiceRules().rules["status-enum-leak"] as StatusEnumLeakRule;

  it("contains all four statuses of requirement 3", () => {
    assert.deepEqual(new Set(statusEnumLeak.ids.statuses), new Set(REQUIRED_STATUSES));
  });

  it("contains all ten hyphenated execution outcomes of requirement 3", () => {
    assert.deepEqual(
      new Set(statusEnumLeak.ids.executionOutcomes),
      new Set(REQUIRED_EXECUTION_OUTCOMES),
    );
  });

  it("contains all twenty-one refusal codes of requirement 3 (ten initial, seven tape, three diffusion, one inference)", () => {
    assert.deepEqual(new Set(statusEnumLeak.ids.refusalCodes), new Set(REQUIRED_REFUSAL_CODES));
    assert.equal(statusEnumLeak.ids.refusalCodes.length, 21);
  });

  it("contains both donor labels", () => {
    assert.deepEqual(
      new Set(statusEnumLeak.ids.donorLabels),
      new Set(["HONEST_PLACEHOLDER", "TS_FALLBACK"]),
    );
  });

  it("the two single-word outcomes cancelled and superseded are absent from every list", () => {
    const allIds = [
      ...statusEnumLeak.ids.statuses,
      ...statusEnumLeak.ids.executionOutcomes,
      ...statusEnumLeak.ids.refusalCodes,
    ];
    assert.equal(allIds.includes("cancelled"), false);
    assert.equal(allIds.includes("superseded"), false);
  });

  it("the ordinary-word statuses value and symbolic are absent", () => {
    assert.equal(statusEnumLeak.ids.statuses.includes("value"), false);
    assert.equal(statusEnumLeak.ids.statuses.includes("symbolic"), false);
  });

  it("every hyphenated id contains a hyphen; the single-word id (underdetermined) does not", () => {
    const hyphenated = [
      ...statusEnumLeak.ids.executionOutcomes,
      ...statusEnumLeak.ids.refusalCodes,
    ];
    for (const id of hyphenated) assert.equal(id.includes("-"), true);
    assert.deepEqual(
      statusEnumLeak.ids.statuses.filter((id) => !id.includes("-")),
      ["underdetermined"],
    );
  });
});
