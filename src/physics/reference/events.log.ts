import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const BEAD_ID = "am-ref-events-yvl";
export const SUITE = "reference-events";

let logRunId = "";
let dir = "";

export function eventsLogStart(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  logRunId = `${stamp}-events`;
  dir = join(process.cwd(), "artifacts/test-logs/reference-events");
  mkdirSync(dir, { recursive: true });
  return logRunId;
}

export interface EventsLogEntry {
  testId: string;
  scenarioId?: string;
  owner?: string;
  frameId?: string;
  ledgerRunId?: string;
  eventCount?: number;
  beta?: number;
  classification?: string;
  resultStatus: string;
  expected?: unknown;
  actual?: unknown;
  tolerance?: unknown;
  comparisonKind?: string;
  outcome: "passed" | "failed";
  durationMs: number;
  message: string;
  extra?: Record<string, unknown>;
}

export function logEvent(entry: EventsLogEntry): void {
  if (!logRunId) eventsLogStart();
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    suite: SUITE,
    logRunId,
    beadId: BEAD_ID,
    owner: entry.owner ?? "events",
    ...entry,
  });
  appendFileSync(join(dir, `${logRunId}.jsonl`), `${line}\n`);
}

export function logEventFailure(
  testId: string,
  payload: unknown,
  reproductionCommand?: string,
): void {
  if (!logRunId) eventsLogStart();
  const failDir = join(dir, logRunId, "failures");
  mkdirSync(failDir, { recursive: true });
  const data = {
    testId,
    reproductionCommand: reproductionCommand ?? "bun test src/physics/reference/events.*.test.ts",
    payload,
  };
  writeFileSync(
    join(failDir, `${testId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`),
    JSON.stringify(data, null, 2),
  );
}
