import { type DomainDisplay, withinDeclaredDomain } from "../controls/declaredDomain.ts";
import { optionalNumber } from "../controls/typedNumber.ts";
import { makeRefusal } from "../results/refusals.ts";
import {
  ME03_DEFAULTS,
  type Me03Boundary,
  type Me03CardId,
  type Me03Mode,
  type Me03Notation,
  type Me03Parameters,
  type Me03PulseSystem,
  type Me03RadiationDisposition,
} from "./definition.ts";

export type Me03ParameterCheck =
  | { kind: "accepted"; data: Me03Parameters }
  | { kind: "refused"; refusal: ReturnType<typeof makeRefusal> };

const VALID_BOUNDARIES: readonly Me03Boundary[] = [
  "body-alone",
  "radiation",
  "combined-isolated-system",
];

const VALID_DISPOSITIONS: readonly Me03RadiationDisposition[] = [
  "escapes",
  "retained",
  "partly-retained",
];

const VALID_CARDS: readonly Me03CardId[] = [
  "me-03-card-radium",
  "me-03-card-sun",
  "me-03-card-coal",
  "me-03-card-candle",
  "me-03-card-bulb",
  "me-03-heated-sealed-box",
  "me-03-sealed-lamp-and-mirror",
];

const VALID_PULSE_SYSTEMS: readonly Me03PulseSystem[] = [
  "single-pulse",
  "two-collinear",
  "two-opposite",
];

function validateMe03Fields(input: unknown): Me03ParameterCheck {
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

  const o = input as Partial<Record<keyof Me03Parameters, unknown>>;

  const L = optionalNumber(o, "emittedEnergy", ME03_DEFAULTS.emittedEnergy);
  if (!Number.isFinite(L) || L <= 0) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["emittedEnergy"] },
        {
          details: {
            code: "nonfinite-input",
            requirements: "Enter the energy L given off as a number greater than zero, in joules.",
          },
        },
      ),
    };
  }

  const inputE = optionalNumber(o, "inputEnergy", ME03_DEFAULTS.inputEnergy);
  if (!Number.isFinite(inputE) || inputE < 0) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["inputEnergy"] },
        {
          details: {
            code: "nonfinite-input",
            requirements: "Enter the energy taken in as zero or more, in joules.",
          },
        },
      ),
    };
  }

  const boundary: Me03Boundary = VALID_BOUNDARIES.includes(o.boundary as Me03Boundary)
    ? (o.boundary as Me03Boundary)
    : ME03_DEFAULTS.boundary;

  const disposition: Me03RadiationDisposition = VALID_DISPOSITIONS.includes(
    o.disposition as Me03RadiationDisposition,
  )
    ? (o.disposition as Me03RadiationDisposition)
    : ME03_DEFAULTS.disposition;

  const cardId: Me03CardId = VALID_CARDS.includes(o.cardId as Me03CardId)
    ? (o.cardId as Me03CardId)
    : ME03_DEFAULTS.cardId;

  const mode: Me03Mode =
    o.mode === "box-1906" ? "box-1906" : o.mode === "four-momentum" ? "four-momentum" : "1905";

  const pulseSystem: Me03PulseSystem = VALID_PULSE_SYSTEMS.includes(
    o.pulseSystem as Me03PulseSystem,
  )
    ? (o.pulseSystem as Me03PulseSystem)
    : ME03_DEFAULTS.pulseSystem;

  const notation: Me03Notation = o.notation === "modern" ? "modern" : "printed";

  const boxMass = optionalNumber(o, "boxMass", ME03_DEFAULTS.boxMass);
  if (!Number.isFinite(boxMass) || boxMass <= 0) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["boxMass"] },
        {
          details: {
            code: "nonfinite-input",
            requirements: "Enter a box mass M greater than zero, in kilograms.",
          },
        },
      ),
    };
  }

  const boxLength = optionalNumber(o, "boxLength", ME03_DEFAULTS.boxLength);
  if (!Number.isFinite(boxLength) || boxLength <= 0) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["boxLength"] },
        {
          details: {
            code: "nonfinite-input",
            requirements: "Enter a box length ℓ greater than zero, in metres.",
          },
        },
      ),
    };
  }

  const pulseEnergy = optionalNumber(o, "pulseEnergy", ME03_DEFAULTS.pulseEnergy);
  if (!Number.isFinite(pulseEnergy) || pulseEnergy <= 0) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["pulseEnergy"] },
        {
          details: {
            code: "nonfinite-input",
            requirements: "Enter a pulse energy E greater than zero, in joules.",
          },
        },
      ),
    };
  }

  const assignLightMass =
    typeof o.assignLightMass === "boolean" ? o.assignLightMass : ME03_DEFAULTS.assignLightMass;

  // A finite value goes through, so the declared domain (at least 1) refuses it by name; a value
  // that is not a finite number is refused here instead of putting the default back.
  const magnification = optionalNumber(o, "magnification", ME03_DEFAULTS.magnification);
  if (!Number.isFinite(magnification)) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["magnification"] },
        { details: { requirements: "Enter the magnification as a number." } },
      ),
    };
  }

  if (mode === "box-1906") {
    const c = 299792458;
    const domainRatio = pulseEnergy / (boxMass * c * c);
    if (domainRatio > 1e-3) {
      return {
        kind: "refused",
        refusal: makeRefusal(
          "invalid-parameter",
          { parameterIds: ["pulseEnergy", "boxMass"] },
          {
            details: {
              code: "outside-domain",
              requirements:
                "Enter a pulse energy E of at most a thousandth of Mc², the box's rest energy. The lab computes the recoil for a slowly moving box, and that approximation fails beyond this.",
            },
          },
        ),
      };
    }
  }

  return {
    kind: "accepted",
    data: Object.freeze({
      boundary,
      disposition,
      emittedEnergy: L,
      inputEnergy: inputE,
      cardId,
      mode,
      pulseSystem,
      notation,
      boxMass,
      boxLength,
      pulseEnergy,
      assignLightMass,
      magnification,
    }),
  };
}

export { ME03_DEFAULTS };

/** The form names the box length ℓ; the manifest's label spells it "ell". */
const ME03_DOMAIN_DISPLAY: Readonly<Record<string, DomainDisplay>> = {
  boxLength: { label: "box length ℓ" },
};

/** The fields above, then every range content/experiments/me-03.yaml declares (dispatch 134). */
export function validateMe03Parameters(input: unknown): Me03ParameterCheck {
  return withinDeclaredDomain("me-03", validateMe03Fields(input), ME03_DOMAIN_DISPLAY);
}
