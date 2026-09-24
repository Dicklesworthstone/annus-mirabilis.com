/**
 * Comprehensive accept/reject tests for all refusal sites in provenance.ts (am-muyh).
 *
 * Governed by bead am-muyh and AGENTS.md:
 * - Provenance registry boundary enforcement: WASM artifact digests, capabilities, and evaluator source hashes.
 * - Accept/reject pair per refusal throw and return site.
 * - Every test carries explicit line citation (provenance.ts:<line>) and literal code string.
 */

import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  assertAdmittedCapability,
  assertAdmittedEvaluator,
  assertAdmittedWasmDigest,
  clearAdmittedManifest,
  getAdmittedManifest,
  ProvenanceViolationError,
  registerAdmittedEvaluators,
  registerAdmittedManifest,
  validateProvenanceRecord,
  type WasmArtifactManifest,
} from "./provenance.ts";
import type { ProvenanceRecord } from "./schema.ts";

const VALID_MANIFEST: WasmArtifactManifest = {
  schemaVersion: 1,
  bundleId: "test-manifest-bundle",
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
  files: {
    "release.wasm": {
      sha256: "80a1f8fda6f69003c9aa40f991726933c265b6c13ce6062faf5faef479a917bd",
      bytes: 92751,
    },
  },
};

const TEST_EVALUATOR_ID = "bm01Host";
const TEST_EVALUATOR_HASH = `source:sha256:${"f".repeat(64)}`;

function makeFrankenProvenance(overrides?: Partial<ProvenanceRecord>): ProvenanceRecord {
  return {
    ownerKind: "frankensim",
    artifactDigest: VALID_MANIFEST.wasmDigest,
    capabilityId: "diffusion-stepper",
    modelVersion: "1.0.0",
    streamVersion: 1,
    determinismClass: "bitwise-identical",
    ...overrides,
  };
}

function makeHostProvenance(overrides?: Partial<ProvenanceRecord>): ProvenanceRecord {
  return {
    ownerKind: "host-reference",
    evaluatorId: TEST_EVALUATOR_ID,
    artifactDigest: TEST_EVALUATOR_HASH,
    modelVersion: "1.0.0",
    streamVersion: 1,
    determinismClass: "cross-engine-float",
    ...overrides,
  };
}

describe("Worker protocol provenance refusal sites (am-muyh)", () => {
  // ==========================================================================
  // Site 1: (provenance.ts:119) unloaded-manifest
  // ==========================================================================
  test("site (provenance.ts:119) unloaded-manifest: rejects getAdmittedManifest when no manifest registered, accepts registered manifest", () => {
    // Reject case: manifest cleared / unloaded
    clearAdmittedManifest();
    assert.throws(
      () => getAdmittedManifest(),
      (err: unknown) => {
        assert.ok(err instanceof ProvenanceViolationError);
        assert.equal(err.code, "unloaded-manifest");
        assert.ok(err.message.includes("No WASM artifact manifest has been registered"));
        return true;
      },
    );

    // Accept case: manifest registered
    registerAdmittedManifest(VALID_MANIFEST);
    const accepted = getAdmittedManifest();
    assert.equal(accepted.bundleId, VALID_MANIFEST.bundleId);
  });

  // ==========================================================================
  // Site 2: (provenance.ts:153) unadmitted-digest via assertAdmittedWasmDigest
  // ==========================================================================
  test("site (provenance.ts:153) unadmitted-digest: rejects unregistered WASM digest, accepts admitted digest", () => {
    registerAdmittedManifest(VALID_MANIFEST);

    // Accept case: admitted digest
    assert.doesNotThrow(() => {
      assertAdmittedWasmDigest(VALID_MANIFEST.wasmDigest);
    });

    // Reject case: unknown digest
    assert.throws(
      () =>
        assertAdmittedWasmDigest(
          "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        ),
      (err: unknown) => {
        assert.ok(err instanceof ProvenanceViolationError);
        assert.equal(err.code, "unadmitted-digest");
        assert.ok(err.message.includes("is not admitted by the provenance registry"));
        return true;
      },
    );
  });

  // ==========================================================================
  // Site 3: (provenance.ts:165) unadmitted-capability via assertAdmittedCapability
  // ==========================================================================
  test("site (provenance.ts:165) unadmitted-capability: rejects unadmitted capability ID, accepts admitted capability", () => {
    registerAdmittedManifest(VALID_MANIFEST);

    // Accept case: admitted capability "diffusion-stepper"
    assert.doesNotThrow(() => {
      assertAdmittedCapability("diffusion-stepper");
    });

    // Reject case: unknown capability ID
    assert.throws(
      () => assertAdmittedCapability("unadmitted-hypothetical-capability"),
      (err: unknown) => {
        assert.ok(err instanceof ProvenanceViolationError);
        assert.equal(err.code, "unadmitted-capability");
        assert.ok(err.message.includes("is not admitted by the provenance registry"));
        return true;
      },
    );
  });

  // ==========================================================================
  // Site 4: (provenance.ts:205) unadmitted-evaluator via assertAdmittedEvaluator
  // ==========================================================================
  test("site (provenance.ts:205) unadmitted-evaluator: rejects unadmitted host evaluator hash or ID, accepts registered evaluator", () => {
    registerAdmittedEvaluators({ [TEST_EVALUATOR_ID]: TEST_EVALUATOR_HASH });

    // Accept case: registered evaluator and matching hash
    assert.doesNotThrow(() => {
      assertAdmittedEvaluator(TEST_EVALUATOR_ID, TEST_EVALUATOR_HASH);
    });

    // Reject cases: unregistered evaluator ID, wrong hash
    assert.throws(
      () => assertAdmittedEvaluator("unregisteredEvaluator", TEST_EVALUATOR_HASH),
      (err: unknown) => {
        assert.ok(err instanceof ProvenanceViolationError);
        assert.equal(err.code, "unadmitted-evaluator");
        return true;
      },
    );
    assert.throws(
      () => assertAdmittedEvaluator(TEST_EVALUATOR_ID, `source:sha256:${"0".repeat(64)}`),
      (err: unknown) => {
        assert.ok(err instanceof ProvenanceViolationError);
        assert.equal(err.code, "unadmitted-evaluator");
        return true;
      },
    );
  });

  // ==========================================================================
  // Site 5: (provenance.ts:271) unadmitted-digest return type union
  // Site 6: (provenance.ts:263) unadmitted-digest in validateProvenanceRecord is NOT driven
  //         from this file. It is driven by protocol.provenance.test.ts's "malformed
  //         provenance refuses rather than throwing" pair, which now carries the citation.
  //         Measured by planting: renaming :263's code reddens those two tests and no test here.
  // ==========================================================================
  test("site (provenance.ts:271) unadmitted-digest: return type and validation rejection on unadmitted WASM digest", () => {
    registerAdmittedManifest(VALID_MANIFEST);

    // Accept case: valid frankensim provenance record
    const accepted = validateProvenanceRecord(makeFrankenProvenance());
    assert.equal(accepted.ok, true);

    // Reject case: unadmitted digest
    const rejected = validateProvenanceRecord(
      makeFrankenProvenance({
        artifactDigest: "0000000000000000000000000000000000000000000000000000000000000000",
      }),
    );
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.code, "unadmitted-digest");
      assert.ok(rejected.reason.includes("is not admitted by the provenance registry"));
    }
  });

  // ==========================================================================
  // Site 7: (provenance.ts:279) unadmitted-capability in validateProvenanceRecord
  // ==========================================================================
  test("site (provenance.ts:279) unadmitted-capability: rejects frankensim provenance with unadmitted capabilityId, accepts admitted", () => {
    registerAdmittedManifest(VALID_MANIFEST);

    // Accept case: capability admitted
    const accepted = validateProvenanceRecord(makeFrankenProvenance());
    assert.equal(accepted.ok, true);

    // Reject case: unadmitted capabilityId
    const rejected = validateProvenanceRecord(
      makeFrankenProvenance({
        capabilityId: "unadmitted-quantum-tunneling",
      }),
    );
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.code, "unadmitted-capability");
      assert.ok(rejected.reason.includes("is not admitted by the provenance registry"));
    }
  });

  // ==========================================================================
  // Site 8: (provenance.ts:291) unadmitted-evaluator for host-reference
  // ==========================================================================
  test("site (provenance.ts:291) unadmitted-evaluator: rejects unadmitted host evaluator in validateProvenanceRecord, accepts admitted", () => {
    registerAdmittedEvaluators({ [TEST_EVALUATOR_ID]: TEST_EVALUATOR_HASH });

    // Accept case: admitted evaluator and matching hash
    const accepted = validateProvenanceRecord(makeHostProvenance());
    assert.equal(accepted.ok, true);

    // Reject case: mismatched hash for host-reference
    const rejected = validateProvenanceRecord(
      makeHostProvenance({
        artifactDigest: `source:sha256:${"1".repeat(64)}`,
      }),
    );
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.code, "unadmitted-evaluator");
      assert.ok(rejected.reason.includes("is not admitted"));
    }
  });

  // ==========================================================================
  // Site 9: (provenance.ts:300) unadmitted-evaluator for unknown ownerKind
  // ==========================================================================
  test("site (provenance.ts:300) unadmitted-evaluator: rejects unknown ownerKind in validateProvenanceRecord, accepts known kinds", () => {
    registerAdmittedManifest(VALID_MANIFEST);

    // Accept cases: known ownerKind "frankensim" or "host-reference"
    const validFranken = validateProvenanceRecord(makeFrankenProvenance());
    assert.equal(validFranken.ok, true);

    // Reject case: unknown ownerKind
    const rejected = validateProvenanceRecord({
      ...makeFrankenProvenance(),
      ownerKind: "rogue-wasm-worker" as unknown as "frankensim",
    });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.code, "unadmitted-evaluator");
      assert.ok(rejected.reason.includes("Unknown owner kind"));
    }
  });
});
