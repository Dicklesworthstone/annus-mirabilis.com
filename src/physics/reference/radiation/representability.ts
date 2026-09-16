/**
 * Explicit representability thresholds for radiation densities and configuration probabilities.
 * Specification: am-ref-radiation-15c.
 */

export const LOG_DOUBLE_MIN_NORMAL = -708.3964185322641; // ln(2.2250738585072014e-308)
export const LOG_DOUBLE_MAX_NORMAL = 709.782712893384; // ln(1.7976931348623157e+308)
export const LOG_DOUBLE_ZERO_THRESHOLD = -745.1332191019411; // ln(4.9406564584124654e-324 / 2)

export function isLinearRepresentable(lnValue: number): boolean {
  return (
    Number.isFinite(lnValue) && lnValue >= LOG_DOUBLE_MIN_NORMAL && lnValue <= LOG_DOUBLE_MAX_NORMAL
  );
}

/** Stable log1p / expm1 calculation for planck factor ln(1 / (e^x - 1)). */
export function logPlanckFactor(x: number): number {
  if (x <= 0) return Number.POSITIVE_INFINITY;
  if (x > 50) {
    // For large x: 1/(e^x - 1) = e^(-x)/(1 - e^(-x)) => ln is -x - ln(1 - e^(-x)) = -x - log1p(-exp(-x))
    return -x - Math.log1p(-Math.exp(-x));
  }
  if (x < 1e-4) {
    // For small x: e^x - 1 = expm1(x)
    return -Math.log(Math.expm1(x));
  }
  return -Math.log(Math.expm1(x));
}

/**
 * Packs linear value and log representation fields.
 */
export function packLogRepresentation(
  lnVal: number,
  kind: "frequency" | "wavelength" | "probability",
): {
  linearRepresentable: boolean;
  value: number;
  logFields: Record<string, number>;
} {
  const linearRepresentable = isLinearRepresentable(lnVal);
  const log10Val = lnVal / Math.LN10;
  const value = linearRepresentable ? Math.exp(lnVal) : 0;

  const logFields: Record<string, number> = {};
  if (kind === "frequency") {
    logFields.logFrequencyEnergyDensity = lnVal;
    logFields.log10FrequencyEnergyDensity = log10Val;
  } else if (kind === "wavelength") {
    logFields.logWavelengthEnergyDensity = lnVal;
    logFields.log10WavelengthEnergyDensity = log10Val;
  } else if (kind === "probability") {
    logFields.lnW = lnVal;
    logFields.log10W = log10Val;
  }

  return {
    linearRepresentable,
    value,
    logFields,
  };
}
