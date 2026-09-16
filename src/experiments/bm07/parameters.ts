import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { parseU64 } from "../../physics/reference/philox.ts";
import { makeRefusal } from "../results/refusals.ts";
import { BM07_DEFAULTS, type Bm07Parameters } from "./definition.ts";
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
  for (const k of keys as (keyof Bm07Parameters)[])
    if (
      typeof BM07_DEFAULTS[k] === "number" &&
      (typeof p[k] !== "number" || !Number.isFinite(p[k]))
    )
      return bad("Use finite numbers in the stated units.");
  if (
    ![
      p.generatorT,
      p.generatorEta,
      p.generatorRadius,
      p.T,
      p.eta,
      p.a,
      p.dt,
      p.calibrationScale,
    ].every((v) => v > 0)
  )
    return bad("Temperatures, viscosities, radii, spacing and calibration scale must be positive.");
  if (
    ![1, 2].includes(p.d) ||
    !Number.isSafeInteger(p.M) ||
    p.M < 1 ||
    p.M > 1000 ||
    !Number.isSafeInteger(p.coverageTrials) ||
    p.coverageTrials < 0 ||
    p.coverageTrials > 100
  )
    return bad(
      "Choose 1–1000 displacements, one or two coordinates, and at most 100 hypothetical experiments.",
    );
  if (
    p.coverage <= 0 ||
    p.coverage >= 1 ||
    p.inputCoverage < 0 ||
    p.inputCoverage >= 1 ||
    [p.temperatureError, p.viscosityError, p.radiusError].some((v) => v < 0 || v >= 1)
  )
    return bad(
      "Coverage must be between zero and one; relative input bounds must be nonnegative and below 100%. Zero input coverage means it has not been declared.",
    );
  return { kind: "accepted", data: Object.freeze({ ...p }) };
}
