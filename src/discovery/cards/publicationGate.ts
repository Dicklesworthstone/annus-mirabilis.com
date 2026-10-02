/**
 * Publication Gate for Knowledge Cards.
 *
 * Rule 3, as a function: checkPublicationGate refuses an unverified cited card under the
 * production and preview profiles, and permits it under draft with a research marker.
 * NO BUILD REFUSES ON IT: the build counts the refusals as unverified (see the note at the end of
 * this file, am-rc1001-bridge-plan-pcjk.12).
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
  return Boolean(card.verifier && card.dateVerified && card.evidenceLocator);
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

/*
 * WHY NO BUILD REFUSES ON THE GATE (am-rc1001-bridge-plan-pcjk.12). Until 2026-10-02 this file's
 * header said production and preview builds "fail" on an unverified card, and none did. The build's
 * shelf check (scripts/check-shelf-publication.ts, through shelfPublication.ts) calls
 * checkPublicationGate for every card a journey renders and COUNTS the refusals as unverified; it
 * fails the build only on a partial verification record, or on verification status in reader copy.
 * Measured 2026-10-02: 46 cards, 0 verified, because a verification names a reviewer and
 * docs/OWNERS.md names none who could verify them, so refusing would refuse every release. The
 * refusal belongs on the launch profile, which is not yet distinct from preview (am-qsm9).
 * shelfPublication.test.ts holds the counting behaviour, so this note and the build cannot drift
 * apart again. The note is at the end because tests cite this file's throw sites by line.
 */
