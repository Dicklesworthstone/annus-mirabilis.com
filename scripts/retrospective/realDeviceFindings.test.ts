import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  type DecisionFindingRow,
  parseDecisionsFindingsTable,
  parseRealDeviceRecords,
  type RealDeviceFinding,
  verifyRealDeviceFindings,
} from "./realDeviceFindings.ts";

describe("Real-Device Findings Gate", () => {
  it("verifies all architecture-relevant findings in docs/testing/real-device appear in the retrospective decision record", () => {
    const recordsDir = path.resolve(process.cwd(), "docs/testing/real-device");
    const docPath = path.resolve(process.cwd(), "docs/decisions/batch-b-retrospective.md");

    assert.equal(fs.existsSync(recordsDir), true, "docs/testing/real-device directory must exist");
    assert.equal(
      fs.existsSync(docPath),
      true,
      "docs/decisions/batch-b-retrospective.md must exist",
    );

    const findings = parseRealDeviceRecords(recordsDir);
    assert.equal(
      findings.length >= 4,
      true,
      `Expected at least 4 findings, got ${findings.length}`,
    );

    const docContent = fs.readFileSync(docPath, "utf8");
    const decisions = parseDecisionsFindingsTable(docContent);
    assert.equal(
      decisions.length >= 4,
      true,
      `Expected at least 4 decision rows, got ${decisions.length}`,
    );

    const result = verifyRealDeviceFindings(findings, decisions);
    assert.equal(
      result.verified,
      true,
      `Real-device verification failed: missing decisions: ${result.missingDecisions.join(", ")}, phantom findings: ${result.phantomFindings.join(", ")}`,
    );

    // Write structured log
    const logDir = path.resolve(process.cwd(), "artifacts/test-logs/retrospective-findings");
    fs.mkdirSync(logDir, { recursive: true });
    const logRunId = `findings-run-${Date.now()}`;
    const logFile = path.join(logDir, `${logRunId}.jsonl`);

    const logEntries = decisions.map((d) => ({
      timestamp: new Date().toISOString(),
      suite: "retrospective-findings",
      logRunId,
      testId: "real-device-findings-verification",
      beadId: "am-bm-slice-retrospective-pp09",
      findingId: d.findingId,
      device: d.device,
      decision: d.decision,
      outcome: "pass",
      message: `Verified architecture decision for ${d.findingId}`,
    }));

    fs.writeFileSync(logFile, `${logEntries.map((e) => JSON.stringify(e)).join("\n")}\n`);
    assert.equal(fs.existsSync(logFile), true);
  });

  it("fails when an architecture-relevant finding has no recorded decision and correctly identifies it", () => {
    const findings: RealDeviceFinding[] = [
      {
        findingId: "FINDING-RD-99",
        device: "test-device",
        sourceFile: "test.md",
        tag: "architecture-relevant",
        area: "Storage",
        observation: "Unbounded IndexedDB growth",
      },
    ];
    const decisions: DecisionFindingRow[] = [];

    const result = verifyRealDeviceFindings(findings, decisions);
    assert.equal(result.verified, false);
    assert.equal(result.missingDecisions.includes("FINDING-RD-99"), true);
  });

  it("fails when a decision references a phantom finding ID and correctly identifies it", () => {
    const findings: RealDeviceFinding[] = [];
    const decisions: DecisionFindingRow[] = [
      {
        findingId: "FINDING-PHANTOM-01",
        device: "phantom-device",
        sourceRecord: "nowhere.md",
        decision: "Imaginary fix",
      },
    ];

    const result = verifyRealDeviceFindings(findings, decisions);
    assert.equal(result.verified, false);
    assert.equal(result.phantomFindings.includes("FINDING-PHANTOM-01"), true);
  });
});
