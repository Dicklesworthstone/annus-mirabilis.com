/**
 * Tests for Provenance Registry and Hash Verification.
 * Specification: am-rt-worker-protocol-gaq acceptance criterion 6.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeEvaluatorHashes } from "../../scripts/hash-evaluators.ts";
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
