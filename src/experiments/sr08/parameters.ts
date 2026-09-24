import { C_SI, type Sr08Input } from "../../physics/reference/fields.ts";
import { withinDeclaredDomain } from "../controls/declaredDomain.ts";
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

/** What each field is called on the page, with its unit, for the sentence a refusal shows. */
const SR08_FIELD_NAMES: Readonly<Record<string, string>> = {
  electricFieldX: "the electric field Ex, in V/m,",
  electricFieldY: "the electric field Ey, in V/m,",
  electricFieldZ: "the electric field Ez, in V/m,",
  magneticFieldX: "the magnetic field Bx, in T,",
  magneticFieldY: "the magnetic field By, in T,",
  magneticFieldZ: "the magnetic field Bz, in T,",
  boost: "the boost v/c",
  testCharge: "the test charge, in C,",
  chargeVelocityX: "the charge's velocity vx, in m/s,",
  chargeVelocityY: "the charge's velocity vy, in m/s,",
  chargeVelocityZ: "the charge's velocity vz, in m/s,",
  detectorSpeed: "the detector speed, in m/s,",
};
/** One field with its unit ("the electric field Ey, in V/m,"), or several by name alone ("the
 * electric field Ey and the magnetic field Bz"), since unit phrases inside a list do not read. */
function listNames(names: readonly string[]): string {
  if (names.length === 1) return names[0] ?? "";
  const bare = names.map((n) => n.replace(/, in [^,]+,$/, "").replace(/,$/, ""));
  return `${bare.slice(0, -1).join(", ")} and ${bare[bare.length - 1]}`;
}

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

function validateSr08Fields(input: unknown): Sr08ParameterCheck {
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
            requirements: `Enter ${listNames(invalid.map((k) => SR08_FIELD_NAMES[k] ?? k))} as ${invalid.length === 1 ? "a number" : "numbers"}.`,
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

/**
 * The fields above, then every range content/experiments/sr-08.yaml declares (dispatch 134). The
 * boost is stored in m/s and typed as a fraction of c, so its sentence is written in c.
 */
export function validateSr08Parameters(input: unknown): Sr08ParameterCheck {
  return withinDeclaredDomain("sr-08", validateSr08Fields(input), {
    boost: { label: "Boost speed", unit: "c", scale: 1 / C_SI },
  });
}
