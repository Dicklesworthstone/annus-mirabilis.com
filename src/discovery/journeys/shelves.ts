/**
 * The four shelves, re-exported in one place so `realJourneys.ts` names each paper's cards once.
 *
 * A journey's `shelf` is a list of card ids, and the ids live with the cards. Re-exporting rather than
 * copying them keeps one source: a card renamed in its own file reaches the journey record without
 * anyone remembering this file exists.
 */
export { BROWNIAN_SHELF_CARDS } from "../../content/brownianShelf.ts";
export { LIGHT_QUANTA_SHELF_CARDS } from "../../content/lightQuantaShelf.ts";
export { MASS_ENERGY_SHELF_CARDS } from "../../content/massEnergyShelf.ts";
export { SPECIAL_RELATIVITY_SHELF_CARDS } from "../../content/specialRelativityShelf.ts";

import { BROWNIAN_SHELF_CARDS } from "../../content/brownianShelf.ts";
import { LIGHT_QUANTA_SHELF_CARDS } from "../../content/lightQuantaShelf.ts";
import { MASS_ENERGY_SHELF_CARDS } from "../../content/massEnergyShelf.ts";
import { SPECIAL_RELATIVITY_SHELF_CARDS } from "../../content/specialRelativityShelf.ts";
import type { CardLookupContext } from "../checks/journeyChecks.ts";

/** Every card on the four shelves, in one list. */
export const ALL_SHELF_CARDS = Object.freeze([
  ...LIGHT_QUANTA_SHELF_CARDS,
  ...BROWNIAN_SHELF_CARDS,
  ...SPECIAL_RELATIVITY_SHELF_CARDS,
  ...MASS_ENERGY_SHELF_CARDS,
]);

/**
 * The card catalogue `checkJourney` needs to apply the 1904 shelf rule, keyed by card id.
 *
 * Without it the rule has nothing to look a card up in and stays silent, which is how the rule came
 * to examine zero cards in the first place: `checkJourney(journey)` was called with no options at all.
 * Built here rather than in the test so every caller of the gate gets the same catalogue, and the only
 * fields carried are the three the rule reads -- date, status and the card's own admitted-import
 * block. Nothing reader-facing passes through.
 */
export const SHELF_CARD_CONTEXT: CardLookupContext = Object.freeze(
  Object.fromEntries(
    ALL_SHELF_CARDS.map((card) => [
      card.id,
      Object.freeze({
        id: card.id,
        ...(card.date === undefined ? {} : { date: { latestYear: card.date.latestYear } }),
        status: card.status,
        ...(card.admittedImport === undefined ? {} : { admittedImport: card.admittedImport }),
      }),
    ]),
  ),
);
