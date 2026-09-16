/**
 * Field transforms and the magnet-conductor electromotive-force comparison
 * used by SR-02. Generic field play (SR-07, SR-08) is out of this bead's
 * scope; this module is the host-calculation owner until FrankenSim is
 * adopted. Views must not import it.
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

export function forceConsistency(Fperp: number, FprimePerp: number, gammaValue: number): boolean {
  if (![Fperp, FprimePerp, gammaValue].every(Number.isFinite) || gammaValue === 0) return false;
  const expected = FprimePerp / gammaValue;
  const scale = Math.max(Math.abs(Fperp), Math.abs(expected), 1e-30);
  return Math.abs(Fperp - expected) <= 1e-12 * scale;
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

function wavePolarization(kind: PlaneWaveKind, pol: Polarization): Vec3 {
  const n = waveNormal(kind);
  const a =
    pol === "primary"
      ? Object.freeze({ x: 0, y: n.x === 0 ? 0 : 1, z: n.x === 0 ? 1 : 0 })
      : Object.freeze({ x: n.y !== 0 ? 1 : 0, y: 0, z: n.x !== 0 ? 1 : 0 });
  const ax = a.y * n.z - a.z * n.y;
  const ay = a.z * n.x - a.x * n.z;
  const az = a.x * n.y - a.y * n.x;
  const cross = Object.freeze({ x: ax, y: ay, z: az });
  const mag = Math.hypot(cross.x, cross.y, cross.z);
  if (mag === 0) return Object.freeze({ x: 0, y: 1, z: 0 });
  return Object.freeze({ x: cross.x / mag, y: cross.y / mag, z: cross.z / mag });
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
  if (convention === "printed") return t;
  return {
    gamma: t.gamma,
    E: Object.freeze({ x: t.E.x, y: t.E.y, z: -t.E.z }),
    B: Object.freeze({ x: t.B.x, y: -t.B.y, z: t.B.z }),
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
  const amplitudeFactor =
    input.wave === "plus-x" && input.polarization === "primary" ? γ * (1 - v) : γ;
  const frequencyFactor =
    input.wave === "plus-x" ? γ * (1 - Math.sign(n.x) * v) : γ * (1 - n.x * v);
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
      const terms = [
        Math.abs(curlE[i % 3] ?? 0),
        Math.abs(bTau.dTau[i % 3 === 0 ? "x" : i % 3 === 1 ? "y" : "z"] ?? 0),
        Math.abs(curlB[i % 3] ?? 0),
        Math.abs(eTau.dTau[i % 3 === 0 ? "x" : i % 3 === 1 ? "y" : "z"] ?? 0),
        E0 * omega,
      ];
      const tol = SR07_RESIDUAL_RELATIVE * maxAbs(terms) + SR07_RESIDUAL_FLOOR * E0 * omega;
      const r = Math.abs(six[i] ?? 0);
      const currentRes = residuals[i] ?? 0;
      if (r > currentRes) residuals[i] = r;
      if (r > maxResidual) maxResidual = r;
      if (r > tol && r > maxResidual) maxResidual = r;
    }
  }
  const passed =
    maxResidual <= SR07_RESIDUAL_RELATIVE * E0 * omega + SR07_RESIDUAL_FLOOR * E0 * omega;
  return Object.freeze({
    maxResidual,
    residuals,
    amplitudeFactor,
    frequencyFactor,
    gamma: γ,
    passed,
  });
}
