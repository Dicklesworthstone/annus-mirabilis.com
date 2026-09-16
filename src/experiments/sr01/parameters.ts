import { makeRefusal } from "../results/refusals.ts";
import { SR01_DEFAULTS, type Sr01Parameters } from "./definition.ts";

export type Sr01ParameterCheck =
  | { kind: "accepted"; data: Sr01Parameters }
  | { kind: "refused"; refusal: ReturnType<typeof makeRefusal> };

function refuseBeta(name: keyof Sr01Parameters, value: number): Sr01ParameterCheck | null {
  if (!Number.isFinite(value)) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "nonfinite-input",
        { parameterIds: [name] },
        { details: { requirements: `${name} must be a finite number.` } },
      ),
    };
  }
  if (Math.abs(value) >= 1) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "superluminal-observer",
        { parameterIds: [name] },
        {
          details: {
            code: "superluminal-observer",
            requirements: "No inertial observer moves at or above light speed (|v/c| < 1).",
          },
        },
      ),
    };
  }
  return null;
}

function refuseSeparation(name: keyof Sr01Parameters, value: number): Sr01ParameterCheck | null {
  if (!Number.isFinite(value) || value <= 0) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: [name] },
        { details: { requirements: `${name} must be a finite, positive number of light-seconds.` } },
      ),
    };
  }
  return null;
}

export function validateSr01Parameters(input: unknown): Sr01ParameterCheck {
  if (input === null || typeof input !== "object") {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        {},
        { details: { requirements: "Use a complete parameter record." } },
      ),
    };
  }
  const o = input as Partial<Record<keyof Sr01Parameters, unknown>>;

  const stationSeparationLs =
    typeof o.stationSeparationLs === "number" ? o.stationSeparationLs : Number.NaN;
  const badSeparation = refuseSeparation("stationSeparationLs", stationSeparationLs);
  if (badSeparation) return badSeparation;

  const emissionTimeA = typeof o.emissionTimeA === "number" ? o.emissionTimeA : Number.NaN;
  if (!Number.isFinite(emissionTimeA)) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "nonfinite-input",
        { parameterIds: ["emissionTimeA"] },
        { details: { requirements: "emissionTimeA must be a finite number of seconds." } },
      ),
    };
  }

  const clockOffsetB = typeof o.clockOffsetB === "number" ? o.clockOffsetB : Number.NaN;
  if (!Number.isFinite(clockOffsetB)) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "nonfinite-input",
        { parameterIds: ["clockOffsetB"] },
        { details: { requirements: "clockOffsetB must be a finite number of seconds." } },
      ),
    };
  }

  const rodBeta = typeof o.rodBeta === "number" ? o.rodBeta : Number.NaN;
  const badRodBeta = refuseBeta("rodBeta", rodBeta);
  if (badRodBeta) return badRodBeta;

  const pairBeta = typeof o.pairBeta === "number" ? o.pairBeta : Number.NaN;
  const badPairBeta = refuseBeta("pairBeta", pairBeta);
  if (badPairBeta) return badPairBeta;

  const pairSeparationLs = typeof o.pairSeparationLs === "number" ? o.pairSeparationLs : Number.NaN;
  const badPairSeparation = refuseSeparation("pairSeparationLs", pairSeparationLs);
  if (badPairSeparation) return badPairSeparation;

  const frameBeta = typeof o.frameBeta === "number" ? o.frameBeta : Number.NaN;
  const badFrameBeta = refuseBeta("frameBeta", frameBeta);
  if (badFrameBeta) return badFrameBeta;

  return {
    kind: "accepted",
    data: Object.freeze({
      stationSeparationLs,
      emissionTimeA,
      clockOffsetB,
      rodBeta,
      pairBeta,
      pairSeparationLs,
      frameBeta,
    }),
  };
}

export { SR01_DEFAULTS };
