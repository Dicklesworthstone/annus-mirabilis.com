/**
 * Structured Logging and Evidence Retention for License Inventory.
 * Bead: am-gov-license-inventory-w6yz
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateLogRunId } from "../app-router-architecture.ts";
import type { EvaluatedItem, LicenseItemKind, PolicyViolation } from "./types.ts";

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
  const baseLogsDir = options?.logsDir || join(rootDir, "artifacts", "test-logs", "license-inventory");
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
    rule: "inventory-complete",
    outcome: errors.length === 0 ? "passed" : "failed",
    message: errors.length === 0 ? "All license checks passed." : `${errors.length} license policy violation(s) found.`,
    extra: {
      totalItems: evaluatedItems.length,
      violations: errors.length,
      byKind,
    },
  };

  lines.push(JSON.stringify(summaryEvent));
  writeFileSync(logPath, lines.join("\n") + "\n", "utf8");

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
