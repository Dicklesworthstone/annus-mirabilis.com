import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const BEAD_ID = "am-ref-waves-r53";
export const SUITE = "reference-waves";

let logRunId = "";
let dir = "";

export function wavesLogStart(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  logRunId = `${stamp}-waves`;
  dir = join(process.cwd(), "artifacts/test-logs/reference-waves");
  mkdirSync(dir, { recursive: true });
  return logRunId;
}

export interface WavesLogEntry {
  testId: string;
  scenarioId?: string;
  owner?: string;
  beta?: number;
  thetaRad?: number;
  frame?: "K" | "mirror" | string;
  model?: "physical" | "countermodel" | string;
  label?: string;
  resultStatus: string;
  expected?: unknown;
  actual?: unknown;
  tolerance?: unknown;
  comparisonKind?: string;
  outcome: "passed" | "failed";
  durationMs: number;
  message: string;
  extra?: {
    wavePhase?: number | undefined;
    wavePhaseFrame?: string | undefined;
    forbiddenCalleesFound?: readonly string[] | undefined;
    [key: string]: unknown;
  };
}

export function logWaves(entry: WavesLogEntry): void {
  if (!logRunId) wavesLogStart();
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    suite: SUITE,
    logRunId,
    beadId: BEAD_ID,
    owner: entry.owner ?? "waves",
    ...entry,
  });
  appendFileSync(join(dir, `${logRunId}.jsonl`), `${line}\n`);
}

export function logWavesFailure(
  testId: string,
  payload: unknown,
  reproductionCommand?: string,
): void {
  if (!logRunId) wavesLogStart();
  const failDir = join(dir, logRunId, "failures");
  mkdirSync(failDir, { recursive: true });
  const data = {
    testId,
    reproductionCommand: reproductionCommand ?? `bun test src/physics/reference/waves.*.test.ts`,
    payload,
  };
  writeFileSync(
    join(failDir, `${testId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`),
    JSON.stringify(data, null, 2),
  );
}
