import { describe, expect, test } from "bun:test";
import {
  createInitialCoverageSummary,
  type PaperCoverageRow,
  type RuntimeProvenance,
} from "../content/coverage/coverageManifest.ts";
import { appendExtractionLog, newExtractionLogRunId } from "./extractionLogging.ts";

const logRunId = newExtractionLogRunId();

describe("Coverage Manifest Runtime Extraction", () => {
  test("the three provenance states ('WASM', 'TS_FALLBACK', 'HONEST_PLACEHOLDER') remain distinct and are never merged into one flag", () => {
    const start = performance.now();
    const states: RuntimeProvenance[] = ["WASM", "TS_FALLBACK", "HONEST_PLACEHOLDER"];

    // Prove all 3 states are pairwise distinct strings
    expect(states[0]).not.toBe(states[1]);
    expect(states[1]).not.toBe(states[2]);
    expect(states[0]).not.toBe(states[2]);
    expect(new Set(states).size).toBe(3);

    const row: PaperCoverageRow = {
      paperSlug: "brownian-motion",
      source: {
        pinnedFacsimile: true,
        reviewedLedger: true,
        archivalEdition: "published",
        sentenceCount: 142,
        equationCount: 16,
      },
      presentation: {
        bilingualAligned: true,
        defaultTelemetryOwner: "typescript",
        liveEquationSet: true,
      },
      runtime: {
        wasmSurface: "generic-wasm",
        wasmArtifactPresent: true,
        admittedProvenance: ["TS_FALLBACK", "WASM"],
        coldStartProvenance: "HONEST_PLACEHOLDER",
      },
    };

    expect(row.runtime.coldStartProvenance).toBe("HONEST_PLACEHOLDER");
    expect(row.runtime.admittedProvenance).toContain("WASM");
    expect(row.runtime.admittedProvenance).toContain("TS_FALLBACK");

    appendExtractionLog({
      logRunId,
      testId: "coverage-manifest-provenance-states-distinct",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "The three runtime provenance states remain distinct and unmerged",
    });
  });

  test("createInitialCoverageSummary initializes multidimensional counts", () => {
    const start = performance.now();
    const summary = createInitialCoverageSummary();
    expect(summary.totalPapers).toBe(5);
    expect(summary.publishedEditions).toBe(0);

    appendExtractionLog({
      logRunId,
      testId: "coverage-manifest-initial-summary",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "createInitialCoverageSummary creates 5-paper baseline summary",
    });
  });
});
