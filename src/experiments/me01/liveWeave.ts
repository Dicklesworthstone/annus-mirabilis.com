import type { WeavePredicate } from "../weave/types.ts";

/** Read the two balances and the owner's premise-dependent result, never the form's toggle. */
export const ME01_LIVE_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "me01-two-energy-balances",
    instrumentId: "me-01",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s0-p7-s3"]),
    pointerText:
      "The accepted rest-frame and moving-frame ledgers apply energy conservation to the same pair of opposite light pulses. The light-energy transformation is imported from the relativity paper; the body's internal energies remain symbolic.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "status" as const,
        quantityId: "lightComplexEnergyMoving",
        equals: "value" as const,
      }),
      Object.freeze({
        kind: "status" as const,
        quantityId: "emittedEnergyRestFrame",
        equals: "value" as const,
      }),
    ]),
  }),
  Object.freeze({
    id: "me01-unchanged-offset-premise",
    instrumentId: "me-01",
    meaning: "assumption-active" as const,
    targets: Object.freeze(["s0-p7-s9"]),
    pointerText:
      "The kinetic-energy difference is determined with the paper's premise that the additive constant C does not change during emission. The two unknown offsets can then cancel. The numerical result depends on that premise; it does not establish the premise experimentally.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "status" as const,
        quantityId: "kineticEnergyDifference",
        equals: "value" as const,
      }),
    ]),
  }),
  Object.freeze({
    id: "me01-offset-underdetermined",
    instrumentId: "me-01",
    meaning: "outside-selected-domain" as const,
    targets: Object.freeze(["s0-p7-s9"]),
    pointerText:
      "With C allowed to change during emission, the accepted result leaves the kinetic-energy difference underdetermined. The energy balances still stand, but the paper's cancellation no longer follows without the unchanged-offset premise stated here.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "status" as const,
        quantityId: "kineticEnergyDifference",
        equals: "underdetermined" as const,
      }),
    ]),
  }),
]);
