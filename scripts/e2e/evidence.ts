/**
 * Browser-failure evidence retention (am-test-e2e-harness-bqmh requirement
 * 10): screenshot, Playwright trace, DOM snapshot, console log, and network
 * log (HAR), named under `artifacts/test-logs/<suite>/<log-run-id>/evidence/<testId>/<lane>/`.
 *
 * This module owns only the e2e-specific path shape (`<testId>/<lane>`,
 * always the same five kinds in the same order) and composes it onto
 * `retainEvidence` from `src/testing/log/evidence.ts`
 * (am-test-logging-standard-l3cp), which already does the generic
 * copy-and-log work. It never reimplements that copy or that log write.
 * Capturing the five local files from a live page (screenshot, trace,
 * DOM content, console messages, HAR) is Playwright-specific and lives
 * beside the harness's checks, not here.
 */

import type { RetainEvidenceResult } from "../../src/testing/log/evidence.ts";
import { evidenceDir, retainEvidence } from "../../src/testing/log/evidence.ts";
import type { Outcome } from "../../src/testing/log/schema.ts";

export interface RetainE2EEvidenceMeta {
  suite: string;
  logRunId?: string;
  testId: string;
  lane: string;
  beadId?: string;
  outcome?: Outcome;
  message?: string;
}

/** The five evidence kinds requirement 10 names, always retained in this order. */
export interface E2EEvidenceCapturePaths {
  screenshot: string;
  trace: string;
  dom: string;
  console: string;
  network: string;
}

/** `.../evidence/<testId>/<lane>/`, so evidence for the same check in different lanes never collides. */
export function e2eEvidenceDir(
  suite: string,
  logRunId: string,
  testId: string,
  lane: string,
): string {
  return evidenceDir(suite, logRunId, `${testId}/${lane}`);
}

/**
 * Copies all five captured local files into the standard evidence
 * directory and logs the failure event. A capture path whose file does not
 * exist (a trace that failed to stop cleanly, for instance) is reported by
 * `retainEvidence` in `RetainEvidenceResult.missing` and in the logged
 * message — never silently dropped from the five.
 */
export async function retainE2EEvidence(
  meta: RetainE2EEvidenceMeta,
  capture: E2EEvidenceCapturePaths,
): Promise<RetainEvidenceResult> {
  const sources = [
    capture.screenshot,
    capture.trace,
    capture.dom,
    capture.console,
    capture.network,
  ];
  return retainEvidence(
    {
      suite: meta.suite,
      testId: `${meta.testId}/${meta.lane}`,
      ...(meta.logRunId !== undefined ? { logRunId: meta.logRunId } : {}),
      ...(meta.beadId !== undefined ? { beadId: meta.beadId } : {}),
      ...(meta.outcome !== undefined ? { outcome: meta.outcome } : {}),
      ...(meta.message !== undefined ? { message: meta.message } : {}),
    },
    sources,
  );
}
