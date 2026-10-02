/**
 * The build's shelf publication gate (package.json prepare:content; see
 * src/discovery/cards/shelfPublication.ts for the rules). Renders every card each discovery
 * journey shows, through the component the journeys use, and refuses the build when a card's
 * rendering shows verification status (either way), or the card carries half a verification
 * record.
 *
 * Exit 1 on any problem, and on an empty population: a gate that checked no cards has not found
 * them honest.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JOURNEY_CARDS } from "../src/discovery/cards/journeyCards.ts";
import { KnowledgeCardView } from "../src/discovery/cards/KnowledgeCard.tsx";
import { checkShelfPublication } from "../src/discovery/cards/shelfPublication.ts";

/** Every card a journey page renders: its shelf, and the later evidence beside its check. */
export { JOURNEY_CARDS };

if (import.meta.main) {
  const result = checkShelfPublication(JOURNEY_CARDS, (card) =>
    renderToStaticMarkup(createElement(KnowledgeCardView, { card })),
  );
  console.log(
    `[shelf publication] ${result.checked} cards on ${JOURNEY_CARDS.length} journeys: ` +
      `${result.verified} with a complete verification record, ${result.unverified} without, ` +
      `${result.problems.length} problems`,
  );
  for (const p of result.problems)
    console.error(`  ${p.journey} ${p.cardId} ${p.rule}: ${p.message}`);
  if (result.checked === 0 || result.problems.length > 0) process.exit(1);
}
