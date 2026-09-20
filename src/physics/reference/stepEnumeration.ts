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
