/**
 * Independence versus perfectly locked positions (plan §9.2; am-reason-countermodel-locked-positions-g4gr).
 * Predictions reuse the configuration-count owner. Evidence is a reader-supplied histogram
 * of independent repeat placements, not historical data and not successive movie frames.
 */
import { binomialInside, lockedPositionsProbability } from "./radiation/configurationCounts.ts";

export const OCCUPANCY_OWNER = "reference.configuration-countermodels.v1";
export const MAX_OCCUPANCY_POINTS = 12;
export const MAX_OCCUPANCY_TRIALS = 10000;
export const OCCUPANCY_CHECKS = [
  "one-point",
  "mean-count",
  "all-inside",
  "count-variance",
] as const;
export type OccupancyCheck = (typeof OCCUPANCY_CHECKS)[number];
export type OccupancyModel = "independent" | "locked";
export type OccupancySettings = Readonly<{ n: number; quarters: number }>;
export type OccupancyPrediction = Readonly<{
  model: OccupancyModel;
  probabilities: readonly number[];
  statistics: Readonly<Record<OccupancyCheck, number>>;
  entropyChange:
    | Readonly<{ kind: "finite"; value: number }>
    | Readonly<{ kind: "zero-probability" }>;
}>;
export type OccupancyComparison = Readonly<{
  owner: typeof OCCUPANCY_OWNER;
  settings: OccupancySettings;
  fraction: number;
  independent: OccupancyPrediction;
  locked: OccupancyPrediction;
  differences: Readonly<Record<OccupancyCheck, number>>;
}>;

/** A refusal from the occupancy model. The code is first so the refusal scanners read it at the
 * throw; the message is what a reader sees, unchanged. */
export class OccupancyModelError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "OccupancyModelError";
    this.code = code;
  }
}

export function validateOccupancySettings(value: unknown): OccupancySettings {
  if (
    !value ||
    typeof value !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    throw new OccupancyModelError(
      "settings-not-plain-record",
      "Use a plain occupancy-settings record.",
    );
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== 2 ||
    keys.some((key) => key !== "n" && key !== "quarters") ||
    !["n", "quarters"].every((key) => descriptors[key]?.enumerable && "value" in descriptors[key])
  )
    throw new OccupancyModelError(
      "settings-unknown-fields",
      "Settings must contain only point count and volume quarters.",
    );
  const { n, quarters } = value as Record<string, unknown>;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > MAX_OCCUPANCY_POINTS)
    throw new OccupancyModelError(
      "point-count-out-of-range",
      `Use an integer point count from 1 to ${MAX_OCCUPANCY_POINTS}.`,
    );
  if (typeof quarters !== "number" || !Number.isInteger(quarters) || quarters < 0 || quarters > 4)
    throw new OccupancyModelError(
      "volume-quarters-out-of-range",
      "Choose 0, 1, 2, 3 or 4 quarters of the volume.",
    );
  return Object.freeze({ n, quarters });
}

function prediction(model: OccupancyModel, probabilities: readonly number[]): OccupancyPrediction {
  const n = probabilities.length - 1;
  const mean = probabilities.reduce((sum, probability, k) => sum + k * probability, 0);
  const variance = probabilities.reduce(
    (sum, probability, k) => sum + (k - mean) ** 2 * probability,
    0,
  );
  const allInside = probabilities[n] as number;
  return Object.freeze({
    model,
    probabilities: Object.freeze([...probabilities]),
    statistics: Object.freeze({
      "one-point": mean / n,
      "mean-count": mean,
      "all-inside": allInside,
      "count-variance": variance,
    }),
    // Boltzmann's log weight for the all-inside constraint, not Shannon entropy of K.
    entropyChange:
      allInside === 0
        ? Object.freeze({ kind: "zero-probability" as const })
        : Object.freeze({ kind: "finite" as const, value: Math.log(allInside) }),
  });
}

export function compareOccupancyModels(input: unknown): OccupancyComparison {
  const settings = validateOccupancySettings(input);
  const { n, quarters } = settings;
  const fraction = quarters / 4;
  // Rational inputs avoid the legacy numeric-fraction rounding path. The admitted
  // n <= 12 and denominator 4 keep every exact integer far below double overflow.
  const independent = prediction(
    "independent",
    binomialInside(n, { p: BigInt(quarters), q: 4n }).terms.map((term) => term.probability),
  );
  const allLocked = lockedPositionsProbability(n, fraction).value;
  const locked = prediction(
    "locked",
    Array.from({ length: n + 1 }, (_, k) => (k === n ? allLocked : k === 0 ? 1 - allLocked : 0)),
  );
  const differences = Object.fromEntries(
    OCCUPANCY_CHECKS.map((key) => [
      key,
      Math.abs(independent.statistics[key] - locked.statistics[key]),
    ]),
  ) as Record<OccupancyCheck, number>;
  return Object.freeze({
    owner: OCCUPANCY_OWNER,
    settings,
    fraction,
    independent,
    locked,
    differences: Object.freeze(differences),
  });
}

export function distinguishOccupancy(input: unknown, checks: readonly OccupancyCheck[]) {
  if (
    !Array.isArray(checks) ||
    checks.length > OCCUPANCY_CHECKS.length ||
    Array.from(checks).some((check) => !OCCUPANCY_CHECKS.includes(check)) ||
    new Set(checks).size !== checks.length
  )
    throw new OccupancyModelError("checks-invalid", "Choose unique, known occupancy checks.");
  const comparison = compareOccupancyModels(input);
  // All admitted fractions are binary-exact. This is a numerical comparison floor,
  // not measurement uncertainty or a significance threshold.
  // Annotated because the Array.isArray guard above narrows a readonly array to any[].
  const different: OccupancyCheck[] = checks.filter(
    (check: OccupancyCheck) => comparison.differences[check] > 1e-12,
  );
  return Object.freeze({
    status: different.length ? ("different-predictions" as const) : ("underdetermined" as const),
    different: Object.freeze(different),
  });
}

export type OccupancyLikelihood =
  | Readonly<{ status: "possible"; logLikelihood: number }>
  | Readonly<{ status: "zero-likelihood"; impossibleCounts: readonly number[] }>;
export type OccupancyEvidence = Readonly<{
  settings: OccupancySettings;
  counts: readonly number[];
  trials: number;
  empiricalMean: number;
  empiricalVariance: number;
  empiricalAllInside: number;
  independent: OccupancyLikelihood;
  locked: OccupancyLikelihood;
  status: "both-possible" | "independent-only" | "neither-possible";
  /** ln(L_independent/L_locked); no priors, posterior, p-value or arbitrary rejection cutoff. */
  logLikelihoodRatio: number | null;
}>;

/** Multinomial histogram likelihood; zero-probability bins are not numeric underflow. */
export function compareOccupancyEvidence(input: unknown, rawCounts: unknown): OccupancyEvidence {
  const comparison = compareOccupancyModels(input);
  const { n } = comparison.settings;
  if (!Array.isArray(rawCounts) || rawCounts.length !== n + 1)
    throw new OccupancyModelError(
      "frequency-count-mismatch",
      `Supply exactly ${n + 1} frequencies, for counts 0 through ${n}.`,
    );
  const counts: number[] = [];
  let trials = 0;
  for (let k = 0; k <= n; k++) {
    const descriptor = Object.getOwnPropertyDescriptor(rawCounts, String(k));
    if (
      !descriptor ||
      !("value" in descriptor) ||
      !Number.isSafeInteger(descriptor.value) ||
      descriptor.value < 0
    )
      throw new OccupancyModelError(
        "frequency-not-nonnegative-integer",
        "Each frequency must be a nonnegative integer; missing bins are not zero.",
      );
    counts.push(descriptor.value);
    trials += descriptor.value;
    if (trials > MAX_OCCUPANCY_TRIALS)
      throw new OccupancyModelError(
        "placements-over-limit",
        `Use at most ${MAX_OCCUPANCY_TRIALS} repeat placements.`,
      );
  }
  if (trials === 0)
    throw new OccupancyModelError(
      "record-empty",
      "An empty record is not evidence. Enter at least one placement.",
    );
  const logFactorials = [0];
  for (let i = 1; i <= trials; i++)
    logFactorials.push((logFactorials[i - 1] as number) + Math.log(i));
  const logMultiplicity =
    (logFactorials[trials] as number) -
    counts.reduce((sum, count) => sum + (logFactorials[count] as number), 0);
  function likelihood(probabilities: readonly number[]): OccupancyLikelihood {
    const impossibleCounts = counts.flatMap((count, k) =>
      count > 0 && probabilities[k] === 0 ? [k] : [],
    );
    if (impossibleCounts.length)
      return Object.freeze({
        status: "zero-likelihood",
        impossibleCounts: Object.freeze(impossibleCounts),
      });
    const logLikelihood =
      logMultiplicity +
      counts.reduce(
        (sum, count, k) => (count === 0 ? sum : sum + count * Math.log(probabilities[k] as number)),
        0,
      );
    return Object.freeze({ status: "possible", logLikelihood: Math.min(0, logLikelihood) });
  }
  const independent = likelihood(comparison.independent.probabilities);
  const locked = likelihood(comparison.locked.probabilities);
  const empiricalMean = counts.reduce((sum, count, k) => sum + k * count, 0) / trials;
  return Object.freeze({
    settings: comparison.settings,
    counts: Object.freeze(counts),
    trials,
    empiricalMean,
    empiricalVariance:
      counts.reduce((sum, count, k) => sum + count * (k - empiricalMean) ** 2, 0) / trials,
    empiricalAllInside: (counts[n] as number) / trials,
    independent,
    locked,
    // The locked model's support is a subset of the independent model's support.
    status:
      independent.status === "zero-likelihood"
        ? "neither-possible"
        : locked.status === "zero-likelihood"
          ? "independent-only"
          : "both-possible",
    logLikelihoodRatio:
      independent.status === "possible" && locked.status === "possible"
        ? independent.logLikelihood - locked.logLikelihood
        : null,
  });
}
