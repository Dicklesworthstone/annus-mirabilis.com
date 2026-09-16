import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export type Me02Parameters = Readonly<{
  beta: number;
  emittedEnergy: number;
  energyUnit: "normalized" | "erg" | "joule";
  speedAxis: "linear" | "logarithmic";
  showNaive: boolean;
  notation: "printed" | "modern";
}>;

export const ME02_DEFAULTS: Me02Parameters = Object.freeze({
  beta: 0.6,
  emittedEnergy: 1,
  energyUnit: "normalized",
  speedAxis: "linear",
  showNaive: false,
  notation: "printed",
});

export const ME02_CLASSES: Readonly<Record<keyof Me02Parameters, ParameterClass>> = Object.freeze({
  beta: "observer",
  emittedEnergy: "input",
  energyUnit: "presentation",
  speedAxis: "presentation",
  showNaive: "presentation",
  notation: "presentation",
});

export const ME02_QUESTION =
  "What does a smaller energy of motion at the same speed tell you about the body's inertia, and why does the conclusion come from low speeds?";

export const ME02_NOT_MODELED = Object.freeze([
  "the premises themselves (explained, not simulated)",
  "accelerated motion",
  "modern momentum formulations",
  "any body not covered by the paper's argument",
  "uncertainty in the printed factor's rounding (shown as a labeled comparison, not modeled)",
]);

const c = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });

export const ME02_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  kineticEnergyDifference: c("J", "kinetic-energy-difference", "massEnergy.exactDifference", [
    "value",
    "outside-domain",
  ]),
  quadraticKineticDifference: c(
    "J",
    "quadratic-kinetic-energy",
    "massEnergy.quadraticApproximation",
    ["value", "outside-domain"],
  ),
  quadraticRelativeDiscrepancy: c(
    "1",
    "quadratic-relative-discrepancy",
    "massEnergy.quadraticDiscrepancy",
    ["value", "not-applicable", "outside-domain"],
  ),
  finiteSpeedMassProxy: c("kg", "finite-speed-mass-proxy", "massEnergy.finiteSpeedProxy", [
    "value",
    "not-applicable",
    "outside-domain",
  ]),
  inertialMassDecrease: c("kg", "limiting-mass-coefficient", "massEnergy.limitingCoefficient", [
    "analytic-limit",
    "outside-domain",
  ]),
  proxyExcessOverLimit: c("1", "proxy-excess", "massEnergy.proxyExcess", [
    "value",
    "not-applicable",
    "outside-domain",
  ]),
  massChangeSigned: c("kg", "signed-mass-change", "massEnergy.massChangeSigned", [
    "value",
    "outside-domain",
  ]),
  naiveGammaMinusOne: c("1", "naive-gamma-minus-one", "massEnergy.naiveGammaMinusOne", [
    "value",
    "outside-domain",
  ]),
});

export const ME02_MODEL = Object.freeze({
  id: "mass-energy-coefficient-host",
  constantSetId: "modern-si-2019",
  label: "Ideal model, host calculation",
});

export const ME02_CAPTION = Object.freeze({
  r0: "At low speed the drop in energy of motion looks exactly like a body that became lighter by the energy it sent out divided by the speed of light squared.",
  r1: "The exact difference is L(gamma - 1). The quadratic estimate is half L times (v/c) squared. The finite-speed proxy is 2 L (gamma - 1) / v^2, never labeled the exact mass loss. The limiting coefficient L/c^2 is an analytic limit at vanishing speed.",
  r2: "Expand gamma as 1 + (1/2) beta^2 + (3/8) beta^4 + ... . Then 2(gamma - 1)/beta^2 = 1 + (3/4) beta^2 + ... which approaches 1 as the speed vanishes, so the coefficient of half v^2 is L/c^2.",
  r3: "Paper 4 prints the step as neglecting magnitudes of fourth and higher order. The printed conversion L / 9e20 uses Einstein's rounded V^2. The Newtonian 1/2 m v^2 is the premise that identifies the coefficient. The printed glyph for the Lorentz factor in paper 4 is UNKNOWN until the facsimile is pinned.",
});
