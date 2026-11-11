/** Exact finite teaching models, not recorded Brownian trajectories or empirical data. */
export type StepDependence = "independent" | "same-direction" | "opposite-direction";
export function enumerateSignedSteps(count: number, dependence: StepDependence = "independent") {
  if (!Number.isSafeInteger(count) || count < 2 || count > 8)
    throw new RangeError("Enumerate two to eight steps.");
  if (!["independent", "same-direction", "opposite-direction"].includes(dependence))
    throw new TypeError("Unknown dependence model.");
  if (dependence !== "independent" && count !== 2)
    throw new RangeError("Dependent alternatives are defined only for two steps.");
  const outcomes = dependence === "independent" ? 2 ** count : 2;
  const rows = Array.from({ length: outcomes }, (_, mask) => {
    const steps =
      dependence === "independent"
        ? Array.from({ length: count }, (_, i) => (mask & (1 << i) ? 1 : -1))
        : [mask ? 1 : -1, (mask ? 1 : -1) * (dependence === "same-direction" ? 1 : -1)];
    const displacement = steps.reduce((a, b) => a + b, 0);
    let crossTerm = 0;
    for (let i = 0; i < steps.length; i++)
      for (let j = i + 1; j < steps.length; j++) crossTerm += 2 * steps[i]! * steps[j]!;
    return Object.freeze({
      steps: Object.freeze(steps),
      displacement,
      square: displacement ** 2,
      sumSquares: count,
      crossTerm,
    });
  });
  const average = (key: "displacement" | "square" | "crossTerm") =>
    rows.reduce((a, row) => a + row[key], 0) / outcomes;
  return Object.freeze({
    count,
    dependence,
    denominator: outcomes,
    rows: Object.freeze(rows),
    mean: average("displacement"),
    meanSquare: average("square"),
    meanCrossTerm: average("crossTerm"),
    meanAbsolute: rows.reduce((a, row) => a + Math.abs(row.displacement), 0) / outcomes,
  });
}

export class StepChanceError extends RangeError {
  readonly code: "invalid-step-chance";

  constructor(code: "invalid-step-chance", message: string) {
    super(message);
    this.code = code;
    this.name = "StepChanceError";
  }
}

/**
 * The same two-step paths with an adjustable chance of a rightward first step. Independent
 * second steps use that same chance; matching and opposite steps follow the first. Integer
 * weights over 10,000 keep exact zero covariance and variance free of cancellation residue.
 */
export function enumerateBiasedTwoSteps(
  rightPercent: number,
  dependence: StepDependence = "independent",
) {
  if (!Number.isInteger(rightPercent) || rightPercent < 0 || rightPercent > 100)
    throw new StepChanceError(
      "invalid-step-chance",
      "Use a whole percentage from zero to one hundred.",
    );
  const base = enumerateSignedSteps(2, dependence);
  const denominator = 10_000;
  const rows = base.rows.map((row) => {
    // The existing enumerator guarantees two entries for this bounded construction.
    const steps = row.steps as readonly [number, number];
    const firstWeight = steps[0] === 1 ? rightPercent : 100 - rightPercent;
    const secondWeight = steps[1] === 1 ? rightPercent : 100 - rightPercent;
    const weight = firstWeight * (dependence === "independent" ? secondWeight : 100);
    return Object.freeze({ ...row, steps, weight, probability: weight / denominator });
  });
  const weighted = (value: (row: (typeof rows)[number]) => number) =>
    rows.reduce((sum, row) => sum + row.weight * value(row), 0);
  const first = weighted((row) => row.steps[0]);
  const second = weighted((row) => row.steps[1]);
  const product = weighted((row) => row.crossTerm / 2);
  const mean = first + second;
  const square = weighted((row) => row.square);
  return Object.freeze({
    ...base,
    rightPercent,
    denominator,
    rows: Object.freeze(rows),
    firstMean: first / denominator,
    secondMean: second / denominator,
    mean: mean / denominator,
    meanSquare: square / denominator,
    meanCrossTerm: (2 * product) / denominator,
    meanAbsolute: weighted((row) => Math.abs(row.displacement)) / denominator,
    variance: (square * denominator - mean * mean) / denominator ** 2,
    covariance: (product * denominator - first * second) / denominator ** 2,
    // Constant steps are statistically independent even if the chosen rule copies or reverses.
    independent: dependence === "independent" || rightPercent === 0 || rightPercent === 100,
  });
}
