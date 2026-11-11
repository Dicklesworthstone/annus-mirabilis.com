/**
 * Band integration for Planck, Wien, and wavelength spectra.
 * Specification: am-ref-radiation-15c.
 */

import { withinTolerance } from "../../../units/tolerance.ts";
import type { ConstantSet } from "../constants.ts";
import { isLinearRepresentable } from "./representability.ts";
import {
  planckFrequencyEnergyDensity,
  planckPeakFrequency,
  planckPeakWavelength,
  planckWavelengthEnergyDensity,
  wienFrequencyEnergyDensity,
} from "./spectra.ts";
import { spectralConstantsSI } from "./spectralConstants.ts";
import type { CyclicFrequency, RadiationResult, Wavelength } from "./types.ts";

/** 15-point Gauss-Kronrod quadrature nodes and weights on [-1, 1].
 * QUADPACK dqk15: https://jacobwilliams.github.io/quadpack/proc/dqk15.html
 * The weight at x = 0.4058451513773972 must retain its binary64 precision: an error
 * of 5e-11 made the two rules disagree even on a constant, preventing convergence.
 */
const GK15_X = [
  0.0, 0.2077849550078985, 0.4058451513773972, 0.5860872354676911, 0.7415311855993943,
  0.8648644233597691, 0.9491079123427585, 0.9914553711208126,
];
const GK15_W_KRONROD = [
  0.2094821410847278, 0.2044329400752989, 0.1903505780647854, 0.1690047266392679,
  0.1406532597155259, 0.1047900103222502, 0.06309209262997854, 0.02293532201052922,
];
const GK15_W_GAUSS = [
  0.4179591836734694, 0.0, 0.3818300505051189, 0.0, 0.2797053914892767, 0.0, 0.1294849661688697,
  0.0,
];

// The spectrum runs synchronously. A depth limit alone permits billions of panels;
// this bound admits the teaching bands while keeping failure finite on every call.
const MAX_QUADRATURE_PANELS = 1023;

function adaptiveQuadrature(
  f: (x: number) => number,
  a: number,
  b: number,
  tolRel = 1e-12,
  tolAbs = 1e-15,
  maxDepth = 30,
): number | null {
  let panels = 0;
  function step(left: number, right: number, depth: number): number | null {
    if (++panels > MAX_QUADRATURE_PANELS) return null;
    const mid = left + 0.5 * (right - left);
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

    if (withinTolerance(kronrod, gauss, { relative: tolRel, absolute: tolAbs }).ok) {
      return kronrod;
    }

    // Do not report an unconverged partial sum as a computed band energy.
    if (!Number.isFinite(kronrod) || depth >= maxDepth || mid === left || mid === right)
      return null;
    const lower = step(left, mid, depth + 1);
    if (lower === null) return null;
    const upper = step(mid, right, depth + 1);
    return upper === null ? null : lower + upper;
  }

  return step(a, b, 0);
}

function bandIntegrationFailure(): RadiationResult<number> {
  return {
    status: "outside-domain",
    quantityId: "bandEnergy",
    unit: "J/m^3",
    condition: "band-integration-not-converged",
    domainKind: "numerical",
    reason:
      "The band integral did not converge within the numerical work limit. This is a calculation limit, not a zero energy or a physical prohibition. Choose a narrower band.",
    boundary: { alternativeModel: "Choose a narrower frequency or wavelength band." },
  };
}

function bandRepresentationFailure(): RadiationResult<number> {
  return {
    status: "outside-domain",
    quantityId: "bandEnergy",
    unit: "J/m^3",
    condition: "band-energy-not-representable",
    domainKind: "numerical",
    reason:
      "The band energy is positive, but falls outside the reliable floating-point range. This is a numerical representation limit, not zero energy or a physical prohibition. Change the band or temperature.",
    boundary: { alternativeModel: "Choose a different band or temperature." },
  };
}

/**
 * Integrate a positive, unimodal spectrum using its existing log representation.
 * A density below the linear range can still have a representable band integral;
 * replacing those samples with zero loses energy and breaks coordinate agreement.
 */
function integrateSpectrumBand(
  density: (coordinate: number) => RadiationResult<number>,
  low: number,
  high: number,
  peak: number,
): RadiationResult<number> {
  const logDensity = (coordinate: number): number => {
    const result = density(coordinate);
    return result.status === "value"
      ? (result.logFrequencyEnergyDensity ?? result.logWavelengthEnergyDensity ?? Number.NaN)
      : Number.NaN;
  };
  // The density's maximum on this band supplies a numerical scale, not a change
  // to either requested bound. Integrating on [0, 1] also removes coordinate units
  // from the quadrature's absolute tolerance.
  const logScale = logDensity(Math.min(high, Math.max(low, peak)));
  if (!Number.isFinite(logScale)) return bandRepresentationFailure();
  const width = high - low;
  const scaledIntegral = adaptiveQuadrature(
    (fraction) => Math.exp(logDensity(low + fraction * width) - logScale),
    0,
    1,
  );
  if (scaledIntegral === null || !(scaledIntegral > 0) || !Number.isFinite(scaledIntegral))
    return bandIntegrationFailure();

  const logEnergy = logScale + Math.log(width) + Math.log(scaledIntegral);
  if (!isLinearRepresentable(logEnergy)) return bandRepresentationFailure();
  return {
    status: "value",
    quantityId: "bandEnergy",
    unit: "J/m^3",
    value: Math.exp(logEnergy),
    linearRepresentable: true,
  };
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

  const { A, B } = spectralConstantsSI(set);

  // Integral of x^3/(exp(x)-1) is pi^4/15; nu = x T/B.
  const a = (A * Math.PI ** 4) / (15 * B ** 4);
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

  const peak = planckPeakFrequency(T, set);
  const bandEnergy = integrateSpectrumBand(
    (nu) => planckFrequencyEnergyDensity(nu, T, set),
    nuMin,
    nuMax,
    peak.status === "value" ? peak.value : Number.NaN,
  );
  return bandEnergy;
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

  // d(log u_nu)/d(nu) = 3/nu - h/(k_B T), so Wien peaks at h*nu/(k_B T) = 3.
  const peak = (3 * T) / spectralConstantsSI(set).B;
  return integrateSpectrumBand(
    (nu) => wienFrequencyEnergyDensity(nu, T, set),
    nuMin,
    nuMax,
    peak,
  );
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

  const peak = planckPeakWavelength(T, set);
  return integrateSpectrumBand(
    (lambda) => planckWavelengthEnergyDensity(lambda, T, set),
    lambdaMin,
    lambdaMax,
    peak.status === "value" ? peak.value : Number.NaN,
  );
}
