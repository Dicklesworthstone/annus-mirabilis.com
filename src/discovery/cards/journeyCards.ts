/**
 * The knowledge cards each discovery journey renders: its 1904 shelf, and the later evidence shown
 * beside its check against the world. One list, read by the build's publication check
 * (scripts/check-shelf-publication.ts), by verify-content's shelf audit and by
 * scripts/audit-shelf.ts, so the three cannot judge different populations.
 */
import { BROWNIAN_LATER_EVIDENCE, BROWNIAN_SHELF_CARDS } from "../../content/brownianShelf.ts";
import {
  LIGHT_QUANTA_LATER_EVIDENCE,
  LIGHT_QUANTA_SHELF_CARDS,
} from "../../content/lightQuantaShelf.ts";
import {
  MASS_ENERGY_LATER_EVIDENCE,
  MASS_ENERGY_SHELF_CARDS,
} from "../../content/massEnergyShelf.ts";
import {
  SPECIAL_RELATIVITY_LATER_EVIDENCE,
  SPECIAL_RELATIVITY_SHELF_CARDS,
} from "../../content/specialRelativityShelf.ts";
import type { JourneyCards } from "./shelfPublication.ts";
import type { KnowledgeCard } from "./types.ts";

export type JourneyShelf = Readonly<{
  journey: string;
  /** Cards a reader may use as premises: on the shelf, so dated by the end of 1904 or flagged. */
  shelf: readonly KnowledgeCard[];
  /** Later evidence, shown beside the check against the world and never used as a premise. */
  laterEvidence: readonly KnowledgeCard[];
}>;

export const JOURNEY_SHELVES: readonly JourneyShelf[] = [
  {
    journey: "light-quanta",
    shelf: LIGHT_QUANTA_SHELF_CARDS,
    laterEvidence: LIGHT_QUANTA_LATER_EVIDENCE,
  },
  {
    journey: "brownian-motion",
    shelf: BROWNIAN_SHELF_CARDS,
    laterEvidence: BROWNIAN_LATER_EVIDENCE,
  },
  {
    journey: "special-relativity",
    shelf: SPECIAL_RELATIVITY_SHELF_CARDS,
    laterEvidence: SPECIAL_RELATIVITY_LATER_EVIDENCE,
  },
  {
    journey: "mass-energy",
    shelf: MASS_ENERGY_SHELF_CARDS,
    laterEvidence: MASS_ENERGY_LATER_EVIDENCE,
  },
];

/** Every card a journey page renders, shelf and later evidence together. */
export const JOURNEY_CARDS: readonly JourneyCards[] = JOURNEY_SHELVES.map(
  ({ journey, shelf, laterEvidence }) => ({ journey, cards: [...shelf, ...laterEvidence] }),
);
