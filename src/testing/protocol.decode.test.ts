/**
 * Unit tests for strict worker protocol decoder.
 * Specification: am-rt-worker-protocol-gaq.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type DecodeContext, decode } from "../workers/protocol/decode.ts";
import {
  registerAdmittedEvaluators,
  registerAdmittedManifest,
} from "../workers/protocol/provenance.ts";
import {
  MALFORMED_CORPUS,
  TEST_EVALUATOR_HASH,
  VALID_ACCEPTED,
  VALID_ACCEPTED_WITH_BUFFER,
  VALID_HELLO,
  VALID_OUTCOME,
  VALID_REFUSAL,
  VALID_REQUEST,
} from "./protocol-fixtures/fixtures.ts";

describe("protocol.decode", () => {
  // Set up provenance environment
  registerAdmittedEvaluators({
    bm01Host: TEST_EVALUATOR_HASH,
  });

  registerAdmittedManifest({
    schemaVersion: 1,
    bundleId: "test-bundle",
    wasmDigest: "105d7ffc15414de5eccebcbcae942015b187fed0ea67a26ced5c50949593bb7b",
    wasmBytes: 154,
    hashPrefix: "105d7ffc",
    revisions: { frankensim: "pinned" },
    streamSemanticsVersion: 1,
    capabilities: [
      {
        capabilityId: "diffusion-stepper",
        browserExport: "admit_diffusion1d_frames",
        releaseArtifact: "release.wasm",
        acceptanceState: "accepted",
        determinismClass: "bitwise-identical",
      },
    ],
    sizeBudget: { maxBytes: 500000, fullPackageBytes: 400000, recordedBytes: 154 },
    files: {},
  });

  const validContext: DecodeContext = {
    runId: "run-alpha",
    acceptedActionIndex: 0,
    acceptedStepIndex: 0,
    issuedActionIndices: new Set([1, 2, 3, 4, 5]),
    expectedUnits: {
      displacement: "μm",
    },
  };

  it("accepts valid hello fixture", () => {
    const res = decode(VALID_HELLO, validContext);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.message.messageKind, "hello");
    }
  });

  it("accepts valid request fixture", () => {
    const res = decode(VALID_REQUEST, validContext);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.message.messageKind, "request");
    }
  });

  it("accepts valid accepted fixture", () => {
    const res = decode(VALID_ACCEPTED, validContext);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.message.messageKind, "accepted");
    }
  });

  it("accepts valid accepted fixture with versioned buffer", () => {
    const res = decode(VALID_ACCEPTED_WITH_BUFFER, validContext);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.message.messageKind, "accepted");
    }
  });

  it("accepts valid refusal fixture", () => {
    const res = decode(VALID_REFUSAL, validContext);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.message.messageKind, "refusal");
    }
  });

  it("accepts valid outcome fixture", () => {
    const res = decode(VALID_OUTCOME, validContext);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.message.messageKind, "outcome");
    }
  });

  // Malformed corpus tests
  for (const tc of MALFORMED_CORPUS) {
    it(`rejects malformed case [${tc.id}]: ${tc.description}`, () => {
      let acceptedAction = 0;
      let acceptedStep = 0;
      const issued = new Set([0, 1, 2, 3]);

      if (tc.id === "stale-action-index") {
        acceptedAction = 1;
      } else if (tc.id === "stale-step-index") {
        acceptedAction = 1;
        acceptedStep = 1;
      }

      const ctx: DecodeContext = {
        runId: "run-alpha",
        acceptedActionIndex: acceptedAction,
        acceptedStepIndex: acceptedStep,
        issuedActionIndices: issued,
        expectedUnits: {
          displacement: "μm",
        },
      };

      const res = decode(tc.message, ctx);
      assert.equal(res.ok, false, `Expected case "${tc.id}" to be rejected, but it was accepted.`);
      if (!res.ok) {
        assert.equal(
          res.code,
          tc.expectedCode,
          `Expected rejection code "${tc.expectedCode}" for case "${tc.id}", got "${res.code}". Reason: ${res.reason}`,
        );
      }
    });
  }
});
