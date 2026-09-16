import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { TAPE_VERSION } from "../../experiments/tapes/schema.ts";
import { STREAM_SEMANTICS_VERSION } from "../../physics/reference/philox.ts";
import { WEAVE_PREDICATE_VERSION } from "../../reader/weave/predicates.ts";
import { WORKER_PROTOCOL_VERSION } from "../../workers/transport.ts";
import { RECEIPT_FORMAT_VERSION } from "../provenance/receiptSchema.ts";
import { ARGUMENT_SCHEMA_VERSION } from "./argument.ts";
import { EXPERIMENT_SCHEMA_VERSION } from "./experiment.ts";
import { EQUATION_SCHEMA_VERSION } from "./meanings.ts";
import { READING_SCHEMA_VERSION } from "./reading.ts";
import { REVIEW_SCHEMA_VERSION } from "./review.ts";
import { SOURCE_SCHEMA_VERSION } from "./source.ts";

export interface FreezeTableRow {
  format: string;
  versionConstant: string;
  file: string;
  ownerBead: string;
  changePolicy: string;
}

export function parseFreezeTable(markdown: string): FreezeTableRow[] {
  const lines = markdown.split("\n");
  const rows: FreezeTableRow[] = [];
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.startsWith("|") &&
      trimmed.includes("Format Name") &&
      trimmed.includes("Version Constant")
    ) {
      inTable = true;
      continue;
    }
    if (
      inTable &&
      trimmed.startsWith("|") &&
      (trimmed.includes("---|") || trimmed.includes("--- |"))
    ) {
      continue;
    }
    if (inTable && trimmed.startsWith("|")) {
      const cols = trimmed
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim().replace(/^`|`$/g, ""));
      if (cols.length >= 5) {
        rows.push({
          format: cols[0] ?? "",
          versionConstant: cols[1] ?? "",
          file: cols[2] ?? "",
          ownerBead: cols[3] ?? "",
          changePolicy: cols[4] ?? "",
        });
      }
    } else if (inTable && !trimmed.startsWith("|")) {
      inTable = false;
    }
  }

  return rows;
}

const CODE_VERSIONS: Record<string, number> = {
  "content-schemas-source": SOURCE_SCHEMA_VERSION,
  "content-schemas-argument": ARGUMENT_SCHEMA_VERSION,
  "content-schemas-experiment": EXPERIMENT_SCHEMA_VERSION,
  "reading-unit": READING_SCHEMA_VERSION,
  "equation-tree-and-derivation": EQUATION_SCHEMA_VERSION,
  "worker-protocol": WORKER_PROTOCOL_VERSION,
  "tape-format": TAPE_VERSION,
  "weave-predicate": WEAVE_PREDICATE_VERSION,
  "stream-allocation-registry": STREAM_SEMANTICS_VERSION,
  "receipt-format": RECEIPT_FORMAT_VERSION,
  "review-record": REVIEW_SCHEMA_VERSION,
};

export function verifyFreezeTable(rows: FreezeTableRow[]): {
  verified: boolean;
  mismatches: Array<{ format: string; inCode: number; inRecord: string }>;
} {
  const mismatches: Array<{ format: string; inCode: number; inRecord: string }> = [];

  for (const row of rows) {
    const inCode = CODE_VERSIONS[row.format];
    if (inCode === undefined) {
      mismatches.push({
        format: row.format,
        inCode: -1,
        inRecord: row.versionConstant,
      });
      continue;
    }

    // Extract number from string like "SOURCE_SCHEMA_VERSION = 1" or "1"
    const match = row.versionConstant.match(/=\s*(\d+)/) || row.versionConstant.match(/^(\d+)$/);
    const recordedVersion = match ? Number.parseInt(match[1] ?? "0", 10) : Number.NaN;

    if (inCode !== recordedVersion) {
      mismatches.push({
        format: row.format,
        inCode,
        inRecord: row.versionConstant,
      });
    }
  }

  return {
    verified: mismatches.length === 0,
    mismatches,
  };
}

describe("Freeze Table Gate", () => {
  it("parses the freeze table from batch-b-retrospective.md and verifies all version constants in code", () => {
    const docPath = path.resolve(process.cwd(), "docs/decisions/batch-b-retrospective.md");
    assert.equal(fs.existsSync(docPath), true, "batch-b-retrospective.md must exist");

    const content = fs.readFileSync(docPath, "utf8");
    const rows = parseFreezeTable(content);
    assert.equal(
      rows.length >= 11,
      true,
      `Expected at least 11 frozen formats, got ${rows.length}`,
    );

    const result = verifyFreezeTable(rows);
    assert.equal(
      result.verified,
      true,
      `Freeze table version mismatches: ${JSON.stringify(result.mismatches)}`,
    );

    // Write structured log
    const logDir = path.resolve(process.cwd(), "artifacts/test-logs/retrospective-freeze");
    fs.mkdirSync(logDir, { recursive: true });
    const logRunId = `freeze-run-${Date.now()}`;
    const logFile = path.join(logDir, `${logRunId}.jsonl`);

    const logEntries = rows.map((r) => ({
      timestamp: new Date().toISOString(),
      suite: "retrospective-freeze",
      logRunId,
      testId: "freeze-table-version-verification",
      beadId: "am-bm-slice-retrospective-pp09",
      format: r.format,
      versionInCode: CODE_VERSIONS[r.format],
      versionInRecord: r.versionConstant,
      outcome: "pass",
      message: `Verified version match for ${r.format}`,
    }));

    fs.writeFileSync(logFile, `${logEntries.map((e) => JSON.stringify(e)).join("\n")}\n`);
    assert.equal(fs.existsSync(logFile), true);
  });

  it("fails when a format version is mismatched and correctly identifies the format", () => {
    const fakeRows: FreezeTableRow[] = [
      {
        format: "tape-format",
        versionConstant: "TAPE_VERSION = 99", // Mismatched (real is 2)
        file: "src/experiments/tapes/schema.ts",
        ownerBead: "am-inst-tape-controls-3v3k",
        changePolicy: "Major version",
      },
    ];

    const result = verifyFreezeTable(fakeRows);
    assert.equal(result.verified, false);
    assert.equal(result.mismatches.length, 1);
    assert.equal(result.mismatches[0]?.format, "tape-format");
    assert.equal(result.mismatches[0]?.inCode, 2);
  });
});
