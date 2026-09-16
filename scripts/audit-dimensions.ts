#!/usr/bin/env node
/**
 * CLI script to audit rational-exponent dimensional consistency across paper equations.
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md (§17.3, §17.7).
 * Epic: am-ep-content-model-9e3
 * Bead: am-cm-dimension-validator-aoz
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { checkDimensions, type DimensionCheckResult } from "../src/content/dimensions/check.ts";
import { dimensionText } from "../src/content/dimensions/rational.ts";
import type {
  QuantityDescriptor,
  UnitSystemContext,
} from "../src/content/dimensions/unitSystems.ts";
import { newRunIdentity, TestLogger } from "../src/testing/log/logger.ts";

export interface EquationAuditEntry {
  readonly id: string;
  readonly paper: string;
  readonly unitSystem?: UnitSystemContext;
  readonly tree: any;
  readonly quantities: Record<string, QuantityDescriptor>;
}

export interface DimensionAuditSummary {
  readonly total: number;
  readonly consistent: number;
  readonly inconsistent: number;
  readonly semanticMismatch: number;
  readonly unsupportedCheck: number;
  readonly ok: boolean;
  readonly paperCounts: Record<string, Record<string, number>>;
}

export async function runDimensionAudit(
  entries: readonly EquationAuditEntry[],
  logRunId: string = newRunIdentity(),
): Promise<DimensionAuditSummary> {
  const logger = new TestLogger("audit-dimensions", logRunId);

  let consistent = 0;
  let inconsistent = 0;
  let semanticMismatch = 0;
  let unsupportedCheck = 0;

  const paperCounts: Record<string, Record<string, number>> = {};

  for (const entry of entries) {
    const unitSystem = entry.unitSystem ?? "si";
    const result: DimensionCheckResult = checkDimensions(entry.tree, entry.quantities, {
      context: unitSystem,
    });

    if (!paperCounts[entry.paper]) {
      paperCounts[entry.paper] = {
        consistent: 0,
        inconsistent: 0,
        "semantic-mismatch": 0,
        "unsupported-check": 0,
      };
    }
    paperCounts[entry.paper]![result.status] = (paperCounts[entry.paper]![result.status] ?? 0) + 1;

    let lhsDimText: string | undefined;
    let rhsDimText: string | undefined;

    if (result.status === "consistent") {
      consistent++;
      lhsDimText = dimensionText(result.dimension);
    } else if (result.status === "inconsistent") {
      inconsistent++;
      if (result.lhsDimension) lhsDimText = dimensionText(result.lhsDimension);
      if (result.rhsDimension) rhsDimText = dimensionText(result.rhsDimension);
    } else if (result.status === "semantic-mismatch") {
      semanticMismatch++;
    } else if (result.status === "unsupported-check") {
      unsupportedCheck++;
    }

    logger.log({
      testId: entry.id,
      beadId: "am-cm-dimension-validator-aoz",
      paper: entry.paper,
      outcome:
        result.status === "consistent"
          ? "passed"
          : result.status === "unsupported-check"
            ? "skipped"
            : "failed",
      message: result.status === "consistent" ? "Dimensionally consistent" : result.reason,
      extra: {
        equationId: entry.id,
        paper: entry.paper,
        unitSystem,
        status: result.status,
        lhsDimension: lhsDimText,
        rhsDimension: rhsDimText,
        subexpression:
          result.status === "inconsistent" || result.status === "semantic-mismatch"
            ? result.subexpression
            : undefined,
        semanticKinds: result.status === "semantic-mismatch" ? result.kinds : undefined,
        reason: result.status !== "consistent" ? result.reason : undefined,
      },
    });
  }

  // Summary log
  logger.log({
    testId: "audit-summary",
    beadId: "am-cm-dimension-validator-aoz",
    outcome: inconsistent === 0 && semanticMismatch === 0 ? "passed" : "failed",
    message: `Dimension audit completed: ${consistent} consistent, ${unsupportedCheck} unsupported-check, ${inconsistent} inconsistent, ${semanticMismatch} semantic-mismatch`,
    extra: {
      total: entries.length,
      consistent,
      unsupportedCheck,
      inconsistent,
      semanticMismatch,
      paperCounts,
    },
  });

  await logger.flush();

  const ok = inconsistent === 0 && semanticMismatch === 0;

  return {
    total: entries.length,
    consistent,
    inconsistent,
    semanticMismatch,
    unsupportedCheck,
    ok,
    paperCounts,
  };
}

// CLI Execution
if (process.argv[1]?.endsWith("audit-dimensions.ts")) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      corpus: { type: "string" },
    },
    allowPositionals: true,
  });

  let entries: EquationAuditEntry[] = [];
  if (values.corpus && existsSync(values.corpus)) {
    const raw = readFileSync(values.corpus, "utf8");
    entries = JSON.parse(raw);
  }

  runDimensionAudit(entries)
    .then((summary) => {
      console.log(
        `Dimension audit: ${summary.total} total (${summary.consistent} consistent, ${summary.unsupportedCheck} review flags, ${summary.inconsistent} errors, ${summary.semanticMismatch} semantic mismatches)`,
      );
      if (!summary.ok) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    })
    .catch((err) => {
      console.error("audit-dimensions failed:", err);
      process.exit(1);
    });
}
