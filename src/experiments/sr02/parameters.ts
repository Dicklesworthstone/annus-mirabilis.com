import { C_SI } from "../../physics/reference/fields.ts";
import { makeRefusal } from "../results/refusals.ts";
import { SR02_DEFAULTS, type Sr02Parameters } from "./definition.ts";

export type Sr02ParameterCheck =
  | { kind: "accepted"; data: Sr02Parameters }
  | { kind: "refused"; refusal: ReturnType<typeof makeRefusal> };

export function validateSr02Parameters(input: unknown): Sr02ParameterCheck {
  if (input === null || typeof input !== "object") {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["speed"] }),
    };
  }
  const o = input as Record<string, unknown>;
  const speed = typeof o.speed === "number" ? o.speed : Number.NaN;
  const magneticField = typeof o.magneticField === "number" ? o.magneticField : Number.NaN;
  const dipoleMoment = typeof o.dipoleMoment === "number" ? o.dipoleMoment : Number.NaN;
  const testPointDistance =
    typeof o.testPointDistance === "number" ? o.testPointDistance : Number.NaN;
  const segmentLength = typeof o.segmentLength === "number" ? o.segmentLength : Number.NaN;
  const testCharge = typeof o.testCharge === "number" ? o.testCharge : Number.NaN;
  if (!Number.isFinite(speed) || Math.abs(speed) >= C_SI) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["speed"] }),
    };
  }
  if (!Number.isFinite(magneticField)) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["magneticField"] }),
    };
  }
  if (
    !Number.isFinite(dipoleMoment) ||
    !Number.isFinite(testPointDistance) ||
    testPointDistance <= 0
  ) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["dipoleMoment"] }),
    };
  }
  if (!Number.isFinite(segmentLength) || segmentLength <= 0) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["segmentLength"] }),
    };
  }
  if (!Number.isFinite(testCharge)) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["testCharge"] }),
    };
  }
  const mode = o.mode === "apparatus" ? "apparatus" : "analytic";
  const descriptionFrame =
    o.descriptionFrame === "conductor-rest" ? "conductor-rest" : "magnet-rest";
  const fieldModel = o.fieldModel === "dipole" ? "dipole" : "uniform";
  const pathOrientation = o.pathOrientation === "along-motion" ? "along-motion" : "transverse";
  const sliceDeclared = o.sliceDeclared === true;
  const resolution = o.resolution === "withheld" ? "withheld" : "shown";
  const motionState = o.motionState === "coil-moves" ? "coil-moves" : "magnet-moves";
  return {
    kind: "accepted",
    data: Object.freeze({
      mode,
      descriptionFrame,
      speed,
      fieldModel,
      magneticField,
      dipoleMoment,
      testPointDistance,
      segmentLength,
      testCharge,
      pathOrientation,
      sliceDeclared,
      resolution,
      motionState,
    }),
  };
}

export function sr02InputFromParameters(p: Sr02Parameters) {
  return {
    mode: p.mode,
    descriptionFrame: p.descriptionFrame,
    speed: p.speed,
    fieldModel: p.fieldModel,
    magneticField: p.magneticField,
    dipoleMoment: p.dipoleMoment,
    testPointDistance: p.testPointDistance,
    segmentLength: p.segmentLength,
    testCharge: p.testCharge,
    pathOrientation: p.pathOrientation,
    sliceDeclared: p.sliceDeclared,
  };
}

export { SR02_DEFAULTS };
