import type { Sr10Input } from "../../physics/reference/waves.ts";
import { type DomainDisplay, withinDeclaredDomain } from "../controls/declaredDomain.ts";
import { optionalNumber } from "../controls/typedNumber.ts";
import { makeRefusal } from "../results/refusals.ts";
import type { Sr10Parameters } from "./definition.ts";

export type Sr10ParameterCheck =
  | { kind: "accepted"; data: Sr10Parameters }
  | { kind: "refused"; refusal: ReturnType<typeof makeRefusal> };

function validateSr10Fields(input: unknown): Sr10ParameterCheck {
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
  // The default when a setting is absent; a present value that is not a number reaches the checks
  // below as NaN and is refused by name, rather than swapped for the default (dispatch 165).
  const initialEnergyJ = optionalNumber(o, "initialEnergyJ", 1.0);
  const initialVolumeM3 = optionalNumber(o, "initialVolumeM3", 1.0);
  const initialAmplitude = optionalNumber(o, "initialAmplitude", 1.0);
  const showCountermodel =
    typeof o.showCountermodel === "boolean"
      ? o.showCountermodel
      : Boolean(o.showCountermodel ?? true);

  // A speed that is not a number is not a faster-than-light observer: it gets its own sentence.
  if (!Number.isFinite(beta)) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["beta"] },
        { details: { requirements: "Enter the observer speed β as a number." } },
      ),
    };
  }
  if (Math.abs(beta) >= 1) {
    return {
      kind: "refused",
      refusal: makeRefusal("superluminal-observer", { parameterIds: ["beta"] }),
    };
  }
  if (!Number.isFinite(propagationAngleDeg)) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["propagationAngleDeg"] },
        {
          details: {
            requirements: "Enter the direction of the light as a finite number of degrees.",
          },
        },
      ),
    };
  }
  // The ranges of E and V are the manifest's, checked once by withinDeclaredDomain below.
  if (!Number.isFinite(initialEnergyJ)) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["initialEnergyJ"] },
        {
          details: { requirements: "Enter the initial energy in K as a number, in joules." },
        },
      ),
    };
  }
  if (!Number.isFinite(initialVolumeM3)) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["initialVolumeM3"] },
        {
          details: {
            requirements: "Enter the initial volume in K as a number, in cubic metres.",
          },
        },
      ),
    };
  }
  if (!Number.isFinite(initialAmplitude) || initialAmplitude <= 0) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["initialAmplitude"] },
        {
          details: { requirements: "Enter an initial amplitude greater than zero." },
        },
      ),
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

/** Each declared setting as the form names it. */
const SR10_DOMAIN_DISPLAY: Readonly<Record<string, DomainDisplay>> = {
  beta: { label: "observer speed β" },
  propagationAngleDeg: { label: "propagation angle φ" },
  initialEnergyJ: { label: "initial energy in K" },
  initialVolumeM3: { label: "initial volume in K", unit: "m³" },
};

/** The fields above, then every range content/experiments/sr-10.yaml declares (dispatch 134). */
export function validateSr10Parameters(input: unknown): Sr10ParameterCheck {
  return withinDeclaredDomain("sr-10", validateSr10Fields(input), SR10_DOMAIN_DISPLAY);
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
