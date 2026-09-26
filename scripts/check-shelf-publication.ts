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
import { BROWNIAN_LATER_EVIDENCE, BROWNIAN_SHELF_CARDS } from "../src/content/brownianShelf.ts";
import {
  LIGHT_QUANTA_LATER_EVIDENCE,
  LIGHT_QUANTA_SHELF_CARDS,
} from "../src/content/lightQuantaShelf.ts";
import {
  MASS_ENERGY_LATER_EVIDENCE,
  MASS_ENERGY_SHELF_CARDS,
} from "../src/content/massEnergyShelf.ts";
import { SPECIAL_RELATIVITY_SHELF_CARDS } from "../src/content/specialRelativityShelf.ts";
import { KnowledgeCardView } from "../src/discovery/cards/KnowledgeCard.tsx";
import {
  checkShelfPublication,
  type JourneyCards,
} from "../src/discovery/cards/shelfPublication.ts";

/** Every card a journey page renders: its shelf, and the later evidence beside its check. */
export const JOURNEY_CARDS: readonly JourneyCards[] = [
  { journey: "light-quanta", cards: [...LIGHT_QUANTA_SHELF_CARDS, ...LIGHT_QUANTA_LATER_EVIDENCE] },
  { journey: "brownian-motion", cards: [...BROWNIAN_SHELF_CARDS, ...BROWNIAN_LATER_EVIDENCE] },
  { journey: "special-relativity", cards: SPECIAL_RELATIVITY_SHELF_CARDS },
  { journey: "mass-energy", cards: [...MASS_ENERGY_SHELF_CARDS, ...MASS_ENERGY_LATER_EVIDENCE] },
];

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
