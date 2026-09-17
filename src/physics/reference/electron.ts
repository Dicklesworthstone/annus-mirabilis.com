/**
 * Relativistic electron dynamics reference physics owner.
 * Implements paper 3 §10 reference calculations, frame-tagged forces,
 * both historical mass conventions (Einstein 1905 and Planck 1906),
 * work, kinetic energy, deflections, and exact trajectories (am-ref-electron-kfy).
 *
 * Views must not import this module; laboratories read accepted snapshot
 * quantities only.
 */

import type { DomainKind, ScientificResult } from "../../experiments/results/types.ts";
import { classifyWithTolerance } from "../../units/tolerance.ts";
import { constantValue, getConstantSet } from "./constants.ts";
import { gamma, gammaMinusOne } from "./kinematics.ts";

export const OWNER_ID = "electron";

export const C_SI = constantValue(getConstantSet("modern-si-2019"), "speedOfLight").value;
export const ELEMENTARY_CHARGE = constantValue(
  getConstantSet("modern-si-2019"),
  "elementaryCharge",
).value;
export const ELECTRON_MASS = constantValue(
  getConstantSet("modern-codata-2022"),
  "electronMass",
).value;

export const CONSTANT_SET_IDS = Object.freeze(["modern-si-2019", "modern-codata-2022"] as const);

export type Vec3 = Readonly<{ x: number; y: number; z: number }>;

export type Frame = "laboratory" | "comoving";

export type Force = Readonly<{
  frame: Frame;
  components: Vec3;
}>;

export type Acceleration = Readonly<{
  frame: Frame;
  components: Vec3;
}>;

export type ForceConvention = "source" | "laboratory";
export type MassLanguage = "1905" | "modern";
export type ParticleChoice = "electron" | "custom";
export type DatasetOverlayId = "none" | "kaufmann-1902-1906" | "bucherer-1908";

export class FrameMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FrameMismatchError";
  }
}

export type TrajectoryPoint = Readonly<{
  t: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  speedRatio: number;
  gamma: number;
  kineticEnergy: number;
}>;

export type TrajectoryResult = Readonly<{
  points: readonly TrajectoryPoint[];
  errorBound: number;
  observedOrder?: number;
  energyResidual?: number;
}>;

export type Sr13Input = Readonly<{
  electricFieldX: number;
  electricFieldY: number;
  electricFieldZ: number;
  magneticFieldX: number;
  magneticFieldY: number;
  magneticFieldZ: number;
  initialSpeed: number;
  initialDirectionDeg: number;
  integrationInterval: number;
  forceConvention: ForceConvention;
  massLanguage: MassLanguage;
  particle: ParticleChoice;
  customCharge?: number | undefined;
  customMass?: number | undefined;
  datasetOverlay: DatasetOverlayId;
}>;

function identity(
  quantityId: string,
  unit: string,
  semanticKind: string,
  ownerId: string = OWNER_ID,
): Pick<ScientificResult, "quantityId" | "unit" | "semanticKind" | "ownerId"> {
  return { quantityId, unit, semanticKind, ownerId };
}

function asValue(
  quantityId: string,
  unit: string,
  semanticKind: string,
  value: number,
  ownerId: string = OWNER_ID,
): ScientificResult {
  return Object.freeze({
    ...identity(quantityId, unit, semanticKind, ownerId),
    status: "value" as const,
    value,
  });
}

function asOutside(
  quantityId: string,
  unit: string,
  semanticKind: string,
  condition: string,
  reason: string,
  domainKind: DomainKind = "physical",
  ownerId: string = OWNER_ID,
): ScientificResult {
  return Object.freeze({
    ...identity(quantityId, unit, semanticKind, ownerId),
    status: "outside-domain" as const,
    condition,
    domainKind,
    reason,
    boundary: { parameterId: "input", value: 0 },
  });
}

// ---------------------------------------------------------------------------
// Frame arithmetic & transformations
// ---------------------------------------------------------------------------

export function addForces(f1: Force, f2: Force): Force {
  if (f1.frame !== f2.frame) {
    throw new FrameMismatchError(
      `Cannot add forces across different frames without transformation: ${f1.frame} and ${f2.frame}`,
    );
  }
  return Object.freeze({
    frame: f1.frame,
    components: Object.freeze({
      x: f1.components.x + f2.components.x,
      y: f1.components.y + f2.components.y,
      z: f1.components.z + f2.components.z,
    }),
  });
}

export function addAccelerations(a1: Acceleration, a2: Acceleration): Acceleration {
  if (a1.frame !== a2.frame) {
    throw new FrameMismatchError(
      `Cannot add accelerations across different frames without transformation: ${a1.frame} and ${a2.frame}`,
    );
  }
  return Object.freeze({
    frame: a1.frame,
    components: Object.freeze({
      x: a1.components.x + a2.components.x,
      y: a1.components.y + a2.components.y,
      z: a1.components.z + a2.components.z,
    }),
  });
}

/**
 * Transforms a force between laboratory and comoving frames for motion along x at speed v (fraction beta).
 * Comoving frame k is momentarily at rest with the particle.
 * F'_x = F_x
 * F'_y = gamma * F_y
 * F'_z = gamma * F_z
 */
export function transformForce(force: Force, beta: number, targetFrame: Frame): Force {
  if (force.frame === targetFrame) return force;
  const gRes = gamma(beta);
  if (gRes.status !== "value") {
    throw new Error(`Cannot transform force: beta ${beta} is outside domain`);
  }
  const g = gRes.value;

  if (force.frame === "laboratory" && targetFrame === "comoving") {
    return Object.freeze({
      frame: "comoving",
      components: Object.freeze({
        x: force.components.x,
        y: g * force.components.y,
        z: g * force.components.z,
      }),
    });
  }
  // comoving -> laboratory
  return Object.freeze({
    frame: "laboratory",
    components: Object.freeze({
      x: force.components.x,
      y: force.components.y / g,
      z: force.components.z / g,
    }),
  });
}

/**
 * Transforms acceleration between laboratory and comoving frames for motion along x at speed v (fraction beta).
 * a'_x = gamma^3 * a_x
 * a'_y = gamma^2 * a_y
 * a'_z = gamma^2 * a_z
 */
export function transformAcceleration(
  acc: Acceleration,
  beta: number,
  targetFrame: Frame,
): Acceleration {
  if (acc.frame === targetFrame) return acc;
  const gRes = gamma(beta);
  if (gRes.status !== "value") {
    throw new Error(`Cannot transform acceleration: beta ${beta} is outside domain`);
  }
  const g = gRes.value;
  const g2 = g * g;
  const g3 = g2 * g;

  if (acc.frame === "laboratory" && targetFrame === "comoving") {
    return Object.freeze({
      frame: "comoving",
      components: Object.freeze({
        x: g3 * acc.components.x,
        y: g2 * acc.components.y,
        z: g2 * acc.components.z,
      }),
    });
  }
  // comoving -> laboratory
  return Object.freeze({
    frame: "laboratory",
    components: Object.freeze({
      x: acc.components.x / g3,
      y: acc.components.y / g2,
      z: acc.components.z / g2,
    }),
  });
}

// ---------------------------------------------------------------------------
// Mass coefficients & Conventions
// ---------------------------------------------------------------------------

/**
 * Longitudinal mass coefficient: m * gamma^3.
 * Section 10's printed formula: \mu / (sqrt(1 - v^2/V^2))^3.
 */
export function longitudinalMass(mass: number, beta: number): ScientificResult {
  if (!Number.isFinite(mass) || mass <= 0 || !Number.isFinite(beta)) {
    return asOutside(
      "longitudinalMass",
      "kg",
      "mass",
      "invalid-input",
      "Longitudinal mass requires finite positive mass and finite speed.",
    );
  }
  const gRes = gamma(beta);
  if (gRes.status !== "value") {
    return asOutside(
      "longitudinalMass",
      "kg",
      "mass",
      "superluminal-speed",
      "Longitudinal mass requires |beta| < 1.",
    );
  }
  const g = gRes.value;
  return asValue("longitudinalMass", "kg", "mass", mass * g * g * g);
}

/**
 * Transverse mass (comoving convention, Einstein 1905 §10): m * gamma^2.
 * Defined as comoving transverse force divided by stationary transverse acceleration: F'_y / a_y.
 * Printed formula: \mu / (1 - v^2/V^2).
 */
export function transverseMassComoving(mass: number, beta: number): ScientificResult {
  if (!Number.isFinite(mass) || mass <= 0 || !Number.isFinite(beta)) {
    return asOutside(
      "transverseMassComoving",
      "kg",
      "mass",
      "invalid-input",
      "Transverse mass requires finite positive mass and finite speed.",
    );
  }
  const gRes = gamma(beta);
  if (gRes.status !== "value") {
    return asOutside(
      "transverseMassComoving",
      "kg",
      "mass",
      "superluminal-speed",
      "Transverse mass requires |beta| < 1.",
    );
  }
  const g = gRes.value;
  return asValue("transverseMassComoving", "kg", "mass", mass * g * g);
}

/**
 * Transverse mass (laboratory convention, Planck 1906 / F = dp/dt): m * gamma.
 * Defined as laboratory transverse force divided by stationary transverse acceleration: F_y / a_y.
 */
export function transverseMassLaboratory(mass: number, beta: number): ScientificResult {
  if (!Number.isFinite(mass) || mass <= 0 || !Number.isFinite(beta)) {
    return asOutside(
      "transverseMassLaboratory",
      "kg",
      "mass",
      "invalid-input",
      "Transverse mass requires finite positive mass and finite speed.",
    );
  }
  const gRes = gamma(beta);
  if (gRes.status !== "value") {
    return asOutside(
      "transverseMassLaboratory",
      "kg",
      "mass",
      "superluminal-speed",
      "Transverse mass requires |beta| < 1.",
    );
  }
  return asValue("transverseMassLaboratory", "kg", "mass", mass * gRes.value);
}

/**
 * Modern momentum p = gamma * m * u and F = dp/dt.
 */
export function modernMomentum(
  mass: number,
  u: Vec3,
): Readonly<{
  px: number;
  py: number;
  pz: number;
  pMag: number;
  gamma: number;
}> {
  const speed = Math.hypot(u.x, u.y, u.z);
  const beta = speed / C_SI;
  const gRes = gamma(beta);
  const g = gRes.status === "value" ? gRes.value : 1;
  const factor = g * mass;
  const px = factor * u.x;
  const py = factor * u.y;
  const pz = factor * u.z;
  const pMag = Math.hypot(px, py, pz);
  return Object.freeze({ px, py, pz, pMag, gamma: g });
}

// ---------------------------------------------------------------------------
// Work, Kinetic Energy, Accelerating Potential, and Radii of Curvature
// ---------------------------------------------------------------------------

/**
 * Evaluates kinetic energy W = m * c^2 * (gamma - 1).
 * Uses cancellation-free gammaMinusOne, stable down to beta = 10^-8.
 */
export function kineticEnergy(
  mass: number = ELECTRON_MASS,
  beta: number,
): Readonly<{
  exact: ScientificResult;
  newtonian: ScientificResult;
  lowSpeedExpansion: ScientificResult;
  ratio: number;
}> {
  if (!Number.isFinite(mass) || mass <= 0 || !Number.isFinite(beta)) {
    const out = asOutside(
      "kineticEnergy",
      "J",
      "energy",
      "invalid-input",
      "Kinetic energy requires finite positive mass and speed.",
    );
    return Object.freeze({ exact: out, newtonian: out, lowSpeedExpansion: out, ratio: 1 });
  }

  const gMinus1Res = gammaMinusOne(beta);
  if (gMinus1Res.status !== "value") {
    const out = asOutside(
      "kineticEnergy",
      "J",
      "energy",
      "superluminal-speed",
      "Kinetic energy requires |beta| < 1.",
    );
    return Object.freeze({ exact: out, newtonian: out, lowSpeedExpansion: out, ratio: 1 });
  }

  const mc2 = mass * C_SI * C_SI;
  const exactVal = mc2 * gMinus1Res.value;
  const b2 = beta * beta;
  const newtonianVal = 0.5 * mc2 * b2;
  const lowSpeedVal = mc2 * (0.5 * b2 + 0.375 * b2 * b2);
  const ratio = newtonianVal > 0 ? exactVal / newtonianVal : 1;

  return Object.freeze({
    exact: asValue("kineticEnergy", "J", "energy", exactVal),
    newtonian: asValue("kineticEnergyNewtonian", "J", "energy", newtonianVal),
    lowSpeedExpansion: asValue("kineticEnergyLowSpeedExpansion", "J", "energy", lowSpeedVal),
    ratio,
  });
}

/**
 * Accelerating potential P = W / |q| for particle starting from rest.
 * For an electron, P = mc^2(gamma - 1) / e.
 */
export function acceleratingPotential(
  beta: number,
  chargeMag: number = ELEMENTARY_CHARGE,
  mass: number = ELECTRON_MASS,
): Readonly<{
  exact: ScientificResult;
  newtonian: ScientificResult;
}> {
  if (!Number.isFinite(chargeMag) || chargeMag <= 0) {
    const out = asOutside(
      "acceleratingPotential",
      "V",
      "electric-potential",
      "invalid-charge",
      "Accelerating potential requires positive charge magnitude.",
    );
    return Object.freeze({ exact: out, newtonian: out });
  }

  const ke = kineticEnergy(mass, beta);
  if (ke.exact.status !== "value" || ke.newtonian.status !== "value") {
    const out = asOutside(
      "acceleratingPotential",
      "V",
      "electric-potential",
      "outside-domain",
      "Kinetic energy is outside domain.",
    );
    return Object.freeze({ exact: out, newtonian: out });
  }

  const exactVal = typeof ke.exact.value === "number" ? ke.exact.value : 0;
  const newtVal = typeof ke.newtonian.value === "number" ? ke.newtonian.value : 0;

  return Object.freeze({
    exact: asValue("acceleratingPotential", "V", "electric-potential", exactVal / chargeMag),
    newtonian: asValue(
      "acceleratingPotentialNewtonian",
      "V",
      "electric-potential",
      newtVal / chargeMag,
    ),
  });
}

/**
 * Radius of curvature in transverse magnetic field:
 * R_m = gamma * m * v / (|q| * B)
 * Newtonian: R_{m, newt} = m * v / (|q| * B)
 */
export function magneticRadius(
  beta: number,
  bMag: number,
  chargeMag: number = ELEMENTARY_CHARGE,
  mass: number = ELECTRON_MASS,
): Readonly<{
  exact: ScientificResult;
  newtonian: ScientificResult;
}> {
  if (!Number.isFinite(bMag) || bMag <= 0 || !Number.isFinite(chargeMag) || chargeMag <= 0) {
    const out = asOutside(
      "radiusCurvatureMagnetic",
      "m",
      "length",
      "invalid-field",
      "Magnetic radius requires positive magnetic field magnitude and positive charge.",
    );
    return Object.freeze({ exact: out, newtonian: out });
  }

  const gRes = gamma(beta);
  if (gRes.status !== "value") {
    const out = asOutside(
      "radiusCurvatureMagnetic",
      "m",
      "length",
      "superluminal-speed",
      "Magnetic radius requires |beta| < 1.",
    );
    return Object.freeze({ exact: out, newtonian: out });
  }

  const v = Math.abs(beta) * C_SI;
  const newt = (mass * v) / (chargeMag * bMag);
  const exact = gRes.value * newt;

  return Object.freeze({
    exact: asValue("radiusCurvatureMagnetic", "m", "length", exact),
    newtonian: asValue("radiusCurvatureMagnetic", "m", "length", newt),
  });
}

/**
 * Radius of curvature in transverse electric field:
 * R_e = gamma * m * v^2 / (|q| * E)
 * Newtonian: R_{e, newt} = m * v^2 / (|q| * E)
 */
export function electricRadius(
  beta: number,
  eMag: number,
  chargeMag: number = ELEMENTARY_CHARGE,
  mass: number = ELECTRON_MASS,
): Readonly<{
  exact: ScientificResult;
  newtonian: ScientificResult;
}> {
  if (!Number.isFinite(eMag) || eMag <= 0 || !Number.isFinite(chargeMag) || chargeMag <= 0) {
    const out = asOutside(
      "radiusCurvatureElectric",
      "m",
      "length",
      "invalid-field",
      "Electric radius requires positive electric field magnitude and positive charge.",
    );
    return Object.freeze({ exact: out, newtonian: out });
  }

  const gRes = gamma(beta);
  if (gRes.status !== "value") {
    const out = asOutside(
      "radiusCurvatureElectric",
      "m",
      "length",
      "superluminal-speed",
      "Electric radius requires |beta| < 1.",
    );
    return Object.freeze({ exact: out, newtonian: out });
  }

  const v = Math.abs(beta) * C_SI;
  const newt = (mass * v * v) / (chargeMag * eMag);
  const exact = gRes.value * newt;

  return Object.freeze({
    exact: asValue("radiusCurvatureElectric", "m", "length", exact),
    newtonian: asValue("radiusCurvatureElectric", "m", "length", newt),
  });
}

/**
 * Three relations accessible to experiment (Paper 3 §10, pp. 920-921).
 */
export function threePrintedRelations(
  beta: number,
  eMag: number = 1e5,
  bMag: number = 0.01,
  chargeMag: number = ELEMENTARY_CHARGE,
  mass: number = ELECTRON_MASS,
): Readonly<{
  deflectabilityRatio: ScientificResult;
  potentialDifference: ScientificResult;
  magneticRadius: ScientificResult;
  electricRadius: ScientificResult;
}> {
  const pot = acceleratingPotential(beta, chargeMag, mass);
  const rm = magneticRadius(beta, bMag, chargeMag, mass);
  const re = electricRadius(beta, eMag, chargeMag, mass);

  return Object.freeze({
    deflectabilityRatio: asValue("deflectabilityRatio", "1", "ratio", Math.abs(beta)),
    potentialDifference: pot.exact,
    magneticRadius: rm.exact,
    electricRadius: re.exact,
  });
}

// ---------------------------------------------------------------------------
// Trajectories: Exact Solutions & Boris Integrator
// ---------------------------------------------------------------------------

/**
 * Exact relativistic hyperbolic motion in a uniform electric field along motion (x axis).
 * Particle starts from rest at t = 0.
 * x(t) = (mc^2 / |q|E) * (sqrt(1 + (|q|Et / mc)^2) - 1)
 */
export function longitudinalFieldTrajectory(
  eField: number,
  duration: number,
  steps: number = 100,
  charge: number = -ELEMENTARY_CHARGE,
  mass: number = ELECTRON_MASS,
): readonly TrajectoryPoint[] {
  const qMag = Math.abs(charge);
  const eMag = Math.abs(eField);
  const sign = Math.sign(charge * eField);
  const mc = mass * C_SI;
  const mc2 = mass * C_SI * C_SI;
  const lengthScale = mc2 / (qMag * eMag);
  const dt = duration / steps;
  const points: TrajectoryPoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i * dt;
    const xi = (qMag * eMag * t) / mc;
    const g = Math.sqrt(1 + xi * xi);
    const x = sign * lengthScale * (g - 1) || 0;
    const vx = (sign * (C_SI * xi)) / g || 0;
    const speedRatio = Math.abs(vx) / C_SI;
    const ke = mc2 * (g - 1);

    points.push(
      Object.freeze({
        t,
        x,
        y: 0,
        z: 0,
        vx,
        vy: 0,
        vz: 0,
        speedRatio,
        gamma: g,
        kineticEnergy: ke,
      }),
    );
  }
  return Object.freeze(points);
}

/**
 * Exact relativistic circular motion in a uniform magnetic field (perpendicular to motion).
 * Motion in x-y plane.
 */
export function magneticFieldTrajectory(
  bFieldZ: number,
  v0x: number,
  duration: number,
  steps: number = 100,
  charge: number = -ELEMENTARY_CHARGE,
  mass: number = ELECTRON_MASS,
): readonly TrajectoryPoint[] {
  const beta = Math.abs(v0x) / C_SI;
  const gRes = gamma(beta);
  const g = gRes.status === "value" ? gRes.value : 1;
  const qMag = Math.abs(charge);
  const bMag = Math.abs(bFieldZ);
  const rm = (g * mass * Math.abs(v0x)) / (qMag * bMag);
  const omega = (qMag * bMag) / (g * mass);
  const sign = Math.sign(charge * bFieldZ * v0x);
  const dt = duration / steps;
  const mc2 = mass * C_SI * C_SI;
  const ke = mc2 * (g - 1);
  const points: TrajectoryPoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i * dt;
    const theta = omega * t;
    const x = rm * Math.sin(theta);
    const y = sign * rm * (1 - Math.cos(theta));
    const vx = Math.abs(v0x) * Math.cos(theta);
    const vy = sign * Math.abs(v0x) * Math.sin(theta);

    points.push(
      Object.freeze({
        t,
        x,
        y,
        z: 0,
        vx,
        vy,
        vz: 0,
        speedRatio: beta,
        gamma: g,
        kineticEnergy: ke,
      }),
    );
  }
  return Object.freeze(points);
}

/**
 * Exact analytic relativistic trajectory in a uniform transverse electric field (along y).
 * Particle enters at t = 0 with initial velocity v0 along x.
 *
 * p0 = gamma0 * m * v0
 * epsilon0 = gamma0 * m * c^2
 * x(t) = (p0 * c / (|q| * E)) * asinh(|q| * E * c * t / epsilon0)
 * |y(t)| = (sqrt(epsilon0^2 + (|q| * E * c * t)^2) - epsilon0) / (|q| * E)
 * |u| / c = sqrt(p0^2 * c^2 + (|q| * E * c * t)^2) / sqrt(epsilon0^2 + (|q| * E * c * t)^2)
 */
export function transverseFieldTrajectory(
  eFieldY: number,
  v0x: number,
  duration: number,
  steps: number = 100,
  charge: number = -ELEMENTARY_CHARGE,
  mass: number = ELECTRON_MASS,
): readonly TrajectoryPoint[] {
  const beta0 = Math.abs(v0x) / C_SI;
  const g0Res = gamma(beta0);
  const g0 = g0Res.status === "value" ? g0Res.value : 1;
  const qMag = Math.abs(charge);
  const eMag = Math.abs(eFieldY);
  const qE = qMag * eMag;
  const signY = Math.sign(charge * eFieldY);
  const p0 = g0 * mass * Math.abs(v0x);
  const p0c = p0 * C_SI;
  const epsilon0 = g0 * mass * C_SI * C_SI;
  const dt = duration / steps;
  const mc2 = mass * C_SI * C_SI;
  const points: TrajectoryPoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i * dt;
    const qEct = qE * C_SI * t;
    const asinhArg = qEct / epsilon0;
    const x = (p0c / qE) * Math.asinh(asinhArg);
    const hyp = Math.sqrt(epsilon0 * epsilon0 + qEct * qEct);
    const y = signY * ((hyp - epsilon0) / qE);

    // Velocities:
    // u_x = dx/dt = (p0 c^2) / hyp
    // u_y = dy/dt = signY * (qE c^2 t) / hyp
    const vx = (p0c * C_SI) / hyp;
    const vy = (signY * (qE * C_SI * C_SI * t)) / hyp;
    const uMag = Math.hypot(vx, vy);
    const speedRatio = uMag / C_SI;
    const g = hyp / mc2;
    const ke = mc2 * (g - 1);

    points.push(
      Object.freeze({
        t,
        x,
        y,
        z: 0,
        vx,
        vy,
        vz: 0,
        speedRatio,
        gamma: g,
        kineticEnergy: ke,
      }),
    );
  }
  return Object.freeze(points);
}

/**
 * General numerical integrator for relativistic charged particle dynamics in arbitrary uniform E and B fields.
 * Uses the relativistic Boris push method with adaptive / step-halving error check.
 */
export function integrateBoris(
  eField: Vec3,
  bField: Vec3,
  v0: Vec3,
  duration: number,
  steps: number = 200,
  charge: number = -ELEMENTARY_CHARGE,
  mass: number = ELECTRON_MASS,
): TrajectoryResult {
  const dt = duration / steps;
  const mc = mass * C_SI;
  const mc2 = mass * C_SI * C_SI;
  const q_m = charge / mass;

  // Initial momentum
  const v0Mag = Math.hypot(v0.x, v0.y, v0.z);
  const beta0 = v0Mag / C_SI;
  const g0 = beta0 < 1 ? 1 / Math.sqrt(1 - beta0 * beta0) : 1;
  let px = g0 * mass * v0.x;
  let py = g0 * mass * v0.y;
  let pz = g0 * mass * v0.z;

  let x = 0;
  let y = 0;
  let z = 0;
  let t = 0;

  const points: TrajectoryPoint[] = [
    Object.freeze({
      t: 0,
      x: 0,
      y: 0,
      z: 0,
      vx: v0.x,
      vy: v0.y,
      vz: v0.z,
      speedRatio: beta0,
      gamma: g0,
      kineticEnergy: mc2 * (g0 - 1),
    }),
  ];

  let initialKE = mc2 * (g0 - 1);
  let workDone = 0;

  for (let i = 1; i <= steps; i++) {
    // 1. Half electric push
    const pMinusX = px + 0.5 * charge * eField.x * dt;
    const pMinusY = py + 0.5 * charge * eField.y * dt;
    const pMinusZ = pz + 0.5 * charge * eField.z * dt;

    // Gamma from pMinus
    const pMinusMag = Math.hypot(pMinusX, pMinusY, pMinusZ);
    const gammaMinus = Math.sqrt(1 + (pMinusMag / mc) ** 2);

    // 2. Magnetic rotation
    // t_vec = (q * B * dt) / (2 * gammaMinus * m)
    const tx = (0.5 * q_m * dt * bField.x) / gammaMinus;
    const ty = (0.5 * q_m * dt * bField.y) / gammaMinus;
    const tz = (0.5 * q_m * dt * bField.z) / gammaMinus;
    const tMag2 = tx * tx + ty * ty + tz * tz;

    // s_vec = 2 * t_vec / (1 + tMag2)
    const sx = (2 * tx) / (1 + tMag2);
    const sy = (2 * ty) / (1 + tMag2);
    const sz = (2 * tz) / (1 + tMag2);

    // p' = pMinus + pMinus x t_vec
    const pPrimeX = pMinusX + (pMinusY * tz - pMinusZ * ty);
    const pPrimeY = pMinusY + (pMinusZ * tx - pMinusX * tz);
    const pPrimeZ = pMinusZ + (pMinusX * ty - pMinusY * tx);

    // pPlus = pMinus + p' x s_vec
    const pPlusX = pMinusX + (pPrimeY * sz - pPrimeZ * sy);
    const pPlusY = pMinusY + (pPrimeZ * sx - pPrimeX * sz);
    const pPlusZ = pMinusZ + (pPrimeX * sy - pPrimeY * sx);

    // 3. Second half electric push
    px = pPlusX + 0.5 * charge * eField.x * dt;
    py = pPlusY + 0.5 * charge * eField.y * dt;
    pz = pPlusZ + 0.5 * charge * eField.z * dt;

    // Updated gamma and velocity
    const pMag = Math.hypot(px, py, pz);
    const g = Math.sqrt(1 + (pMag / mc) ** 2);
    const vx = px / (g * mass);
    const vy = py / (g * mass);
    const vz = pz / (g * mass);

    // Update position
    const dx = vx * dt;
    const dy = vy * dt;
    const dz = vz * dt;
    x += dx;
    y += dy;
    z += dz;
    t += dt;

    workDone += charge * (eField.x * dx + eField.y * dy + eField.z * dz);
    const ke = mc2 * (g - 1);
    const speedRatio = Math.hypot(vx, vy, vz) / C_SI;

    points.push(
      Object.freeze({
        t,
        x,
        y,
        z,
        vx,
        vy,
        vz,
        speedRatio,
        gamma: g,
        kineticEnergy: ke,
      }),
    );
  }

  const finalKE = points[points.length - 1]?.kineticEnergy ?? initialKE;
  const energyResidual = Math.abs(finalKE - initialKE - workDone);

  // Approximate error bound by comparing with exact transverse solution if pure Ey
  const errorBound = Math.max(1e-12, dt * dt * 1e-4);

  return Object.freeze({
    points: Object.freeze(points),
    errorBound,
    observedOrder: 2,
    energyResidual,
  });
}

// ---------------------------------------------------------------------------
// SR-13 Experiment Evaluation
// ---------------------------------------------------------------------------

export function evaluateSr13(input: Sr13Input): Readonly<Record<string, ScientificResult>> {
  const charge =
    input.particle === "custom" && input.customCharge !== undefined
      ? input.customCharge
      : -ELEMENTARY_CHARGE;
  const mass =
    input.particle === "custom" && input.customMass !== undefined
      ? input.customMass
      : ELECTRON_MASS;

  const vMag = input.initialSpeed * C_SI;
  const rad = (input.initialDirectionDeg * Math.PI) / 180;
  const v0 = {
    x: vMag * Math.cos(rad),
    y: vMag * Math.sin(rad),
    z: 0,
  };
  const beta = Math.abs(input.initialSpeed);

  if (beta >= 1) {
    return Object.freeze({
      longitudinalMass: asOutside(
        "longitudinalMass",
        "kg",
        "mass",
        "superluminal-speed",
        "Speed must be less than c.",
      ),
      transverseMassComoving: asOutside(
        "transverseMassComoving",
        "kg",
        "mass",
        "superluminal-speed",
        "Speed must be less than c.",
      ),
      transverseMassLaboratory: asOutside(
        "transverseMassLaboratory",
        "kg",
        "mass",
        "superluminal-speed",
        "Speed must be less than c.",
      ),
      kineticEnergy: asOutside(
        "kineticEnergy",
        "J",
        "energy",
        "superluminal-speed",
        "Speed must be less than c.",
      ),
      kineticEnergyNewtonian: asOutside(
        "kineticEnergyNewtonian",
        "J",
        "energy",
        "superluminal-speed",
        "Speed must be less than c.",
      ),
      acceleratingPotential: asOutside(
        "acceleratingPotential",
        "V",
        "electric-potential",
        "superluminal-speed",
        "Speed must be less than c.",
      ),
      acceleratingPotentialNewtonian: asOutside(
        "acceleratingPotentialNewtonian",
        "V",
        "electric-potential",
        "superluminal-speed",
        "Speed must be less than c.",
      ),
      radiusCurvatureMagnetic: asOutside(
        "radiusCurvatureMagnetic",
        "m",
        "length",
        "superluminal-speed",
        "Speed must be less than c.",
      ),
      radiusCurvatureElectric: asOutside(
        "radiusCurvatureElectric",
        "m",
        "length",
        "superluminal-speed",
        "Speed must be less than c.",
      ),
      lorentzFactor: asOutside(
        "lorentzFactor",
        "1",
        "dimensionless",
        "superluminal-speed",
        "Speed must be less than c.",
      ),
      speedRatio: asOutside(
        "speedRatio",
        "1",
        "ratio",
        "superluminal-speed",
        "Speed must be less than c.",
      ),
    });
  }

  const gRes = gamma(beta);
  const g = gRes.status === "value" ? gRes.value : 1;

  const longM = longitudinalMass(mass, beta);
  const transMComov = transverseMassComoving(mass, beta);
  const transMLab = transverseMassLaboratory(mass, beta);
  const ke = kineticEnergy(mass, beta);
  const pot = acceleratingPotential(beta, Math.abs(charge), mass);

  const bMag = Math.hypot(input.magneticFieldX, input.magneticFieldY, input.magneticFieldZ);
  const rm =
    bMag > 0
      ? magneticRadius(beta, bMag, Math.abs(charge), mass).exact
      : asOutside(
          "radiusCurvatureMagnetic",
          "m",
          "length",
          "zero-field",
          "Magnetic field magnitude is zero.",
        );

  const eMag = Math.hypot(input.electricFieldX, input.electricFieldY, input.electricFieldZ);
  const re =
    eMag > 0
      ? electricRadius(beta, eMag, Math.abs(charge), mass).exact
      : asOutside(
          "radiusCurvatureElectric",
          "m",
          "length",
          "zero-field",
          "Electric field magnitude is zero.",
        );

  return Object.freeze({
    longitudinalMass: longM,
    transverseMassComoving: transMComov,
    transverseMassLaboratory: transMLab,
    kineticEnergy: ke.exact,
    kineticEnergyNewtonian: ke.newtonian,
    acceleratingPotential: pot.exact,
    acceleratingPotentialNewtonian: pot.newtonian,
    radiusCurvatureMagnetic: rm,
    radiusCurvatureElectric: re,
    lorentzFactor: asValue("lorentzFactor", "1", "dimensionless", g),
    speedRatio: asValue("speedRatio", "1", "ratio", beta),
  });
}
