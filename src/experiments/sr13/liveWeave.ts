import type { WeavePredicate } from "../weave/types.ts";

/** Source pointers read accepted scalar results; finite energies do not prove a limit. */
export const SR13_LIVE_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "sr13-force-convention",
    instrumentId: "sr-13",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s10-p8-s1"]),
    pointerText:
      "The accepted longitudinal and transverse masses compare force conventions for the same particle and initial speed. This passage explains why changing the definitions of force and acceleration changes the quoted masses. Switching the convention leaves the calculated trajectory unchanged.",
    conditions: Object.freeze(
      ["longitudinalMass", "transverseMassComoving", "transverseMassLaboratory"].map((quantityId) =>
        Object.freeze({
          kind: "threshold" as const,
          quantityId,
          direction: "at-least" as const,
          enter: 0,
          exit: 0,
        }),
      ),
    ),
  }),
  Object.freeze({
    id: "sr13-infinite-energy",
    instrumentId: "sr-13",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s10-p11-s1"]),
    pointerText:
      "The accepted relativistic and Newtonian energies evaluate the work needed to reach the selected initial speed. This passage states the relativistic law's infinite-energy limit at light speed. Every admitted speed here is below light speed: a finite sample illustrates that law without establishing its infinite limit or measuring a real particle.",
    conditions: Object.freeze(
      ["kineticEnergy", "kineticEnergyNewtonian"].map((quantityId) =>
        Object.freeze({
          kind: "threshold" as const,
          quantityId,
          direction: "at-least" as const,
          enter: 0,
          exit: 0,
        }),
      ),
    ),
  }),
]);
