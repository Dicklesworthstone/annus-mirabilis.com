import type { PaperE2EJourney } from "../paper-e2e-contract.ts";
import { BROWNIAN_MOTION_ACTIONS, BROWNIAN_MOTION_JOURNEY } from "./brownianMotion.ts";
import { LIGHT_QUANTA_ACTIONS, LIGHT_QUANTA_JOURNEY } from "./lightQuanta.ts";
import { MASS_ENERGY_ACTIONS, MASS_ENERGY_JOURNEY } from "./massEnergy.ts";
import { SPECIAL_RELATIVITY_ACTIONS, SPECIAL_RELATIVITY_JOURNEY } from "./specialRelativity.ts";
import type { JourneyActions } from "./steps.ts";

/*
 * EVERY PAPER'S JOURNEY, ONE ENTRY EACH (am-test-e2e-harness-bqmh).
 *
 * The runner asks this module which papers have scenario source and keeps its honest configuration
 * failure for the papers that do not, naming them. A paper is added here and nowhere else.
 */
export type PaperJourneyEntry = Readonly<{
  journey: PaperE2EJourney;
  actions: JourneyActions;
}>;

export const PAPER_JOURNEYS: readonly PaperJourneyEntry[] = Object.freeze([
  Object.freeze({ journey: MASS_ENERGY_JOURNEY, actions: MASS_ENERGY_ACTIONS }),
  Object.freeze({ journey: BROWNIAN_MOTION_JOURNEY, actions: BROWNIAN_MOTION_ACTIONS }),
  Object.freeze({ journey: LIGHT_QUANTA_JOURNEY, actions: LIGHT_QUANTA_ACTIONS }),
  Object.freeze({ journey: SPECIAL_RELATIVITY_JOURNEY, actions: SPECIAL_RELATIVITY_ACTIONS }),
]);
