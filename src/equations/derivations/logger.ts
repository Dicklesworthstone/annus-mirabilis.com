/**
 * Structured logger for derivation chains (am-eq-derivation-chains-r4c).
 * Writes JSONL log records to artifacts/test-logs/equations-derivations/<log-run-id>.jsonl.
 */

import { randomBytes } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ToleranceSpec } from "../../units/tolerance.ts";
import type { RouteKind, RuleKind } from "./types.ts";

export interface DerivationLogRecord {
  readonly timestamp?: string | undefined;
  readonly suite: string;
  readonly logRunId: string;
  readonly testId: string;
  readonly beadId: string;
  readonly chainId?: string | undefined;
  readonly proofRouteId?: string | undefined;
  readonly routeKind?: RouteKind | undefined;
  readonly essentialForPrint?: boolean | undefined;
  readonly stepId?: string | undefined;
  readonly isMove?: boolean | undefined;
  readonly detail?: string | undefined;
  readonly perspective?: string | undefined;
  readonly highlightIds?: readonly string[] | undefined;
  readonly toolPresent?: boolean | undefined;
  readonly toolLinkOpened?: boolean | undefined;
  readonly returnFocusRestored?: boolean | undefined;
  readonly announcementCount?: number | undefined;
  readonly rule?: RuleKind | string | undefined;
  readonly verification?: ("verified" | "authored-unverified" | "failed") | undefined;
  readonly toolId?: string | undefined;
  readonly toolStatus?: ("present" | "pending" | "error") | undefined;
  readonly spotCheckSamples?: number | undefined;
  readonly spotCheckMaxRelError?: number | undefined;
  readonly tolerance?: ToleranceSpec | undefined;
  readonly seed?: string | undefined;
  readonly premiseRefs?: readonly string[] | undefined;
  readonly edgeTypes?: readonly string[] | undefined;
  readonly reviewRecordId?: string | undefined;
  readonly expected?: unknown;
  readonly actual?: unknown;
  readonly comparisonKind?: ("bitwise" | "tolerance" | "formatted") | undefined;
  readonly browser?: string | undefined;
  readonly viewport?: string | undefined;
  readonly reducedMotion?: boolean | undefined;
  readonly jsEnabled?: boolean | undefined;
  readonly paper?: string | undefined;
  readonly anchor?: string | undefined;
  readonly durationMs?: number | undefined;
  readonly outcome: "pass" | "fail";
  readonly message: string;
}

export function newLogRunId(now: Date = new Date()): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const hex = randomBytes(4).toString("hex");
  return `${stamp}-${hex}`;
}

export class DerivationLogger {
  readonly logRunId: string;
  readonly logFilePath: string;

  constructor(logRunId?: string, rootDir: string = process.cwd()) {
    this.logRunId = logRunId ?? newLogRunId();
    this.logFilePath = join(
      rootDir,
      "artifacts/test-logs/equations-derivations",
      `${this.logRunId}.jsonl`,
    );
  }

  log(record: Omit<DerivationLogRecord, "suite" | "logRunId" | "beadId">): void {
    const fullRecord: DerivationLogRecord = {
      timestamp: record.timestamp ?? new Date().toISOString(),
      suite: "equations-derivations",
      logRunId: this.logRunId,
      beadId: "am-eq-derivation-chains-r4c",
      ...record,
    };

    mkdirSync(dirname(this.logFilePath), { recursive: true });
    appendFileSync(this.logFilePath, `${JSON.stringify(fullRecord)}\n`, "utf8");
  }
}

export class DerivationRendererLogger {
  readonly logRunId: string;
  readonly logFilePath: string;

  constructor(logRunId?: string, rootDir: string = process.cwd()) {
    this.logRunId = logRunId ?? newLogRunId();
    this.logFilePath = join(
      rootDir,
      "artifacts/test-logs/equations-derivation-renderer",
      `${this.logRunId}.jsonl`,
    );
  }

  log(record: Omit<DerivationLogRecord, "suite" | "logRunId" | "beadId">): void {
    const fullRecord: DerivationLogRecord = {
      timestamp: record.timestamp ?? new Date().toISOString(),
      suite: "equations-derivation-renderer",
      logRunId: this.logRunId,
      beadId: "am-eq-derivation-renderer-9gd7",
      ...record,
    };

    mkdirSync(dirname(this.logFilePath), { recursive: true });
    appendFileSync(this.logFilePath, `${JSON.stringify(fullRecord)}\n`, "utf8");
  }
}
