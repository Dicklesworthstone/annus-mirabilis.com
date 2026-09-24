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
  r0: "A body that sends out energy as light loses a little of its energy of motion, as seen by anyone it moves past, and at low speed the loss is exactly what a lighter body would lose. The mass it has lost is the energy it sent out divided by the speed of light squared.",
  r1: "The last page of the paper compares the body's energy before and after it emits two equal pulses of light, in its own frame and in a frame where it moves at v. The two descriptions differ by the body's energy of motion, and the emission lowers it by K_{0} − K_{1} = L{1/√(1 − (v/V)^{2}) − 1}, an amount that does not depend on what the body is made of. Neglecting quantities of fourth and higher order, this is (L/V^{2})(v^{2}/2), the drop in ½mv^{2} for a mass that has fallen by L/V^{2}. Einstein concludes that a body giving off energy L as radiation loses mass L/V^{2}, that it does not matter that the energy leaves as radiation, and that the mass of a body is a measure of its energy content. The lab shows the exact drop and the quadratic estimate parting company: at 0.6c they are 0.25 L and 0.18 L, and dividing the exact drop by ½v^{2} gives 1.39 L/V^{2}. At 0.1c the ratio is 1.0076, and it reaches L/V^{2} only as the speed goes to zero, so the lab reports the mass decrease as an analytic limit, not as a value at any finite speed.",
  r2: "Call E_{0} and E_{1} the body's energy before and after the emission in its own frame, and H_{0} and H_{1} the same energies in a frame where it moves at v. In its own frame the light carries away L. In the moving frame, by §8 of the relativity paper, a plane wave's energy changes by the factor (1 − (v/V) cos φ)/√(1 − (v/V)^{2}); for two equal pulses sent in opposite directions the cosine terms cancel and the pair carries L/√(1 − (v/V)^{2}). Energy is conserved in each frame, so E_{0} = E_{1} + L and H_{0} = H_{1} + L/√(1 − (v/V)^{2}). Subtract the first from the second: (H_{0} − E_{0}) − (H_{1} − E_{1}) = L(1/√(1 − (v/V)^{2}) − 1). Each difference H − E is the body's energy of motion K plus a constant C that the emission does not change, so the left side is K_{0} − K_{1}. Now expand for small speeds, with β = v/V: 1/√(1 − β²) = 1 + ½β² + ⅜β⁴ + …, so subtracting 1 leaves ½β² + ⅜β⁴ + …, and dropping the fourth-order term gives K_{0} − K_{1} = ½(L/V^{2})v^{2}. A body of mass m moving at v has energy of motion ½mv^{2}, so this drop at the same speed is the drop a mass decrease of L/V^{2} would cause. At 0.6c the neglected terms are not small: γ = 1.25, the exact drop is 0.25 L, the quadratic 0.18 L, and 2(K_{0} − K_{1})/v^{2} = 2 × 0.25/0.36 = 1.389 L/V^{2}. The series for that ratio is 1 + ¾β² + …, so at 0.1c it is 1.0076 and at 0.01c 1.000075, approaching 1 only in the limit.",
  r3: "Paper 4 writes V for the speed of light and prints the factor as the explicit radical 1/√(1 − (v/V)^{2}), never as β. It neglects 'Größen vierter und höherer Ordnung' and converts the result as L/9·10^{20}, energy in erg and mass in grams, with V rounded to 3·10^{10} cm/s; with today's c the factor is 8.988·10^{20}. The identification of the mass rests on the Newtonian ½mv^{2} at low speed. The paper adds that bodies whose energy content varies greatly, radium salts for instance, might test the theory, and that if the theory corresponds to the facts, radiation carries inertia between the bodies that emit and absorb it. It is dated Bern, September 1905, and was received on 27 September. Ives (1952) argued that the derivation assumes what it proves; Stachel and Torretti (1982) answered that it does not, once the body's energy in the moving frame is taken as the text defines it.",
  r3Citations: Object.freeze([
    "Einstein, A. (1905). Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig? Annalen der Physik 18, 639–641.",
    "Ives, H. E. (1952). Derivation of the mass-energy relation. Journal of the Optical Society of America 42, 540–543.",
    "Stachel, J. and Torretti, R. (1982). Einstein's first derivation of mass-energy equivalence. American Journal of Physics 50, 760–763.",
  ]),
});
