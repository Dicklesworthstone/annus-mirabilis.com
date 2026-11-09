import type { WeavePredicate } from "../weave/types.ts";

/**
 * A reading aid, not a physical boundary: the exact loss is already published by the
 * clock owner. At least a tenth of a second per platform second makes the difference
 * visible in the clock bars, for either direction of motion. No clock law is evaluated
 * here, and smaller nonzero speeds still have time dilation.
 */
export const SR05_LIVE_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "sr05-s4-moving-clock",
    instrumentId: "sr-05",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s4-p9-s2"]),
    pointerText:
      "The accepted moving clock loses at least one tenth of a second per platform second, making its slower rate visible here. This ten-percent display threshold is a reading aid; time dilation occurs at every nonzero speed.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "threshold" as const,
        quantityId: "dilationLossExact",
        direction: "at-least" as const,
        enter: 0.1,
        exit: 0.1,
      }),
    ]),
  }),
]);
