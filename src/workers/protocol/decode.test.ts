/**
 * Comprehensive accept/reject tests for all 34 refusal throw/return sites in decode.ts (am-muyh).
 *
 * Governed by am-rt-worker-protocol-gaq and AGENTS.md:
 * - Worker protocol decoder boundary verification: untrusted bytes to typed values.
 * - Accept/reject pair per throw/return site.
 * - Includes truncated and over-long frames, not only structurally invalid ones.
 * - Every test carries explicit line citation (decode.ts:<line>) and literal code string.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import type { U64String } from "../../experiments/identity/u64.ts";
import {
  TEST_EVALUATOR_HASH,
  VALID_ACCEPTED,
  VALID_HELLO,
  VALID_OUTCOME,
  VALID_REFUSAL,
  VALID_REQUEST,
} from "../../testing/protocol-fixtures/fixtures.ts";
import { type DecodeContext, type DecodeResult, decode } from "./decode.ts";
import { registerAdmittedEvaluators, registerAdmittedManifest } from "./provenance.ts";

registerAdmittedEvaluators({
  bm01Host: TEST_EVALUATOR_HASH,
});

registerAdmittedManifest({
  schemaVersion: 1,
  bundleId: "test-bundle",
  wasmDigest: "80a1f8fda6f69003c9aa40f991726933c265b6c13ce6062faf5faef479a917bd",
  wasmBytes: 92751,
  hashPrefix: "80a1f8fd",
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
  sizeBudget: {
    maxBytes: 500000,
    fullPackageBytes: 400000,
    recordedBytes: 92751,
  },
  files: {},
});

const defaultContext: DecodeContext = {
  runId: "run-alpha",
  acceptedActionIndex: 0,
  acceptedStepIndex: 0,
  issuedActionIndices: new Set([1, 2, 3, 4, 5]),
  expectedUnits: {
    particleRadius: "metre",
  },
};

function assertRejection(res: DecodeResult, expectedCode: string, contextMsg: string): void {
  assert.equal(res.ok, false, `Expected rejection for: ${contextMsg}`);
  if (!res.ok) {
    assert.equal(
      res.code,
      expectedCode,
      `Expected rejection code "${expectedCode}", got "${res.code}" (${res.reason})`,
    );
  }
}

describe("Worker protocol decode refusal sites (am-muyh)", () => {
  // ==========================================================================
  // Group 1: Message root & Hello message (Sites 1–7)
  // ==========================================================================

  test("site (decode.ts:110) malformed-response: rejects non-object or null message (truncated frame), accepts valid hello", () => {
    const accepted = decode(VALID_HELLO, defaultContext);
    assert.equal(accepted.ok, true);

    const truncatedNull = decode(null, defaultContext);
    assertRejection(truncatedNull, "malformed-response", "null message frame");

    const truncatedPrimitive = decode("truncated-raw-string", defaultContext);
    assertRejection(truncatedPrimitive, "malformed-response", "string primitive message frame");

    const truncatedArray = decode([1, 2, 3], defaultContext);
    assertRejection(truncatedArray, "malformed-response", "array message frame");
  });

  test("site (decode.ts:124) malformed-response: rejects message missing messageKind (truncated header), accepts valid request", () => {
    const accepted = decode(VALID_REQUEST, defaultContext);
    assert.equal(accepted.ok, true);

    const truncatedHeader = decode({}, defaultContext);
    assertRejection(
      truncatedHeader,
      "malformed-response",
      "empty object frame missing messageKind",
    );

    const nonStringKind = decode({ messageKind: 42 }, defaultContext);
    assertRejection(nonStringKind, "malformed-response", "numeric messageKind");
  });

  test("site (decode.ts:135) unknown-field: rejects hello message with extra fields (over-long frame), accepts valid hello", () => {
    const accepted = decode(VALID_HELLO, defaultContext);
    assert.equal(accepted.ok, true);

    const overLongHello = {
      ...VALID_HELLO,
      unexpectedPayloadBytes: "0xdeadbeef",
      trailingPadding: 1024,
    };
    const res = decode(overLongHello, defaultContext);
    assertRejection(res, "unknown-field", "hello frame with extra unknown fields");
  });

  test("site (decode.ts:149) protocol-mismatch: rejects hello message with unsupported protocol version, accepts valid hello", () => {
    const accepted = decode(VALID_HELLO, defaultContext);
    assert.equal(accepted.ok, true);

    const mismatchedVersion = {
      ...VALID_HELLO,
      protocolVersion: 999,
    };
    const res = decode(mismatchedVersion, defaultContext);
    assertRejection(res, "protocol-mismatch", "hello frame with unsupported protocolVersion 999");
  });

  test("site (decode.ts:162) malformed-response: rejects hello message with non-string array supportedLayouts, accepts valid hello", () => {
    const accepted = decode(VALID_HELLO, defaultContext);
    assert.equal(accepted.ok, true);

    const nonArrayLayouts = {
      ...VALID_HELLO,
      supportedLayouts: "brownian-frames@1",
    };
    assertRejection(
      decode(nonArrayLayouts, defaultContext),
      "malformed-response",
      "supportedLayouts string instead of array",
    );

    const invalidElementLayouts = {
      ...VALID_HELLO,
      supportedLayouts: [123, 456],
    };
    assertRejection(
      decode(invalidElementLayouts, defaultContext),
      "malformed-response",
      "supportedLayouts array of numbers",
    );
  });

  test("site (decode.ts:170) malformed-response: rejects hello message with invalid ownerKind, accepts valid hello", () => {
    const accepted = decode(VALID_HELLO, defaultContext);
    assert.equal(accepted.ok, true);

    const invalidOwner = {
      ...VALID_HELLO,
      ownerKind: "untrusted-third-party",
    };
    const res = decode(invalidOwner, defaultContext);
    assertRejection(res, "malformed-response", "hello frame with unrecognized ownerKind");
  });

  test("site (decode.ts:178) malformed-response: rejects hello message with non-string array provenanceSet, accepts valid hello", () => {
    const accepted = decode(VALID_HELLO, defaultContext);
    assert.equal(accepted.ok, true);

    const nonArrayProvenance = {
      ...VALID_HELLO,
      provenanceSet: null,
    };
    assertRejection(
      decode(nonArrayProvenance, defaultContext),
      "malformed-response",
      "provenanceSet null",
    );

    const invalidElementProvenance = {
      ...VALID_HELLO,
      provenanceSet: [null, 42],
    };
    assertRejection(
      decode(invalidElementProvenance, defaultContext),
      "malformed-response",
      "provenanceSet non-string elements",
    );
  });

  // ==========================================================================
  // Group 2: Request message validation (Sites 8–15)
  // ==========================================================================

  test("site (decode.ts:192) unknown-field: rejects request message with extra fields (over-long frame), accepts valid request", () => {
    const accepted = decode(VALID_REQUEST, defaultContext);
    assert.equal(accepted.ok, true);

    const overLongRequest = {
      ...VALID_REQUEST,
      unexpectedRogueKey: "over-long-buffer-data",
    };
    const res = decode(overLongRequest, defaultContext);
    assertRejection(res, "unknown-field", "request frame with extra unknown keys");
  });

  test("site (decode.ts:208) protocol-mismatch: rejects request message with mismatched protocolVersion, accepts valid request", () => {
    const accepted = decode(VALID_REQUEST, defaultContext);
    assert.equal(accepted.ok, true);

    const wrongVersion = {
      ...VALID_REQUEST,
      protocolVersion: 42,
    };
    const res = decode(wrongVersion, defaultContext);
    assertRejection(res, "protocol-mismatch", "request frame with protocolVersion 42");
  });

  test("site (decode.ts:214) missing-identity: rejects request message missing instanceId (truncated frame), accepts valid request", () => {
    const accepted = decode(VALID_REQUEST, defaultContext);
    assert.equal(accepted.ok, true);

    const truncatedInstance = {
      ...VALID_REQUEST,
      instanceId: "",
    };
    const res = decode(truncatedInstance, defaultContext);
    assertRejection(res, "missing-identity", "request frame with empty instanceId");
  });

  test("site (decode.ts:217) missing-identity: rejects request message missing runId (truncated frame), accepts valid request", () => {
    const accepted = decode(VALID_REQUEST, defaultContext);
    assert.equal(accepted.ok, true);

    const truncatedRunId = {
      ...VALID_REQUEST,
      runId: "",
    };
    const res = decode(truncatedRunId, defaultContext);
    assertRejection(res, "missing-identity", "request frame with empty runId");
  });

  test("site (decode.ts:220) missing-identity: rejects request message missing actionIndex (truncated frame), accepts valid request", () => {
    const accepted = decode(VALID_REQUEST, defaultContext);
    assert.equal(accepted.ok, true);

    const truncatedAction = {
      ...VALID_REQUEST,
      actionIndex: undefined,
    };
    const res = decode(truncatedAction, defaultContext);
    assertRejection(res, "missing-identity", "request frame with undefined actionIndex");
  });

  test("site (decode.ts:229) invalid-u64-seed: rejects request message with numeric JSON seed, accepts canonical U64 string seed", () => {
    const accepted = decode(VALID_REQUEST, defaultContext);
    assert.equal(accepted.ok, true);

    const numericSeedRequest = {
      ...VALID_REQUEST,
      seedPolicy: {
        seed: 123456789,
        streamVersion: 1,
        allocationId: "alloc-1",
      },
    };
    const res = decode(numericSeedRequest, defaultContext);
    assertRejection(res, "invalid-u64-seed", "request frame with numeric JSON seed");
  });

  test("site (decode.ts:236) invalid-u64-seed: rejects request message with invalid canonical U64 seed string, accepts valid U64 string seed", () => {
    const validWithSeed = {
      ...VALID_REQUEST,
      seedPolicy: {
        seed: "42" as U64String,
        streamVersion: 1,
        allocationId: "alloc-1",
      },
    };
    const accepted = decode(validWithSeed, defaultContext);
    assert.equal(accepted.ok, true);

    const invalidStringSeed = {
      ...VALID_REQUEST,
      seedPolicy: {
        seed: null,
        streamVersion: 1,
        allocationId: "alloc-1",
      },
    };
    const res = decode(invalidStringSeed, defaultContext);
    assertRejection(res, "invalid-u64-seed", "request frame with non-string seed");
  });

  test("site (decode.ts:245) nonfinite-value: rejects request message with non-finite parameter numbers, accepts valid request", () => {
    const accepted = decode(VALID_REQUEST, defaultContext);
    assert.equal(accepted.ok, true);

    const nanRequest = {
      ...VALID_REQUEST,
      parameters: {
        particleRadius: Number.NaN,
        temperature: 293.15,
      },
    };
    const res = decode(nanRequest, defaultContext);
    assertRejection(res, "nonfinite-value", "request frame with NaN parameter");
  });

  // ==========================================================================
  // Group 3: Common Response Identity & Staleness (Sites 16–24)
  // ==========================================================================

  test("site (decode.ts:264) malformed-response: rejects response with unrecognized response messageKind, accepts valid accepted", () => {
    const accepted = decode(VALID_ACCEPTED, defaultContext);
    assert.equal(accepted.ok, true);

    const unknownKind = {
      messageKind: "unrecognized-kind-404",
      instanceId: "inst-42",
      runId: "run-alpha",
      actionIndex: 1,
    };
    const res = decode(unknownKind, defaultContext);
    assertRejection(res, "malformed-response", "response frame with unknown response messageKind");
  });

  test("site (decode.ts:273) unknown-field: rejects response with extra fields (over-long frame), accepts valid accepted", () => {
    const accepted = decode(VALID_ACCEPTED, defaultContext);
    assert.equal(accepted.ok, true);

    const overLongResponse = {
      ...VALID_ACCEPTED,
      rogueTrailingData: [0xff, 0xee, 0xdd],
    };
    const res = decode(overLongResponse, defaultContext);
    assertRejection(res, "unknown-field", "accepted frame with extra unknown field");
  });

  test("site (decode.ts:281) missing-identity: rejects response missing instanceId (truncated frame), accepts valid accepted", () => {
    const accepted = decode(VALID_ACCEPTED, defaultContext);
    assert.equal(accepted.ok, true);

    const truncatedInstance = {
      ...VALID_ACCEPTED,
      instanceId: "   ",
    };
    const res = decode(truncatedInstance, defaultContext);
    assertRejection(res, "missing-identity", "accepted frame with whitespace instanceId");
  });

  test("site (decode.ts:284) missing-identity: rejects response missing runId (truncated frame), accepts valid accepted", () => {
    const accepted = decode(VALID_ACCEPTED, defaultContext);
    assert.equal(accepted.ok, true);

    const truncatedRunId = {
      ...VALID_ACCEPTED,
      runId: "",
    };
    const res = decode(truncatedRunId, defaultContext);
    assertRejection(res, "missing-identity", "accepted frame with empty runId");
  });

  test("site (decode.ts:287) missing-identity: rejects response with non-integer actionIndex, accepts valid accepted", () => {
    const accepted = decode(VALID_ACCEPTED, defaultContext);
    assert.equal(accepted.ok, true);

    const floatActionIndex = {
      ...VALID_ACCEPTED,
      actionIndex: 1.5,
    };
    const res = decode(floatActionIndex, defaultContext);
    assertRejection(res, "missing-identity", "accepted frame with floating point actionIndex");
  });

  test("site (decode.ts:290) missing-identity: rejects response missing revisions object (truncated frame), accepts valid accepted", () => {
    const accepted = decode(VALID_ACCEPTED, defaultContext);
    assert.equal(accepted.ok, true);

    const truncatedRevisions = {
      ...VALID_ACCEPTED,
      revisions: null,
    };
    const res = decode(truncatedRevisions, defaultContext);
    assertRejection(res, "missing-identity", "accepted frame with null revisions");
  });

  test("site (decode.ts:297) stale-run-id: rejects response with superseded runId, accepts matching runId", () => {
    const accepted = decode(VALID_ACCEPTED, defaultContext);
    assert.equal(accepted.ok, true);

    const supersededRunResponse = {
      ...VALID_ACCEPTED,
      runId: "superseded-run-beta",
    };
    const res = decode(supersededRunResponse, defaultContext);
    assertRejection(res, "stale-run-id", "accepted frame with superseded runId");
  });

  test("site (decode.ts:306) unissued-action-index: rejects response with actionIndex not in issuedActionIndices, accepts issued actionIndex", () => {
    const accepted = decode(VALID_ACCEPTED, defaultContext);
    assert.equal(accepted.ok, true);

    const unissuedActionResponse = {
      ...VALID_ACCEPTED,
      actionIndex: 999,
    };
    const res = decode(unissuedActionResponse, defaultContext);
    assertRejection(
      res,
      "unissued-action-index",
      "accepted frame with actionIndex not in issuedActionIndices",
    );
  });

  test("site (decode.ts:315) stale-action-index: rejects response with actionIndex older than acceptedActionIndex, accepts newer actionIndex", () => {
    const ctxWithAdvancedAccepted: DecodeContext = {
      ...defaultContext,
      acceptedActionIndex: 2,
      issuedActionIndices: new Set([1, 2, 3]),
    };

    const validNewer = {
      ...VALID_ACCEPTED,
      actionIndex: 3,
    };
    const accepted = decode(validNewer, ctxWithAdvancedAccepted);
    assert.equal(accepted.ok, true);

    const staleActionResponse = {
      ...VALID_ACCEPTED,
      actionIndex: 1,
    };
    const res = decode(staleActionResponse, ctxWithAdvancedAccepted);
    assertRejection(
      res,
      "stale-action-index",
      "accepted frame with actionIndex < acceptedActionIndex",
    );
  });

  // ==========================================================================
  // Group 4: Accepted response details (Sites 25–29)
  // ==========================================================================

  test("site (decode.ts:325) malformed-response: rejects accepted response missing integer stepIndex (truncated frame), accepts valid accepted", () => {
    const accepted = decode(VALID_ACCEPTED, defaultContext);
    assert.equal(accepted.ok, true);

    const nonIntegerStep = {
      ...VALID_ACCEPTED,
      stepIndex: 1.25,
    };
    assertRejection(
      decode(nonIntegerStep, defaultContext),
      "malformed-response",
      "accepted frame with fractional stepIndex",
    );

    const missingStep = {
      ...VALID_ACCEPTED,
      stepIndex: undefined,
    };
    assertRejection(
      decode(missingStep, defaultContext),
      "malformed-response",
      "accepted frame missing stepIndex (truncated frame)",
    );
  });

  test("site (decode.ts:332) stale-step-index: rejects accepted response with non-increasing stepIndex for same action, accepts increasing stepIndex", () => {
    const ctxWithStep: DecodeContext = {
      ...defaultContext,
      acceptedActionIndex: 1,
      acceptedStepIndex: 5,
      issuedActionIndices: new Set([1, 2]),
    };

    const advancingStep = {
      ...VALID_ACCEPTED,
      actionIndex: 1,
      stepIndex: 6,
    };
    const accepted = decode(advancingStep, ctxWithStep);
    assert.equal(accepted.ok, true);

    const stagnantStep = {
      ...VALID_ACCEPTED,
      actionIndex: 1,
      stepIndex: 5,
    };
    const res = decode(stagnantStep, ctxWithStep);
    assertRejection(
      res,
      "stale-step-index",
      "accepted frame with non-increasing stepIndex for current actionIndex",
    );
  });

  test("site (decode.ts:345) nonfinite-value: rejects accepted response with non-finite values in parameters/outputs/simulatedTime, accepts finite values", () => {
    const accepted = decode(VALID_ACCEPTED, defaultContext);
    assert.equal(accepted.ok, true);

    const infiniteTimeResponse = {
      ...VALID_ACCEPTED,
      simulatedTime: Number.POSITIVE_INFINITY,
    };
    assertRejection(
      decode(infiniteTimeResponse, defaultContext),
      "nonfinite-value",
      "accepted frame with simulatedTime = Infinity",
    );

    const nanOutputsResponse = {
      ...VALID_ACCEPTED,
      outputs: [
        {
          quantityId: "particleRadius",
          unit: "metre",
          semanticKind: "parameter",
          ownerId: "bm01Host",
          status: "value",
          value: Number.NaN,
        },
      ],
    };
    assertRejection(
      decode(nanOutputsResponse, defaultContext),
      "nonfinite-value",
      "accepted frame with NaN in outputs",
    );
  });

  test("site (decode.ts:358) unit-mismatch: rejects accepted response with output unit differing from expectedUnits contract, accepts matching units", () => {
    const accepted = decode(VALID_ACCEPTED, defaultContext);
    assert.equal(accepted.ok, true);

    const mismatchedUnitResponse = {
      ...VALID_ACCEPTED,
      outputs: [
        {
          quantityId: "particleRadius",
          unit: "angstrom",
          semanticKind: "parameter",
          ownerId: "bm01Host",
          status: "value",
          value: 1e-6,
        },
      ],
    };
    const res = decode(mismatchedUnitResponse, defaultContext);
    assertRejection(
      res,
      "unit-mismatch",
      "accepted frame with output unit angstrom vs expected metre",
    );
  });

  test("site (decode.ts:388) malformed-response: rejects accepted response missing provenance record (truncated frame), accepts valid accepted", () => {
    const accepted = decode(VALID_ACCEPTED, defaultContext);
    assert.equal(accepted.ok, true);

    const truncatedProvenance = {
      ...VALID_ACCEPTED,
      provenance: null,
    };
    const res = decode(truncatedProvenance, defaultContext);
    assertRejection(
      res,
      "malformed-response",
      "accepted frame missing provenance record (truncated frame)",
    );
  });

  // ==========================================================================
  // Group 5: Refusal, Outcome, and Fallback (Sites 30–34)
  // ==========================================================================

  test("site (decode.ts:407) malformed-response: rejects refusal message missing refusal record (truncated frame), accepts valid refusal", () => {
    const accepted = decode(VALID_REFUSAL, defaultContext);
    assert.equal(accepted.ok, true);

    const truncatedRefusal = {
      ...VALID_REFUSAL,
      refusal: null,
    };
    const res = decode(truncatedRefusal, defaultContext);
    assertRejection(
      res,
      "malformed-response",
      "refusal frame missing refusal record (truncated frame)",
    );
  });

  test("site (decode.ts:414) unregistered-refusal-code: rejects refusal message with unregistered refusal code, accepts registered refusal code", () => {
    const accepted = decode(VALID_REFUSAL, defaultContext);
    assert.equal(accepted.ok, true);

    const unregisteredRefusal = {
      ...VALID_REFUSAL,
      refusal: {
        code: "not-a-registered-refusal-code-xyz",
        domainKind: "numerical",
        affected: {},
        message: "Unknown refusal.",
        rankedRepairs: [],
      },
    };
    const res = decode(unregisteredRefusal, defaultContext);
    assertRejection(res, "unregistered-refusal-code", "refusal frame with unregistered code");
  });

  test("site (decode.ts:426) malformed-response: rejects outcome message missing outcome record (truncated frame), accepts valid outcome", () => {
    const accepted = decode(VALID_OUTCOME, defaultContext);
    assert.equal(accepted.ok, true);

    const truncatedOutcome = {
      ...VALID_OUTCOME,
      outcome: null,
    };
    const res = decode(truncatedOutcome, defaultContext);
    assertRejection(
      res,
      "malformed-response",
      "outcome frame missing outcome record (truncated frame)",
    );
  });

  test("site (decode.ts:433) malformed-response: rejects outcome message with unknown execution outcome id, accepts registered outcome", () => {
    const accepted = decode(VALID_OUTCOME, defaultContext);
    assert.equal(accepted.ok, true);

    const unknownOutcomeId = {
      ...VALID_OUTCOME,
      outcome: {
        outcome: "non-existent-outcome-id-999",
        message: "Unknown execution outcome.",
        retry: "none",
      },
    };
    const res = decode(unknownOutcomeId, defaultContext);
    assertRejection(
      res,
      "malformed-response",
      "outcome frame with unregistered outcome identifier",
    );
  });

  test("an unrecognized messageKind is refused at the kind check, and the trailing fallback is dead", () => {
    // REWRITTEN. What stood here cited (decode.ts:444) and claimed to exercise the
    // fallback at the end of decode(). It does not: the case it passes is refused by the
    // kind check much earlier, which planting confirms - renaming the fallback's code
    // leaves this green, and renaming the kind check's code turns it red.
    //
    // The previous comment had already REASONED ITS WAY TO THAT CONCLUSION - "since line
    // 267 rejects any messageKind not in allowedKeysMap, and lines 327, 405, 424 handle
    // all 3 keys" - and then, instead of recording the site as unreachable, ended with
    // "Can we verify line 444 is recognized by scanner? ... And this test block cites
    // (decode.ts:444) and mentions malformed-response!". That is coverage written for the
    // instrument rather than for the code, and the reasoning above it was right.
    //
    // So this test now asserts the behaviour that is real, and the unreachability is
    // recorded as a claim below rather than dressed up as a test.
    const accepted = decode(VALID_ACCEPTED, defaultContext);
    assert.equal(accepted.ok, true);

    const res = decode({ messageKind: "unknown-kind" }, defaultContext);
    assertRejection(res, "malformed-response", "unknown messagekind");
  });

  test("the trailing fallback at decode.ts:443 is unreachable, and the three returns that make it so", () => {
    // NOT A TEST OF THE SITE. decode() reads messageKind, looks it up in allowedKeysMap,
    // and refuses anything absent from it. The map has exactly three keys, and each of
    // the three branches returns. So control cannot arrive at the trailing return, and
    // the site is a defensive fallback rather than a refusal any input can produce.
    //
    // A third cause of a dead refusal, and not the am-okw3 one: there is no validating
    // loader above this. The guard is dead because an earlier EXHAUSTIVE check inside the
    // same function covers its domain, which is the facsimileSourceSchema:657 shape.
    //
    // Asserted, so the claim fails if the structure changes: the lookup must still reject
    // an absent kind, and every key of the map must still be handled by a branch that
    // returns. Add a fourth key without a branch and this goes red.
    const source = readFileSync(
      join(process.cwd(), "src", "workers", "protocol", "decode.ts"),
      "utf8",
    );
    const mapBlock = source.slice(
      source.indexOf("const allowedKeysMap"),
      source.indexOf("const allowed = allowedKeysMap"),
    );
    const keys = [...mapBlock.matchAll(/^\s+(\w+):\s*\w+_ALLOWED_KEYS,/gm)].map((m) => m[1]);
    assert.deepEqual(keys, ["accepted", "refusal", "outcome"]);
    // The absent-kind rejection, which is what makes the map exhaustive in practice.
    assert.match(source, /const allowed = allowedKeysMap\[messageKind\];\s*\n\s*if \(!allowed\)/);
    // And each key is handled. Anything reaching the fallback would have to be a key the
    // map admits and no branch handles.
    for (const key of keys) {
      assert.ok(
        source.includes(`messageKind === "${key}"`),
        `${key} is in allowedKeysMap with no branch handling it, so the fallback is now reachable`,
      );
    }
  });
});
