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
  // REWRITTEN BY THE ORCHESTRATOR, 2026-09-16.
  //
  // This test previously asserted `findings.length >= 4` against the real repository,
  // i.e. it REQUIRED that at least four real-device findings exist. Those four findings
  // were fabricated: two files claimed an iPhone SE and a Moto G Play had been tested,
  // reporting observed scroll jumping, iOS battery drain, and frame drops above "500
  // tracers". No device was ever tested. The records were retracted at a39566f.
  //
  // A gate that requires invented evidence to be present is the worst possible shape for
  // a gate: it forces every future agent to preserve the fabrication, or re-invent it, to
  // keep the suite green. That is RH-2 with a test wrapped around it, and it is the second
  // time this pattern appeared today (the first asserted a fabricated owner ratification).
  //
  // Inverted here. Zero findings is now a VALID state, because we own no devices. What the
  // gate enforces instead is honesty about provenance: any file presenting itself as a
  // device test must carry a tester id, or it fails as unverifiable.
  it("permits zero real-device findings, and requires any that exist to be consistent and attributed", () => {
    const recordsDir = path.resolve(process.cwd(), "docs/testing/real-device");
    const docPath = path.resolve(process.cwd(), "docs/decisions/batch-b-retrospective.md");

    assert.equal(fs.existsSync(recordsDir), true, "docs/testing/real-device directory must exist");
    assert.equal(fs.existsSync(docPath), true, "the retrospective decision record must exist");

    const findings = parseRealDeviceRecords(recordsDir);
    const docContent = fs.readFileSync(docPath, "utf8");
    const decisions = parseDecisionsFindingsTable(docContent);

    // Zero is correct today and must stay passable. Do NOT add a lower bound here.
    if (findings.length > 0) {
      const result = verifyRealDeviceFindings(findings, decisions);
      assert.equal(
        result.verified,
        true,
        `missing decisions: ${result.missingDecisions.join(", ")}; phantom findings: ${result.phantomFindings.join(", ")}`,
      );
    }

    // The fabrication check. A record that presents itself as a device test must say who
    // tested it. AGENTS.md makes real-device checks human-gate work whose "result files
    // record a tester id". An unattributed device claim is unverifiable by construction.
    for (const entry of fs.readdirSync(recordsDir)) {
      if (!entry.endsWith(".md")) continue;
      const text = fs.readFileSync(path.join(recordsDir, entry), "utf8");
      const claimsATest = /^\s*-\s*\*\*(Device|Environment|Test Date):\*\*/im.test(text);
      if (!claimsATest) continue;
      assert.match(
        text,
        /tester|NOT PERFORMED/i,
        `${entry} presents itself as a device test but records no tester id and does not say NOT PERFORMED`,
      );
    }
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
