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
  const compatible = withLegacyMe03EmitterMass(input);
  if (compatible === null || typeof compatible !== "object") {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        {},
        { details: { requirements: "Use a complete parameter record." } },
      ),
    };
  }

  const o = compatible as Partial<Record<keyof Me03Parameters, unknown>>;

  const mode: Me03Mode =
    o.mode === "box-1906" ? "box-1906" : o.mode === "four-momentum" ? "four-momentum" : "1905";

  const L = optionalNumber(o, "emittedEnergy", ME03_DEFAULTS.emittedEnergy);
  if (!Number.isFinite(L) || L < 0 || (L === 0 && mode !== "four-momentum")) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["emittedEnergy"] },
        {
          details: {
            code: "nonfinite-input",
            requirements:
              mode === "four-momentum"
                ? "Enter the emitted energy L as zero or more, in joules."
                : "Enter the energy L given off as a number greater than zero, in joules.",
          },
        },
      ),
    };
  }

  // Links and tapes authored before the recoil lens did not specify an emitter mass.
  // Their settings acquire the visible 1 kg default; the owner checks the resulting energy
  // budget instead of silently increasing this mass to fit an old radiation-only example.
  const initialEmitterMass = optionalNumber(
    o,
    "initialEmitterMass",
    ME03_DEFAULTS.initialEmitterMass,
  );
  if (!Number.isFinite(initialEmitterMass) || initialEmitterMass <= 0) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["initialEmitterMass"] },
        {
          details: {
            requirements:
              "Enter the initial emitter rest mass M₀ as a number greater than zero, in kilograms.",
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
      initialEmitterMass,
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

/** Add only the new field to a complete older settings record; never repair supplied bad values. */
export function withLegacyMe03EmitterMass(input: unknown): unknown {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return null;
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(input);
  // Inspect descriptors before reading a value: replay settings are own-data records, not
  // class instances or an opportunity to invoke a getter while migrating an older schema.
  if (
    Reflect.ownKeys(descriptors).some((key) => {
      if (typeof key !== "string") return true;
      const descriptor = descriptors[key];
      return !descriptor || !Object.hasOwn(descriptor, "value");
    })
  )
    return null;
  const data = Object.fromEntries(
    Object.entries(descriptors).map(([key, descriptor]) => [key, descriptor.value]),
  );
  return Object.hasOwn(data, "initialEmitterMass")
    ? data
    : { ...data, initialEmitterMass: ME03_DEFAULTS.initialEmitterMass };
}

/** The form names the box length ℓ; the manifest's label spells it "ell". */
const ME03_DOMAIN_DISPLAY: Readonly<Record<string, DomainDisplay>> = {
  boxLength: { label: "box length ℓ" },
};

/** The fields above, then every range content/experiments/me-03.yaml declares (dispatch 134). */
export function validateMe03Parameters(input: unknown): Me03ParameterCheck {
  return withinDeclaredDomain("me-03", validateMe03Fields(input), ME03_DOMAIN_DISPLAY);
}
