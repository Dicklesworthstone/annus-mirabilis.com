import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const BEAD_ID = "am-ref-electron-kfy";
export const SUITE = "reference-electron";

let logRunId = "";
let dir = "";

export function electronLogStart(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  logRunId = `${stamp}-electron`;
  dir = join(process.cwd(), "artifacts/test-logs/reference-electron");
  mkdirSync(dir, { recursive: true });
  return logRunId;
}

export interface ElectronLogEntry {
  testId: string;
  scenarioId?: string;
  owner?: string;
  constantSetId?: string;
  beta?: number;
  convention?: string;
  frame?: string;
  fieldCase?: string;
  integrator?: string;
  stepCount?: number;
  observedOrder?: number;
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

export function logElectron(entry: ElectronLogEntry): void {
  if (!logRunId) electronLogStart();
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    suite: SUITE,
    logRunId,
    beadId: BEAD_ID,
    owner: entry.owner ?? "electron",
    constantSetId: entry.constantSetId ?? "modern-si-2019",
    ...entry,
  });
  appendFileSync(join(dir, `${logRunId}.jsonl`), `${line}\n`);
}

export function logElectronFailure(
  testId: string,
  payload: unknown,
  reproductionCommand?: string,
): void {
  if (!logRunId) electronLogStart();
  const failDir = join(dir, logRunId, "failures");
  mkdirSync(failDir, { recursive: true });
  const file = join(failDir, `${testId}.json`);
  writeFileSync(
    file,
    JSON.stringify(
      {
        testId,
        timestamp: new Date().toISOString(),
        payload,
        reproductionCommand,
      },
      null,
      2,
    ),
  );
}
