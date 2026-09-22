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
  // The entered number is interpreted in this unit; changing it changes the physical input.
  energyUnit: "input",
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

export const ME02_PREDICT_PROMPT = Object.freeze({
  promptId: "me-02-predict-exact-versus-quadratic",
  controlId: "output-view",
  supportedCandidateId: "larger",
  question:
    "At 0.6c, is the exact energy difference larger or smaller than the quadratic estimate?",
  candidates: Object.freeze([
    Object.freeze({
      id: "larger",
      label: "Larger",
      description: "The exact difference lies above the quadratic estimate.",
      separatingAssumption:
        "The fourth-order term in the expansion of gamma is positive, so the exact curve sits above the quadratic.",
    }),
    Object.freeze({
      id: "smaller",
      label: "Smaller",
      description: "The exact difference lies below the quadratic estimate.",
      separatingAssumption:
        "The quadratic is treated as an upper bound rather than a truncation of a series with a positive next term.",
    }),
    Object.freeze({
      id: "equal",
      label: "Equal",
      description: "The two curves coincide at 0.6c.",
      separatingAssumption: "The low-speed proxy is treated as exact at every speed.",
    }),
  ]),
});

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
  r1: "The exact difference is L(γ − 1). The quadratic estimate is ½L(v/c)². The finite-speed proxy, 2L(γ − 1)/v², is never called the exact mass loss. The limiting coefficient L/c² is an analytic limit at vanishing speed.",
  r2: "Expand the Lorentz factor γ = 1/√(1 − β²) by the binomial series: 1 + ½β² + ⅜β⁴ + (5/16)β⁶ + …. Subtracting 1 leaves ½β² + ⅜β⁴ + …. Dividing by β² and multiplying by 2 gives 2(γ − 1)/β² = 1 + ¾β² + ⅝β⁴ + …. As β goes to zero every higher-order term vanishes, leaving exactly 1. Multiplying by L gives the low-speed kinetic difference ½(L/c²)v², which identifies the effective mass decrease as L/c².",
  r3: "Paper 4 prints the step as neglecting magnitudes of fourth and higher order. Its conversion L/(9·10²⁰) uses Einstein's rounded V². The Newtonian ½mv² is the premise that identifies the coefficient. Paper 4 prints the Lorentz factor as the explicit radical 1/√(1 − v²/V²) every time it appears, and never writes β for it.",
  r3Citations: Object.freeze([
    "Einstein, A. (1905). Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig? Annalen der Physik 18, 639–641.",
  ]),
});
