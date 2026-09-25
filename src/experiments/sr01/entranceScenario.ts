/**
 * SR-01 clock-entrance scenario evaluation.
 *
 * Sits behind the experiments seam so the no-algebra clock entrance receives an evaluated
 * result instead of calling the reference owner itself. AGENTS.md Doctrine 4: kernels own the
 * law, and a reader surface never reaches across the layer that hands it computed state.
 * The reader module src/reader/entrances/clockExample.ts re-exports this and holds no physics.
 * Spec: am-ymr5.
 */
import { synchronizationRound } from "../../physics/reference/events.ts";
import { refusalSentence } from "../results/refusalSentence.ts";
import { SR01_DEFAULTS } from "./definition.ts";
import { validateSr01Parameters } from "./parameters.ts";
import { encodeSr01Settings } from "./permalink.ts";

export type ClockReadings = Readonly<{ departure: number; reception: number }>;
export type ClockExample = Readonly<{
  readings: ClockReadings;
  assigned: number;
  elapsed: number;
  separationLs: number;
  labHref: string;
  movingPairHref: string;
}>;
export type ClockExampleResult =
  | Readonly<{ kind: "ready"; example: ClockExample }>
  | Readonly<{ kind: "refused"; message: string }>;

/** The teaching input is a round-trip record, not a measurement of one-way speed. */
export function clockExample(input: ClockReadings): ClockExampleResult {
  if (
    !input ||
    !Number.isFinite(input.departure) ||
    !Number.isFinite(input.reception) ||
    Math.abs(input.departure) > 1e6 ||
    Math.abs(input.reception) > 1e6
  ) {
    return {
      kind: "refused",
      message: "Use finite clock readings between minus one million and one million seconds.",
    };
  }
  const readings = Object.freeze({ departure: input.departure, reception: input.reception });
  const elapsed = readings.reception - readings.departure;
  if (elapsed <= 0)
    return {
      kind: "refused",
      message: "The return must be later than the departure. The accepted example has not changed.",
    };
  // Choose a stationary light-second separation that reproduces the supplied round trip in SR-01.
  // This constructs an ideal-model handoff; it does not infer a measured distance or one-way time.
  const separationLs = elapsed / 2;
  const result = synchronizationRound({
    emissionTimeA: readings.departure,
    receptionTimeA: readings.reception,
    separationLs,
  });
  if (result.status !== "value" || !Number.isFinite(result.value.assignedRemoteTime)) {
    return {
      kind: "refused",
      message:
        "The clock owner cannot represent this round trip. The accepted example has not changed.",
    };
  }
  const parameters = {
    ...SR01_DEFAULTS,
    stationSeparationLs: separationLs,
    emissionTimeA: readings.departure,
    clockOffsetB: 0,
    rodBeta: 0,
    pairSeparationLs: separationLs,
    pairBeta: 0,
    frameBeta: 0,
  };
  // The example links into SR-01, so it is held to SR-01's declared ranges: a round trip under two
  // microseconds would hand the laboratory a separation below the millionth of a light-second it
  // admits, and the reader would follow a link the laboratory refuses.
  for (const handoff of [parameters, { ...parameters, pairBeta: 0.6 }]) {
    const checked = validateSr01Parameters(handoff);
    if (checked.kind !== "accepted")
      return {
        kind: "refused",
        message: `The laboratory cannot take this round trip. ${refusalSentence(checked.refusal)} The accepted example has not changed.`,
      };
  }
  return {
    kind: "ready",
    example: Object.freeze({
      readings,
      elapsed,
      separationLs,
      assigned: result.value.assignedRemoteTime,
      labHref: `/lab/sr-01/${encodeSr01Settings(parameters)}`,
      movingPairHref: `/lab/sr-01/${encodeSr01Settings({ ...parameters, pairBeta: 0.6 })}`,
    }),
  };
}

export function requireClockExample(readings: ClockReadings): ClockExample {
  const result = clockExample(readings);
  if (result.kind !== "ready") throw new Error(result.message);
  return result.example;
}

/** Blank and partially parsed numbers must not silently become zero or a valid prefix. */
export function parseClockDraft(departure: string, reception: string): ClockExampleResult {
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
  if (![departure, reception].every((text) => text.length <= 64 && decimal.test(text.trim()))) {
    return {
      kind: "refused",
      message:
        "Enter two complete decimal clock readings. Blank or partly numeric text is not a reading.",
    };
  }
  return clockExample({ departure: Number(departure), reception: Number(reception) });
}
export const CLOCK_WORKED_EXAMPLES = Object.freeze([
  requireClockExample({ departure: 0, reception: 10 }),
  requireClockExample({ departure: 20, reception: 30 }),
]);
export const CLOCK_INITIAL = CLOCK_WORKED_EXAMPLES[0]!;
