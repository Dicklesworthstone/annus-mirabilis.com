import type { WeaveCondition, WeavePredicate } from "../weave/types.ts";

/** A finite accepted scalar, including a zero or a negative clock reading. */
function reading(quantityId: string): WeaveCondition {
  return Object.freeze({
    kind: "threshold",
    quantityId,
    direction: "at-least",
    enter: -Number.MAX_VALUE,
    exit: -Number.MAX_VALUE,
  });
}

/**
 * The midpoint is a definition. The round-trip reception in this ideal model is calculated
 * using c, so its returned speed is not independent experimental evidence for that postulate.
 * Clock-offset and moving-pair comparisons name their accepted readings without claiming a
 * successful synchronization or a nonzero disagreement merely because a number is present.
 */
export const SR01_LIVE_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "sr01-s1-midpoint-definition",
    instrumentId: "sr-01",
    meaning: "assumption-active" as const,
    targets: Object.freeze(["s1-p7-s4"]),
    pointerText:
      "The accepted assignment uses equal outward and return light-travel times to define the remote clock reading. The one-way speed remains not applicable as an independent measurement; changing the displayed observer frame does not change that convention.",
    conditions: Object.freeze([
      reading("assignedRemoteTime"),
      Object.freeze({
        kind: "status" as const,
        quantityId: "oneWayLightSpeed",
        equals: "not-applicable" as const,
      }),
    ]),
  }),
  Object.freeze({
    id: "sr01-s1-clock-criterion",
    instrumentId: "sr-01",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s1-p7-s6"]),
    pointerText:
      "The accepted criterion offset compares the independently set clock B with the midpoint rule. Zero satisfies this synchronization criterion; a nonzero offset shows how the chosen clock setting misses it.",
    conditions: Object.freeze([reading("assignedRemoteTime"), reading("criterionOffset")]),
  }),
  Object.freeze({
    id: "sr01-s1-round-trip-postulate",
    instrumentId: "sr-01",
    meaning: "assumption-active" as const,
    targets: Object.freeze(["s1-p10-s1"]),
    pointerText:
      "The accepted round-trip calculation uses the model's assumed light speed to set the reception time. It illustrates the round-trip relation in this passage; it is not an independent measurement of the speed or evidence for its universality.",
    conditions: Object.freeze([reading("roundTripSpeed")]),
  }),
  Object.freeze({
    id: "sr01-s2-moving-pair",
    instrumentId: "sr-01",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s2-p8-s1"]),
    pointerText:
      "The accepted moving-pair comparison gives the magnitude of the clocks' disagreement when judged at one platform time. This uses the transformation developed in section 3 to illustrate section 2's conclusion. At zero pair speed the disagreement is zero; the selected display frame does not replace the platform comparison.",
    conditions: Object.freeze([reading("desynchronization")]),
  }),
]);
