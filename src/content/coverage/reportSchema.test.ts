/**
 * Coverage Report Schema Structural Validation Tests.
 *
 * Spec: AGENTS.md §10.4 and am-cm-coverage-ledger-0ip
 */

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { generateCoverageReport } from "./ledger.ts";
import type { CoverageReport } from "./types.ts";

function generateLogRunId(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  const hex = randomBytes(4).toString("hex");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z-${hex}`;
}

const FORBIDDEN_AGGREGATE_KEY_PATTERN = /score|percent|completeness|overall/i;

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  "logRunId",
  "generatedAt",
  "inputs",
  "sourceStatus",
  "translationReview",
  "argumentTreatment",
  "instrumentAvailability",
  "accessibilityEquivalence",
  "numericalValidation",
  "editorialReview",
]);

const DIMENSION_KEYS = new Set([
  "sourceStatus",
  "translationReview",
  "argumentTreatment",
  "instrumentAvailability",
  "accessibilityEquivalence",
  "numericalValidation",
  "editorialReview",
]);

export function validateReportSchema(report: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return { valid: false, errors: ["Report must be a non-null object."] };
  }

  const obj = report as Record<string, unknown>;

  // Check top-level runId rejection
  if ("runId" in obj) {
    errors.push("Forbidden top-level 'runId' found. Report executions must use 'logRunId'.");
  }

  // Check top-level keys
  for (const key of Object.keys(obj)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      errors.push(
        `Disallowed top-level key '${key}'. Only metadata and dimension IDs are allowed.`,
      );
    }
  }

  // Walk entire object tree and check for forbidden aggregate keys
  function walk(node: unknown, path: string[]) {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        walk(node[i], [...path, `[${i}]`]);
      }
      return;
    }

    const rec = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(rec)) {
      const currentPath = [...path, key].join(".");

      // Key must not match forbidden pattern
      if (FORBIDDEN_AGGREGATE_KEY_PATTERN.test(key)) {
        errors.push(
          `Forbidden aggregate key matching /score|percent|completeness|overall/i found: '${currentPath}'`,
        );
      }

      // Count fields must only appear inside dimension objects
      if (key.startsWith("total") || key === "count") {
        const topLevelDim = path[0];
        if (!topLevelDim || !DIMENSION_KEYS.has(topLevelDim)) {
          errors.push(
            `Count field '${currentPath}' is not allowed at top-level or outside dimension objects.`,
          );
        }
      }

      walk(value, [...path, key]);
    }
  }

  walk(obj, []);

  return { valid: errors.length === 0, errors };
}

describe("Coverage Report Schema Suite", () => {
  const rootDir = process.cwd();
  const logRunId = generateLogRunId();
  const logDir = join(rootDir, "artifacts", "test-logs", "coverage-ledger-tests");
  mkdirSync(logDir, { recursive: true });
  const logPath = join(logDir, `${logRunId}.jsonl`);

  function logTest(
    testId: string,
    outcome: "passed" | "failed",
    message: string,
    extra?: Record<string, unknown>,
  ) {
    const entry = {
      timestamp: new Date().toISOString(),
      suite: "coverage-ledger-tests",
      logRunId,
      testId,
      beadId: "am-cm-coverage-ledger-0ip",
      outcome,
      message,
      extra,
    };
    writeFileSync(logPath, `${JSON.stringify(entry)}\n`, { flag: "a", encoding: "utf8" });
  }

  it("verifies generated report conforms to strict no-aggregate schema", () => {
    const report: CoverageReport = generateCoverageReport({
      argumentNodes: [
        {
          id: "arg-01",
          paper: "brownian-motion",
          section: "s1",
          readingsPresent: ["R0", "R1"],
          treatment: { kind: "static" },
        },
      ],
      sourceManifests: new Map([
        [
          "brownian-motion",
          { paper: "brownian-motion", totalUnits: 10, byStatus: { reviewed: 10 } },
        ],
      ]),
    });

    const result = validateReportSchema(report);
    assert.equal(result.valid, true, `Schema validation failed: ${result.errors.join(", ")}`);
    assert.equal(result.errors.length, 0);

    logTest(
      "schema-valid-report",
      "passed",
      "Generated coverage report passes strict structural schema validation",
    );
  });

  it("planted negative: report carrying top-level runId fails schema validation", () => {
    const rawWithRunId = {
      runId: "experiment-realization-run-123", // Forbidden top-level key
      logRunId: "20260916T000000Z-12345678",
      generatedAt: new Date().toISOString(),
      inputs: [],
      sourceStatus: { byStatus: {}, totalUnits: 0, papers: {} },
      translationReview: { byStatus: {}, totalUnits: 0, papers: {} },
      argumentTreatment: { byKind: {}, totalNodes: 0, papers: {} },
      instrumentAvailability: { byProvenance: {}, totalInstruments: 0, instruments: {} },
      accessibilityEquivalence: { byKind: {}, totalNodes: 0, nodes: {} },
      numericalValidation: { byStatus: {}, totalScenarios: 0, scenarios: {} },
      editorialReview: { byStatus: {}, totalReviews: 0, reviews: {} },
    };

    const result = validateReportSchema(rawWithRunId);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("Forbidden top-level 'runId'")));

    logTest("planted-top-level-runId-rejected", "passed", "Report with top-level runId rejected");
  });

  it("planted negative: report with key matching score, percent, completeness, overall fails", () => {
    const forbiddenKeys = [
      { score: 95 },
      { percentComplete: 80 },
      { overallProgress: "good" },
      { completenessRating: 0.9 },
    ];

    for (const badObj of forbiddenKeys) {
      const rawWithForbidden = {
        logRunId: "20260916T000000Z-12345678",
        generatedAt: new Date().toISOString(),
        inputs: [],
        sourceStatus: { byStatus: {}, totalUnits: 0, papers: {} },
        translationReview: { byStatus: {}, totalUnits: 0, papers: {} },
        argumentTreatment: { byKind: {}, totalNodes: 0, papers: {}, ...badObj },
        instrumentAvailability: { byProvenance: {}, totalInstruments: 0, instruments: {} },
        accessibilityEquivalence: { byKind: {}, totalNodes: 0, nodes: {} },
        numericalValidation: { byStatus: {}, totalScenarios: 0, scenarios: {} },
        editorialReview: { byStatus: {}, totalReviews: 0, reviews: {} },
      };

      const result = validateReportSchema(rawWithForbidden);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("Forbidden aggregate key matching")));
    }

    logTest(
      "planted-forbidden-aggregate-keys",
      "passed",
      "Forbidden aggregate keys matching /score|percent|completeness|overall/i rejected",
    );
  });

  it("planted negative: catches any attempt to aggregate translation, instruments, review, and validation into a single completeness percentage", () => {
    // Per AGENTS.md §10.4 and bead specification:
    // An incomplete translation with working instruments is NOT 50% complete.
    // Dimensions must remain separate and never aggregate into a single score or percentage.
    const blendedAggregatePayloads = [
      { completeness: 0.5 },
      { completenessPercentage: 50.0 },
      { overallCompleteness: 0.5 },
      { blendedScore: 0.5 },
      { totalPercent: 50.0 },
      { combinedCompletenessScore: 0.5 },
    ];

    for (const badAggregate of blendedAggregatePayloads) {
      const reportAttempt = {
        logRunId: "20260917T000000Z-12345678",
        generatedAt: new Date().toISOString(),
        inputs: [],
        sourceStatus: { byStatus: { reviewed: 100 }, totalUnits: 100, papers: {} },
        translationReview: { byStatus: { "not-reviewed": 100 }, totalUnits: 100, papers: {} }, // 0% translation
        argumentTreatment: { byKind: { instrument: 10 }, totalNodes: 10, papers: {} },
        instrumentAvailability: {
          byProvenance: { "accepted-frankensim-result-demonstrated": 10 },
          totalInstruments: 10,
          instruments: {},
        }, // 100% instruments
        accessibilityEquivalence: { byKind: { "action-contract": 10 }, totalNodes: 10, nodes: {} },
        numericalValidation: { byStatus: { passing: 10 }, totalScenarios: 10, scenarios: {} },
        editorialReview: { byStatus: { "not-reviewed": 5 }, totalReviews: 5, reviews: {} },
        // An incomplete translation with working instruments is NOT 50% complete:
        ...badAggregate,
      };

      const result = validateReportSchema(reportAttempt);
      assert.equal(
        result.valid,
        false,
        "Aggregated completeness percentage must fail schema validation",
      );
      assert.ok(
        result.errors.some(
          (e) =>
            e.includes("Disallowed top-level key") ||
            e.includes("Forbidden aggregate key matching") ||
            e.includes("not allowed at top-level"),
        ),
        "Expected error rejecting aggregated completeness or score",
      );
    }

    logTest(
      "planted-no-aggregate-completeness-percentage",
      "passed",
      "Rejects any blended completeness percentage or score across dimensions (AGENTS.md §10.4)",
    );
  });
});

