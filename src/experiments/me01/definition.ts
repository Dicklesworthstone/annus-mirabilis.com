import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

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

export type Me01Parameters = Readonly<{
  frameSpeed: number; // beta = v/c
  emittedEnergyRestFrame: number; // L
  emissionAngle: number; // degrees (0..180)
  offsetDisplay: Me01OffsetDisplay;
  premise: Me01Premise;
  step: Me01Step;
  cancelAngleFactors: boolean;
  cancelInternalEnergies: boolean;
  cancelAdditiveConstant: boolean;
  notation: Me01Notation;
}>;

export const ME01_DEFAULTS: Me01Parameters = Object.freeze({
  frameSpeed: 0.6,
  emittedEnergyRestFrame: 1.0,
  emissionAngle: 0,
  offsetDisplay: "symbolic",
  premise: "unchanged",
  step: "subtraction-move",
  cancelAngleFactors: true,
  cancelInternalEnergies: true,
  cancelAdditiveConstant: true,
  notation: "printed",
});

export const ME01_CLASSES: Readonly<Record<keyof Me01Parameters, ParameterClass>> = Object.freeze({
  frameSpeed: "observer",
  emittedEnergyRestFrame: "input",
  emissionAngle: "input",
  offsetDisplay: "presentation",
  premise: "input",
  step: "presentation",
  cancelAngleFactors: "presentation",
  cancelInternalEnergies: "presentation",
  cancelAdditiveConstant: "presentation",
  notation: "presentation",
});

export const ME01_QUESTION =
  "If a body at rest emits two equal pulses in opposite directions, what do two observers' energy ledgers force you to say about the body?";

export const ME01_NOT_MODELED = Object.freeze([
  "recoil from asymmetric emission",
  "finite pulse duration and shape",
  "the emission mechanism",
  "radiation pressure on the body during emission",
  "gravity",
  "the quantum nature of light",
  "the body's absolute rest energy (kept symbolic)",
]);

const contract = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });

export const ME01_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  lightComplexEnergyMoving: contract("J", "moving-frame-balance", "massEnergy.movingBalanceLight", [
    "value",
    "outside-domain",
  ]),
  emittedEnergyRestFrame: contract("J", "rest-frame-balance", "massEnergy.restBalanceLight", [
    "value",
    "outside-domain",
  ]),
  bodyEnergyRestBefore: contract("J", "body-energy-rest-before", "massEnergy.restBodyBefore", [
    "symbolic",
    "outside-domain",
  ]),
  bodyEnergyRestAfter: contract("J", "body-energy-rest-after", "massEnergy.restBodyAfter", [
    "symbolic",
    "outside-domain",
  ]),
  bodyEnergyMovingBefore: contract(
    "J",
    "body-energy-moving-before",
    "massEnergy.movingBodyBefore",
    ["symbolic", "outside-domain"],
  ),
  bodyEnergyMovingAfter: contract("J", "body-energy-moving-after", "massEnergy.movingBodyAfter", [
    "symbolic",
    "outside-domain",
  ]),
  kineticEnergyDifference: contract(
    "J",
    "kinetic-energy-difference",
    "massEnergy.kineticEnergyDifference",
    ["value", "underdetermined", "outside-domain"],
  ),
  additiveEnergyConstant: contract(
    "J",
    "additive-energy-constant",
    "massEnergy.additiveEnergyConstant",
    ["symbolic", "outside-domain"],
  ),
});

export const ME01_MODEL = Object.freeze({
  id: "mass-energy-two-ledgers-host",
  constantSetId: "modern-si-2019",
  ownerKind: "host-reference",
  label: "Ideal model, host calculation",
  source: "src/physics/reference/massEnergy.ts",
  assumptions: Object.freeze([
    "Symmetric emission of two equal pulses in the rest frame.",
    "The imported §8 light-energy transformation: l* = l(1 - (v/V)cos(phi))/sqrt(1 - (v/V)^2).",
    "Conservation of energy in each inertial reference frame.",
    "The source premise that the additive constant C relating moving and rest energy is unchanged upon emission.",
  ]),
});

/** The instrument's four readings, shown on the reader's detail setting. Mirrored in
 * content/editorial/readings-owners/am-me-01-two-ledgers-g1re.yaml, which the readings audit reads. */
export const ME01_CAPTION = Object.freeze({
  r0: "Two equal flashes of light leave a body at rest in opposite directions. Seen by someone moving past, the flashes carry more energy than they do for the body, and the extra can only come from the body's energy of motion, which falls as if the body had lost mass.",
  r1: "The mass–energy paper imports one result from §8 of the relativity paper: light of energy l, seen from a frame moving at v along x, has energy l* = l(1 − (v/V) cos φ)/√(1 − (v/V)²), where φ is the angle between the light's direction and the x-axis. A body at rest in (x, y, z) sends out light of energy L/2 at the angle φ and an equal amount the opposite way, and stays at rest. The energy principle must hold in both frames: in the rest frame E₀ − E₁ = L, and in the moving one H₀ − H₁ = γL, writing γ for 1/√(1 − (v/V)²), because the two direction factors, 1 − (v/V) cos φ and 1 + (v/V) cos φ, add to 2. The body's energies E and H stay symbolic, and the lab never gives them values. Subtracting the two balances removes them: (H₀ − E₀) − (H₁ − E₁) = L{1/√(1 − (v/V)²) − 1}. Each H − E is the body's kinetic energy K in the moving frame plus a constant C, and C does not change during the emission, so K₀ − K₁ = L{1/√(1 − (v/V)²) − 1}. At the lab's default, L = 1 J and v = 0.6c, the moving observer counts 1.25 J of light, and the body's kinetic energy falls by 0.25 J whatever the angle. Drop the premise that C is unchanged and the difference is underdetermined, and the lab says so. To lowest order the drop is (L/V²)(v²/2), the kinetic energy of a mass L/V², and the paper concludes that a body giving off energy L as radiation loses mass L/V².",
  r2: "Start with the factor 1/√(1 − (v/V)²). At v = 0.6c it is 1/√0.64 = 1.25. Take L = 1 J, so each flash carries 0.5 J in the body's frame. Along the x-axis, φ = 0: the forward flash, going the same way as the moving observer, has 0.5 × 1.25 × (1 − 0.6) = 0.25 J in the moving frame, and the backward flash has 0.5 × 1.25 × (1 + 0.6) = 1.0 J, together 1.25 J. At φ = 60° the factors are 1 − 0.3 and 1 + 0.3, giving 0.4375 J and 0.8125 J, again 1.25 J: the angle cancels because the two factors always sum to 2, the flashes going in opposite directions. Now write both energy balances. In the body's frame the body loses exactly what the light carries, E₀ − E₁ = 1 J. In the moving frame it loses what the light carries there, H₀ − H₁ = 1.25 J. Subtract the first from the second: (H₀ − E₀) − (H₁ − E₁) = 1.25 − 1 = 0.25 J. Nothing about the body's internal energy was needed, because E₀, E₁, H₀ and H₁ appear only in differences. What is H − E? It is the same body's energy seen from two frames, one in which it rests and one in which it moves, so it is its kinetic energy K in the moving frame plus a constant C that depends only on where each frame puts its zero of energy. With C unchanged, the constants cancel, and K₀ − K₁ = L(γ − 1) = 0.25 J. If C could change during the emission, the two constants would not cancel, and the subtraction would leave K₀ − K₁ tied to an unknown change in C; that is why the lab reports the result as underdetermined when the premise is dropped. The body moves at the same speed before and after, since it stays at rest in its own frame, so a smaller kinetic energy at the same speed means a smaller mass. For slow motion, 1/√(1 − (v/V)²) − 1 ≈ (v/V)²/2, so K₀ − K₁ ≈ (L/V²)(v²/2), which is ½mv² with m = L/V². At 0.6c the approximation gives 0.18 J against the exact 0.25 J. For L = 1 J the mass lost is 1/(2.998 × 10^{8})² = 1.11 × 10^{−17} kg.",
  r3: "The paper, received on 27 September 1905, writes the factor in full as 1/√(1 − v²/V²), V for the speed of light, L for the emitted energy and l* for the transformed light energy. It cites §8 of the June paper for that transformation and notes in a footnote that the constancy of the speed of light used there is contained in Maxwell's equations. It states the result as L/V², and in cgs units as a mass change of L/9 · 10^{20} grams for L ergs, and suggests that radium salts might test it. The mass statement rests on the lowest-order term in v/V and on the source premise that C is unchanged. Planck gave a more general treatment in 1907, and Ives argued in 1952 that the 1905 argument was circular, a reading others have disputed. The paper itself says only that the mass of a body is a measure of its energy content.",
});

export type Me01Preset = Readonly<{
  presetId: string;
  label: string;
  parameterValues: Me01Parameters;
}>;

export const ME01_PRESETS: readonly Me01Preset[] = Object.freeze([
  {
    presetId: "me-01-default",
    label: "Collinear emission (v = 0.6c, φ = 0°)",
    parameterValues: {
      frameSpeed: 0.6,
      emittedEnergyRestFrame: 1.0,
      emissionAngle: 0,
      offsetDisplay: "symbolic",
      premise: "unchanged",
      step: "subtraction-move",
      cancelAngleFactors: true,
      cancelInternalEnergies: true,
      cancelAdditiveConstant: true,
      notation: "printed",
    },
  },
  {
    presetId: "me-01-transverse-emission",
    label: "Transverse emission (v = 0.6c, φ = 90°)",
    parameterValues: {
      frameSpeed: 0.6,
      emittedEnergyRestFrame: 1.0,
      emissionAngle: 90,
      offsetDisplay: "symbolic",
      premise: "unchanged",
      step: "moving-pulses",
      cancelAngleFactors: true,
      cancelInternalEnergies: true,
      cancelAdditiveConstant: true,
      notation: "printed",
    },
  },
  {
    presetId: "me-01-sixty-degree-tilt",
    label: "Tilted axis (v = 0.6c, φ = 60°)",
    parameterValues: {
      frameSpeed: 0.6,
      emittedEnergyRestFrame: 1.0,
      emissionAngle: 60,
      offsetDisplay: "symbolic",
      premise: "unchanged",
      step: "sum-angle",
      cancelAngleFactors: true,
      cancelInternalEnergies: true,
      cancelAdditiveConstant: true,
      notation: "printed",
    },
  },
  {
    presetId: "me-01-rest-frame",
    label: "Stationary observer (v = 0)",
    parameterValues: {
      frameSpeed: 0.0,
      emittedEnergyRestFrame: 1.0,
      emissionAngle: 0,
      offsetDisplay: "symbolic",
      premise: "unchanged",
      step: "two-balances",
      cancelAngleFactors: true,
      cancelInternalEnergies: true,
      cancelAdditiveConstant: true,
      notation: "printed",
    },
  },
]);

export const ME01_PROMPTS = Object.freeze({
  tiltAxis: {
    promptId: "me-01-predict-tilt-axis",
    question:
      "If the body emits the two opposite pulses at an angle φ = 60° rather than along the direction of motion (φ = 0°), what happens to the total energy of the two light pulses measured by the moving observer?",
    candidates: Object.freeze([
      {
        id: "me-01-candidate-sum-decreases",
        label: "The total light energy decreases because the forward pulse is less blue-shifted.",
        isCorrect: false,
      },
      {
        id: "me-01-candidate-sum-unchanged",
        label: "The total light energy is unchanged, because what one pulse gains the other loses.",
        isCorrect: true,
      },
      {
        id: "me-01-candidate-sum-increases",
        label: "The total light energy increases due to the transverse Doppler effect.",
        isCorrect: false,
      },
    ]),
    explanation:
      "The two pulses have energies (L/2)γ(1 - β cos φ) and (L/2)γ(1 + β cos φ). In the sum, the terms -β cos φ and +β cos φ cancel identically for any angle φ, leaving exactly γL.",
  },
});
