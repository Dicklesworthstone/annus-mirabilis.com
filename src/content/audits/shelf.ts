/**
 * Shelf audit (am-cm-audit-scripts-d34): undated/unsourced cards fail;
 * post-1904 premises in discovery steps fail without a parallel-work or
 * admitted-import flag; later-evidence world-check citations are listed as
 * evidence, not premises. Queue/card disagreement is an error.
 */

import { type AuditFinding, type AuditReport, summarize } from "./types.ts";

export type ShelfCardStatus = "available" | "parallel-work" | "later";

export type ShelfCard = Readonly<{
  id: string;
  source?: string;
  date?: string;
  latestYear?: number;
  status: ShelfCardStatus;
  verification?: Readonly<{ checked: boolean; recordId?: string }>;
  usedInDiscoveryStep?: boolean;
  worldCheckEvidence?: boolean;
  admittedImport?: boolean;
}>;

export type VerificationQueueItem = Readonly<{
  cardId: string;
  open: boolean;
  queueFile: string;
}>;

export type ShelfAuditInput = Readonly<{
  cards: readonly ShelfCard[];
  queue?: readonly VerificationQueueItem[];
}>;

export function auditShelf(input: ShelfAuditInput): AuditReport {
  const findings: AuditFinding[] = [];
  const cards = new Map(input.cards.map((card) => [card.id, card]));

  for (const card of input.cards) {
    if (!card.date?.trim() && card.latestYear === undefined) {
      findings.push({
        check: "shelf-undated",
        family: "audit",
        severity: "error",
        recordId: card.id,
        message: `Shelf card ${card.id} has no date and no latestYear.`,
      });
    }
    if (!card.source?.trim()) {
      findings.push({
        check: "shelf-unsourced",
        family: "audit",
        severity: "error",
        recordId: card.id,
        message: `Shelf card ${card.id} has no source.`,
      });
    }
    const year = card.latestYear;
    const postCutoff = year !== undefined && year > 1904;
    const flagged = card.status === "parallel-work" || card.admittedImport === true;
    if (postCutoff && card.usedInDiscoveryStep && !flagged && !card.worldCheckEvidence) {
      findings.push({
        check: "shelf-post-1904-unflagged",
        family: "audit",
        severity: "error",
        recordId: card.id,
        expected: "parallel-work or admitted-import",
        actual: `latestYear ${year}, status ${card.status}`,
        message: `Shelf card ${card.id} (latestYear ${year}) is used as a discovery premise without the parallel-work or admitted-import flag.`,
      });
    }
    if (card.worldCheckEvidence) {
      findings.push({
        check: "shelf-world-check-evidence",
        family: "audit",
        severity: "flag",
        recordId: card.id,
        message: `Shelf card ${card.id} is later-evidence in a world-check stage, not a 1904 premise.`,
      });
    }
  }

  for (const item of input.queue ?? []) {
    const card = cards.get(item.cardId);
    if (!card) {
      findings.push({
        check: "shelf-queue-missing-card",
        family: "audit",
        severity: "error",
        recordId: item.cardId,
        message: `Verification queue ${item.queueFile} names card ${item.cardId}, which is absent from the corpus.`,
      });
      continue;
    }
    if (item.open && card.verification?.checked) {
      findings.push({
        check: "shelf-queue-card-disagreement",
        family: "audit",
        severity: "error",
        recordId: item.cardId,
        message: `Open queue item in ${item.queueFile} for ${item.cardId}, but the card already carries a verification record.`,
      });
    }
  }

  return summarize("audit-shelf", findings);
}
