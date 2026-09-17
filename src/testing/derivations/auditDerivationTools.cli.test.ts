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

test("auditDerivationTools CLI: resolves cleanly with canonical registry", () => {
  const result = runAuditCli(["--registry", "content/foundations/registry.yaml"]);
  assert.equal(result.exitCode, 0);
  assert.equal(result.report.pending.length, 0);
  assert.equal(result.report.errors.length, 0);
  assert.equal(result.report.validSteps, result.report.totalSteps);
});

test("auditDerivationTools CLI: exits non-zero when tool fails to resolve against empty registry", () => {
  // A non-existent registry path defaults to empty registrySet, causing errors
  const result = runAuditCli(["--registry", "content/foundations/nonexistent.yaml"]);
  assert.equal(result.exitCode, 1);
  assert.ok(result.report.errors.length > 0);
  assert.match(result.report.errors[0]?.reason ?? "", /does not resolve in foundation registry/);
});
