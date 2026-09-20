/**
 * Structured logging for UI extraction test suite (am-scaf-extract-ui-components-c31).
 */

import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function repoRoot(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return join(currentDir, "../..");
}

export function newUiExtractionLogRunId(): string {
  const now = new Date();
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  const hex = createHash("sha256")
    .update(`${stamp}-${process.pid}-${performance.now()}`)
    .digest("hex")
    .slice(0, 8);
  return `${stamp}-${hex}`;
}

export interface UiExtractionLogEntry {
  readonly timestamp?: string | undefined;
  readonly suite: "ui-extraction";
  readonly logRunId: string;
  readonly testId: string;
  readonly beadId: "am-scaf-extract-ui-components-c31";
  /**
   * "not-available" exists because a check that could not look must be able to say so.
   * The vocabulary was "pass" | "fail" only, which forced a gap - an absent build
   * directory, an unreadable input - to be written down as one or the other. The
   * project logging standard (am-test-logging-standard-l3cp) carries the third state
   * for the same reason.
   */
  readonly outcome: "pass" | "fail" | "not-available";
  readonly durationMs: number;
  readonly message: string;
  readonly path?: string | undefined;
  readonly line?: number | undefined;
  readonly origin?: string | undefined;
  readonly browser?: string | undefined;
  readonly viewport?: string | undefined;
  readonly jsEnabled?: boolean | undefined;
  readonly evidence?: string | undefined;
}

export function appendUiExtractionLog(entry: {
  readonly logRunId: string;
  readonly testId: string;
  readonly outcome: "pass" | "fail" | "not-available";
  readonly durationMs: number;
  readonly message: string;
  readonly path?: string | undefined;
  readonly line?: number | undefined;
  readonly origin?: string | undefined;
  readonly browser?: string | undefined;
  readonly viewport?: string | undefined;
  readonly jsEnabled?: boolean | undefined;
  readonly evidence?: string | undefined;
}): void {
  const dir = join(repoRoot(), "artifacts/test-logs/ui-extraction");
  mkdirSync(dir, { recursive: true });
  const logLine = JSON.stringify({
    timestamp: new Date().toISOString(),
    suite: "ui-extraction",
    logRunId: entry.logRunId,
    testId: entry.testId,
    beadId: "am-scaf-extract-ui-components-c31",
    outcome: entry.outcome,
    durationMs: entry.durationMs,
    message: entry.message,
    ...(entry.path ? { path: entry.path } : {}),
    ...(entry.line ? { line: entry.line } : {}),
    ...(entry.origin ? { origin: entry.origin } : {}),
    ...(entry.browser ? { browser: entry.browser } : {}),
    ...(entry.viewport ? { viewport: entry.viewport } : {}),
    ...(entry.jsEnabled !== undefined ? { jsEnabled: entry.jsEnabled } : {}),
    ...(entry.evidence ? { evidence: entry.evidence } : {}),
  });
  appendFileSync(join(dir, `${entry.logRunId}.jsonl`), `${logLine}\n`);
}
