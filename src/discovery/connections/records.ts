import { type AvogadroContentAvailability, buildAvogadroExercise } from "./avogadro.ts";
import { DOPPLER_EXERCISE } from "./doppler.ts";
import { EFFECTIVE_MASS_EXERCISE } from "./effectiveMass.ts";
import { STATISTICAL_EXERCISE } from "./statistical.ts";
import type { ConnectionExercise } from "./types.ts";

/** The laboratory and the printed-product exercise have separate evidence and source links. */
export function buildConnectionExercises(
  availability: AvogadroContentAvailability = {
    companionPresent: false,
    avogadroLabPresent: true,
  },
): readonly ConnectionExercise[] {
  return Object.freeze([
    buildAvogadroExercise(availability),
    DOPPLER_EXERCISE,
    EFFECTIVE_MASS_EXERCISE,
    STATISTICAL_EXERCISE,
  ]);
}

/** The same authored tasks feed the reader, course and search index. */
export const CROSS_JOURNEY_EXERCISES = buildConnectionExercises();

export { CONNECTION_EXERCISE_LINKS } from "./links.ts";
