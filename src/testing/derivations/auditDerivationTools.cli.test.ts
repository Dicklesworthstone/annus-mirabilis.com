import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { runAuditCli } from "../../../scripts/audit-derivation-tools.ts";

test("auditDerivationTools CLI: runs without registry and exits 0", () => {
  const result = runAuditCli([]);
  assert.equal(result.exitCode, 0);
  assert.ok(result.report.totalSteps > 0);
  assert.ok(existsSync(result.reportPath));

  const content = readFileSync(result.reportPath, "utf8");
  assert.ok(content.includes(result.toolRunId));
});

test("auditDerivationTools CLI: runs with filter --paper brownian-motion", () => {
  const result = runAuditCli(["--paper", "bm"]);
  assert.equal(result.exitCode, 0);
  assert.ok(result.report.totalSteps > 0);
  for (const p of result.report.pending) {
    assert.ok(p.chainId.includes("bm"));
  }
});
