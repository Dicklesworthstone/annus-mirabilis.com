/**
 * Mass-energy coefficient owner used by ME-02 (am-me-02-coefficient-dtmi).
 *
 * The paper's conclusion is a coefficient of 1/2 v^2, not a slogan and not a
 * rest energy assigned in advance. This module never initializes a body's
 * energy as M times c squared or gamma times M times c squared. The kinetic-energy difference is L(gamma-1)
 * from the two-ledger subtraction (ME-01); identifying the Newtonian
 * coefficient then gives a mass change L/c^2.
 *
 * Notation: modern beta is v/c and modern gamma is the Lorentz factor.
 * Einstein's beta in paper 3 is modern gamma. Paper 4 is expected to write
 * the factor as an explicit radical rather than using beta; the facsimile
 * is not pinned, so that printed glyph is UNKNOWN and is not claimed here.
 */
import type { DomainKind, ScientificResult } from "../../experiments/results/types.ts";
import type { ConstantSet } from "./constants.ts";
import { constantValue, getConstantSet } from "./constants.ts";
import { gamma, gammaMinusOne } from "./kinematics.ts";

export const OWNER_ID = "massEnergy";
export const PRINTED_V_SQUARED_ERG_PER_GRAM = 9e20;
export const PRINTED_FACTOR_WORDING =
  "the printed factor is 0.1385 percent larger than the modern c²";
export const MASS_ENERGY_PRINTED_FACTOR_SCENARIO = "mass-energy-printed-factor";
export const C_SI = constantValue(getConstantSet("modern-si-2019"), "speedOfLight").value;
export const C_CGS = C_SI * 100;

export class MassEnergyError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`[mass-energy] ${message} (${code})`);
    this.name = "MassEnergyError";
    this.code = code;
  }
}

export type PremiseObject = Readonly<{
  id: string;
  statement: string;
  provenance: string;
  status: "asserted" | "relaxed" | "present";
  sourceAnchor?: string;
}>;

export const ADDITIVE_CONSTANT_PREMISE: PremiseObject = Object.freeze({
  id: "premise-additive-constant",
  statement: "H - E = K + C with the same C before and after emission",
  provenance: "asserted in the paper; the cancellation does not derive it",
  status: "asserted" as const,
  sourceAnchor: "ap-18-639#p4-s1",
});

export const LIGHT_ENERGY_TRANSFORMATION_PREMISE: PremiseObject = Object.freeze({
  id: "premise-light-energy-transformation",
  statement: "E'/E = gamma * (1 - beta * cos(phi)) (Paper 3, §8)",
  provenance: "imported from electrodynamics of moving bodies (ap-17-891 §8)",
  status: "asserted" as const,
  sourceAnchor: "ap-17-891#p3-s8",
});

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

function asLimit(
  quantityId: string,
  unit: string,
  semanticKind: string,
  ownerId: string,
  value: number,
): ScientificResult {
  return Object.freeze({
    ...identity(quantityId, unit, semanticKind, ownerId),
    status: "analytic-limit" as const,
    description: "The mass coefficient identified at vanishing speed, L/c^2, with no 0/0 division.",
    representation: Object.freeze({ kind: "coefficient" as const, value }),
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
    boundary: Object.freeze({ parameterId: "beta", value: 0.95 }),
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
  compatibleFamily: string,
  neededInformation: readonly string[],
): ScientificResult {
  return Object.freeze({
    ...identity(quantityId, unit, semanticKind, ownerId),
    status: "underdetermined" as const,
    compatibleFamily,
    neededInformation: Object.freeze([...neededInformation]),
  });
}

/** Diagnostic only: 1/sqrt(1-beta^2) - 1. Never feeds the proxy or the limit. */
export function naiveGammaMinusOne(beta: number): ScientificResult {
  if (!Number.isFinite(beta) || Math.abs(beta) >= 1) {
    return asOutside(
      "naiveGammaMinusOne",
      "1",
      "naive-gamma-minus-one",
      "massEnergy.naiveGammaMinusOne",
      "|beta| < 1",
      "No inertial observer at |v| >= c.",
    );
  }
  return asValue(
    "naiveGammaMinusOne",
    "1",
    "naive-gamma-minus-one",
    "massEnergy.naiveGammaMinusOne",
    1 / Math.sqrt(1 - beta * beta) - 1,
  );
}

export type Me02Input = Readonly<{
  beta: number;
  emittedEnergy: number;
  speedOfLight?: number;
}>;

export type Me02Snapshot = Readonly<{
  beta: number;
  emittedEnergy: number;
  speedOfLight: number;
  exactDifference: ScientificResult;
  quadraticApproximation: ScientificResult;
  quadraticDiscrepancy: ScientificResult;
  finiteSpeedProxy: ScientificResult;
  limitingCoefficient: ScientificResult;
  proxyExcess: ScientificResult;
  inertialMassDecrease: ScientificResult;
  massChangeSigned: ScientificResult;
  naive: ScientificResult;
}>;

export function evaluateMe02(input: Me02Input): Me02Snapshot {
  const beta = input.beta;
  const L = input.emittedEnergy;
  const c = input.speedOfLight ?? C_SI;
  const ids = {
    exact: [
      "kineticEnergyDifference",
      "J",
      "kinetic-energy-difference",
      "massEnergy.exactDifference",
    ],
    quad: [
      "quadraticKineticDifference",
      "J",
      "quadratic-kinetic-energy",
      "massEnergy.quadraticApproximation",
    ],
    disc: [
      "quadraticRelativeDiscrepancy",
      "1",
      "quadratic-relative-discrepancy",
      "massEnergy.quadraticDiscrepancy",
    ],
    proxy: ["finiteSpeedMassProxy", "kg", "finite-speed-mass-proxy", "massEnergy.finiteSpeedProxy"],
    limit: [
      "inertialMassDecrease",
      "kg",
      "limiting-mass-coefficient",
      "massEnergy.limitingCoefficient",
    ],
    excess: ["proxyExcessOverLimit", "1", "proxy-excess", "massEnergy.proxyExcess"],
    lost: ["inertialMassDecrease", "kg", "positive-mass-lost", "massEnergy.inertialMassDecrease"],
    signed: ["massChangeSigned", "kg", "signed-mass-change", "massEnergy.massChangeSigned"],
  } as const;

  const refuse = (reason: string, condition: string): Me02Snapshot => {
    const out = (row: readonly [string, string, string, string]) =>
      asOutside(row[0], row[1], row[2], row[3], condition, reason);
    return Object.freeze({
      beta,
      emittedEnergy: L,
      speedOfLight: c,
      exactDifference: out(ids.exact),
      quadraticApproximation: out(ids.quad),
      quadraticDiscrepancy: out(ids.disc),
      finiteSpeedProxy: out(ids.proxy),
      limitingCoefficient: out(ids.limit),
      proxyExcess: out(ids.excess),
      inertialMassDecrease: out(ids.lost),
      massChangeSigned: out(ids.signed),
      naive: naiveGammaMinusOne(beta),
    });
  };

  if (![beta, L, c].every(Number.isFinite) || L <= 0 || c <= 0) {
    return refuse("Emitted energy and speed of light must be finite and positive.", "L > 0, c > 0");
  }
  if (Math.abs(beta) >= 1) {
    return refuse("No inertial observer at |v| >= c.", "|beta| < 1");
  }

  const gmo = gammaMinusOne(beta);
  if (gmo.status !== "value") {
    return refuse(gmo.reason, gmo.condition);
  }
  const g = gamma(beta);
  if (g.status !== "value") {
    return refuse(g.reason, g.condition);
  }
  const exact = L * gmo.value;
  const quadratic = 0.5 * L * beta * beta;
  const limitValue = L / (c * c);
  const discrepancy = exact === 0 ? 0 : (exact - quadratic) / exact;
  const naive = naiveGammaMinusOne(beta);

  const limit = asLimit(ids.limit[0], ids.limit[1], ids.limit[2], ids.limit[3], limitValue);
  const lost = asValue(ids.lost[0], ids.lost[1], ids.lost[2], ids.lost[3], limitValue);
  const signed = asValue(ids.signed[0], ids.signed[1], ids.signed[2], ids.signed[3], -limitValue);

  if (beta === 0) {
    return Object.freeze({
      beta,
      emittedEnergy: L,
      speedOfLight: c,
      exactDifference: asValue(ids.exact[0], ids.exact[1], ids.exact[2], ids.exact[3], 0),
      quadraticApproximation: asValue(ids.quad[0], ids.quad[1], ids.quad[2], ids.quad[3], 0),
      quadraticDiscrepancy: asNotApplicable(
        ids.disc[0],
        ids.disc[1],
        ids.disc[2],
        ids.disc[3],
        "At vanishing speed both the exact and quadratic differences are zero.",
      ),
      finiteSpeedProxy: asNotApplicable(
        ids.proxy[0],
        ids.proxy[1],
        ids.proxy[2],
        ids.proxy[3],
        "The finite-speed proxy divides by v^2; at v = 0 the identified coefficient is the analytic limit.",
      ),
      limitingCoefficient: limit,
      proxyExcess: asNotApplicable(
        ids.excess[0],
        ids.excess[1],
        ids.excess[2],
        ids.excess[3],
        "No proxy is defined at vanishing speed.",
      ),
      inertialMassDecrease: lost,
      massChangeSigned: signed,
      naive,
    });
  }

  const proxy = (2 * L * gmo.value) / (beta * beta * c * c);
  const excess = proxy / limitValue - 1;
  return Object.freeze({
    beta,
    emittedEnergy: L,
    speedOfLight: c,
    exactDifference: asValue(ids.exact[0], ids.exact[1], ids.exact[2], ids.exact[3], exact),
    quadraticApproximation: asValue(ids.quad[0], ids.quad[1], ids.quad[2], ids.quad[3], quadratic),
    quadraticDiscrepancy: asValue(ids.disc[0], ids.disc[1], ids.disc[2], ids.disc[3], discrepancy),
    finiteSpeedProxy: asValue(ids.proxy[0], ids.proxy[1], ids.proxy[2], ids.proxy[3], proxy),
    limitingCoefficient: limit,
    proxyExcess: asValue(ids.excess[0], ids.excess[1], ids.excess[2], ids.excess[3], excess),
    inertialMassDecrease: lost,
    massChangeSigned: signed,
    naive,
  });
}

export type PrintedMassConversionInput = {
  emittedEnergyErg?: number;
  emittedEnergy?: number;
  emittedEnergyJoules?: number;
};

export type PrintedMassConversion = Readonly<{
  scenarioId: typeof MASS_ENERGY_PRINTED_FACTOR_SCENARIO;
  status: "value" | "outside-domain";
  condition?: string;
  reason?: string;
  emittedEnergyErg: number;
  emittedEnergyJoules: number;
  printed: Readonly<{
    value: number;
    unit: "g";
    constantSetId: "einstein-1905-mass-energy-printed";
    entryLabels: readonly string[];
  }>;
  modern: Readonly<{
    value: number;
    unit: "g";
    constantSetId: "modern-si-2019";
    entryLabels: readonly string[];
  }>;
  comparison: Readonly<{
    leftSetId: "modern-si-2019";
    rightSetId: "einstein-1905-mass-energy-printed";
    ratioModernToPrinted: number;
    ratio: number;
    relativeDifference: number;
    wording: typeof PRINTED_FACTOR_WORDING;
  }>;
}>;

/**
 * Printed-factor readout. The view must display `comparison.wording` and must
 * not compute a percentage from the two masses. The two constant sets are
 * never combined into one number.
 */
export function printedMassConversion(input: PrintedMassConversionInput): PrintedMassConversion {
  const L_erg =
    input.emittedEnergyErg ??
    (input.emittedEnergyJoules !== undefined
      ? input.emittedEnergyJoules * 1e7
      : input.emittedEnergy !== undefined
        ? input.emittedEnergy * 1e7
        : Number.NaN);
  const L_joules =
    input.emittedEnergyJoules ??
    input.emittedEnergy ??
    (input.emittedEnergyErg !== undefined ? input.emittedEnergyErg / 1e7 : Number.NaN);

  if (!Number.isFinite(L_erg) || L_erg <= 0) {
    return Object.freeze({
      scenarioId: MASS_ENERGY_PRINTED_FACTOR_SCENARIO,
      status: "outside-domain" as const,
      condition: "L > 0",
      reason: "Emitted energy must be strictly positive.",
      emittedEnergyErg: L_erg,
      emittedEnergyJoules: L_joules,
      printed: Object.freeze({
        value: Number.NaN,
        unit: "g" as const,
        constantSetId: "einstein-1905-mass-energy-printed" as const,
        entryLabels: Object.freeze([
          "speedOfLightSquared (printed: 9e20 erg/g)",
          "speedOfLight (editorial: 3e10 cm/s)",
        ]),
      }),
      modern: Object.freeze({
        value: Number.NaN,
        unit: "g" as const,
        constantSetId: "modern-si-2019" as const,
        entryLabels: Object.freeze(["speedOfLight (defined: 299792458 m/s)"]),
      }),
      comparison: Object.freeze({
        leftSetId: "modern-si-2019" as const,
        rightSetId: "einstein-1905-mass-energy-printed" as const,
        ratioModernToPrinted: Number.NaN,
        ratio: Number.NaN,
        relativeDifference: Number.NaN,
        wording: PRINTED_FACTOR_WORDING,
      }),
    });
  }

  const c2 = C_CGS * C_CGS;
  const printed = L_erg / PRINTED_V_SQUARED_ERG_PER_GRAM;
  const modern = L_erg / c2;
  const ratio = PRINTED_V_SQUARED_ERG_PER_GRAM / c2;
  const relDiff = (PRINTED_V_SQUARED_ERG_PER_GRAM - c2) / c2;

  return Object.freeze({
    scenarioId: MASS_ENERGY_PRINTED_FACTOR_SCENARIO,
    status: "value" as const,
    emittedEnergyErg: L_erg,
    emittedEnergyJoules: L_joules,
    printed: Object.freeze({
      value: printed,
      unit: "g" as const,
      constantSetId: "einstein-1905-mass-energy-printed" as const,
      entryLabels: Object.freeze([
        "speedOfLightSquared (printed: 9e20 erg/g)",
        "speedOfLight (editorial: 3e10 cm/s)",
      ]),
    }),
    modern: Object.freeze({
      value: modern,
      unit: "g" as const,
      constantSetId: "modern-si-2019" as const,
      entryLabels: Object.freeze(["speedOfLight (defined: 299792458 m/s)"]),
    }),
    comparison: Object.freeze({
      leftSetId: "modern-si-2019" as const,
      rightSetId: "einstein-1905-mass-energy-printed" as const,
      ratioModernToPrinted: ratio,
      ratio,
      relativeDifference: relDiff,
      wording: PRINTED_FACTOR_WORDING,
    }),
  });
}

export function proxyEqualsLimit(snapshot: Me02Snapshot): boolean {
  if (snapshot.finiteSpeedProxy.status !== "value") return false;
  if (snapshot.limitingCoefficient.status !== "analytic-limit") return false;
  const rep = snapshot.limitingCoefficient.representation;
  return "value" in rep && snapshot.finiteSpeedProxy.value === rep.value;
}

export function exactDifference(L: number, beta: number, speedOfLight = C_SI): ScientificResult {
  return evaluateMe02({ beta, emittedEnergy: L, speedOfLight }).exactDifference;
}

export function quadraticApproximation(
  L: number,
  beta: number,
  speedOfLight = C_SI,
): ScientificResult {
  return evaluateMe02({ beta, emittedEnergy: L, speedOfLight }).quadraticApproximation;
}

export function finiteSpeedProxy(
  L: number,
  betaOrV: number,
  speedOfLight = C_SI,
): ScientificResult {
  const beta = Math.abs(betaOrV) <= 1 ? betaOrV : betaOrV / speedOfLight;
  return evaluateMe02({ beta, emittedEnergy: L, speedOfLight }).finiteSpeedProxy;
}

export function limitingCoefficient(L: number, speedOfLight = C_SI): ScientificResult {
  return evaluateMe02({ beta: 0, emittedEnergy: L, speedOfLight }).limitingCoefficient;
}

// ============================================================================
// ME-01: Opposite pulses and two ledgers (am-me-01-two-ledgers-g1re)
// ============================================================================

export type Me01Premise = "unchanged" | "relaxed";
export type Me01OffsetDisplay = "symbolic" | "offsets";
export type Me01Notation = "printed" | "modern";
export type Me01Step =
  | "intro"
  | "moving-pulses"
  | "sum-angle"
  | "two-balances"
  | "subtraction-move"
  | "premise-kinetic";

export type Me01Cancellations = Readonly<{
  angleFactors?: boolean;
  internalEnergies?: boolean;
  additiveConstant?: boolean;
}>;

export type Me01Input = Readonly<{
  emittedEnergyRestFrame: number;
  frameSpeed: number;
  emissionAngle: number; // in degrees by default
  angleUnit?: "degrees" | "radians";
  offsetDisplay?: Me01OffsetDisplay;
  premise?: Me01Premise;
  step?: Me01Step;
  cancellations?: Me01Cancellations;
  notation?: Me01Notation;
  speedOfLight?: number;
  initialBodyEnergy?: MassEnergyLedgerSeed;
}>;

export type Me01Snapshot = Readonly<{
  emittedEnergyRestFrame: number;
  frameSpeed: number;
  emissionAngle: number;
  angleRadians: number;
  offsetDisplay: Me01OffsetDisplay;
  premise: Me01Premise;
  step: Me01Step;
  cancellations: Me01Cancellations;
  notation: Me01Notation;
  speedOfLight: number;
  pulse1Moving: ScientificResult;
  pulse2Moving: ScientificResult;
  pulseSumMoving: ScientificResult;
  pulseEnergyRatio: ScientificResult;
  dopplerFrequencyRatio: ScientificResult;
  restBalanceLight: ScientificResult;
  movingBalanceLight: ScientificResult;
  restBodyBefore: ScientificResult;
  restBodyAfter: ScientificResult;
  movingBodyBefore: ScientificResult;
  movingBodyAfter: ScientificResult;
  subtractionDifference: ScientificResult;
  kineticEnergyDifference: ScientificResult;
  additiveEnergyConstant: ScientificResult;
}>;

/**
 * Kernel function: evaluates the moving-frame pulse energies and their angle-invariant sum (Paper 4, §1 & Paper 3, §8).
 * Pulse 1: (L/2) * gamma * (1 - beta * cos(phi))
 * Pulse 2: (L/2) * gamma * (1 + beta * cos(phi))
 * Sum: gamma * L
 */
export function evaluatePulseEnergies(
  emittedEnergyRestFrame: number,
  frameSpeed: number,
  emissionAngleRad: number,
): Readonly<{
  lorentzFactor: number;
  pulse1Moving: number;
  pulse2Moving: number;
  pulseSumMoving: number;
  pulseEnergyRatio: number;
  dopplerFrequencyRatio: number;
}> {
  const g = 1 / Math.sqrt(1 - frameSpeed * frameSpeed);
  const halfL = emittedEnergyRestFrame / 2;
  const cosPhi = Math.cos(emissionAngleRad);
  const factor1 = 1 - frameSpeed * cosPhi;
  const factor2 = 1 + frameSpeed * cosPhi;
  const p1 = halfL * g * factor1;
  const p2 = halfL * g * factor2;
  const sum = g * emittedEnergyRestFrame;
  const ratio = factor1 / factor2;
  return Object.freeze({
    lorentzFactor: g,
    pulse1Moving: p1,
    pulse2Moving: p2,
    pulseSumMoving: sum,
    pulseEnergyRatio: ratio,
    dopplerFrequencyRatio: ratio,
  });
}

export type PulseEnergiesResult = Readonly<{
  status: "value" | "outside-domain";
  condition?: string;
  reason?: string;
  pulse1: ScientificResult;
  pulse2: ScientificResult;
  pulseSum: ScientificResult;
  pulse1Moving: number;
  pulse2Moving: number;
  pulseSumMoving: number;
  lorentzFactor: number;
  pulseEnergyRatio: ScientificResult;
  dopplerFrequencyRatio: ScientificResult;
  energyRatio: number;
  dopplerRatio: number;
  premise: PremiseObject;
}>;

export function pulseEnergies(
  L: number,
  beta: number,
  phi: number,
  unit: "radians" | "degrees" = "radians",
): PulseEnergiesResult {
  const angleRad = unit === "degrees" ? (phi * Math.PI) / 180 : phi;
  const p1Id = [
    "lightComplexEnergyMoving",
    "J",
    "moving-light-pulse-1",
    "massEnergy.pulse1Moving",
  ] as const;
  const p2Id = [
    "lightComplexEnergyMoving",
    "J",
    "moving-light-pulse-2",
    "massEnergy.pulse2Moving",
  ] as const;
  const sumId = [
    "lightComplexEnergyMoving",
    "J",
    "moving-light-sum",
    "massEnergy.pulseSumMoving",
  ] as const;
  const pRatioId = [
    "energyRatio",
    "1",
    "pulse-energy-ratio",
    "massEnergy.pulseEnergyRatio",
  ] as const;
  const dRatioId = [
    "frequencyRatio",
    "1",
    "doppler-frequency-ratio",
    "massEnergy.dopplerFrequencyRatio",
  ] as const;

  const refuse = (reason: string, condition: string): PulseEnergiesResult => {
    return Object.freeze({
      status: "outside-domain" as const,
      condition,
      reason,
      pulse1: asOutside(p1Id[0], p1Id[1], p1Id[2], p1Id[3], condition, reason),
      pulse2: asOutside(p2Id[0], p2Id[1], p2Id[2], p2Id[3], condition, reason),
      pulseSum: asOutside(sumId[0], sumId[1], sumId[2], sumId[3], condition, reason),
      pulse1Moving: Number.NaN,
      pulse2Moving: Number.NaN,
      pulseSumMoving: Number.NaN,
      lorentzFactor: Number.NaN,
      pulseEnergyRatio: asOutside(
        pRatioId[0],
        pRatioId[1],
        pRatioId[2],
        pRatioId[3],
        condition,
        reason,
      ),
      dopplerFrequencyRatio: asOutside(
        dRatioId[0],
        dRatioId[1],
        dRatioId[2],
        dRatioId[3],
        condition,
        reason,
      ),
      energyRatio: Number.NaN,
      dopplerRatio: Number.NaN,
      premise: LIGHT_ENERGY_TRANSFORMATION_PREMISE,
    });
  };

  if (![L, beta, phi].every(Number.isFinite)) {
    return refuse("Inputs must be finite real numbers.", "finite-input");
  }
  if (L <= 0) {
    return refuse("Emitted energy must be finite and positive.", "L > 0");
  }
  if (Math.abs(beta) >= 1) {
    return refuse("No inertial observer moves at or above the speed of light.", "|beta| < 1");
  }

  const {
    lorentzFactor,
    pulse1Moving,
    pulse2Moving,
    pulseSumMoving,
    pulseEnergyRatio,
    dopplerFrequencyRatio,
  } = evaluatePulseEnergies(L, beta, angleRad);

  return Object.freeze({
    status: "value" as const,
    pulse1: asValue(p1Id[0], p1Id[1], p1Id[2], p1Id[3], pulse1Moving),
    pulse2: asValue(p2Id[0], p2Id[1], p2Id[2], p2Id[3], pulse2Moving),
    pulseSum: asValue(sumId[0], sumId[1], sumId[2], sumId[3], pulseSumMoving),
    pulse1Moving,
    pulse2Moving,
    pulseSumMoving,
    lorentzFactor,
    pulseEnergyRatio: asValue(pRatioId[0], pRatioId[1], pRatioId[2], pRatioId[3], pulseEnergyRatio),
    dopplerFrequencyRatio: asValue(
      dRatioId[0],
      dRatioId[1],
      dRatioId[2],
      dRatioId[3],
      dopplerFrequencyRatio,
    ),
    energyRatio: pulseEnergyRatio,
    dopplerRatio: dopplerFrequencyRatio,
    premise: LIGHT_ENERGY_TRANSFORMATION_PREMISE,
  });
}

/**
 * Kernel function: evaluates the rest-frame and moving-frame energy balances (Paper 4, §1).
 * Rest frame balance: E0 - E1 = L
 * Moving frame balance: H0 - H1 = gamma * L
 */
export type MassEnergyLedgerSeed =
  | string
  | number
  | Readonly<{
      kind?: string;
      formula?: string;
      numericFrom?: string;
      id?: string;
      expr?: unknown;
    }>;

export type MassEnergyLedgerInit = Readonly<{
  restEnergyBefore?: MassEnergyLedgerSeed;
  movingEnergyBefore?: MassEnergyLedgerSeed;
  historicalMode?: boolean;
}>;

export type InitializedMassEnergyLedger = Readonly<{
  restBodyBefore: ScientificResult;
  restBodyAfter: ScientificResult;
  movingBodyBefore: ScientificResult;
  movingBodyAfter: ScientificResult;
}>;

/**
 * Validates and initializes the mass-energy ledger.
 *
 * Enforces the non-circularity doctrine (Paper 4 / AGENTS.md):
 * The mass-energy ledger must NEVER initialise a body's energy with Mc^2 or gamma Mc^2.
 * Rest energy and moving body energy on the historical route must remain symbolic (E₀, H₀).
 * Any attempt to seed the ledger with Mc^2 or gamma Mc^2 is rejected with an Error.
 */
export function initializeMassEnergyLedger(
  seed?: MassEnergyLedgerInit,
): InitializedMassEnergyLedger {
  const isNumericValue = (val: unknown): boolean => {
    if (val === undefined || val === null) return false;
    if (typeof val === "number" && Number.isFinite(val)) return true;
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed !== "" && !Number.isNaN(Number(trimmed))) return true;
    }
    if (typeof val === "object") {
      const rec = val as Record<string, unknown>;
      if (typeof rec.value === "number" && Number.isFinite(rec.value)) return true;
      if (rec.kind === "numeric" || rec.kind === "value") return true;
      if (typeof rec.numericFrom === "string") return true;
    }
    return false;
  };

  const isCircular = (val: unknown): boolean => {
    if (val === undefined || val === null) return false;
    if (typeof val === "string") {
      const lower = val.toLowerCase().replace(/[\s_*^·×-]/g, "");
      if (
        lower.includes("mc2") ||
        lower.includes("mc²") ||
        lower.includes("gammamc") ||
        lower.includes("γmc") ||
        lower.includes("mc^2")
      ) {
        return true;
      }
    }
    if (typeof val === "object") {
      const rec = val as Record<string, unknown>;
      if (rec.numericFrom === "mc2" || rec.numericFrom === "gamma-mc2") return true;
      if (typeof rec.formula === "string" && isCircular(rec.formula)) return true;
      if (typeof rec.id === "string" && isCircular(rec.id)) return true;
      if (typeof rec.kind === "string" && isCircular(rec.kind)) return true;
      if (typeof rec.expr === "string" && isCircular(rec.expr)) return true;
    }
    return false;
  };

  if (isCircular(seed?.restEnergyBefore) || isCircular(seed?.movingEnergyBefore)) {
    throw new MassEnergyError(
      "absolute-energy-not-admitted",
      "Circularity violation: the mass-energy ledger must NEVER initialise a body's energy with Mc^2 or gamma Mc^2.",
    );
  }

  if (seed?.historicalMode !== false) {
    if (isNumericValue(seed?.restEnergyBefore) || isNumericValue(seed?.movingEnergyBefore)) {
      throw new MassEnergyError(
        "absolute-energy-not-admitted",
        "Supplying a numeric absolute rest energy in the historical model is rejected. Rest and moving energies must remain symbolic.",
      );
    }
  }

  return Object.freeze({
    restBodyBefore: asSymbolic(
      "bodyEnergyRestBefore",
      "J",
      "rest-body-energy-before",
      "massEnergy.restBodyBefore",
      "E₀",
    ),
    restBodyAfter: asSymbolic(
      "bodyEnergyRestAfter",
      "J",
      "rest-body-energy-after",
      "massEnergy.restBodyAfter",
      "E₁",
    ),
    movingBodyBefore: asSymbolic(
      "bodyEnergyMovingBefore",
      "J",
      "moving-body-energy-before",
      "massEnergy.movingBodyBefore",
      "H₀",
    ),
    movingBodyAfter: asSymbolic(
      "bodyEnergyMovingAfter",
      "J",
      "moving-body-energy-after",
      "massEnergy.movingBodyAfter",
      "H₁",
    ),
  });
}

/**
 * Kernel function: evaluates the rest-frame and moving-frame energy balances (Paper 4, §1).
 * Rest frame balance: E0 - E1 = L
 * Moving frame balance: H0 - H1 = gamma * L
 */
export function evaluateLedgers(
  emittedEnergyRestFrame: number,
  frameSpeed: number,
  _emissionAngleRad: number,
  initialBodyEnergy?: MassEnergyLedgerSeed,
): Readonly<{
  restBalanceLight: number;
  movingBalanceLight: number;
  lorentzFactor: number;
}> {
  if (initialBodyEnergy !== undefined) {
    initializeMassEnergyLedger({ restEnergyBefore: initialBodyEnergy });
  }
  const g = 1 / Math.sqrt(1 - frameSpeed * frameSpeed);
  return Object.freeze({
    restBalanceLight: emittedEnergyRestFrame,
    movingBalanceLight: g * emittedEnergyRestFrame,
    lorentzFactor: g,
  });
}

/**
 * Kernel function: evaluates the subtraction move (H0 - E0) - (H1 - E1) and the resulting kinetic energy difference (Paper 4, §1).
 * Subtraction: (H0 - E0) - (H1 - E1) = L * (gamma - 1)
 * If premise === "unchanged": K0 - K1 = L * (gamma - 1)
 */
export function evaluateSubtraction(
  emittedEnergyRestFrame: number,
  frameSpeed: number,
  _emissionAngleRad: number,
  premise: Me01Premise = "unchanged",
): Readonly<{
  subtractionValue: number;
  lorentzFactor: number;
  kineticDifference: number | null;
  premise: Me01Premise;
}> {
  const g = 1 / Math.sqrt(1 - frameSpeed * frameSpeed);
  // Reuse the cancellation-free owner: gamma - 1 rounds to zero at walking speeds.
  const difference = gammaMinusOne(frameSpeed);
  if (difference.status !== "value") {
    throw new RangeError("Subtraction requires a finite subluminal observer speed.");
  }
  const sub = emittedEnergyRestFrame * difference.value;
  return Object.freeze({
    subtractionValue: sub,
    lorentzFactor: g,
    kineticDifference: premise === "unchanged" ? sub : null,
    premise,
  });
}

export type LedgersResult = Readonly<{
  status: "value" | "outside-domain";
  condition?: string;
  reason?: string;
  restBalance: ScientificResult;
  movingBalance: ScientificResult;
  restBalanceLight: number;
  movingBalanceLight: number;
  lorentzFactor: number;
}>;

export function ledgers(L: number, beta: number): LedgersResult {
  const restId = [
    "emittedEnergyRestFrame",
    "J",
    "rest-frame-balance",
    "massEnergy.restBalanceLight",
  ] as const;
  const movId = [
    "lightComplexEnergyMoving",
    "J",
    "moving-frame-balance",
    "massEnergy.movingBalanceLight",
  ] as const;

  if (!Number.isFinite(L) || !Number.isFinite(beta) || L <= 0 || Math.abs(beta) >= 1) {
    const condition = L <= 0 ? "L > 0" : "|beta| < 1";
    const reason =
      L <= 0 ? "Emitted energy must be positive." : "No inertial observer at |v| >= c.";
    return Object.freeze({
      status: "outside-domain" as const,
      condition,
      reason,
      restBalance: asOutside(restId[0], restId[1], restId[2], restId[3], condition, reason),
      movingBalance: asOutside(movId[0], movId[1], movId[2], movId[3], condition, reason),
      restBalanceLight: Number.NaN,
      movingBalanceLight: Number.NaN,
      lorentzFactor: Number.NaN,
    });
  }

  const { restBalanceLight, movingBalanceLight, lorentzFactor } = evaluateLedgers(L, beta, 0);
  return Object.freeze({
    status: "value" as const,
    restBalance: asValue(restId[0], restId[1], restId[2], restId[3], restBalanceLight),
    movingBalance: asValue(movId[0], movId[1], movId[2], movId[3], movingBalanceLight),
    restBalanceLight,
    movingBalanceLight,
    lorentzFactor,
  });
}

export type SubtractLedgersResult = Readonly<{
  status: "value" | "outside-domain";
  condition?: string;
  reason?: string;
  subtractionDifference: ScientificResult;
  differenceValue: number;
  lorentzFactor: number;
  cancellations: Me01Cancellations;
  operations: readonly string[];
}>;

export function subtractLedgers(
  L: number,
  beta: number,
  cancellations: Me01Cancellations = {
    angleFactors: true,
    internalEnergies: true,
    additiveConstant: true,
  },
): SubtractLedgersResult {
  const subId = [
    "kineticEnergyDifference",
    "J",
    "two-ledger-subtraction",
    "massEnergy.subtractionDifference",
  ] as const;

  if (!Number.isFinite(L) || !Number.isFinite(beta) || L <= 0 || Math.abs(beta) >= 1) {
    const condition = L <= 0 ? "L > 0" : "|beta| < 1";
    const reason =
      L <= 0 ? "Emitted energy must be positive." : "No inertial observer at |v| >= c.";
    return Object.freeze({
      status: "outside-domain" as const,
      condition,
      reason,
      subtractionDifference: asOutside(subId[0], subId[1], subId[2], subId[3], condition, reason),
      differenceValue: Number.NaN,
      lorentzFactor: Number.NaN,
      cancellations,
      operations: Object.freeze([]),
    });
  }

  const { subtractionValue, lorentzFactor } = evaluateSubtraction(L, beta, 0, "unchanged");
  const ops: string[] = [
    "Subtract rest-frame balance (E0 - E1 = L) from moving-frame balance (H0 - H1 = gamma * L)",
    "Group: (H0 - E0) - (H1 - E1) = L * (gamma - 1)",
  ];
  if (cancellations.angleFactors)
    ops.push("Cancel opposite-angle directional terms: cos(phi) - cos(phi) = 0");
  if (cancellations.internalEnergies)
    ops.push("Cancel unspecified internal energies via difference grouping");
  if (cancellations.additiveConstant)
    ops.push("Cancel identical additive constant C: (K0 + C) - (K1 + C) = K0 - K1");

  return Object.freeze({
    status: "value" as const,
    subtractionDifference: asValue(subId[0], subId[1], subId[2], subId[3], subtractionValue),
    differenceValue: subtractionValue,
    lorentzFactor,
    cancellations,
    operations: Object.freeze(ops),
  });
}

export type KineticIdentificationResult = Readonly<{
  status: "value" | "underdetermined" | "outside-domain";
  condition?: string;
  reason?: string;
  kineticEnergyDifference: ScientificResult;
  additiveEnergyConstant: ScientificResult;
  premise: PremiseObject;
  subtractionValue?: number;
  lorentzFactor?: number;
}>;

export function kineticIdentification(
  L: number,
  beta: number,
  premise: Me01Premise = "unchanged",
  seed?: MassEnergyLedgerInit,
): KineticIdentificationResult {
  if (seed !== undefined) {
    initializeMassEnergyLedger(seed);
  }

  const kinId = [
    "kineticEnergyDifference",
    "J",
    "kinetic-energy-difference",
    "massEnergy.kineticEnergyDifference",
  ] as const;
  const addConstId = [
    "additiveEnergyConstant",
    "J",
    "additive-energy-constant",
    "massEnergy.additiveEnergyConstant",
  ] as const;
  const premiseObj: PremiseObject = Object.freeze({
    ...ADDITIVE_CONSTANT_PREMISE,
    status: premise === "unchanged" ? ("asserted" as const) : ("relaxed" as const),
  });

  if (!Number.isFinite(L) || !Number.isFinite(beta) || L <= 0 || Math.abs(beta) >= 1) {
    const condition = L <= 0 ? "L > 0" : "|beta| < 1";
    const reason =
      L <= 0 ? "Emitted energy must be positive." : "No inertial observer at |v| >= c.";
    return Object.freeze({
      status: "outside-domain" as const,
      condition,
      reason,
      kineticEnergyDifference: asOutside(kinId[0], kinId[1], kinId[2], kinId[3], condition, reason),
      additiveEnergyConstant: asSymbolic(
        addConstId[0],
        addConstId[1],
        addConstId[2],
        addConstId[3],
        "C",
      ),
      premise: premiseObj,
      subtractionValue: Number.NaN,
      lorentzFactor: Number.NaN,
    });
  }

  const { subtractionValue, lorentzFactor } = evaluateSubtraction(L, beta, 0, premise);
  const addConst = asSymbolic(addConstId[0], addConstId[1], addConstId[2], addConstId[3], "C");

  if (premise === "relaxed") {
    return Object.freeze({
      status: "underdetermined" as const,
      kineticEnergyDifference: asUnderdetermined(
        kinId[0],
        kinId[1],
        kinId[2],
        kinId[3],
        "family:kinetic-difference-with-arbitrary-constant",
        ["additive-constant-invariance-under-emission"],
      ),
      additiveEnergyConstant: addConst,
      premise: premiseObj,
      subtractionValue,
      lorentzFactor,
    });
  }

  return Object.freeze({
    status: "value" as const,
    kineticEnergyDifference: asValue(kinId[0], kinId[1], kinId[2], kinId[3], subtractionValue),
    additiveEnergyConstant: addConst,
    premise: premiseObj,
    subtractionValue,
    lorentzFactor,
  });
}

/**
 * Evaluates the full ME-01 instrument state across both observer frames.
 * Adheres strictly to the non-circularity doctrine: internal energies E0, E1, H0, H1
 * are represented symbolically, never assigned numerical values or initialized with Mc^2.
 */
export function evaluateMe01(input: Me01Input): Me01Snapshot {
  if (input.initialBodyEnergy !== undefined) {
    initializeMassEnergyLedger({ restEnergyBefore: input.initialBodyEnergy });
  }
  const L = input.emittedEnergyRestFrame;
  const beta = input.frameSpeed;
  const angleInput = input.emissionAngle;
  const angleRad = input.angleUnit === "radians" ? angleInput : (angleInput * Math.PI) / 180;
  const c = input.speedOfLight ?? C_SI;
  const offsetDisplay = input.offsetDisplay ?? "symbolic";
  const premise = input.premise ?? "unchanged";
  const step = input.step ?? "subtraction-move";
  const cancellations =
    input.cancellations ??
    Object.freeze({
      angleFactors: true,
      internalEnergies: true,
      additiveConstant: true,
    });
  const notation = input.notation ?? "printed";

  const ids = {
    p1: ["lightComplexEnergyMoving", "J", "moving-light-pulse-1", "massEnergy.pulse1Moving"],
    p2: ["lightComplexEnergyMoving", "J", "moving-light-pulse-2", "massEnergy.pulse2Moving"],
    sum: ["lightComplexEnergyMoving", "J", "moving-light-sum", "massEnergy.pulseSumMoving"],
    pRatio: ["energyRatio", "1", "pulse-energy-ratio", "massEnergy.pulseEnergyRatio"],
    dRatio: ["frequencyRatio", "1", "doppler-frequency-ratio", "massEnergy.dopplerFrequencyRatio"],
    restBal: ["emittedEnergyRestFrame", "J", "rest-frame-balance", "massEnergy.restBalanceLight"],
    movBal: [
      "lightComplexEnergyMoving",
      "J",
      "moving-frame-balance",
      "massEnergy.movingBalanceLight",
    ],
    restBefore: [
      "bodyEnergyRestBefore",
      "J",
      "body-energy-rest-before",
      "massEnergy.restBodyBefore",
    ],
    restAfter: ["bodyEnergyRestAfter", "J", "body-energy-rest-after", "massEnergy.restBodyAfter"],
    movBefore: [
      "bodyEnergyMovingBefore",
      "J",
      "body-energy-moving-before",
      "massEnergy.movingBodyBefore",
    ],
    movAfter: [
      "bodyEnergyMovingAfter",
      "J",
      "body-energy-moving-after",
      "massEnergy.movingBodyAfter",
    ],
    sub: [
      "kineticEnergyDifference",
      "J",
      "two-ledger-subtraction",
      "massEnergy.subtractionDifference",
    ],
    kin: [
      "kineticEnergyDifference",
      "J",
      "kinetic-energy-difference",
      "massEnergy.kineticEnergyDifference",
    ],
    addConst: [
      "additiveEnergyConstant",
      "J",
      "additive-energy-constant",
      "massEnergy.additiveEnergyConstant",
    ],
  } as const;

  const refuse = (reason: string, condition: string): Me01Snapshot => {
    const out = (row: readonly [string, string, string, string]) =>
      asOutside(row[0], row[1], row[2], row[3], condition, reason);
    return Object.freeze({
      emittedEnergyRestFrame: L,
      frameSpeed: beta,
      emissionAngle: angleInput,
      angleRadians: angleRad,
      offsetDisplay,
      premise,
      step,
      cancellations,
      notation,
      speedOfLight: c,
      pulse1Moving: out(ids.p1),
      pulse2Moving: out(ids.p2),
      pulseSumMoving: out(ids.sum),
      pulseEnergyRatio: out(ids.pRatio),
      dopplerFrequencyRatio: out(ids.dRatio),
      restBalanceLight: out(ids.restBal),
      movingBalanceLight: out(ids.movBal),
      restBodyBefore: out(ids.restBefore),
      restBodyAfter: out(ids.restAfter),
      movingBodyBefore: out(ids.movBefore),
      movingBodyAfter: out(ids.movAfter),
      subtractionDifference: out(ids.sub),
      kineticEnergyDifference: out(ids.kin),
      additiveEnergyConstant: out(ids.addConst),
    });
  };

  if (![L, beta, angleInput, c].every(Number.isFinite)) {
    return refuse("Inputs must be finite real numbers.", "finite-input");
  }
  if (L <= 0) {
    return refuse("Emitted energy must be finite and positive.", "L > 0");
  }
  if (Math.abs(beta) >= 1) {
    return refuse("No inertial observer moves at or above the speed of light.", "|beta| < 1");
  }

  const {
    pulse1Moving: p1,
    pulse2Moving: p2,
    pulseSumMoving: pSum,
    pulseEnergyRatio: pRatio,
    dopplerFrequencyRatio: dRatio,
  } = evaluatePulseEnergies(L, beta, angleRad);

  const { restBalanceLight: rBal, movingBalanceLight: mBal } = evaluateLedgers(L, beta, angleRad);

  const { subtractionValue: subVal } = evaluateSubtraction(L, beta, angleRad, premise);

  const restBefore = asSymbolic(
    ids.restBefore[0],
    ids.restBefore[1],
    ids.restBefore[2],
    ids.restBefore[3],
    "E₀",
  );
  const restAfter = asSymbolic(
    ids.restAfter[0],
    ids.restAfter[1],
    ids.restAfter[2],
    ids.restAfter[3],
    "E₁",
  );
  const movBefore = asSymbolic(
    ids.movBefore[0],
    ids.movBefore[1],
    ids.movBefore[2],
    ids.movBefore[3],
    "H₀",
  );
  const movAfter = asSymbolic(
    ids.movAfter[0],
    ids.movAfter[1],
    ids.movAfter[2],
    ids.movAfter[3],
    "H₁",
  );
  const addConst = asSymbolic(
    ids.addConst[0],
    ids.addConst[1],
    ids.addConst[2],
    ids.addConst[3],
    "C",
  );

  const kinResult =
    premise === "unchanged"
      ? asValue(ids.kin[0], ids.kin[1], ids.kin[2], ids.kin[3], subVal)
      : asUnderdetermined(
          ids.kin[0],
          ids.kin[1],
          ids.kin[2],
          ids.kin[3],
          "family:kinetic-difference-with-arbitrary-constant",
          ["additive-constant-invariance-under-emission"],
        );

  return Object.freeze({
    emittedEnergyRestFrame: L,
    frameSpeed: beta,
    emissionAngle: angleInput,
    angleRadians: angleRad,
    offsetDisplay,
    premise,
    step,
    cancellations,
    notation,
    speedOfLight: c,
    pulse1Moving: asValue(ids.p1[0], ids.p1[1], ids.p1[2], ids.p1[3], p1),
    pulse2Moving: asValue(ids.p2[0], ids.p2[1], ids.p2[2], ids.p2[3], p2),
    pulseSumMoving: asValue(ids.sum[0], ids.sum[1], ids.sum[2], ids.sum[3], pSum),
    pulseEnergyRatio: asValue(ids.pRatio[0], ids.pRatio[1], ids.pRatio[2], ids.pRatio[3], pRatio),
    dopplerFrequencyRatio: asValue(
      ids.dRatio[0],
      ids.dRatio[1],
      ids.dRatio[2],
      ids.dRatio[3],
      dRatio,
    ),
    restBalanceLight: asValue(ids.restBal[0], ids.restBal[1], ids.restBal[2], ids.restBal[3], rBal),
    movingBalanceLight: asValue(ids.movBal[0], ids.movBal[1], ids.movBal[2], ids.movBal[3], mBal),
    restBodyBefore: restBefore,
    restBodyAfter: restAfter,
    movingBodyBefore: movBefore,
    movingBodyAfter: movAfter,
    subtractionDifference: asValue(ids.sub[0], ids.sub[1], ids.sub[2], ids.sub[3], subVal),
    kineticEnergyDifference: kinResult,
    additiveEnergyConstant: addConst,
  });
}

// ============================================================================
// ME-03: System boundary energy ledger with cited energy-source cards
// ============================================================================

export type Me03Boundary = "body-alone" | "radiation" | "combined-isolated-system";
export type Me03RadiationDisposition = "escapes" | "retained" | "partly-retained";
export type Me03Mode = "1905" | "four-momentum" | "box-1906";
export type Me03CardId =
  | "me-03-card-radium"
  | "me-03-card-sun"
  | "me-03-card-coal"
  | "me-03-card-candle"
  | "me-03-card-bulb"
  | "me-03-heated-sealed-box"
  | "me-03-sealed-lamp-and-mirror";

export type Me03PulseSystem = "single-pulse" | "two-collinear" | "two-opposite";

export type EnergySourceCardBoundary = Readonly<{
  systemBefore: string;
  systemAfter: string;
  matterCrossesBoundary: Readonly<{ crosses: boolean; note: string }>;
  radiation: Readonly<{ disposition: "escapes" | "retained" | "partly-retained"; note: string }>;
  referenceFrame: string;
  energyFigure: Readonly<{
    quantityId: string;
    value: number;
    unit: string;
    kind:
      | "decay-energy-per-event"
      | "radiated-power"
      | "heat-of-combustion"
      | "heat-release-rate"
      | "electrical-input"
      | "stated-transfer";
    citationId: string;
  }>;
  closedButNotIsolated: Readonly<{ value: boolean; note: string }>;
}>;

export type EnergySourceCard = Readonly<{
  id: Me03CardId;
  label: string;
  description: string;
  citation: string;
  boundary: EnergySourceCardBoundary;
  energyJoules: number;
  massChangeKg: number;
  massChangeSigned: ScientificResult;
  massChangeFormatted: string;
  energyFormatted: string;
}>;

export const ME03_CARD_IDS: readonly Me03CardId[] = Object.freeze([
  "me-03-card-radium",
  "me-03-card-sun",
  "me-03-card-coal",
  "me-03-card-candle",
  "me-03-card-bulb",
  "me-03-heated-sealed-box",
  "me-03-sealed-lamp-and-mirror",
]);

/**
 * Computes the energy and mass change for a specified system boundary and radiation disposition.
 * In 1905 mode, body energies are never initialized as Mc^2 (non-circularity doctrine).
 */
export function evaluateBoundaryLedger(
  boundary: Me03Boundary,
  disposition: Me03RadiationDisposition,
  emittedEnergy: number,
  inputEnergy = 0,
  set?: ConstantSet,
): Readonly<{
  energyChange: ScientificResult;
  massChange: ScientificResult;
  radiationEnergyChange: ScientificResult;
  radiationMassChange: ScientificResult;
  systemEnergyChange: ScientificResult;
  systemMassChange: ScientificResult;
}> {
  const c = constantValue(set ?? getConstantSet("modern-si-2019"), "speedOfLight").value;
  const cSq = c * c;

  // Body alone
  const bodyDeltaE = -emittedEnergy;
  const bodyDeltaM = -emittedEnergy / cSq;

  // Radiation alone
  const radDeltaE = emittedEnergy;

  // Combined isolated system
  let sysDeltaE = 0;
  let sysDeltaM = 0;

  if (disposition === "retained") {
    if (inputEnergy > 0) {
      sysDeltaE = inputEnergy;
      sysDeltaM = inputEnergy / cSq;
    } else {
      sysDeltaE = 0;
      sysDeltaM = 0;
    }
  } else {
    // Escapes: if we look at the combined isolated container holding body + light, before light leaves outer boundary it is 0
    sysDeltaE = 0;
    sysDeltaM = 0;
  }

  let activeDeltaE: number;
  let activeMassResult: ScientificResult;

  if (boundary === "body-alone") {
    activeDeltaE = bodyDeltaE;
    activeMassResult = asValue(
      "massChange",
      "kg",
      "mass-change",
      "massEnergy.boundaryLedger",
      bodyDeltaM,
    );
  } else if (boundary === "radiation") {
    activeDeltaE = radDeltaE;
    activeMassResult = asNotApplicable(
      "massChange",
      "kg",
      "mass-change",
      "massEnergy.boundaryLedger",
      "Free radiation is not assigned an inertial rest mass in 1905 kinematics.",
    );
  } else {
    activeDeltaE = sysDeltaE;
    activeMassResult = asValue(
      "massChange",
      "kg",
      "mass-change",
      "massEnergy.boundaryLedger",
      sysDeltaM,
    );
  }

  return Object.freeze({
    energyChange: asValue(
      "energyChange",
      "J",
      "energy-change",
      "massEnergy.boundaryLedger",
      activeDeltaE,
    ),
    massChange: activeMassResult,
    radiationEnergyChange: asValue(
      "radiationEnergyChange",
      "J",
      "radiation-energy-change",
      "massEnergy.boundaryLedger",
      radDeltaE,
    ),
    radiationMassChange: asNotApplicable(
      "radiationMassChange",
      "kg",
      "radiation-mass-change",
      "massEnergy.boundaryLedger",
      "Free radiation is not assigned an inertial rest mass in 1905 kinematics.",
    ),
    systemEnergyChange: asValue(
      "systemEnergyChange",
      "J",
      "system-energy-change",
      "massEnergy.boundaryLedger",
      sysDeltaE,
    ),
    systemMassChange: asValue(
      "systemMassChange",
      "kg",
      "system-mass-change",
      "massEnergy.boundaryLedger",
      sysDeltaM,
    ),
  });
}

export type SystemLedgerInput = Readonly<{
  include?:
    | readonly ("body" | "radiation")[]
    | "body-alone"
    | "radiation"
    | "combined-isolated"
    | "combined-isolated-system";
  retained?: boolean;
  emittedEnergy?: number;
  inputEnergy?: number;
  constantSet?: ConstantSet;
}>;

export function systemLedger(input: SystemLedgerInput = {}) {
  let boundary: Me03Boundary = "body-alone";
  if (typeof input.include === "string") {
    if (input.include === "combined-isolated" || input.include === "combined-isolated-system") {
      boundary = "combined-isolated-system";
    } else if (input.include === "radiation") {
      boundary = "radiation";
    } else {
      boundary = "body-alone";
    }
  } else if (Array.isArray(input.include)) {
    const hasBody = input.include.includes("body");
    const hasRad = input.include.includes("radiation");
    if (hasBody && hasRad) {
      boundary = "combined-isolated-system";
    } else if (hasRad) {
      boundary = "radiation";
    } else {
      boundary = "body-alone";
    }
  }
  const disposition: Me03RadiationDisposition = input.retained ? "retained" : "escapes";
  return evaluateBoundaryLedger(
    boundary,
    disposition,
    input.emittedEnergy ?? 1.0,
    input.inputEnergy ?? 0,
    input.constantSet,
  );
}

/**
 * Modern four-momentum mode (labeled later formalism, model identity four-momentum-modern).
 * - Single pulse: invariant mass 0
 * - Two collinear pulses: invariant mass 0
 * - Two equal opposite pulses with total energy L: invariant mass L/c^2
 */
export function evaluateFourMomentum(
  pulseSystem: Me03PulseSystem,
  totalEnergy: number,
  set?: ConstantSet,
): ScientificResult {
  const c = constantValue(set ?? getConstantSet("modern-si-2019"), "speedOfLight").value;
  const cSq = c * c;

  if (pulseSystem === "single-pulse" || pulseSystem === "two-collinear") {
    return asValue("invariantMass", "kg", "invariant-mass", "massEnergy.fourMomentum", 0);
  }

  // Two equal opposite pulses: total energy L, zero spatial momentum -> m = L/c^2
  return asValue(
    "invariantMass",
    "kg",
    "invariant-mass",
    "massEnergy.fourMomentum",
    totalEnergy / cSq,
  );
}

export function invariantMass(
  pulseSystem: Me03PulseSystem,
  totalEnergy = 1.0,
  set?: ConstantSet,
): ScientificResult {
  return evaluateFourMomentum(pulseSystem, totalEnergy, set);
}

/**
 * Light complex volume transformation (Paper 3, §8):
 * V* / V = gamma * (1 - beta * cos(phi))
 * For a ray transverse in the stationary frame (cos(phi) = 0): V* / V = gamma (expands!).
 * For a ray transverse in the moving frame (cos(phi*) = 0 <=> cos(phi) = beta): V* / V = 1/gamma.
 */
export function evaluateLightComplexVolumeRatio(beta: number, cosPhiStationary: number): number {
  const g = 1 / Math.sqrt(Math.max(1e-12, 1 - beta * beta));
  return g * (1 - beta * cosPhiStationary);
}

/**
 * Material volume contraction along motion: V* / V = 1 / gamma = sqrt(1 - beta^2).
 */
export function evaluateMaterialVolumeRatio(beta: number): number {
  return Math.sqrt(Math.max(0, 1 - beta * beta));
}

export function validateEnergySourceCard(card: Partial<EnergySourceCard>): void {
  if (!card.citation || typeof card.citation !== "string" || card.citation.trim() === "") {
    throw new MassEnergyError(
      "card-citation-missing",
      `Card ${card.id ?? "unknown"} has no citation. Every energy source card must cite a verifiable source.`,
    );
  }
}

/**
 * Generates the full definition and dynamic calculation for each cited energy-source card.
 */
export function evaluateEnergySourceCard(
  cardOrId: Me03CardId | Partial<EnergySourceCard>,
  set?: ConstantSet,
): EnergySourceCard {
  if (typeof cardOrId === "object" && cardOrId !== null) {
    validateEnergySourceCard(cardOrId);
    if ("id" in cardOrId && typeof cardOrId.id === "string" && !cardOrId.boundary) {
      return evaluateEnergySourceCard(cardOrId.id as Me03CardId, set);
    }
    return cardOrId as EnergySourceCard;
  }
  const cardId = cardOrId as Me03CardId;
  const c = constantValue(set ?? getConstantSet("modern-si-2019"), "speedOfLight").value;
  const cSq = c * c;
  const eCharge = 1.602176634e-19; // J/eV

  switch (cardId) {
    case "me-03-card-radium": {
      const qMev = 4.871;
      const energyJ = qMev * 1e6 * eCharge;
      const massChangeKgPerDecay = energyJ / cSq;

      const boundary: EnergySourceCardBoundary = Object.freeze({
        systemBefore: "Radium-226 nucleus at rest",
        systemAfter: "Radon-222 nucleus and alpha particle after heat emission",
        matterCrossesBoundary: Object.freeze({
          crosses: false,
          note: "The radon-222 nucleus and the alpha particle both stay inside the boundary.",
        }),
        radiation: Object.freeze({
          disposition: "escapes" as const,
          note: "The decay energy leaves as heat.",
        }),
        referenceFrame: "Rest frame of parent nucleus",
        energyFigure: Object.freeze({
          quantityId: "decayEnergy",
          value: qMev,
          unit: "MeV",
          kind: "decay-energy-per-event" as const,
          citationId: "nuclear-data-eval-radium",
        }),
        closedButNotIsolated: Object.freeze({
          value: true,
          note: "Nothing material crosses this boundary, but the system is not isolated: energy still enters or leaves it.",
        }),
      });

      return Object.freeze({
        id: "me-03-card-radium",
        label: "Radium-226 alpha decay",
        description: "Nuclear alpha decay Q = 4.871 MeV per event.",
        citation:
          "NuDat 3.0 / Evaluated Nuclear Structure Data File (ENSDF), Brookhaven National Laboratory (226Ra Q-alpha = 4.871 MeV).",
        boundary,
        energyJoules: energyJ,
        massChangeKg: massChangeKgPerDecay,
        massChangeSigned: asValue(
          "massChange",
          "kg",
          "mass-change",
          "massEnergy.cards",
          -massChangeKgPerDecay,
        ),
        massChangeFormatted: "0.0052292 u/decay (5.229 mg/mol)",
        energyFormatted: "4.871 MeV per decay",
      });
    }

    case "me-03-card-sun": {
      const luminosityW = 3.828e26;
      const massLossKgPerSec = luminosityW / cSq;

      const boundary: EnergySourceCardBoundary = Object.freeze({
        systemBefore: "The Sun before one second of emission",
        systemAfter: "The Sun after one second of radiant emission",
        matterCrossesBoundary: Object.freeze({
          crosses: true,
          note: "Neutrinos and the solar wind carry matter and energy that the radiated power figure does not include.",
        }),
        radiation: Object.freeze({
          disposition: "escapes" as const,
          note: "Radiated power leaves the solar boundary.",
        }),
        referenceFrame: "Solar rest frame",
        energyFigure: Object.freeze({
          quantityId: "solarLuminosity",
          value: luminosityW,
          unit: "W",
          kind: "radiated-power" as const,
          citationId: "iau-2015-resolution-b3",
        }),
        closedButNotIsolated: Object.freeze({
          value: false,
          note: "System exchanges matter across its boundary.",
        }),
      });

      return Object.freeze({
        id: "me-03-card-sun",
        label: "The Sun (radiated luminosity)",
        description: "Solar radiant energy output of 3.828 × 10^26 W.",
        citation:
          "IAU 2015 Resolution B3 on Recommended Nominal Conversion Constants (Nominal Solar Luminosity = 3.828 × 10^26 W).",
        boundary,
        energyJoules: luminosityW,
        massChangeKg: massLossKgPerSec,
        massChangeSigned: asValue(
          "massChange",
          "kg",
          "mass-change",
          "massEnergy.cards",
          -massLossKgPerSec,
        ),
        massChangeFormatted: "4.259 × 10^9 kg/s (4.3 million tonnes/s)",
        energyFormatted: "3.828 × 10^26 W",
      });
    }

    case "me-03-card-coal": {
      const qCoalMidJ = 30.0e6; // 30 MJ/kg illustrative midpoint
      const massLossKg = qCoalMidJ / cSq;

      const boundary: EnergySourceCardBoundary = Object.freeze({
        systemBefore: "Coal and required oxygen before combustion",
        systemAfter: "Combustion ash and gases after heat release",
        matterCrossesBoundary: Object.freeze({
          crosses: true,
          note: "Oxygen enters and combustion products leave.",
        }),
        radiation: Object.freeze({
          disposition: "escapes" as const,
          note: "The released heat leaves the furnace boundary.",
        }),
        referenceFrame: "Furnace rest frame",
        energyFigure: Object.freeze({
          quantityId: "heatOfCombustion",
          value: 30.0,
          unit: "MJ/kg",
          kind: "heat-of-combustion" as const,
          citationId: "crc-handbook-combustion-coal",
        }),
        closedButNotIsolated: Object.freeze({
          value: false,
          note: "System exchanges matter across its boundary.",
        }),
      });

      return Object.freeze({
        id: "me-03-card-coal",
        label: "Burning coal",
        description: "Chemical combustion enthalpy 24–35 MJ per kilogram of coal.",
        citation:
          "CRC Handbook of Chemistry and Physics, 104th ed. (Higher heating values of coals: 24–35 MJ/kg).",
        boundary,
        energyJoules: qCoalMidJ,
        massChangeKg: massLossKg,
        massChangeSigned: asValue(
          "massChange",
          "kg",
          "mass-change",
          "massEnergy.cards",
          -massLossKg,
        ),
        massChangeFormatted: "(2.670–3.894) × 10^-10 kg (0.27–0.39 µg/kg)",
        energyFormatted: "24–35 MJ/kg (30 MJ nominal)",
      });
    }

    case "me-03-card-candle": {
      const powerW = 80.0;
      const energyJ = powerW * 3600; // 288 kJ in 1 hour
      const massLossKg = energyJ / cSq;

      const boundary: EnergySourceCardBoundary = Object.freeze({
        systemBefore: "Candle and ambient oxygen before 1 hour of burning",
        systemAfter: "Remaining candle wax and gaseous products after 1 hour",
        matterCrossesBoundary: Object.freeze({
          crosses: true,
          note: "The wax leaves as combustion products, which is matter, not the mass-energy effect.",
        }),
        radiation: Object.freeze({
          disposition: "escapes" as const,
          note: "Radiated heat and light leave the room.",
        }),
        referenceFrame: "Room rest frame",
        energyFigure: Object.freeze({
          quantityId: "candleHeatRate",
          value: powerW,
          unit: "W",
          kind: "heat-release-rate" as const,
          citationId: "sundstrom-candle-flame-power",
        }),
        closedButNotIsolated: Object.freeze({
          value: false,
          note: "System exchanges matter across its boundary.",
        }),
      });

      return Object.freeze({
        id: "me-03-card-candle",
        label: "A Burning Candle",
        description: "Heat-release rate near 80 W for one hour (288 kJ).",
        citation:
          "Sundström (1995), 'Heat release from candles', Fire Safety Science 4 (Nominal candle power ~ 80 W).",
        boundary,
        energyJoules: energyJ,
        massChangeKg: massLossKg,
        massChangeSigned: asValue(
          "massChange",
          "kg",
          "mass-change",
          "massEnergy.cards",
          -massLossKg,
        ),
        massChangeFormatted: "3.20 ng (in 1 hour)",
        energyFormatted: "80 W (288 kJ/h)",
      });
    }

    case "me-03-card-bulb": {
      const energyJ = 100 * 365.25 * 86400; // 3.15576 × 10^9 J
      const massLossKg = energyJ / cSq;

      const boundary: EnergySourceCardBoundary = Object.freeze({
        systemBefore: "Light bulb at the start of one Julian year",
        systemAfter: "Light bulb at the end of one Julian year",
        matterCrossesBoundary: Object.freeze({
          crosses: false,
          note: "Energy arrives through the wires and leaves as light and heat without matter transfer.",
        }),
        radiation: Object.freeze({
          disposition: "escapes" as const,
          note: "Light and heat radiate away continuously.",
        }),
        referenceFrame: "Lamp rest frame",
        energyFigure: Object.freeze({
          quantityId: "bulbElectricalEnergy",
          value: 3.15576e9,
          unit: "J",
          kind: "electrical-input" as const,
          citationId: "si-joule-definition-bulb",
        }),
        closedButNotIsolated: Object.freeze({
          value: true,
          note: "Nothing material crosses this boundary, but the system is not isolated: energy still enters or leaves it.",
        }),
      });

      return Object.freeze({
        id: "me-03-card-bulb",
        label: "A 100 W light bulb for a year",
        description: "100 W continuous electrical operation for one Julian year (3.156 × 10^9 J).",
        citation:
          "BIPM SI Brochure (9th ed., 2019) / Standard Julian Year: 365.25 days = 31,557,600 s; 100 W × 31,557,600 s = 3.15576 × 10^9 J.",
        boundary,
        energyJoules: energyJ,
        massChangeKg: massLossKg,
        massChangeSigned: asValue(
          "massChange",
          "kg",
          "mass-change",
          "massEnergy.cards",
          -massLossKg,
        ),
        massChangeFormatted: "35.1 µg (in 1 year)",
        energyFormatted: "100 W × 1 Julian year (3.156 × 10^9 J)",
      });
    }

    case "me-03-heated-sealed-box": {
      const energyJ = 1.0;
      const massChangeKg = energyJ / cSq;

      const boundary: EnergySourceCardBoundary = Object.freeze({
        systemBefore: "Sealed enclosure with internal heater before electrical input",
        systemAfter: "Sealed enclosure with internal heater after absorbing input energy",
        matterCrossesBoundary: Object.freeze({
          crosses: false,
          note: "Energy enters through leads while no matter crosses the sealed boundary.",
        }),
        radiation: Object.freeze({
          disposition: "retained" as const,
          note: "All thermal radiation is absorbed and contained inside the enclosure.",
        }),
        referenceFrame: "Box rest frame",
        energyFigure: Object.freeze({
          quantityId: "electricalInput",
          value: energyJ,
          unit: "J",
          kind: "stated-transfer" as const,
          citationId: "einstein-1906-ann-phys-20-627",
        }),
        closedButNotIsolated: Object.freeze({
          value: true,
          note: "Nothing material crosses this boundary, but the system is not isolated: energy still enters or leaves it.",
        }),
      });

      return Object.freeze({
        id: "me-03-heated-sealed-box",
        label: "A heated sealed box",
        description: "Energy enters via electrical leads and is absorbed internally.",
        citation:
          "Einstein, A. (1906), 'Das Prinzip von der Erhaltung der Schwerpunktsbewegung und die Trägheit der Energie', Ann. Phys. 20, 627–633.",
        boundary,
        energyJoules: energyJ,
        massChangeKg,
        massChangeSigned: asValue(
          "massChange",
          "kg",
          "mass-change",
          "massEnergy.cards",
          massChangeKg,
        ),
        massChangeFormatted: "+E / c^2 (+1.11 × 10^-17 kg/J)",
        energyFormatted: "Declared electrical input Ein",
      });
    }

    case "me-03-sealed-lamp-and-mirror": {
      const energyJ = 1.0;

      const boundary: EnergySourceCardBoundary = Object.freeze({
        systemBefore: "Charged battery, cold lamp, and mirrors inside sealed box",
        systemAfter: "Discharged battery and absorbed radiation inside sealed box",
        matterCrossesBoundary: Object.freeze({
          crosses: false,
          note: "Battery, lamp, and mirror are all enclosed inside the sealed box.",
        }),
        radiation: Object.freeze({
          disposition: "retained" as const,
          note: "The radiation is emitted and absorbed inside the enclosure.",
        }),
        referenceFrame: "Box rest frame",
        energyFigure: Object.freeze({
          quantityId: "lampEmittedEnergy",
          value: energyJ,
          unit: "J",
          kind: "stated-transfer" as const,
          citationId: "einstein-1906-ann-phys-20-627",
        }),
        closedButNotIsolated: Object.freeze({
          value: true,
          note: "Nothing material crosses this boundary, but the system is not isolated: energy still enters or leaves it.",
        }),
      });

      return Object.freeze({
        id: "me-03-sealed-lamp-and-mirror",
        label: "A sealed lamp and mirror",
        description: "Combined isolated system where light is emitted and absorbed internally.",
        citation:
          "Einstein, A. (1906), 'Das Prinzip von der Erhaltung der Schwerpunktsbewegung und die Trägheit der Energie', Ann. Phys. 20, 627–633.",
        boundary,
        energyJoules: energyJ,
        massChangeKg: 0,
        massChangeSigned: asValue("massChange", "kg", "mass-change", "massEnergy.cards", 0),
        massChangeFormatted: "0 (enclosure mass unchanged)",
        energyFormatted: "Emitted energy L (internal transfer)",
      });
    }
  }
}

export type Me03Input = Readonly<{
  boundary?: Me03Boundary;
  disposition?: Me03RadiationDisposition;
  emittedEnergy?: number;
  inputEnergy?: number;
  cardId?: Me03CardId;
  mode?: Me03Mode;
  pulseSystem?: Me03PulseSystem;
  constantSetId?: string;
}>;

export type Me03Snapshot = Readonly<{
  boundary: Me03Boundary;
  disposition: Me03RadiationDisposition;
  emittedEnergy: number;
  inputEnergy: number;
  cardId: Me03CardId;
  mode: Me03Mode;
  pulseSystem: Me03PulseSystem;
  speedOfLight: number;
  energyChange: ScientificResult;
  massChange: ScientificResult;
  radiationEnergyChange: ScientificResult;
  radiationMassChange: ScientificResult;
  systemEnergyChange: ScientificResult;
  systemMassChange: ScientificResult;
  invariantMass: ScientificResult;
  card: EnergySourceCard;
  cards: Readonly<Record<Me03CardId, EnergySourceCard>>;
  boundaryFacts: EnergySourceCardBoundary;
}>;

/**
 * Main reference evaluator for ME-03.
 */
export function evaluateMe03(input: Me03Input = {}): Me03Snapshot {
  const boundary = input.boundary ?? "body-alone";
  const disposition = input.disposition ?? "escapes";
  const emittedEnergy =
    Number.isFinite(input.emittedEnergy) && (input.emittedEnergy ?? 1) > 0
      ? (input.emittedEnergy ?? 1)
      : 1;
  const inputEnergy =
    Number.isFinite(input.inputEnergy) && (input.inputEnergy ?? 0) >= 0
      ? (input.inputEnergy ?? 0)
      : 0;
  const cardId = input.cardId ?? "me-03-card-radium";
  const mode = input.mode ?? "1905";
  const pulseSystem = input.pulseSystem ?? "two-opposite";
  const set = getConstantSet(input.constantSetId ?? "modern-si-2019");
  const c = constantValue(set, "speedOfLight").value;

  const ledger = evaluateBoundaryLedger(boundary, disposition, emittedEnergy, inputEnergy, set);
  const invariantMass = evaluateFourMomentum(pulseSystem, emittedEnergy, set);

  const card = evaluateEnergySourceCard(cardId, set);
  const cards: Record<Me03CardId, EnergySourceCard> = {
    "me-03-card-radium": evaluateEnergySourceCard("me-03-card-radium", set),
    "me-03-card-sun": evaluateEnergySourceCard("me-03-card-sun", set),
    "me-03-card-coal": evaluateEnergySourceCard("me-03-card-coal", set),
    "me-03-card-candle": evaluateEnergySourceCard("me-03-card-candle", set),
    "me-03-card-bulb": evaluateEnergySourceCard("me-03-card-bulb", set),
    "me-03-heated-sealed-box": evaluateEnergySourceCard("me-03-heated-sealed-box", set),
    "me-03-sealed-lamp-and-mirror": evaluateEnergySourceCard("me-03-sealed-lamp-and-mirror", set),
  };

  return Object.freeze({
    boundary,
    disposition,
    emittedEnergy,
    inputEnergy,
    cardId,
    mode,
    pulseSystem,
    speedOfLight: c,
    energyChange: ledger.energyChange,
    massChange: ledger.massChange,
    radiationEnergyChange: ledger.radiationEnergyChange,
    radiationMassChange: ledger.radiationMassChange,
    systemEnergyChange: ledger.systemEnergyChange,
    systemMassChange: ledger.systemMassChange,
    invariantMass,
    card,
    cards: Object.freeze(cards),
    boundaryFacts: card.boundary,
  });
}

// ============================================================================
// Photon in a Box (Einstein 1906, Ann. Phys. 20, 627–633)
// ============================================================================

export type PhotonInBoxInput = Readonly<{
  M?: number; // Box mass in kg, default 1.0
  ell?: number; // Box length in m, default 1.0
  E?: number; // Emitted pulse energy in J, default 1.0
  assignLightMass?: boolean; // default true
  domainBound?: number; // default 1e-3
  set?: ConstantSet;
}>;

export type PhotonInBoxResult = Readonly<{
  status: "value" | "outside-domain";
  condition?: string;
  reason?: string;
  boxMass: ScientificResult;
  boxLength: ScientificResult;
  pulseEnergy: ScientificResult;
  pulseFlightTime: ScientificResult;
  recoilSpeed: ScientificResult;
  pulseMomentum: ScientificResult;
  boxDisplacement: ScientificResult;
  centerOfMassShift: ScientificResult;
  comShift: number;
  displacement: number;
  recoilSpeedValue: number;
  flightTimeValue: number;
  lightMassAssigned: ScientificResult;
  domainRatio: number;
  domainBound: number;
  approximations: readonly string[];
  exactRationalCenterOfMassShift: Readonly<{
    numerator: bigint;
    denominator: bigint;
    isExactlyZero: boolean;
  }>;
}>;

function toBigIntRational(n: number): { num: bigint; den: bigint } {
  if (Number.isInteger(n)) return { num: BigInt(n), den: 1n };
  const s = n.toString();
  if (!s.includes("e") && !s.includes("E")) {
    const parts = s.split(".");
    const fracStr = parts[1] ?? "";
    const decDigits = BigInt(fracStr.length);
    const den = 10n ** decDigits;
    const num = BigInt(s.replace(".", ""));
    return { num, den };
  }
  const str = n.toExponential(16);
  const parts = str.split("e");
  const mantissaStr = parts[0] ?? "0";
  const expStr = parts[1] ?? "0";
  const exp = BigInt(expStr);
  const mantissaParts = mantissaStr.split(".");
  const fracStr = mantissaParts[1] ?? "";
  const fracDigits = BigInt(fracStr.length);
  const mantissaInt = BigInt(mantissaStr.replace(".", ""));
  if (exp >= fracDigits) {
    return { num: mantissaInt * 10n ** (exp - fracDigits), den: 1n };
  }
  return { num: mantissaInt, den: 10n ** (fracDigits - exp) };
}

/**
 * 1906 photon-in-a-box thought experiment (Einstein, Ann. Phys. 20, 627-633).
 * Evaluates the nonrelativistic recoil, pulse flight time, displacement, and center-of-mass shift.
 */
export function evaluatePhotonBox(input: PhotonInBoxInput = {}): PhotonInBoxResult {
  const M = input.M ?? 1.0;
  const ell = input.ell ?? 1.0;
  const E = input.E ?? 1.0;
  const assignLightMass = input.assignLightMass ?? true;
  const domainBound = input.domainBound ?? 1e-3;
  const set = input.set ?? getConstantSet("modern-si-2019");
  const c = constantValue(set, "speedOfLight").value;
  const cSq = c * c;

  const refuse = (reason: string, condition: string): PhotonInBoxResult => {
    return Object.freeze({
      status: "outside-domain" as const,
      condition,
      reason,
      boxMass: asOutside("boxMass", "kg", "box-mass", "massEnergy.box", condition, reason),
      boxLength: asOutside("boxLength", "m", "box-length", "massEnergy.box", condition, reason),
      pulseEnergy: asOutside(
        "emittedEnergyRestFrame",
        "J",
        "emitted-energy",
        "massEnergy.box",
        condition,
        reason,
      ),
      pulseFlightTime: asOutside(
        "pulseFlightTime",
        "s",
        "pulse-flight-time",
        "massEnergy.box",
        condition,
        reason,
      ),
      recoilSpeed: asOutside(
        "recoilSpeed",
        "m/s",
        "recoil-speed",
        "massEnergy.box",
        condition,
        reason,
      ),
      pulseMomentum: asOutside(
        "pulseMomentum",
        "kg·m/s",
        "pulse-momentum",
        "massEnergy.box",
        condition,
        reason,
      ),
      boxDisplacement: asOutside(
        "boxDisplacement",
        "m",
        "box-displacement",
        "massEnergy.box",
        condition,
        reason,
      ),
      centerOfMassShift: asOutside(
        "centerOfMassShift",
        "m",
        "center-of-mass-shift",
        "massEnergy.box",
        condition,
        reason,
      ),
      comShift: Number.NaN,
      displacement: Number.NaN,
      recoilSpeedValue: Number.NaN,
      flightTimeValue: Number.NaN,
      lightMassAssigned: asOutside(
        "lightMassAssigned",
        "kg",
        "light-mass-assigned",
        "massEnergy.box",
        condition,
        reason,
      ),
      domainRatio: Number.isFinite(E) && Number.isFinite(M) && M > 0 ? E / (M * cSq) : Number.NaN,
      domainBound,
      approximations: Object.freeze(["nonrelativistic-box", "flight-time-l-over-c", "rigid-box"]),
      exactRationalCenterOfMassShift: Object.freeze({
        numerator: 0n,
        denominator: 1n,
        isExactlyZero: false,
      }),
    });
  };

  if (![M, ell, E].every(Number.isFinite) || M <= 0 || ell <= 0 || E <= 0) {
    return refuse(
      "Box mass, box length, and pulse energy must be positive and finite.",
      "M > 0, ell > 0, E > 0",
    );
  }

  const domainRatio = E / (M * cSq);
  if (domainRatio > domainBound) {
    return refuse(
      "The nonrelativistic recoil approximation and neglected change in pulse transit time are no longer small when E / (M * c^2) exceeds the declared bound.",
      `E / (M * c^2) <= ${domainBound}`,
    );
  }

  const recoilSpeed = E / (M * c);
  const pulseFlightTime = ell / c;
  const pulseMomentum = E / c;
  const displacement = -(E * ell) / (M * cSq);
  const lightMass = E / cSq;
  const comShift = assignLightMass ? 0 : displacement;

  const rationalShift = (() => {
    if (assignLightMass) {
      return Object.freeze({
        numerator: 0n,
        denominator: 1n,
        isExactlyZero: true,
      });
    }
    const rE = toBigIntRational(E);
    const rEll = toBigIntRational(ell);
    const rM = toBigIntRational(M);
    const cBig = BigInt(Math.round(c));
    const cSqBig = cBig * cBig;

    const num = -(rE.num * rEll.num * rM.den);
    const den = rE.den * rEll.den * rM.num * cSqBig;
    return Object.freeze({
      numerator: num,
      denominator: den,
      isExactlyZero: num === 0n,
    });
  })();

  return Object.freeze({
    status: "value" as const,
    boxMass: asValue("boxMass", "kg", "box-mass", "massEnergy.box", M),
    boxLength: asValue("boxLength", "m", "box-length", "massEnergy.box", ell),
    pulseEnergy: asValue("emittedEnergyRestFrame", "J", "emitted-energy", "massEnergy.box", E),
    pulseFlightTime: asValue(
      "pulseFlightTime",
      "s",
      "pulse-flight-time",
      "massEnergy.box",
      pulseFlightTime,
    ),
    recoilSpeed: asValue("recoilSpeed", "m/s", "recoil-speed", "massEnergy.box", recoilSpeed),
    pulseMomentum: asValue(
      "pulseMomentum",
      "kg·m/s",
      "pulse-momentum",
      "massEnergy.box",
      pulseMomentum,
    ),
    boxDisplacement: asValue(
      "boxDisplacement",
      "m",
      "box-displacement",
      "massEnergy.box",
      displacement,
    ),
    centerOfMassShift: asValue(
      "centerOfMassShift",
      "m",
      "center-of-mass-shift",
      "massEnergy.box",
      comShift,
    ),
    comShift,
    displacement,
    recoilSpeedValue: recoilSpeed,
    flightTimeValue: pulseFlightTime,
    lightMassAssigned: asValue(
      "lightMassAssigned",
      "kg",
      "light-mass-assigned",
      "massEnergy.box",
      assignLightMass ? lightMass : 0,
    ),
    domainRatio,
    domainBound,
    approximations: Object.freeze(["nonrelativistic-box", "flight-time-l-over-c", "rigid-box"]),
    exactRationalCenterOfMassShift: rationalShift,
  });
}

export function photonInBox(input: PhotonInBoxInput = {}): PhotonInBoxResult {
  return evaluatePhotonBox(input);
}
