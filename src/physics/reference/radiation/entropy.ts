/**
 * Wien entropy workbench, volume law, and domain limits (paper 1 §§3–4, LQ-04).
 * Specification: am-ref-radiation-15c.
 */

import { type ConstantSet, constantValue, thermalConstant } from "../constants.ts";
import type { CyclicFrequency, RadiationResult } from "./types.ts";

export type WienCoefficients = Readonly<{
  A: number;
  B: number;
}>;

function resolveCoefficients(setOrCoeffs?: ConstantSet | WienCoefficients): WienCoefficients {
  if (setOrCoeffs && "A" in setOrCoeffs && "B" in setOrCoeffs) {
    return setOrCoeffs;
  }
  if (setOrCoeffs && "entries" in setOrCoeffs) {
    const c = constantValue(setOrCoeffs, "speedOfLight").value;
    const kB = thermalConstant(setOrCoeffs).value;
    const h = constantValue(setOrCoeffs, "planckConstant").value;
    return {
      A: (8 * Math.PI * h) / c ** 3,
      B: h / kB,
    };
  }
  // Default to Modern SI 2019
  const c = 299792458;
  const kB = 1.380649e-23;
  const h = 6.62607015e-34;
  return {
    A: (8 * Math.PI * h) / c ** 3,
    B: h / kB,
  };
}

/** Wien temperature from spectral energy density: T = B*nu / ln(A*nu^3 / rho). */
export function wienTemperatureFromDensity(
  rho: number,
  nu: CyclicFrequency | number,
  setOrCoeffs?: ConstantSet | WienCoefficients,
): RadiationResult<number> {
  const quantityId = "temperature";
  const unit = "K";
  if (!Number.isFinite(rho) || rho <= 0) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "nonpositive-spectral-density",
      domainKind: "physical",
      reason: `Spectral density must be positive and finite (got ${rho}).`,
    };
  }
  if (!Number.isFinite(nu) || nu <= 0) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "nonpositive-frequency",
      domainKind: "physical",
      reason: `Frequency must be positive and finite (got ${nu}).`,
    };
  }

  const { A, B } = resolveCoefficients(setOrCoeffs);
  const maxDensity = A * nu ** 3;
  if (rho >= maxDensity) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "nonpositive-implied-temperature",
      domainKind: "model",
      reason: `Spectral density ${rho} exceeds Wien prefactor A*nu^3 (${maxDensity}), implying nonpositive temperature.`,
    };
  }

  const x = Math.log(maxDensity / rho);
  const T = (B * nu) / x;

  return {
    status: "value",
    quantityId,
    unit,
    value: T,
    linearRepresentable: true,
  };
}

/**
 * Wien spectral entropy density s_nu = -(rho / (B*nu)) * [ln(rho / (A*nu^3)) - 1] in J m^-3 Hz^-1 K^-1.
 */
export function wienSpectralEntropyDensity(
  rho: number,
  nu: CyclicFrequency | number,
  setOrCoeffs?: ConstantSet | WienCoefficients,
): RadiationResult<number> {
  const quantityId = "spectralEntropyDensity";
  const unit = "J/(m^3 Hz K)";

  if (rho === 0) {
    return {
      status: "analytic-limit",
      quantityId,
      unit,
      value: 0,
      description: "Entropy density vanishes continuously at zero radiation density.",
      representation: { kind: "coefficient", value: 0 },
    };
  }

  if (!Number.isFinite(rho) || rho < 0) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "negative-spectral-density",
      domainKind: "physical",
      reason: `Spectral density must be non-negative (got ${rho}).`,
    };
  }
  if (!Number.isFinite(nu) || nu <= 0) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "nonpositive-frequency",
      domainKind: "physical",
      reason: `Frequency must be positive (got ${nu}).`,
    };
  }

  const { A, B } = resolveCoefficients(setOrCoeffs);
  const maxDensity = A * nu ** 3;
  if (rho >= maxDensity) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "outside-wien-regime",
      domainKind: "model",
      reason: `Spectral density ${rho} exceeds A*nu^3 (${maxDensity}), outside Wien domain.`,
    };
  }

  // s_nu = -(rho / (B*nu)) * (ln(rho / (A*nu^3)) - 1)
  const lnRatio = Math.log(rho / maxDensity);
  const sNu = -(rho / (B * nu)) * (lnRatio - 1);

  return {
    status: "value",
    quantityId,
    unit,
    value: sNu,
    linearRepresentable: true,
  };
}

export type RadiationEntropyVolumeChangeParams = Readonly<{
  E: number;
  nu: CyclicFrequency | number;
  dNu: number;
  V: number;
  V0: number;
}>;

export type RadiationEntropyVolumeChangeResult =
  | Readonly<{
      status: "value";
      quantityId: "radiationEntropy";
      unit: "J/K";
      deltaS: number;
      deltaSModern: number;
      effectiveIndependentCount: number;
      initialTemperature: number;
      finalTemperature: number;
      initialX: number;
      finalX: number;
      volumeRatio: number;
      maxDeltaNuRatio: number;
      wienTolerance: number;
      linearRepresentable: true;
    }>
  | {
      status: "outside-domain";
      quantityId: string;
      unit: string;
      condition: string;
      domainKind: string;
      reason: string;
    };

/**
 * Radiation entropy change upon volume expansion/compression at constant E and narrow band dNu.
 * Delta S = (E / (B * nu)) * ln(V / V0).
 */
export function radiationEntropyVolumeChange(
  params: RadiationEntropyVolumeChangeParams,
  setOrCoeffs?: ConstantSet | WienCoefficients,
  options: { epsilonW?: number; maxDeltaNuRatio?: number } = {},
): RadiationEntropyVolumeChangeResult {
  const { E, nu, dNu, V, V0 } = params;
  const quantityId = "radiationEntropy";
  const unit = "J/K";
  const maxDeltaNuRatio = options.maxDeltaNuRatio ?? 0.01;
  const epsilonW = options.epsilonW ?? 0.01;

  if (dNu / nu > maxDeltaNuRatio) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "band-not-narrow",
      domainKind: "model",
      reason:
        "the band is not narrow: the entropy law integrates over a narrow band at fixed frequency",
    };
  }

  if (E <= 0 || V <= 0 || V0 <= 0 || nu <= 0 || dNu <= 0) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "nonpositive-parameters",
      domainKind: "physical",
      reason: "Energy, volume, frequency, and bandwidth must be strictly positive.",
    };
  }

  const { A, B } = resolveCoefficients(setOrCoeffs);
  const maxDensity = A * nu ** 3;

  const rho0 = E / (V0 * dNu);
  const rho1 = E / (V * dNu);

  if (rho0 >= maxDensity || rho1 >= maxDensity) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "outside-wien-regime",
      domainKind: "model",
      reason: "Radiation density exceeds Wien approximation threshold; approximation fails.",
    };
  }

  const x0 = Math.log(maxDensity / rho0);
  const x1 = Math.log(maxDensity / rho1);

  if (Math.exp(-x0) > epsilonW || Math.exp(-x1) > epsilonW) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "outside-wien-regime",
      domainKind: "model",
      reason: `Relative error of Wien approximation (e^-x = ${Math.max(Math.exp(-x0), Math.exp(-x1)).toPrecision(3)}) exceeds tolerance ${epsilonW}.`,
    };
  }

  const T0 = (B * nu) / x0;
  const T1 = (B * nu) / x1;

  const volumeRatio = V / V0;
  const effectiveCount = E / (B * nu);
  const deltaS = effectiveCount * Math.log(volumeRatio);

  return {
    status: "value",
    quantityId: "radiationEntropy",
    unit: "J/K",
    deltaS,
    deltaSModern: deltaS,
    effectiveIndependentCount: effectiveCount,
    initialTemperature: T0,
    finalTemperature: T1,
    initialX: x0,
    finalX: x1,
    volumeRatio,
    maxDeltaNuRatio,
    wienTolerance: epsilonW,
    linearRepresentable: true,
  };
}

/**
 * Deliberately wrong derivation variant retaining an unfixed integration constant C(nu).
 * Adds dNu * C * (V - V0) to Delta S.
 */
export function entropyWithUnfixedConstant(
  params: RadiationEntropyVolumeChangeParams & { C: number },
  setOrCoeffs?: ConstantSet | WienCoefficients,
): Readonly<{
  status: "value";
  deltaS: number;
  deltaSWithC: number;
  extraTerm: number;
  historicalStatus: "adversarial-derivation-variant";
  modelNote: string;
}> {
  const { E, nu, dNu, V, V0, C } = params;
  const { B } = resolveCoefficients(setOrCoeffs);
  const deltaS = (E / (B * nu)) * Math.log(V / V0);
  const extraTerm = dNu * C * (V - V0);
  const deltaSWithC = deltaS + extraTerm;

  return {
    status: "value",
    deltaS,
    deltaSWithC,
    extraTerm,
    historicalStatus: "adversarial-derivation-variant",
    modelNote: "adversarial derivation variant, not a model of radiation",
  };
}
