import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function repoRoot(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return join(currentDir, "../..");
}

export function newExtractionLogRunId(): string {
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

export interface ExtractionLogEntry {
  timestamp?: string;
  suite: "runtime-extraction";
  logRunId: string;
  testId: string;
  beadId: "am-scaf-extract-runtime-utilities-99y";
  outcome: "pass" | "fail";
  durationMs: number;
  message: string;
  expected?: string;
  actual?: string;
  comparisonKind?: "bitwise";
  extra?: {
    path?: string;
    token?: string;
    line?: number;
    excerpt?: string;
  };
}

export function appendExtractionLog(
  entry: Omit<ExtractionLogEntry, "suite" | "beadId"> & {
    suite?: "runtime-extraction";
    beadId?: "am-scaf-extract-runtime-utilities-99y";
  },
): void {
  const dir = join(repoRoot(), "artifacts/test-logs/runtime-extraction");
  mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({
    timestamp: entry.timestamp ?? new Date().toISOString(),
    suite: "runtime-extraction",
    logRunId: entry.logRunId,
    testId: entry.testId,
    beadId: "am-scaf-extract-runtime-utilities-99y",
    outcome: entry.outcome,
    durationMs: entry.durationMs,
    message: entry.message,
    ...(entry.expected !== undefined ? { expected: entry.expected } : {}),
    ...(entry.actual !== undefined ? { actual: entry.actual } : {}),
    ...(entry.comparisonKind !== undefined ? { comparisonKind: entry.comparisonKind } : {}),
    ...(entry.extra !== undefined ? { extra: entry.extra } : {}),
  });
  appendFileSync(join(dir, `${entry.logRunId}.jsonl`), `${line}\n`);
}
