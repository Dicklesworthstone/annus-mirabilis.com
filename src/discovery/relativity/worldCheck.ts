/**
 * Journey III's check against the world, prepared at build time (plan §9.1 item 7; dispatch 260).
 * Pages may not import physics owners (noPhysicsInComponents), so the numbers the page carries are
 * computed here, as Journey I's are (src/discovery/lightQuanta/worldCheck.ts).
 *
 * THE LIVE NUMBER is SR-05's own properTime, from the accepted snapshot of the laboratory embedded
 * beside the check. THE LATER MEASUREMENT it is set beside, Ives and Stilwell's of 1938, has no
 * HistoricalDataset in this edition (content/datasets holds none for it), so the page states the
 * comparison in words and prints no number of theirs.
 */

import { encodeResult } from "../../experiments/results/codec.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import {
  SR05_DEFAULTS,
  SR05_PRESETS,
  type Sr05Parameters,
} from "../../experiments/sr05/definition.ts";
import { evaluateSr05, type PreparedSr05Example } from "../../experiments/sr05/session.ts";
import example from "../../generated/sr05-example.json";

/** The preset the check opens at: one inertial clock at 0.6c for 10 s of the resting clocks. */
export const CHECK_PRESET_ID = "sr-05-inertial-0.6c";

const parameters: Sr05Parameters = {
  ...(SR05_PRESETS[CHECK_PRESET_ID]?.parameters ?? SR05_DEFAULTS),
};
const results = evaluateSr05(parameters);

/**
 * SR-05 at the check's preset, as a worked example a reader without JavaScript receives. It names
 * the same host source as the lab page's own example.
 */
export const MOVING_CLOCK_CHECK_EXAMPLE: PreparedSr05Example = Object.freeze({
  sourceDigest: example.sourceDigest,
  parameters,
  results: results.map(encodeResult),
  stepIndex: 0,
  simulationTime: 0,
});

const numberFor = (outputs: readonly ScientificResult[], id: string): number | undefined => {
  const found = outputs.find((o) => o.quantityId === id);
  return found?.status === "value" && typeof found.value === "number" ? found.value : undefined;
};

/** What the owner computes at the preset: the reading § 4's relation gives, for the static example. */
export const CLOCK_CHECK_READING = Object.freeze({
  speed: parameters.speed,
  properTime: numberFor(results, "properTime"),
  coordinateTime: numberFor(results, "coordinateTime"),
});
