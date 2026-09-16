/**
 * Structured logging for comprehension-testing protocol, round reports, and reachability audits.
 * Specification: am-edit-comprehension-protocol-ouih
 */

import { randomBytes } from "node:crypto";
import { appendFileSync, copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Accomplishment, SupportRung } from "./types.ts";

export interface ProtocolStructuralLogRecord {
  readonly timestamp?: string | undefined;
  readonly suite: "comprehension-protocol" | "round-reports";
  readonly logRunId: string;
  readonly testId: string;
  readonly beadId: string;
  readonly file: string;
  readonly check: string;
  readonly outcome: "pass" | "fail";
  readonly message: string;
}

export interface ReachabilityAuditLogRecord {
  readonly timestamp?: string | undefined;
  readonly suite: "comprehension";
  readonly logRunId: string;
  readonly testId: string;
  readonly beadId: string;
  readonly paper: string;
  readonly argumentId: string;
  readonly accomplishment: Accomplishment;
  readonly reachSet: string;
  readonly resolved: boolean;
  readonly missingTarget?: string | undefined;
  readonly rule: string;
  readonly outcome: "pass" | "fail";
  readonly durationMs: number;
  readonly message: string;
}

export interface RoundSessionLogRecord {
  readonly timestamp?: string | undefined;
  readonly suite: "round-sessions";
  readonly logRunId: string;
  readonly testId: string;
  readonly beadId: string;
  readonly sessionId: string; // Per-session code, NEVER a person identifier
  readonly paper: string;
  readonly argumentId: string;
  readonly accomplishmentChosen: Accomplishment;
  readonly accomplishmentChanged: boolean;
  readonly rungsUsed: readonly SupportRung[];
  readonly rungOrder: readonly SupportRung[];
  readonly stoppedAt: SupportRung;
  readonly outcomeReached: boolean;
  readonly facilitator: string;
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

export function newToolRunId(now: Date = new Date()): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const hex = randomBytes(4).toString("hex");
  return `${stamp}-${hex}`;
}

export class ComprehensionLogger {
  readonly logRunId: string;
  readonly rootDir: string;

  constructor(logRunId?: string, rootDir: string = process.cwd()) {
    this.logRunId = logRunId ?? newLogRunId();
    this.rootDir = rootDir;
  }

  logStructural(record: Omit<ProtocolStructuralLogRecord, "logRunId" | "beadId">): void {
    const fullRecord: ProtocolStructuralLogRecord = {
      timestamp: record.timestamp ?? new Date().toISOString(),
      suite: record.suite,
      logRunId: this.logRunId,
      beadId: "am-edit-comprehension-protocol-ouih",
      file: record.file,
      check: record.check,
      testId: record.testId,
      outcome: record.outcome,
      message: record.message,
    };

    const logFilePath = join(
      this.rootDir,
      "artifacts/test-logs",
      record.suite,
      `${this.logRunId}.jsonl`,
    );

    mkdirSync(dirname(logFilePath), { recursive: true });
    appendFileSync(logFilePath, `${JSON.stringify(fullRecord)}\n`, "utf8");

    // If failing, retain a copy of the offending document under evidence
    if (record.outcome === "fail" && record.file) {
      try {
        const evidenceDir = join(
          this.rootDir,
          "artifacts/test-logs",
          record.suite,
          this.logRunId,
          "evidence",
          record.testId,
        );
        mkdirSync(evidenceDir, { recursive: true });
        const dest = join(evidenceDir, "offending-document.txt");
        const src = join(this.rootDir, record.file);
        copyFileSync(src, dest);
      } catch {
        // Evidence retention best-effort if file does not exist on disk
      }
    }
  }

  logReachability(record: Omit<ReachabilityAuditLogRecord, "suite" | "logRunId" | "beadId">): void {
    const fullRecord: ReachabilityAuditLogRecord = {
      timestamp: record.timestamp ?? new Date().toISOString(),
      suite: "comprehension",
      logRunId: this.logRunId,
      beadId: "am-edit-comprehension-protocol-ouih",
      ...record,
    };

    const logFilePath = join(
      this.rootDir,
      "artifacts/test-logs/comprehension",
      `${this.logRunId}.jsonl`,
    );

    mkdirSync(dirname(logFilePath), { recursive: true });
    appendFileSync(logFilePath, `${JSON.stringify(fullRecord)}\n`, "utf8");
  }

  logSession(record: Omit<RoundSessionLogRecord, "suite" | "logRunId" | "beadId">): void {
    const fullRecord: RoundSessionLogRecord = {
      timestamp: record.timestamp ?? new Date().toISOString(),
      suite: "round-sessions",
      logRunId: this.logRunId,
      beadId: "am-edit-comprehension-protocol-ouih",
      ...record,
    };

    const logFilePath = join(
      this.rootDir,
      "artifacts/test-logs/round-sessions",
      `${this.logRunId}.jsonl`,
    );

    mkdirSync(dirname(logFilePath), { recursive: true });
    appendFileSync(logFilePath, `${JSON.stringify(fullRecord)}\n`, "utf8");
  }

  saveAuditReport(toolRunId: string, report: unknown): string {
    const auditDir = join(this.rootDir, "artifacts/audits/reachability", toolRunId);
    mkdirSync(auditDir, { recursive: true });
    const reportPath = join(auditDir, "report.json");
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    return reportPath;
  }
}
