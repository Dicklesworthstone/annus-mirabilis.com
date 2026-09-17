/**
 * Structured logger for knowledge cards, shelf rules, verification queue, and publication gate test suites.
 * Logs JSONL records to artifacts/test-logs/knowledge-cards/<logRunId>.jsonl
 *
 * Specification: am-disc-knowledge-cards-iw8j, am-ep-discovery-33u
 */

import fs from "node:fs";
import path from "node:path";
import { newRunIdentity } from "../../testing/log/logger.ts";

export const KNOWLEDGE_CARDS_BEAD_ID = "am-disc-knowledge-cards-iw8j";

export type KnowledgeCardsLogEntry = {
  timestamp: string;
  suite: "knowledge-cards";
  logRunId: string;
  testId: string;
  beadId: string;
  cardId?: string | undefined;
  stageId?: string | undefined;
  citingStage?: string | undefined;
  rule?: string | undefined;
  status?: string | undefined;
  eventKind?: string | undefined;
  dateEarliest?: string | undefined;
  dateLatest?: string | undefined;
  latestYear?: number | undefined;
  precision?: string | undefined;
  priorEventKind?: string | undefined;
  priorEventLatest?: string | undefined;
  relatedCardId?: string | undefined;
  parallelBasisPresent?: boolean | undefined;
  admittedImport?: boolean | string | undefined;
  verified?: boolean | undefined;
  verifierKind?: string | undefined;
  queueId?: string | undefined;
  queueStatus?: string | undefined;
  buildProfile?: string | undefined;
  browser?: string | undefined;
  viewport?: string | undefined;
  jsEnabled?: boolean | undefined;
  outcome: "pass" | "fail" | "refusal" | "flagged";
  durationMs: number;
  message: string;
};

export class KnowledgeCardsLogger {
  private readonly logRunId: string;
  private readonly logFilePath: string;

  constructor(logRunId?: string) {
    this.logRunId = logRunId ?? newRunIdentity();
    const dir = path.join("artifacts", "test-logs", "knowledge-cards");
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
    entry: Omit<KnowledgeCardsLogEntry, "timestamp" | "suite" | "logRunId" | "beadId"> & {
      beadId?: string | undefined;
    },
  ): void {
    const fullEntry: KnowledgeCardsLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      suite: "knowledge-cards",
      logRunId: this.logRunId,
      beadId: entry.beadId ?? KNOWLEDGE_CARDS_BEAD_ID,
    };
    fs.appendFileSync(this.logFilePath, `${JSON.stringify(fullEntry)}\n`, "utf8");
  }
}

export const globalKnowledgeCardsLogger = new KnowledgeCardsLogger();
