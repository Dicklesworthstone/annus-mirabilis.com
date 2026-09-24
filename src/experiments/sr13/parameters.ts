import { ELECTRON_MASS, ELEMENTARY_CHARGE } from "../../physics/reference/electron.ts";
import { withinDeclaredDomain } from "../controls/declaredDomain.ts";
import { optionalNumber } from "../controls/typedNumber.ts";
import { makeRefusal } from "../results/refusals.ts";
import { SR13_DEFAULTS, type Sr13Parameters } from "./definition.ts";

export type Sr13ParameterCheck =
  | { kind: "accepted"; data: Sr13Parameters }
  | { kind: "refused"; refusal: ReturnType<typeof makeRefusal> };

/** What each numeric setting is called on the page, with its unit, for a refusal's sentence. */
const SR13_FIELD_NAMES: Readonly<Record<string, string>> = {
  electricFieldX: "the electric field Ex, in V/m,",
  electricFieldY: "the electric field Ey, in V/m,",
  electricFieldZ: "the electric field Ez, in V/m,",
  magneticFieldX: "the magnetic field Bx, in T,",
  magneticFieldY: "the magnetic field By, in T,",
  magneticFieldZ: "the magnetic field Bz, in T,",
  initialDirectionDeg: "the initial direction, in degrees,",
  integrationInterval: "the integration interval, in seconds,",
  customCharge: "the particle's charge, in C,",
  customMass: "the particle's mass, in kg,",
};

function validateSr13Fields(input: unknown): Sr13ParameterCheck {
  if (input === null || typeof input !== "object") {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["initialSpeed"] }),
    };
  }
  const o = input as Record<string, unknown>;

  // Each optional setting keeps its default when absent. One that is present but not a finite
  // number is refused by name: these used to put the default back for NaN, Infinity or "abc",
  // without a word (dispatch 165).
  const fields = {
    electricFieldX: optionalNumber(o, "electricFieldX", SR13_DEFAULTS.electricFieldX),
    electricFieldY: optionalNumber(o, "electricFieldY", SR13_DEFAULTS.electricFieldY),
    electricFieldZ: optionalNumber(o, "electricFieldZ", SR13_DEFAULTS.electricFieldZ),
    magneticFieldX: optionalNumber(o, "magneticFieldX", SR13_DEFAULTS.magneticFieldX),
    magneticFieldY: optionalNumber(o, "magneticFieldY", SR13_DEFAULTS.magneticFieldY),
    magneticFieldZ: optionalNumber(o, "magneticFieldZ", SR13_DEFAULTS.magneticFieldZ),
    initialDirectionDeg: optionalNumber(
      o,
      "initialDirectionDeg",
      SR13_DEFAULTS.initialDirectionDeg,
    ),
    integrationInterval: optionalNumber(
      o,
      "integrationInterval",
      SR13_DEFAULTS.integrationInterval,
    ),
    customCharge: optionalNumber(o, "customCharge", -ELEMENTARY_CHARGE),
    customMass: optionalNumber(o, "customMass", ELECTRON_MASS),
  };
  const notNumber = Object.entries(fields).find(([, v]) => !Number.isFinite(v))?.[0];
  if (notNumber) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: [notNumber] },
        { details: { requirements: `Enter ${SR13_FIELD_NAMES[notNumber]} as a number.` } },
      ),
    };
  }
  const {
    electricFieldX,
    electricFieldY,
    electricFieldZ,
    magneticFieldX,
    magneticFieldY,
    magneticFieldZ,
    initialDirectionDeg,
    integrationInterval,
    customCharge,
    customMass,
  } = fields;
  if (customMass <= 0) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["customMass"] },
        { details: { requirements: "Enter a particle mass greater than 0 kg." } },
      ),
    };
  }

  const initialSpeed = typeof o.initialSpeed === "number" ? o.initialSpeed : Number.NaN;
  if (!Number.isFinite(initialSpeed) || Math.abs(initialSpeed) >= 1) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["initialSpeed"] },
        {
          details: {
            requirements:
              "Enter an initial speed below the speed of light, as a fraction of c between −1 and 1.",
          },
        },
      ),
    };
  }

  const forceConvention =
    o.forceConvention === "laboratory" ? ("laboratory" as const) : ("source" as const);
  const massLanguage = o.massLanguage === "modern" ? ("modern" as const) : ("1905" as const);
  const particle = o.particle === "custom" ? ("custom" as const) : ("electron" as const);

  let datasetOverlay = SR13_DEFAULTS.datasetOverlay;
  if (o.datasetOverlay === "kaufmann-1902-1906" || o.datasetOverlay === "bucherer-1908") {
    datasetOverlay = o.datasetOverlay;
  }

  return {
    kind: "accepted",
    data: Object.freeze({
      electricFieldX,
      electricFieldY,
      electricFieldZ,
      magneticFieldX,
      magneticFieldY,
      magneticFieldZ,
      initialSpeed,
      initialDirectionDeg,
      integrationInterval,
      forceConvention,
      massLanguage,
      particle,
      customCharge,
      customMass,
      datasetOverlay,
    }),
  };
}

/** The fields above, then every range content/experiments/sr-13.yaml declares (dispatch 134). */
export function validateSr13Parameters(input: unknown): Sr13ParameterCheck {
  return withinDeclaredDomain("sr-13", validateSr13Fields(input));
}

export { SR13_DEFAULTS };
