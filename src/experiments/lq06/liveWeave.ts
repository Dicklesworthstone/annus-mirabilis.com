import type { WeavePredicate } from "../weave/types.ts";

/** The correspondence and quantities come from LQ-06's accepted host calculation.
 * This lab assumes Wien's law; it does not certify a Planck/Wien tolerance at these settings. */
export const LQ06_LIVE_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "lq06-s6-entropy-match",
    instrumentId: "lq-06",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s6-p1-s2"]),
    pointerText:
      "The selected exponent plays the part of the gas particle count in the two entropy formulas. This is an algebraic correspondence under the assumed Wien law; the comparison gas need not contain that many particles, and the correspondence alone does not establish how light is emitted or absorbed.",
    conditions: Object.freeze([
      Object.freeze({ kind: "regime" as const, on: "correspondenceVerdict", equals: "1" }),
      Object.freeze({
        kind: "status" as const,
        quantityId: "entropyVolumeCoefficient",
        equals: "value" as const,
      }),
      Object.freeze({
        kind: "status" as const,
        quantityId: "gasEntropyVolumeCoefficient",
        equals: "value" as const,
      }),
    ]),
  }),
  Object.freeze({
    id: "lq06-s6-effective-count",
    instrumentId: "lq-06",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s6-p6-s1"]),
    pointerText:
      "The accepted calculation displays an effective independent count and the energy of one quantum. Read the paper's qualification: low-density monochromatic radiation behaves thermodynamically as if it consisted of independent quanta within Wien's regime. These model quantities are not a count of detected photons.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "status" as const,
        quantityId: "effectiveIndependentCount",
        equals: "value" as const,
      }),
      Object.freeze({
        kind: "status" as const,
        quantityId: "quantumEnergy",
        equals: "value" as const,
      }),
    ]),
  }),
  Object.freeze({
    id: "lq06-s6-mean-quantum-energy",
    instrumentId: "lq-06",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s6-p3-s2"]),
    pointerText:
      "The accepted comparison places the mean quantum energy of an entire assumed Wien spectrum beside a molecule's mean kinetic energy at the same temperature. It is not the energy of the single frequency selected above, and it is not an integration of the full Planck spectrum.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "status" as const,
        quantityId: "meanQuantumEnergyWienEv",
        equals: "value" as const,
      }),
      Object.freeze({
        kind: "status" as const,
        quantityId: "moleculeMeanKineticEnergyEv",
        equals: "value" as const,
      }),
    ]),
  }),
]);
