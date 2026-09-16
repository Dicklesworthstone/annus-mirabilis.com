/**
 * Independent high-precision series reference for Planck radiation band integrals.
 * Used for oracle cross-validation against adaptive quadrature (am-ref-radiation-15c).
 */

import {
  type ConstantSet,
  constantValue,
  thermalConstant,
} from "../../physics/reference/constants.ts";

const SPEED_OF_LIGHT = 299792458;
const BOLTZMANN_CONSTANT = 1.380649e-23;
const PLANCK_CONSTANT = 6.62607015e-34;

function isConstantSet(obj: unknown): obj is ConstantSet {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "entries" in obj &&
    Array.isArray((obj as ConstantSet).entries)
  );
}

function extractConstants(setOrConstants?: ConstantSet | { h?: number; c?: number; kB?: number }): {
  h: number;
  c: number;
  kB: number;
} {
  if (isConstantSet(setOrConstants)) {
    const c = constantValue(setOrConstants, "speedOfLight").value;
    const kB = thermalConstant(setOrConstants).value;
    const h = constantValue(setOrConstants, "planckConstant").value;
    return { h, c, kB };
  }
  return {
    h: setOrConstants?.h ?? PLANCK_CONSTANT,
    c: setOrConstants?.c ?? SPEED_OF_LIGHT,
    kB: setOrConstants?.kB ?? BOLTZMANN_CONSTANT,
  };
}

function antiDerivativeTerm(k: number, x: number): number {
  if (x === 0) {
    return -6 / k ** 4;
  }
  const k2 = k * k;
  const k3 = k2 * k;
  const k4 = k3 * k;
  return -Math.exp(-k * x) * (x ** 3 / k + (3 * x ** 2) / k2 + (6 * x) / k3 + 6 / k4);
}

/**
 * Evaluates integral_{x1}^{x2} (x^3 / (e^x - 1)) dx using the analytic polylogarithm series
 * sum_{k=1}^infinity integral_{x1}^{x2} x^3 e^(-k*x) dx.
 */
export function independentPlanckDimensionlessBandSeries(
  x1: number,
  x2: number,
  maxTerms = 1000,
  tol = 1e-15,
): number {
  let sum = 0;
  for (let k = 1; k <= maxTerms; k++) {
    const term = antiDerivativeTerm(k, x2) - antiDerivativeTerm(k, x1);
    sum += term;
    if (Math.abs(term) < tol && k > 10) break;
  }
  return sum;
}

/**
 * Computes the exact Planck band energy density in J m^-3 using the independent series expansion.
 */
export function planckFrequencyBandSeries(
  nu1: number,
  nu2: number,
  T: number,
  constants?: ConstantSet | { h?: number; c?: number; kB?: number },
): number {
  const { h, c, kB } = extractConstants(constants);

  const x1 = (h * nu1) / (kB * T);
  const x2 = (h * nu2) / (kB * T);

  const dimensionlessIntegral = independentPlanckDimensionlessBandSeries(x1, x2);
  const prefactor = (8 * Math.PI * (kB * T) ** 4) / (c ** 3 * h ** 3);

  return prefactor * dimensionlessIntegral;
}

/** Alias for backwards compatibility */
export const independentPlanckBandEnergyDensitySeries = planckFrequencyBandSeries;

/**
 * Computes the exact Wien band energy density in J m^-3 using the exact antiderivative.
 */
export function wienFrequencyBandSeries(
  nu1: number,
  nu2: number,
  T: number,
  constants?: ConstantSet | { h?: number; c?: number; kB?: number },
): number {
  const { h, c, kB } = extractConstants(constants);

  const x1 = (h * nu1) / (kB * T);
  const x2 = (h * nu2) / (kB * T);

  const dimensionlessIntegral = antiDerivativeTerm(1, x2) - antiDerivativeTerm(1, x1);
  const prefactor = (8 * Math.PI * (kB * T) ** 4) / (c ** 3 * h ** 3);

  return prefactor * dimensionlessIntegral;
}

/**
 * Computes the exact Planck wavelength band energy density in J m^-3.
 */
export function planckWavelengthBandSeries(
  lambda1: number,
  lambda2: number,
  T: number,
  constants?: ConstantSet | { h?: number; c?: number; kB?: number },
): number {
  const { c } = extractConstants(constants);
  const nu1 = c / lambda2;
  const nu2 = c / lambda1;
  return planckFrequencyBandSeries(nu1, nu2, T, constants);
}
