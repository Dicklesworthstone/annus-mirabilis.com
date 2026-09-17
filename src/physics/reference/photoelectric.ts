/**
 * Photoelectric reference evaluator (am-lq-08-photoelectric-va5a).
 * Implements Einstein's 1905 light-quantum photoelectric relations (paper 1, §8),
 * stopping potentials, quantum/emission rates, collector current sweep characteristics,
 * cathode luminescence threshold, and historical printed checks.
 *
 * Epistemic boundary:
 * A simulator programmed with a threshold does not prove nature has a threshold;
 * it shows the deductive consequences of quantum transfer and escape work assumptions.
 * Independent experiments (e.g. Millikan 1916) test whether those assumptions
 * accurately describe the physical world.
 */

import type { DomainKind } from "../../experiments/results/types.ts";
import { type ConstantSet, constantValue, getConstantSet } from "./constants.ts";

export type PhotoelectricOk<T> = Readonly<{
  status: "value";
  value: T;
  unit?: string | undefined;
}>;

export type PhotoelectricNotApplicable = Readonly<{
  status: "not-applicable";
  reason: string;
}>;

export type PhotoelectricOutsideDomain = Readonly<{
  status: "outside-domain";
  condition: string;
  domainKind: DomainKind;
  reason: string;
}>;

export type PhotoelectricUnderdetermined = Readonly<{
  status: "underdetermined";
  compatibleFamily: string;
  neededInformation: readonly string[];
  upperBound?: number | undefined;
  unit?: string | undefined;
  citation?: string | undefined;
}>;

export type PhotoelectricResult<T> =
  | PhotoelectricOk<T>
  | PhotoelectricNotApplicable
  | PhotoelectricOutsideDomain
  | PhotoelectricUnderdetermined;

export function ok<T>(value: T, unit?: string): PhotoelectricOk<T> {
  return Object.freeze({ status: "value", value, unit });
}

export function notApplicable(reason: string): PhotoelectricNotApplicable {
  return Object.freeze({ status: "not-applicable", reason });
}

export function outsideDomain(
  condition: string,
  domainKind: DomainKind,
  reason: string,
): PhotoelectricOutsideDomain {
  return Object.freeze({ status: "outside-domain", condition, domainKind, reason });
}

export function underdetermined(
  compatibleFamily: string,
  neededInformation: readonly string[],
  extra?: Readonly<{ upperBound?: number; unit?: string; citation?: string }>,
): PhotoelectricUnderdetermined {
  return Object.freeze({
    status: "underdetermined",
    compatibleFamily,
    neededInformation: Object.freeze([...neededInformation]),
    ...(extra?.upperBound !== undefined ? { upperBound: extra.upperBound } : {}),
    ...(extra?.unit !== undefined ? { unit: extra.unit } : {}),
    ...(extra?.citation !== undefined ? { citation: extra.citation } : {}),
  });
}

function getPlanckConstant(set?: ConstantSet): number {
  const activeSet = set ?? getConstantSet("modern-si-2019");
  return constantValue(activeSet, "planckConstant").value;
}

function getElementaryCharge(set?: ConstantSet): number {
  const activeSet = set ?? getConstantSet("modern-si-2019");
  return constantValue(activeSet, "elementaryCharge").value;
}

/**
 * Energy of a single light quantum: E_q = h * nu (in Joules).
 */
export function quantumEnergy(nu: number, set?: ConstantSet): PhotoelectricResult<number> {
  if (!Number.isFinite(nu)) {
    return outsideDomain("nonfinite-frequency", "input", "Frequency must be a finite number.");
  }
  if (nu <= 0) {
    return outsideDomain(
      "nonpositive-frequency",
      "physical",
      "Frequency must be strictly positive.",
    );
  }
  const h = getPlanckConstant(set);
  return ok(h * nu, "J");
}

/**
 * Energy of a single light quantum in electron-volts: E_q = (h / e) * nu.
 */
export function quantumEnergyEv(nu: number, set?: ConstantSet): PhotoelectricResult<number> {
  const res = quantumEnergy(nu, set);
  if (res.status !== "value") return res;
  const e = getElementaryCharge(set);
  return ok(res.value / e, "eV");
}

/**
 * Threshold frequency nu_0 = Phi / h (in Hz), given work function in Joules.
 */
export function thresholdFrequency(
  workFunctionJoules: number,
  set?: ConstantSet,
): PhotoelectricResult<number> {
  if (!Number.isFinite(workFunctionJoules)) {
    return outsideDomain(
      "nonfinite-work-function",
      "input",
      "Work function must be a finite number.",
    );
  }
  if (workFunctionJoules < 0) {
    return outsideDomain("negative-work-function", "physical", "Work function cannot be negative.");
  }
  const h = getPlanckConstant(set);
  return ok(workFunctionJoules / h, "Hz");
}

/**
 * Threshold frequency nu_0 = Phi_eV / (h/e) (in Hz), given work function in eV.
 */
export function thresholdFrequencyFromEv(
  workFunctionEv: number,
  set?: ConstantSet,
): PhotoelectricResult<number> {
  const e = getElementaryCharge(set);
  return thresholdFrequency(workFunctionEv * e, set);
}

export type EnergyTransferMode = "complete" | "partial";

/**
 * Maximum kinetic energy of emitted photoelectrons: K_max = h * nu - Phi (in Joules).
 *
 * Epistemic rule:
 * When nu < nu_0, K_max is NOT negative or zero; it is `not-applicable`
 * with reason "no emitted electron in this model".
 * Under partial transfer, returns `underdetermined` with upperBound = h * nu - Phi.
 */
export function kMax(
  nu: number,
  workFunctionJoules: number,
  set?: ConstantSet,
  transferModel: EnergyTransferMode = "complete",
): PhotoelectricResult<number> {
  if (!Number.isFinite(nu)) {
    return outsideDomain("nonfinite-frequency", "input", "Frequency must be a finite number.");
  }
  if (nu <= 0) {
    return outsideDomain(
      "nonpositive-frequency",
      "physical",
      "Frequency must be strictly positive.",
    );
  }
  if (!Number.isFinite(workFunctionJoules)) {
    return outsideDomain(
      "nonfinite-work-function",
      "input",
      "Work function must be a finite number.",
    );
  }
  if (workFunctionJoules < 0) {
    return outsideDomain("negative-work-function", "physical", "Work function cannot be negative.");
  }

  const h = getPlanckConstant(set);
  const eq = h * nu;

  if (eq < workFunctionJoules) {
    return notApplicable("no emitted electron in this model");
  }

  if (transferModel === "partial") {
    return underdetermined(
      "partial-energy-transfer-bound",
      ["single-quantum-transfer-fraction"],
      {
        upperBound: eq - workFunctionJoules,
        unit: "J",
        citation: "Pi * E + P' <= R * beta * nu",
      },
    );
  }

  return ok(eq - workFunctionJoules, "J");
}

/**
 * Maximum kinetic energy in electron-volts: K_max / e = (h/e)*nu - Phi_eV.
 */
export function kMaxEv(
  nu: number,
  workFunctionEv: number,
  set?: ConstantSet,
  transferModel: EnergyTransferMode = "complete",
): PhotoelectricResult<number> {
  const e = getElementaryCharge(set);
  const res = kMax(nu, workFunctionEv * e, set, transferModel);
  if (res.status === "underdetermined") {
    const extra: { upperBound?: number; unit?: string; citation?: string } = { unit: "eV" };
    if (res.upperBound !== undefined) extra.upperBound = res.upperBound / e;
    if (res.citation !== undefined) extra.citation = res.citation;
    return underdetermined(
      res.compatibleFamily,
      res.neededInformation,
      extra,
    );
  }
  if (res.status !== "value") return res;
  return ok(res.value / e, "eV");
}

/**
 * Stopping potential magnitude: V_s = K_max / e = (h * nu - Phi) / e (in Volts).
 *
 * Epistemic rule:
 * When nu < nu_0, stopping potential is `not-applicable` with reason
 * "no emitted electron in this model".
 * Under partial transfer, returns `underdetermined` with upperBound = (h * nu - Phi) / e.
 */
export function stoppingPotentialMagnitude(
  nu: number,
  workFunctionJoules: number,
  set?: ConstantSet,
  transferModel: EnergyTransferMode = "complete",
): PhotoelectricResult<number> {
  const kResult = kMax(nu, workFunctionJoules, set, transferModel);
  if (kResult.status === "underdetermined") {
    const e = getElementaryCharge(set);
    const extra: { upperBound?: number; unit?: string; citation?: string } = { unit: "V" };
    if (kResult.upperBound !== undefined) extra.upperBound = kResult.upperBound / e;
    if (kResult.citation !== undefined) extra.citation = kResult.citation;
    return underdetermined(
      kResult.compatibleFamily,
      kResult.neededInformation,
      extra,
    );
  }
  if (kResult.status !== "value") return kResult;
  const e = getElementaryCharge(set);
  return ok(kResult.value / e, "V");
}

/**
 * Stopping potential magnitude given work function in eV.
 */
export function stoppingPotentialFromEv(
  nu: number,
  workFunctionEv: number,
  set?: ConstantSet,
  transferModel: EnergyTransferMode = "complete",
): PhotoelectricResult<number> {
  const e = getElementaryCharge(set);
  return stoppingPotentialMagnitude(nu, workFunctionEv * e, set, transferModel);
}

/**
 * Full signed energy budget report for display and diagnostics.
 */
export function signedEnergyBudget(
  nu: number,
  workFunctionJoules: number,
  set?: ConstantSet,
  transferModel: EnergyTransferMode = "complete",
): Readonly<{
  quantumEnergy: number;
  workFunction: number;
  excessJoules: number;
  excessEv: number;
  emitted: boolean;
  kMax: PhotoelectricResult<number>;
}> {
  const h = getPlanckConstant(set);
  const e = getElementaryCharge(set);
  const eq = h * nu;
  const excess = eq - workFunctionJoules;
  const emitted = excess >= 0 && nu > 0 && workFunctionJoules >= 0;
  return Object.freeze({
    quantumEnergy: eq,
    workFunction: workFunctionJoules,
    excessJoules: excess,
    excessEv: excess / e,
    emitted,
    kMax: kMax(nu, workFunctionJoules, set, transferModel),
  });
}

/**
 * Incident quantum rate: N_dot_q = P_opt / (h * nu) (in photons/s).
 *
 * Energy vs. rate distinction:
 * Power P_opt changes N_dot_q and N_dot_e linearly, but leaves K_max and V_s bitwise unchanged.
 * Frequency nu changes K_max linearly and changes N_dot_q as 1/nu at fixed power.
 */
export function quantumRate(
  incidentPowerWatts: number,
  nu: number,
  set?: ConstantSet,
): PhotoelectricResult<number> {
  if (!Number.isFinite(incidentPowerWatts)) {
    return outsideDomain("nonfinite-power", "input", "Power must be a finite number.");
  }
  if (incidentPowerWatts < 0) {
    return outsideDomain(
      "negative-power",
      "physical",
      "Incident optical power cannot be negative.",
    );
  }
  if (!Number.isFinite(nu)) {
    return outsideDomain("nonfinite-frequency", "input", "Frequency must be a finite number.");
  }
  if (nu <= 0) {
    return outsideDomain(
      "nonpositive-frequency",
      "physical",
      "Frequency must be strictly positive.",
    );
  }

  const h = getPlanckConstant(set);
  const rate = incidentPowerWatts / (h * nu);
  return ok(rate, "s^-1");
}

/**
 * Photoelectron emission rate: N_dot_e = eta_q * N_dot_q (in electrons/s).
 *
 * When nu < nu_0, emission rate is 0.
 */
export function emissionRate(
  incidentPowerWatts: number,
  nu: number,
  workFunctionJoules: number,
  quantumEfficiency: number,
  set?: ConstantSet,
): PhotoelectricResult<number> {
  if (!Number.isFinite(quantumEfficiency)) {
    return outsideDomain(
      "nonfinite-quantum-efficiency",
      "input",
      "Quantum efficiency must be a finite number.",
    );
  }
  if (quantumEfficiency < 0 || quantumEfficiency > 1) {
    return outsideDomain(
      "invalid-quantum-efficiency",
      "model",
      "Quantum efficiency must be in the range [0, 1].",
    );
  }

  const qRateRes = quantumRate(incidentPowerWatts, nu, set);
  if (qRateRes.status !== "value") return qRateRes;

  const h = getPlanckConstant(set);
  if (h * nu < workFunctionJoules) {
    return ok(0, "s^-1");
  }

  return ok(quantumEfficiency * qRateRes.value, "s^-1");
}

export type ElectronDistributionModel = "none" | "all-at-kmax" | "uniform";

/**
 * Collector photocurrent I(U_c) in Amperes.
 *
 * Determined regimes:
 * - When nu < nu_0: I = 0 for all U_c.
 * - When nu >= nu_0:
 *   - For U_c >= 0 (accelerating / neutral): saturation current I_sat = e * N_dot_e.
 *   - For U_c <= -V_s (full retarding): I = 0.
 *   - For -V_s < U_c < 0:
 *     - If distributionModel === "all-at-kmax": I = I_sat.
 *     - If distributionModel === "uniform": I = I_sat * (1 - e*|U_c|/K_max).
 *     - If distributionModel === "none": underdetermined.
 */
export function photocurrent(
  incidentPowerWatts: number,
  nu: number,
  workFunctionJoules: number,
  quantumEfficiency: number,
  collectorPotentialVolts: number,
  set?: ConstantSet,
  distributionModel: ElectronDistributionModel = "none",
): PhotoelectricResult<number> {
  if (!Number.isFinite(collectorPotentialVolts)) {
    return outsideDomain(
      "nonfinite-collector-potential",
      "input",
      "Collector potential must be finite.",
    );
  }

  const eRateRes = emissionRate(incidentPowerWatts, nu, workFunctionJoules, quantumEfficiency, set);
  if (eRateRes.status !== "value") return eRateRes;

  const e = getElementaryCharge(set);
  const iSat = e * eRateRes.value;

  if (eRateRes.value === 0) {
    return ok(0, "A");
  }

  const vsRes = stoppingPotentialMagnitude(nu, workFunctionJoules, set);
  if (vsRes.status !== "value") {
    return ok(0, "A");
  }
  const vs = vsRes.value;

  if (collectorPotentialVolts >= 0) {
    return ok(iSat, "A");
  }

  if (collectorPotentialVolts <= -vs) {
    return ok(0, "A");
  }

  if (distributionModel === "all-at-kmax") {
    return ok(iSat, "A");
  }

  if (distributionModel === "uniform") {
    const fraction = 1 - Math.abs(collectorPotentialVolts) / vs;
    return ok(iSat * Math.max(0, Math.min(1, fraction)), "A");
  }

  return underdetermined("retarded-photoelectron-current", [
    "electron-energy-distribution-in-emitter",
    "collector-geometry",
  ]);
}

/**
 * Sweep of collector potential evaluating photocurrent across a voltage range.
 */
export function collectorSweep(
  incidentPowerWatts: number,
  nu: number,
  workFunctionJoules: number,
  quantumEfficiency: number,
  potentialRange: Readonly<{ min: number; max: number; steps: number }>,
  set?: ConstantSet,
  distributionModel: ElectronDistributionModel = "none",
): readonly Readonly<{
  collectorPotential: number;
  result: PhotoelectricResult<number>;
}>[] {
  const { min, max, steps } = potentialRange;
  const clampedSteps = Math.max(2, Math.floor(steps));
  const points: { collectorPotential: number; result: PhotoelectricResult<number> }[] = [];
  const delta = (max - min) / (clampedSteps - 1);

  for (let i = 0; i < clampedSteps; i++) {
    const uc = min + i * delta;
    const res = photocurrent(
      incidentPowerWatts,
      nu,
      workFunctionJoules,
      quantumEfficiency,
      uc,
      set,
      distributionModel,
    );
    points.push(Object.freeze({ collectorPotential: uc, result: res }));
  }

  return Object.freeze(points);
}

export type StoppingPoint = Readonly<{
  frequency: number;
  stoppingPotential: number;
}>;

export type StoppingLinePoints = readonly StoppingPoint[] &
  Readonly<{
    slope: number;
    intercept: number;
    thresholdFrequency: number;
  }>;

/**
 * Theoretical stopping potential line V_s(nu) = (h/e)*nu - (Phi/e).
 * Only evaluated for nu >= nu_0.
 * Returns array of points with bitwise exact slope h/e and intercept -Phi/e.
 */
export function stoppingLine(
  workFunctionJoules: number,
  nuRange: Readonly<{ min: number; max: number; steps: number }>,
  set?: ConstantSet,
): StoppingLinePoints {
  const h = getPlanckConstant(set);
  const e = getElementaryCharge(set);
  const slope = h / e;
  const intercept = -workFunctionJoules / e;

  const threshRes = thresholdFrequency(workFunctionJoules, set);
  if (threshRes.status !== "value") {
    const empty: StoppingPoint[] = [];
    return Object.freeze(
      Object.assign(empty, { slope, intercept, thresholdFrequency: 0 }),
    ) as unknown as StoppingLinePoints;
  }
  const nu0 = threshRes.value;

  const { min, max, steps } = nuRange;
  const clampedSteps = Math.max(2, Math.floor(steps));
  const effectiveMin = Math.max(min, nu0);
  if (effectiveMin > max) {
    const empty: StoppingPoint[] = [];
    return Object.freeze(
      Object.assign(empty, { slope, intercept, thresholdFrequency: nu0 }),
    ) as unknown as StoppingLinePoints;
  }

  const points: StoppingPoint[] = [];
  const delta = (max - effectiveMin) / (clampedSteps - 1);

  for (let i = 0; i < clampedSteps; i++) {
    const freq = effectiveMin + i * delta;
    const vsRes = stoppingPotentialMagnitude(freq, workFunctionJoules, set);
    if (vsRes.status === "value") {
      points.push(Object.freeze({ frequency: freq, stoppingPotential: vsRes.value }));
    }
  }

  return Object.freeze(
    Object.assign(points, { slope, intercept, thresholdFrequency: nu0 }),
  ) as unknown as StoppingLinePoints;
}

/**
 * Cathode luminescence minimum potential (paper 1, §7):
 * Accelerating potential required for an impinging electron to excite emission of frequency nu.
 * U_min = (h * nu - Phi) / e or h * nu / e.
 */
export function cathodeLuminescenceMinimumPotential(
  nu: number,
  workFunctionJoules: number,
  set?: ConstantSet,
): PhotoelectricResult<number> {
  if (!Number.isFinite(nu) || nu <= 0) {
    return outsideDomain("invalid-frequency", "physical", "Frequency must be strictly positive.");
  }
  const h = getPlanckConstant(set);
  const e = getElementaryCharge(set);
  const uMin = (h * nu - workFunctionJoules) / e;
  return ok(Math.max(0, uMin), "V");
}

/**
 * Converts optical frequency to human-readable spectral band label and approximate hex color.
 */
export function visibleColor(nu: number): Readonly<{
  band: string;
  wavelengthNm: number;
  hexColor: string;
}> {
  const c = 2.99792458e8;
  const lambdaM = c / nu;
  const lambdaNm = lambdaM * 1e9;

  let band = "visible";
  let hexColor = "#888888";

  if (lambdaNm < 380) {
    band = "ultraviolet";
    hexColor = "#7B1FA2";
  } else if (lambdaNm < 450) {
    band = "violet";
    hexColor = "#5C6BC0";
  } else if (lambdaNm < 495) {
    band = "blue";
    hexColor = "#1E88E5";
  } else if (lambdaNm < 570) {
    band = "green";
    hexColor = "#43A047";
  } else if (lambdaNm < 590) {
    band = "yellow";
    hexColor = "#FDD835";
  } else if (lambdaNm < 620) {
    band = "orange";
    hexColor = "#FB8C00";
  } else if (lambdaNm <= 750) {
    band = "red";
    hexColor = "#E53935";
  } else {
    band = "infrared";
    hexColor = "#8D6E63";
  }

  return Object.freeze({ band, wavelengthNm: lambdaNm, hexColor });
}

/**
 * Historical regression check: Einstein 1905 paper 1, §8.
 *
 * Representation A:
 * Printed gram-equivalent form:
 *   R = 8.31e7 erg/(mol K)
 *   beta = 4.866e-11 K s
 *   E = 9.6e3 emu (gram-equivalent charge)
 *   nu = 1.03e15 s^-1 (ultraviolet light from spark source)
 *   P_prime = 0 (escape work per gram-equivalent neglected for order-of-magnitude check)
 *
 * Calculated stopping potential:
 *   Pi = (R * beta * nu) / E = (8.31e7 * 4.866e-11 * 1.03e15) / 9.6e3
 *      = 4.33852025e8 abV = 4.3385 V.
 *   Einstein printed: "ca. 4.3 Volt".
 *
 * Representation B:
 * Documented modern alternative in ESU:
 *   Pi = 4.3057 V.
 */
export type EinsteinPrintedStoppingCheckResult = Readonly<{
  printedRepresentation: "representation-a";
  transcriptionStatus: "pending";
  transcriptionPendingReason: string;
  representationA: Readonly<{
    molarGasConstantErg: number;
    modernMolarGasConstantErg: number;
    wienBetaSecDeg: number;
    gramEquivalentChargeEmu: number;
    frequencyHz: number;
    workFunctionPerGramEquivalent: number;
    stoppingPotentialAbV: number;
    stoppingPotentialVolts: number;
    stoppingPotentialModernRVolts: number;
    slopeVsPerHz: number;
    modernSlopeVsPerHz: number;
    printedText: string;
    unitSystem: "emu-cgs";
    isPrinted: true;
  }>;
  representationB: Readonly<{
    elementaryChargeEsu: number;
    avogadroN: number;
    conventionalConversionVoltsPerStatvolt: number;
    historicalConversionVoltsPerStatvolt: number;
    stoppingPotentialVolts: number;
    stoppingPotentialVoltsConventional: number;
    stoppingPotentialVoltsHistorical300: number;
    isPrinted: false;
    label: string;
    description: string;
  }>;
  documentedAlternatives: readonly Readonly<{
    quantityId: string;
    value: number;
    printedRepresentation: string;
    reason: string;
  }>[];
  suspectedTypographicalError: Readonly<{
    comparisonWitnessPrintedText: string;
    numericalConventionVolts: string;
    provenanceReference: string;
    note: string;
  }>;
  adversarialSlips: Readonly<{
    chargeEmuSlipE96e4Volts: number;
    chargeEsuSlipEps44e10Volts: number;
    reason: "transcription-slip";
  }>;
  readoutStatements: Readonly<{
    neglectStatement: string;
    notNamedMetalStatement: string;
    hypotheticalComparison: Readonly<{
      frequencyHz: number;
      hypotheticalWorkFunctionEv: number;
      quantumEnergyEv: number;
      stoppingPotentialVolts: number;
      label: "hypothetical";
    }>;
  }>;
  historicalNote: string;
}>;

/**
 * Historical regression check: Einstein 1905 paper 1, §8.
 *
 * Representation A:
 * Printed gram-equivalent form:
 *   R = 8.31e7 erg/(mol K)
 *   beta = 4.866e-11 K s
 *   E = 9.6e3 emu (gram-equivalent charge)
 *   nu = 1.03e15 s^-1 (ultraviolet light from spark source)
 *   P_prime = 0 (escape work per gram-equivalent neglected for order-of-magnitude check)
 *
 * Calculated stopping potential:
 *   Pi = (R * beta * nu) / E = (8.31e7 * 4.866e-11 * 1.03e15) / 9.6e3
 *      = 4.3384951875e8 abV = 4.3385 V.
 *   Einstein printed: "ca. 4,3 Volt".
 *
 * Representation B:
 * Documented modern alternative in ESU:
 *   Pi = 4.3057 V (conventional 299.792458 V/statV) or 4.3087 V (historical 300 V/statV).
 */
export function einsteinPrintedStoppingCheck(): EinsteinPrintedStoppingCheckResult {
  const R = 8.31e7; // erg / (mol K)
  const R_modern = 8.314e7; // erg / (mol K)
  const beta = 4.866e-11; // K s
  const E_emu = 9.6e3; // emu / mol
  const nu = 1.03e15; // s^-1
  const P_prime = 0;

  // Modern reference values for slope comparison
  const h_modern = 6.62607015e-34;
  const e_modern = 1.602176634e-19;
  const modernSlope = h_modern / e_modern;

  // Pi in abvolts (1 abV = 10^-8 V)
  const piAbV = (R * beta * nu - P_prime) / E_emu;
  const piV = piAbV * 1e-8;
  const piModernRV = (((R_modern * beta * nu - P_prime) / E_emu) * 1e-8);
  const slope = ((R * beta) / E_emu) * 1e-8;

  // Representation B: ESU calculation
  const eps = 4.7e-10; // esu
  const N_A = 6.17e23; // Avogadro
  const k_B = R / N_A;
  const h_esu = k_B * beta;
  const hnu_erg = h_esu * nu;
  const vStatvolt = hnu_erg / eps;
  const vConv = vStatvolt * 299.792458;
  const vHist300 = vStatvolt * 300;

  // Adversarial slips
  const slipE96e4 = (((R * beta * nu) / 9.6e4) * 1e-8);
  const slipEps44e10 = (hnu_erg / 4.4e-10) * 299.792458;

  // Live hypothetical comparison at 1.03e15 Hz with hypothetical Phi = 2.0 eV
  const hypQuantumEnergyEv = (h_modern * nu) / e_modern;
  const hypWorkFunctionEv = 2.0;
  const hypVs = hypQuantumEnergyEv - hypWorkFunctionEv;

  const neglectStatement =
    "Einstein sets P' = 0 as a deliberate neglect of escape work for order-of-magnitude " +
    "comparison against Lenard's spark-potential observations, not as a physical prediction for a named metal.";
  const notNamedMetalStatement =
    "This is not a prediction for any named metal; any real substance has P' > 0, " +
    "so its stopping potential at this frequency is lower by exactly the amount the work function contributes.";

  return Object.freeze({
    printedRepresentation: "representation-a" as const,
    transcriptionStatus: "pending" as const,
    transcriptionPendingReason:
      "Pinned facsimile for paper 1 is not reviewed in this repository yet; historical scenario reports not-available until verification.",
    representationA: Object.freeze({
      molarGasConstantErg: R,
      modernMolarGasConstantErg: R_modern,
      wienBetaSecDeg: beta,
      gramEquivalentChargeEmu: E_emu,
      frequencyHz: nu,
      workFunctionPerGramEquivalent: P_prime,
      stoppingPotentialAbV: piAbV,
      stoppingPotentialVolts: piV,
      stoppingPotentialModernRVolts: piModernRV,
      slopeVsPerHz: slope,
      modernSlopeVsPerHz: modernSlope,
      printedText: "ca. 4,3 Volt",
      unitSystem: "emu-cgs" as const,
      isPrinted: true as const,
    }),
    representationB: Object.freeze({
      elementaryChargeEsu: eps,
      avogadroN: N_A,
      conventionalConversionVoltsPerStatvolt: 299.792458,
      historicalConversionVoltsPerStatvolt: 300,
      stoppingPotentialVolts: vConv,
      stoppingPotentialVoltsConventional: vConv,
      stoppingPotentialVoltsHistorical300: vHist300,
      isPrinted: false as const,
      label: "not printed; documented alternative",
      description: "Documented alternative electrostatic CGS representation.",
    }),
    documentedAlternatives: Object.freeze([
      Object.freeze({
        quantityId: "stoppingPotentialMagnitude",
        value: vConv,
        printedRepresentation: "not-printed-documented-alternative",
        reason: "not printed; documented alternative",
      }),
    ]),
    suspectedTypographicalError: Object.freeze({
      comparisonWitnessPrintedText: "Π·10^7 = 4.3 Volt",
      numericalConventionVolts: "Π·10^-8 V",
      provenanceReference: "docs/provenance/ap-17-132.md",
      note:
        "The comparison witness prints 'Π·10^7 = 4.3 Volt'; if the facsimile shows that exponent, " +
        "docs/provenance/ap-17-132.md records a suspected typographical error, the source face keeps the original, " +
        "and the numerical binding uses the stated convention Π·10^-8 volts.",
    }),
    adversarialSlips: Object.freeze({
      chargeEmuSlipE96e4Volts: slipE96e4,
      chargeEsuSlipEps44e10Volts: slipEps44e10,
      reason: "transcription-slip" as const,
    }),
    readoutStatements: Object.freeze({
      neglectStatement,
      notNamedMetalStatement,
      hypotheticalComparison: Object.freeze({
        frequencyHz: nu,
        hypotheticalWorkFunctionEv: hypWorkFunctionEv,
        quantumEnergyEv: hypQuantumEnergyEv,
        stoppingPotentialVolts: hypVs,
        label: "hypothetical" as const,
      }),
    }),
    historicalNote: neglectStatement,
  });
}

function getBoltzmannConstant(set?: ConstantSet): number {
  const activeSet = set ?? getConstantSet("modern-si-2019");
  return constantValue(activeSet, "boltzmannConstant").value;
}

// ---- Fluorescence Energy Budget & Weak-Illumination Rates (Paper 1, §7, LQ-07) ----

export type FluorescenceRegime =
  | "standard-stokes"
  | "deviation-multi-quantum"
  | "deviation-non-wien"
  | "modern-thermal";

export type FluorescenceChannels = "light-plus-heat" | "light-only";

export type FluorescenceBudgetInput = Readonly<{
  nu1: number; // Incident frequency (Hz)
  nu2: number; // Proposed emitted frequency (Hz)
  regime?: FluorescenceRegime | undefined;
  multiQuantumK?: number | undefined; // k >= 1 (default 1)
  sourceTemperatureK?: number | undefined; // T_src in K (for deviation case 2)
  bodyTemperatureK?: number | undefined; // T_body in K (for modern thermal allowance)
  bodyThermalDegreesN?: number | undefined; // n (number of thermal modes, default 10)
  channels?: FluorescenceChannels | undefined; // default light-plus-heat
  set?: ConstantSet | undefined;
}>;

export type FluorescenceBudgetResult = Readonly<{
  status: "value" | "outside-domain" | "not-applicable";
  allowed: boolean;
  nu1Hz: number;
  nu2Hz: number;
  nu2MaxHz: number;
  e1Joules: number;
  e1Ev: number;
  e2Joules: number;
  e2Ev: number;
  eOtherJoules: number;
  eOtherEv: number;
  energyDeficitJoules: number;
  energyDeficitEv: number;
  wienParameterX?: number | undefined;
  wienDeviationExpMinusX?: number | undefined;
  thermalExtraJoules?: number | undefined;
  thermalExtraEv?: number | undefined;
  verdictReason: string;
  refusalCode?: string | undefined;
}>;

/**
 * Energy budget evaluator for fluorescence (§7 of 1905 light-quanta paper, LQ-07).
 * Evaluates whether an emitted quantum h*nu2 is energetically permissible under the
 * single-quantum hypothesis h*nu1 = h*nu2 + E_other, or under Einstein's two named
 * deviation cases, or under modern thermal anti-Stokes allowance.
 */
export function fluorescenceBudget(input: FluorescenceBudgetInput): FluorescenceBudgetResult {
  const {
    nu1,
    nu2,
    regime = "standard-stokes",
    multiQuantumK = 1,
    sourceTemperatureK = 5800,
    bodyTemperatureK = 300,
    bodyThermalDegreesN = 10,
    channels = "light-plus-heat",
    set,
  } = input;

  const h = getPlanckConstant(set);
  const e = getElementaryCharge(set);
  const kB = getBoltzmannConstant(set);

  const e1J = h * nu1;
  const e1Ev = e1J / e;
  const e2J = h * nu2;
  const e2Ev = e2J / e;

  if (regime === "deviation-non-wien") {
    const Tsrc = sourceTemperatureK > 0 ? sourceTemperatureK : 5800;
    const x = (h * nu1) / (kB * Tsrc);
    const expMinusX = Math.exp(-x);

    // If e^-x > 0.01, outside Wien domain
    if (expMinusX > 0.01) {
      return Object.freeze({
        status: "outside-domain",
        allowed: false,
        nu1Hz: nu1,
        nu2Hz: nu2,
        nu2MaxHz: nu1,
        e1Joules: e1J,
        e1Ev,
        e2Joules: e2J,
        e2Ev,
        eOtherJoules: 0,
        eOtherEv: 0,
        energyDeficitJoules: Math.max(0, e2J - e1J),
        energyDeficitEv: Math.max(0, e2Ev - e1Ev),
        wienParameterX: x,
        wienDeviationExpMinusX: expMinusX,
        verdictReason:
          "Exciting radiation is outside the Wien regime (e^-x > 0.01); Einstein's single-quantum volume law cannot be deduced for this source.",
        refusalCode: "outside-wien-domain",
      });
    }

    // Inside Wien domain: single-quantum bound applies
    const allowed = nu2 <= nu1;
    const deficitJ = Math.max(0, e2J - e1J);
    const eOtherJ = allowed ? e1J - e2J : 0;
    return Object.freeze({
      status: "value",
      allowed,
      nu1Hz: nu1,
      nu2Hz: nu2,
      nu2MaxHz: nu1,
      e1Joules: e1J,
      e1Ev,
      e2Joules: e2J,
      e2Ev,
      eOtherJoules: eOtherJ,
      eOtherEv: eOtherJ / e,
      energyDeficitJoules: deficitJ,
      energyDeficitEv: deficitJ / e,
      wienParameterX: x,
      wienDeviationExpMinusX: expMinusX,
      verdictReason: allowed
        ? "Allowed: Exciting light is in the Wien regime (e^-x <= 0.01) and emitted frequency nu2 <= nu1."
        : "Disallowed: Emitted frequency nu2 exceeds incident frequency nu1 in the Wien regime.",
    });
  }

  if (regime === "deviation-multi-quantum") {
    const k = Math.max(1, Math.floor(multiQuantumK));
    const totalInJ = k * e1J;
    const totalInEv = totalInJ / e;
    const nu2Max = k * nu1;
    const allowed = nu2 <= nu2Max;
    const deficitJ = Math.max(0, e2J - totalInJ);
    const eOtherJ = allowed ? totalInJ - e2J : 0;

    return Object.freeze({
      status: "value",
      allowed,
      nu1Hz: nu1,
      nu2Hz: nu2,
      nu2MaxHz: nu2Max,
      e1Joules: e1J,
      e1Ev,
      e2Joules: e2J,
      e2Ev,
      eOtherJoules: eOtherJ,
      eOtherEv: eOtherJ / e,
      energyDeficitJoules: deficitJ,
      energyDeficitEv: deficitJ / e,
      verdictReason: allowed
        ? `Allowed under deviation case (1): ${k} absorbed quanta supply ${totalInEv.toFixed(4)} eV, permitting emission up to ${k}*nu1.`
        : `Disallowed: Emitted frequency nu2 exceeds ${k}*nu1 (${(e2Ev - totalInEv).toFixed(4)} eV deficit).`,
    });
  }

  if (regime === "modern-thermal") {
    const nDegrees = Math.max(1, bodyThermalDegreesN);
    const Tbody = Math.max(0, bodyTemperatureK);
    const extraJ = nDegrees * kB * Tbody;
    const extraEv = extraJ / e;
    const totalAvailableJ = e1J + extraJ;
    const nu2Max = totalAvailableJ / h;
    const allowed = nu2 <= nu2Max;
    const deficitJ = Math.max(0, e2J - totalAvailableJ);
    const eOtherJ = allowed ? totalAvailableJ - e2J : 0;

    return Object.freeze({
      status: "value",
      allowed,
      nu1Hz: nu1,
      nu2Hz: nu2,
      nu2MaxHz: nu2Max,
      e1Joules: e1J,
      e1Ev,
      e2Joules: e2J,
      e2Ev,
      eOtherJoules: eOtherJ,
      eOtherEv: eOtherJ / e,
      energyDeficitJoules: deficitJ,
      energyDeficitEv: deficitJ / e,
      thermalExtraJoules: extraJ,
      thermalExtraEv: extraEv,
      verdictReason: allowed
        ? `Allowed under modern thermal allowance: Body vibrational energy contributes +${extraEv.toFixed(4)} eV (nu2,max = ${(nu2Max / 1e12).toFixed(2)} THz; not in 1905 paper).`
        : `Disallowed: Emitted frequency nu2 exceeds modern thermal bound nu2,max.`,
    });
  }

  // Standard Stokes regime (§7 as printed)
  const nu2Max = nu1;
  let allowed = nu2 <= nu1;
  let reason = allowed
    ? "Allowed under Stokes's rule: emitted quantum energy does not exceed absorbed quantum energy (nu2 <= nu1)."
    : "Disallowed under standard single-quantum Stokes assumptions: emitted quantum energy exceeds absorbed quantum energy (nu2 > nu1).";

  if (channels === "light-only") {
    if (nu2 < nu1) {
      allowed = false;
      reason =
        "Disallowed under light-only channel assumption: absorbed energy exceeds emitted light energy with no other channel to absorb the remaining energy.";
    } else if (nu2 > nu1) {
      allowed = false;
      reason =
        "Disallowed: emitted light energy exceeds absorbed energy with no additional energy input.";
    } else {
      allowed = true;
      reason = "Allowed: exact resonance fluorescence with no energy lost to other channels.";
    }
  }

  const deficitJ = Math.max(0, e2J - e1J);
  const eOtherJ = allowed && channels === "light-plus-heat" ? e1J - e2J : 0;

  return Object.freeze({
    status: "value",
    allowed,
    nu1Hz: nu1,
    nu2Hz: nu2,
    nu2MaxHz: nu2Max,
    e1Joules: e1J,
    e1Ev,
    e2Joules: e2J,
    e2Ev,
    eOtherJoules: eOtherJ,
    eOtherEv: eOtherJ / e,
    energyDeficitJoules: deficitJ,
    energyDeficitEv: deficitJ / e,
    verdictReason: reason,
  });
}

export type FluorescenceRatesInput = Readonly<{
  nu1: number; // Incident frequency (Hz)
  nu2: number; // Emitted frequency (Hz)
  absorbedPowerWatts: number; // P_abs in Watts
  quantumYield: number; // Y in [0, 1]
  regime?: FluorescenceRegime | undefined;
  set?: ConstantSet | undefined;
}>;

export type FluorescenceRatesResult = Readonly<{
  status: "value" | "not-applicable" | "outside-domain";
  absorbedRatePerSecond: number;
  emittedRatePerSecond: number;
  absorbedPowerWatts: number;
  emittedPowerWatts: number;
  dissipatedHeatWatts: number;
  quantumYield: number;
  energyEfficiency: number;
  reason?: string | undefined;
}>;

/**
 * Weak-illumination rates evaluator (§7 of 1905 light-quanta paper, LQ-07).
 * Computes absorbed photon rate \dot{N}_1 = P_abs / (h*nu1) and emitted rate
 * \dot{N}_2 = Y * \dot{N}_1 with zero threshold.
 */
export function fluorescenceRates(input: FluorescenceRatesInput): FluorescenceRatesResult {
  const { nu1, nu2, absorbedPowerWatts, quantumYield, regime = "standard-stokes", set } = input;

  if (regime === "deviation-multi-quantum") {
    return Object.freeze({
      status: "not-applicable",
      absorbedRatePerSecond: 0,
      emittedRatePerSecond: 0,
      absorbedPowerWatts,
      emittedPowerWatts: 0,
      dissipatedHeatWatts: 0,
      quantumYield,
      energyEfficiency: 0,
      reason:
        "Multi-quantum absorption rate equations are non-linear in illumination intensity; single-quantum rate formulas do not apply.",
    });
  }

  if (absorbedPowerWatts < 0 || quantumYield < 0 || quantumYield > 1) {
    return Object.freeze({
      status: "outside-domain",
      absorbedRatePerSecond: 0,
      emittedRatePerSecond: 0,
      absorbedPowerWatts,
      emittedPowerWatts: 0,
      dissipatedHeatWatts: 0,
      quantumYield,
      energyEfficiency: 0,
      reason: "Absorbed power must be non-negative and quantum yield Y must lie in [0, 1].",
    });
  }

  const h = getPlanckConstant(set);
  const eq1 = h * nu1;
  const eq2 = h * nu2;

  const dotN1 = eq1 > 0 ? absorbedPowerWatts / eq1 : 0;
  const dotN2 = quantumYield * dotN1;
  const pEmit = dotN2 * eq2;
  const pHeat = Math.max(0, absorbedPowerWatts - pEmit);
  const efficiency = absorbedPowerWatts > 0 ? pEmit / absorbedPowerWatts : 0;

  return Object.freeze({
    status: "value",
    absorbedRatePerSecond: dotN1,
    emittedRatePerSecond: dotN2,
    absorbedPowerWatts,
    emittedPowerWatts: pEmit,
    dissipatedHeatWatts: pHeat,
    quantumYield,
    energyEfficiency: efficiency,
  });
}

// ---- Ionization Bounds, Counting Model & Historical Checks (Paper 1, §9, LQ-09) ----

function getSpeedOfLight(set?: ConstantSet): number {
  const activeSet = set ?? getConstantSet("modern-si-2019");
  return constantValue(activeSet, "speedOfLight").value;
}

function getAvogadroConstant(set?: ConstantSet): number {
  const activeSet = set ?? getConstantSet("modern-si-2019");
  return constantValue(activeSet, "avogadroConstant").value;
}

export type IonizationBoundsInput = Readonly<{
  nu: number; // Light frequency in Hz
  ionizationEnergyJoules?: number | undefined; // J_mol in Joules
  ionizationEnergyEv?: number | undefined; // J_mol in eV
  gasCitation?: Readonly<{ gasName: string; citation?: string }> | undefined;
  set?: ConstantSet | undefined;
}>;

export type IonizationBoundsResult = Readonly<{
  status: "value" | "outside-domain" | "not-applicable";
  singleQuantumAllowed: boolean;
  frequencyHz: number;
  quantumEnergyJoules: number;
  quantumEnergyEv: number;
  ionizationEnergyJoules: number;
  ionizationEnergyEv: number;
  thresholdFrequencyHz: number;
  thresholdFrequencyTHz: number;
  thresholdWavelengthNm: number;
  excessEnergyJoules: number;
  excessEnergyEv: number;
  verdictReason: string;
  refusalCode?: string | undefined;
}>;

/**
 * Single-quantum ionization threshold and energy budget evaluator (Paper 1, §9, LQ-09).
 * Evaluates whether h*nu >= J_mol, threshold frequency nu_0 = J_mol / h, threshold wavelength lambda_0 = c / nu_0,
 * and excess kinetic energy E_excess = h*nu - J_mol.
 */
export function ionizationBounds(input: IonizationBoundsInput): IonizationBoundsResult {
  const { nu, ionizationEnergyJoules, ionizationEnergyEv, gasCitation, set } = input;

  if (!Number.isFinite(nu)) {
    return Object.freeze({
      status: "outside-domain",
      singleQuantumAllowed: false,
      frequencyHz: nu,
      quantumEnergyJoules: 0,
      quantumEnergyEv: 0,
      ionizationEnergyJoules: 0,
      ionizationEnergyEv: 0,
      thresholdFrequencyHz: 0,
      thresholdFrequencyTHz: 0,
      thresholdWavelengthNm: 0,
      excessEnergyJoules: 0,
      excessEnergyEv: 0,
      verdictReason: "Frequency must be a finite number.",
      refusalCode: "nonfinite-frequency",
    });
  }

  if (nu <= 0) {
    return Object.freeze({
      status: "outside-domain",
      singleQuantumAllowed: false,
      frequencyHz: nu,
      quantumEnergyJoules: 0,
      quantumEnergyEv: 0,
      ionizationEnergyJoules: 0,
      ionizationEnergyEv: 0,
      thresholdFrequencyHz: 0,
      thresholdFrequencyTHz: 0,
      thresholdWavelengthNm: 0,
      excessEnergyJoules: 0,
      excessEnergyEv: 0,
      verdictReason: "Frequency must be strictly positive.",
      refusalCode: "nonpositive-frequency",
    });
  }

  if (gasCitation && gasCitation.gasName.trim().length > 0 && !gasCitation.citation) {
    return Object.freeze({
      status: "outside-domain",
      singleQuantumAllowed: false,
      frequencyHz: nu,
      quantumEnergyJoules: 0,
      quantumEnergyEv: 0,
      ionizationEnergyJoules: 0,
      ionizationEnergyEv: 0,
      thresholdFrequencyHz: 0,
      thresholdFrequencyTHz: 0,
      thresholdWavelengthNm: 0,
      excessEnergyJoules: 0,
      excessEnergyEv: 0,
      verdictReason: `Named gas '${gasCitation.gasName}' without citation requires historical or modern source citation.`,
      refusalCode: "uncited-gas",
    });
  }

  const h = getPlanckConstant(set);
  const e = getElementaryCharge(set);
  const c = getSpeedOfLight(set);

  let jMolJ: number;
  let jMolEv: number;

  if (ionizationEnergyEv !== undefined) {
    if (!Number.isFinite(ionizationEnergyEv) || ionizationEnergyEv < 0) {
      return Object.freeze({
        status: "outside-domain",
        singleQuantumAllowed: false,
        frequencyHz: nu,
        quantumEnergyJoules: 0,
        quantumEnergyEv: 0,
        ionizationEnergyJoules: 0,
        ionizationEnergyEv: ionizationEnergyEv,
        thresholdFrequencyHz: 0,
        thresholdFrequencyTHz: 0,
        thresholdWavelengthNm: 0,
        excessEnergyJoules: 0,
        excessEnergyEv: 0,
        verdictReason: "Ionization energy in eV must be a non-negative finite number.",
        refusalCode: "invalid-ionization-energy",
      });
    }
    jMolEv = ionizationEnergyEv;
    jMolJ = ionizationEnergyEv * e;
  } else if (ionizationEnergyJoules !== undefined) {
    if (!Number.isFinite(ionizationEnergyJoules) || ionizationEnergyJoules < 0) {
      return Object.freeze({
        status: "outside-domain",
        singleQuantumAllowed: false,
        frequencyHz: nu,
        quantumEnergyJoules: 0,
        quantumEnergyEv: 0,
        ionizationEnergyJoules: ionizationEnergyJoules,
        ionizationEnergyEv: 0,
        thresholdFrequencyHz: 0,
        thresholdFrequencyTHz: 0,
        thresholdWavelengthNm: 0,
        excessEnergyJoules: 0,
        excessEnergyEv: 0,
        verdictReason: "Ionization energy in Joules must be a non-negative finite number.",
        refusalCode: "invalid-ionization-energy",
      });
    }
    jMolJ = ionizationEnergyJoules;
    jMolEv = ionizationEnergyJoules / e;
  } else {
    return Object.freeze({
      status: "outside-domain",
      singleQuantumAllowed: false,
      frequencyHz: nu,
      quantumEnergyJoules: 0,
      quantumEnergyEv: 0,
      ionizationEnergyJoules: 0,
      ionizationEnergyEv: 0,
      thresholdFrequencyHz: 0,
      thresholdFrequencyTHz: 0,
      thresholdWavelengthNm: 0,
      excessEnergyJoules: 0,
      excessEnergyEv: 0,
      verdictReason: "Ionization energy must be specified in Joules or eV.",
      refusalCode: "missing-ionization-energy",
    });
  }

  const eqJ = h * nu;
  const eqEv = eqJ / e;
  const nu0 = jMolJ / h;
  const nu0THz = nu0 / 1e12;
  const lambda0M = nu0 > 0 ? c / nu0 : Infinity;
  const lambda0Nm = lambda0M * 1e9;

  const singleQuantumAllowed = eqJ >= jMolJ;
  const excessJ = eqJ - jMolJ;
  const excessEv = excessJ / e;

  const verdictReason = singleQuantumAllowed
    ? `Allowed: quantum energy h*nu (${eqEv.toFixed(4)} eV) meets or exceeds ionization threshold J_mol (${jMolEv.toFixed(4)} eV), providing ${excessEv.toFixed(4)} eV excess energy.`
    : `Disallowed: quantum energy h*nu (${eqEv.toFixed(4)} eV) is below ionization threshold J_mol (${jMolEv.toFixed(4)} eV); single-quantum ionization cannot occur under paper assumptions.`;

  return Object.freeze({
    status: "value",
    singleQuantumAllowed,
    frequencyHz: nu,
    quantumEnergyJoules: eqJ,
    quantumEnergyEv: eqEv,
    ionizationEnergyJoules: jMolJ,
    ionizationEnergyEv: jMolEv,
    thresholdFrequencyHz: nu0,
    thresholdFrequencyTHz: nu0THz,
    thresholdWavelengthNm: lambda0Nm,
    excessEnergyJoules: excessJ,
    excessEnergyEv: excessEv,
    verdictReason,
  });
}

export type AbsorptionMode = "all-absorbed-ionizes" | "declared-fraction" | "unknown";

export type IonizationCountInput = Readonly<{
  nu: number; // in Hz
  ionizationEnergyJoules?: number | undefined;
  ionizationEnergyEv?: number | undefined;
  absorbedPowerWatts?: number | undefined; // P_abs in Watts
  incidentPowerWatts?: number | undefined; // P_opt in Watts
  absorptionEfficiency?: number | undefined; // eta_abs in [0, 1]
  durationSeconds?: number | undefined; // t in seconds (default 1.0)
  absorptionMode?: AbsorptionMode | undefined; // default "all-absorbed-ionizes"
  declaredFraction?: number | undefined; // a in [0, 1]
  gasCitation?: Readonly<{ gasName: string; citation?: string }> | undefined;
  set?: ConstantSet | undefined;
}>;

export type IonizationCountResult = Readonly<{
  status: "value" | "outside-domain" | "not-applicable" | "underdetermined";
  bounds: IonizationBoundsResult;
  incidentPowerWatts: number;
  absorbedPowerWatts: number;
  durationSeconds: number;
  absorbedLightEnergyJoules: number; // L = P_abs * t
  incidentQuantumRatePerSecond: PhotoelectricResult<number>; // dot_N_inc = P_opt / (h*nu)
  absorbedQuantumRatePerSecond: PhotoelectricResult<number>; // dot_N_abs = P_abs / (h*nu)
  absorbedQuantaCount: PhotoelectricResult<number>; // N_abs = L / (h*nu)
  ionizationRatePerSecond: PhotoelectricResult<number>; // dot_N_ion
  ionizationCountMolecules: PhotoelectricResult<number>; // N_ion
  ionizedGramMolecules: PhotoelectricResult<number>; // j = N_ion / N_A
  ionsPerAbsorbedQuantumUpperBound: number; // 1.0
  absorptionConditionLabel: string;
  reason?: string | undefined;
}>;

/**
 * Ionization count and rate evaluator (Paper 1, §9, LQ-09).
 * Computes absorbed light energy L = P_abs * t, absorbed quanta rate dot_N_abs = P_abs / (h*nu),
 * and ionization counts/rates under the three epistemic absorption modes:
 * - "all-absorbed-ionizes": j = L / (R*beta*nu) or N_ion = L / (h*nu)
 * - "declared-fraction": N_ion = a * L / (h*nu)
 * - "unknown": underdetermined with N_abs as an upper bound.
 * Below threshold (h*nu < J_mol), ionization count and rate are strictly not-applicable.
 */
export function ionizationCount(input: IonizationCountInput): IonizationCountResult {
  const {
    nu,
    ionizationEnergyJoules,
    ionizationEnergyEv,
    absorbedPowerWatts: rawAbsPower,
    incidentPowerWatts: rawIncPower,
    absorptionEfficiency: rawEta,
    durationSeconds = 1.0,
    absorptionMode = "all-absorbed-ionizes",
    declaredFraction = 1.0,
    gasCitation,
    set,
  } = input;

  const bounds = ionizationBounds({
    nu,
    ionizationEnergyJoules,
    ionizationEnergyEv,
    gasCitation,
    set,
  });

  if (bounds.status === "outside-domain") {
    const refusal = outsideDomain(
      bounds.refusalCode ?? "outside-domain",
      "model",
      bounds.verdictReason,
    );
    return Object.freeze({
      status: "outside-domain",
      bounds,
      incidentPowerWatts: rawIncPower ?? 0,
      absorbedPowerWatts: rawAbsPower ?? 0,
      durationSeconds,
      absorbedLightEnergyJoules: 0,
      incidentQuantumRatePerSecond: refusal,
      absorbedQuantumRatePerSecond: refusal,
      absorbedQuantaCount: refusal,
      ionizationRatePerSecond: refusal,
      ionizationCountMolecules: refusal,
      ionizedGramMolecules: refusal,
      ionsPerAbsorbedQuantumUpperBound: 1.0,
      absorptionConditionLabel: "outside-domain",
      reason: bounds.verdictReason,
    });
  }

  // Resolve powers
  let pOpt = 0;
  let pAbs = 0;
  const eta = rawEta !== undefined ? rawEta : 1.0;

  if (rawAbsPower !== undefined) {
    pAbs = rawAbsPower;
    pOpt = rawIncPower !== undefined ? rawIncPower : eta > 0 ? pAbs / eta : pAbs;
  } else if (rawIncPower !== undefined) {
    pOpt = rawIncPower;
    pAbs = eta * pOpt;
  }

  if (pOpt < 0 || pAbs < 0 || !Number.isFinite(pOpt) || !Number.isFinite(pAbs)) {
    const refusal = outsideDomain(
      "negative-power",
      "physical",
      "Power values must be non-negative finite numbers.",
    );
    return Object.freeze({
      status: "outside-domain",
      bounds,
      incidentPowerWatts: pOpt,
      absorbedPowerWatts: pAbs,
      durationSeconds,
      absorbedLightEnergyJoules: 0,
      incidentQuantumRatePerSecond: refusal,
      absorbedQuantumRatePerSecond: refusal,
      absorbedQuantaCount: refusal,
      ionizationRatePerSecond: refusal,
      ionizationCountMolecules: refusal,
      ionizedGramMolecules: refusal,
      ionsPerAbsorbedQuantumUpperBound: 1.0,
      absorptionConditionLabel: "outside-domain",
      reason: "Power values must be non-negative finite numbers.",
    });
  }

  if (eta < 0 || eta > 1 || !Number.isFinite(eta)) {
    const refusal = outsideDomain(
      "invalid-absorption-efficiency",
      "model",
      "Absorption efficiency must lie in [0, 1].",
    );
    return Object.freeze({
      status: "outside-domain",
      bounds,
      incidentPowerWatts: pOpt,
      absorbedPowerWatts: pAbs,
      durationSeconds,
      absorbedLightEnergyJoules: 0,
      incidentQuantumRatePerSecond: refusal,
      absorbedQuantumRatePerSecond: refusal,
      absorbedQuantaCount: refusal,
      ionizationRatePerSecond: refusal,
      ionizationCountMolecules: refusal,
      ionizedGramMolecules: refusal,
      ionsPerAbsorbedQuantumUpperBound: 1.0,
      absorptionConditionLabel: "outside-domain",
      reason: "Absorption efficiency must lie in [0, 1].",
    });
  }

  if (durationSeconds < 0 || !Number.isFinite(durationSeconds)) {
    const refusal = outsideDomain(
      "negative-duration",
      "physical",
      "Duration must be non-negative.",
    );
    return Object.freeze({
      status: "outside-domain",
      bounds,
      incidentPowerWatts: pOpt,
      absorbedPowerWatts: pAbs,
      durationSeconds,
      absorbedLightEnergyJoules: 0,
      incidentQuantumRatePerSecond: refusal,
      absorbedQuantumRatePerSecond: refusal,
      absorbedQuantaCount: refusal,
      ionizationRatePerSecond: refusal,
      ionizationCountMolecules: refusal,
      ionizedGramMolecules: refusal,
      ionsPerAbsorbedQuantumUpperBound: 1.0,
      absorptionConditionLabel: "outside-domain",
      reason: "Duration must be non-negative.",
    });
  }

  const h = getPlanckConstant(set);
  const na = getAvogadroConstant(set);
  const eqJ = h * nu;

  const incQRate = eqJ > 0 ? pOpt / eqJ : 0;
  const absQRate = eqJ > 0 ? pAbs / eqJ : 0;
  const lAbs = pAbs * durationSeconds;
  const absQCount = eqJ > 0 ? lAbs / eqJ : 0;

  const incQRateRes = ok(incQRate, "s^-1");
  const absQRateRes = ok(absQRate, "s^-1");
  const absQCountRes = ok(absQCount);

  // Sub-threshold check
  if (!bounds.singleQuantumAllowed) {
    const notApp = notApplicable("no single-quantum ionization under this hypothesis");
    return Object.freeze({
      status: "not-applicable",
      bounds,
      incidentPowerWatts: pOpt,
      absorbedPowerWatts: pAbs,
      durationSeconds,
      absorbedLightEnergyJoules: lAbs,
      incidentQuantumRatePerSecond: incQRateRes,
      absorbedQuantumRatePerSecond: absQRateRes,
      absorbedQuantaCount: absQCountRes,
      ionizationRatePerSecond: notApp,
      ionizationCountMolecules: notApp,
      ionizedGramMolecules: notApp,
      ionsPerAbsorbedQuantumUpperBound: 1.0,
      absorptionConditionLabel: "below-threshold",
      reason: "Incident photon energy h*nu is below the ionization threshold J_mol.",
    });
  }

  // Supra-threshold regimes
  if (absorptionMode === "unknown") {
    const underdet = underdetermined("sub-quantum-efficiency", [
      "ionization-efficiency-fraction",
      "non-ionizing-absorption-channels",
    ]);
    return Object.freeze({
      status: "underdetermined",
      bounds,
      incidentPowerWatts: pOpt,
      absorbedPowerWatts: pAbs,
      durationSeconds,
      absorbedLightEnergyJoules: lAbs,
      incidentQuantumRatePerSecond: incQRateRes,
      absorbedQuantumRatePerSecond: absQRateRes,
      absorbedQuantaCount: absQCountRes,
      ionizationRatePerSecond: underdet,
      ionizationCountMolecules: underdet,
      ionizedGramMolecules: underdet,
      ionsPerAbsorbedQuantumUpperBound: 1.0,
      absorptionConditionLabel: "unknown-absorption",
      reason: `Unknown fraction of absorbed energy goes to non-ionizing channels; count is bounded above by absorbed quanta N_abs = ${absQCount.toExponential(4)}.`,
    });
  }

  if (absorptionMode === "declared-fraction") {
    if (declaredFraction < 0 || declaredFraction > 1 || !Number.isFinite(declaredFraction)) {
      const refusal = outsideDomain(
        "invalid-fraction",
        "model",
        "Declared ionization fraction must lie in [0, 1].",
      );
      return Object.freeze({
        status: "outside-domain",
        bounds,
        incidentPowerWatts: pOpt,
        absorbedPowerWatts: pAbs,
        durationSeconds,
        absorbedLightEnergyJoules: lAbs,
        incidentQuantumRatePerSecond: incQRateRes,
        absorbedQuantumRatePerSecond: absQRateRes,
        absorbedQuantaCount: absQCountRes,
        ionizationRatePerSecond: refusal,
        ionizationCountMolecules: refusal,
        ionizedGramMolecules: refusal,
        ionsPerAbsorbedQuantumUpperBound: 1.0,
        absorptionConditionLabel: "outside-domain",
        reason: "Declared ionization fraction must lie in [0, 1].",
      });
    }

    const ionRate = declaredFraction * absQRate;
    const ionCount = declaredFraction * absQCount;
    const jMol = na > 0 ? ionCount / na : 0;

    return Object.freeze({
      status: "value",
      bounds,
      incidentPowerWatts: pOpt,
      absorbedPowerWatts: pAbs,
      durationSeconds,
      absorbedLightEnergyJoules: lAbs,
      incidentQuantumRatePerSecond: incQRateRes,
      absorbedQuantumRatePerSecond: absQRateRes,
      absorbedQuantaCount: absQCountRes,
      ionizationRatePerSecond: ok(ionRate, "s^-1"),
      ionizationCountMolecules: ok(ionCount),
      ionizedGramMolecules: ok(jMol, "mol"),
      ionsPerAbsorbedQuantumUpperBound: 1.0,
      absorptionConditionLabel: "declared-fraction",
      reason: `Declared fraction a = ${declaredFraction.toFixed(4)} of absorbed light quanta produce ionization.`,
    });
  }

  // Primary paper hypothesis: all absorbed light ionizes
  const ionRate = absQRate;
  const ionCount = absQCount;
  const jMol = na > 0 ? ionCount / na : 0;

  return Object.freeze({
    status: "value",
    bounds,
    incidentPowerWatts: pOpt,
    absorbedPowerWatts: pAbs,
    durationSeconds,
    absorbedLightEnergyJoules: lAbs,
    incidentQuantumRatePerSecond: incQRateRes,
    absorbedQuantumRatePerSecond: absQRateRes,
    absorbedQuantaCount: absQCountRes,
    ionizationRatePerSecond: ok(ionRate, "s^-1"),
    ionizationCountMolecules: ok(ionCount),
    ionizedGramMolecules: ok(jMol, "mol"),
    ionsPerAbsorbedQuantumUpperBound: 1.0,
    absorptionConditionLabel: "all-absorbed-ionizes",
    reason:
      "Under Einstein's §9 hypothesis that every absorbed light quantum ionizes one molecule: j = L / (R*beta*nu).",
  });
}

/**
 * Historical regression checks: Einstein 1905 paper 1, §9.
 *
 * 1. Lenard check on air ionization:
 *    - Lenard observed air ionization for lambda <= 1.9e-5 cm = 190 nm.
 *    - Editorial speed of light L_c = 3.0e10 cm/s.
 *    - Frequency nu = L_c / lambda = 1.578947e15 s^-1.
 *    - R = 8.31e7 erg/(mol K), beta = 4.866e-11 K s.
 *    - Energy per gram-equivalent: R*beta*nu = 6.384742e12 erg (Einstein: "ca. 6,4 · 10^12 Erg").
 *    - Gram-equivalent charge E = 9.6e3 emu.
 *    - Potential difference Pi = (R*beta*nu)/E = 6.65077e8 abV = 6.65077 V (Einstein: "ca. 6,6 Volt").
 *    - Modern comparison at 190 nm: h*c/lambda = 6.5255 eV.
 *    - Historical per-molecule value: (R*beta*nu)/N = 6.459 eV (with N = 6.17e23).
 *
 * 2. Stark check on cathode-ray air ionization:
 *    - Stark observed minimum potential of ca. 10 Volts = 10^9 abV.
 *    - J = E * 10^9 abV = 9.6e12 erg per gram-equivalent exactly.
 *    - Threshold frequency nu_0 = J / (R*beta) = 2.37404e15 s^-1.
 *    - Threshold wavelength lambda_0 = L_c / nu_0 = 1.26367e-5 cm = 126.37 nm.
 */
export function einsteinPrintedIonizationChecks(): Readonly<{
  lenardCheck: Readonly<{
    wavelengthCm: number;
    wavelengthNm: number;
    speedOfLightCmPerSec: number;
    frequencyHz: number;
    molarGasConstantErg: number;
    wienBetaSecDeg: number;
    gramEquivalentChargeEmu: number;
    energyPerGramEquivalentErg: number;
    printedEnergyText: string;
    potentialDifferenceAbV: number;
    potentialDifferenceVolts: number;
    printedPotentialText: string;
    modernEnergyEvAt190nm: number;
    historicalPerMoleculeEv: number;
    historicalSource: string;
  }>;
  starkCheck: Readonly<{
    sparkPotentialVolts: number;
    sparkPotentialAbV: number;
    gramEquivalentChargeEmu: number;
    energyPerGramEquivalentErg: number;
    thresholdFrequencyHz: number;
    thresholdWavelengthCm: number;
    thresholdWavelengthNm: number;
    printedPotentialText: string;
    historicalSource: string;
  }>;
  historicalNote: string;
}> {
  const R = 8.31e7; // erg / (mol K)
  const beta = 4.866e-11; // K s
  const E_emu = 9.6e3; // emu / mol
  const Lc = 3.0e10; // cm / s (editorial speed of light in 1905 paper 1 §9)
  const lambda_lenard_cm = 1.9e-5; // cm (190 nm)
  const nu_lenard = Lc / lambda_lenard_cm; // 1.5789473684210527e15 s^-1

  const lenard_energy_erg = R * beta * nu_lenard; // 6.384742105263158e12 erg
  const lenard_pot_abV = lenard_energy_erg / E_emu; // 6.65077302631579e8 abV
  const lenard_pot_V = lenard_pot_abV * 1e-8; // 6.65077302631579 V

  const stark_V = 10;
  const stark_abV = stark_V * 1e8; // 10^9 abV
  const stark_energy_erg = E_emu * stark_abV; // 9.6e12 erg
  const stark_nu0 = stark_energy_erg / (R * beta); // 2.37404000306654e15 s^-1
  const stark_lambda0_cm = Lc / stark_nu0; // 1.26366868...e-5 cm
  const stark_lambda0_nm = stark_lambda0_cm * 1e7; // ~126.37 nm

  // Modern SI comparison at 190 nm:
  const modern_ev = (6.62607015e-34 * 2.99792458e8) / (190e-9 * 1.602176634e-19);

  // Historical per-molecule with Einstein 1905 N = 6.17e23:
  const hist_per_mol_ev = lenard_energy_erg / (6.17e23 * 1.602176634e-12);

  return Object.freeze({
    lenardCheck: Object.freeze({
      wavelengthCm: lambda_lenard_cm,
      wavelengthNm: 190,
      speedOfLightCmPerSec: Lc,
      frequencyHz: nu_lenard,
      molarGasConstantErg: R,
      wienBetaSecDeg: beta,
      gramEquivalentChargeEmu: E_emu,
      energyPerGramEquivalentErg: lenard_energy_erg,
      printedEnergyText: "ca. 6,4 · 10^12 Erg",
      potentialDifferenceAbV: lenard_pot_abV,
      potentialDifferenceVolts: lenard_pot_V,
      printedPotentialText: "ca. 6,6 Volt",
      modernEnergyEvAt190nm: modern_ev,
      historicalPerMoleculeEv: hist_per_mol_ev,
      historicalSource: "P. Lenard, Ann. d. Phys. 3, p. 298, 1900.",
    }),
    starkCheck: Object.freeze({
      sparkPotentialVolts: stark_V,
      sparkPotentialAbV: stark_abV,
      gramEquivalentChargeEmu: E_emu,
      energyPerGramEquivalentErg: stark_energy_erg,
      thresholdFrequencyHz: stark_nu0,
      thresholdWavelengthCm: stark_lambda0_cm,
      thresholdWavelengthNm: stark_lambda0_nm,
      printedPotentialText: "ca. 10 Volt",
      historicalSource: "J. Stark, Die Elektrizität in Gasen, p. 57, Leipzig 1902.",
    }),
    historicalNote:
      "Einstein (§9) uses Lenard's observation of air ionization at lambda < 190 nm and Stark's cathode-ray ionization potential (ca. 10 V) to verify that single-quantum energy quanta R*beta*nu match the energy scale of gas ionization.",
  });
}
