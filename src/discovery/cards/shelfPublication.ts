/**
 * THE SHELF PUBLICATION GATE THE BUILD RUNS (scripts/check-shelf-publication.ts, from
 * package.json prepare:content). am-disc-knowledge-cards-iw8j closed on the claim that production
 * builds refuse an unverified cited card; checkPublicationGate had no caller outside its own test,
 * so nothing in any build looked at the 30 unverified cards the four journeys serve.
 *
 * The rule the build enforces (TanElk, dispatch 136): a journey may show an unverified card only
 * as awaiting verification, and may show a card as verified only when the gate passes it. So for
 * every card a journey renders:
 *
 * - claims-unrecorded-verification: a card that carries any verification field carries a
 *   complete record. A verifier's name and a locator with no verification date is a claim, not a
 *   record. (argument.ts refuses the same partial record on a historical premise.)
 * - unverified-shown-as-verified / unverified-without-marker: when checkPublicationGate refuses
 *   the card, its rendering says "Awaiting verification" and never "Verified against original
 *   source".
 * - verified-shown-as-awaiting: when the gate passes the card, its rendering says it is verified.
 *
 * The rendering is the real component's (the caller passes it), so this compares what a reader
 * is shown with the gate's verdict. While CardDetail derives its display from isCardVerified, the
 * two agree by construction, and the second and third rules watch for the day a component shows
 * verification some other way.
 */
import { checkPublicationGate, isCardVerified } from "./publicationGate.ts";
import type { KnowledgeCard } from "./types.ts";

export const AWAITING_MARKER = "Awaiting verification";
export const VERIFIED_MARKER = "Verified against original source";

export type JourneyCards = Readonly<{ journey: string; cards: readonly KnowledgeCard[] }>;

export type ShelfPublicationRule =
  | "claims-unrecorded-verification"
  | "unverified-shown-as-verified"
  | "unverified-without-marker"
  | "verified-shown-as-awaiting";

export type ShelfPublicationProblem = Readonly<{
  journey: string;
  cardId: string;
  rule: ShelfPublicationRule;
  message: string;
}>;

export type ShelfPublicationResult = Readonly<{
  checked: number;
  verified: number;
  awaiting: number;
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
  let awaiting = 0;
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
      const html = render(card);
      const showsVerified = html.includes(VERIFIED_MARKER);
      const showsAwaiting = html.includes(AWAITING_MARKER);
      if (gate.ok) {
        verified++;
        if (!showsVerified)
          problem(
            "verified-shown-as-awaiting",
            "The gate passes this card, but its rendering does not say it is verified.",
          );
      } else {
        awaiting++;
        if (showsVerified)
          problem(
            "unverified-shown-as-verified",
            `The gate refuses this card, and its rendering says "${VERIFIED_MARKER}".`,
          );
        if (!showsAwaiting)
          problem(
            "unverified-without-marker",
            `The gate refuses this card, and its rendering does not say "${AWAITING_MARKER}".`,
          );
      }
    }
  }
  return { checked, verified, awaiting, problems };
}
