import type { WeavePredicate } from "../weave/types.ts";
import { LQ08_MODEL, LQ08_PRESETS } from "./definition.ts";

/**
 * Read only the accepted photoelectric outputs. One stopping-potential point cannot establish
 * a slope or intensity independence, and the modern calculation is not a historical observation.
 */
export const LQ08_LIVE_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "lq08-s8-linear-frequency",
    instrumentId: "lq-08",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s8-p6-s1"]),
    pointerText:
      "The accepted stopping potential is one point on the line predicted by the assumed energy balance. One setting does not establish its slope or the same slope for different metals. Einstein's sentence states what would follow if that formula is correct.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "threshold" as const,
        quantityId: "stoppingPotentialMagnitude",
        direction: "at-least" as const,
        enter: 0,
        exit: 0,
      }),
    ]),
  }),
  Object.freeze({
    id: "lq08-s8-intensity-rate-independence",
    instrumentId: "lq-08",
    meaning: "assumption-active" as const,
    targets: Object.freeze(["s8-p7-s2"]),
    pointerText:
      "The model assumes that light quanta transfer energy independently. Its accepted rates use that assumption; one trial does not demonstrate intensity independence. Compare powers at fixed frequency, work function and quantum efficiency. This model gives only the maximum electron energy, not the full velocity distribution described in the sentence.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "threshold" as const,
        quantityId: "quantumRate",
        direction: "at-least" as const,
        enter: 0,
        exit: 0,
      }),
      Object.freeze({
        kind: "threshold" as const,
        quantityId: "emissionRate",
        direction: "at-least" as const,
        enter: 0,
        exit: 0,
      }),
    ]),
  }),
  Object.freeze({
    id: "lq08-s8-printed-stopping-check",
    instrumentId: "lq-08",
    meaning: "assumption-active" as const,
    targets: Object.freeze(["s8-p5-s1"]),
    pointerText:
      "At the accepted frequency of 1.03 × 10¹⁵ Hz and zero escape work, the calculation uses the neglected-escape-work assumption of Einstein's check. The live value uses modern SI constants; the paper's historical constants give about 4.3 V. This is not a measured result for a real metal or a comparison with Lenard's observations.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "regime" as const,
        on: "constantSet",
        equals: LQ08_MODEL.constantSetId,
      }),
      Object.freeze({
        kind: "regime" as const,
        on: "frequency",
        equals: String(LQ08_PRESETS.historicalCheck.parameters.frequency),
      }),
      Object.freeze({
        kind: "regime" as const,
        on: "workFunction",
        equals: String(LQ08_PRESETS.historicalCheck.parameters.workFunction),
      }),
      Object.freeze({
        kind: "threshold" as const,
        quantityId: "stoppingPotentialMagnitude",
        direction: "at-least" as const,
        enter: 0,
        exit: 0,
      }),
    ]),
  }),
]);
