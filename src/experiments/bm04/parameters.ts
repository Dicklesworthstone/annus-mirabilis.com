import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { makeRefusal } from "../results/refusals.ts";
import { BM04_DEFAULTS, type Bm04Parameters } from "./definition.ts";

const keys = Object.keys(BM04_DEFAULTS);

function refused(parameterIds: readonly string[], requirements: string): Computation<never> {
  return {
    kind: "refused",
    refusal: makeRefusal("invalid-parameter", { parameterIds }, { details: { requirements } }),
  };
}

/** Strict full-request validation, also used before accepting URL settings. Never clamps. */
export function validateBm04Parameters(input: unknown): Computation<Bm04Parameters> {
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
    if (key === "profile") {
      const val = record[key];
      if (typeof val !== "string" || !["uniform", "step", "equilibrium", "spike"].includes(val)) {
        return refused([key], "Profile must be uniform, step, equilibrium, or spike.");
      }
    } else if (typeof record[key] !== "number" || !Number.isFinite(record[key])) {
      return { kind: "refused", refusal: makeRefusal("nonfinite-input", { parameterIds: [key] }) };
    }
  }
  const p = record as unknown as Bm04Parameters;
  if (p.T <= 0 || p.eta <= 0 || p.a <= 0 || p.W <= 0 || p.dt <= 0) {
    return refused(
      ["T", "eta", "a", "W", "dt"],
      "Temperature, viscosity, radius, box width, and time step must be positive.",
    );
  }
  if (p.m < 0) {
    return refused(["m"], "Kick strength multiplier m must be non-negative.");
  }
  if (!Number.isFinite(p.F)) {
    return refused(["F"], "External force F must be a finite number.");
  }
  if (
    !Number.isSafeInteger(p.cells) ||
    p.cells < 3 ||
    p.cells > 4097 ||
    !Number.isSafeInteger(p.steps) ||
    p.steps < 1 ||
    p.steps > 4_000_000
  ) {
    return refused(["cells", "steps"], "Use 3–4097 spatial cells and 1–4000000 whole time steps.");
  }
  return { kind: "accepted", data: Object.freeze({ ...p }) };
}
