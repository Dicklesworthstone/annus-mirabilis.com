import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  type CapabilityMatrixRow,
  parseCapabilityMatrix,
} from "./wasm-artifacts/capabilityMatrix.ts";
import { admitExportsForBundle, formatAdmissionFailures } from "./wasm-artifacts/matrixGate.ts";

const BUNDLE_ID = "fs-annus-diffusion";
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const BINDING_DOCUMENT_PATH = path.join(currentDir, "..", "docs", "FRANKENSIM_BINDING.md");
const MATRIX_GATE_SOURCE_PATH = path.join(currentDir, "wasm-artifacts", "matrixGate.ts");

function row(
  overrides: Partial<CapabilityMatrixRow> &
    Pick<CapabilityMatrixRow, "capabilityId" | "browserExport">,
): CapabilityMatrixRow {
  return {
    family: "Diffusion and stochastic transport",
    instrumentId: "bm-01",
    upstreamStatus: "new-upstream",
    owner: `fs_wasm::${overrides.browserExport}`,
    nativeTestTarget: "none",
    admittedDomain: "fixture domain",
    sourceReference: "fixture source",
    releaseArtifact: BUNDLE_ID,
    acceptanceState: "owner-decided",
    ...overrides,
  };
}

describe("admitExportsForBundle: the fixture matrix in the bead's own test plan", () => {
  it("a matrix whose three export rows name this bundle at owner-decided admits all three", () => {
    const matrix: CapabilityMatrixRow[] = [
      row({ capabilityId: "diffusion.brownian-frames", browserExport: "brownian_frames" }),
      row({ capabilityId: "diffusion.philox-normals", browserExport: "philox_normals" }),
      row({ capabilityId: "diffusion.ftcs-1d", browserExport: "diffusion1d_frames" }),
    ];
    const result = admitExportsForBundle(
      matrix,
      ["brownian_frames", "philox_normals", "diffusion1d_frames"],
      BUNDLE_ID,
    );
    assert.deepEqual(result.failures, []);
    assert.deepEqual(
      result.admitted.map((a) => a.export).sort(),
      ["brownian_frames", "diffusion1d_frames", "philox_normals"].sort(),
    );
  });

  it("a row whose releaseArtifact is none excludes that export, naming the export and the field", () => {
    const matrix: CapabilityMatrixRow[] = [
      row({
        capabilityId: "diffusion.heat-frames",
        browserExport: "heat_frames",
        releaseArtifact: "none",
      }),
    ];
    const result = admitExportsForBundle(matrix, ["heat_frames"], BUNDLE_ID);
    assert.deepEqual(result.admitted, []);
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0]?.export, "heat_frames");
    assert.equal(result.failures[0]?.field, "releaseArtifact");
    assert.ok(formatAdmissionFailures(result)?.includes("heat_frames"));
    assert.ok(formatAdmissionFailures(result)?.includes("releaseArtifact"));
  });

  it("a row naming a different bundle fails the same way", () => {
    const matrix: CapabilityMatrixRow[] = [
      row({
        capabilityId: "radiation.some-other-bundle",
        browserExport: "planck_frames",
        releaseArtifact: "fs-annus-radiation",
      }),
    ];
    const result = admitExportsForBundle(matrix, ["planck_frames"], BUNDLE_ID);
    assert.deepEqual(result.admitted, []);
    assert.equal(result.failures[0]?.export, "planck_frames");
    assert.equal(result.failures[0]?.field, "releaseArtifact");
    assert.ok(result.failures[0]?.message.includes("fs-annus-radiation"));
  });

  it("a row at acceptanceState: not-started is refused even when releaseArtifact names this bundle", () => {
    const matrix: CapabilityMatrixRow[] = [
      row({
        capabilityId: "diffusion.brownian-frames",
        browserExport: "brownian_frames",
        acceptanceState: "not-started",
      }),
    ];
    const result = admitExportsForBundle(matrix, ["brownian_frames"], BUNDLE_ID);
    assert.deepEqual(result.admitted, []);
    assert.equal(result.failures[0]?.export, "brownian_frames");
    assert.equal(result.failures[0]?.field, "acceptanceState");
    assert.ok(result.failures[0]?.message.includes("not-started"));
  });

  it("an export with no row at all fails naming the export", () => {
    const result = admitExportsForBundle([], ["philox_normals"], BUNDLE_ID);
    assert.deepEqual(result.admitted, []);
    assert.equal(result.failures[0]?.export, "philox_normals");
    assert.equal(result.failures[0]?.field, "missing-row");
  });

  it("rows for the same export that disagree with each other are refused, not resolved by picking one", () => {
    const matrix: CapabilityMatrixRow[] = [
      row({
        capabilityId: "diffusion.brownian-frames",
        browserExport: "brownian_frames",
        instrumentId: "bm-01",
      }),
      row({
        capabilityId: "diffusion.brownian-frames",
        browserExport: "brownian_frames",
        instrumentId: "bm-05",
        releaseArtifact: "none",
      }),
    ];
    const result = admitExportsForBundle(matrix, ["brownian_frames"], BUNDLE_ID);
    assert.deepEqual(result.admitted, []);
    assert.equal(result.failures[0]?.export, "brownian_frames");
    assert.equal(result.failures[0]?.field, "inconsistent-rows");
  });

  it("consistent multi-row exports (two instruments, one capability) admit normally", () => {
    const matrix: CapabilityMatrixRow[] = [
      row({
        capabilityId: "diffusion.brownian-frames",
        browserExport: "brownian_frames",
        instrumentId: "bm-01",
      }),
      row({
        capabilityId: "diffusion.brownian-frames",
        browserExport: "brownian_frames",
        instrumentId: "bm-05",
      }),
    ];
    const result = admitExportsForBundle(matrix, ["brownian_frames"], BUNDLE_ID);
    assert.deepEqual(result.failures, []);
    assert.equal(result.admitted[0]?.rows.length, 2);
  });
});

describe("admitExportsForBundle against the real capability matrix", () => {
  it("brownian_frames, philox_normals, and diffusion1d_frames are all admitted for fs-annus-diffusion", () => {
    const bindingDocument = readFileSync(BINDING_DOCUMENT_PATH, "utf8");
    const matrix = parseCapabilityMatrix(bindingDocument);
    const result = admitExportsForBundle(
      matrix,
      ["brownian_frames", "philox_normals", "diffusion1d_frames"],
      BUNDLE_ID,
    );
    assert.equal(formatAdmissionFailures(result), null);
    assert.deepEqual(
      result.admitted.map((a) => a.export).sort(),
      ["brownian_frames", "diffusion1d_frames", "philox_normals"].sort(),
    );
  });

  it("heat_frames (present upstream, deliberately refused as an owner) is not admitted", () => {
    const bindingDocument = readFileSync(BINDING_DOCUMENT_PATH, "utf8");
    const matrix = parseCapabilityMatrix(bindingDocument);
    const result = admitExportsForBundle(matrix, ["heat_frames"], BUNDLE_ID);
    assert.deepEqual(result.admitted, []);
    assert.equal(result.failures[0]?.field, "releaseArtifact");
  });
});

describe("the gate reads the shared parser and holds no second admitted-set", () => {
  it("matrixGate.ts contains no second parse of the fenced capability-matrix block", () => {
    const source = readFileSync(MATRIX_GATE_SOURCE_PATH, "utf8");
    assert.equal(source.includes("```capability-matrix"), false);
    assert.equal(/extractCapabilityMatrixBlock|parseCapabilityMatrixBody/.test(source), false);
  });

  it("matrixGate.ts hard-codes no capability id from the real matrix", () => {
    const source = readFileSync(MATRIX_GATE_SOURCE_PATH, "utf8");
    const bindingDocument = readFileSync(BINDING_DOCUMENT_PATH, "utf8");
    const matrix = parseCapabilityMatrix(bindingDocument);
    for (const capabilityId of new Set(matrix.map((r) => r.capabilityId))) {
      assert.equal(source.includes(capabilityId), false);
    }
  });
});
