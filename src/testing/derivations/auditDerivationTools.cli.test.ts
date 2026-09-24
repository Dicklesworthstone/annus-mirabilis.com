import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { loadShippedChains, runAuditCli } from "../../../scripts/audit-derivation-tools.ts";

/**
 * The audit reads the chains a reader is shown (content/equations/derivations) by default, and the
 * five fixture chains only with --fixtures. Until 2026-09-24 it read only the fixtures, so its
 * "Pending Tool: 0" described test data while the one shipped chain's four steps had no tool.
 */

const shipped = loadShippedChains();
const shippedIds = new Set(shipped.map((c) => c.id));
const shippedSteps = shipped.reduce((n, c) => n + c.steps.length, 0);

test("auditDerivationTools CLI: reads the shipped chains, and only them by default", () => {
  // Non-vacuity: the population the criterion is about is not empty.
  assert.ok(shipped.length > 0);
  assert.ok(shippedIds.has("chain-bm-variance-of-sum"));
  const result = runAuditCli([]);
  assert.equal(result.exitCode, 0);
  assert.equal(result.report.totalSteps, shippedSteps, "no fixture pads the default count");
  assert.ok(existsSync(result.reportPath));
  const content = readFileSync(result.reportPath, "utf8");
  assert.ok(content.includes(result.toolRunId));
});

test("auditDerivationTools CLI: every shipped step is listed, pending exactly when it has no tool", () => {
  const result = runAuditCli([]);
  const pending = new Set(result.report.pending.map((p) => `${p.chainId}::${p.stepId}`));
  const rows = readFileSync(result.reportPath, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { status?: string; chainId?: string; stepId?: string });
  for (const chain of shipped)
    for (const step of chain.steps) {
      const key = `${chain.id}::${step.id}`;
      assert.equal(pending.has(key), !step.tool, `${key} is pending iff it has no tool`);
      assert.equal(
        rows.filter((r) => r.chainId === chain.id && r.stepId === step.id).length,
        1,
        `${key} appears once in the report`,
      );
    }
});

test("auditDerivationTools CLI: runs with filter --paper brownian-motion", () => {
  const result = runAuditCli(["--paper", "bm"]);
  assert.equal(result.exitCode, 0);
  assert.ok(result.report.totalSteps > 0);
  for (const p of result.report.pending) {
    assert.ok(p.chainId.includes("bm"));
  }
});

test("auditDerivationTools CLI: with the fixtures, every fixture tool resolves in the canonical registry", () => {
  const result = runAuditCli(["--fixtures", "--registry", "content/foundations/registry.yaml"]);
  assert.equal(result.exitCode, 0);
  assert.equal(result.report.errors.length, 0);
  assert.ok(result.report.totalSteps > shippedSteps, "the fixtures were read");
  // Anything pending is a shipped step still waiting for its tool, never a fixture step.
  for (const p of result.report.pending) assert.ok(shippedIds.has(p.chainId), p.chainId);
  assert.equal(result.report.validSteps + result.report.pending.length, result.report.totalSteps);
});

test("auditDerivationTools CLI: exits non-zero when tool fails to resolve against empty registry", () => {
  // A non-existent registry path defaults to an empty registry; the fixtures carry tools to fail.
  const result = runAuditCli(["--fixtures", "--registry", "content/foundations/nonexistent.yaml"]);
  assert.equal(result.exitCode, 1);
  assert.ok(result.report.errors.length > 0);
  assert.match(result.report.errors[0]?.reason ?? "", /does not resolve in foundation registry/);
});
