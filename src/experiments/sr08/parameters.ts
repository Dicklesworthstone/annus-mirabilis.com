import { C_SI, type Sr08Input } from "../../physics/reference/fields.ts";
import { makeRefusal } from "../results/refusals.ts";
import { SR08_DEFAULTS, type Sr08Parameters } from "./definition.ts";

export type Sr08ParameterCheck =
  | { kind: "accepted"; data: Sr08Parameters }
  | { kind: "refused"; refusal: ReturnType<typeof makeRefusal> };

export function validateSr08Parameters(input: unknown): Sr08ParameterCheck {
  if (input === null || typeof input !== "object") {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["boost"] }),
    };
  }
  const o = input as Record<string, unknown>;
  const boost = typeof o.boost === "number" ? o.boost : Number.NaN;
  const testCharge = typeof o.testCharge === "number" ? o.testCharge : Number.NaN;
  const detectorSpeed = typeof o.detectorSpeed === "number" ? o.detectorSpeed : 0;

  const electricFieldX = typeof o.electricFieldX === "number" ? o.electricFieldX : 0;
  const electricFieldY = typeof o.electricFieldY === "number" ? o.electricFieldY : Number.NaN;
  const electricFieldZ = typeof o.electricFieldZ === "number" ? o.electricFieldZ : 0;

  const magneticFieldX = typeof o.magneticFieldX === "number" ? o.magneticFieldX : 0;
  const magneticFieldY = typeof o.magneticFieldY === "number" ? o.magneticFieldY : 0;
  const magneticFieldZ = typeof o.magneticFieldZ === "number" ? o.magneticFieldZ : 0;

  const chargeVelocityX = typeof o.chargeVelocityX === "number" ? o.chargeVelocityX : 0;
  const chargeVelocityY = typeof o.chargeVelocityY === "number" ? o.chargeVelocityY : 0;
  const chargeVelocityZ = typeof o.chargeVelocityZ === "number" ? o.chargeVelocityZ : 0;

  if (!Number.isFinite(boost) || Math.abs(boost) >= C_SI) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["boost"] }),
    };
  }
  if (!Number.isFinite(testCharge)) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["testCharge"] }),
    };
  }
  if (![electricFieldX, electricFieldY, electricFieldZ].every(Number.isFinite)) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["electricFieldY"] }),
    };
  }
  if (![magneticFieldX, magneticFieldY, magneticFieldZ].every(Number.isFinite)) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["magneticFieldZ"] }),
    };
  }
  if (![chargeVelocityX, chargeVelocityY, chargeVelocityZ].every(Number.isFinite)) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["chargeVelocityX"] }),
    };
  }

  const uSpeed2 =
    chargeVelocityX * chargeVelocityX +
    chargeVelocityY * chargeVelocityY +
    chargeVelocityZ * chargeVelocityZ;
  if (uSpeed2 >= C_SI * C_SI) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["chargeVelocityX"] }),
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
      electricFieldX,
      electricFieldY,
      electricFieldZ,
      magneticFieldX,
      magneticFieldY,
      magneticFieldZ,
      boost,
      testCharge,
      chargeVelocityX,
      chargeVelocityY,
      chargeVelocityZ,
      decomposeComponents,
      detectorMotion,
      detectorSpeed,
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
