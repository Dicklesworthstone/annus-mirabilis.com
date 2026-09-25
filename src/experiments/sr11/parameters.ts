import { type DomainDisplay, withinDeclaredDomain } from "../controls/declaredDomain.ts";
import { optionalNumber } from "../controls/typedNumber.ts";
import { makeRefusal } from "../results/refusals.ts";
import { SR11_DEFAULTS, type Sr11Parameters } from "./definition.ts";

export type Sr11ParameterCheck =
  | { kind: "accepted"; data: Sr11Parameters }
  | { kind: "refused"; refusal: ReturnType<typeof makeRefusal> };

function validateSr11Fields(input: unknown): Sr11ParameterCheck {
  if (input === null || typeof input !== "object") {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["beta"] }),
    };
  }
  const o = input as Record<string, unknown>;
  const beta = typeof o.beta === "number" ? o.beta : Number.NaN;
  const incidentAngleDeg = typeof o.incidentAngleDeg === "number" ? o.incidentAngleDeg : Number.NaN;
  // The default when a setting is absent; a present value that is not a number reaches the checks
  // below as NaN and is refused by name, rather than swapped for 1.0 (dispatch 184).
  const incidentEnergyDensity = optionalNumber(o, "incidentEnergyDensity", 1.0);
  const mirrorArea = optionalNumber(o, "mirrorArea", 1.0);

  // A speed that is not a number is not a speed at or above c: it gets its own sentence.
  if (!Number.isFinite(beta)) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["beta"] },
        { details: { requirements: "Enter the mirror velocity β as a number." } },
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
  // The density's and the area's ranges are the manifest's, checked once by withinDeclaredDomain.
  if (!Number.isFinite(incidentEnergyDensity)) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["incidentEnergyDensity"] },
        {
          details: { requirements: "Enter the incident energy density u as a number, in J/m³." },
        },
      ),
    };
  }
  if (!Number.isFinite(mirrorArea)) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["mirrorArea"] },
        {
          details: { requirements: "Enter the mirror surface area as a number, in m²." },
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

/** Each declared setting as the form names it. */
const SR11_DOMAIN_DISPLAY: Readonly<Record<string, DomainDisplay>> = {
  beta: { label: "mirror velocity β", unit: "c" },
  incidentAngleDeg: { label: "incident angle φ" },
  incidentEnergyDensity: { label: "incident energy density u" },
  mirrorArea: { label: "mirror surface area" },
};

/** The fields above, then every range content/experiments/sr-11.yaml declares (dispatch 184). */
export function validateSr11Parameters(input: unknown): Sr11ParameterCheck {
  return withinDeclaredDomain("sr-11", validateSr11Fields(input), SR11_DOMAIN_DISPLAY);
}

export { SR11_DEFAULTS };
