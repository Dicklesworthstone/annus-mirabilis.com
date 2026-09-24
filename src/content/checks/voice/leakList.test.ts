import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { executionOutcomeRegistry } from "../../../experiments/results/outcomes.ts";
import { refusalCodeRegistry } from "../../../experiments/results/refusalCodes.ts";
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
  // Dispatch 134: a laboratory setting outside its manifest's declared modelDomain.
  "outside-model-domain",
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

  it("contains all twenty-two refusal codes of requirement 3 (ten initial, seven tape, three diffusion, one inference, one model domain)", () => {
    assert.deepEqual(new Set(statusEnumLeak.ids.refusalCodes), new Set(REQUIRED_REFUSAL_CODES));
    assert.equal(statusEnumLeak.ids.refusalCodes.length, 22);
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

  it("completeness test (requirement 11): all live registered refusal codes are listed in voice-rules.yaml", () => {
    const liveCodes = Object.keys(refusalCodeRegistry);
    for (const code of liveCodes) {
      assert.ok(
        statusEnumLeak.ids.refusalCodes.includes(code),
        `Live refusal code "${code}" from refusalCodeRegistry must be listed in status-enum-leak.ids.refusalCodes`,
      );
    }
  });

  it("completeness test: all live hyphenated execution outcomes are listed in voice-rules.yaml", () => {
    const liveOutcomes = Object.keys(executionOutcomeRegistry).filter((o) => o.includes("-"));
    for (const outcome of liveOutcomes) {
      assert.ok(
        statusEnumLeak.ids.executionOutcomes.includes(outcome),
        `Live execution outcome "${outcome}" from executionOutcomeRegistry must be listed in status-enum-leak.ids.executionOutcomes`,
      );
    }
  });

  it("completeness check fails and names the missing ID when a fixture rules file has one code removed", () => {
    const droppedCode = "ftcs-unstable";
    const corruptedCodes = statusEnumLeak.ids.refusalCodes.filter((c) => c !== droppedCode);
    const liveCodes = Object.keys(refusalCodeRegistry);
    const missing = liveCodes.filter((c) => !corruptedCodes.includes(c));
    assert.deepEqual(missing, [droppedCode]);
  });
});
