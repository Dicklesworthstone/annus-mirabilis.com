import { C_SI, type Sr12Input } from "../../physics/reference/fields.ts";
import { withinDeclaredDomain } from "../controls/declaredDomain.ts";
import { makeRefusal } from "../results/refusals.ts";
import { SR12_DEFAULTS, type Sr12Parameters } from "./definition.ts";

export type Sr12ParameterCheck =
  | { kind: "accepted"; data: Sr12Parameters }
  | { kind: "refused"; refusal: ReturnType<typeof makeRefusal> };

/** What each field is called on the page, with its unit, for the sentence a refusal shows. */
const SR12_FIELD_NAMES: Readonly<Record<string, string>> = {
  chargeDensity: "the charge density ρ, in C/m³,",
  currentDensityX: "the current density Jx, in A/m²,",
  currentDensityY: "the current density Jy, in A/m²,",
  currentDensityZ: "the current density Jz, in A/m²,",
  carrierVelocityX: "the carrier velocity vx, in m/s,",
  carrierVelocityY: "the carrier velocity vy, in m/s,",
  carrierVelocityZ: "the carrier velocity vz, in m/s,",
  sphereRadius: "the sphere radius, in m,",
  sphereCharge: "the sphere charge, in C,",
  loopCurrent: "the loop current, in A,",
  loopLengthX: "the loop length along x, in m,",
  loopLengthY: "the loop length along y, in m,",
  pulseWidth: "the pulse width, in m,",
  pulseAmplitude: "the pulse amplitude",
};

/**
 * An optional setting: its default when absent, and NaN (refused by name below) when it is present
 * but not a number. It used to take the default for a present "abc" as well, without a word.
 */
function optionalNumber(o: Record<string, unknown>, key: string, fallback: number): number {
  if (!(key in o) || o[key] === undefined) return fallback;
  return typeof o[key] === "number" ? o[key] : Number.NaN;
}

function validateSr12Fields(input: unknown): Sr12ParameterCheck {
  if (input === null || typeof input !== "object") {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["boost"] }),
    };
  }
  const o = input as Record<string, unknown>;
  const boost = typeof o.boost === "number" ? o.boost : Number.NaN;
  const chargeDensity = typeof o.chargeDensity === "number" ? o.chargeDensity : Number.NaN;
  const currentDensityX = optionalNumber(o, "currentDensityX", 0);
  const currentDensityY = optionalNumber(o, "currentDensityY", 0);
  const currentDensityZ = optionalNumber(o, "currentDensityZ", 0);

  const carrierVelocityX = optionalNumber(o, "carrierVelocityX", 0);
  const carrierVelocityY = optionalNumber(o, "carrierVelocityY", 0);
  const carrierVelocityZ = optionalNumber(o, "carrierVelocityZ", 0);

  const sphereRadius = optionalNumber(o, "sphereRadius", 1);
  const sphereCharge = optionalNumber(o, "sphereCharge", (4 / 3) * Math.PI);

  const loopCurrent = optionalNumber(o, "loopCurrent", 1);
  const loopLengthX = optionalNumber(o, "loopLengthX", 1);
  const loopLengthY = optionalNumber(o, "loopLengthY", 0.5);

  const pulseWidth = optionalNumber(o, "pulseWidth", 1);
  const pulseAmplitude = optionalNumber(o, "pulseAmplitude", 1);

  if (!Number.isFinite(boost) || Math.abs(boost) >= C_SI) {
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

  const numericFields = {
    chargeDensity,
    currentDensityX,
    currentDensityY,
    currentDensityZ,
    carrierVelocityX,
    carrierVelocityY,
    carrierVelocityZ,
    sphereRadius,
    sphereCharge,
    loopCurrent,
    loopLengthX,
    loopLengthY,
    pulseWidth,
    pulseAmplitude,
  };
  const firstNonNumber =
    Object.entries(numericFields).find(([, v]) => !Number.isFinite(v))?.[0] ?? "chargeDensity";
  if (
    ![
      chargeDensity,
      currentDensityX,
      currentDensityY,
      currentDensityZ,
      carrierVelocityX,
      carrierVelocityY,
      carrierVelocityZ,
      sphereRadius,
      sphereCharge,
      loopCurrent,
      loopLengthX,
      loopLengthY,
      pulseWidth,
      pulseAmplitude,
    ].every(Number.isFinite)
  ) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: [firstNonNumber] },
        {
          details: {
            requirements: `Enter ${SR12_FIELD_NAMES[firstNonNumber] ?? "this value"} as a number.`,
          },
        },
      ),
    };
  }

  const uSpeed2 =
    carrierVelocityX * carrierVelocityX +
    carrierVelocityY * carrierVelocityY +
    carrierVelocityZ * carrierVelocityZ;
  if (uSpeed2 >= C_SI * C_SI) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["carrierVelocityX"] },
        {
          details: {
            requirements: "Enter a carrier velocity whose speed is below the speed of light.",
          },
        },
      ),
    };
  }

  const mode =
    typeof o.mode === "string" &&
    ["neutral-conductor", "convection", "moving-sphere", "gaussian-pulse", "current-loop"].includes(
      o.mode,
    )
      ? (o.mode as Sr12Parameters["mode"])
      : "neutral-conductor";

  const unitLayer = o.unitLayer === "gaussian" ? "gaussian" : "si";
  const descriptionFrame = o.descriptionFrame === "moving" ? "moving" : "stationary";

  return {
    kind: "accepted",
    data: Object.freeze({
      mode,
      unitLayer,
      descriptionFrame,
      chargeDensity,
      currentDensityX,
      currentDensityY,
      currentDensityZ,
      boost,
      carrierVelocityX,
      carrierVelocityY,
      carrierVelocityZ,
      sphereRadius,
      sphereCharge,
      loopCurrent,
      loopLengthX,
      loopLengthY,
      pulseWidth,
      pulseAmplitude,
    }),
  };
}

export function sr12InputFromParameters(p: Sr12Parameters): Sr12Input {
  return {
    mode: p.mode,
    unitLayer: p.unitLayer,
    descriptionFrame: p.descriptionFrame,
    chargeDensity: p.chargeDensity,
    currentDensity: {
      x: p.currentDensityX,
      y: p.currentDensityY,
      z: p.currentDensityZ,
    },
    boost: p.boost,
    carrierVelocity: {
      x: p.carrierVelocityX,
      y: p.carrierVelocityY,
      z: p.carrierVelocityZ,
    },
    sphereRadius: p.sphereRadius,
    sphereCharge: p.sphereCharge,
    loopCurrent: p.loopCurrent,
    loopLengthX: p.loopLengthX,
    loopLengthY: p.loopLengthY,
    pulseWidth: p.pulseWidth,
    pulseAmplitude: p.pulseAmplitude,
  };
}

export { SR12_DEFAULTS };

/**
 * The fields above, then every range content/experiments/sr-12.yaml declares (dispatch 134). The
 * boost is stored in m/s and typed as a fraction of c, so its sentence is written in c.
 */
export function validateSr12Parameters(input: unknown): Sr12ParameterCheck {
  return withinDeclaredDomain("sr-12", validateSr12Fields(input), {
    boost: { label: "Boost speed", unit: "c", scale: 1 / C_SI },
  });
}
