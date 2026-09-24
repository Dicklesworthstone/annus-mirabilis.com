/**
 * The rapidity adder of foundation:hyperbolic-functions-rapidity (am-found-linear-geometry-7w15):
 * two speeds along one line, their rapidities, the sum of the rapidities, and the speed that sum
 * stands for, beside the relativity paper's §5 composition and the plain Galilean sum. Pure and
 * throw-free. Speeds are fractions of c and are never called beta.
 */
import { readSpeedRatio } from "./boostMap.ts";

export interface RapiditySum {
  readonly first: number;
  readonly second: number;
  readonly firstRapidity: number;
  readonly secondRapidity: number;
  readonly rapiditySum: number;
  /** tanh of the summed rapidity: the combined speed as a fraction of c. */
  readonly combined: number;
  /** §5's rule, (u + w)/(1 + uw), computed without any hyperbolic function. */
  readonly composition: number;
  /** The Galilean sum u + w, which can pass 1. */
  readonly galilean: number;
}

export type RapidityOutcome =
  | { readonly status: "added"; readonly sum: RapiditySum }
  | { readonly status: "refused"; readonly message: string };

/** Adds two speeds along one line through their rapidities. */
export function addSpeeds(first: number, second: number): RapiditySum {
  const firstRapidity = Math.atanh(first);
  const secondRapidity = Math.atanh(second);
  const rapiditySum = firstRapidity + secondRapidity;
  return {
    first,
    second,
    firstRapidity,
    secondRapidity,
    rapiditySum,
    combined: Math.tanh(rapiditySum),
    composition: (first + second) / (1 + first * second),
    galilean: first + second,
  };
}

/** Reads two typed speeds and adds them, or says which one could not be used. */
export function addTypedSpeeds(firstText: string, secondText: string): RapidityOutcome {
  const first = readSpeedRatio(firstText);
  if (first.kind === "refused")
    return { status: "refused", message: `First speed: ${first.message}` };
  const second = readSpeedRatio(secondText);
  if (second.kind === "refused")
    return { status: "refused", message: `Second speed: ${second.message}` };
  return { status: "added", sum: addSpeeds(first.value, second.value) };
}
