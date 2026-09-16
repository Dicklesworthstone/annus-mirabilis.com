/**
 * Content Compiler Plugin for Coverage Ledger.
 *
 * Registers with check family 'coverage' to validate argument node treatment,
 * shared instrument correspondence, and central inference coverage.
 *
 * Spec: AGENTS.md §10.4 and am-cm-coverage-ledger-0ip
 */

import { registerCheck } from "../compiler/checks/registry.ts";
import { validateCoverageLedger } from "./ledger.ts";
import type { ArgumentNodeCoverage } from "./types.ts";

export const COVERAGE_CHECK_ID = "coverage-ledger-validator";

export function registerCoverageCheck(): void {
  registerCheck({
    id: COVERAGE_CHECK_ID,
    family: "coverage",
    severity: "error",
    beadId: "am-cm-coverage-ledger-0ip",
    description:
      "Validates coverage ledger rules: omitted reasons, shared instrument notes, central inference coverage.",
    run: (context) => {
      const argumentNodes: ArgumentNodeCoverage[] = [];

      for (const [_key, value] of context.records.entries()) {
        if (value && typeof value === "object") {
          const rec = value as Record<string, unknown>;
          if (
            rec.kind === "argument-node" ||
            (typeof rec.paper === "string" && typeof rec.section === "string" && rec.treatment)
          ) {
            argumentNodes.push(rec as unknown as ArgumentNodeCoverage);
          }
        }
      }

      const diagnostics = validateCoverageLedger({ argumentNodes });
      for (const diag of diagnostics) {
        context.report({
          recordId: diag.argumentId ?? diag.paper ?? "coverage-ledger",
          rule: diag.rule,
          message: diag.message,
          repair: diag.repair,
        });
      }
    },
  });
}

// Auto-register on import
registerCoverageCheck();
