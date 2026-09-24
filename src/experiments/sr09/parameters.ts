import type { Sr09Input } from "../../physics/reference/waves.ts";
import { makeRefusal } from "../results/refusals.ts";
import type { Sr09Parameters } from "./definition.ts";

export type Sr09ParameterCheck =
  | { kind: "accepted"; data: Sr09Parameters }
  | { kind: "refused"; refusal: ReturnType<typeof makeRefusal> };

export function validateSr09Parameters(input: unknown): Sr09ParameterCheck {
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
  const frequencyTHz = typeof o.frequencyTHz === "number" ? o.frequencyTHz : Number.NaN;
  const detectorMotion =
    o.detectorMotion === "rest-in-K" ||
    o.detectorMotion === "custom" ||
    o.detectorMotion === "rest-in-k"
      ? o.detectorMotion
      : "rest-in-k";
  const detectorSpeed = typeof o.detectorSpeed === "number" ? o.detectorSpeed : 0;
  const countingWindowCycles =
    typeof o.countingWindowCycles === "number" ? o.countingWindowCycles : 10;
  const secondOrderSpeed = typeof o.secondOrderSpeed === "number" ? o.secondOrderSpeed : 0.005;
  const selectedEventId =
    typeof o.selectedEventId === "string" ? o.selectedEventId : "sr-09-event-origin-tick";
  const showCovectorNote = Boolean(o.showCovectorNote);

  if (!Number.isFinite(beta)) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["beta"] }),
    };
  }
  // v = ±V is not a slower speed the model cannot handle: no inertial observer moves at it.
  if (Math.abs(beta) >= 1) {
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
  if (!Number.isFinite(frequencyTHz) || frequencyTHz <= 0) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["frequencyTHz"] }),
    };
  }
  if (!Number.isFinite(detectorSpeed) || Math.abs(detectorSpeed) >= 1) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["detectorSpeed"] }),
    };
  }
  if (!Number.isFinite(countingWindowCycles) || countingWindowCycles <= 0) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["countingWindowCycles"] }),
    };
  }
  if (!Number.isFinite(secondOrderSpeed) || secondOrderSpeed <= 0 || secondOrderSpeed >= 1) {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["secondOrderSpeed"] }),
    };
  }

  const data: Sr09Parameters = Object.freeze({
    beta,
    propagationAngleDeg,
    frequencyTHz,
    detectorMotion,
    detectorSpeed,
    countingWindowCycles,
    secondOrderSpeed,
    selectedEventId,
    showCovectorNote,
  });

  return { kind: "accepted", data };
}

export function sr09InputFromParameters(params: Sr09Parameters): Sr09Input {
  const frequencyHz = params.frequencyTHz * 1e12;
  const countingWindow = params.countingWindowCycles / frequencyHz;
  return Object.freeze({
    beta: params.beta,
    propagationAngleDeg: params.propagationAngleDeg,
    frequencyHz,
    detectorMotion: params.detectorMotion,
    detectorSpeed: params.detectorSpeed,
    countingWindow,
    secondOrderSpeed: params.secondOrderSpeed,
    selectedEventId: params.selectedEventId,
  });
}
