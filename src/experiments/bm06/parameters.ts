import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { makeRefusal } from "../results/refusals.ts";
import { BM06_DEFAULTS, type Bm06Parameters } from "./definition.ts";

const keys = Object.keys(BM06_DEFAULTS);
/** What each numeric control is called on the page (bm06/controls.ts BM06_FIELDS), with its unit. */
const BM06_FIELD_NAMES: Partial<Record<string, string>> = {
  T: "the temperature, in K,",
  eta: "the viscosity, in mPa·s,",
  a: "the particle radius, in μm,",
  t: "the elapsed time, in seconds,",
  lower: "the lower interval endpoint, in μm,",
  upper: "the upper interval endpoint, in μm,",
  n: "the number of grid cells",
  dx: "the cell width, in μm,",
  steps: "the number of time steps",
};
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
  const stringKeys = new Set(["copiedDiffusivityInstanceId", "copiedDiffusivityRunId"]);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value"))
      return refused([key], "Settings must be data, not accessors.");
    if (key === "gridEnabled") {
      if (typeof record[key] !== "boolean")
        return refused([key], "The grid switch must be true or false.");
    } else if (stringKeys.has(key)) {
      if (typeof record[key] !== "string") return refused([key], "This setting must be text.");
    } else if (typeof record[key] !== "number" || !Number.isFinite(record[key]))
      return {
        kind: "refused",
        refusal: makeRefusal(
          "nonfinite-input",
          { parameterIds: [key] },
          {
            details: {
              requirements: `Enter ${BM06_FIELD_NAMES[key] ?? "this value"} as a number.`,
            },
          },
        ),
      };
  }
  const p = record as Bm06Parameters;
  if (p.T <= 0) return refused(["T"], "Enter a temperature above 0 K.");
  if (p.eta <= 0) return refused(["eta"], "Enter a viscosity greater than zero, in mPa·s.");
  if (p.a <= 0) return refused(["a"], "Enter a particle radius greater than zero, in μm.");
  if (p.dx <= 0) return refused(["dx"], "Enter a cell width greater than zero, in μm.");
  if (p.t < 0) return refused(["t"], "Enter an elapsed time of zero or more, in seconds.");
  const copyFields = [
    "copiedDiffusivityInstanceId",
    "copiedDiffusivityRunId",
    "copiedDiffusivitySnapshotVersion",
    "copiedDiffusivityValue",
  ] as const;
  const notCopied =
    p.copiedDiffusivityInstanceId === "" &&
    p.copiedDiffusivityRunId === "" &&
    p.copiedDiffusivitySnapshotVersion === 0 &&
    p.copiedDiffusivityValue === 0;
  if (!notCopied) {
    if (
      p.copiedDiffusivityInstanceId === "" ||
      p.copiedDiffusivityRunId === "" ||
      !Number.isSafeInteger(p.copiedDiffusivitySnapshotVersion) ||
      p.copiedDiffusivitySnapshotVersion < 0 ||
      !(p.copiedDiffusivityValue > 0)
    )
      return refused(
        [...copyFields],
        "A copied diffusivity needs a non-empty source instance id, run id, a non-negative whole snapshot version, and a positive value; all four or none.",
      );
  }
  if (p.lower > p.upper)
    return refused(
      ["lower", "upper"],
      "The lower interval endpoint must not exceed the upper endpoint.",
    );
  if (!Number.isSafeInteger(p.n) || p.n < 3 || p.n > 4097)
    return refused(["n"], "Enter a whole number of grid cells from 3 to 4097.");
  if (!Number.isSafeInteger(p.steps) || p.steps < 1 || p.steps > 4_000_000)
    return refused(
      ["steps"],
      "Enter a whole number of time steps from 1 to 4 000 000. The total work budget applies separately.",
    );
  return { kind: "accepted", data: Object.freeze({ ...p }) };
}
