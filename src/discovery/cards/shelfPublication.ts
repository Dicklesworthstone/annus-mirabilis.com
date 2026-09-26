/**
 * THE SHELF PUBLICATION GATE THE BUILD RUNS (scripts/check-shelf-publication.ts, from
 * package.json prepare:content). am-disc-knowledge-cards-iw8j closed on the claim that production
 * builds refuse an unverified cited card; checkPublicationGate had no caller outside its own test,
 * so nothing in any build looked at the 30 unverified cards the four journeys serve.
 *
 * The rule the build enforces. Until dispatch 243 it was TanElk's of dispatch 136: a journey
 * showed an unverified card as "Awaiting verification" and a verified one as "Verified against
 * original source". The owner's D-2026-09-25-no-review-status-banners removed that category of
 * reader copy ("messages like this ... detract from the site and the experience and aren't
 * meaningful"), so the rule is now the reverse. For every card a journey renders:
 *
 * - claims-unrecorded-verification: a card that carries any verification field carries a
 *   complete record. A verifier's name and a locator with no verification date is a claim, not a
 *   record. (argument.ts refuses the same partial record on a historical premise.) The record is
 *   the audit trail and stays in the data; this rule keeps it honest.
 * - shows-verification-status: the rendering says neither marker, whether the gate passes the
 *   card or not. A verified card may show its locator and printed citation, as sources; it may not
 *   say it is verified.
 *
 * The rendering is the real component's (the caller passes it). The markers are the two lines
 * CardDetail printed; src/app/discover/noVerificationStatus.test.tsx reads the whole pages for the
 * same category in any wording.
 */
import { checkPublicationGate, isCardVerified } from "./publicationGate.ts";
import type { KnowledgeCard } from "./types.ts";

export const AWAITING_MARKER = "Awaiting verification";
export const VERIFIED_MARKER = "Verified against original source";

export type JourneyCards = Readonly<{ journey: string; cards: readonly KnowledgeCard[] }>;

export type ShelfPublicationRule = "claims-unrecorded-verification" | "shows-verification-status";

export type ShelfPublicationProblem = Readonly<{
  journey: string;
  cardId: string;
  rule: ShelfPublicationRule;
  message: string;
}>;

export type ShelfPublicationResult = Readonly<{
  checked: number;
  verified: number;
  unverified: number;
  problems: readonly ShelfPublicationProblem[];
}>;

/** Does the card carry any part of a verification record? */
export function claimsVerification(card: KnowledgeCard): boolean {
  return Boolean(card.verification || card.verifier || card.dateVerified || card.evidenceLocator);
}

export function checkShelfPublication(
  journeys: readonly JourneyCards[],
  render: (card: KnowledgeCard) => string,
): ShelfPublicationResult {
  const problems: ShelfPublicationProblem[] = [];
  let checked = 0;
  let verified = 0;
  let unverified = 0;
  for (const { journey, cards } of journeys) {
    const byId = new Map(cards.map((card) => [card.id, card]));
    for (const card of cards) {
      checked++;
      const problem = (rule: ShelfPublicationRule, message: string) =>
        problems.push({ journey, cardId: card.id, rule, message });
      if (claimsVerification(card) && !isCardVerified(card))
        problem(
          "claims-unrecorded-verification",
          "The card carries part of a verification record but not a complete one: a verifier, a verification date and a locator, or a full verification block.",
        );
      const gate = checkPublicationGate(
        byId,
        [{ cardId: card.id, citedBy: journey, sourceType: "journey-stage" }],
        "production",
      );
      if (gate.ok) verified++;
      else unverified++;
      const html = render(card);
      for (const marker of [VERIFIED_MARKER, AWAITING_MARKER])
        if (html.includes(marker))
          problem(
            "shows-verification-status",
            `The rendering says "${marker}"; reader copy carries no verification status (D-2026-09-25-no-review-status-banners).`,
          );
    }
  }
  return { checked, verified, unverified, problems };
}
