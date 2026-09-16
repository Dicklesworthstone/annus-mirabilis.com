import { makeRefusal } from "../results/refusals.ts";
import { ME02_DEFAULTS, type Me02Parameters } from "./definition.ts";

export type Me02ParameterCheck =
  | { kind: "accepted"; data: Me02Parameters }
  | { kind: "refused"; refusal: ReturnType<typeof makeRefusal> };

export function validateMe02Parameters(input: unknown): Me02ParameterCheck {
  if (input === null || typeof input !== "object") {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["beta"] }),
    };
  }
  const o = input as Record<string, unknown>;
  const beta = typeof o.beta === "number" ? o.beta : Number.NaN;
  const emittedEnergy = typeof o.emittedEnergy === "number" ? o.emittedEnergy : Number.NaN;
  const energyUnit = o.energyUnit;
  const speedAxis = o.speedAxis;
  const showNaive = o.showNaive === true;
  const notation = o.notation === "modern" ? "modern" : "printed";
  if (!Number.isFinite(beta) || Math.abs(beta) >= 1) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["beta"] }),
    };
  }
  if (!Number.isFinite(emittedEnergy) || emittedEnergy <= 0) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["emittedEnergy"] }),
    };
  }
  if (energyUnit !== "normalized" && energyUnit !== "erg" && energyUnit !== "joule") {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["energyUnit"] }),
    };
  }
  if (speedAxis !== "linear" && speedAxis !== "logarithmic") {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["speedAxis"] }),
    };
  }
  return {
    kind: "accepted",
    data: Object.freeze({
      beta,
      emittedEnergy,
      energyUnit,
      speedAxis,
      showNaive,
      notation,
    }),
  };
}

export function me02InputFromParameters(p: Me02Parameters) {
  const speedOfLight = p.energyUnit === "normalized" ? 1 : 299792458;
  return { beta: p.beta, emittedEnergy: p.emittedEnergy, speedOfLight };
}

export { ME02_DEFAULTS };
