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
  const boost =
    typeof o.boost === "number"
      ? o.boost
      : o.boost === undefined
        ? SR08_DEFAULTS.boost
        : Number.NaN;
  const testCharge =
    typeof o.testCharge === "number"
      ? o.testCharge
      : o.testCharge === undefined
        ? SR08_DEFAULTS.testCharge
        : Number.NaN;
  const detectorSpeed =
    typeof o.detectorSpeed === "number"
      ? o.detectorSpeed
      : o.detectorSpeed === undefined
        ? SR08_DEFAULTS.detectorSpeed
        : Number.NaN;

  const electricFieldX =
    typeof o.electricFieldX === "number"
      ? o.electricFieldX
      : o.electricFieldX === undefined
        ? SR08_DEFAULTS.electricFieldX
        : Number.NaN;
  const electricFieldY =
    typeof o.electricFieldY === "number"
      ? o.electricFieldY
      : o.electricFieldY === undefined
        ? SR08_DEFAULTS.electricFieldY
        : Number.NaN;
  const electricFieldZ =
    typeof o.electricFieldZ === "number"
      ? o.electricFieldZ
      : o.electricFieldZ === undefined
        ? SR08_DEFAULTS.electricFieldZ
        : Number.NaN;

  const magneticFieldX =
    typeof o.magneticFieldX === "number"
      ? o.magneticFieldX
      : o.magneticFieldX === undefined
        ? SR08_DEFAULTS.magneticFieldX
        : Number.NaN;
  const magneticFieldY =
    typeof o.magneticFieldY === "number"
      ? o.magneticFieldY
      : o.magneticFieldY === undefined
        ? SR08_DEFAULTS.magneticFieldY
        : Number.NaN;
  const magneticFieldZ =
    typeof o.magneticFieldZ === "number"
      ? o.magneticFieldZ
      : o.magneticFieldZ === undefined
        ? SR08_DEFAULTS.magneticFieldZ
        : Number.NaN;

  const chargeVelocityX =
    typeof o.chargeVelocityX === "number"
      ? o.chargeVelocityX
      : o.chargeVelocityX === undefined
        ? SR08_DEFAULTS.chargeVelocityX
        : Number.NaN;
  const chargeVelocityY =
    typeof o.chargeVelocityY === "number"
      ? o.chargeVelocityY
      : o.chargeVelocityY === undefined
        ? SR08_DEFAULTS.chargeVelocityY
        : Number.NaN;
  const chargeVelocityZ =
    typeof o.chargeVelocityZ === "number"
      ? o.chargeVelocityZ
      : o.chargeVelocityZ === undefined
        ? SR08_DEFAULTS.chargeVelocityZ
        : Number.NaN;

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
  if (!Number.isFinite(electricFieldX)) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["electricFieldX"] }),
    };
  }
  if (!Number.isFinite(electricFieldY)) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["electricFieldY"] }),
    };
  }
  if (!Number.isFinite(electricFieldZ)) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["electricFieldZ"] }),
    };
  }
  if (!Number.isFinite(magneticFieldX)) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["magneticFieldX"] }),
    };
  }
  if (!Number.isFinite(magneticFieldY)) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["magneticFieldY"] }),
    };
  }
  if (!Number.isFinite(magneticFieldZ)) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["magneticFieldZ"] }),
    };
  }
  if (!Number.isFinite(chargeVelocityX)) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["chargeVelocityX"] }),
    };
  }
  if (!Number.isFinite(chargeVelocityY)) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["chargeVelocityY"] }),
    };
  }
  if (!Number.isFinite(chargeVelocityZ)) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["chargeVelocityZ"] }),
    };
  }
  if (!Number.isFinite(detectorSpeed)) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["detectorSpeed"] }),
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
