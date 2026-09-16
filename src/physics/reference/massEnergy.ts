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
import { constantValue, getConstantSet } from "./constants.ts";
import { gamma, gammaMinusOne } from "./kinematics.ts";

export const OWNER_ID = "massEnergy";
export const PRINTED_V_SQUARED_ERG_PER_GRAM = 9e20;
export const PRINTED_FACTOR_WORDING =
  "the printed factor is 0.1385 percent larger than the modern c^2";
export const MASS_ENERGY_PRINTED_FACTOR_SCENARIO = "mass-energy-printed-factor";
export const C_SI = constantValue(getConstantSet("modern-si-2019"), "speedOfLight").value;
export const C_CGS = C_SI * 100;

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

export type PrintedMassConversion = Readonly<{
  scenarioId: typeof MASS_ENERGY_PRINTED_FACTOR_SCENARIO;
  emittedEnergyErg: number;
  printed: Readonly<{
    value: number;
    unit: "g";
    constantSetId: "einstein-1905-mass-energy-printed";
  }>;
  modern: Readonly<{ value: number; unit: "g"; constantSetId: "modern-si-2019" }>;
  comparison: Readonly<{
    ratioModernToPrinted: number;
    wording: typeof PRINTED_FACTOR_WORDING;
  }>;
}>;

/**
 * Printed-factor readout. The view must display `comparison.wording` and must
 * not compute a percentage from the two masses. The two constant sets are
 * never combined into one number.
 */
export function printedMassConversion(input: { emittedEnergyErg: number }): PrintedMassConversion {
  const L = input.emittedEnergyErg;
  if (!Number.isFinite(L) || L <= 0) {
    throw new RangeError("printedMassConversion needs a finite positive energy in erg.");
  }
  const c2 = C_CGS * C_CGS;
  const printed = L / PRINTED_V_SQUARED_ERG_PER_GRAM;
  const modern = L / c2;
  return Object.freeze({
    scenarioId: MASS_ENERGY_PRINTED_FACTOR_SCENARIO,
    emittedEnergyErg: L,
    printed: Object.freeze({
      value: printed,
      unit: "g" as const,
      constantSetId: "einstein-1905-mass-energy-printed" as const,
    }),
    modern: Object.freeze({
      value: modern,
      unit: "g" as const,
      constantSetId: "modern-si-2019" as const,
    }),
    comparison: Object.freeze({
      ratioModernToPrinted: PRINTED_V_SQUARED_ERG_PER_GRAM / c2,
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

/**
 * Kernel function: evaluates the energy balances for rest and moving systems (Paper 4, §1).
 * Rest frame balance: E0 - E1 = L
 * Moving frame balance: H0 - H1 = gamma * L
 */
export function evaluateLedgers(
  emittedEnergyRestFrame: number,
  frameSpeed: number,
  _emissionAngleRad: number,
): Readonly<{
  restBalanceLight: number;
  movingBalanceLight: number;
  lorentzFactor: number;
}> {
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
  const sub = emittedEnergyRestFrame * (g - 1);
  return Object.freeze({
    subtractionValue: sub,
    lorentzFactor: g,
    kineticDifference: premise === "unchanged" ? sub : null,
    premise,
  });
}

/**
 * Evaluates the full ME-01 instrument state across both observer frames.
 * Adheres strictly to the non-circularity doctrine: internal energies E0, E1, H0, H1
 * are represented symbolically, never assigned numerical values or initialized with Mc^2.
 */
export function evaluateMe01(input: Me01Input): Me01Snapshot {
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
