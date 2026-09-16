import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { makeRefusal } from "../results/refusals.ts";
import { LQ01_DEFAULTS, type Lq01Parameters } from "./definition.ts";

const keys = Object.keys(LQ01_DEFAULTS);

function refused(parameterIds: readonly string[], requirements: string): Computation<never> {
  return {
    kind: "refused",
    refusal: makeRefusal("invalid-parameter", { parameterIds }, { details: { requirements } }),
  };
}

/** Strict full-request validation, also used before accepting URL settings. Never clamps. */
export function validateLq01Parameters(input: unknown): Computation<Lq01Parameters> {
  if (
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  ) {
    return refused(keys, "Provide a plain settings record.");
  }
  const record = input as Record<string, unknown>;
  if (
    Reflect.ownKeys(record).length !== keys.length ||
    Reflect.ownKeys(record).some((k) => typeof k !== "string" || !keys.includes(k))
  ) {
    return refused(
      keys,
      "Every declared setting must occur exactly once; unknown settings are not supported.",
    );
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) {
      return refused([key], "Settings must be data, not accessors.");
    }
    if (key === "readout") {
      const val = record[key];
      if (typeof val !== "string" || !["time-average", "instantaneous"].includes(val)) {
        return refused([key], "Readout must be time-average or instantaneous.");
      }
    } else if (key === "mode") {
      const val = record[key];
      if (typeof val !== "string" || !["interference", "spreading"].includes(val)) {
        return refused([key], "Mode must be interference or spreading.");
      }
    } else if (key === "screenPosition") {
      const val = record[key];
      if (typeof val !== "string" || !["center", "first-min", "first-max"].includes(val)) {
        return refused([key], "Screen position must be center, first-min, or first-max.");
      }
    } else if (typeof record[key] !== "number" || !Number.isFinite(record[key])) {
      return { kind: "refused", refusal: makeRefusal("nonfinite-input", { parameterIds: [key] }) };
    }
  }
  const p = record as unknown as Lq01Parameters;
  if (p.A1 < 0 || p.A2 < 0) {
    return refused(["A1", "A2"], "Amplitudes A1 and A2 must be non-negative.");
  }
  if (p.wavelength <= 0) {
    return refused(["wavelength"], "Wavelength must be strictly positive.");
  }
  if (p.separation < 0) {
    return refused(["separation"], "Source separation must be non-negative.");
  }
  if (p.screenDistance <= 0) {
    return refused(["screenDistance"], "Screen distance must be strictly positive.");
  }
  if (p.P <= 0) {
    return refused(["P"], "Source radiant power P must be strictly positive.");
  }
  if (p.r <= 0) {
    return refused(
      ["r"],
      "Observation distance r must be strictly positive: the point-source idealization has no finite intensity at the source.",
    );
  }
  return { kind: "accepted", data: Object.freeze({ ...p }) };
}
