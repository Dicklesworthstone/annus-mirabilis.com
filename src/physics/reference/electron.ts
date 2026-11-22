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

export type TrajectoryValue = Readonly<{
  status: "value";
  points: readonly TrajectoryPoint[];
  stepCount: number;
  energyResidual: number;
  energyScale: number;
  maxScaledImpulse: number;
}>;

export type TrajectoryRefusal = Readonly<{
  status: "outside-domain";
  points: readonly TrajectoryPoint[];
  stepCount: number;
  energyResidual?: undefined;
  condition: string;
  reason: string;
  domainKind: DomainKind;
}>;

export type TrajectoryResult = TrajectoryValue | TrajectoryRefusal;

export type CheckedTrajectoryResult =
  | (TrajectoryValue &
      Readonly<{
        positionErrorEstimate: number;
        velocityErrorEstimate: number;
        observedOrder?: number;
        displayErrorEstimate: number;
      }>)
  | TrajectoryRefusal;

/** The integration budget is separate from the number of points sent to the drawing. */
export const MAX_BORIS_STEPS = 61_440;
export const SR13_MAX_TRAJECTORY_INTERVALS = 1_920;
const TRAJECTORY_RELATIVE_TOLERANCE = 1e-5;
const TRAJECTORY_POSITION_ABSOLUTE_TOLERANCE = 1e-12;
const TRAJECTORY_VELOCITY_ABSOLUTE_TOLERANCE = 1e-4;
const MAX_SCALED_IMPULSE = 0.1;

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
    return Object.freeze({
      exact: out,
      newtonian: Object.freeze({ ...out, quantityId: "kineticEnergyNewtonian" }),
      lowSpeedExpansion: Object.freeze({ ...out, quantityId: "kineticEnergyLowSpeedExpansion" }),
      ratio: 1,
    });
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
    return Object.freeze({
      exact: out,
      newtonian: Object.freeze({ ...out, quantityId: "kineticEnergyNewtonian" }),
      lowSpeedExpansion: Object.freeze({ ...out, quantityId: "kineticEnergyLowSpeedExpansion" }),
      ratio: 1,
    });
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
    return Object.freeze({
      exact: out,
      newtonian: Object.freeze({ ...out, quantityId: "acceleratingPotentialNewtonian" }),
    });
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
    return Object.freeze({
      exact: out,
      newtonian: Object.freeze({ ...out, quantityId: "acceleratingPotentialNewtonian" }),
    });
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
 * Historical transcription of the three relations accessible to experiment
 * from the facsimile of Paper 3 §10, pp. 920-921.
 */
export const PRINTED_RELATIONS_METADATA = Object.freeze([
  Object.freeze({
    id: "potential-difference",
    locator: "p. 920",
    printedForm:
      "P = \\int X dx = \\frac{\\mu}{\\varepsilon} V^2 \\left( \\frac{1}{\\sqrt{1 - (v/V)^2}} - 1 \\right)",
    modernEquivalent: "q V_{\\text{acc}} = m c^2 (\\gamma - 1)",
    description:
      "Accelerating potential difference related to velocity of electron starting from rest",
  }),
  Object.freeze({
    id: "magnetic-deflection",
    locator: "p. 920",
    printedForm: "R_m = \\frac{\\mu}{\\varepsilon} \\frac{v V}{N \\sqrt{1 - (v/V)^2}}",
    modernEquivalent: "R_m = \\gamma m v / (q B)",
    description: "Radius of curvature in magnetic field perpendicular to motion",
  }),
  Object.freeze({
    id: "electric-deflection",
    locator: "p. 921",
    printedForm: "R_e = \\frac{\\mu}{\\varepsilon} \\frac{v^2}{Y (1 - (v/V)^2)}",
    modernEquivalent: "R_e = \\gamma m v^2 / (q E)",
    description: "Radius of curvature in electric field perpendicular to motion",
  }),
] as const);

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
  const mc = mass * C_SI;
  const mc2 = mc * C_SI;
  const dt = duration / steps;
  const points: TrajectoryPoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i === steps ? duration : i * dt;
    const xi = (charge * eField * t) / mc;
    const g = Math.hypot(1, xi);
    // Rationalized gamma - 1 has a regular zero-field/zero-charge limit.
    const x = xi === 0 ? 0 : (C_SI * t * xi) / (g + 1);
    const vx = xi === 0 ? 0 : (C_SI * xi) / g;
    points.push(
      Object.freeze({
        t,
        x,
        y: 0,
        z: 0,
        vx,
        vy: 0,
        vz: 0,
        speedRatio: Math.abs(xi) / g,
        gamma: g,
        kineticEnergy: mc2 * xi * (xi / (g + 1)),
      }),
    );
  }
  return Object.freeze(points);
}

function sinc(value: number): number {
  return value === 0 ? 1 : Math.sin(value) / value;
}

/**
 * Exact circular motion in a uniform magnetic field, including signed initial velocity.
 * q(v cross B) gives an electron initially along +x a +y acceleration when Bz > 0.
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
  const omega = (charge * bFieldZ) / (g * mass);
  const dt = duration / steps;
  const u0 = (g * v0x) / C_SI;
  const ke = mass * C_SI * C_SI * u0 * (u0 / (g + 1));
  const points: TrajectoryPoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i === steps ? duration : i * dt;
    const theta = omega * t;
    const x = v0x * t * sinc(theta);
    const halfSinc = sinc(0.5 * theta);
    const y = theta === 0 ? 0 : -0.5 * v0x * t * theta * halfSinc * halfSinc;
    points.push(
      Object.freeze({
        t,
        x,
        y,
        z: 0,
        vx: v0x * Math.cos(theta),
        vy: theta === 0 ? 0 : -v0x * Math.sin(theta),
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
 * Exact uniform transverse-electric trajectory. Signed momentum along x is conserved;
 * py = q Ey t. The rationalized displacement is also valid for zero field or charge.
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
  const ux = (g0 * v0x) / C_SI;
  const mc = mass * C_SI;
  const mc2 = mc * C_SI;
  const dt = duration / steps;
  const points: TrajectoryPoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i === steps ? duration : i * dt;
    const uy = (charge * eFieldY * t) / mc;
    const argument = uy / g0;
    const g = Math.hypot(g0, uy);
    const uMag = Math.hypot(ux, uy);
    points.push(
      Object.freeze({
        t,
        x: v0x * t * (argument === 0 ? 1 : Math.asinh(argument) / argument),
        y: uy === 0 ? 0 : (C_SI * t * uy) / (g + g0),
        z: 0,
        vx: (C_SI * ux) / g,
        vy: uy === 0 ? 0 : (C_SI * uy) / g,
        vz: 0,
        speedRatio: uMag / g,
        gamma: g,
        kineticEnergy: mc2 * uMag * (uMag / (g + 1)),
      }),
    );
  }
  return Object.freeze(points);
}

function trajectoryRefusal(
  condition: string,
  reason: string,
  domainKind: DomainKind = "numerical",
  stepCount = 0,
): TrajectoryRefusal {
  return Object.freeze({
    status: "outside-domain",
    points: Object.freeze([]),
    stepCount,
    condition,
    reason,
    domainKind,
  });
}

/**
 * A fixed-resolution relativistic Boris calculation for uniform, time-independent fields.
 * Momentum and the trapezoidal position drift are synchronized at every reported time.
 * This routine reports its work-energy residual, but makes no convergence or error-bound claim.
 * Use integrateBorisChecked to admit a trajectory for publication.
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
  const components = [
    eField.x, eField.y, eField.z, bField.x, bField.y, bField.z,
    v0.x, v0.y, v0.z, duration, charge, mass,
  ];
  if (
    !components.every(Number.isFinite) ||
    duration <= 0 ||
    mass <= 0 ||
    Math.hypot(v0.x, v0.y, v0.z) >= C_SI
  ) {
    return trajectoryRefusal(
      "invalid-trajectory-input",
      "A trajectory requires finite fields and charge, positive mass and duration, and initial speed below c.",
      "input",
    );
  }
  if (!Number.isSafeInteger(steps) || steps < 1 || steps > MAX_BORIS_STEPS) {
    return trajectoryRefusal(
      "trajectory-step-budget",
      "The requested trajectory resolution is outside the bounded integration budget.",
      "numerical",
    );
  }
  const dt = duration / steps;
  const mc2 = mass * C_SI * C_SI;
  const chargeToMass = charge / mass;
  if (!(dt > 0) || !Number.isFinite(mc2) || !Number.isFinite(chargeToMass)) {
    return trajectoryRefusal(
      "trajectory-not-representable",
      "The time step or particle scale cannot be represented for this calculation.",
      "numerical",
      steps,
    );
  }
  const electricKick = {
    x: (0.5 * chargeToMass * eField.x * dt) / C_SI,
    y: (0.5 * chargeToMass * eField.y * dt) / C_SI,
    z: (0.5 * chargeToMass * eField.z * dt) / C_SI,
  };
  const electricImpulse = 2 * Math.hypot(electricKick.x, electricKick.y, electricKick.z);
  const beta0 = Math.hypot(v0.x, v0.y, v0.z) / C_SI;
  let g = 1 / Math.sqrt((1 - beta0) * (1 + beta0));
  // Dimensionless momentum p/(mc) avoids multiplying tiny masses into each push.
  let ux = (g * v0.x) / C_SI;
  let uy = (g * v0.y) / C_SI;
  let uz = (g * v0.z) / C_SI;
  let vx = v0.x;
  let vy = v0.y;
  let vz = v0.z;
  let x = 0;
  let y = 0;
  let z = 0;
  let uMag = Math.hypot(ux, uy, uz);
  let ke = mc2 * uMag * (uMag / (g + 1));
  const initialKE = ke;
  let maxScaledImpulse = 0;
  const points: TrajectoryPoint[] = [
    Object.freeze({
      t: 0, x, y, z, vx, vy, vz, speedRatio: beta0, gamma: g, kineticEnergy: ke,
    }),
  ];

  for (let i = 1; i <= steps; i++) {
    const oldGamma = g;
    const minusX = ux + electricKick.x;
    const minusY = uy + electricKick.y;
    const minusZ = uz + electricKick.z;
    const gammaMinus = Math.hypot(1, minusX, minusY, minusZ);
    const tx = (0.5 * chargeToMass * dt * bField.x) / gammaMinus;
    const ty = (0.5 * chargeToMass * dt * bField.y) / gammaMinus;
    const tz = (0.5 * chargeToMass * dt * bField.z) / gammaMinus;
    const rotationScale = 2 / (1 + tx * tx + ty * ty + tz * tz);
    const crossX = minusY * tz - minusZ * ty;
    const crossY = minusZ * tx - minusX * tz;
    const crossZ = minusX * ty - minusY * tx;
    const primeX = minusX + crossX;
    const primeY = minusY + crossY;
    const primeZ = minusZ + crossZ;
    ux = minusX + rotationScale * (primeY * tz - primeZ * ty) + electricKick.x;
    uy = minusY + rotationScale * (primeZ * tx - primeX * tz) + electricKick.y;
    uz = minusZ + rotationScale * (primeX * ty - primeY * tx) + electricKick.z;
    uMag = Math.hypot(ux, uy, uz);
    g = Math.hypot(1, uMag);
    const nextVx = C_SI * (ux / g);
    const nextVy = C_SI * (uy / g);
    const nextVz = C_SI * (uz / g);
    x += 0.5 * dt * (vx + nextVx);
    y += 0.5 * dt * (vy + nextVy);
    z += 0.5 * dt * (vz + nextVz);
    vx = nextVx;
    vy = nextVy;
    vz = nextVz;
    ke = mc2 * uMag * (uMag / (g + 1));
    // A force-free particle parallel to B needs no gyrophase resolution. Otherwise
    // test the actual rotation parameter throughout the run, not just initial gamma.
    const magneticImpulse =
      crossX === 0 && crossY === 0 && crossZ === 0 ? 0 : 2 * Math.hypot(tx, ty, tz);
    maxScaledImpulse = Math.max(
      maxScaledImpulse,
      magneticImpulse,
      electricImpulse / Math.min(oldGamma, gammaMinus, g),
    );
    if (![x, y, z, vx, vy, vz, g, ke, maxScaledImpulse].every(Number.isFinite)) {
      return trajectoryRefusal(
        "trajectory-not-representable",
        "The trajectory cannot be represented at this numerical resolution. Shorten the duration or reduce the fields.",
        "numerical",
        steps,
      );
    }
    points.push(
      Object.freeze({
        t: i === steps ? duration : i * dt,
        x, y, z, vx, vy, vz,
        speedRatio: uMag / g,
        gamma: g,
        kineticEnergy: ke,
      }),
    );
  }
  const workDone = charge * (eField.x * x + eField.y * y + eField.z * z);
  const energyResidual = Math.abs(ke - initialKE - workDone);
  const energyScale = Math.max(initialKE, ke, Math.abs(workDone));
  if (!Number.isFinite(energyResidual) || !Number.isFinite(energyScale)) {
    return trajectoryRefusal(
      "trajectory-not-representable",
      "The trajectory's work and energy cannot be represented. Shorten the duration or reduce the fields.",
      "numerical",
      steps,
    );
  }
  return Object.freeze({
    status: "value",
    points: Object.freeze(points),
    stepCount: steps,
    energyResidual,
    energyScale,
    maxScaledImpulse,
  });
}

function compareTrajectories(coarse: TrajectoryValue, fine: TrajectoryValue) {
  let positionDifference = 0;
  let velocityDifference = 0;
  let lengthScale = 0;
  let velocityScale = 0;
  let projectedPositionDifference = 0;
  let projectedVelocityDifference = 0;
  let projectedLengthScale = 0;
  let projectedVelocityScale = 0;
  for (let i = 0; i < fine.points.length; i++) {
    const point = fine.points[i];
    if (!point) continue;
    lengthScale = Math.max(lengthScale, Math.hypot(point.x, point.y, point.z));
    velocityScale = Math.max(velocityScale, Math.hypot(point.vx, point.vy, point.vz));
    projectedLengthScale = Math.max(projectedLengthScale, Math.hypot(point.x, point.y));
    projectedVelocityScale = Math.max(projectedVelocityScale, Math.hypot(point.vx, point.vy));
    if (i % 2 !== 0) continue;
    const previous = coarse.points[i / 2];
    if (!previous) continue;
    positionDifference = Math.max(
      positionDifference,
      Math.hypot(point.x - previous.x, point.y - previous.y, point.z - previous.z),
    );
    velocityDifference = Math.max(
      velocityDifference,
      Math.hypot(point.vx - previous.vx, point.vy - previous.vy, point.vz - previous.vz),
    );
    projectedPositionDifference = Math.max(
      projectedPositionDifference,
      Math.hypot(point.x - previous.x, point.y - previous.y),
    );
    projectedVelocityDifference = Math.max(
      projectedVelocityDifference,
      Math.hypot(point.vx - previous.vx, point.vy - previous.vy),
    );
  }
  return {
    positionDifference, velocityDifference, lengthScale, velocityScale,
    projectedPositionDifference, projectedVelocityDifference,
    projectedLengthScale, projectedVelocityScale,
  };
}

/** Downsampling checks the actual x-y projection; a large z excursion cannot hide a bad drawing. */
function sampleTrajectory(path: TrajectoryValue, lengthScale: number) {
  const tolerance = TRAJECTORY_POSITION_ABSOLUTE_TOLERANCE + 1e-3 * lengthScale;
  for (
    let intervals = SR13_TRAJECTORY_STEPS;
    intervals <= Math.min(path.stepCount, SR13_MAX_TRAJECTORY_INTERVALS);
    intervals *= 2
  ) {
    const stride = path.stepCount / intervals;
    let displayErrorEstimate = 0;
    for (let i = 0; i < path.stepCount; i++) {
      const startIndex = Math.floor(i / stride) * stride;
      const start = path.points[startIndex];
      const end = path.points[startIndex + stride];
      const point = path.points[i];
      if (!start || !end || !point) continue;
      const fraction = (i - startIndex) / stride;
      displayErrorEstimate = Math.max(
        displayErrorEstimate,
        Math.hypot(
          point.x - (start.x + fraction * (end.x - start.x)),
          point.y - (start.y + fraction * (end.y - start.y)),
        ),
      );
    }
    if (displayErrorEstimate <= tolerance) {
      return {
        points: Object.freeze(path.points.filter((_, i) => i % stride === 0)),
        displayErrorEstimate,
      };
    }
  }
  return null;
}

/**
 * Bounded step refinement for the published path. The full change on the final halving is
 * an empirical numerical error estimate, not a rigorous bound. Comparing velocities and
 * resolving the electric impulse / magnetic rotation prevents a coarse circular path from
 * passing merely because it conserves energy or happens to end near its starting point.
 */
export function integrateBorisChecked(
  eField: Vec3,
  bField: Vec3,
  v0: Vec3,
  duration: number,
  charge: number = -ELEMENTARY_CHARGE,
  mass: number = ELECTRON_MASS,
): CheckedTrajectoryResult {
  let coarse = integrateBoris(
    eField, bField, v0, duration, SR13_TRAJECTORY_STEPS / 2, charge, mass,
  );
  if (coarse.status !== "value") return coarse;
  let previousPositionDifference: number | undefined;
  let previousWasResolved = false;
  for (let steps = SR13_TRAJECTORY_STEPS; steps <= MAX_BORIS_STEPS; steps *= 2) {
    const fine = integrateBoris(eField, bField, v0, duration, steps, charge, mass);
    if (fine.status !== "value") return fine;
    const comparison = compareTrajectories(coarse, fine);
    const positionTolerance =
      TRAJECTORY_POSITION_ABSOLUTE_TOLERANCE +
      TRAJECTORY_RELATIVE_TOLERANCE * comparison.lengthScale;
    const velocityTolerance =
      TRAJECTORY_VELOCITY_ABSOLUTE_TOLERANCE +
      TRAJECTORY_RELATIVE_TOLERANCE * comparison.velocityScale;
    const projectedPositionTolerance =
      TRAJECTORY_POSITION_ABSOLUTE_TOLERANCE +
      TRAJECTORY_RELATIVE_TOLERANCE * comparison.projectedLengthScale;
    const projectedVelocityTolerance =
      TRAJECTORY_VELOCITY_ABSOLUTE_TOLERANCE +
      TRAJECTORY_RELATIVE_TOLERANCE * comparison.projectedVelocityScale;
    const energyTolerance =
      512 * Number.EPSILON * mass * C_SI * C_SI +
      TRAJECTORY_RELATIVE_TOLERANCE * fine.energyScale;
    const resolved =
      coarse.maxScaledImpulse <= MAX_SCALED_IMPULSE &&
      fine.maxScaledImpulse <= MAX_SCALED_IMPULSE;
    if (
      steps >= 2 * SR13_TRAJECTORY_STEPS &&
      resolved &&
      comparison.positionDifference <= positionTolerance &&
      comparison.velocityDifference <= velocityTolerance &&
      comparison.projectedPositionDifference <= projectedPositionTolerance &&
      comparison.projectedVelocityDifference <= projectedVelocityTolerance &&
      fine.energyResidual <= energyTolerance
    ) {
      const sampled = sampleTrajectory(fine, comparison.projectedLengthScale);
      if (!sampled) {
        return trajectoryRefusal(
          "trajectory-display-unresolved",
          "The path contains more rapid turns than this drawing can resolve. Shorten the duration or reduce the fields; the initial-speed quantities remain available.",
          "numerical",
          steps,
        );
      }
      const roundoff = 512 * Number.EPSILON * comparison.lengthScale;
      const observedOrder =
        previousWasResolved &&
        previousPositionDifference !== undefined &&
        previousPositionDifference > roundoff &&
        comparison.positionDifference > roundoff
          ? Math.log2(previousPositionDifference / comparison.positionDifference)
          : undefined;
      return Object.freeze({
        ...fine,
        points: sampled.points,
        positionErrorEstimate: comparison.positionDifference,
        velocityErrorEstimate: comparison.velocityDifference,
        displayErrorEstimate: sampled.displayErrorEstimate,
        ...(observedOrder === undefined ? {} : { observedOrder }),
      });
    }
    previousPositionDifference = comparison.positionDifference;
    previousWasResolved = resolved;
    coarse = fine;
  }
  return trajectoryRefusal(
    "trajectory-not-converged",
    "The trajectory did not meet its position, velocity, and work-energy checks within the bounded calculation. Shorten the duration or reduce the fields; the initial-speed quantities remain available.",
    "numerical",
    MAX_BORIS_STEPS,
  );
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
      trajectoryPositions: asOutside(
        "trajectoryPositions",
        "m",
        "trajectory-xy",
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
    trajectoryPositions: sr13Trajectory(input, beta, charge, mass),
  });
}

/** Minimum drawing intervals. Integration refines independently, and a curved path may publish
 * more points only after checking the intervening geometry. */
export const SR13_TRAJECTORY_STEPS = 120;

/**
 * The particle's path in the stationary system over the integration interval, integrated by the
 * relativistic Boris push from the origin, with the requested speed along the requested direction in
 * the x-y plane. The value is interleaved positions in metres, x0, y0, x1, y1, ...; z is not
 * published, since the chamber is drawn in the x-y plane and a field with an x or y magnetic
 * component moves the particle out of it.
 */
function sr13Trajectory(
  input: Sr13Input,
  beta: number,
  charge: number,
  mass: number,
): ScientificResult {
  const duration = input.integrationInterval;
  if (!(Number.isFinite(duration) && duration > 0)) {
    return asOutside(
      "trajectoryPositions",
      "m",
      "trajectory-xy",
      "non-positive-interval",
      "The integration interval must be a positive time.",
      "input",
    );
  }
  const direction = (input.initialDirectionDeg * Math.PI) / 180;
  const speed = Math.sign(input.initialSpeed || 1) * beta * C_SI;
  const path = integrateBorisChecked(
    { x: input.electricFieldX, y: input.electricFieldY, z: input.electricFieldZ },
    { x: input.magneticFieldX, y: input.magneticFieldY, z: input.magneticFieldZ },
    { x: speed * Math.cos(direction), y: speed * Math.sin(direction), z: 0 },
    duration,
    charge,
    mass,
  );
  if (path.status !== "value") {
    return Object.freeze({
      ...identity("trajectoryPositions", "m", "trajectory-xy", OWNER_ID),
      status: "outside-domain",
      condition: path.condition,
      domainKind: path.domainKind,
      reason: path.reason,
      boundary: { parameterId: "integrationInterval", value: duration / 2 },
    });
  }
  const positions = new Float64Array(path.points.length * 2);
  path.points.forEach((point, i) => {
    positions[2 * i] = point.x;
    positions[2 * i + 1] = point.y;
  });
  return Object.freeze({
    ...identity("trajectoryPositions", "m", "trajectory-xy", OWNER_ID),
    status: "value" as const,
    value: positions,
    uncertainty: Object.freeze({
      kind: "numerical-error-estimate" as const,
      magnitude: path.positionErrorEstimate,
      guarantee: "estimate" as const,
      method:
        "Maximum position change between " + path.stepCount / 2 + " and " +
        path.stepCount + " time steps. Velocity and work-energy checks also passed. " +
        (path.observedOrder === undefined
          ? "A convergence order was not established for these settings."
          : "Measured position convergence order: " + path.observedOrder.toFixed(2) + ".") +
        " Drawing interpolation: maximum deviation " +
        path.displayErrorEstimate.toExponential(2) +
        " m from the integrated x-y path, within 0.1% of its projected extent plus 1e-12 m." +
        " These are empirical estimates, not error bounds.",
    }),
  });
}
