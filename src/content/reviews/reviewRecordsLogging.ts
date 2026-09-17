/**
 * Structured logger for review records and checks test suites.
 * Logs JSONL records to artifacts/test-logs/review-records/<logRunId>.jsonl
 */

import fs from "node:fs";
import path from "node:path";
import { newRunIdentity } from "../../testing/log/logger.ts";

export type ReviewRecordLogEntry = {
  timestamp: string;
  suite: "review-records";
  logRunId: string;
  testId: string;
  beadId: string;
  rule: string;
  severity: "error" | "flag" | "info";
  recordId?: string | undefined;
  recordType?: string | undefined;
  unitId?: string | undefined;
  reviewId?: string | undefined;
  reviewer?: string | undefined;
  staleBecause?: string | undefined;
  code?: string | undefined;
  registeredCheck?: "record-backed" | "strict-default" | string | undefined;
  claimId?: string | undefined;
  paper?: string | undefined;
  projection?: string | undefined;
  projectionVerdict?: string | undefined;
  findingKind?: string | undefined;
  owningBeadId?: string | undefined;
  contentRevision?: number | string | undefined;
  translationRevision?: number | string | undefined;
  reviewerId?: string | undefined;
  recordOutcome?: string | undefined;
  expected?: string | undefined;
  actual?: string | undefined;
  outcome: "pass" | "fail" | "flagged";
  durationMs: number;
  message: string;
  repair?: string | undefined;
};

export class ReviewRecordsLogger {
  private readonly logRunId: string;
  private readonly logFilePath: string;

  constructor(logRunId?: string) {
    this.logRunId = logRunId ?? newRunIdentity();
    const dir = path.join("artifacts", "test-logs", "review-records");
    fs.mkdirSync(dir, { recursive: true });
    this.logFilePath = path.join(dir, `${this.logRunId}.jsonl`);
  }

  getLogRunId(): string {
    return this.logRunId;
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }

  log(entry: Omit<ReviewRecordLogEntry, "timestamp" | "suite" | "logRunId">): void {
    const fullEntry: ReviewRecordLogEntry = {
      timestamp: new Date().toISOString(),
      suite: "review-records",
      logRunId: this.logRunId,
      ...entry,
    };
    fs.appendFileSync(this.logFilePath, `${JSON.stringify(fullEntry)}\n`, "utf8");
  }
}

export const globalReviewRecordsLogger = new ReviewRecordsLogger();
