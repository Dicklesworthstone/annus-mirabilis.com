/**
 * Planck, Wien, and Rayleigh-Jeans radiation spectra, coordinate transforms, and regime analysis.
 * Specification: am-ref-radiation-15c.
 */

import { type ConstantSet, constantValue, thermalConstant } from "../constants.ts";
import { packLogRepresentation } from "./representability.ts";
import type {
  CyclicFrequency,
  RadiationOutsideDomain,
  RadiationResult,
  RegimeReport,
  Wavelength,
} from "./types.ts";

export const X_PEAK_FREQUENCY = 2.821439372127099; // root of x = 3(1 - e^-x)
export const X_PEAK_WAVELENGTH = 4.965114231744276; // root of x = 5(1 - e^-x)
export const X_PEAK_LOG_INTERVAL = 3.920690394872886; // root of x = 4(1 - e^-x)

function getBasePhysicsConstants(set: ConstantSet): {
  h: number;
  c: number;
  kB: number;
} {
  const c = constantValue(set, "speedOfLight").value;
  const kB = thermalConstant(set).value;
  const h = constantValue(set, "planckConstant").value;
  return { h, c, kB };
}

function refuseNonpositive(
  paramName: string,
  value: number,
  quantityId: string,
  unit: string,
): RadiationOutsideDomain {
  return {
    status: "outside-domain",
    quantityId,
    unit,
    condition: `nonpositive-${paramName}`,
    domainKind: "physical",
    reason: `${paramName} must be positive and finite (got ${value}).`,
    boundary: { parameterAction: { parameterId: paramName, value: 1.0 } } as unknown as {
      alternativeModel: string;
    },
  };
}

/** Planck frequency energy density u_nu (J m^-3 Hz^-1). */
export function planckFrequencyEnergyDensity(
  nu: CyclicFrequency | number,
  T: number,
  set: ConstantSet,
): RadiationResult<number> {
  const quantityId = "frequencyEnergyDensity";
  const unit = "J/(m^3 Hz)";
  if (!Number.isFinite(nu) || nu <= 0) return refuseNonpositive("frequency", nu, quantityId, unit);
  if (!Number.isFinite(T) || T <= 0) return refuseNonpositive("temperature", T, quantityId, unit);

  const { h, c, kB } = getBasePhysicsConstants(set);
  const x = (h * nu) / (kB * T);

  // u_nu = (8 * pi * h * nu^3 / c^3) * (1 / (e^x - 1))
  const lnPrefactor = Math.log(8 * Math.PI * h) + 3 * Math.log(nu) - 3 * Math.log(c);
  let lnFactor: number;
  if (x > 50) {
    lnFactor = -x - Math.log1p(-Math.exp(-x));
  } else if (x < 1e-4) {
    lnFactor = -Math.log(Math.expm1(x));
  } else {
    lnFactor = -Math.log(Math.expm1(x));
  }

  const lnU = lnPrefactor + lnFactor;
  const packed = packLogRepresentation(lnU, "frequency");

  return {
    status: "value",
    quantityId,
    unit,
    value: packed.value,
    linearRepresentable: packed.linearRepresentable,
    ...packed.logFields,
  };
}

/** Planck wavelength energy density u_lambda (J m^-3 m^-1). */
export function planckWavelengthEnergyDensity(
  lambda: Wavelength | number,
  T: number,
  set: ConstantSet,
): RadiationResult<number> {
  const quantityId = "wavelengthEnergyDensity";
  const unit = "J/(m^3 m)";
  if (!Number.isFinite(lambda) || lambda <= 0)
    return refuseNonpositive("wavelength", lambda, quantityId, unit);
  if (!Number.isFinite(T) || T <= 0) return refuseNonpositive("temperature", T, quantityId, unit);

  const { h, c, kB } = getBasePhysicsConstants(set);
  const x = (h * c) / (lambda * kB * T);

  // u_lambda = (8 * pi * h * c / lambda^5) * (1 / (e^x - 1))
  const lnPrefactor = Math.log(8 * Math.PI * h * c) - 5 * Math.log(lambda);
  let lnFactor: number;
  if (x > 50) {
    lnFactor = -x - Math.log1p(-Math.exp(-x));
  } else {
    lnFactor = -Math.log(Math.expm1(x));
  }

  const lnU = lnPrefactor + lnFactor;
  const packed = packLogRepresentation(lnU, "wavelength");

  return {
    status: "value",
    quantityId,
    unit,
    value: packed.value,
    linearRepresentable: packed.linearRepresentable,
    ...packed.logFields,
  };
}

/** Wien frequency energy density u_nu (J m^-3 Hz^-1). */
export function wienFrequencyEnergyDensity(
  nu: CyclicFrequency | number,
  T: number,
  set: ConstantSet,
): RadiationResult<number> {
  const quantityId = "frequencyEnergyDensity";
  const unit = "J/(m^3 Hz)";
  if (!Number.isFinite(nu) || nu <= 0) return refuseNonpositive("frequency", nu, quantityId, unit);
  if (!Number.isFinite(T) || T <= 0) return refuseNonpositive("temperature", T, quantityId, unit);

  const { h, c, kB } = getBasePhysicsConstants(set);
  const x = (h * nu) / (kB * T);

  // u_nu = (8 * pi * h * nu^3 / c^3) * e^-x
  const lnU = Math.log(8 * Math.PI * h) + 3 * Math.log(nu) - 3 * Math.log(c) - x;
  const packed = packLogRepresentation(lnU, "frequency");

  return {
    status: "value",
    quantityId,
    unit,
    value: packed.value,
    linearRepresentable: packed.linearRepresentable,
    ...packed.logFields,
  };
}

/** Wien wavelength energy density u_lambda (J m^-3 m^-1). */
export function wienWavelengthEnergyDensity(
  lambda: Wavelength | number,
  T: number,
  set: ConstantSet,
): RadiationResult<number> {
  const quantityId = "wavelengthEnergyDensity";
  const unit = "J/(m^3 m)";
  if (!Number.isFinite(lambda) || lambda <= 0)
    return refuseNonpositive("wavelength", lambda, quantityId, unit);
  if (!Number.isFinite(T) || T <= 0) return refuseNonpositive("temperature", T, quantityId, unit);

  const { h, c, kB } = getBasePhysicsConstants(set);
  const x = (h * c) / (lambda * kB * T);

  // u_lambda = (8 * pi * h * c / lambda^5) * e^-x
  const lnU = Math.log(8 * Math.PI * h * c) - 5 * Math.log(lambda) - x;
  const packed = packLogRepresentation(lnU, "wavelength");

  return {
    status: "value",
    quantityId,
    unit,
    value: packed.value,
    linearRepresentable: packed.linearRepresentable,
    ...packed.logFields,
  };
}

/** Rayleigh-Jeans frequency energy density u_nu (J m^-3 Hz^-1). */
export function rayleighJeansFrequencyEnergyDensity(
  nu: CyclicFrequency | number,
  T: number,
  set: ConstantSet,
): RadiationResult<number> {
  const quantityId = "frequencyEnergyDensity";
  const unit = "J/(m^3 Hz)";
  if (!Number.isFinite(nu) || nu <= 0) return refuseNonpositive("frequency", nu, quantityId, unit);
  if (!Number.isFinite(T) || T <= 0) return refuseNonpositive("temperature", T, quantityId, unit);

  const { c, kB } = getBasePhysicsConstants(set);

  // u_nu = (8 * pi * nu^2 / c^3) * k_B * T
  const lnU = Math.log(8 * Math.PI * kB * T) + 2 * Math.log(nu) - 3 * Math.log(c);
  const packed = packLogRepresentation(lnU, "frequency");

  return {
    status: "value",
    quantityId,
    unit,
    value: packed.value,
    linearRepresentable: packed.linearRepresentable,
    ...packed.logFields,
  };
}

/** Rayleigh-Jeans wavelength energy density u_lambda (J m^-3 m^-1). */
export function rayleighJeansWavelengthEnergyDensity(
  lambda: Wavelength | number,
  T: number,
  set: ConstantSet,
): RadiationResult<number> {
  const quantityId = "wavelengthEnergyDensity";
  const unit = "J/(m^3 m)";
  if (!Number.isFinite(lambda) || lambda <= 0)
    return refuseNonpositive("wavelength", lambda, quantityId, unit);
  if (!Number.isFinite(T) || T <= 0) return refuseNonpositive("temperature", T, quantityId, unit);

  const { kB } = getBasePhysicsConstants(set);

  // u_lambda = (8 * pi * k_B * T) / lambda^4
  const lnU = Math.log(8 * Math.PI * kB * T) - 4 * Math.log(lambda);
  const packed = packLogRepresentation(lnU, "wavelength");

  return {
    status: "value",
    quantityId,
    unit,
    value: packed.value,
    linearRepresentable: packed.linearRepresentable,
    ...packed.logFields,
  };
}

/**
 * Log-interval spectral energy density (nu * u_nu or lambda * u_lambda) in J m^-3.
 * Identically equal in frequency and wavelength bases.
 */
export function logIntervalEnergyDensity(
  nuOrLambda: number,
  T: number,
  set: ConstantSet,
  basis: "frequency" | "wavelength" = "frequency",
  law: "planck" | "wien" | "rayleigh-jeans" = "planck",
): RadiationResult<number> {
  const quantityId = "logIntervalEnergyDensity";
  const unit = "J/m^3";
  if (!Number.isFinite(nuOrLambda) || nuOrLambda <= 0)
    return refuseNonpositive(
      basis === "frequency" ? "frequency" : "wavelength",
      nuOrLambda,
      quantityId,
      unit,
    );
  if (!Number.isFinite(T) || T <= 0) return refuseNonpositive("temperature", T, quantityId, unit);

  let spectralResult: RadiationResult<number>;
  if (basis === "frequency") {
    if (law === "planck") spectralResult = planckFrequencyEnergyDensity(nuOrLambda, T, set);
    else if (law === "wien") spectralResult = wienFrequencyEnergyDensity(nuOrLambda, T, set);
    else spectralResult = rayleighJeansFrequencyEnergyDensity(nuOrLambda, T, set);
  } else {
    if (law === "planck") spectralResult = planckWavelengthEnergyDensity(nuOrLambda, T, set);
    else if (law === "wien") spectralResult = wienWavelengthEnergyDensity(nuOrLambda, T, set);
    else spectralResult = rayleighJeansWavelengthEnergyDensity(nuOrLambda, T, set);
  }

  if (spectralResult.status !== "value") return spectralResult;

  const linear = spectralResult.linearRepresentable ? spectralResult.value * nuOrLambda : 0;
  return {
    status: "value",
    quantityId,
    unit,
    value: linear,
    linearRepresentable: spectralResult.linearRepresentable,
  };
}

/**
 * Coordinate transform from frequency energy density u_nu to wavelength energy density u_lambda.
 * u_lambda = u_nu * |d_nu / d_lambda| = u_nu * (c / lambda^2) = u_nu * (nu^2 / c).
 */
export function spectralDensityCoordinateTransform(
  uNu: number,
  nu: CyclicFrequency | number,
  set: ConstantSet,
): {
  wavelength: number;
  jacobian: number;
  uLambda: number;
} {
  const c = constantValue(set, "speedOfLight").value;
  const lambda = c / nu;
  const jacobian = (nu * nu) / c; // |d_nu / d_lambda|
  const uLambda = uNu * jacobian;
  return {
    wavelength: lambda,
    jacobian,
    uLambda,
  };
}

/** Peak frequency of Planck spectrum: nu_peak = x_3 * k_B * T / h. */
export function planckPeakFrequency(T: number, set: ConstantSet): RadiationResult<number> {
  const quantityId = "peakFrequency";
  const unit = "Hz";
  if (!Number.isFinite(T) || T <= 0) return refuseNonpositive("temperature", T, quantityId, unit);
  const { h, kB } = getBasePhysicsConstants(set);
  const nuPeak = (X_PEAK_FREQUENCY * kB * T) / h;
  return {
    status: "value",
    quantityId,
    unit,
    value: nuPeak,
    linearRepresentable: true,
  };
}

/** Peak wavelength of Planck spectrum: lambda_peak = h * c / (x_5 * k_B * T). */
export function planckPeakWavelength(T: number, set: ConstantSet): RadiationResult<number> {
  const quantityId = "peakWavelength";
  const unit = "m";
  if (!Number.isFinite(T) || T <= 0) return refuseNonpositive("temperature", T, quantityId, unit);
  const { h, c, kB } = getBasePhysicsConstants(set);
  const lambdaPeak = (h * c) / (X_PEAK_WAVELENGTH * kB * T);
  return {
    status: "value",
    quantityId,
    unit,
    value: lambdaPeak,
    linearRepresentable: true,
  };
}

/** Peak of log-interval spectral density (nu * u_nu): x_4 = 3.920690395. */
export function planckPeakLogInterval(
  T: number,
  set: ConstantSet,
): {
  x: number;
  peakFrequency: number;
  peakWavelength: number;
} {
  const { h, c, kB } = getBasePhysicsConstants(set);
  const nuPeak = (X_PEAK_LOG_INTERVAL * kB * T) / h;
  const lambdaPeak = c / nuPeak;
  return {
    x: X_PEAK_LOG_INTERVAL,
    peakFrequency: nuPeak,
    peakWavelength: lambdaPeak,
  };
}

/**
 * Relative error analysis comparing Wien and Rayleigh-Jeans approximations to Planck's exact law.
 */
export function regimeRelativeErrors(
  nu: CyclicFrequency | number,
  T: number,
  set: ConstantSet,
  options: { epsilonW?: number; epsilonRJ?: number } = {},
): RegimeReport {
  const { h, kB } = getBasePhysicsConstants(set);
  const epsilonW = options.epsilonW ?? 0.01;
  const epsilonRJ = options.epsilonRJ ?? 0.01;

  const x = (h * nu) / (kB * T);
  const wienRelativeError = Math.exp(-x);

  // Rayleigh-Jeans relative error: |u_RJ - u_Planck| / u_Planck = (e^x - 1)/x - 1 (or |x/(e^x - 1) - 1|)
  // For x > 0, x / (e^x - 1) < 1, so error is 1 - x / (e^x - 1)
  let rayleighJeansRelativeError: number;
  if (x < 1e-7) {
    rayleighJeansRelativeError = x / 2;
  } else if (x > 100) {
    rayleighJeansRelativeError = 1.0;
  } else {
    rayleighJeansRelativeError = Math.abs(x / Math.expm1(x) - 1);
  }

  const wienBoundaryX = Math.log(1 / epsilonW);

  // Solve 1 - x / (e^x - 1) = epsilonRJ for x
  // For small epsilonRJ, x ~ 2 * epsilonRJ - (2/3) * epsilonRJ^2
  let rjBoundaryX = 2 * epsilonRJ;
  for (let iter = 0; iter < 10; iter++) {
    const fVal = Math.expm1(rjBoundaryX) - rjBoundaryX / (1 - epsilonRJ);
    const dfVal = Math.exp(rjBoundaryX) - 1 / (1 - epsilonRJ);
    const step = fVal / dfVal;
    rjBoundaryX -= step;
    if (Math.abs(step) < 1e-12) break;
  }

  const wienAdmitted = wienRelativeError <= epsilonW;
  const rayleighJeansAdmitted = rayleighJeansRelativeError <= epsilonRJ;

  let regime: "wien" | "rayleigh-jeans" | "intermediate";
  if (wienAdmitted) {
    regime = "wien";
  } else if (rayleighJeansAdmitted) {
    regime = "rayleigh-jeans";
  } else {
    regime = "intermediate";
  }

  return {
    x,
    wienRelativeError,
    rayleighJeansRelativeError,
    regime,
    wienAdmitted,
    rayleighJeansAdmitted,
    wienBoundaryX,
    rayleighJeansBoundaryX: rjBoundaryX,
  };
}
