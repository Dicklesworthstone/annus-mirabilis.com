import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CAPABILITY_MATRIX_REQUIRED_KEYS,
  CapabilityMatrixParseError,
  extractCapabilityMatrixBlock,
  parseCapabilityMatrix,
  parseCapabilityMatrixBody,
} from "./capabilityMatrix.ts";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const BINDING_DOCUMENT_PATH = path.join(currentDir, "..", "..", "docs", "FRANKENSIM_BINDING.md");

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
  it("extracts the body between the fences, exclusive", () => {
    const doc = `intro\n\`\`\`capability-matrix\n${FIXTURE_ROW}\n\`\`\`\noutro`;
    const block = extractCapabilityMatrixBlock(doc);
    assert.equal(block, FIXTURE_ROW);
    assert.equal(block.includes("```"), false);
  });

  it("refuses when the opening fence is missing", () => {
    assert.throws(() => extractCapabilityMatrixBlock("no fence here"), CapabilityMatrixParseError);
  });

  it("refuses when the closing fence is missing", () => {
    assert.throws(
      () => extractCapabilityMatrixBlock(`\`\`\`capability-matrix\n${FIXTURE_ROW}\n`),
      CapabilityMatrixParseError,
    );
  });
});

describe("parseCapabilityMatrixBody", () => {
  it("parses one row into a fully typed record", () => {
    const rows = parseCapabilityMatrixBody(FIXTURE_ROW);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], {
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

  it("parses multiple rows in sequence", () => {
    const rows = parseCapabilityMatrixBody(`${FIXTURE_ROW}\n${FIXTURE_ORPHAN_ROW}`);
    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((row) => row.capabilityId),
      ["diffusion.brownian-frames", "diffusion.heat-frames"],
    );
  });

  it("carries reason only for instrumentId: none rows", () => {
    const rows = parseCapabilityMatrixBody(FIXTURE_ORPHAN_ROW);
    assert.equal(rows[0]?.instrumentId, "none");
    assert.equal(
      rows[0]?.reason,
      "heat_frames is not an honest owner for any diffusion instrument.",
    );
  });

  it("refuses instrumentId: none without a reason", () => {
    const malformed = FIXTURE_ORPHAN_ROW.split("\n")
      .filter((line) => !line.trim().startsWith("reason:"))
      .join("\n");
    assert.throws(() => parseCapabilityMatrixBody(malformed), CapabilityMatrixParseError);
  });

  it("refuses a reason field when instrumentId is not none", () => {
    const malformed = `${FIXTURE_ROW}\n  reason: "should not be here"`;
    assert.throws(() => parseCapabilityMatrixBody(malformed), CapabilityMatrixParseError);
  });

  it("refuses a row missing a required key", () => {
    const malformed = FIXTURE_ROW.split("\n")
      .filter((line) => !line.trim().startsWith("acceptanceState:"))
      .join("\n");
    assert.throws(() => parseCapabilityMatrixBody(malformed), CapabilityMatrixParseError);
  });

  it("refuses a duplicate key within one row", () => {
    const malformed = `${FIXTURE_ROW}\n  owner: "fs_wasm::duplicate"`;
    assert.throws(() => parseCapabilityMatrixBody(malformed), CapabilityMatrixParseError);
  });

  it("refuses an unexpected key", () => {
    const malformed = `${FIXTURE_ROW}\n  extraColumn: "not part of the schema"`;
    assert.throws(() => parseCapabilityMatrixBody(malformed), CapabilityMatrixParseError);
  });

  it("refuses a line that is neither a row start nor a continuation", () => {
    assert.throws(
      () => parseCapabilityMatrixBody("not a valid line at all"),
      CapabilityMatrixParseError,
    );
  });

  it("refuses a continuation line before any row has started", () => {
    assert.throws(
      () => parseCapabilityMatrixBody('  family: "orphaned continuation"'),
      CapabilityMatrixParseError,
    );
  });

  it("unquotes a JSON-style double-quoted scalar, preserving embedded colons", () => {
    const rows = parseCapabilityMatrixBody(FIXTURE_ROW);
    assert.equal(rows[0]?.owner, "fs_wasm::brownian_frames");
  });

  it("an empty body parses to zero rows", () => {
    assert.deepEqual(parseCapabilityMatrixBody(""), []);
    assert.deepEqual(parseCapabilityMatrixBody("\n\n"), []);
  });
});

describe("parseCapabilityMatrix against the real binding document", () => {
  it("parses without throwing and recovers the documented row count", () => {
    const rows = parseCapabilityMatrix(readBindingDocument());
    // docs/FRANKENSIM_BINDING.md "Summary counts" states 41 rows; recomputed here from
    // the fenced block itself, not copied from that paragraph.
    assert.equal(rows.length, 41);
  });

  it("every row carries exactly the required keys, plus reason only when instrumentId is none", () => {
    const rows = parseCapabilityMatrix(readBindingDocument());
    for (const row of rows) {
      const keys = Object.keys(row).filter((key) => key !== "reason");
      assert.deepEqual(new Set(keys), new Set(CAPABILITY_MATRIX_REQUIRED_KEYS));
      if (row.instrumentId === "none") {
        assert.equal(typeof row.reason, "string");
      } else {
        assert.equal(row.reason, undefined);
      }
    }
  });

  it("the three first-export capabilities are present with fs-annus-diffusion", () => {
    const rows = parseCapabilityMatrix(readBindingDocument());
    const byExport = new Map(
      rows
        .filter((r) => r.releaseArtifact === "fs-annus-diffusion")
        .map((r) => [r.browserExport, r]),
    );
    assert.equal(byExport.has("brownian_frames"), true);
    assert.equal(byExport.has("philox_normals"), true);
    assert.equal(byExport.has("diffusion1d_frames"), true);
    for (const row of byExport.values()) {
      assert.notEqual(row.acceptanceState, "not-started");
    }
  });

  it("the four documented orphan rows (instrumentId: none) exist and carry a reason", () => {
    const rows = parseCapabilityMatrix(readBindingDocument());
    const orphans = rows.filter((row) => row.instrumentId === "none");
    assert.equal(orphans.length, 4);
    for (const row of orphans) {
      assert.equal(row.releaseArtifact, "none");
      assert.equal(typeof row.reason, "string");
      assert.ok((row.reason ?? "").length > 0);
    }
  });

  it("no row claims acceptanceState verified, adopted, or not-started (matches the audit's own summary)", () => {
    const rows = parseCapabilityMatrix(readBindingDocument());
    for (const row of rows) {
      assert.equal(["verified", "adopted", "not-started"].includes(row.acceptanceState), false);
    }
  });
});
