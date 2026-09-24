import { C_SI, type Sr12Input } from "../../physics/reference/fields.ts";
import { makeRefusal } from "../results/refusals.ts";
import { SR12_DEFAULTS, type Sr12Parameters } from "./definition.ts";

export type Sr12ParameterCheck =
  | { kind: "accepted"; data: Sr12Parameters }
  | { kind: "refused"; refusal: ReturnType<typeof makeRefusal> };

export function validateSr12Parameters(input: unknown): Sr12ParameterCheck {
  if (input === null || typeof input !== "object") {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["boost"] }),
    };
  }
  const o = input as Record<string, unknown>;
  const boost = typeof o.boost === "number" ? o.boost : Number.NaN;
  const chargeDensity = typeof o.chargeDensity === "number" ? o.chargeDensity : Number.NaN;
  const currentDensityX = typeof o.currentDensityX === "number" ? o.currentDensityX : 0;
  const currentDensityY = typeof o.currentDensityY === "number" ? o.currentDensityY : 0;
  const currentDensityZ = typeof o.currentDensityZ === "number" ? o.currentDensityZ : 0;

  const carrierVelocityX = typeof o.carrierVelocityX === "number" ? o.carrierVelocityX : 0;
  const carrierVelocityY = typeof o.carrierVelocityY === "number" ? o.carrierVelocityY : 0;
  const carrierVelocityZ = typeof o.carrierVelocityZ === "number" ? o.carrierVelocityZ : 0;

  const sphereRadius = typeof o.sphereRadius === "number" ? o.sphereRadius : 1;
  const sphereCharge = typeof o.sphereCharge === "number" ? o.sphereCharge : (4 / 3) * Math.PI;

  const loopCurrent = typeof o.loopCurrent === "number" ? o.loopCurrent : 1;
  const loopLengthX = typeof o.loopLengthX === "number" ? o.loopLengthX : 1;
  const loopLengthY = typeof o.loopLengthY === "number" ? o.loopLengthY : 0.5;

  const pulseWidth = typeof o.pulseWidth === "number" ? o.pulseWidth : 1;
  const pulseAmplitude = typeof o.pulseAmplitude === "number" ? o.pulseAmplitude : 1;

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
        { parameterIds: ["chargeDensity"] },
        {
          details: {
            requirements:
              "Enter every charge density, current density and pulse setting as a finite number.",
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
