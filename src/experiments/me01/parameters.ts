import { makeRefusal } from "../results/refusals.ts";
import {
  ME01_DEFAULTS,
  type Me01Notation,
  type Me01OffsetDisplay,
  type Me01Parameters,
  type Me01Premise,
  type Me01Step,
} from "./definition.ts";

export type Me01ParameterCheck =
  | { kind: "accepted"; data: Me01Parameters }
  | { kind: "refused"; refusal: ReturnType<typeof makeRefusal> };

export function validateMe01Parameters(input: unknown): Me01ParameterCheck {
  if (input === null || typeof input !== "object") {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        {},
        { details: { requirements: "Use a complete parameter record." } },
      ),
    };
  }

  const o = input as Partial<Record<keyof Me01Parameters, unknown>>;

  const beta = typeof o.frameSpeed === "number" ? o.frameSpeed : Number.NaN;
  if (!Number.isFinite(beta) || Math.abs(beta) >= 1) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["frameSpeed"] },
        {
          details: {
            code: "superluminal-observer",
            requirements:
              "Enter an observer speed v/c strictly between −1 and 1: no inertial observer moves at or above light speed.",
          },
        },
      ),
    };
  }

  const L = typeof o.emittedEnergyRestFrame === "number" ? o.emittedEnergyRestFrame : Number.NaN;
  if (!Number.isFinite(L) || L <= 0) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["emittedEnergyRestFrame"] },
        { details: { requirements: "Enter an emitted energy L greater than zero." } },
      ),
    };
  }

  const angle = typeof o.emissionAngle === "number" ? o.emissionAngle : Number.NaN;
  if (!Number.isFinite(angle)) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["emissionAngle"] },
        { details: { requirements: "Enter the emission angle φ as a number of degrees." } },
      ),
    };
  }

  const offsetDisplay: Me01OffsetDisplay = o.offsetDisplay === "offsets" ? "offsets" : "symbolic";

  const premise: Me01Premise = o.premise === "relaxed" ? "relaxed" : "unchanged";

  const validSteps: readonly Me01Step[] = [
    "intro",
    "moving-pulses",
    "sum-angle",
    "two-balances",
    "subtraction-move",
    "premise-kinetic",
  ];
  const step: Me01Step = validSteps.includes(o.step as Me01Step)
    ? (o.step as Me01Step)
    : "subtraction-move";
  const cancelAngleFactors = o.cancelAngleFactors !== false;
  const cancelInternalEnergies = o.cancelInternalEnergies !== false;
  const cancelAdditiveConstant = o.cancelAdditiveConstant !== false;

  const notation: Me01Notation = o.notation === "modern" ? "modern" : "printed";

  return {
    kind: "accepted",
    data: Object.freeze({
      frameSpeed: beta,
      emittedEnergyRestFrame: L,
      emissionAngle: angle,
      offsetDisplay,
      premise,
      step,
      cancelAngleFactors,
      cancelInternalEnergies,
      cancelAdditiveConstant,
      notation,
    }),
  };
}

export { ME01_DEFAULTS };
