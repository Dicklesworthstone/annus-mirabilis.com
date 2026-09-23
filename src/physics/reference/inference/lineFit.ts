/** Linear least-squares numerical owner. The existing Millikan OLS API is retained.
 * Weighted fits use declared independent standard deviations, not relative weights
 * rescaled to make the reduced chi-square one. Reference: NIST/SEMATECH e-Handbook
 * https://www.itl.nist.gov/div898/handbook/pmd/section4/pmd432.htm
 */
export interface OlsLinearFit {
  readonly slope: number;
  readonly intercept: number;
  readonly rSquared: number;
  readonly slopeStandardError: number;
  readonly interceptStandardError: number;
  readonly residualVariance: number;
  readonly sampleCount: number;
  readonly fittedValues: readonly number[];
  readonly residuals: readonly number[];
}

/** A refusal from this owner. The kebab-case code comes first so the refusal scanner reads it at
 * the throw site; the message is unchanged, because callers show it to a reader. */
export class LineFitError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "LineFitError";
    this.code = code;
  }
}

/** Existing ordinary least squares implementation, moved without changing its arithmetic. */
export function fitOls(points: readonly Readonly<{ x: number; y: number }>[]): OlsLinearFit {
  const n = points.length;
  if (n < 3) {
    throw new LineFitError(
      "ols-too-few-points",
      `OLS fit requires at least 3 points; received ${n}`,
    );
  }

  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let ssXX = 0;
  let ssYY = 0;
  let ssXY = 0;

  for (const p of points) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    ssXX += dx * dx;
    ssYY += dy * dy;
    ssXY += dx * dy;
  }

  if (ssXX <= 0) {
    throw new LineFitError("ols-zero-x-variance", "Cannot fit OLS line: zero x-variance.");
  }

  const slope = ssXY / ssXX;
  const intercept = meanY - slope * meanX;
  const rSquared = ssYY > 0 ? (ssXY * ssXY) / (ssXX * ssYY) : 1;

  let ssResidual = 0;
  const fittedValues: number[] = [];
  const residuals: number[] = [];

  for (const p of points) {
    const fitY = slope * p.x + intercept;
    const res = p.y - fitY;
    fittedValues.push(fitY);
    residuals.push(res);
    ssResidual += res * res;
  }

  const dof = n - 2;
  const residualVariance = ssResidual / dof;
  const slopeStandardError = Math.sqrt(residualVariance / ssXX);
  const interceptStandardError = Math.sqrt(residualVariance * (1 / n + (meanX * meanX) / ssXX));

  return Object.freeze({
    slope,
    intercept,
    rSquared,
    slopeStandardError,
    interceptStandardError,
    residualVariance,
    sampleCount: n,
    fittedValues: Object.freeze(fittedValues),
    residuals: Object.freeze(residuals),
  });
}

export type LinePoint = Readonly<{ x: number; y: number; sigma?: number }>;
export type LineEstimate = Readonly<{
  slope: number;
  intercept: number;
  centerX: number;
  centerY: number;
  slopeVariance: number;
  centerVariance: number;
  interceptVariance: number;
  slopeInterceptCovariance: number;
  residuals: readonly number[];
  fittedValues: readonly number[];
  degreesOfFreedom: number;
  residualStandardDeviation: number;
  reducedChiSquare: number | null;
  uncertainty: "residual-estimate" | "declared-independent-sigma";
}>;

/** Centering both coordinates avoids loss of significance at optical frequencies.
 * The slope and response at centerX are uncorrelated under the stated error model;
 * callers can propagate their variances without subtracting large covariance terms.
 */
export function fitLine(points: readonly LinePoint[], weighted: boolean): LineEstimate {
  if (points.length < 3 || points.length > 1000)
    throw new LineFitError("line-fit-row-count", "Use 3 to 1000 rows.");
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y))
      throw new LineFitError("line-fit-nonfinite-coordinate", "Finite coordinates required.");
    if (weighted && (p.sigma === undefined || !Number.isFinite(p.sigma) || p.sigma <= 0)) {
      throw new LineFitError(
        "line-fit-sigma-required",
        "Weighted fitting requires a positive finite sigma for every row.",
      );
    }
  }
  const originX = points[0]!.x;
  const originY = points[0]!.y;
  const sigmaScale = weighted ? Math.min(...points.map((p) => p.sigma!)) : 1;
  const weights = points.map((p) => (weighted ? (sigmaScale / p.sigma!) ** 2 : 1));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const dxMean = points.reduce((s, p, i) => s + weights[i]! * (p.x - originX), 0) / totalWeight;
  const dyMean = points.reduce((s, p, i) => s + weights[i]! * (p.y - originY), 0) / totalWeight;
  const centerX = originX + dxMean;
  const centerY = originY + dyMean;
  const centered = points.map((p) => ({ x: p.x - originX - dxMean, y: p.y - originY - dyMean }));
  const xx = centered.reduce((s, p, i) => s + weights[i]! * p.x ** 2, 0);
  if (!Number.isFinite(xx) || xx <= 0)
    throw new LineFitError(
      "line-fit-unresolved-x",
      "Distinct, numerically resolved frequencies required.",
    );
  let slope: number;
  let residuals: readonly number[];
  let scaleVariance: number;
  if (!weighted) {
    // Reuse the original OLS owner on centered inputs, not a second unweighted law.
    const fit = fitOls(centered);
    slope = fit.slope;
    residuals = fit.residuals;
    scaleVariance = fit.residualVariance;
  } else {
    slope = centered.reduce((s, p, i) => s + weights[i]! * p.x * p.y, 0) / xx;
    residuals = centered.map((p) => p.y - slope * p.x);
    scaleVariance = sigmaScale ** 2;
  }
  const slopeVariance = scaleVariance / xx;
  const centerVariance = scaleVariance / totalWeight;
  const result: LineEstimate = {
    slope,
    intercept: centerY - slope * centerX,
    centerX,
    centerY,
    slopeVariance,
    centerVariance,
    interceptVariance: centerVariance + centerX ** 2 * slopeVariance,
    slopeInterceptCovariance: -centerX * slopeVariance,
    residuals: Object.freeze([...residuals]),
    fittedValues: Object.freeze(points.map((p, i) => p.y - residuals[i]!)),
    degreesOfFreedom: points.length - 2,
    residualStandardDeviation: Math.sqrt(
      residuals.reduce((s, r) => s + r * r, 0) / (points.length - 2),
    ),
    reducedChiSquare: weighted
      ? residuals.reduce((s, r, i) => s + (r / points[i]!.sigma!) ** 2, 0) / (points.length - 2)
      : null,
    uncertainty: weighted ? "declared-independent-sigma" : "residual-estimate",
  };
  const scalars = Object.values(result).filter((v) => typeof v === "number");
  if (
    !scalars.every(Number.isFinite) ||
    !result.fittedValues.every(Number.isFinite) ||
    !residuals.every(Number.isFinite)
  ) {
    throw new LineFitError(
      "line-fit-nonfinite-result",
      "The requested fit exceeds finite numerical precision.",
    );
  }
  return Object.freeze(result);
}
