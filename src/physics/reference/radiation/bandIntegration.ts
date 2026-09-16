/**
 * Band integration for Planck, Wien, and wavelength spectra.
 * Specification: am-ref-radiation-15c.
 */

import { type ConstantSet, constantValue, thermalConstant } from "../constants.ts";
import {
  planckFrequencyEnergyDensity,
  planckWavelengthEnergyDensity,
  wienFrequencyEnergyDensity,
} from "./spectra.ts";
import type { CyclicFrequency, RadiationResult, Wavelength } from "./types.ts";

/** 15-point Gauss-Kronrod quadrature nodes and weights on [-1, 1]. */
const GK15_X = [
  0.0, 0.2077849550078985, 0.4058451513773972, 0.5860872354676911, 0.7415311855993943,
  0.8648644233597691, 0.9491079123427585, 0.9914553711208126,
];
const GK15_W_KRONROD = [
  0.2094821410847278, 0.2044329400752989, 0.1903505780147726, 0.1690047266392679,
  0.1406532597155259, 0.1047900103222502, 0.06309209262997854, 0.02293532201052922,
];
const GK15_W_GAUSS = [
  0.4179591836734694, 0.0, 0.3818300505051189, 0.0, 0.2797053914892767, 0.0, 0.1294849661688697,
  0.0,
];

function adaptiveQuadrature(
  f: (x: number) => number,
  a: number,
  b: number,
  tolRel = 1e-12,
  tolAbs = 1e-15,
  maxDepth = 30,
): number {
  function step(left: number, right: number, depth: number): number {
    const mid = 0.5 * (left + right);
    const half = 0.5 * (right - left);
    let kronrodSum = (GK15_W_KRONROD[0] ?? 0) * f(mid);
    let gaussSum = (GK15_W_GAUSS[0] ?? 0) * f(mid);

    for (let i = 1; i < GK15_X.length; i++) {
      const xi = GK15_X[i] ?? 0;
      const wk = GK15_W_KRONROD[i] ?? 0;
      const wg = GK15_W_GAUSS[i] ?? 0;
      const dx = half * xi;
      const y1 = f(mid - dx);
      const y2 = f(mid + dx);
      const sumY = y1 + y2;
      kronrodSum += wk * sumY;
      if (wg > 0) {
        gaussSum += wg * sumY;
      }
    }

    const kronrod = kronrodSum * half;
    const gauss = gaussSum * half;
    const err = Math.abs(kronrod - gauss);

    if (depth >= maxDepth || err <= Math.max(tolAbs, tolRel * Math.abs(kronrod))) {
      return kronrod;
    }

    return step(left, mid, depth + 1) + step(mid, right, depth + 1);
  }

  return step(a, b, 0);
}

/** Total Planck radiation energy density a * T^4 (J m^-3). */
export function planckTotalEnergyDensity(T: number, set: ConstantSet): RadiationResult<number> {
  const quantityId = "radiationEnergy";
  const unit = "J/m^3";
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

  const c = constantValue(set, "speedOfLight").value;
  const kB = thermalConstant(set).value;
  const h = constantValue(set, "planckConstant").value;

  // a = 8 * pi^5 * k_B^4 / (15 * c^3 * h^3)
  const a = (8 * Math.PI ** 5 * kB ** 4) / (15 * c ** 3 * h ** 3);
  const uTotal = a * T ** 4;

  return {
    status: "value",
    quantityId,
    unit,
    value: uTotal,
    linearRepresentable: true,
  };
}

/** Integral of Planck spectrum over frequency band [nuMin, nuMax]. */
export function planckBandEnergyDensity(
  nuMin: CyclicFrequency | number,
  nuMax: CyclicFrequency | number,
  T: number,
  set: ConstantSet,
): RadiationResult<number> {
  const quantityId = "bandEnergy";
  const unit = "J/m^3";
  if (!Number.isFinite(nuMin) || nuMin <= 0 || !Number.isFinite(nuMax) || nuMax <= 0) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "nonpositive-frequency-bound",
      domainKind: "physical",
      reason: "Frequency bounds must be positive and finite.",
    };
  }
  if (nuMax <= nuMin) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "inverted-frequency-range",
      domainKind: "input",
      reason: `Upper frequency bound ${nuMax} must be strictly greater than lower bound ${nuMin}.`,
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

  const f = (nu: number) => {
    const res = planckFrequencyEnergyDensity(nu, T, set);
    return res.status === "value" && res.linearRepresentable ? res.value : 0;
  };

  const total = adaptiveQuadrature(f, nuMin, nuMax);
  return {
    status: "value",
    quantityId,
    unit,
    value: total,
    linearRepresentable: true,
  };
}

/** Integral of Wien spectrum over frequency band [nuMin, nuMax]. */
export function wienBandEnergyDensity(
  nuMin: CyclicFrequency | number,
  nuMax: CyclicFrequency | number,
  T: number,
  set: ConstantSet,
): RadiationResult<number> {
  const quantityId = "bandEnergy";
  const unit = "J/m^3";
  if (!Number.isFinite(nuMin) || nuMin <= 0 || !Number.isFinite(nuMax) || nuMax <= 0) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "nonpositive-frequency-bound",
      domainKind: "physical",
      reason: "Frequency bounds must be positive and finite.",
    };
  }
  if (nuMax <= nuMin) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "inverted-frequency-range",
      domainKind: "input",
      reason: `Upper frequency bound ${nuMax} must be strictly greater than lower bound ${nuMin}.`,
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

  const f = (nu: number) => {
    const res = wienFrequencyEnergyDensity(nu, T, set);
    return res.status === "value" && res.linearRepresentable ? res.value : 0;
  };

  const total = adaptiveQuadrature(f, nuMin, nuMax);
  return {
    status: "value",
    quantityId,
    unit,
    value: total,
    linearRepresentable: true,
  };
}

/** Integral of Planck spectrum over wavelength band [lambdaMin, lambdaMax]. */
export function planckWavelengthBandEnergyDensity(
  lambdaMin: Wavelength | number,
  lambdaMax: Wavelength | number,
  T: number,
  set: ConstantSet,
): RadiationResult<number> {
  const quantityId = "bandEnergy";
  const unit = "J/m^3";
  if (
    !Number.isFinite(lambdaMin) ||
    lambdaMin <= 0 ||
    !Number.isFinite(lambdaMax) ||
    lambdaMax <= 0
  ) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "nonpositive-wavelength-bound",
      domainKind: "physical",
      reason: "Wavelength bounds must be positive and finite.",
    };
  }
  if (lambdaMax <= lambdaMin) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "inverted-wavelength-range",
      domainKind: "input",
      reason: `Upper wavelength bound ${lambdaMax} must be strictly greater than lower bound ${lambdaMin}.`,
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

  const f = (lambda: number) => {
    const res = planckWavelengthEnergyDensity(lambda, T, set);
    return res.status === "value" && res.linearRepresentable ? res.value : 0;
  };

  const total = adaptiveQuadrature(f, lambdaMin, lambdaMax);
  return {
    status: "value",
    quantityId,
    unit,
    value: total,
    linearRepresentable: true,
  };
}
