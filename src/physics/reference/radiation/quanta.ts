/**
 * Quantum energy, effective count, and mean quantum energy over Wien spectra (paper 1 §6, LQ-06).
 * Specification: am-ref-radiation-15c.
 */

import { type ConstantSet, constantValue, thermalConstant } from "../constants.ts";
import type {
  BandLimitedMeanQuantumEnergyResult,
  CyclicFrequency,
  MeanQuantumEnergyWienResult,
} from "./types.ts";

const JOULES_PER_EV = 1.602176634e-19;

/** Effective independent particle count E / (h*nu) or E / (B*nu). */
export function effectiveIndependentCount(
  E: number,
  nu: CyclicFrequency | number,
  setOrB?: ConstantSet | number,
): Readonly<{
  status: "value";
  quantityId: "effectiveIndependentCount";
  unit: "";
  count: number;
  quantumEnergy: number;
  quantumEnergyEv: number;
  linearRepresentable: true;
}> {
  let elementEnergy: number;
  if (typeof setOrB === "number") {
    elementEnergy = setOrB * nu;
  } else if (setOrB && "entries" in setOrB) {
    const h = constantValue(setOrB, "planckConstant").value;
    elementEnergy = h * nu;
  } else {
    // Modern SI
    const h = 6.62607015e-34;
    elementEnergy = h * nu;
  }

  const count = E / elementEnergy;
  const quantumEnergyEv = elementEnergy / JOULES_PER_EV;

  return {
    status: "value",
    quantityId: "effectiveIndependentCount",
    unit: "",
    count,
    quantumEnergy: elementEnergy,
    quantumEnergyEv,
    linearRepresentable: true,
  };
}

/**
 * Mean quantum energy over a full Wien spectrum: <epsilon> = 3 * k_B * T (paper 1 §6).
 * Distinct from meanResonatorEnergy (k_B * T) and quantumEnergy (h * nu).
 */
export function meanQuantumEnergyWien(
  T: number,
  set: ConstantSet,
  options: { epsilonW?: number } = {},
): MeanQuantumEnergyWienResult {
  const kB = thermalConstant(set).value;
  const h = constantValue(set, "planckConstant").value;

  const meanWienJoules = 3 * kB * T;
  const meanWienEv = meanWienJoules / JOULES_PER_EV;

  const resonatorJoules = kB * T;
  const resonatorEv = resonatorJoules / JOULES_PER_EV;

  const moleculeKineticEv = (1.5 * resonatorJoules) / JOULES_PER_EV;
  const ratioToMoleculeKinetic = meanWienEv / moleculeKineticEv; // Exactly 2

  // Ratio h * nu / (3 * k_B * T) at 600 THz
  const nu600THz = 6.0e14;
  const quantumEnergy600THz = h * nu600THz;
  const ratioAt600THz = quantumEnergy600THz / meanWienJoules;

  const epsilonW = options.epsilonW ?? 0.01;
  const wienBoundaryX = Math.log(1 / epsilonW);

  // Shares below boundary x0
  const energyShareBelowBoundary = gamma4(wienBoundaryX) / 6;
  const countShareBelowBoundary = gamma3(wienBoundaryX) / 2;

  return {
    status: "value",
    meanQuantumEnergyWien: meanWienJoules,
    meanQuantumEnergyWienEv: meanWienEv,
    meanResonatorEnergy: resonatorJoules,
    meanResonatorEnergyEv: resonatorEv,
    moleculeKineticEnergyEv: moleculeKineticEv,
    ratioToMoleculeKinetic,
    ratioAt600THz,
    integrationRange: "all-positive-frequencies",
    wienAdmittedBoundaryX: wienBoundaryX,
    energyShareBelowBoundary,
    countShareBelowBoundary,
    modelStatus: "stipulated-model-extrapolated-beyond-admitted-regime",
  };
}

/** Lower incomplete gamma function gamma(3, x) = integral_0^x t^2 e^-t dt = 2 - e^-x (x^2 + 2x + 2). */
function gamma3(x: number): number {
  if (x <= 0) return 0;
  if (x === Infinity) return 2;
  return 2 - Math.exp(-x) * (x * x + 2 * x + 2);
}

/** Lower incomplete gamma function gamma(4, x) = integral_0^x t^3 e^-t dt = 6 - e^-x (x^3 + 3x^2 + 6x + 6). */
function gamma4(x: number): number {
  if (x <= 0) return 0;
  if (x === Infinity) return 6;
  return 6 - Math.exp(-x) * (x * x * x + 3 * x * x + 6 * x + 6);
}

/**
 * Band-limited mean quantum energy variant over dimensionless frequency range [xMin, xMax].
 * <epsilon> = k_B * T * (Gamma(4, xMin) - Gamma(4, xMax)) / (Gamma(3, xMin) - Gamma(3, xMax)).
 * Labeled "editorial-variant", not the historical §6 full-spectrum result.
 */
export function meanQuantumEnergyWienBand(
  T: number,
  xMin: number,
  xMax: number,
  set: ConstantSet,
  options: { epsilonW?: number } = {},
): BandLimitedMeanQuantumEnergyResult {
  const quantityId = "meanQuantumEnergyWien";
  const unit = "J";

  if (
    !Number.isFinite(xMin) ||
    Number.isNaN(xMax) ||
    xMin < 0 ||
    xMax <= xMin ||
    (!Number.isFinite(xMax) && xMax !== Infinity)
  ) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "invalid-dimensionless-bounds",
      domainKind: "input",
      reason: `Dimensionless frequency bounds must satisfy 0 <= xMin < xMax (got xMin=${xMin}, xMax=${xMax}).`,
    };
  }
  if (!Number.isFinite(T) || T <= 0) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "nonpositive-temperature",
      domainKind: "physical",
      reason: `Temperature must be positive and finite (got ${T}).`,
    };
  }

  const epsilonW = options.epsilonW ?? 0.01;
  const wienBoundaryX = Math.log(1 / epsilonW);

  const kB = thermalConstant(set).value;

  let meanEnergyJoules: number;
  if (xMin === 0 && xMax === Infinity) {
    meanEnergyJoules = 3 * kB * T;
  } else {
    const numEnergy = gamma4(xMax) - gamma4(xMin);
    const denCount = gamma3(xMax) - gamma3(xMin);
    const ratio = numEnergy / denCount;
    meanEnergyJoules = kB * T * ratio;
  }

  const meanEnergyEv = meanEnergyJoules / JOULES_PER_EV;

  // Fraction of total Wien energy and count below boundary x0
  const energyShareBelowBoundary = gamma4(wienBoundaryX) / 6;
  const countShareBelowBoundary = gamma3(wienBoundaryX) / 2;

  return {
    status: "value",
    historicalStatus: "editorial-variant",
    modelStatus: "editorial-variant",
    meanQuantumEnergyWien: meanEnergyJoules,
    meanQuantumEnergyWienEv: meanEnergyEv,
    xMin,
    xMax,
    wienAdmittedBoundaryX: wienBoundaryX,
    energyShareBelowBoundary,
    countShareBelowBoundary,
  };
}

/** Backwards-compatible alias */
export const bandLimitedMeanQuantumEnergyWien = meanQuantumEnergyWienBand;
