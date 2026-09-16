import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  type CapabilityMatrixRow,
  parseCapabilityMatrix,
} from "./wasm-artifacts/capabilityMatrix.ts";
import { admitExportsForBundle, formatAdmissionFailures } from "./wasm-artifacts/matrixGate.ts";

const BUNDLE_ID = "fs-annus-diffusion";
const BINDING_DOCUMENT_PATH = path.join(import.meta.dir, "..", "docs", "FRANKENSIM_BINDING.md");
const MATRIX_GATE_SOURCE_PATH = path.join(import.meta.dir, "wasm-artifacts", "matrixGate.ts");

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
  test("a matrix whose three export rows name this bundle at owner-decided admits all three", () => {
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
    expect(result.failures).toEqual([]);
    expect(result.admitted.map((a) => a.export).sort()).toEqual(
      ["brownian_frames", "diffusion1d_frames", "philox_normals"].sort(),
    );
  });

  test("a row whose releaseArtifact is none excludes that export, naming the export and the field", () => {
    const matrix: CapabilityMatrixRow[] = [
      row({
        capabilityId: "diffusion.heat-frames",
        browserExport: "heat_frames",
        releaseArtifact: "none",
      }),
    ];
    const result = admitExportsForBundle(matrix, ["heat_frames"], BUNDLE_ID);
    expect(result.admitted).toEqual([]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({ export: "heat_frames", field: "releaseArtifact" });
    expect(formatAdmissionFailures(result)).toContain("heat_frames");
    expect(formatAdmissionFailures(result)).toContain("releaseArtifact");
  });

  test("a row naming a different bundle fails the same way", () => {
    const matrix: CapabilityMatrixRow[] = [
      row({
        capabilityId: "radiation.some-other-bundle",
        browserExport: "planck_frames",
        releaseArtifact: "fs-annus-radiation",
      }),
    ];
    const result = admitExportsForBundle(matrix, ["planck_frames"], BUNDLE_ID);
    expect(result.admitted).toEqual([]);
    expect(result.failures[0]).toMatchObject({ export: "planck_frames", field: "releaseArtifact" });
    expect(result.failures[0]?.message).toContain("fs-annus-radiation");
  });

  test("a row at acceptanceState: not-started is refused even when releaseArtifact names this bundle", () => {
    const matrix: CapabilityMatrixRow[] = [
      row({
        capabilityId: "diffusion.brownian-frames",
        browserExport: "brownian_frames",
        acceptanceState: "not-started",
      }),
    ];
    const result = admitExportsForBundle(matrix, ["brownian_frames"], BUNDLE_ID);
    expect(result.admitted).toEqual([]);
    expect(result.failures[0]).toMatchObject({
      export: "brownian_frames",
      field: "acceptanceState",
    });
    expect(result.failures[0]?.message).toContain("not-started");
  });

  test("an export with no row at all fails naming the export", () => {
    const result = admitExportsForBundle([], ["philox_normals"], BUNDLE_ID);
    expect(result.admitted).toEqual([]);
    expect(result.failures[0]).toMatchObject({ export: "philox_normals", field: "missing-row" });
  });

  test("rows for the same export that disagree with each other are refused, not resolved by picking one", () => {
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
    expect(result.admitted).toEqual([]);
    expect(result.failures[0]).toMatchObject({
      export: "brownian_frames",
      field: "inconsistent-rows",
    });
  });

  test("consistent multi-row exports (two instruments, one capability) admit normally", () => {
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
    expect(result.failures).toEqual([]);
    expect(result.admitted[0]?.rows).toHaveLength(2);
  });
});

describe("admitExportsForBundle against the real capability matrix", () => {
  test("brownian_frames, philox_normals, and diffusion1d_frames are all admitted for fs-annus-diffusion", () => {
    const bindingDocument = readFileSync(BINDING_DOCUMENT_PATH, "utf8");
    const matrix = parseCapabilityMatrix(bindingDocument);
    const result = admitExportsForBundle(
      matrix,
      ["brownian_frames", "philox_normals", "diffusion1d_frames"],
      BUNDLE_ID,
    );
    expect(formatAdmissionFailures(result)).toBeNull();
    expect(result.admitted.map((a) => a.export).sort()).toEqual(
      ["brownian_frames", "diffusion1d_frames", "philox_normals"].sort(),
    );
  });

  test("heat_frames (present upstream, deliberately refused as an owner) is not admitted", () => {
    const bindingDocument = readFileSync(BINDING_DOCUMENT_PATH, "utf8");
    const matrix = parseCapabilityMatrix(bindingDocument);
    const result = admitExportsForBundle(matrix, ["heat_frames"], BUNDLE_ID);
    expect(result.admitted).toEqual([]);
    expect(result.failures[0]?.field).toBe("releaseArtifact");
  });
});

describe("the gate reads the shared parser and holds no second admitted-set", () => {
  test("matrixGate.ts contains no second parse of the fenced capability-matrix block", () => {
    const source = readFileSync(MATRIX_GATE_SOURCE_PATH, "utf8");
    expect(source).not.toContain("```capability-matrix");
    expect(source).not.toMatch(/extractCapabilityMatrixBlock|parseCapabilityMatrixBody/);
  });

  test("matrixGate.ts hard-codes no capability id from the real matrix", () => {
    const source = readFileSync(MATRIX_GATE_SOURCE_PATH, "utf8");
    const bindingDocument = readFileSync(BINDING_DOCUMENT_PATH, "utf8");
    const matrix = parseCapabilityMatrix(bindingDocument);
    for (const capabilityId of new Set(matrix.map((r) => r.capabilityId))) {
      expect(source).not.toContain(capabilityId);
    }
  });
});
