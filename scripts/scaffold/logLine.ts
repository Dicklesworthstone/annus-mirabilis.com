import { randomBytes } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Shared structured-logging primitive for the three scripts this bead owns
 * (scaffold-static-output, initial-route-graph, inline-script-hashes).
 * am-test-logging-standard-l3cp replaces this with the real library later;
 * the field names here are the contract that replacement must keep.
 */

export const LOG_RUN_ID_PATTERN = /^\d{8}T\d{6}Z-[0-9a-f]{8}$/;

export function newLogRunId(now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const hex = randomBytes(4).toString("hex");
  return `${stamp}-${hex}`;
}

export type LogOutcome = "pass" | "fail";

export type LogExtra = {
  route?: string;
  url?: string;
  status?: number;
  chunk?: string;
  signature?: string;
  origin?: string;
  scriptId?: string;
  ownerBeadId?: string;
  scriptSha256?: string;
  manifestPath?: string;
  [key: string]: unknown;
};

export type LogFields = {
  suite: string;
  logRunId: string;
  testId: string;
  beadId: string;
  outcome: LogOutcome;
  message: string;
  expected?: unknown;
  actual?: unknown;
  comparisonKind?: "bitwise" | string;
  durationMs?: number;
  extra?: LogExtra;
};

export function formatLogLine(fields: LogFields, timestamp: string = new Date().toISOString()): string {
  return JSON.stringify({ timestamp, ...fields });
}

export function logPathFor(suite: string, logRunId: string, root: string = process.cwd()): string {
  return join(root, "artifacts/test-logs", suite, `${logRunId}.jsonl`);
}

export function evidenceDirFor(suite: string, logRunId: string, root: string = process.cwd()): string {
  return join(root, "artifacts/test-logs", suite, logRunId, "evidence");
}

export function appendLogLine(logPath: string, fields: LogFields, timestamp?: string): void {
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, `${formatLogLine(fields, timestamp)}\n`, "utf8");
}

export function writeEvidenceFile(evidenceDir: string, fileName: string, contents: string): string {
  mkdirSync(evidenceDir, { recursive: true });
  const path = join(evidenceDir, fileName);
  appendFileSync(path, contents, "utf8");
  return path;
}
