/**
 * Staleness matrix tests for worker protocol.
 * Specification: am-rt-worker-protocol-gaq acceptance criterion 3.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type DecodeContext, decode } from "../workers/protocol/decode.ts";
import { registerAdmittedEvaluators } from "../workers/protocol/provenance.ts";
import { TEST_EVALUATOR_HASH, VALID_ACCEPTED } from "./protocol-fixtures/fixtures.ts";

describe("protocol.staleness", () => {
  registerAdmittedEvaluators({
    bm01Host: TEST_EVALUATOR_HASH,
  });

  const baseContext: DecodeContext = {
    runId: "run-current",
    acceptedActionIndex: 4,
    acceptedStepIndex: 10,
    issuedActionIndices: new Set([1, 2, 3, 4, 5, 6]),
  };

  const table = [
    {
      name: "older actionIndex rejected",
      msg: { ...VALID_ACCEPTED, runId: "run-current", actionIndex: 3, stepIndex: 20 },
      expectedOk: false,
      expectedCode: "stale-action-index",
    },
    {
      name: "equal actionIndex with equal stepIndex rejected",
      msg: { ...VALID_ACCEPTED, runId: "run-current", actionIndex: 4, stepIndex: 10 },
      expectedOk: false,
      expectedCode: "stale-step-index",
    },
    {
      name: "equal actionIndex with lower stepIndex rejected",
      msg: { ...VALID_ACCEPTED, runId: "run-current", actionIndex: 4, stepIndex: 5 },
      expectedOk: false,
      expectedCode: "stale-step-index",
    },
    {
      name: "equal actionIndex with strictly increasing stepIndex accepted (progress / chunk)",
      msg: { ...VALID_ACCEPTED, runId: "run-current", actionIndex: 4, stepIndex: 15, final: false },
      expectedOk: true,
    },
    {
      name: "unissued actionIndex rejected",
      msg: { ...VALID_ACCEPTED, runId: "run-current", actionIndex: 99, stepIndex: 1 },
      expectedOk: false,
      expectedCode: "unissued-action-index",
    },
    {
      name: "superseded runId rejected",
      msg: { ...VALID_ACCEPTED, runId: "run-superseded", actionIndex: 5, stepIndex: 1 },
      expectedOk: false,
      expectedCode: "stale-run-id",
    },
    {
      name: "late observer-change response with current runId and inputRevision but older actionIndex rejected",
      msg: {
        ...VALID_ACCEPTED,
        runId: "run-current",
        actionIndex: 2, // older than 4
        revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
        stepIndex: 1,
      },
      expectedOk: false,
      expectedCode: "stale-action-index",
    },
    {
      name: "new actionIndex with stepIndex 1 accepted",
      msg: { ...VALID_ACCEPTED, runId: "run-current", actionIndex: 5, stepIndex: 1 },
      expectedOk: true,
    },
  ];

  for (const entry of table) {
    it(`staleness matrix: ${entry.name}`, () => {
      const res = decode(entry.msg, baseContext);
      assert.equal(res.ok, entry.expectedOk);
      if (!entry.expectedOk && !res.ok) {
        assert.equal(res.code, entry.expectedCode);
      }
    });
  }

  it("progress message followed by its final message: both pass in sequential context", () => {
    // 1. Initial progress message at step 5
    const progressMsg = {
      ...VALID_ACCEPTED,
      runId: "run-current",
      actionIndex: 5,
      stepIndex: 5,
      final: false,
    };

    const res1 = decode(progressMsg, baseContext);
    assert.equal(res1.ok, true);

    // 2. Context advances after progress message accepted
    const advancedContext: DecodeContext = {
      ...baseContext,
      acceptedActionIndex: 5,
      acceptedStepIndex: 5,
    };

    // 3. Final message at step 10
    const finalMsg = {
      ...VALID_ACCEPTED,
      runId: "run-current",
      actionIndex: 5,
      stepIndex: 10,
      final: true,
    };

    const res2 = decode(finalMsg, advancedContext);
    assert.equal(res2.ok, true);
  });
});
