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
