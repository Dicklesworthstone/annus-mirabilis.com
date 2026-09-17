/**
 * Knowledge Card & Shelf Rules Validators.
 *
 * Implements the 13 canonical card rules for the discovery framework,
 * ensuring 1904 epistemic boundaries are strictly enforced and typed refusals
 * are generated for out-of-order citations.
 *
 * Specification: am-disc-knowledge-cards-iw8j, am-ep-discovery-33u
 */

import { evaluateShelfDate } from "../../content/checks/epistemic/shelfDate.ts";
import type { CardRuleDiagnostic, KnowledgeCard, VerificationQueueItem } from "./types.ts";

export type StageCitationContext = Readonly<{
  stageId: string;
  journeyId?: string | undefined;
  parallelWorkAcknowledged?: boolean | undefined;
  journeyAdmittedImports?: readonly string[] | undefined;
  isDesk?: boolean | undefined;
  isShelf?: boolean | undefined;
}>;

/**
 * Normalizes text for proposition comparison (rule 8).
 */
export function normalizeProposition(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Validates a single knowledge card record against intrinsic card rules.
 */
export function validateCardIntrinsicRules(
  card: KnowledgeCard,
  allCardsMap?: ReadonlyMap<string, KnowledgeCard> | undefined,
): readonly CardRuleDiagnostic[] {
  const diagnostics: CardRuleDiagnostic[] = [];

  // Rule 10: Event kind required
  if (!card.date.eventKind) {
    diagnostics.push({
      severity: "error",
      rule: "card-event-kind-missing",
      cardId: card.id,
      message: `Card "${card.id}" is missing date.eventKind. Expected "presented", "published", or "performed".`,
      repair: 'Add date.eventKind: "presented" | "published" | "performed".',
    });
  } else if (!["presented", "published", "performed"].includes(card.date.eventKind)) {
    diagnostics.push({
      severity: "error",
      rule: "card-invalid-event-kind",
      cardId: card.id,
      message: `Card "${card.id}" has invalid eventKind "${card.date.eventKind}". Timeline kinds like dated-letter, awarded, appointed are forbidden on premises.`,
      repair: 'Use one of: "presented", "published", "performed".',
    });
  }

  // Rule 7: Date consistency
  const dateLatest = card.date.latest;
  const dateEarliest = card.date.earliest;
  const latestYear = card.date.latestYear;

  if (dateEarliest && dateLatest && dateEarliest > dateLatest) {
    diagnostics.push({
      severity: "error",
      rule: "card-date-earliest-after-latest",
      cardId: card.id,
      message: `Card "${card.id}" has earliest date "${dateEarliest}" after latest date "${dateLatest}".`,
      repair: "Ensure earliest date does not exceed latest date.",
    });
  }

  const expectedYear = parseInt(dateLatest.slice(0, 4), 10);
  if (!Number.isNaN(expectedYear) && latestYear !== expectedYear) {
    diagnostics.push({
      severity: "error",
      rule: "card-latest-year-mismatch",
      cardId: card.id,
      message: `Card "${card.id}" latestYear (${latestYear}) does not equal year of date.latest (${expectedYear}).`,
      repair: `Set date.latestYear to ${expectedYear}.`,
    });
  }

  if (card.status === "available") {
    if (!card.admittedImport && latestYear > 1904) {
      diagnostics.push({
        severity: "error",
        rule: "card-available-year-exceeded",
        cardId: card.id,
        message: `Card "${card.id}" has status "available" with latestYear ${latestYear} > 1904. Must be <= 1904 or flagged as admittedImport / parallel-work.`,
        repair: 'Change status to "parallel-work" or "later", or declare admittedImport if 1905.',
      });
    } else if (card.admittedImport && latestYear !== 1905) {
      diagnostics.push({
        severity: "error",
        rule: "card-available-year-exceeded",
        cardId: card.id,
        message: `Admitted import card "${card.id}" must have latestYear 1905 (got ${latestYear}).`,
        repair: "Set latestYear to 1905 for admitted 1905 imports.",
      });
    }
  } else if (card.status === "parallel-work") {
    if (latestYear < 1905) {
      diagnostics.push({
        severity: "error",
        rule: "card-parallel-work-too-early",
        cardId: card.id,
        message: `Parallel-work card "${card.id}" has latestYear ${latestYear} < 1905. Work available in 1904 or earlier must have status "available".`,
        repair: 'Change status to "available".',
      });
    }
  }

  // Rule 11: Prior event is prior
  if (card.priorEvent) {
    if (card.priorEvent.latest && dateLatest && card.priorEvent.latest > dateLatest) {
      diagnostics.push({
        severity: "error",
        rule: "card-prior-event-not-prior",
        cardId: card.id,
        message: `Card "${card.id}" priorEvent latest (${card.priorEvent.latest}) is after date latest (${dateLatest}).`,
        repair: "Ensure priorEvent occurred on or before public availability date.",
      });
    }
  }

  // Rule 11 (reciprocal relatedCardId)
  if (card.relatedCardId && allCardsMap) {
    const related = allCardsMap.get(card.relatedCardId);
    if (!related) {
      diagnostics.push({
        severity: "error",
        rule: "card-related-card-not-found",
        cardId: card.id,
        message: `Card "${card.id}" references relatedCardId "${card.relatedCardId}" which does not exist.`,
        repair: "Ensure relatedCardId matches an existing card id.",
      });
    } else if (related.relatedCardId !== card.id) {
      diagnostics.push({
        severity: "error",
        rule: "card-related-card-not-reciprocal",
        cardId: card.id,
        message: `Card "${card.id}" links to relatedCardId "${card.relatedCardId}", but "${card.relatedCardId}" does not link back to "${card.id}".`,
        repair: `Set relatedCardId: "${card.id}" on card "${card.relatedCardId}".`,
      });
    }
  }

  // Rule 12: Parallel work names what made it unavailable
  if (card.status === "parallel-work") {
    if (!card.parallelWorkBasis?.trim()) {
      diagnostics.push({
        severity: "error",
        rule: "card-parallel-basis-missing",
        cardId: card.id,
        message: `Card "${card.id}" has status "parallel-work" but is missing parallelWorkBasis.`,
        repair:
          "Add parallelWorkBasis explaining what boundary or publication date placed it beyond 1904.",
      });
    }
  }

  // Rule 5: Einstein knowledge claims
  if (card.claimsEinsteinKnew) {
    if (!card.einsteinKnowledgeEvidence || card.einsteinKnowledgeEvidence.length === 0) {
      diagnostics.push({
        severity: "error",
        rule: "card-einstein-knowledge-missing-citation",
        cardId: card.id,
        message: `Card "${card.id}" claims Einstein knew this premise, but lacks einsteinKnowledgeEvidence citations.`,
        repair: "Provide documentary citations in einsteinKnowledgeEvidence.",
      });
    }
  }

  // Rule 5 review flag: Prose claiming Einstein knew
  const textToCheck = `${card.proposition} ${card.limits ?? ""}`;
  const einsteinKnewRegex = /\beinstein (?:knew|read|was aware|studied|understood)\b/i;
  if (einsteinKnewRegex.test(textToCheck)) {
    diagnostics.push({
      severity: "warning",
      rule: "card-einstein-knowledge-in-proposition",
      cardId: card.id,
      message: `Card "${card.id}" contains phrasing implying Einstein's knowledge in proposition/limits.`,
      repair: "Move knowledge claims to einsteinKnowledgeEvidence with a citation.",
    });
  }

  return diagnostics;
}

/**
 * Validates a citation of a knowledge card from a stage, desk object, or shelf.
 */
export function validateCardCitation(
  card: KnowledgeCard,
  context: StageCitationContext,
  knownStages?: ReadonlySet<string> | undefined,
): readonly CardRuleDiagnostic[] {
  const diagnostics: CardRuleDiagnostic[] = [];

  // Rule 4: Later cards stay off shelves and stage premises
  if (card.status === "later") {
    if (context.isShelf || context.isDesk || context.stageId) {
      diagnostics.push({
        severity: "refusal",
        rule: "card-later-on-shelf",
        cardId: card.id,
        stageId: context.stageId,
        message: `Later confirmation card "${card.id}" cannot be cited as a 1904 stage premise or placed on a 1904 shelf/desk.`,
        repair: 'Place on timeline or in "check it against the world" section instead.',
      });
      return diagnostics;
    }
  }

  // Rule 6: Desk is strictly 1904
  if (context.isDesk && card.admittedImport) {
    diagnostics.push({
      severity: "refusal",
      rule: "card-admitted-import-desk-forbidden",
      cardId: card.id,
      page: "desk-1904",
      message: `Admitted 1905 import card "${card.id}" cannot be placed on the /1904 desk. The desk is strictly 1904.`,
      repair: "Remove 1905 import from 1904 desk.",
    });
    return diagnostics;
  }

  // Rule 1 / Rule 13: Stage acceptance and shelf date violation.
  // One implementation: evaluateShelfDate. priorEvent is ignored; only latestYear counts.
  const admitted =
    card.admittedImport === true
      ? true
      : card.admittedImport && typeof card.admittedImport === "object"
        ? {
            resultId: card.id,
            declaringJourney: card.admittedImport.declaringJourney,
          }
        : undefined;
  const shelfDecision = evaluateShelfDate(
    {
      id: context.stageId,
      kind: "chain",
      parallelWorkAcknowledged: context.parallelWorkAcknowledged,
    },
    {
      id: card.id,
      status: card.status,
      latestYear: card.date.latestYear,
      admittedImport: admitted,
    },
    context.journeyId
      ? {
          id: context.journeyId,
          admittedImports: context.journeyAdmittedImports,
        }
      : undefined,
  );
  if (!shelfDecision.ok) {
    diagnostics.push({
      severity: "refusal",
      rule: "shelf-date-violation",
      cardId: card.id,
      stageId: context.stageId,
      message: `Shelf date violation: card "${card.id}" (latestYear ${card.date.latestYear}) is not admitted to stage "${context.stageId}" (${shelfDecision.reason}).`,
      repair: shelfDecision.repair,
    });
  }

  // Rule 1: Parallel-work requires parallelWorkAcknowledged
  if (card.status === "parallel-work") {
    if (!context.parallelWorkAcknowledged) {
      diagnostics.push({
        severity: "refusal",
        rule: "card-parallel-work-unacknowledged",
        cardId: card.id,
        stageId: context.stageId,
        message: `Parallel-work card "${card.id}" cited by stage "${context.stageId}" without parallelWorkAcknowledged: true.`,
        repair: "Stage must acknowledge parallel work (parallelWorkAcknowledged: true).",
      });
    }
  }

  // Rule 1: Admitted import journey constraints
  if (card.admittedImport) {
    const declaringJourney =
      typeof card.admittedImport === "object" ? card.admittedImport.declaringJourney : undefined;

    if (declaringJourney && context.journeyId && declaringJourney !== context.journeyId) {
      diagnostics.push({
        severity: "error",
        rule: "card-admitted-import-invalid-journey",
        cardId: card.id,
        stageId: context.stageId,
        message: `Admitted import "${card.id}" declared for journey "${declaringJourney}" cannot be cited in journey "${context.journeyId}".`,
        repair: `Cite only in "${declaringJourney}".`,
      });
    }

    if (context.journeyAdmittedImports && !context.journeyAdmittedImports.includes(card.id)) {
      diagnostics.push({
        severity: "error",
        rule: "card-admitted-import-undeclared",
        cardId: card.id,
        stageId: context.stageId,
        message: `Journey "${context.journeyId}" cites admitted import "${card.id}" without declaring it in admittedImports.`,
        repair: `Add "${card.id}" to journey admittedImports list.`,
      });
    }
  }

  // Rule 2: Permission in both directions
  if (context.stageId) {
    if (!card.admittedStages?.includes(context.stageId)) {
      diagnostics.push({
        severity: "error",
        rule: "card-missing-citing-stage",
        cardId: card.id,
        stageId: context.stageId,
        message: `Stage "${context.stageId}" cites card "${card.id}", but card does not list stage in admittedStages.`,
        repair: `Add "${context.stageId}" to card.admittedStages.`,
      });
    }
  }

  // Validate that card's admittedStages only name known stages
  if (knownStages && card.admittedStages) {
    for (const stage of card.admittedStages) {
      if (!knownStages.has(stage)) {
        diagnostics.push({
          severity: "error",
          rule: "card-unknown-admitted-stage",
          cardId: card.id,
          stageId: stage,
          message: `Card "${card.id}" lists unknown stage/desk object "${stage}" in admittedStages.`,
          repair: `Remove unknown stage "${stage}" from admittedStages or declare the stage.`,
        });
      }
    }
  }

  return diagnostics;
}

/**
 * Validates a corpus of cards for duplicates (Rule 8).
 */
export function checkDuplicateCards(
  cards: readonly KnowledgeCard[],
): readonly CardRuleDiagnostic[] {
  const diagnostics: CardRuleDiagnostic[] = [];
  const seen = new Map<string, KnowledgeCard>();

  for (const card of cards) {
    const primarySource = card.sources[0];
    const sourceKey =
      typeof primarySource === "string"
        ? primarySource
        : primarySource && typeof primarySource === "object"
          ? (primarySource as { title?: string; locator?: string }).title ||
            JSON.stringify(primarySource)
          : "";
    const normProp = normalizeProposition(card.proposition);
    const key = `${sourceKey}::${normProp}`;

    const other = seen.get(key);
    if (other) {
      diagnostics.push({
        severity: "error",
        rule: "card-duplicate-premise",
        cardId: card.id,
        message: `Cards "${card.id}" and "${other.id}" appear to be duplicate premises with identical source and proposition.`,
        repair: `Merge "${card.id}" and "${other.id}" into a single journey-neutral card listing all admittedStages.`,
      });
    } else {
      seen.set(key, card);
    }
  }

  return diagnostics;
}

/**
 * Validates a card against open verification queue items (Rule 9).
 */
export function checkVerificationQueueRule(
  card: KnowledgeCard,
  queueItems: readonly VerificationQueueItem[],
): readonly CardRuleDiagnostic[] {
  const diagnostics: CardRuleDiagnostic[] = [];
  const openItems = queueItems.filter(
    (item) => item.status === "open" && item.cards.includes(card.id),
  );

  const isVerified = Boolean(card.verification || card.verifier);

  if (openItems.length > 0 && isVerified) {
    for (const item of openItems) {
      diagnostics.push({
        severity: "error",
        rule: "card-open-queue-blocks-verification",
        cardId: card.id,
        message: `Card "${card.id}" has an open verification queue item "${item.id}" ("${item.question}") and cannot carry a verification record.`,
        repair: `Settle question "${item.id}" (mark resolved/narrowed) before verifying "${card.id}".`,
      });
    }
  }

  return diagnostics;
}
