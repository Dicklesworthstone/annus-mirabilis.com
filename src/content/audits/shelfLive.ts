/**
 * THE SHELF AUDIT OVER THE CARDS THE JOURNEYS RENDER (am-rc1001-bridge-plan-pcjk.12).
 *
 * The 1904 boundary is the discovery book's central epistemic promise, and until 2026-10-02 it held
 * only because people wrote the cards carefully. verify-content passed `{ cards: [] }` to
 * auditShelf, so the audit judged nothing and reported green; validateCardIntrinsicRules and
 * validateCardCitation had no caller outside their own tests; and the shelf files said a later
 * card is "never on the 1904 shelf (cardRules.ts, card-later-on-shelf)", describing a gate that
 * never saw them.
 *
 * This runs all three over the 46 cards the four journeys render (src/discovery/cards/
 * journeyCards.ts):
 * - auditShelf, on each card: undated, unsourced, a post-1904 premise without a flag;
 * - the intrinsic card rules, on each card: dates in order, latestYear agreeing with the date, a
 *   status that matches the year, a prior event that is prior, a parallel-work basis;
 * - the citation rules, on each shelf card as placed on its shelf: a later card refused, a 1905
 *   import admitted only by its own journey.
 * The report declares its population, so an empty corpus fails rather than passing.
 */
import {
  validateCardCitation,
  validateCardIntrinsicRules,
} from "../../discovery/cards/cardRules.ts";
import { JOURNEY_SHELVES, type JourneyShelf } from "../../discovery/cards/journeyCards.ts";
import { isCardVerified } from "../../discovery/cards/publicationGate.ts";
import type { CardRuleDiagnostic, KnowledgeCard } from "../../discovery/cards/types.ts";
import { auditShelf, type ShelfCard } from "./shelf.ts";
import { type AuditFinding, type AuditReport, summarize } from "./types.ts";

export type LiveShelfAudit = Readonly<{ report: AuditReport; cards: number; shelves: number }>;

function shelfCard(card: KnowledgeCard, onShelf: boolean): ShelfCard {
  return {
    id: card.id,
    source: card.sources.length > 0 ? `${card.sources.length} source(s)` : "",
    date: card.date.latest,
    latestYear: card.date.latestYear,
    status: card.status as ShelfCard["status"],
    verification: { checked: isCardVerified(card) },
    usedInDiscoveryStep: onShelf,
    worldCheckEvidence: !onShelf,
    admittedImport: Boolean(card.admittedImport),
  };
}

function finding(journey: string, diagnostic: CardRuleDiagnostic): AuditFinding {
  return {
    check: diagnostic.rule,
    family: "audit",
    severity: diagnostic.severity === "warning" ? "flag" : "error",
    paper: journey,
    ...(diagnostic.cardId === undefined ? {} : { recordId: diagnostic.cardId }),
    message: diagnostic.message,
  };
}

export function auditLiveShelves(
  shelves: readonly JourneyShelf[] = JOURNEY_SHELVES,
): LiveShelfAudit {
  const findings: AuditFinding[] = [];
  const cards: ShelfCard[] = [];
  for (const { journey, shelf, laterEvidence } of shelves) {
    const all = [...shelf, ...laterEvidence];
    const byId = new Map(all.map((card) => [card.id, card]));
    // The shelf displays its parallel-work cards as parallel work, and a 1905 import only on the
    // journey that declares it.
    const admittedImports = shelf.filter((card) => card.admittedImport).map((card) => card.id);
    for (const card of shelf) {
      cards.push(shelfCard(card, true));
      for (const d of validateCardIntrinsicRules(card, byId)) findings.push(finding(journey, d));
      for (const d of validateCardCitation(card, {
        stageId: "",
        isShelf: true,
        journeyId: journey,
        parallelWorkAcknowledged: true,
        journeyAdmittedImports: admittedImports,
      }))
        findings.push(finding(journey, d));
    }
    for (const card of laterEvidence) {
      cards.push(shelfCard(card, false));
      for (const d of validateCardIntrinsicRules(card, byId)) findings.push(finding(journey, d));
    }
  }
  const shelfReport = auditShelf({ cards });
  const report = summarize("audit-shelf", [...shelfReport.findings, ...findings], {
    total: cards.length,
    judged: cards.length,
    notYetAuditable: 0,
  });
  return { report, cards: cards.length, shelves: shelves.length };
}
