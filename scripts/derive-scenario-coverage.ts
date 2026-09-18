#!/usr/bin/env bun
/**
 * Derives the built-versus-owed distinction for docs/SCENARIO_COVERAGE.md
 * directly from the scenario fixtures and definitions present in the repo.
 *
 * Usage:
 *   bun scripts/derive-scenario-coverage.ts         # updates docs/SCENARIO_COVERAGE.md
 *   bun scripts/derive-scenario-coverage.ts --check # verifies docs/SCENARIO_COVERAGE.md is up to date
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertScenarioCoverage,
  deriveScenarioCoverageMarkdown,
} from "../src/testing/scenario-registry/coverageDerivation.ts";

const ROOT = process.cwd();
const DOC_PATH = join(ROOT, "docs/SCENARIO_COVERAGE.md");

export function runDeriveScenarioCoverage(args = process.argv.slice(2)): number {
  const isCheck = args.includes("--check");
  const original = readFileSync(DOC_PATH, "utf8");
  const derived = deriveScenarioCoverageMarkdown(original, ROOT);

  if (isCheck) {
    try {
      const stats = assertScenarioCoverage(original, ROOT);
      if (original !== derived) {
        console.error(
          "❌ docs/SCENARIO_COVERAGE.md is out of sync with derived scenario coverage.",
        );
        console.error("Run `bun scripts/derive-scenario-coverage.ts` to update.");
        return 1;
      }
      console.log(
        `✔ Scenario coverage verified: ${stats.total} total (${stats.built} built, ${stats.owed} owed).`,
      );
      return 0;
    } catch (err) {
      console.error(
        `❌ Scenario coverage assertion failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 1;
    }
  }

  writeFileSync(DOC_PATH, derived, "utf8");
  const stats = assertScenarioCoverage(derived, ROOT);
  console.log(
    `✔ Derived docs/SCENARIO_COVERAGE.md: ${stats.total} scenarios (${stats.built} built, ${stats.owed} owed).`,
  );
  return 0;
}

if (import.meta.main) {
  process.exit(runDeriveScenarioCoverage());
}
