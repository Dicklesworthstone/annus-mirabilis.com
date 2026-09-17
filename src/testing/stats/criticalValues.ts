/**
 * Critical values lookup and validation engine.
 * Consumes precomputed tables in critical-values.json.
 * (am-ver-statistical-policy-grj)
 */

import criticalValuesData from "./critical-values.json" with { type: "json" };

export interface CriticalValuesTable {
  readonly _provenance: {
    readonly tool: string;
    readonly toolVersion: string;
    readonly generator: string;
    readonly generatedAt: string;
    readonly sha256: string;
  };
  readonly spotChecks: Record<string, number>;
  readonly normal: Record<string, number>;
  readonly chi2: Record<string, Record<string, number>>;
  readonly t: Record<string, Record<string, number>>;
}

const table = criticalValuesData as unknown as CriticalValuesTable;

export function getCriticalValuesProvenance(): CriticalValuesTable["_provenance"] {
  return table._provenance;
}

export function getCriticalValuesDigest(): string {
  return table._provenance.sha256;
}

export function getSpotChecks(): Record<string, number> {
  return table.spotChecks;
}

/**
 * Standard normal inverse CDF (quantile function) z_p.
 * Exact lookup when p is in table, analytical approximation with high precision otherwise.
 */
export function getNormalQuantile(p: number): number {
  if (p <= 0 || p >= 1) {
    throw new RangeError(`Probability p must be in (0, 1), got ${p}`);
  }
  const key = p.toString();
  if (table.normal[key] !== undefined) {
    return table.normal[key];
  }
  const keyExp = p.toExponential();
  if (table.normal[keyExp] !== undefined) {
    return table.normal[keyExp];
  }

  return approximateNormalQuantile(p);
}

/**
 * Chi-square quantile with `df` degrees of freedom for probability `p`.
 */
export function getChi2Quantile(df: number, p: number): number {
  if (df <= 0 || !Number.isInteger(df)) {
    throw new RangeError(`Degrees of freedom df must be a positive integer, got ${df}`);
  }
  if (p <= 0 || p >= 1) {
    throw new RangeError(`Probability p must be in (0, 1), got ${p}`);
  }

  const dfKey = df.toString();
  const pKey = p.toString();
  if (table.chi2[dfKey] && table.chi2[dfKey][pKey] !== undefined) {
    return table.chi2[dfKey][pKey];
  }
  const pExp = p.toExponential();
  if (table.chi2[dfKey] && table.chi2[dfKey][pExp] !== undefined) {
    return table.chi2[dfKey][pExp];
  }

  // Wilson-Hilferty transformation for arbitrary df / p
  const z = getNormalQuantile(p);
  const factor = 1 - 2 / (9 * df) + z * Math.sqrt(2 / (9 * df));
  return Math.max(0, df * factor * factor * factor);
}

/**
 * Student-t quantile with `df` degrees of freedom for probability `p`.
 */
export function getStudentTQuantile(df: number, p: number): number {
  if (df <= 0 || !Number.isInteger(df)) {
    throw new RangeError(`Degrees of freedom df must be a positive integer, got ${df}`);
  }
  if (p <= 0 || p >= 1) {
    throw new RangeError(`Probability p must be in (0, 1), got ${p}`);
  }

  const dfKey = df.toString();
  const pKey = p.toString();
  if (table.t[dfKey] && table.t[dfKey][pKey] !== undefined) {
    return table.t[dfKey][pKey];
  }
  const pExp = p.toExponential();
  if (table.t[dfKey] && table.t[dfKey][pExp] !== undefined) {
    return table.t[dfKey][pExp];
  }

  // Hill's approximation / Cornish-Fisher expansion for Student-t
  const z = getNormalQuantile(p);
  if (df > 100) {
    const z2 = z * z;
    const z3 = z2 * z;
    const z5 = z3 * z2;
    return z + (z3 + z) / (4 * df) + (5 * z5 + 16 * z3 + 3 * z) / (96 * df * df);
  }

  // Fallback to Wilson-Hilferty modified t
  return z * Math.sqrt(df / (df - 2 > 0 ? df - 2 : 1));
}

/** High precision rational approximation for normal quantile (Acklam's algorithm) */
function approximateNormalQuantile(p: number): number {
  if (p === 0.5) return 0;
  if (p < 0.5) return -approximateNormalQuantile(1 - p);

  const a: readonly [number, number, number, number, number, number] = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
    -3.066479806614716e1, 2.506628277459239,
  ];
  const b: readonly [number, number, number, number, number] = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c: readonly [number, number, number, number, number, number] = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ];
  const d: readonly [number, number, number, number] = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  if (p >= pLow && p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (
      (q * (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5])) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }

  const q = Math.sqrt(-2 * Math.log(1 - p));
  const val =
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);

  return -val;
}
