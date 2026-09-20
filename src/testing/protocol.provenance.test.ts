/**
 * Tests for Provenance Registry and Hash Verification.
 * Specification: am-rt-worker-protocol-gaq acceptance criterion 6.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeEvaluatorHashes } from "../../scripts/hash-evaluators.ts";
import { decode } from "../workers/protocol/decode.ts";
import {
  clearAdmittedEvaluators,
  clearAdmittedManifest,
  isAdmittedCapability,
  isAdmittedEvaluator,
  isAdmittedWasmDigest,
  loadDefaultManifest,
  registerAdmittedEvaluators,
  registerAdmittedManifest,
  validateProvenanceRecord,
  type WasmArtifactManifest,
} from "../workers/protocol/provenance.ts";

describe("protocol.provenance", () => {
  const dummyManifest: WasmArtifactManifest = {
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
    files: {
      "fs_annus_diffusion_bg.wasm": {
        sha256: "105d7ffc15414de5eccebcbcae942015b187fed0ea67a26ced5c50949593bb7b",
        bytes: 154,
      },
    },
  };

  it("admits manifest-driven WASM digests and rejects foreign digests", () => {
    registerAdmittedManifest(dummyManifest);

    assert.equal(
      isAdmittedWasmDigest("105d7ffc15414de5eccebcbcae942015b187fed0ea67a26ced5c50949593bb7b"),
      true,
    );
    assert.equal(
      isAdmittedWasmDigest("0000000000000000000000000000000000000000000000000000000000000000"),
      false,
    );
  });

  it("admits manifest capabilities and rejects unknown capabilities", () => {
    registerAdmittedManifest(dummyManifest);

    assert.equal(isAdmittedCapability("diffusion-stepper"), true);
    assert.equal(isAdmittedCapability("unknown-capability"), false);
  });

  it("admits evaluator hashes from computeEvaluatorHashes()", () => {
    clearAdmittedEvaluators();
    const hashes = computeEvaluatorHashes();
    const record: Record<string, string> = {};
    for (const [id, h] of Object.entries(hashes)) {
      record[id] = h.sourceHash;
    }
    registerAdmittedEvaluators(record);

    assert.ok(hashes["bm01Host"], "bm01Host must be in computed evaluator hashes");
    assert.equal(isAdmittedEvaluator("bm01Host", hashes["bm01Host"]!.sourceHash), true);
    assert.equal(isAdmittedEvaluator("bm01Host", "source:sha256:0000000000000000"), false);
    assert.equal(isAdmittedEvaluator("nonExistentHost", hashes["bm01Host"]!.sourceHash), false);
  });

  it("validateProvenanceRecord handles both frankensim and host-reference owners", () => {
    registerAdmittedManifest(dummyManifest);
    registerAdmittedEvaluators({
      bm01Host: "source:sha256:105d7ffc15414de5eccebcbcae942015b187fed0ea67a26ced5c50949593bb7b",
    });

    // Valid frankensim provenance
    const validWasm = validateProvenanceRecord({
      ownerKind: "frankensim",
      capabilityId: "diffusion-stepper",
      modelVersion: "1.0.0",
      artifactDigest: "sha256:105d7ffc15414de5eccebcbcae942015b187fed0ea67a26ced5c50949593bb7b",
      streamVersion: 1,
      determinismClass: "bitwise-identical",
    });
    assert.equal(validWasm.ok, true);

    // Foreign wasm digest
    const foreignWasm = validateProvenanceRecord({
      ownerKind: "frankensim",
      capabilityId: "diffusion-stepper",
      modelVersion: "1.0.0",
      artifactDigest: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      streamVersion: 1,
      determinismClass: "bitwise-identical",
    });
    assert.equal(foreignWasm.ok, false);
    if (!foreignWasm.ok) {
      assert.equal(foreignWasm.code, "unadmitted-digest");
    }

    // Valid host-reference provenance
    const validHost = validateProvenanceRecord({
      ownerKind: "host-reference",
      evaluatorId: "bm01Host",
      modelVersion: "1.0.0",
      artifactDigest:
        "source:sha256:105d7ffc15414de5eccebcbcae942015b187fed0ea67a26ced5c50949593bb7b",
      streamVersion: 1,
      determinismClass: "bitwise-identical",
    });
    assert.equal(validHost.ok, true);

    // Foreign host hash
    const foreignHost = validateProvenanceRecord({
      ownerKind: "host-reference",
      evaluatorId: "bm01Host",
      modelVersion: "1.0.0",
      artifactDigest: "source:sha256:badhash",
      streamVersion: 1,
      determinismClass: "bitwise-identical",
    });
    assert.equal(foreignHost.ok, false);
    if (!foreignHost.ok) {
      assert.equal(foreignHost.code, "unadmitted-evaluator");
    }
  });

  it("loadDefaultManifest reads public/wasm/manifest.json if present", () => {
    clearAdmittedManifest();
    const manifest = loadDefaultManifest();
    if (manifest) {
      assert.equal(typeof manifest.bundleId, "string");
      assert.equal(typeof manifest.wasmDigest, "string");
    }
  });
});

/**
 * A malformed provenance record refuses; it does not throw (am-6iz4).
 *
 * decode() checks that `provenance` is an object and then hands it to
 * validateProvenanceRecord, whose parameter type claims a valid ProvenanceRecord. The gap
 * between those two was bridged by `as any`, and underneath it the frankensim branch read
 * provenance.artifactDigest.replace(...) unguarded: an accepted message carrying
 * `provenance: { ownerKind: "frankensim" }` made the decoder THROW a TypeError. A decoder
 * that throws on malformed input is what the typed-refusal contract exists to prevent, and
 * a thrown TypeError carries no code for a caller to act on.
 */
describe("malformed provenance refuses rather than throwing", () => {
  const acceptedWith = (provenance: unknown) => ({
    messageKind: "accepted",
    instanceId: "instance-1",
    runId: "run-1",
    actionIndex: 1,
    revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
    stepIndex: 0,
    simulatedTime: 0,
    outputs: {},
    provenance,
  });
  const context = {
    runId: "run-1",
    acceptedActionIndex: 0,
    acceptedStepIndex: 0,
    issuedActionIndices: new Set([1]),
  } as never;

  it("an ownerKind of frankensim with no artifactDigest is a typed refusal", () => {
    const result = decode(acceptedWith({ ownerKind: "frankensim" }), context);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "unadmitted-digest");
    assert.ok(result.reason.includes("artifact digest"), result.reason);
  });

  it("a digest that is present but not a string is also a refusal, not a throw", () => {
    const result = decode(acceptedWith({ ownerKind: "frankensim", artifactDigest: 42 }), context);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "unadmitted-digest");
  });

  it("the guard did not close the door on everything", () => {
    // Without this case the two above would pass over a validator that refused
    // everything: a host-reference record is refused for its own reason, not the digest.
    const good = decode(acceptedWith({ ownerKind: "host-reference" }), context);
    assert.equal(good.ok, false);
    if (good.ok) return;
    assert.notEqual(good.code, "unadmitted-digest");
  });
});
