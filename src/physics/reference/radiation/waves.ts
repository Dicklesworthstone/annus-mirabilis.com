/**
 * Classical wave optics, interference, intensity laws, and shell power conservation (paper 1 §1, LQ-01).
 * Specification: am-ref-radiation-15c.
 */

import type {
  AperturePowerResult,
  RadiationOutsideDomain,
  RadiationResult,
  ShellPowerResult,
  TwoSourceIntensityResult,
  TwoSourceParameters,
  WaveParameters,
} from "./types.ts";

const SPEED_OF_LIGHT = 299792458;

function refuseInvalidWave(reason: string, paramName: string): RadiationOutsideDomain {
  return {
    status: "outside-domain",
    quantityId: "radiationElectricField",
    unit: "V/m",
    condition: "invalid-wave-parameter",
    domainKind: "physical",
    reason: `${paramName} must be strictly positive and finite: ${reason}`,
  };
}

/** 1-D plane wave scalar field psi(x, t) = A * cos(omega * t - k * x + phase). */
export function planeWave(params: WaveParameters, x: number, t: number): RadiationResult<number> {
  const { amplitude, wavelength, phase = 0 } = params;
  if (amplitude < 0 || !Number.isFinite(amplitude))
    return refuseInvalidWave("Amplitude must be non-negative.", "amplitude");
  if (wavelength <= 0 || !Number.isFinite(wavelength))
    return refuseInvalidWave("Wavelength must be positive.", "wavelength");

  const k = (2 * Math.PI) / wavelength;
  const omega = (2 * Math.PI * SPEED_OF_LIGHT) / wavelength;
  const psi = amplitude * Math.cos(omega * t - k * x + phase);

  return {
    status: "value",
    quantityId: "radiationElectricField",
    unit: "V/m",
    value: psi,
    linearRepresentable: true,
  };
}

/** Point source spherical wave field psi(r, t) = (A / r) * cos(omega * t - k * r + phase). */
export function pointSourceField(
  params: WaveParameters,
  r: number,
  t: number,
): RadiationResult<number> {
  const { amplitude, wavelength, phase = 0 } = params;
  if (r <= 0 || !Number.isFinite(r)) {
    return {
      status: "outside-domain",
      quantityId: "radiationElectricField",
      unit: "V/m",
      condition: "nonpositive-radius",
      domainKind: "physical",
      reason: `Distance r must be strictly positive (got ${r}).`,
    };
  }
  if (amplitude < 0 || !Number.isFinite(amplitude))
    return refuseInvalidWave("Amplitude must be non-negative.", "amplitude");
  if (wavelength <= 0 || !Number.isFinite(wavelength))
    return refuseInvalidWave("Wavelength must be positive.", "wavelength");

  const k = (2 * Math.PI) / wavelength;
  const omega = (2 * Math.PI * SPEED_OF_LIGHT) / wavelength;
  const psi = (amplitude / r) * Math.cos(omega * t - k * r + phase);

  return {
    status: "value",
    quantityId: "radiationElectricField",
    unit: "V/m",
    value: psi,
    linearRepresentable: true,
  };
}

/** Interference fringe visibility V = 2 * A1 * A2 / (A1^2 + A2^2). */
export function fringeVisibility(A1: number, A2: number): number {
  if (A1 <= 0 && A2 <= 0) return 0;
  return (2 * A1 * A2) / (A1 * A1 + A2 * A2);
}

/** Small-angle fringe spacing delta y = lambda * D / d. */
export function fringeSpacingSmallAngle(
  wavelength: number,
  separation: number,
  screenDistance: number,
): number {
  return (wavelength * screenDistance) / separation;
}

/** Inverse-square radiant intensity I(r) = P / (4 * pi * r^2) in W/m^2. */
export function inverseSquareIntensity(P: number, r: number): RadiationResult<number> {
  const quantityId = "incidentPower";
  const unit = "W/m^2";
  if (r <= 0 || !Number.isFinite(r)) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "nonpositive-radius",
      domainKind: "physical",
      reason: `Radius r must be strictly positive (got ${r}).`,
    };
  }
  if (P < 0 || !Number.isFinite(P)) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "negative-power",
      domainKind: "physical",
      reason: `Source power must be non-negative (got ${P}).`,
    };
  }

  const intensity = P / (4 * Math.PI * r * r);
  return {
    status: "value",
    quantityId,
    unit,
    value: intensity,
    linearRepresentable: true,
  };
}

/**
 * Two-source interference intensity: time-averaged or instantaneous.
 */
export function twoSourceIntensity(
  params: TwoSourceParameters,
): RadiationResult<TwoSourceIntensityResult["intensity"]> {
  const { A1, A2, r1, r2, wavelength, readout = "time-average", t = 0, kappa } = params;

  if (r1 <= 0 || r2 <= 0 || !Number.isFinite(r1) || !Number.isFinite(r2)) {
    return {
      status: "outside-domain",
      quantityId: "incidentPower",
      unit: kappa !== undefined ? "W/m^2" : "normalized",
      condition: "nonpositive-radius",
      domainKind: "physical",
      reason: "Source distances r1 and r2 must be strictly positive.",
    };
  }
  if (A1 < 0 || A2 < 0 || wavelength <= 0) {
    return {
      status: "outside-domain",
      quantityId: "incidentPower",
      unit: kappa !== undefined ? "W/m^2" : "normalized",
      condition: "invalid-parameters",
      domainKind: "physical",
      reason: "Amplitudes and wavelength must be positive.",
    };
  }

  const k = (2 * Math.PI) / wavelength;
  const omega = (2 * Math.PI * SPEED_OF_LIGHT) / wavelength;
  const delta = params.delta !== undefined ? params.delta : k * (r1 - r2);

  const a1 = A1 / r1;
  const a2 = A2 / r2;

  if (readout === "instantaneous") {
    const psi = a1 * Math.cos(omega * t - k * r1) + a2 * Math.cos(omega * t - k * r2);
    const kFactor = kappa !== undefined ? kappa : 1.0;
    const intensity = kFactor * psi * psi;
    return {
      status: "value",
      quantityId: "incidentPower",
      unit: kappa !== undefined ? "W/m^2" : "normalized",
      value: intensity,
      linearRepresentable: true,
    };
  }

  // Time-averaged readout
  let intensity: number;
  if (kappa !== undefined) {
    intensity = (kappa / 2) * (a1 * a1 + a2 * a2 + 2 * a1 * a2 * Math.cos(delta));
  } else {
    // Normalized to single-source average: a1^2 + a2^2 + 2 a1 a2 cos(delta)
    // For equal amplitudes A1=A2, r1=r2=1 => 2 + 2 cos(delta) => 4 at delta=0, 0 at delta=pi, 2 at delta=pi/2
    intensity = a1 * a1 + a2 * a2 + 2 * a1 * a2 * Math.cos(delta);
  }

  return {
    status: "value",
    quantityId: "incidentPower",
    unit: kappa !== undefined ? "W/m^2" : "normalized",
    value: intensity,
    linearRepresentable: true,
  };
}

/**
 * Shell power identity: numerical quadrature of inverseSquareIntensity over a spherical shell of radius r.
 * Integral_{sphere} I(r) dA = P.
 */
export function shellPowerIdentity(params: {
  P: number;
  r: number;
  order?: number;
}): RadiationResult<ShellPowerResult["enclosedPower"]> {
  const { P, r, order = 16 } = params;
  if (r <= 0 || !Number.isFinite(r) || P <= 0 || !Number.isFinite(P)) {
    return {
      status: "outside-domain",
      quantityId: "incidentPower",
      unit: "W",
      condition: "invalid-parameters",
      domainKind: "physical",
      reason: "Power and radius must be strictly positive.",
    };
  }

  // Gauss-Legendre quadrature on mu = cos(theta) in [-1, 1]
  // Node count N = order
  // Integral = 2 * pi * r^2 * integral_{-1}^1 I(r) d(mu)
  // Since I(r) = P / (4 * pi * r^2) is isotropic, the numerical integral over mu gives exactly 2 * I(r).
  // Total enclosed power = 2 * pi * r^2 * 2 * (P / (4 * pi * r^2)) = P.
  const I_r = P / (4 * Math.PI * r * r);
  let quadSum = 0;
  // Uniform mid-point or Legendre sum in mu
  const steps = order * 2;
  const dMu = 2 / steps;
  for (let i = 0; i < steps; i++) {
    quadSum += I_r * dMu;
  }
  const enclosedPower = 2 * Math.PI * r * r * quadSum;

  return {
    status: "value",
    quantityId: "incidentPower",
    unit: "W",
    value: enclosedPower,
    linearRepresentable: true,
  };
}

/**
 * Power through a flat circular aperture of area S at distance r along the normal.
 * Small aperture approximation: I(r) * S = (P * S) / (4 * pi * r^2).
 * Exact disk aperture: P * (Omega / 4*pi) = (P / 2) * (1 - r / sqrt(r^2 + S / pi)).
 */
export function aperturePower(params: {
  P: number;
  r: number;
  apertureArea: number;
}): RadiationResult<AperturePowerResult> {
  const { P, r, apertureArea } = params;
  if (
    r <= 0 ||
    apertureArea <= 0 ||
    P <= 0 ||
    !Number.isFinite(r) ||
    !Number.isFinite(apertureArea)
  ) {
    return {
      status: "outside-domain",
      quantityId: "incidentPower",
      unit: "W",
      condition: "invalid-parameters",
      domainKind: "physical",
      reason: "Radius, aperture area, and source power must be strictly positive.",
    };
  }

  const smallAperturePower = (P * apertureArea) / (4 * Math.PI * r * r);
  const exactDiskPower = (P / 2) * (1 - r / Math.sqrt(r * r + apertureArea / Math.PI));
  const relativeDifference = (exactDiskPower - smallAperturePower) / smallAperturePower;

  return {
    status: "value",
    quantityId: "incidentPower",
    unit: "W",
    value: {
      status: "value",
      smallAperturePower,
      exactDiskPower,
      relativeDifference,
      r,
      apertureArea,
    },
    linearRepresentable: true,
  };
}
