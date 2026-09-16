import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { parseU64 } from "../../physics/reference/philox.ts";
import { makeRefusal } from "../results/refusals.ts";
import { BM01_DEFAULTS, type Bm01Parameters } from "./definition.ts";
export function validateBm01Parameters(input: unknown): Computation<Bm01Parameters> {
  const bad = (requirements: string): Computation<never> => ({
    kind: "refused",
    refusal: makeRefusal(
      "invalid-parameter",
      { capabilityId: "bm01.parameters" },
      { details: { requirements } },
    ),
  });
  if (
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  )
    return bad("Use a complete parameter record.");
  const keys = Object.keys(BM01_DEFAULTS);
  if (
    Reflect.ownKeys(input).length !== keys.length ||
    Reflect.ownKeys(input).some((k) => typeof k !== "string" || !keys.includes(k)) ||
    keys.some((k) => !Object.hasOwn(Object.getOwnPropertyDescriptor(input, k) ?? {}, "value"))
  )
    return bad("Parameter fields must be complete, known data fields.");
  const p = input as Bm01Parameters;
  try {
    if (typeof p.seed !== "string") throw new Error();
    parseU64(p.seed);
  } catch {
    return { kind: "refused", refusal: makeRefusal("invalid-seed", { parameterIds: ["seed"] }) };
  }
  if (
    keys
      .filter((k) => k !== "seed" && k !== "statistic")
      .some(
        (k) =>
          typeof p[k as keyof Bm01Parameters] !== "number" ||
          !Number.isFinite(p[k as keyof Bm01Parameters]),
      )
  )
    return bad("Use finite numbers in the stated units.");
  if (
    p.T <= 0 ||
    p.eta <= 0 ||
    p.a <= 0 ||
    p.h <= 0 ||
    p.H < p.h ||
    p.H > 600 ||
    p.interval < 0 ||
    p.interval > p.H ||
    !Number.isInteger(p.M) ||
    p.M < 1 ||
    p.M > 3000 ||
    ![1, 2, 3].includes(p.d) ||
    ![0, 1, 2].includes(p.axis) ||
    !["mean", "mean-square", "rms", "apparent"].includes(p.statistic)
  )
    return bad(
      "Use positive physical inputs; 1–3000 tracers; a recording up to 600 seconds; one to three coordinates; and an observation inside the recording.",
    );
  const steps = p.H / p.h;
  if (steps < 1 || steps > 30000 || Math.abs(steps - Math.round(steps)) > 1e-9 * steps)
    return bad(
      "Recording length must be an integer multiple of its time resolution (at most 30000 steps).",
    );
  return { kind: "accepted", data: Object.freeze({ ...p }) };
}
