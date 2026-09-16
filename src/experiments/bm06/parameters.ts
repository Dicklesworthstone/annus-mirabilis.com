import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { makeRefusal } from "../results/refusals.ts";
import { BM06_DEFAULTS, type Bm06Parameters } from "./definition.ts";

const keys = Object.keys(BM06_DEFAULTS);
function refused(parameterIds: readonly string[], requirements: string): Computation<never> {
  return {
    kind: "refused",
    refusal: makeRefusal("invalid-parameter", { parameterIds }, { details: { requirements } }),
  };
}
/** Strict full-request validation, also used before accepting URL settings. Never clamps. */
export function validateBm06Parameters(input: unknown): Computation<Bm06Parameters> {
  if (
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  )
    return refused(keys, "Provide a plain settings record.");
  const record = input as Record<string, unknown>;
  if (
    Reflect.ownKeys(record).length !== keys.length ||
    Reflect.ownKeys(record).some((k) => typeof k !== "string" || !keys.includes(k))
  )
    return refused(
      keys,
      "Every declared setting must occur exactly once; unknown settings are not supported.",
    );
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value"))
      return refused([key], "Settings must be data, not accessors.");
    if (key === "gridEnabled") {
      if (typeof record[key] !== "boolean")
        return refused([key], "The grid switch must be true or false.");
    } else if (typeof record[key] !== "number" || !Number.isFinite(record[key]))
      return { kind: "refused", refusal: makeRefusal("nonfinite-input", { parameterIds: [key] }) };
  }
  const p = record as Bm06Parameters;
  if (p.T <= 0 || p.eta <= 0 || p.a <= 0 || p.dx <= 0 || p.t < 0)
    return refused(
      ["T", "eta", "a", "t", "dx"],
      "Temperature, viscosity, radius and cell width must be positive; elapsed time can be zero.",
    );
  if (p.lower > p.upper)
    return refused(
      ["lower", "upper"],
      "The lower interval endpoint must not exceed the upper endpoint.",
    );
  if (
    !Number.isSafeInteger(p.n) ||
    p.n < 3 ||
    p.n > 4097 ||
    !Number.isSafeInteger(p.steps) ||
    p.steps < 1 ||
    p.steps > 4_000_000
  )
    return refused(
      ["n", "steps"],
      "Use 3–4097 cells and 1–4000000 whole time steps. The total work budget applies separately.",
    );
  return { kind: "accepted", data: Object.freeze({ ...p }) };
}
