import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CAPABILITY_MATRIX_REQUIRED_KEYS,
  CapabilityMatrixParseError,
  extractCapabilityMatrixBlock,
  parseCapabilityMatrix,
  parseCapabilityMatrixBody,
} from "./capabilityMatrix.ts";

const BINDING_DOCUMENT_PATH = path.join(
  import.meta.dir,
  "..",
  "..",
  "docs",
  "FRANKENSIM_BINDING.md",
);

function readBindingDocument(): string {
  return readFileSync(BINDING_DOCUMENT_PATH, "utf8");
}

const FIXTURE_ROW = [
  "- capabilityId: diffusion.brownian-frames",
  '  family: "Diffusion and stochastic transport"',
  "  instrumentId: bm-01",
  "  upstreamStatus: new-upstream",
  '  owner: "fs_wasm::brownian_frames"',
  '  nativeTestTarget: "none"',
  "  browserExport: brownian_frames",
  '  admittedDomain: "n_particles in 1..10000"',
  '  sourceReference: "paper brownian-motion"',
  "  releaseArtifact: fs-annus-diffusion",
  "  acceptanceState: owner-decided",
].join("\n");

const FIXTURE_ORPHAN_ROW = [
  "- capabilityId: diffusion.heat-frames",
  '  family: "Diffusion and stochastic transport"',
  "  instrumentId: none",
  "  upstreamStatus: present",
  '  owner: "fs_wasm::heat_frames"',
  '  nativeTestTarget: "none"',
  "  browserExport: heat_frames",
  '  admittedDomain: "not admitted"',
  '  sourceReference: "crates/fs-wasm/src/lib.rs:252"',
  "  releaseArtifact: none",
  "  acceptanceState: owner-decided",
  '  reason: "heat_frames is not an honest owner for any diffusion instrument."',
].join("\n");

describe("extractCapabilityMatrixBlock", () => {
  test("extracts the body between the fences, exclusive", () => {
    const doc = `intro\n\`\`\`capability-matrix\n${FIXTURE_ROW}\n\`\`\`\noutro`;
    const block = extractCapabilityMatrixBlock(doc);
    expect(block).toBe(FIXTURE_ROW);
    expect(block).not.toContain("```");
  });

  test("refuses when the opening fence is missing", () => {
    expect(() => extractCapabilityMatrixBlock("no fence here")).toThrow(CapabilityMatrixParseError);
  });

  test("refuses when the closing fence is missing", () => {
    expect(() => extractCapabilityMatrixBlock(`\`\`\`capability-matrix\n${FIXTURE_ROW}\n`)).toThrow(
      CapabilityMatrixParseError,
    );
  });
});

describe("parseCapabilityMatrixBody", () => {
  test("parses one row into a fully typed record", () => {
    const rows = parseCapabilityMatrixBody(FIXTURE_ROW);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      capabilityId: "diffusion.brownian-frames",
      family: "Diffusion and stochastic transport",
      instrumentId: "bm-01",
      upstreamStatus: "new-upstream",
      owner: "fs_wasm::brownian_frames",
      nativeTestTarget: "none",
      browserExport: "brownian_frames",
      admittedDomain: "n_particles in 1..10000",
      sourceReference: "paper brownian-motion",
      releaseArtifact: "fs-annus-diffusion",
      acceptanceState: "owner-decided",
    });
  });

  test("parses multiple rows in sequence", () => {
    const rows = parseCapabilityMatrixBody(`${FIXTURE_ROW}\n${FIXTURE_ORPHAN_ROW}`);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.capabilityId)).toEqual([
      "diffusion.brownian-frames",
      "diffusion.heat-frames",
    ]);
  });

  test("carries reason only for instrumentId: none rows", () => {
    const rows = parseCapabilityMatrixBody(FIXTURE_ORPHAN_ROW);
    expect(rows[0]?.instrumentId).toBe("none");
    expect(rows[0]?.reason).toBe(
      "heat_frames is not an honest owner for any diffusion instrument.",
    );
  });

  test("refuses instrumentId: none without a reason", () => {
    const malformed = FIXTURE_ORPHAN_ROW.split("\n")
      .filter((line) => !line.trim().startsWith("reason:"))
      .join("\n");
    expect(() => parseCapabilityMatrixBody(malformed)).toThrow(CapabilityMatrixParseError);
  });

  test("refuses a reason field when instrumentId is not none", () => {
    const malformed = `${FIXTURE_ROW}\n  reason: "should not be here"`;
    expect(() => parseCapabilityMatrixBody(malformed)).toThrow(CapabilityMatrixParseError);
  });

  test("refuses a row missing a required key", () => {
    const malformed = FIXTURE_ROW.split("\n")
      .filter((line) => !line.trim().startsWith("acceptanceState:"))
      .join("\n");
    expect(() => parseCapabilityMatrixBody(malformed)).toThrow(CapabilityMatrixParseError);
  });

  test("refuses a duplicate key within one row", () => {
    const malformed = `${FIXTURE_ROW}\n  owner: "fs_wasm::duplicate"`;
    expect(() => parseCapabilityMatrixBody(malformed)).toThrow(CapabilityMatrixParseError);
  });

  test("refuses an unexpected key", () => {
    const malformed = `${FIXTURE_ROW}\n  extraColumn: "not part of the schema"`;
    expect(() => parseCapabilityMatrixBody(malformed)).toThrow(CapabilityMatrixParseError);
  });

  test("refuses a line that is neither a row start nor a continuation", () => {
    expect(() => parseCapabilityMatrixBody("not a valid line at all")).toThrow(
      CapabilityMatrixParseError,
    );
  });

  test("refuses a continuation line before any row has started", () => {
    expect(() => parseCapabilityMatrixBody('  family: "orphaned continuation"')).toThrow(
      CapabilityMatrixParseError,
    );
  });

  test("unquotes a JSON-style double-quoted scalar, preserving embedded colons", () => {
    const rows = parseCapabilityMatrixBody(FIXTURE_ROW);
    expect(rows[0]?.owner).toBe("fs_wasm::brownian_frames");
  });

  test("an empty body parses to zero rows", () => {
    expect(parseCapabilityMatrixBody("")).toEqual([]);
    expect(parseCapabilityMatrixBody("\n\n")).toEqual([]);
  });
});

describe("parseCapabilityMatrix against the real binding document", () => {
  test("parses without throwing and recovers the documented row count", () => {
    const rows = parseCapabilityMatrix(readBindingDocument());
    // docs/FRANKENSIM_BINDING.md "Summary counts" states 41 rows; recomputed here from
    // the fenced block itself, not copied from that paragraph.
    expect(rows).toHaveLength(41);
  });

  test("every row carries exactly the required keys, plus reason only when instrumentId is none", () => {
    const rows = parseCapabilityMatrix(readBindingDocument());
    for (const row of rows) {
      const keys = Object.keys(row).filter((key) => key !== "reason");
      expect(new Set(keys)).toEqual(new Set(CAPABILITY_MATRIX_REQUIRED_KEYS));
      if (row.instrumentId === "none") {
        expect(typeof row.reason).toBe("string");
      } else {
        expect(row.reason).toBeUndefined();
      }
    }
  });

  test("the three first-export capabilities are present with fs-annus-diffusion", () => {
    const rows = parseCapabilityMatrix(readBindingDocument());
    const byExport = new Map(
      rows
        .filter((r) => r.releaseArtifact === "fs-annus-diffusion")
        .map((r) => [r.browserExport, r]),
    );
    expect(byExport.has("brownian_frames")).toBe(true);
    expect(byExport.has("philox_normals")).toBe(true);
    expect(byExport.has("diffusion1d_frames")).toBe(true);
    for (const row of byExport.values()) {
      expect(row.acceptanceState).not.toBe("not-started");
    }
  });

  test("the four documented orphan rows (instrumentId: none) exist and carry a reason", () => {
    const rows = parseCapabilityMatrix(readBindingDocument());
    const orphans = rows.filter((row) => row.instrumentId === "none");
    expect(orphans).toHaveLength(4);
    for (const row of orphans) {
      expect(row.releaseArtifact).toBe("none");
      expect(typeof row.reason).toBe("string");
      expect((row.reason ?? "").length).toBeGreaterThan(0);
    }
  });

  test("no row claims acceptanceState verified, adopted, or not-started (matches the audit's own summary)", () => {
    const rows = parseCapabilityMatrix(readBindingDocument());
    for (const row of rows) {
      expect(["verified", "adopted", "not-started"]).not.toContain(row.acceptanceState);
    }
  });
});
