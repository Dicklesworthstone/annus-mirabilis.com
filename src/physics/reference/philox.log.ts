import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const BEAD_ID = "am-fs-philox-ts-port-7kp";
export const SUITE = "philox-port";

let logRunId = "";
let dir = "";

export function philoxLogStart(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  logRunId = `${stamp}-philox`;
  dir = join(process.cwd(), "artifacts/test-logs/philox-port");
  mkdirSync(dir, { recursive: true });
  return logRunId;
}

export interface PhiloxLogEntry {
  testId: string;
  seed: string;
  streamVersion: string;
  expected: unknown;
  actual: unknown;
  comparisonKind: "bitwise" | "tolerance" | "formatted";
  tolerance: number | null;
  outcome: "passed" | "failed";
  durationMs: number;
  message: string;
  extra?: {
    streamKernelId?: number;
    tile?: number;
    index?: string;
    field?: string;
    maxDeviation?: number;
    engine?: string;
    drawsConsumed?: number;
    vectorFileDigest?: string;
    [key: string]: unknown;
  };
}

export function logPhilox(entry: PhiloxLogEntry): void {
  if (!logRunId) philoxLogStart();
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    suite: SUITE,
    logRunId,
    testId: entry.testId,
    beadId: BEAD_ID,
    seed: entry.seed,
    streamVersion: entry.streamVersion,
    expected: entry.expected,
    actual: entry.actual,
    comparisonKind: entry.comparisonKind,
    tolerance: entry.tolerance,
    outcome: entry.outcome,
    durationMs: entry.durationMs,
    message: entry.message,
    ...(entry.extra ? { extra: entry.extra } : {}),
  });
  appendFileSync(join(dir, `${logRunId}.jsonl`), `${line}\n`);
}

export function logPhiloxFailure(
  testId: string,
  payload: {
    key: unknown;
    index: string;
    field: string;
    expected: unknown;
    actual: unknown;
    engine: string;
    vectorFileDigest: string;
    reproductionCommand: string;
  },
): string {
  if (!logRunId) philoxLogStart();
  const failDir = join(dir, logRunId, "failures");
  mkdirSync(failDir, { recursive: true });
  const failPath = join(failDir, `${testId}.json`);
  writeFileSync(failPath, JSON.stringify(payload, null, 2));
  return failPath;
}
