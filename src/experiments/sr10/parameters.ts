import type { Sr10Input } from "../../physics/reference/waves.ts";
import { makeRefusal } from "../results/refusals.ts";
import type { Sr10Parameters } from "./definition.ts";

export type Sr10ParameterCheck =
  | { kind: "accepted"; data: Sr10Parameters }
  | { kind: "refused"; refusal: ReturnType<typeof makeRefusal> };

export function validateSr10Parameters(input: unknown): Sr10ParameterCheck {
  if (input === null || typeof input !== "object") {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["beta"] }),
    };
  }
  const o = input as Record<string, unknown>;
  const beta = typeof o.beta === "number" ? o.beta : Number.NaN;
  const propagationAngleDeg =
    typeof o.propagationAngleDeg === "number" ? o.propagationAngleDeg : Number.NaN;
  const initialEnergyJ = typeof o.initialEnergyJ === "number" ? o.initialEnergyJ : 1.0;
  const initialVolumeM3 = typeof o.initialVolumeM3 === "number" ? o.initialVolumeM3 : 1.0;
  const initialAmplitude = typeof o.initialAmplitude === "number" ? o.initialAmplitude : 1.0;
  const showCountermodel =
    typeof o.showCountermodel === "boolean"
      ? o.showCountermodel
      : Boolean(o.showCountermodel ?? true);

  if (!Number.isFinite(beta) || Math.abs(beta) >= 1) {
    return {
      kind: "refused",
      refusal: makeRefusal("superluminal-observer", { parameterIds: ["beta"] }),
    };
  }
  if (!Number.isFinite(propagationAngleDeg)) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["propagationAngleDeg"] }),
    };
  }
  if (!Number.isFinite(initialEnergyJ) || initialEnergyJ <= 0) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["initialEnergyJ"] }),
    };
  }
  if (!Number.isFinite(initialVolumeM3) || initialVolumeM3 <= 0) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["initialVolumeM3"] }),
    };
  }
  if (!Number.isFinite(initialAmplitude) || initialAmplitude <= 0) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["initialAmplitude"] }),
    };
  }

  const data: Sr10Parameters = Object.freeze({
    beta,
    propagationAngleDeg,
    initialEnergyJ,
    initialVolumeM3,
    initialAmplitude,
    showCountermodel,
  });

  return { kind: "accepted", data };
}

export function sr10InputFromParameters(params: Sr10Parameters): Sr10Input {
  return Object.freeze({
    beta: params.beta,
    propagationAngleDeg: params.propagationAngleDeg,
    initialEnergyJ: params.initialEnergyJ,
    initialVolumeM3: params.initialVolumeM3,
    initialAmplitude: params.initialAmplitude,
    showCountermodel: params.showCountermodel,
  });
}
