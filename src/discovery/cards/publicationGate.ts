/**
 * Publication Gate for Knowledge Cards.
 *
 * Implements Rule 3:
 * - Production and preview profiles fail when a published discovery journey,
 *   stage, desk object, timeline entry, or world check cites an unverified card.
 * - Draft profile permits unverified cards with a visible research marker.
 *
 * Specification: am-disc-knowledge-cards-iw8j, am-ep-discovery-33u
 */

import type { BuildProfile, CardRuleDiagnostic, KnowledgeCard } from "./types.ts";

export const UNVERIFIED_RESEARCH_MARKER = "Unverified research-queue card";

/**
 * Determines whether a card carries a valid verification record.
 */
export function isCardVerified(card: KnowledgeCard): boolean {
  if (card.verification) {
    return Boolean(
      card.verification.verifiedBy &&
        card.verification.date &&
        card.verification.evidenceLocator &&
        card.verification.method,
    );
  }
  return Boolean(card.verifier && (card.dateVerified || card.date) && card.evidenceLocator);
}

export type PublicationGateCitation = Readonly<{
  cardId: string;
  citedBy: string;
  sourceType: "journey-stage" | "desk-object" | "timeline-entry" | "world-check";
}>;

/**
 * Evaluates the publication gate for a set of cited cards under the specified build profile.
 */
export function checkPublicationGate(
  cardsMap: ReadonlyMap<string, KnowledgeCard>,
  citations: readonly PublicationGateCitation[],
  profile: BuildProfile,
): { ok: boolean; diagnostics: readonly CardRuleDiagnostic[] } {
  const diagnostics: CardRuleDiagnostic[] = [];

  for (const citation of citations) {
    const card = cardsMap.get(citation.cardId);
    if (!card) {
      diagnostics.push({
        severity: "error",
        rule: "card-unverified-in-production",
        cardId: citation.cardId,
        stageId: citation.citedBy,
        message: `Cited card "${citation.cardId}" could not be found in knowledge cards index.`,
      });
      continue;
    }

    const verified = isCardVerified(card);

    if (!verified) {
      if (profile === "production" || profile === "preview") {
        diagnostics.push({
          severity: "error",
          rule: "card-unverified-in-production",
          cardId: card.id,
          stageId: citation.citedBy,
          message: `Publication Gate Refusal: Unverified card "${card.id}" cited by ${citation.sourceType} "${citation.citedBy}" cannot be published in ${profile} profile.`,
          repair: `Verify card "${card.id}" against original library scan / bound volume before publication.`,
        });
      } else {
        // Draft profile: permitted with a warning / research-queue marker
        diagnostics.push({
          severity: "warning",
          rule: "card-unverified-in-production",
          cardId: card.id,
          stageId: citation.citedBy,
          message: `Draft build: Card "${card.id}" is an ${UNVERIFIED_RESEARCH_MARKER}.`,
        });
      }
    }
  }

  const hasErrors = diagnostics.some((d) => d.severity === "error");
  return {
    ok: !hasErrors,
    diagnostics,
  };
}
