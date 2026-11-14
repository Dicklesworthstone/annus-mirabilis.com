import type { WeavePredicate } from "../weave/types.ts";

/**
 * These pointers read the event owner's accepted classifications and measurements. In
 * particular, a simultaneous coordinate separation is not a rod length unless the owner
 * also says that the two readings lie on the rod's ends. No geometry is recomputed here.
 */
export const SR03_LIVE_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "sr03-s2-simultaneity-relativity",
    instrumentId: "sr-03",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s2-p8-s1"]),
    pointerText:
      "Compare the accepted time separations and simultaneity labels for the same two events in K and k.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "status" as const,
        quantityId: "temporalSeparationK",
        equals: "value" as const,
      }),
      Object.freeze({
        kind: "status" as const,
        quantityId: "temporalSeparationKPrime",
        equals: "value" as const,
      }),
      Object.freeze({
        kind: "status" as const,
        quantityId: "simultaneityK",
        equals: "value" as const,
      }),
      Object.freeze({
        kind: "status" as const,
        quantityId: "simultaneityKPrime",
        equals: "value" as const,
      }),
    ]),
  }),
  Object.freeze({
    id: "sr03-s4-rod-measurement",
    instrumentId: "sr-03",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s2-p2-s5"]),
    pointerText:
      "These accepted readings lie on the rod's two ends and are simultaneous in the selected measuring frame. Their separation is that frame's rod length; a pair of unrelated platform marks would not measure the rod.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "status" as const,
        quantityId: "measuredLength",
        equals: "value" as const,
      }),
      Object.freeze({ kind: "regime" as const, on: "readingsOnRodEnds", equals: "1" }),
    ]),
  }),
  Object.freeze({
    id: "sr03-s4-sphere-ellipsoid",
    instrumentId: "sr-03",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s4-p1-s4"]),
    pointerText:
      "The accepted three axes locate the sphere on a simultaneous coordinate slice. At zero relative speed the sphere is recovered; this is not the shape a camera photographs.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "status" as const,
        quantityId: "ellipsoidAxisLongitudinal",
        equals: "value" as const,
      }),
      Object.freeze({
        kind: "status" as const,
        quantityId: "ellipsoidAxisTransverseY",
        equals: "value" as const,
      }),
      Object.freeze({
        kind: "status" as const,
        quantityId: "ellipsoidAxisTransverseZ",
        equals: "value" as const,
      }),
    ]),
  }),
]);
