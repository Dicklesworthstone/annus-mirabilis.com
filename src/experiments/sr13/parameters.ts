import { ELECTRON_MASS, ELEMENTARY_CHARGE } from "../../physics/reference/electron.ts";
import { makeRefusal } from "../results/refusals.ts";
import { SR13_DEFAULTS, type Sr13Parameters } from "./definition.ts";

export type Sr13ParameterCheck =
  | { kind: "accepted"; data: Sr13Parameters }
  | { kind: "refused"; refusal: ReturnType<typeof makeRefusal> };

export function validateSr13Parameters(input: unknown): Sr13ParameterCheck {
  if (input === null || typeof input !== "object") {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["initialSpeed"] }),
    };
  }
  const o = input as Record<string, unknown>;

  const electricFieldX =
    typeof o.electricFieldX === "number" && Number.isFinite(o.electricFieldX)
      ? o.electricFieldX
      : SR13_DEFAULTS.electricFieldX;
  const electricFieldY =
    typeof o.electricFieldY === "number" && Number.isFinite(o.electricFieldY)
      ? o.electricFieldY
      : SR13_DEFAULTS.electricFieldY;
  const electricFieldZ =
    typeof o.electricFieldZ === "number" && Number.isFinite(o.electricFieldZ)
      ? o.electricFieldZ
      : SR13_DEFAULTS.electricFieldZ;

  const magneticFieldX =
    typeof o.magneticFieldX === "number" && Number.isFinite(o.magneticFieldX)
      ? o.magneticFieldX
      : SR13_DEFAULTS.magneticFieldX;
  const magneticFieldY =
    typeof o.magneticFieldY === "number" && Number.isFinite(o.magneticFieldY)
      ? o.magneticFieldY
      : SR13_DEFAULTS.magneticFieldY;
  const magneticFieldZ =
    typeof o.magneticFieldZ === "number" && Number.isFinite(o.magneticFieldZ)
      ? o.magneticFieldZ
      : SR13_DEFAULTS.magneticFieldZ;

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

  const initialDirectionDeg =
    typeof o.initialDirectionDeg === "number" && Number.isFinite(o.initialDirectionDeg)
      ? o.initialDirectionDeg
      : SR13_DEFAULTS.initialDirectionDeg;

  const integrationInterval =
    typeof o.integrationInterval === "number" &&
    Number.isFinite(o.integrationInterval) &&
    o.integrationInterval > 0
      ? o.integrationInterval
      : SR13_DEFAULTS.integrationInterval;

  const forceConvention =
    o.forceConvention === "laboratory" ? ("laboratory" as const) : ("source" as const);
  const massLanguage = o.massLanguage === "modern" ? ("modern" as const) : ("1905" as const);
  const particle = o.particle === "custom" ? ("custom" as const) : ("electron" as const);

  const customCharge =
    typeof o.customCharge === "number" && Number.isFinite(o.customCharge)
      ? o.customCharge
      : -ELEMENTARY_CHARGE;
  const customMass =
    typeof o.customMass === "number" && Number.isFinite(o.customMass) && o.customMass > 0
      ? o.customMass
      : ELECTRON_MASS;

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

export { SR13_DEFAULTS };
