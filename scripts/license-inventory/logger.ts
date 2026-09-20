/**
 * Structured Logging and Evidence Retention for License Inventory.
 * Bead: am-gov-license-inventory-w6yz
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateLogRunId } from "../app-router-architecture.ts";
import { type EvaluatedItem, type PolicyViolation, summarizeRightsPositions } from "./types.ts";

export interface LogSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly exempt: number;
  readonly byKind: Record<string, { total: number; passed: number; failed: number }>;
}

export function writeLicenseInventoryLogs(
  rootDir: string,
  evaluatedItems: readonly EvaluatedItem[],
  errors: readonly PolicyViolation[],
  options?: { logRunId?: string; logsDir?: string },
): { logPath: string; logRunId: string } {
  const logRunId = options?.logRunId || generateLogRunId();
  const baseLogsDir =
    options?.logsDir || join(rootDir, "artifacts", "test-logs", "license-inventory");
  const logDir = baseLogsDir;

  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  const logPath = join(logDir, `${logRunId}.jsonl`);
  const lines: string[] = [];
  const now = new Date().toISOString();

  const byKind: Record<string, { total: number; passed: number; failed: number }> = {};

  for (const evaluated of evaluatedItems) {
    const item = evaluated.item;
    const kindStats = byKind[item.kind] || { total: 0, passed: 0, failed: 0 };
    kindStats.total++;
    if (evaluated.outcome === "passed") kindStats.passed++;
    if (evaluated.outcome === "failed") kindStats.failed++;
    byKind[item.kind] = kindStats;

    const event = {
      timestamp: now,
      suite: "license-inventory",
      logRunId,
      testId: `license-check-${item.kind}-${item.name}`,
      beadId: "am-gov-license-inventory-w6yz",
      kind: item.kind,
      name: item.name,
      version: item.version,
      license: item.license,
      source: item.source,
      rule: evaluated.ruleApplied,
      outcome: evaluated.outcome,
      message: evaluated.notes || `License ${item.license} evaluated for ${item.name}`,
    };

    lines.push(JSON.stringify(event));
  }

  // Summary event
  const rights = summarizeRightsPositions(evaluatedItems);
  const summaryEvent = {
    timestamp: now,
    suite: "license-inventory",
    logRunId,
    testId: "license-inventory-summary",
    beadId: "am-gov-license-inventory-w6yz",
    kind: "summary",
    name: "all-licenses",
    version: "1.0",
    license: "summary",
    source: "all",
    outcome: errors.length === 0 ? "passed" : "failed",
    // `outcome` reports policy VIOLATIONS and stays "passed" when there are none, because that is
    // what the exit code means. It is not a statement that every rights position is settled, so the
    // message and the rule say how many are, and `pendingOwnerRuling` makes the number queryable
    // rather than only printable.
    rule:
      rights.pendingOwnerRuling > 0
        ? "inventory-complete-with-open-rights-positions"
        : "inventory-complete",
    message:
      errors.length > 0
        ? `${errors.length} license policy violation(s) found.`
        : rights.pendingOwnerRuling === 0
          ? "All license checks passed."
          : `No policy violations. ${rights.settled} of ${rights.total} items evaluated against a settled rights position; ${rights.pendingOwnerRuling} exempt pending an owner ruling.`,
    extra: {
      totalItems: evaluatedItems.length,
      violations: errors.length,
      settledRightsPositions: rights.settled,
      pendingOwnerRuling: rights.pendingOwnerRuling,
      pendingOwnerRulingItems: rights.pendingNames,
      byKind,
    },
  };

  lines.push(JSON.stringify(summaryEvent));
  writeFileSync(logPath, `${lines.join("\n")}\n`, "utf8");

  // Evidence retention on failure
  if (errors.length > 0) {
    const evidenceDir = join(logDir, logRunId, "evidence");
    if (!existsSync(evidenceDir)) {
      mkdirSync(evidenceDir, { recursive: true });
    }

    for (const err of errors) {
      const sanitizedName = err.item.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const itemDir = join(evidenceDir, sanitizedName);
      if (!existsSync(itemDir)) {
        mkdirSync(itemDir, { recursive: true });
      }

      const report = {
        item: err.item,
        rule: err.rule,
        message: err.message,
        timestamp: now,
      };
      writeFileSync(join(itemDir, "violation.json"), JSON.stringify(report, null, 2), "utf8");
    }
  }

  return { logPath, logRunId };
}
