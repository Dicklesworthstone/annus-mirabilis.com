/**
 * Journey I's check against the world, prepared at build time (plan §9.1 item 7; dispatch 142).
 * Pages may not import physics owners (noPhysicsInComponents), so the numbers the page carries are
 * computed here.
 *
 * TWO NUMBERS, KEPT APART. The live one is LQ-08's own stoppingPotentialMagnitude, from the
 * accepted snapshot of the laboratory embedded beside the check, on today's constants: LQ-08's
 * constant set is fixed (LQ08_MODEL.constantSetId, modern-si-2019), and no preset can select the
 * printed 1905 set. The static one is the paper's §8 figure, recomputed by the owner from the
 * paper's own constants (einsteinPrintedStoppingCheck, representation A: R, β and the charge of a
 * gram-equivalent, with no electron charge). At the paper's frequency the two differ by about two
 * percent, and the page says which is which.
 */
import example from "../../generated/lq08-example.json";
import { LQ08_PRESETS, type Lq08Parameters } from "../../experiments/lq08/definition.ts";
import { evaluateLq08, type PreparedLq08Example } from "../../experiments/lq08/session.ts";
import { encodeResult } from "../../experiments/results/codec.ts";
import { einsteinPrintedStoppingCheck } from "../../physics/reference/photoelectric.ts";

const parameters: Lq08Parameters = { ...LQ08_PRESETS.historicalCheck.parameters };

/**
 * LQ-08 at the §8 check (preset lq-08-historical-check: 1.03 × 10¹⁵ s⁻¹, exit cost neglected), as
 * a worked example a reader without JavaScript receives. It names the same host source as the lab
 * page's own example.
 */
export const HISTORICAL_CHECK_EXAMPLE: PreparedLq08Example = Object.freeze({
  sourceDigest: example.sourceDigest,
  parameters,
  results: evaluateLq08(parameters).map(encodeResult),
  stepIndex: 0,
  simulationTime: 0,
});

const printed = einsteinPrintedStoppingCheck().representationA;

/** The paper's §8 stopping potential from its own constants, and how the paper prints it. */
export const PRINTED_STOPPING_CHECK = Object.freeze({
  volts: printed.stoppingPotentialVolts,
  printedText: printed.printedText,
  frequency: parameters.frequency,
  constantSetId: "einstein-1905-light-quanta-printed",
});
