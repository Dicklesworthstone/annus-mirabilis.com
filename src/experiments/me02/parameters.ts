import { constantValue, convert, getConstantSet } from "../../physics/reference/constants.ts";
import { type DomainDisplay, withinDeclaredDomain } from "../controls/declaredDomain.ts";
import { makeRefusal } from "../results/refusals.ts";
import { ME02_DEFAULTS, type Me02Parameters } from "./definition.ts";

export type Me02ParameterCheck =
  | { kind: "accepted"; data: Me02Parameters }
  | { kind: "refused"; refusal: ReturnType<typeof makeRefusal> };

function validateMe02Fields(input: unknown): Me02ParameterCheck {
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
  // A speed that is not a number is not a speed at or above c: it gets its own sentence.
  if (!Number.isFinite(beta)) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["beta"] },
        { details: { requirements: "Enter the observer speed v/c as a number." } },
      ),
    };
  }
  if (Math.abs(beta) >= 1) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["beta"] },
        {
          details: {
            requirements:
              "Enter a speed below the speed of light, as a fraction of c between −1 and 1.",
          },
        },
      ),
    };
  }
  if (!Number.isFinite(emittedEnergy) || emittedEnergy <= 0) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["emittedEnergy"] },
        {
          details: { requirements: "Enter an emitted energy greater than zero." },
        },
      ),
    };
  }
  if (energyUnit !== "normalized" && energyUnit !== "erg" && energyUnit !== "joule") {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["energyUnit"] }),
    };
  }
  if (energyUnit === "erg" && convert(emittedEnergy, "erg", "J") === 0) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["emittedEnergy"] },
        {
          details: {
            requirements:
              "This many ergs is too small to express in joules; enter a larger energy.",
          },
        },
      ),
    };
  }
  if (
    (o.showNaive !== undefined && typeof o.showNaive !== "boolean") ||
    (o.notation !== undefined && o.notation !== "printed" && o.notation !== "modern")
  ) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["notation", "showNaive"] }),
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
  const speedOfLight =
    p.energyUnit === "normalized"
      ? 1
      : constantValue(getConstantSet("modern-si-2019"), "speedOfLight").value;
  const emittedEnergy =
    p.energyUnit === "erg" ? convert(p.emittedEnergy, "erg", "J") : p.emittedEnergy;
  return { beta: p.beta, emittedEnergy, speedOfLight };
}

export { ME02_DEFAULTS };

/** Each declared setting as the form names it; L is counted in the unit the reader chose. */
const ME02_DOMAIN_DISPLAY: Readonly<Record<string, DomainDisplay>> = {
  beta: { label: "observer speed v/c" },
  emittedEnergy: { label: "emitted energy L", unit: "" },
};

/** The fields above, then every range content/experiments/me-02.yaml declares (dispatch 134). */
export function validateMe02Parameters(input: unknown): Me02ParameterCheck {
  return withinDeclaredDomain("me-02", validateMe02Fields(input), ME02_DOMAIN_DISPLAY);
}
