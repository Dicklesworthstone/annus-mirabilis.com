import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { parseU64 } from "../../physics/reference/philox.ts";
import { makeRefusal } from "../results/refusals.ts";
import { BM01_DEFAULTS, type Bm01Parameters } from "./definition.ts";

/** What each numeric control is called on the page (bm01/controls.ts BM01_FIELDS), with its unit. */
const BM01_FIELD_NAMES: Partial<Record<string, string>> = {
  T: "the temperature, in K,",
  eta: "the viscosity, in mPa·s,",
  a: "the particle radius, in μm,",
  M: "the number of tracers",
  h: "the recording time resolution, in seconds,",
  H: "the recording length, in seconds,",
  interval: "the observation time, in seconds,",
  d: "the number of coordinates",
  axis: "the coordinate",
};

/** A value echoed into a sentence, at six significant figures, never a binary-float tail. */
const shown = (x: number) => String(Number(x.toPrecision(6)));

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
  // One sentence per control, named as the page labels it and in the unit it is entered in.
  for (const k of keys.filter((k) => k !== "seed" && k !== "statistic")) {
    const v = p[k as keyof Bm01Parameters];
    if (typeof v !== "number" || !Number.isFinite(v))
      return bad(`Enter ${BM01_FIELD_NAMES[k] ?? "this value"} as a number.`);
  }
  if (p.T <= 0) return bad("Enter a temperature above 0 K.");
  if (p.eta <= 0) return bad("Enter a viscosity greater than zero, in mPa·s.");
  if (p.a <= 0) return bad("Enter a particle radius greater than zero, in μm.");
  if (!Number.isInteger(p.M) || p.M < 1 || p.M > 3000)
    return bad("Enter a whole number of tracers from 1 to 3000.");
  if (p.h <= 0) return bad("Enter a recording time resolution greater than zero, in seconds.");
  // Above 600 s no recording length could satisfy the next sentence, so the resolution is at fault.
  if (p.h > 600)
    return bad("Enter a recording time resolution of at most 600 s, the longest recording.");
  if (p.H < p.h || p.H > 600)
    return bad(`Enter a recording length from ${shown(p.h)} s, the time resolution, up to 600 s.`);
  if (p.interval < 0 || p.interval > p.H)
    return bad(`Enter an observation time from 0 s up to the recording length, ${shown(p.H)} s.`);
  if (![1, 2, 3].includes(p.d)) return bad("Choose one, two or three coordinates.");
  if (![0, 1, 2].includes(p.axis)) return bad("Choose the x, y or z coordinate.");
  if (!["mean", "mean-square", "rms", "apparent"].includes(p.statistic))
    return bad("Choose one of the four statistics.");
  const steps = p.H / p.h;
  if (steps < 1 || steps > 30000 || Math.abs(steps - Math.round(steps)) > 1e-9 * steps)
    return bad(
      "Enter a recording length that is a whole number of time-resolution steps, at most 30 000 of them.",
    );
  return { kind: "accepted", data: Object.freeze({ ...p }) };
}
