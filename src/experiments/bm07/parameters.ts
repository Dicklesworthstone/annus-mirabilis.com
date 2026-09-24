import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { parseU64 } from "../../physics/reference/philox.ts";
import { makeRefusal } from "../results/refusals.ts";
import { BM07_DEFAULTS, type Bm07Parameters } from "./definition.ts";

/** What each numeric control is called on the page (InferenceLab), with the unit it is entered in. */
const BM07_FIELD_NAMES: Partial<Record<keyof Bm07Parameters, string>> = {
  generatorT: "the generator temperature, in K,",
  generatorEta: "the generator viscosity, in mPa·s,",
  generatorRadius: "the generator radius, in μm,",
  T: "the assumed temperature, in K,",
  eta: "the assumed viscosity, in mPa·s,",
  a: "the assumed particle radius, in μm,",
  dt: "the observation spacing, in seconds,",
  calibrationScale: "the calibration scale",
  M: "the number of displacements",
  d: "the number of observed coordinates",
  coverageTrials: "the number of hypothetical experiments",
  coverage: "the target interval coverage, in percent,",
  inputCoverage: "the coverage of each input interval, in percent,",
  temperatureError: "the temperature relative bound, in percent,",
  viscosityError: "the viscosity relative bound, in percent,",
  radiusError: "the radius relative bound, in percent,",
};

export function validateBm07Parameters(input: unknown): Computation<Bm07Parameters> {
  const bad = (requirements: string): Computation<never> => ({
    kind: "refused",
    refusal: makeRefusal(
      "invalid-parameter",
      { capabilityId: "diffusion.inference" },
      { details: { requirements } },
    ),
  });
  if (
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  )
    return bad("Use a complete parameter record.");
  const keys = Object.keys(BM07_DEFAULTS);
  if (
    Reflect.ownKeys(input).length !== keys.length ||
    Reflect.ownKeys(input).some((k) => typeof k !== "string" || !keys.includes(k)) ||
    keys.some((k) => {
      const d = Object.getOwnPropertyDescriptor(input, k);
      return !d?.enumerable || !Object.hasOwn(d, "value");
    })
  )
    return bad("Use complete known data fields, not accessors.");
  const p = input as Bm07Parameters;
  try {
    if (typeof p.seed !== "string") throw new Error();
    parseU64(p.seed);
  } catch {
    return { kind: "refused", refusal: makeRefusal("invalid-seed", { parameterIds: ["seed"] }) };
  }
  if (
    typeof p.radiusKnown !== "boolean" ||
    !["conditional", "combined"].includes(p.intervalKind) ||
    !["synthetic", "perrin-1909", "kitchen"].includes(p.observationSet) ||
    typeof p.constantSetId !== "string" ||
    p.constantSetId.length === 0 ||
    p.constantSetId.length > 128 ||
    ![
      "independent-increment-known-zero-drift",
      "drift-centered",
      "maximum-likelihood-centered",
    ].includes(p.estimator)
  )
    return bad(
      "Choose a registered observation set, constant-set id, estimator, interval procedure and radius declaration.",
    );
  // One sentence per control, named as the page labels it and in the unit it is entered in.
  for (const k of keys as (keyof Bm07Parameters)[])
    if (
      typeof BM07_DEFAULTS[k] === "number" &&
      (typeof p[k] !== "number" || !Number.isFinite(p[k]))
    )
      return bad(`Enter ${BM07_FIELD_NAMES[k] ?? "this value"} as a number.`);
  const positive: readonly [keyof Bm07Parameters, string][] = [
    ["generatorT", "Enter a generator temperature above 0 K."],
    ["generatorEta", "Enter a generator viscosity greater than zero, in mPa·s."],
    ["generatorRadius", "Enter a generator radius greater than zero, in μm."],
    ["T", "Enter an assumed temperature above 0 K."],
    ["eta", "Enter an assumed viscosity greater than zero, in mPa·s."],
    ["a", "Enter an assumed particle radius greater than zero, in μm."],
    ["dt", "Enter an observation spacing greater than zero, in seconds."],
    ["calibrationScale", "Enter a calibration scale greater than zero."],
  ];
  for (const [k, sentence] of positive) if (!((p[k] as number) > 0)) return bad(sentence);
  if (![1, 2].includes(p.d)) return bad("Choose one or two observed coordinates.");
  if (!Number.isSafeInteger(p.M) || p.M < 1 || p.M > 1000)
    return bad("Enter a whole number of displacements from 1 to 1000.");
  if (!Number.isSafeInteger(p.coverageTrials) || p.coverageTrials < 0 || p.coverageTrials > 100)
    return bad("Enter a whole number of hypothetical experiments from 0 to 100.");
  if (p.coverage <= 0 || p.coverage >= 1)
    return bad("Enter a target interval coverage above 0 and below 100 percent.");
  if (p.inputCoverage < 0 || p.inputCoverage >= 1)
    return bad(
      "Enter a coverage for each input interval from 0 up to, but not including, 100 percent; 0 means it has not been declared.",
    );
  const bounds: readonly [keyof Bm07Parameters, string][] = [
    ["temperatureError", "temperature"],
    ["viscosityError", "viscosity"],
    ["radiusError", "radius"],
  ];
  for (const [k, name] of bounds) {
    const v = p[k] as number;
    if (v < 0 || v >= 1)
      return bad(`Enter a ${name} relative bound from 0 up to, but not including, 100 percent.`);
  }
  return { kind: "accepted", data: Object.freeze({ ...p }) };
}
