import { makeRefusal } from "../results/refusals.ts";
import { SR11_DEFAULTS, type Sr11Parameters } from "./definition.ts";

export type Sr11ParameterCheck =
  | { kind: "accepted"; data: Sr11Parameters }
  | { kind: "refused"; refusal: ReturnType<typeof makeRefusal> };

export function validateSr11Parameters(input: unknown): Sr11ParameterCheck {
  if (input === null || typeof input !== "object") {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["beta"] }),
    };
  }
  const o = input as Record<string, unknown>;
  const beta = typeof o.beta === "number" ? o.beta : Number.NaN;
  const incidentAngleDeg = typeof o.incidentAngleDeg === "number" ? o.incidentAngleDeg : Number.NaN;
  const incidentEnergyDensity =
    typeof o.incidentEnergyDensity === "number" ? o.incidentEnergyDensity : 1.0;
  const mirrorArea = typeof o.mirrorArea === "number" ? o.mirrorArea : 1.0;

  if (!Number.isFinite(beta) || Math.abs(beta) >= 1) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["beta"] },
        {
          details: {
            requirements:
              "Enter a mirror speed below the speed of light, as a fraction of c between −1 and 1.",
          },
        },
      ),
    };
  }
  if (!Number.isFinite(incidentAngleDeg) || incidentAngleDeg < 0 || incidentAngleDeg > 180) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["incidentAngleDeg"] },
        {
          details: { requirements: "Enter an angle of incidence from 0° to 180°." },
        },
      ),
    };
  }
  if (!Number.isFinite(incidentEnergyDensity) || incidentEnergyDensity <= 0) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["incidentEnergyDensity"] },
        {
          details: { requirements: "Enter an incident energy density greater than zero, in J/m³." },
        },
      ),
    };
  }
  if (!Number.isFinite(mirrorArea) || mirrorArea <= 0) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["mirrorArea"] },
        {
          details: { requirements: "Enter a mirror area greater than zero, in m²." },
        },
      ),
    };
  }

  const frame = o.frame === "mirror" ? "mirror" : "lab";
  const unitLayer = o.unitLayer === "gaussian" ? "gaussian" : "si";

  return {
    kind: "accepted",
    data: Object.freeze({
      beta,
      incidentAngleDeg,
      incidentEnergyDensity,
      mirrorArea,
      frame,
      unitLayer,
    }),
  };
}

export { SR11_DEFAULTS };
