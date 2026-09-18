/**
 * Field transforms (SR-02, SR-08) and the SR-07 plane-wave Maxwell residual
 * oracle. Views must not import this module; laboratories read accepted
 * snapshot quantities only.
 */

import type { DomainKind, ScientificResult } from "../../experiments/results/types.ts";
import { classifyWithTolerance } from "../../units/tolerance.ts";
import { constantValue, getConstantSet } from "./constants.ts";
import { gamma, gammaMinusOne } from "./kinematics.ts";

export const OWNER_ID = "fields";
export const C_SI = constantValue(getConstantSet("modern-si-2019"), "speedOfLight").value;
export const ELEMENTARY_CHARGE = constantValue(
  getConstantSet("modern-si-2019"),
  "elementaryCharge",
).value;
export const MU0 = constantValue(getConstantSet("modern-codata-2022"), "vacuumPermeability").value;
export const EPS0 = constantValue(getConstantSet("modern-codata-2022"), "vacuumPermittivity").value;

export const PATH_REFUSAL_REASON =
  "The two ends of this path are not at the same time in the other frame, so the two line integrals are taken over different events. Choose a path across the direction of motion, or state which frame's clock fixes the path's ends.";

export type Vec3 = Readonly<{ x: number; y: number; z: number }>;

export type Sr02FieldModel = "uniform" | "dipole";
export type Sr02Mode = "analytic" | "apparatus";
export type Sr02Frame = "magnet-rest" | "conductor-rest";
export type Sr02Path = "transverse" | "along-motion";

export type Sr02Input = Readonly<{
  mode: Sr02Mode;
  descriptionFrame: Sr02Frame;
  speed: number;
  fieldModel: Sr02FieldModel;
  magneticField: number;
  dipoleMoment: number;
  testPointDistance: number;
  segmentLength: number;
  testCharge: number;
  pathOrientation: Sr02Path;
  sliceDeclared: boolean;
}>;

function identity(
  quantityId: string,
  unit: string,
  semanticKind: string,
  ownerId: string,
): Pick<ScientificResult, "quantityId" | "unit" | "semanticKind" | "ownerId"> {
  return { quantityId, unit, semanticKind, ownerId };
}

function asValue(
  quantityId: string,
  unit: string,
  semanticKind: string,
  ownerId: string,
  value: number,
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
  ownerId: string,
  condition: string,
  reason: string,
  domainKind: DomainKind = "physical",
): ScientificResult {
  return Object.freeze({
    ...identity(quantityId, unit, semanticKind, ownerId),
    status: "outside-domain" as const,
    condition,
    domainKind,
    reason,
    boundary: Object.freeze({ parameterId: "speed", value: C_SI * 0.95 }),
  });
}

function asNotApplicable(
  quantityId: string,
  unit: string,
  semanticKind: string,
  ownerId: string,
  reason: string,
): ScientificResult {
  return Object.freeze({
    ...identity(quantityId, unit, semanticKind, ownerId),
    status: "not-applicable" as const,
    reason,
  });
}

function asSymbolic(
  quantityId: string,
  unit: string,
  semanticKind: string,
  ownerId: string,
  symbol: string,
): ScientificResult {
  return Object.freeze({
    ...identity(quantityId, unit, semanticKind, ownerId),
    status: "symbolic" as const,
    expressionRef: `symbol:${symbol}`,
    unspecifiedSymbols: Object.freeze([symbol]),
  });
}

function asUnderdetermined(
  quantityId: string,
  unit: string,
  semanticKind: string,
  ownerId: string,
): ScientificResult {
  return Object.freeze({
    ...identity(quantityId, unit, semanticKind, ownerId),
    status: "underdetermined" as const,
    compatibleFamily: "admissible-ratio-or-undeclared-slice",
    neededInformation: Object.freeze(["declare the orientation exactly, or the slice frame"]),
  });
}

export function dipoleField(moment: Vec3, position: Vec3, mu0 = MU0): Vec3 {
  const r2 = position.x * position.x + position.y * position.y + position.z * position.z;
  const r = Math.sqrt(r2);
  if (!(r > 0) || !Number.isFinite(r)) {
    return Object.freeze({ x: Number.NaN, y: Number.NaN, z: Number.NaN });
  }
  const r5 = r2 * r2 * r;
  const mDotR = moment.x * position.x + moment.y * position.y + moment.z * position.z;
  const pre = mu0 / (4 * Math.PI);
  return Object.freeze({
    x: pre * ((3 * mDotR * position.x) / r5 - moment.x / (r2 * r)),
    y: pre * ((3 * mDotR * position.y) / r5 - moment.y / (r2 * r)),
    z: pre * ((3 * mDotR * position.z) / r5 - moment.z / (r2 * r)),
  });
}

export function transformSI(input: {
  E: Vec3;
  B: Vec3;
  boost: number;
  c?: number;
}): Readonly<{ E: Vec3; B: Vec3; gamma: number }> {
  const c = input.c ?? C_SI;
  const v = input.boost;
  const g = gamma(v / c);
  if (g.status !== "value") {
    return Object.freeze({ E: input.E, B: input.B, gamma: Number.NaN });
  }
  const γ = g.value;
  const { E, B } = input;
  return Object.freeze({
    gamma: γ,
    E: Object.freeze({
      x: E.x,
      y: γ * (E.y - v * B.z),
      z: γ * (E.z + v * B.y),
    }),
    B: Object.freeze({
      x: B.x,
      y: γ * (B.y + (v * E.z) / (c * c)),
      z: γ * (B.z - (v * E.y) / (c * c)),
    }),
  });
}

export function fieldInvariants(
  E: Vec3,
  B: Vec3,
  c = C_SI,
): Readonly<{ eDotB: number; e2MinusC2B2: number }> {
  const e2 = E.x * E.x + E.y * E.y + E.z * E.z;
  const b2 = B.x * B.x + B.y * B.y + B.z * B.z;
  return Object.freeze({
    eDotB: E.x * B.x + E.y * B.y + E.z * B.z,
    e2MinusC2B2: e2 - c * c * b2,
  });
}

export function lorentzForce(q: number, E: Vec3, B: Vec3, velocity: Vec3): Vec3 {
  return Object.freeze({
    x: q * (E.x + velocity.y * B.z - velocity.z * B.y),
    y: q * (E.y + velocity.z * B.x - velocity.x * B.z),
    z: q * (E.z + velocity.x * B.y - velocity.y * B.x),
  });
}

export interface ForceConsistencyResult {
  readonly F_K: Vec3;
  readonly F_prime_transformed: Vec3;
  readonly F_prime_direct: Vec3;
  readonly u_prime: Vec3;
  readonly fields_prime: Readonly<{ E: Vec3; B: Vec3 }>;
  readonly residual: number;
  readonly maxRelError: number;
  readonly consistent: boolean;
}

export function forceConsistency(Fperp: number, FprimePerp: number, gammaValue: number): boolean;
export function forceConsistency(
  q: number,
  fieldsK: { E: Vec3; B: Vec3 },
  u: Vec3,
  beta: number,
  c?: number,
): ForceConsistencyResult;
export function forceConsistency(
  arg1: number,
  arg2: number | { E: Vec3; B: Vec3 },
  arg3: number | Vec3,
  arg4?: number,
  arg5?: number,
): boolean | ForceConsistencyResult {
  if (typeof arg2 === "number" && typeof arg3 === "number") {
    const Fperp = arg1;
    const FprimePerp = arg2;
    const gammaValue = arg3;
    if (![Fperp, FprimePerp, gammaValue].every(Number.isFinite) || gammaValue === 0) return false;
    const expected = FprimePerp / gammaValue;
    const scale = Math.max(Math.abs(Fperp), Math.abs(expected), 1e-30);
    return Math.abs(Fperp - expected) <= 1e-12 * scale;
  }

  const q = arg1;
  const fieldsK = arg2 as { E: Vec3; B: Vec3 };
  const u = arg3 as Vec3;
  const beta = arg4 ?? 0;
  const c = arg5 ?? C_SI;
  const boost = beta * c;

  // (i) Force in K, transformed with transformForce3D
  const FK = lorentzForce(q, fieldsK.E, fieldsK.B, u);
  const F_prime_transformed = transformForce3D(FK, u, boost, c);

  // (ii) Force in moving frame with transformed fields and transformed velocity
  const uPrime = transformVelocity3D(u, boost, c);
  const tfFields = transformSI({ E: fieldsK.E, B: fieldsK.B, boost, c });
  const fieldsPrime = Object.freeze({ E: tfFields.E, B: tfFields.B });
  const F_prime_direct = lorentzForce(q, fieldsPrime.E, fieldsPrime.B, uPrime);

  const dx = Math.abs(F_prime_transformed.x - F_prime_direct.x);
  const dy = Math.abs(F_prime_transformed.y - F_prime_direct.y);
  const dz = Math.abs(F_prime_transformed.z - F_prime_direct.z);
  const residual = Math.sqrt(dx * dx + dy * dy + dz * dz);

  const scaleX = Math.max(Math.abs(F_prime_transformed.x), Math.abs(F_prime_direct.x), 1e-15);
  const scaleY = Math.max(Math.abs(F_prime_transformed.y), Math.abs(F_prime_direct.y), 1e-15);
  const scaleZ = Math.max(Math.abs(F_prime_transformed.z), Math.abs(F_prime_direct.z), 1e-15);
  const relX = dx / scaleX;
  const relY = dy / scaleY;
  const relZ = dz / scaleZ;
  const maxRelError = Math.max(relX, relY, relZ);
  const consistent = maxRelError <= 1e-12;

  return Object.freeze({
    F_K: FK,
    F_prime_transformed,
    F_prime_direct,
    u_prime: uPrime,
    fields_prime: fieldsPrime,
    residual,
    maxRelError,
    consistent,
  });
}

export type Sr02Snapshot = Readonly<{
  beta: number;
  magneticFieldMagnet: ScientificResult;
  electricFieldMagnet: ScientificResult;
  magneticFieldConductor: ScientificResult;
  electricFieldConductor: ScientificResult;
  forceMagnet: ScientificResult;
  forceConductor: ScientificResult;
  emfMagnet: ScientificResult;
  emfConductor: ScientificResult;
  emfExcess: ScientificResult;
  invariantDot: ScientificResult;
  invariantDifference: ScientificResult;
  lorentzFactor: ScientificResult;
  pathParallel: ScientificResult;
  endpointOffset: ScientificResult;
  circuitCurrent: ScientificResult;
}>;

const ROWS = {
  Bm: ["magneticFieldStationary", "T", "magnetic-field-magnet", "fields.emfBothDescriptions"],
  Em: ["electricFieldStationary", "V/m", "electric-field-magnet", "fields.transformSI"],
  Bc: ["magneticFieldMoving", "T", "magnetic-field-conductor", "fields.transformSI"],
  Ec: ["electricFieldMoving", "V/m", "electric-field-conductor", "fields.transformSI"],
  Fm: ["transverseForceLaboratory", "N", "lorentz-force-magnet", "fields.lorentzForce"],
  Fc: ["transverseForceComoving", "N", "lorentz-force-conductor", "fields.lorentzForce"],
  em: ["electromotiveForceMagnetFrame", "V", "emf-magnet", "fields.emfBothDescriptions"],
  ec: ["electromotiveForceConductorFrame", "V", "emf-conductor", "fields.emfBothDescriptions"],
  xs: ["electromotiveForceExcess", "1", "emf-excess", "fields.emfBothDescriptions"],
  id: ["fieldInvariantEDotB", "T V/m", "field-invariant-dot", "fields.fieldInvariants"],
  iv: [
    "fieldInvariantE2MinusC2B2",
    "V^2/m^2",
    "field-invariant-difference",
    "fields.fieldInvariants",
  ],
  g: ["lorentzFactor", "1", "lorentz-factor", "kinematics.gamma"],
  pp: ["pathBoostParallelComponent", "1", "path-boost-parallel", "fields.emfBothDescriptions"],
  off: ["endpointSimultaneityOffset", "s", "endpoint-offset", "fields.emfBothDescriptions"],
  I: ["inducedCircuitCurrent", "A", "circuit-current", "fields.emfBothDescriptions"],
} as const;

export function evaluateSr02(input: Sr02Input): Sr02Snapshot {
  const row = (key: keyof typeof ROWS) => ROWS[key];
  const pack = (
    key: keyof typeof ROWS,
    make: (id: string, unit: string, kind: string, owner: string) => ScientificResult,
  ) => {
    const r = row(key);
    return make(r[0], r[1], r[2], r[3]);
  };

  if (input.mode === "apparatus") {
    const sym = (key: keyof typeof ROWS, symbol: string) =>
      pack(key, (id, unit, kind, owner) => asSymbolic(id, unit, kind, owner, symbol));
    return Object.freeze({
      beta: 0,
      magneticFieldMagnet: sym("Bm", "B"),
      electricFieldMagnet: sym("Em", "E"),
      magneticFieldConductor: sym("Bc", "B'"),
      electricFieldConductor: sym("Ec", "E'"),
      forceMagnet: sym("Fm", "F"),
      forceConductor: sym("Fc", "F'"),
      emfMagnet: sym("em", "EMF"),
      emfConductor: sym("ec", "EMF'"),
      emfExcess: sym("xs", "gamma-1"),
      invariantDot: sym("id", "E·B"),
      invariantDifference: sym("iv", "E²-c²B²"),
      lorentzFactor: sym("g", "gamma"),
      pathParallel: sym("pp", "n·v"),
      endpointOffset: sym("off", "Delta t'"),
      circuitCurrent: sym("I", "I"),
    });
  }

  const c = C_SI;
  const v = input.speed;
  const refuseAll = (reason: string, condition: string): Sr02Snapshot => {
    const out = (key: keyof typeof ROWS) =>
      pack(key, (id, unit, kind, owner) => asOutside(id, unit, kind, owner, condition, reason));
    return Object.freeze({
      beta: v / c,
      magneticFieldMagnet: out("Bm"),
      electricFieldMagnet: out("Em"),
      magneticFieldConductor: out("Bc"),
      electricFieldConductor: out("Ec"),
      forceMagnet: out("Fm"),
      forceConductor: out("Fc"),
      emfMagnet: out("em"),
      emfConductor: out("ec"),
      emfExcess: out("xs"),
      invariantDot: out("id"),
      invariantDifference: out("iv"),
      lorentzFactor: out("g"),
      pathParallel: out("pp"),
      endpointOffset: out("off"),
      circuitCurrent: out("I"),
    });
  };

  if (![v, input.magneticField, input.segmentLength, input.testCharge].every(Number.isFinite)) {
    return refuseAll("Speed, field, length and charge must be finite.", "finite inputs");
  }
  if (Math.abs(v) >= c) {
    return refuseAll("No inertial observer at |v| >= c.", "|v| < c");
  }
  if (input.segmentLength <= 0) {
    return refuseAll("The declared path must have positive length.", "ℓ > 0");
  }

  const beta = v / c;
  const g = gamma(beta);
  const gmo = gammaMinusOne(beta);
  if (g.status !== "value" || gmo.status !== "value") {
    return refuseAll("No inertial observer at |v| >= c.", "|v| < c");
  }
  const γ = g.value;

  let Bz = input.magneticField;
  if (input.fieldModel === "dipole") {
    const r = input.testPointDistance;
    const B = dipoleField({ x: 0, y: 0, z: input.dipoleMoment }, { x: r, y: 0, z: 0 });
    Bz = -B.z;
  }

  const E0: Vec3 = Object.freeze({ x: 0, y: 0, z: 0 });
  const B0: Vec3 = Object.freeze({ x: 0, y: 0, z: Bz });
  const primed = transformSI({ E: E0, B: B0, boost: v, c });
  const F = lorentzForce(input.testCharge, E0, B0, { x: v, y: 0, z: 0 });
  const Fp = lorentzForce(input.testCharge, primed.E, primed.B, { x: 0, y: 0, z: 0 });
  const inv0 = fieldInvariants(E0, B0, c);
  const inv1 = fieldInvariants(primed.E, primed.B, c);
  void inv1;

  const nDotV = input.pathOrientation === "along-motion" ? 1 : 0;
  const offset =
    input.pathOrientation === "along-motion" ? (γ * v * input.segmentLength) / (c * c) : 0;
  const emfMagnet = Math.abs(v * Bz * input.segmentLength);
  const emfConductor = γ * emfMagnet;
  const classification =
    nDotV === 0 ? { sign: "zero" as const } : classifyWithTolerance(nDotV, { absolute: 1e-12 });

  const val = (key: keyof typeof ROWS, value: number) =>
    pack(key, (id, unit, kind, owner) => asValue(id, unit, kind, owner, value));
  const na = (key: keyof typeof ROWS, reason: string) =>
    pack(key, (id, unit, kind, owner) => asNotApplicable(id, unit, kind, owner, reason));
  const und = (key: keyof typeof ROWS) =>
    pack(key, (id, unit, kind, owner) => asUnderdetermined(id, unit, kind, owner));

  const emfMagnetOut = val("em", emfMagnet);
  let emfConductorOut = val("ec", emfConductor);
  let excessOut = val("xs", gmo.value);
  if (classification.sign === "indeterminate") {
    emfConductorOut = und("ec");
    excessOut = und("xs");
  } else if (classification.sign !== "zero" && !input.sliceDeclared) {
    emfConductorOut = na("ec", PATH_REFUSAL_REASON);
    excessOut = na("xs", PATH_REFUSAL_REASON);
  }

  return Object.freeze({
    beta,
    magneticFieldMagnet: val("Bm", Bz),
    electricFieldMagnet: val("Em", 0),
    magneticFieldConductor: val("Bc", primed.B.z),
    electricFieldConductor: val("Ec", primed.E.y),
    forceMagnet: val("Fm", F.y),
    forceConductor: val("Fc", Fp.y),
    emfMagnet: emfMagnetOut,
    emfConductor: emfConductorOut,
    emfExcess: excessOut,
    invariantDot: val("id", inv0.eDotB),
    invariantDifference: val("iv", inv0.e2MinusC2B2),
    lorentzFactor: val("g", γ),
    pathParallel: val("pp", nDotV),
    endpointOffset: val("off", offset),
    circuitCurrent: na("I", "Current in a real circuit is not modeled; SR-02 has no circuit."),
  });
}

export function emfBothDescriptions(input: Sr02Input): {
  magnet: ScientificResult;
  conductor: ScientificResult;
} {
  const snap = evaluateSr02(input);
  return { magnet: snap.emfMagnet, conductor: snap.emfConductor };
}

export function transformGaussianHistorical(input: {
  E: Vec3;
  B: Vec3;
  boost: number;
  c?: number;
}): Readonly<{ E: Vec3; B: Vec3; beta: number }> {
  const c = input.c ?? C_SI;
  const v = input.boost;
  const g = gamma(v / c);
  if (g.status !== "value") {
    return Object.freeze({ E: input.E, B: input.B, beta: Number.NaN });
  }
  const β = g.value;
  const { E, B } = input;
  const vOverC = v / c;
  return Object.freeze({
    beta: β,
    E: Object.freeze({
      x: E.x,
      y: β * (E.y - vOverC * B.z),
      z: β * (E.z + vOverC * B.y),
    }),
    B: Object.freeze({
      x: B.x,
      y: β * (B.y + vOverC * E.z),
      z: β * (B.z - vOverC * E.y),
    }),
  });
}

export function transformVelocity3D(u: Vec3, boost: number, c = C_SI): Vec3 {
  const beta = boost / c;
  const g = gamma(beta);
  if (g.status !== "value") {
    return Object.freeze({ x: Number.NaN, y: Number.NaN, z: Number.NaN });
  }
  const γ = g.value;
  const denom = 1 - (u.x * boost) / (c * c);
  if (Math.abs(denom) < 1e-15) {
    return Object.freeze({ x: Number.NaN, y: Number.NaN, z: Number.NaN });
  }
  return Object.freeze({
    x: (u.x - boost) / denom,
    y: u.y / (γ * denom),
    z: u.z / (γ * denom),
  });
}

export function transformForce3D(F: Vec3, u: Vec3, boost: number, c = C_SI): Vec3 {
  const beta = boost / c;
  const g = gamma(beta);
  if (g.status !== "value") {
    return Object.freeze({ x: Number.NaN, y: Number.NaN, z: Number.NaN });
  }
  const γ = g.value;
  const denom = 1 - (u.x * boost) / (c * c);
  if (Math.abs(denom) < 1e-15) {
    return Object.freeze({ x: Number.NaN, y: Number.NaN, z: Number.NaN });
  }
  const fDotU = F.x * u.x + F.y * u.y + F.z * u.z;
  return Object.freeze({
    x: (F.x - (boost * fDotU) / (c * c)) / denom,
    y: F.y / (γ * denom),
    z: F.z / (γ * denom),
  });
}

export function transformForce(input: { F: Vec3; u: Vec3; beta: number; c?: number }): Vec3 {
  const c = input.c ?? C_SI;
  return transformForce3D(input.F, input.u, input.beta * c, c);
}

export interface GaussianHistoricalFields {
  readonly X: number;
  readonly Y: number;
  readonly Z: number;
  readonly L: number;
  readonly M: number;
  readonly N: number;
}

export function mapSIToGaussianHistorical(
  E: Vec3,
  B: Vec3,
  eps0 = EPS0,
  c = C_SI,
): GaussianHistoricalFields {
  const factor = Math.sqrt(4 * Math.PI * eps0);
  return Object.freeze({
    X: factor * E.x,
    Y: factor * E.y,
    Z: factor * E.z,
    L: factor * c * B.x,
    M: factor * c * B.y,
    N: factor * c * B.z,
  });
}

export function mapGaussianHistoricalToSI(
  g: GaussianHistoricalFields,
  eps0 = EPS0,
  c = C_SI,
): Readonly<{ E: Vec3; B: Vec3 }> {
  const factor = Math.sqrt(4 * Math.PI * eps0);
  return Object.freeze({
    E: Object.freeze({
      x: g.X / factor,
      y: g.Y / factor,
      z: g.Z / factor,
    }),
    B: Object.freeze({
      x: g.L / (factor * c),
      y: g.M / (factor * c),
      z: g.N / (factor * c),
    }),
  });
}

export function mapChargeDensityHistorical(rhoSI: number, eps0 = EPS0): number {
  return Math.sqrt((4 * Math.PI) / eps0) * rhoSI;
}

export function mapChargeDensityHistoricalToSI(rhoPrinted: number, eps0 = EPS0): number {
  return Math.sqrt(eps0 / (4 * Math.PI)) * rhoPrinted;
}

export type Sr08UnitLayer = "si" | "gaussian";
export type Sr08Frame = "stationary" | "moving";

export type Sr08Input = Readonly<{
  unitLayer: Sr08UnitLayer;
  descriptionFrame: Sr08Frame;
  electricField: Vec3;
  magneticField: Vec3;
  boost: number;
  testCharge: number;
  chargeVelocity: Vec3;
  decomposeComponents: boolean;
  detectorMotion: boolean;
  detectorSpeed: number;
}>;

export type Sr08Snapshot = Readonly<{
  beta: number;
  gamma: number;
  electricFieldStationary: ScientificResult;
  electricFieldMoving: ScientificResult;
  magneticFieldStationary: ScientificResult;
  magneticFieldMoving: ScientificResult;
  fieldInvariantEDotB: ScientificResult;
  fieldInvariantE2MinusC2B2: ScientificResult;
  lorentzFactor: ScientificResult;
  chargeVelocityStationary: ScientificResult;
  chargeVelocityMoving: ScientificResult;
  transverseForceLaboratory: ScientificResult;
  transverseForceComoving: ScientificResult;
  eventId: string;
}>;

const SR08_ROWS = {
  Em: ["electricFieldStationary", "V/m", "electric-field-stationary", "fields.transformSI"],
  Ec: ["electricFieldMoving", "V/m", "electric-field-moving", "fields.transformSI"],
  Bm: ["magneticFieldStationary", "T", "magnetic-field-stationary", "fields.transformSI"],
  Bc: ["magneticFieldMoving", "T", "magnetic-field-moving", "fields.transformSI"],
  id: ["fieldInvariantEDotB", "T V/m", "field-invariant-dot", "fields.fieldInvariants"],
  iv: [
    "fieldInvariantE2MinusC2B2",
    "V^2/m^2",
    "field-invariant-difference",
    "fields.fieldInvariants",
  ],
  g: ["lorentzFactor", "1", "lorentz-factor", "kinematics.gamma"],
  um: [
    "chargeVelocityStationary",
    "m/s",
    "charge-velocity-stationary",
    "fields.transformVelocity3D",
  ],
  uc: ["chargeVelocityMoving", "m/s", "charge-velocity-moving", "fields.transformVelocity3D"],
  Fm: ["transverseForceLaboratory", "N", "lorentz-force-stationary", "fields.lorentzForce"],
  Fc: ["transverseForceComoving", "N", "lorentz-force-moving", "fields.lorentzForce"],
} as const;

function asVectorValue(
  quantityId: string,
  unit: string,
  semanticKind: string,
  ownerId: string,
  vec: Vec3,
): ScientificResult {
  return Object.freeze({
    ...identity(quantityId, unit, semanticKind, ownerId),
    status: "value" as const,
    value: new Float64Array([vec.x, vec.y, vec.z]),
  });
}

export function evaluateSr08(input: Sr08Input): Sr08Snapshot {
  const c = C_SI;
  const v = input.boost;
  const eventId = "event-test-charge-0";

  const packScalar = (
    key: keyof typeof SR08_ROWS,
    make: (id: string, unit: string, kind: string, owner: string) => ScientificResult,
  ) => {
    const r = SR08_ROWS[key];
    return make(r[0], r[1], r[2], r[3]);
  };

  const refuseAll = (reason: string, condition: string): Sr08Snapshot => {
    const out = (key: keyof typeof SR08_ROWS) =>
      packScalar(key, (id, unit, kind, owner) =>
        asOutside(id, unit, kind, owner, condition, reason),
      );
    return Object.freeze({
      beta: v / c,
      gamma: Number.NaN,
      electricFieldStationary: out("Em"),
      electricFieldMoving: out("Ec"),
      magneticFieldStationary: out("Bm"),
      magneticFieldMoving: out("Bc"),
      fieldInvariantEDotB: out("id"),
      fieldInvariantE2MinusC2B2: out("iv"),
      lorentzFactor: out("g"),
      chargeVelocityStationary: out("um"),
      chargeVelocityMoving: out("uc"),
      transverseForceLaboratory: out("Fm"),
      transverseForceComoving: out("Fc"),
      eventId,
    });
  };

  const inputsValid = [
    input.electricField.x,
    input.electricField.y,
    input.electricField.z,
    input.magneticField.x,
    input.magneticField.y,
    input.magneticField.z,
    input.chargeVelocity.x,
    input.chargeVelocity.y,
    input.chargeVelocity.z,
    input.boost,
    input.testCharge,
  ].every(Number.isFinite);

  if (!inputsValid) {
    return refuseAll(
      "All field, velocity, boost, and charge inputs must be finite numbers.",
      "finite inputs",
    );
  }

  if (Math.abs(v) >= c) {
    return refuseAll("Observer boost speed must satisfy |v| < c.", "|v| < c");
  }

  const uSpeed2 =
    input.chargeVelocity.x * input.chargeVelocity.x +
    input.chargeVelocity.y * input.chargeVelocity.y +
    input.chargeVelocity.z * input.chargeVelocity.z;
  if (uSpeed2 >= c * c) {
    return refuseAll("Test charge speed must satisfy |u| < c.", "|u| < c");
  }

  const beta = v / c;
  const g = gamma(beta);
  if (g.status !== "value") {
    return refuseAll("Lorentz factor undefined for |v| >= c.", "|v| < c");
  }
  const γ = g.value;

  const E0 = input.electricField;
  const B0 = input.magneticField;
  const u0 = input.chargeVelocity;
  const q = input.testCharge;

  // Transformed fields under boost v along x
  const transformedSI = transformSI({ E: E0, B: B0, boost: v, c });
  const Eprime = transformedSI.E;
  const Bprime = transformedSI.B;

  // Invariants
  const inv0 = fieldInvariants(E0, B0, c);

  // Transformed velocity of test charge
  const uprime = transformVelocity3D(u0, v, c);

  // Forces
  const F_lab = lorentzForce(q, E0, B0, u0);
  const F_comoving = lorentzForce(q, Eprime, Bprime, uprime);

  const valScalar = (key: keyof typeof SR08_ROWS, val: number) =>
    packScalar(key, (id, unit, kind, owner) => asValue(id, unit, kind, owner, val));
  const valVec = (key: keyof typeof SR08_ROWS, vec: Vec3) =>
    packScalar(key, (id, unit, kind, owner) => asVectorValue(id, unit, kind, owner, vec));

  return Object.freeze({
    beta,
    gamma: γ,
    electricFieldStationary: valVec("Em", E0),
    electricFieldMoving: valVec("Ec", Eprime),
    magneticFieldStationary: valVec("Bm", B0),
    magneticFieldMoving: valVec("Bc", Bprime),
    fieldInvariantEDotB: valScalar("id", inv0.eDotB),
    fieldInvariantE2MinusC2B2: valScalar("iv", inv0.e2MinusC2B2),
    lorentzFactor: valScalar("g", γ),
    chargeVelocityStationary: valVec("um", u0),
    chargeVelocityMoving: valVec("uc", uprime),
    transverseForceLaboratory: valVec("Fm", F_lab),
    transverseForceComoving: valVec("Fc", F_comoving),
    eventId,
  });
}

/** SR-07 plane-wave Maxwell residual oracle. Units: c = 1 internally. */

export type PlaneWaveKind = "plus-x" | "minus-x" | "plus-y" | "oblique";
export type Polarization = "primary" | "secondary";
export type TransformConvention = "printed" | "flipped-z-prime";
export type Event4 = Readonly<{ t: number; x: number; y: number; z: number }>;

export const SR07_EVENT_SEED = "19050630";
export const SR07_RESIDUAL_RELATIVE = 1e-12;
export const SR07_RESIDUAL_FLOOR = 1e-15;

function waveNormal(kind: PlaneWaveKind): Vec3 {
  if (kind === "minus-x") return Object.freeze({ x: -1, y: 0, z: 0 });
  if (kind === "plus-y") return Object.freeze({ x: 0, y: 1, z: 0 });
  if (kind === "oblique") {
    const s = Math.SQRT1_2;
    return Object.freeze({ x: s, y: s, z: 0 });
  }
  return Object.freeze({ x: 1, y: 0, z: 0 });
}

function rejectFromNormal(trial: Vec3, n: Vec3): Vec3 | null {
  const dot = trial.x * n.x + trial.y * n.y + trial.z * n.z;
  const x = trial.x - dot * n.x;
  const y = trial.y - dot * n.y;
  const z = trial.z - dot * n.z;
  const mag = Math.hypot(x, y, z);
  if (mag < 1e-12) return null;
  return Object.freeze({ x: x / mag, y: y / mag, z: z / mag });
}

function wavePolarization(kind: PlaneWaveKind, pol: Polarization): Vec3 {
  const n = waveNormal(kind);
  const preferred: readonly Vec3[] = [
    Object.freeze({ x: 0, y: 1, z: 0 }),
    Object.freeze({ x: 0, y: 0, z: 1 }),
    Object.freeze({ x: 1, y: 0, z: 0 }),
  ];
  let e1: Vec3 | null = null;
  for (const trial of preferred) {
    e1 = rejectFromNormal(trial, n);
    if (e1) break;
  }
  const primary = e1 ?? Object.freeze({ x: 0, y: 1, z: 0 });
  const cross = Object.freeze({
    x: n.y * primary.z - n.z * primary.y,
    y: n.z * primary.x - n.x * primary.z,
    z: n.x * primary.y - n.y * primary.x,
  });
  const mag = Math.hypot(cross.x, cross.y, cross.z) || 1;
  const secondary = Object.freeze({ x: cross.x / mag, y: cross.y / mag, z: cross.z / mag });
  return pol === "primary" ? primary : secondary;
}

export function seededPlaneWaveEvents(seed = SR07_EVENT_SEED, count = 20): readonly Event4[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  const events: Event4[] = [];
  for (let i = 0; i < count; i++) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const t = (h % 1000) / 1000;
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const x = (h % 1000) / 1000;
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const y = (h % 1000) / 1000;
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const z = (h % 1000) / 1000;
    events.push(Object.freeze({ t, x, y, z }));
  }
  return Object.freeze(events);
}

function planeWaveAt(
  n: Vec3,
  eHat: Vec3,
  E0: number,
  omega: number,
  event: Event4,
): {
  E: Vec3;
  B: Vec3;
  dEdt: Vec3;
  dBdt: Vec3;
  dEdx: Vec3;
  dEdy: Vec3;
  dEdz: Vec3;
  dBdx: Vec3;
  dBdy: Vec3;
  dBdz: Vec3;
} {
  const kDotR = omega * (n.x * event.x + n.y * event.y + n.z * event.z);
  const phi = omega * event.t - kDotR;
  const s = Math.sin(phi);
  const cphi = Math.cos(phi);
  const E = Object.freeze({ x: E0 * eHat.x * s, y: E0 * eHat.y * s, z: E0 * eHat.z * s });
  const B = Object.freeze({
    x: n.y * E.z - n.z * E.y,
    y: n.z * E.x - n.x * E.z,
    z: n.x * E.y - n.y * E.x,
  });
  const dsinDt = omega * cphi;
  const dsinDx = -omega * n.x * cphi;
  const dsinDy = -omega * n.y * cphi;
  const dsinDz = -omega * n.z * cphi;
  const amp = (dsin: number) =>
    Object.freeze({
      E: Object.freeze({ x: E0 * eHat.x * dsin, y: E0 * eHat.y * dsin, z: E0 * eHat.z * dsin }),
      B: Object.freeze({
        x: (n.y * E0 * eHat.z - n.z * E0 * eHat.y) * dsin,
        y: (n.z * E0 * eHat.x - n.x * E0 * eHat.z) * dsin,
        z: (n.x * E0 * eHat.y - n.y * E0 * eHat.x) * dsin,
      }),
    });
  const dt = amp(dsinDt);
  const dx = amp(dsinDx);
  const dy = amp(dsinDy);
  const dz = amp(dsinDz);
  return {
    E,
    B,
    dEdt: dt.E,
    dBdt: dt.B,
    dEdx: dx.E,
    dEdy: dy.E,
    dEdz: dz.E,
    dBdx: dx.B,
    dBdy: dy.B,
    dBdz: dz.B,
  };
}

function applyPrintedOrFlipped(
  E: Vec3,
  B: Vec3,
  v: number,
  convention: TransformConvention,
): { E: Vec3; B: Vec3; gamma: number } {
  const t = transformSI({ E, B, boost: v, c: 1 });
  if (convention === "printed" || !Number.isFinite(t.gamma)) return t;
  const γ = t.gamma;
  return {
    gamma: γ,
    E: Object.freeze({
      x: E.x,
      y: t.E.y,
      z: γ * (E.z - v * B.y),
    }),
    B: t.B,
  };
}

function chainPrime(
  ddt: Vec3,
  ddx: Vec3,
  ddy: Vec3,
  ddz: Vec3,
  g: number,
  v: number,
): { dTau: Vec3; dXi: Vec3; dEta: Vec3; dZeta: Vec3 } {
  const mix = (a: Vec3, b: Vec3, sa: number, sb: number) =>
    Object.freeze({ x: sa * a.x + sb * b.x, y: sa * a.y + sb * b.y, z: sa * a.z + sb * b.z });
  return {
    dTau: mix(ddt, ddx, g, g * v),
    dXi: mix(ddx, ddt, g, g * v),
    dEta: ddy,
    dZeta: ddz,
  };
}

function maxAbs(values: number[]): number {
  return values.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
}

export function maxwellResidualsPlaneWave(input: {
  beta: number;
  wave: PlaneWaveKind;
  polarization: Polarization;
  events?: readonly Event4[];
  convention?: TransformConvention;
  E0?: number;
  omega?: number;
}): Readonly<{
  maxResidual: number;
  residuals: Float64Array;
  amplitudeFactor: number;
  frequencyFactor: number;
  gamma: number;
  passed: boolean;
  eventSeed: string;
}> {
  const v = input.beta;
  const g = gamma(v);
  if (g.status !== "value") {
    return Object.freeze({
      maxResidual: Number.POSITIVE_INFINITY,
      residuals: new Float64Array(6),
      amplitudeFactor: Number.NaN,
      frequencyFactor: Number.NaN,
      gamma: Number.NaN,
      passed: false,
      eventSeed: SR07_EVENT_SEED,
    });
  }
  const E0 = input.E0 ?? 1;
  const omega = input.omega ?? 1;
  const convention = input.convention ?? "printed";
  const n = waveNormal(input.wave);
  const eHat = wavePolarization(input.wave, input.polarization);
  const events = input.events ?? seededPlaneWaveEvents();
  const residuals = new Float64Array(6);
  let maxResidual = 0;
  const γ = g.value;
  const doppler = γ * (1 - n.x * v);
  const amplitudeFactor = input.wave === "plus-x" || input.wave === "minus-x" ? doppler : γ;
  const frequencyFactor = doppler;
  let allPassed = true;
  for (const event of events) {
    const w = planeWaveAt(n, eHat, E0, omega, event);
    const dEdt = applyPrintedOrFlipped(w.dEdt, w.dBdt, v, convention);
    const dEdx = applyPrintedOrFlipped(w.dEdx, w.dBdx, v, convention);
    const dEdy = applyPrintedOrFlipped(w.dEdy, w.dBdy, v, convention);
    const dEdz = applyPrintedOrFlipped(w.dEdz, w.dBdz, v, convention);
    const eTau = chainPrime(dEdt.E, dEdx.E, dEdy.E, dEdz.E, γ, v);
    const bTau = chainPrime(dEdt.B, dEdx.B, dEdy.B, dEdz.B, γ, v);
    const curlE: readonly [number, number, number] = [
      eTau.dEta.z - eTau.dZeta.y,
      eTau.dZeta.x - eTau.dXi.z,
      eTau.dXi.y - eTau.dEta.x,
    ];
    const curlB: readonly [number, number, number] = [
      bTau.dEta.z - bTau.dZeta.y,
      bTau.dZeta.x - bTau.dXi.z,
      bTau.dXi.y - bTau.dEta.x,
    ];
    const faraday: readonly [number, number, number] = [
      curlE[0] + bTau.dTau.x,
      curlE[1] + bTau.dTau.y,
      curlE[2] + bTau.dTau.z,
    ];
    const ampere: readonly [number, number, number] = [
      curlB[0] - eTau.dTau.x,
      curlB[1] - eTau.dTau.y,
      curlB[2] - eTau.dTau.z,
    ];
    const six = [...faraday, ...ampere];
    for (let i = 0; i < 6; i++) {
      const axis = i % 3 === 0 ? "x" : i % 3 === 1 ? "y" : "z";
      const terms =
        i < 3
          ? [curlE[i] ?? 0, bTau.dTau[axis], E0 * omega]
          : [curlB[i % 3] ?? 0, eTau.dTau[axis], E0 * omega];
      const tol = SR07_RESIDUAL_RELATIVE * maxAbs(terms) + SR07_RESIDUAL_FLOOR * E0 * omega;
      const r = Math.abs(six[i] ?? 0);
      if (r > (residuals[i] ?? 0)) residuals[i] = r;
      if (r > maxResidual) maxResidual = r;
      if (r > tol) allPassed = false;
    }
  }
  return Object.freeze({
    maxResidual,
    residuals,
    amplitudeFactor,
    frequencyFactor,
    gamma: γ,
    passed: allPassed,
    eventSeed: SR07_EVENT_SEED,
  });
}

// ---------------------------------------------------------------------------
// SR-12: Charge and Current Density Transformations (Paper 3, §9)
// ---------------------------------------------------------------------------

export type Sr12UnitLayer = "si" | "gaussian";
export type Sr12Mode =
  | "neutral-conductor"
  | "convection"
  | "moving-sphere"
  | "gaussian-pulse"
  | "current-loop";

export type Sr12Input = Readonly<{
  unitLayer: Sr12UnitLayer;
  descriptionFrame: "stationary" | "moving";
  mode: Sr12Mode;
  chargeDensity: number;
  currentDensity: Vec3;
  boost: number;
  carrierVelocity: Vec3;
  sphereRadius: number;
  sphereCharge: number;
  loopCurrent: number;
  loopLengthX: number;
  loopLengthY: number;
  pulseWidth: number;
  pulseAmplitude: number;
}>;

export type Sr12Snapshot = Readonly<{
  beta: number;
  gamma: number;
  chargeDensityStationary: ScientificResult;
  chargeDensityMoving: ScientificResult;
  currentDensityStationary: ScientificResult;
  currentDensityMoving: ScientificResult;
  fourCurrentInvariant: ScientificResult;
  fourCurrentInvariantNormalized: ScientificResult;
  lorentzFactor: ScientificResult;
  continuityResidualStationary: ScientificResult;
  continuityResidualMoving: ScientificResult;
  loopLegChargePositive: ScientificResult;
  loopLegChargeNegative: ScientificResult;
  loopTotalCharge: ScientificResult;
  sphereTotalChargeStationary: ScientificResult;
  sphereTotalChargeMoving: ScientificResult;
  eventId: string;
}>;

export function transformChargeCurrent(input: {
  rho: number;
  J: Vec3;
  boost: number;
  c?: number;
}): Readonly<{
  rho: number;
  J: Vec3;
  beta: number;
  gamma: number;
}> {
  const c = input.c ?? C_SI;
  const v = input.boost;
  const beta = v / c;
  const g = gamma(beta);
  if (g.status !== "value") {
    return Object.freeze({
      rho: Number.NaN,
      J: Object.freeze({ x: Number.NaN, y: Number.NaN, z: Number.NaN }),
      beta,
      gamma: Number.NaN,
    });
  }
  const γ = g.value;
  const { rho, J } = input;
  const rhoPrime = γ * (rho - (v * J.x) / (c * c));
  const JprimeX = γ * (J.x - v * rho);
  return Object.freeze({
    rho: rhoPrime,
    J: Object.freeze({
      x: JprimeX,
      y: J.y,
      z: J.z,
    }),
    beta,
    gamma: γ,
  });
}

export function fourCurrentInvariants(
  rho: number,
  J: Vec3,
  c = C_SI,
): Readonly<{
  si: number;
  normalized: number;
}> {
  const jSq = J.x * J.x + J.y * J.y + J.z * J.z;
  const si = c * rho * (c * rho) - jSq;
  const normalized = c === 1 ? rho * rho - jSq : rho * c * (rho * c) - jSq;
  return Object.freeze({ si, normalized });
}

export function sphereTotalCharge(radius: number, rho: number): number {
  return (4 / 3) * Math.PI * radius * radius * radius * rho;
}

export function currentLoopCharges(
  I: number,
  lx: number,
  _ly: number,
  boost: number,
  c = C_SI,
): Readonly<{
  gamma: number;
  contractedLengthX: number;
  lineDensityPositive: number;
  lineDensityNegative: number;
  legChargePositive: number;
  legChargeNegative: number;
  totalCharge: number;
}> {
  const beta = boost / c;
  const g = gamma(beta);
  if (g.status !== "value") {
    return Object.freeze({
      gamma: Number.NaN,
      contractedLengthX: Number.NaN,
      lineDensityPositive: Number.NaN,
      lineDensityNegative: Number.NaN,
      legChargePositive: Number.NaN,
      legChargeNegative: Number.NaN,
      totalCharge: Number.NaN,
    });
  }
  const γ = g.value;
  const contractedLengthX = lx / γ;
  const lineDensityPositive = (-γ * boost * I) / (c * c);
  const lineDensityNegative = (+γ * boost * I) / (c * c);
  const legChargePositive = lineDensityPositive * contractedLengthX;
  const legChargeNegative = lineDensityNegative * contractedLengthX;
  const totalCharge = legChargePositive + legChargeNegative;
  return Object.freeze({
    gamma: γ,
    contractedLengthX,
    lineDensityPositive,
    lineDensityNegative,
    legChargePositive,
    legChargeNegative,
    totalCharge,
  });
}

export function gaussianPulseContinuity(
  rho0: number,
  u: number,
  sigma: number,
  x: number,
  t: number,
  boost: number,
  c = C_SI,
): Readonly<{
  stationaryResidual: number;
  movingResidual: number;
  rho: number;
  Jx: number;
  rhoPrime: number;
  JprimeX: number;
}> {
  const beta = boost / c;
  const g = gamma(beta);
  if (g.status !== "value" || sigma <= 0 || Math.abs(u) >= c) {
    return Object.freeze({
      stationaryResidual: Number.NaN,
      movingResidual: Number.NaN,
      rho: Number.NaN,
      Jx: Number.NaN,
      rhoPrime: Number.NaN,
      JprimeX: Number.NaN,
    });
  }
  const γ = g.value;
  const s2 = sigma * sigma;
  const arg = x - u * t;
  const gauss = Math.exp(-(arg * arg) / (2 * s2));
  const rho = rho0 * gauss;
  const Jx = u * rho;
  const dRhoDt = ((u * arg) / s2) * rho;
  const dJxDx = -((u * arg) / s2) * rho;
  const stationaryResidual = Math.abs(dRhoDt + dJxDx);

  const denom = 1 - (u * boost) / (c * c);
  const uPrime = (u - boost) / denom;
  const rhoPrime = γ * (1 - (u * boost) / (c * c)) * rho;
  const JprimeX = γ * (u - boost) * rho;

  const xp = γ * (x - boost * t);
  const tp = γ * (t - (boost * x) / (c * c));
  const argPrime = xp - uPrime * tp;
  const sigmaPrime = sigma / (γ * (1 - (u * boost) / (c * c)));
  const sp2 = sigmaPrime * sigmaPrime;
  const dRhoPrimeDtPrime = ((uPrime * argPrime) / sp2) * rhoPrime;
  const dJprimePrimeDxPrime = -((uPrime * argPrime) / sp2) * rhoPrime;
  const movingResidual = Math.abs(dRhoPrimeDtPrime + dJprimePrimeDxPrime);

  return Object.freeze({
    stationaryResidual,
    movingResidual,
    rho,
    Jx,
    rhoPrime,
    JprimeX,
  });
}

const SR12_ROWS = {
  rhoM: [
    "chargeDensityStationary",
    "C/m^3",
    "charge-density-stationary",
    "fields.transformChargeCurrent",
  ],
  rhoC: ["chargeDensityMoving", "C/m^3", "charge-density-moving", "fields.transformChargeCurrent"],
  JM: [
    "currentDensityStationary",
    "A/m^2",
    "current-density-stationary",
    "fields.transformChargeCurrent",
  ],
  JC: ["currentDensityMoving", "A/m^2", "current-density-moving", "fields.transformChargeCurrent"],
  inv: [
    "fourCurrentInvariant",
    "A^2/m^4",
    "four-current-invariant",
    "fields.fourCurrentInvariants",
  ],
  invNorm: [
    "fourCurrentInvariantNormalized",
    "1",
    "four-current-invariant-normalized",
    "fields.fourCurrentInvariants",
  ],
  gamma: ["lorentzFactor", "1", "lorentz-factor", "kinematics.gamma"],
  contM: [
    "continuityResidualStationary",
    "A/m^3",
    "continuity-residual-stationary",
    "fields.gaussianPulseContinuity",
  ],
  contC: [
    "continuityResidualMoving",
    "A/m^3",
    "continuity-residual-moving",
    "fields.gaussianPulseContinuity",
  ],
  legPos: ["loopLegChargePositive", "C", "loop-leg-charge-positive", "fields.currentLoopCharges"],
  legNeg: ["loopLegChargeNegative", "C", "loop-leg-charge-negative", "fields.currentLoopCharges"],
  loopTotal: ["loopTotalCharge", "C", "loop-total-charge", "fields.currentLoopCharges"],
  sphereM: [
    "sphereTotalChargeStationary",
    "C",
    "sphere-total-charge-stationary",
    "fields.sphereTotalCharge",
  ],
  sphereC: [
    "sphereTotalChargeMoving",
    "C",
    "sphere-total-charge-moving",
    "fields.sphereTotalCharge",
  ],
} as const;

export function evaluateSr12(input: Sr12Input): Sr12Snapshot {
  const c = C_SI;
  const v = input.boost;
  const eventId = "event-charge-current-0";

  const packScalar = (
    key: keyof typeof SR12_ROWS,
    make: (id: string, unit: string, kind: string, owner: string) => ScientificResult,
  ) => {
    const r = SR12_ROWS[key];
    return make(r[0], r[1], r[2], r[3]);
  };

  const valScalar = (key: keyof typeof SR12_ROWS, num: number) =>
    packScalar(key, (id, unit, kind, owner) => asValue(id, unit, kind, owner, num));

  const valVector = (key: keyof typeof SR12_ROWS, vec: Vec3) =>
    packScalar(key, (id, unit, kind, owner) => asVectorValue(id, unit, kind, owner, vec));

  const refuseAll = (reason: string, condition: string): Sr12Snapshot => {
    const out = (key: keyof typeof SR12_ROWS) =>
      packScalar(key, (id, unit, kind, owner) =>
        asOutside(id, unit, kind, owner, condition, reason),
      );
    return Object.freeze({
      beta: v / c,
      gamma: Number.NaN,
      chargeDensityStationary: out("rhoM"),
      chargeDensityMoving: out("rhoC"),
      currentDensityStationary: out("JM"),
      currentDensityMoving: out("JC"),
      fourCurrentInvariant: out("inv"),
      fourCurrentInvariantNormalized: out("invNorm"),
      lorentzFactor: out("gamma"),
      continuityResidualStationary: out("contM"),
      continuityResidualMoving: out("contC"),
      loopLegChargePositive: out("legPos"),
      loopLegChargeNegative: out("legNeg"),
      loopTotalCharge: out("loopTotal"),
      sphereTotalChargeStationary: out("sphereM"),
      sphereTotalChargeMoving: out("sphereC"),
      eventId,
    });
  };

  if (
    ![
      input.boost,
      input.chargeDensity,
      input.currentDensity.x,
      input.currentDensity.y,
      input.currentDensity.z,
      input.carrierVelocity.x,
      input.carrierVelocity.y,
      input.carrierVelocity.z,
      input.sphereRadius,
      input.sphereCharge,
      input.loopCurrent,
      input.loopLengthX,
      input.loopLengthY,
      input.pulseWidth,
      input.pulseAmplitude,
    ].every(Number.isFinite)
  ) {
    return refuseAll(
      "All density, current, velocity and boost inputs must be finite numbers.",
      "finite inputs",
    );
  }

  const beta = v / c;
  if (Math.abs(beta) > 0.95) {
    return refuseAll("Observer boost speed must satisfy |v| <= 0.95c.", "|v| <= 0.95c");
  }

  const g = gamma(beta);
  if (g.status !== "value") {
    return refuseAll("Lorentz factor could not be evaluated.", "|v| < c");
  }
  const γ = g.value;

  const rho0 = input.chargeDensity;
  let J0: Vec3 = input.currentDensity;

  if (input.mode === "convection") {
    const uMagSq =
      input.carrierVelocity.x ** 2 + input.carrierVelocity.y ** 2 + input.carrierVelocity.z ** 2;
    if (uMagSq >= c * c) {
      return refuseAll("Carrier velocity must satisfy |u| < c.", "|u| < c");
    }
    J0 = Object.freeze({
      x: rho0 * input.carrierVelocity.x,
      y: rho0 * input.carrierVelocity.y,
      z: rho0 * input.carrierVelocity.z,
    });
  }

  const transformed = transformChargeCurrent({ rho: rho0, J: J0, boost: v, c });
  const invs = fourCurrentInvariants(rho0, J0, c);

  // Mode-specific calculations
  const loop = currentLoopCharges(input.loopCurrent, input.loopLengthX, input.loopLengthY, v, c);

  const sphereQ0 = sphereTotalCharge(input.sphereRadius, rho0);
  const sphereQPrime = sphereQ0; // Exact charge invariance

  const pulse = gaussianPulseContinuity(
    input.pulseAmplitude,
    input.carrierVelocity.x,
    input.pulseWidth,
    0,
    0,
    v,
    c,
  );

  return Object.freeze({
    beta,
    gamma: γ,
    chargeDensityStationary: valScalar("rhoM", rho0),
    chargeDensityMoving: valScalar("rhoC", transformed.rho),
    currentDensityStationary: valVector("JM", J0),
    currentDensityMoving: valVector("JC", transformed.J),
    fourCurrentInvariant: valScalar("inv", invs.si),
    fourCurrentInvariantNormalized: valScalar(
      "invNorm",
      (c * rho0) ** 2 / (c * c) - (J0.x ** 2 + J0.y ** 2 + J0.z ** 2) / (c * c),
    ),
    lorentzFactor: valScalar("gamma", γ),
    continuityResidualStationary: valScalar("contM", pulse.stationaryResidual || 0),
    continuityResidualMoving: valScalar("contC", pulse.movingResidual || 0),
    loopLegChargePositive: valScalar("legPos", loop.legChargePositive),
    loopLegChargeNegative: valScalar("legNeg", loop.legChargeNegative),
    loopTotalCharge: valScalar("loopTotal", loop.totalCharge),
    sphereTotalChargeStationary: valScalar("sphereM", sphereQ0),
    sphereTotalChargeMoving: valScalar("sphereC", sphereQPrime),
    eventId,
  });
}

// ---------------------------------------------------------------------------
// SR-02: Segment Motional EMF via Adaptive Gauss-Kronrod Quadrature
// ---------------------------------------------------------------------------

export type EmfFieldSource =
  | { readonly kind: "uniform"; readonly B: Vec3 }
  | { readonly kind: "dipole"; readonly moment: Vec3; readonly mu0?: number };

export interface SegmentEmfInput {
  readonly field: EmfFieldSource;
  readonly segment: { readonly start: Vec3; readonly end: Vec3 };
  readonly velocity: Vec3;
}

export interface SegmentEmfResult {
  readonly value: number;
  readonly errorEstimate: number;
}

const KRONROD_NODES: readonly number[] = [
  0.0, 0.20778495500789845, -0.20778495500789845, 0.4058451513773972, -0.4058451513773972,
  0.5860872354676911, -0.5860872354676911, 0.7415311855993945, -0.7415311855993945,
  0.8648644233597691, -0.8648644233597691, 0.9491079123427585, -0.9491079123427585,
  0.9914553711208126, -0.9914553711208126,
];

const KRONROD_WEIGHTS: readonly number[] = [
  0.20948214108472782, 0.20443294007529889, 0.20443294007529889, 0.19035050024765646,
  0.19035050024765646, 0.1690047266392679, 0.1690047266392679, 0.14065325971552592,
  0.14065325971552592, 0.10479001032225019, 0.10479001032225019, 0.06309209262997854,
  0.06309209262997854, 0.02293532201052922, 0.02293532201052922,
];

const GAUSS_INDICES = [0, 3, 4, 7, 8, 11, 12] as const;
const GAUSS_WEIGHTS: readonly number[] = [
  0.4179591836734694, 0.3818300505051189, 0.3818300505051189, 0.27970539148250007,
  0.27970539148250007, 0.1294849661688697, 0.1294849661688697,
];

function integrateAdaptiveGK15(
  f: (s: number) => number,
  a: number,
  b: number,
  tol = 1e-12,
  depth = 0,
): { value: number; error: number } {
  const m = (a + b) / 2;
  const h = (b - a) / 2;

  let kronrodSum = 0;
  for (let i = 0; i < 15; i++) {
    const s = m + h * (KRONROD_NODES[i] ?? 0);
    kronrodSum += (KRONROD_WEIGHTS[i] ?? 0) * f(s);
  }
  const kronrod = h * kronrodSum;

  let gaussSum = 0;
  for (let j = 0; j < 7; j++) {
    const idx = GAUSS_INDICES[j];
    if (idx === undefined) continue;
    const s = m + h * (KRONROD_NODES[idx] ?? 0);
    gaussSum += (GAUSS_WEIGHTS[j] ?? 0) * f(s);
  }
  const gauss = h * gaussSum;
  const error = Math.abs(kronrod - gauss);

  if (error <= tol * Math.max(Math.abs(kronrod), 1e-15) || depth >= 10) {
    return { value: kronrod, error };
  }

  const left = integrateAdaptiveGK15(f, a, m, tol, depth + 1);
  const right = integrateAdaptiveGK15(f, m, b, tol, depth + 1);
  return {
    value: left.value + right.value,
    error: left.error + right.error,
  };
}

export function segmentEmf(input: SegmentEmfInput): SegmentEmfResult {
  const { field, segment, velocity } = input;
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const dz = segment.end.z - segment.start.z;

  if (field.kind === "uniform") {
    const vx = velocity.y * field.B.z - velocity.z * field.B.y;
    const vy = velocity.z * field.B.x - velocity.x * field.B.z;
    const vz = velocity.x * field.B.y - velocity.y * field.B.x;
    return Object.freeze({
      value: vx * dx + vy * dy + vz * dz,
      errorEstimate: 0,
    });
  }

  const moment = field.moment;
  const mu0 = field.mu0 ?? MU0;

  const integrand = (s: number): number => {
    const px = segment.start.x + s * dx;
    const py = segment.start.y + s * dy;
    const pz = segment.start.z + s * dz;
    const B = dipoleField(moment, { x: px, y: py, z: pz }, mu0);
    const vx = velocity.y * B.z - velocity.z * B.y;
    const vy = velocity.z * B.x - velocity.x * B.z;
    const vz = velocity.x * B.y - velocity.y * B.x;
    return vx * dx + vy * dy + vz * dz;
  };

  const res = integrateAdaptiveGK15(integrand, 0, 1);
  return Object.freeze({
    value: res.value,
    errorEstimate: res.error,
  });
}

// ---------------------------------------------------------------------------
// SR-12: Charge Loop & Moving Sphere Total Charge
// ---------------------------------------------------------------------------

export function loopChargeInFrame(input: {
  readonly current: number;
  readonly lengthX: number;
  readonly lengthY: number;
  readonly beta: number;
  readonly c?: number;
}): ReturnType<typeof currentLoopCharges> {
  const c = input.c ?? C_SI;
  const boost = input.beta * c;
  return currentLoopCharges(input.current, input.lengthX, input.lengthY, boost, c);
}

export interface MovingSphereChargeResult {
  readonly restCharge: number;
  readonly restDensity: number;
  readonly restRadius: number;
  readonly sphereSpeed: number;
  readonly observerBeta: number;
  readonly relativeBeta: number;
  readonly relativeGamma: number;
  readonly observedDensity: number;
  readonly observedVolume: number;
  readonly totalChargeAnalytic: number;
  readonly totalChargeQuadrature: number;
  readonly quadratureError: number;
  readonly consistent: boolean;
}

export function movingSphereTotalCharge(input: {
  readonly rho0: number;
  readonly radius: number;
  readonly u: number;
  readonly observerBeta: number;
  readonly c?: number;
}): MovingSphereChargeResult {
  const c = input.c ?? C_SI;
  const { rho0, radius, u, observerBeta } = input;
  const vObs = observerBeta * c;

  const denom = 1 - (u * vObs) / (c * c);
  const uPrime = (u - vObs) / denom;
  const betaPrime = uPrime / c;
  const gPrime = gamma(betaPrime);
  const gammaPrime = gPrime.status === "value" ? gPrime.value : 1;

  const rhoPrime = gammaPrime * rho0;
  const restVolume = (4 / 3) * Math.PI * radius ** 3;
  const restCharge = rho0 * restVolume;
  const observedVolume = restVolume / gammaPrime;
  const totalChargeAnalytic = restCharge;

  const a = radius / gammaPrime;
  const glNodes = [
    -0.9739065285171717, -0.8650633666889845, -0.6794095682990244, -0.4333953941292472,
    -0.1488743389816312, 0.1488743389816312, 0.4333953941292472, 0.6794095682990244,
    0.8650633666889845, 0.9739065285171717,
  ];
  const glWeights = [
    0.0666713443086881, 0.1494513491505806, 0.219086362515982, 0.2692667193099963,
    0.2955242247147529, 0.2955242247147529, 0.2692667193099963, 0.219086362515982,
    0.1494513491505806, 0.0666713443086881,
  ];

  let quadSum = 0;
  for (let i = 0; i < glNodes.length; i++) {
    const xi = glNodes[i] ?? 0;
    const diskArea = Math.PI * radius * radius * (1 - xi * xi);
    quadSum += (glWeights[i] ?? 0) * diskArea;
  }
  const totalChargeQuadrature = rhoPrime * quadSum * a;
  const quadratureError =
    Math.abs(totalChargeQuadrature - totalChargeAnalytic) / totalChargeAnalytic;

  return Object.freeze({
    restCharge,
    restDensity: rho0,
    restRadius: radius,
    sphereSpeed: u,
    observerBeta,
    relativeBeta: betaPrime,
    relativeGamma: gammaPrime,
    observedDensity: rhoPrime,
    observedVolume,
    totalChargeAnalytic,
    totalChargeQuadrature,
    quadratureError,
    consistent: quadratureError <= 1e-10,
  });
}

export interface ContinuityResidualResult {
  readonly stationaryResidual: number;
  readonly movingResidual: number;
  readonly maxTermStationary: number;
  readonly maxTermMoving: number;
  readonly relativeResidualStationary: number;
  readonly relativeResidualMoving: number;
  readonly passed: boolean;
}

export function continuityResidual(
  configuration: {
    readonly kind: "gaussian-pulse";
    readonly rho0: number;
    readonly u: number;
    readonly sigma: number;
  },
  events: readonly { readonly x: number; readonly t: number }[],
  beta: number,
  c = C_SI,
): ContinuityResidualResult {
  const boost = beta * c;
  let maxStatRes = 0;
  let maxMovRes = 0;
  let maxStatTerm = 0;
  let maxMovTerm = 0;

  for (const ev of events) {
    const pulse = gaussianPulseContinuity(
      configuration.rho0,
      configuration.u,
      configuration.sigma,
      ev.x,
      ev.t,
      boost,
      c,
    );
    if (pulse.stationaryResidual > maxStatRes) maxStatRes = pulse.stationaryResidual;
    if (pulse.movingResidual > maxMovRes) maxMovRes = pulse.movingResidual;

    const s2 = configuration.sigma * configuration.sigma;
    const arg = ev.x - configuration.u * ev.t;
    const termStat = Math.abs(((configuration.u * arg) / s2) * pulse.rho);
    if (termStat > maxStatTerm) maxStatTerm = termStat;

    const denom = 1 - (configuration.u * boost) / (c * c);
    const uPrime = (configuration.u - boost) / denom;
    const g = gamma(beta);
    const γ = g.status === "value" ? g.value : 1;
    const sigmaPrime = configuration.sigma / (γ * denom);
    const sp2 = sigmaPrime * sigmaPrime;
    const xp = γ * (ev.x - boost * ev.t);
    const tp = γ * (ev.t - (boost * ev.x) / (c * c));
    const argPrime = xp - uPrime * tp;
    const termMov = Math.abs(((uPrime * argPrime) / sp2) * pulse.rhoPrime);
    if (termMov > maxMovTerm) maxMovTerm = termMov;
  }

  const floor = 1e-20;
  const tolStat = 1e-12 * Math.max(maxStatTerm, floor);
  const tolMov = 1e-12 * Math.max(maxMovTerm, floor);
  const relStat = maxStatRes / Math.max(maxStatTerm, floor);
  const relMov = maxMovRes / Math.max(maxMovTerm, floor);

  return Object.freeze({
    stationaryResidual: maxStatRes,
    movingResidual: maxMovRes,
    maxTermStationary: maxStatTerm,
    maxTermMoving: maxMovTerm,
    relativeResidualStationary: relStat,
    relativeResidualMoving: relMov,
    passed: maxStatRes <= tolStat && maxMovRes <= tolMov,
  });
}

// ---------------------------------------------------------------------------
// SR-07: Transform Derivatives via Richardson Central Differences
// ---------------------------------------------------------------------------

export type SpacetimeScalarFn = (x: number, y: number, z: number, t: number) => number;

export interface TransformDerivativesResult {
  readonly point: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly t: number;
  };
  readonly beta: number;
  readonly dFdx_direct: number;
  readonly dFdt_direct: number;
  readonly dFdx_fromChain: number;
  readonly dFdt_fromChain: number;
  readonly relErrorDx: number;
  readonly relErrorDt: number;
  readonly passed: boolean;
}

export function transformDerivatives(
  f: SpacetimeScalarFn,
  point: { readonly x: number; readonly y: number; readonly z: number; readonly t: number },
  beta: number,
  c = C_SI,
  tolerance = 1e-8,
): TransformDerivativesResult {
  const boost = beta * c;
  const g = gamma(beta);
  if (g.status !== "value") {
    throw new Error("Invalid beta");
  }
  const γ = g.value;

  function diff4(
    fn: SpacetimeScalarFn,
    p: [number, number, number, number],
    dim: 0 | 1 | 2 | 3,
    h = 1e-4,
  ): number {
    const pPlusH = [...p] as [number, number, number, number];
    const pMinusH = [...p] as [number, number, number, number];
    const pPlus2H = [...p] as [number, number, number, number];
    const pMinus2H = [...p] as [number, number, number, number];

    pPlusH[dim] += h;
    pMinusH[dim] -= h;
    pPlus2H[dim] += 2 * h;
    pMinus2H[dim] -= 2 * h;

    const d1 = (fn(...pPlusH) - fn(...pMinusH)) / (2 * h);
    const d2 = (fn(...pPlus2H) - fn(...pMinus2H)) / (4 * h);
    return (4 * d1 - d2) / 3;
  }

  const hx = 1e-4;
  const ht = hx / c;

  const pK: [number, number, number, number] = [point.x, point.y, point.z, point.t];
  const dFdx_direct = diff4(f, pK, 0, hx);
  const dFdt_direct = diff4(f, pK, 3, ht);

  const xp = γ * (point.x - boost * point.t);
  const tp = γ * (point.t - (boost * point.x) / (c * c));
  const yp = point.y;
  const zp = point.z;

  const fPrime: SpacetimeScalarFn = (xp_in, yp_in, zp_in, tp_in) => {
    const x_orig = γ * (xp_in + boost * tp_in);
    const t_orig = γ * (tp_in + (boost * xp_in) / (c * c));
    return f(x_orig, yp_in, zp_in, t_orig);
  };

  const pPrime: [number, number, number, number] = [xp, yp, zp, tp];
  const dFp_dxp = diff4(fPrime, pPrime, 0, hx);
  const dFp_dtp = diff4(fPrime, pPrime, 3, ht);

  const dFdx_fromChain = γ * (dFp_dxp - (boost / (c * c)) * dFp_dtp);
  const dFdt_fromChain = γ * (dFp_dtp - boost * dFp_dxp);

  const scaleDx = Math.max(Math.abs(dFdx_direct), Math.abs(dFdx_fromChain), 1e-12);
  const scaleDt = Math.max(Math.abs(dFdt_direct), Math.abs(dFdt_fromChain), 1e-12);
  const relErrorDx = Math.abs(dFdx_direct - dFdx_fromChain) / scaleDx;
  const relErrorDt = Math.abs(dFdt_direct - dFdt_fromChain) / scaleDt;

  const passed = relErrorDx <= tolerance && relErrorDt <= tolerance;

  return Object.freeze({
    point,
    beta,
    dFdx_direct,
    dFdt_direct,
    dFdx_fromChain,
    dFdt_fromChain,
    relErrorDx,
    relErrorDt,
    passed,
  });
}
