import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const BEAD_ID = "am-ref-shelf-optics-okmt";
export const SUITE = "reference-shelf-optics";

let logRunId = "";
let dir = "";

export function shelfOpticsLogStart(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  logRunId = `${stamp}-shelf-optics`;
  dir = join(process.cwd(), "artifacts/test-logs/reference-shelf-optics");
  mkdirSync(dir, { recursive: true });
  return logRunId;
}

export interface ShelfOpticsLogEntry {
  testId: string;
  scenarioId?: string;
  owner?: string;
  modelVersion?: number;
  modelIdentity?: string;
  mode?: "1904" | "full";
  constantSetId?: string;
  inputs?: Record<string, unknown>;
  expected?: unknown;
  actual?: unknown;
  tolerance?: unknown;
  comparisonKind?: string;
  resultStatus: string;
  historicalStatus?: string;
  outcome: "passed" | "failed";
  durationMs: number;
  message: string;
  extra?: Record<string, unknown>;
}

export function logShelfOptics(entry: ShelfOpticsLogEntry): void {
  if (!logRunId) shelfOpticsLogStart();
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    suite: SUITE,
    logRunId,
    beadId: BEAD_ID,
    owner: entry.owner ?? "shelf-optics",
    constantSetId: entry.constantSetId ?? "modern-si-2019",
    ...entry,
  });
  appendFileSync(join(dir, `${logRunId}.jsonl`), `${line}\n`);
}

export function logShelfOpticsFailure(
  testId: string,
  payload: unknown,
  reproductionCommand?: string,
): void {
  if (!logRunId) shelfOpticsLogStart();
  const failDir = join(dir, logRunId, "failures");
  mkdirSync(failDir, { recursive: true });
  const file = join(failDir, `${testId}.json`);
  writeFileSync(
    file,
    JSON.stringify(
      {
        testId,
        timestamp: new Date().toISOString(),
        reproductionCommand,
        payload,
      },
      null,
      2,
    ),
  );
}
