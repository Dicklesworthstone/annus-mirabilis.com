import { C_SI, type Sr08Input } from "../../physics/reference/fields.ts";
import { makeRefusal } from "../results/refusals.ts";
import { SR08_DEFAULTS, type Sr08Parameters } from "./definition.ts";

export type Sr08ParameterCheck =
  | { kind: "accepted"; data: Sr08Parameters }
  | { kind: "refused"; refusal: ReturnType<typeof makeRefusal> };

const NUMBER_KEYS = [
  "electricFieldX",
  "electricFieldY",
  "electricFieldZ",
  "magneticFieldX",
  "magneticFieldY",
  "magneticFieldZ",
  "boost",
  "testCharge",
  "chargeVelocityX",
  "chargeVelocityY",
  "chargeVelocityZ",
  "detectorSpeed",
] as const;

/**
 * A missing or non-number field is not 0. Blank strings, null, and other
 * non-numbers become NaN and are refused below. Explicit numeric 0 is valid.
 */
function requiredNumber(
  record: Record<string, unknown>,
  key: (typeof NUMBER_KEYS)[number],
): number {
  const value = record[key];
  return typeof value === "number" ? value : Number.NaN;
}

export function validateSr08Parameters(input: unknown): Sr08ParameterCheck {
  if (input === null || typeof input !== "object") {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["boost"] }),
    };
  }
  const o = input as Record<string, unknown>;
  const numbers = {} as Record<(typeof NUMBER_KEYS)[number], number>;
  const invalid: string[] = [];
  for (const key of NUMBER_KEYS) {
    const value = requiredNumber(o, key);
    numbers[key] = value;
    if (!Number.isFinite(value)) invalid.push(key);
  }
  if (invalid.length > 0) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: invalid },
        {
          details: {
            requirements: "Enter every field component, speed and charge as a finite number.",
          },
        },
      ),
    };
  }
  if (Math.abs(numbers.boost) >= C_SI) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["boost"] },
        {
          details: {
            requirements:
              "Enter a frame speed below the speed of light: no inertial observer moves at or beyond c.",
          },
        },
      ),
    };
  }
  const uSpeed2 =
    numbers.chargeVelocityX * numbers.chargeVelocityX +
    numbers.chargeVelocityY * numbers.chargeVelocityY +
    numbers.chargeVelocityZ * numbers.chargeVelocityZ;
  if (uSpeed2 >= C_SI * C_SI) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["chargeVelocityX"] },
        {
          details: {
            requirements: "Enter a charge velocity whose speed is below the speed of light.",
          },
        },
      ),
    };
  }

  const unitLayer = o.unitLayer === "gaussian" ? "gaussian" : "si";
  const descriptionFrame = o.descriptionFrame === "moving" ? "moving" : "stationary";
  const decomposeComponents = o.decomposeComponents !== false;
  const detectorMotion = o.detectorMotion === true;

  return {
    kind: "accepted",
    data: Object.freeze({
      unitLayer,
      descriptionFrame,
      electricFieldX: numbers.electricFieldX,
      electricFieldY: numbers.electricFieldY,
      electricFieldZ: numbers.electricFieldZ,
      magneticFieldX: numbers.magneticFieldX,
      magneticFieldY: numbers.magneticFieldY,
      magneticFieldZ: numbers.magneticFieldZ,
      boost: numbers.boost,
      testCharge: numbers.testCharge,
      chargeVelocityX: numbers.chargeVelocityX,
      chargeVelocityY: numbers.chargeVelocityY,
      chargeVelocityZ: numbers.chargeVelocityZ,
      decomposeComponents,
      detectorMotion,
      detectorSpeed: numbers.detectorSpeed,
    }),
  };
}

export function sr08InputFromParameters(p: Sr08Parameters): Sr08Input {
  return {
    unitLayer: p.unitLayer,
    descriptionFrame: p.descriptionFrame,
    electricField: {
      x: p.electricFieldX,
      y: p.electricFieldY,
      z: p.electricFieldZ,
    },
    magneticField: {
      x: p.magneticFieldX,
      y: p.magneticFieldY,
      z: p.magneticFieldZ,
    },
    boost: p.boost,
    testCharge: p.testCharge,
    chargeVelocity: {
      x: p.chargeVelocityX,
      y: p.chargeVelocityY,
      z: p.chargeVelocityZ,
    },
    decomposeComponents: p.decomposeComponents,
    detectorMotion: p.detectorMotion,
    detectorSpeed: p.detectorSpeed,
  };
}

export { SR08_DEFAULTS };
