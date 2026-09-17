/**
 * Structured logger for exercise checker test suites.
 * Logs JSONL records to artifacts/test-logs/exercise-checker/<logRunId>.jsonl
 *
 * Specification: am-disc-exercise-checker-i4h2, am-ep-discovery-33u
 */

import fs from "node:fs";
import path from "node:path";
import { newRunIdentity } from "../../testing/log/logger.ts";

export const EXERCISE_CHECKER_BEAD_ID = "am-disc-exercise-checker-i4h2";

export type ExerciseCheckerLogEntry = {
  timestamp: string;
  suite: "exercise-checker";
  logRunId: string;
  testId: string;
  beadId: string;
  exerciseId?: string | undefined;
  readerInput?: string | undefined;
  referenceSource?: string | undefined;
  status?: "equivalent" | "not-equivalent" | "could-not-compare" | "parse-error" | undefined;
  acceptedPointCount?: number | undefined;
  sampleFamily?: "boundary" | "halton" | "philox" | "combined" | undefined;
  adversarialId?: string | undefined;
  outcome: "pass" | "fail" | "flagged";
  durationMs: number;
  message: string;
};

export class ExerciseCheckerLogger {
  private readonly logRunId: string;
  private readonly logFilePath: string;

  constructor(logRunId?: string) {
    this.logRunId = logRunId ?? newRunIdentity();
    const dir = path.join("artifacts", "test-logs", "exercise-checker");
    fs.mkdirSync(dir, { recursive: true });
    this.logFilePath = path.join(dir, `${this.logRunId}.jsonl`);
  }

  getLogRunId(): string {
    return this.logRunId;
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }

  log(
    entry: Omit<ExerciseCheckerLogEntry, "timestamp" | "suite" | "logRunId" | "beadId"> & {
      beadId?: string | undefined;
    },
  ): void {
    const fullEntry: ExerciseCheckerLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      suite: "exercise-checker",
      logRunId: this.logRunId,
      beadId: entry.beadId ?? EXERCISE_CHECKER_BEAD_ID,
    };
    fs.appendFileSync(this.logFilePath, `${JSON.stringify(fullEntry)}\n`, "utf8");
  }
}

export const globalExerciseCheckerLogger = new ExerciseCheckerLogger();
