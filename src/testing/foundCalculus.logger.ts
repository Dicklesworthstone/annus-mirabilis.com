import fs from "node:fs";
import path from "node:path";
import { newRunIdentity } from "./log/logger.ts";

export interface CalculusLogEntry {
  timestamp?: string;
  suite?: string;
  logRunId?: string;
  testId: string;
  beadId?: string;
  foundationId?: string;
  callingAnchor?: string;
  expected?: unknown;
  actual?: unknown;
  tolerance?: unknown;
  outcome?: "passed" | "failed" | "skipped" | "not-available";
  viewport?: string;
  jsEnabled?: boolean;
  message: string;
  evidence?: Record<string, unknown>;
  extra?: Record<string, unknown>;
}

export const CALCULUS_BEAD_ID = "am-found-calculus-6agg";
export const CALCULUS_SUITE = "found-calculus";

let activeRunId = "";

export function getCalculusLogRunId(): string {
  if (!activeRunId) {
    activeRunId = newRunIdentity();
  }
  return activeRunId;
}

export function writeCalculusLog(entry: CalculusLogEntry): void {
  const runId = entry.logRunId || getCalculusLogRunId();
  const dir = path.resolve(process.cwd(), "artifacts/test-logs", CALCULUS_SUITE);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${runId}.jsonl`);

  const fullRecord = {
    timestamp: entry.timestamp || new Date().toISOString(),
    suite: entry.suite || CALCULUS_SUITE,
    logRunId: runId,
    testId: entry.testId,
    beadId: entry.beadId || CALCULUS_BEAD_ID,
    foundationId: entry.foundationId ?? null,
    callingAnchor: entry.callingAnchor ?? null,
    expected: entry.expected,
    actual: entry.actual,
    tolerance: entry.tolerance,
    outcome: entry.outcome || "passed",
    viewport: entry.viewport ?? "1280x720",
    jsEnabled: entry.jsEnabled ?? true,
    message: entry.message,
    ...(entry.evidence ? { evidence: entry.evidence } : {}),
    extra: {
      foundationId: entry.foundationId,
      callingAnchor: entry.callingAnchor,
      ...entry.extra,
    },
  };

  fs.appendFileSync(filePath, `${JSON.stringify(fullRecord)}\n`, "utf8");
}
