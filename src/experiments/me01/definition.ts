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

export const ME01_CAPTION = Object.freeze({
  r0: "Two equal flashes sent opposite ways: someone moving past measures a larger total, and comparing the two accounts shows the body's energy of motion must drop.",
  r1: "In the rest frame, the body emits two pulses of energy L/2 each, leaving E₀ − E₁ = L. A moving observer measures pulse energies of (L/2)γ(1 − β cos φ) and (L/2)γ(1 + β cos φ), summing to γL regardless of the emission angle φ. Subtracting the rest-frame balance from the moving-frame balance eliminates the unknown internal energies and yields (H₀ − E₀) − (H₁ − E₁) = L(γ − 1).",
  r2: "The angle factors (1 − β cos φ) and (1 + β cos φ) sum to 2 because the pulses are emitted in exactly opposite directions, making the total moving-frame light energy γL completely independent of orientation. Subtracting the rest balance from the moving balance removes the unknown internal rest energies E₀ and E₁. Identifying H − E as kinetic energy K plus an additive constant C that remains unchanged across emission yields K₀ − K₁ = L(γ − 1).",
  r3: "Printed notation presents the explicit radical 1/√(1 − v²/V²) with light speed V, emitted energy L, and angle φ. The derivation rests on the source premise that the additive constant C relating moving-frame energy to rest-frame energy is unchanged by the emission of light, alongside the imported §8 light-energy transformation.",
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
