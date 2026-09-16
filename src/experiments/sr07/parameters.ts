import { makeRefusal } from "../results/refusals.ts";
import {
  SR07_DEFAULTS,
  type Sr07EquationId,
  type Sr07Parameters,
  type Sr07Polarization,
  type Sr07UnitLayer,
  type Sr07Wave,
} from "./definition.ts";

export type Sr07ParameterCheck =
  | { kind: "accepted"; data: Sr07Parameters }
  | { kind: "refused"; refusal: ReturnType<typeof makeRefusal> };

const EQUATIONS: readonly Sr07EquationId[] = [
  "ampere-x",
  "ampere-y",
  "ampere-z",
  "faraday-x",
  "faraday-y",
  "faraday-z",
];
const WAVES: readonly Sr07Wave[] = ["plus-x", "minus-x", "plus-y", "oblique"];
const POLS: readonly Sr07Polarization[] = ["primary", "secondary"];
const UNITS: readonly Sr07UnitLayer[] = ["printed-gaussian", "modern-si"];

export function validateSr07Parameters(input: unknown): Sr07ParameterCheck {
  const bad = (requirements: string) => ({
    kind: "refused" as const,
    refusal: makeRefusal("invalid-parameter", {}, { details: { requirements } }),
  });
  if (!input || typeof input !== "object") return bad("Use a complete parameter record.");
  const keys = Object.keys(SR07_DEFAULTS);
  if (
    Reflect.ownKeys(input).length !== keys.length ||
    Reflect.ownKeys(input).some((k) => typeof k !== "string" || !keys.includes(k))
  )
    return bad("Use complete known data fields.");
  const p = input as Sr07Parameters;
  if (
    !EQUATIONS.includes(p.equationId) ||
    !WAVES.includes(p.wave) ||
    !POLS.includes(p.polarization)
  )
    return bad("Choose an admitted equation, wave, and polarization.");
  if (!UNITS.includes(p.unitLayer)) return bad("Choose printed Gaussian or modern SI.");
  if (!Number.isInteger(p.stepIndex) || p.stepIndex < 0 || p.stepIndex > 5)
    return bad("Step index is an integer from 0 through 5.");
  if (!Number.isFinite(p.boostBeta)) return bad("Boost speed must be finite.");
  if (Math.abs(p.boostBeta) >= 1) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "superluminal-observer",
        { parameterIds: ["boostBeta"] },
        {
          rankedRepairs: [
            { label: "Use 0.6 of light speed.", action: { parameterId: "boostBeta", value: 0.6 } },
          ],
        },
      ),
    };
  }
  if (Math.abs(p.boostBeta) > 0.95) return bad("Validation boosts stay inside |v/c| ≤ 0.95.");
  return { kind: "accepted", data: Object.freeze({ ...p }) };
}
