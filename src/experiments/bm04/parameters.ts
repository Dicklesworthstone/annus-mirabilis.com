import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { makeRefusal } from "../results/refusals.ts";
import { BM04_DEFAULTS, type Bm04Parameters } from "./definition.ts";

const keys = Object.keys(BM04_DEFAULTS);

/** What each numeric control is called on the page (bm04/controls.ts), with its unit. */
const BM04_FIELD_NAMES: Partial<Record<string, string>> = {
  F: "the external force, in fN,",
  m: "the kick strength multiplier",
  T: "the temperature, in K,",
  eta: "the viscosity, in mPa·s,",
  a: "the particle radius, in μm,",
  W: "the box width, in μm,",
  cells: "the number of spatial cells",
  dt: "the time step, in ms,",
  steps: "the number of simulation steps",
};
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
      return {
        kind: "refused",
        refusal: makeRefusal(
          "nonfinite-input",
          { parameterIds: [key] },
          {
            details: {
              requirements: `Enter ${BM04_FIELD_NAMES[key] ?? "this value"} as a number.`,
            },
          },
        ),
      };
    }
  }
  const p = record as unknown as Bm04Parameters;
  if (p.T <= 0) return refused(["T"], "Enter a temperature above 0 K.");
  if (p.eta <= 0) return refused(["eta"], "Enter a viscosity greater than zero, in mPa·s.");
  if (p.a <= 0) return refused(["a"], "Enter a particle radius greater than zero, in μm.");
  if (p.W <= 0) return refused(["W"], "Enter a box width greater than zero, in μm.");
  if (p.dt <= 0) return refused(["dt"], "Enter a time step greater than zero, in ms.");
  if (p.m < 0) {
    return refused(["m"], "Enter a kick strength multiplier of zero or more.");
  }
  if (!Number.isFinite(p.F)) {
    return refused(["F"], "Enter the external force, in fN, as a number.");
  }
  if (!Number.isSafeInteger(p.cells) || p.cells < 3 || p.cells > 4097)
    return refused(["cells"], "Enter a whole number of spatial cells from 3 to 4097.");
  if (!Number.isSafeInteger(p.steps) || p.steps < 1 || p.steps > 4_000_000)
    return refused(["steps"], "Enter a whole number of simulation steps from 1 to 4 000 000.");
  return { kind: "accepted", data: Object.freeze({ ...p }) };
}
