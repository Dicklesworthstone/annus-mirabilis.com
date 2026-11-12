import type { WeavePredicate } from "../weave/types.ts";

/** The owner publishes both the analytic limit and the finite-speed proxy's relative excess.
 * A small excess never turns a finite-speed value into the limiting mass coefficient. */
export const ME02_LIVE_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "me02-limiting-coefficient",
    instrumentId: "me-02",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s0-p12-s1"]),
    pointerText:
      "The accepted mass decrease is an analytic low-speed limit, L/c². It is not the finite-speed proxy obtained by dividing the exact kinetic-energy difference by one half of the speed squared. At zero speed the limit remains defined even though that finite-speed quotient is not applicable.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "status" as const,
        quantityId: "inertialMassDecrease",
        equals: "analytic-limit" as const,
      }),
    ]),
  }),
  Object.freeze({
    id: "me02-coefficient-stabilized",
    instrumentId: "me-02",
    meaning: "agreement-within-stated-bound" as const,
    targets: Object.freeze(["s0-p11-s1"]),
    pointerText:
      "The finite-speed mass proxy is close to the analytic limiting coefficient: this pointer enters at a relative excess of at most 0.1 percent and remains until the excess exceeds 0.2 percent. This display tolerance makes the low-speed approach visible; it does not make the quadratic approximation exact or supply experimental evidence.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "status" as const,
        quantityId: "inertialMassDecrease",
        equals: "analytic-limit" as const,
      }),
      Object.freeze({
        kind: "threshold" as const,
        quantityId: "proxyExcessOverLimit",
        direction: "at-most" as const,
        enter: 0.001,
        exit: 0.002,
      }),
    ]),
  }),
]);
