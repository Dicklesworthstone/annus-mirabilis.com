import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export type Lq06SubexpressionChoice =
  | "none"
  | "E"
  | "nu"
  | "E_over_beta_nu"
  | "N_E_over_R_beta_nu"
  | "V";

export type Lq06ProposedEnergy = "none" | "E" | "h_nu" | "R_beta_nu_over_N" | "k_B_T" | "arbitrary";

export type Lq06ForkAChoice = "none" | "coincidence" | "independent-quanta";

export type Lq06Parameters = Readonly<{
  radiationEnergy: number; // E, J
  frequency: number; // nu, Hz
  gasParticles: number; // n, count
  volumeRatio: number; // V / V0, dimensionless
  temperature: number; // T, K (for mean energy comparison)
  selectedSubexpression: Lq06SubexpressionChoice;
  proposedEnergyElement: Lq06ProposedEnergy;
  forkAChoice: Lq06ForkAChoice;
  constantSetId: string; // "modern-si-2019" | "einstein-1905-light-quanta-printed"
}>;

export const LQ06_DEFAULTS: Lq06Parameters = Object.freeze({
  radiationEnergy: 9.055615e-9, // Golden state from LQ-04
  frequency: 6.0e14, // 600 THz
  gasParticles: 10,
  volumeRatio: 0.5,
  temperature: 3000,
  selectedSubexpression: "none",
  proposedEnergyElement: "none",
  forkAChoice: "none",
  constantSetId: "modern-si-2019",
});

export const LQ06_CLASSES: Readonly<Record<keyof Lq06Parameters, ParameterClass>> = Object.freeze({
  radiationEnergy: "input",
  frequency: "input",
  gasParticles: "input",
  volumeRatio: "measurement",
  temperature: "input",
  selectedSubexpression: "presentation",
  proposedEnergyElement: "presentation",
  forkAChoice: "presentation",
  constantSetId: "input",
});

export const LQ06_MODEL = Object.freeze({
  id: "lq-06-host-v1",
  constantSetId: "modern-si-2019",
  label: "Matching the entropy coefficients · host calculation",
  assumptions: Object.freeze([
    "Wien radiation law holds for monochromatic radiation of energy E in volume V_0.",
    "Ideal gas of n independent point particles in volume V_0 obeys Boltzmann's principle S - S_0 = (R/N) ln W.",
    "Low radiation density regime (h*nu / k_B*T >> 1).",
  ]),
  notModeled: Object.freeze([
    "Radiation outside the Wien regime (e.g. Rayleigh-Jeans low frequencies or high temperatures)",
    "Mechanism of emission or absorption (developed in §§7–9)",
    "Spatial wave propagation or interference in the cavity",
    "Finite wall interactions and boundary conditions",
  ]),
});

export const LQ06_QUESTION =
  "Why does the same functional form suggest independent energy quanta, what exactly follows from the algebra, and what is a further hypothesis?";

export const LQ06_NOT_MODELED: readonly string[] = Object.freeze([
  "Radiation outside the Wien regime",
  "Mechanism of emission and absorption (reserved for §§7–9)",
  "Cavity wall dynamics and boundary interactions",
  "Wave interference patterns inside the volume",
]);

const c = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });

const OUTSIDE = ["value", "outside-domain", "not-applicable"] as const;

export const LQ06_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  radiationEnergy: c("J", "radiation-energy", "lq06.acceptedInputs"),
  frequency: c("Hz", "frequency", "lq06.acceptedInputs"),
  volumeRatio: c("1", "volume-ratio", "lq06.acceptedInputs"),
  independentPointCount: c("1", "count", "lq06.acceptedInputs"),
  effectiveIndependentCount: c("1", "effective-independent-count", "radiation.quanta", OUTSIDE),
  quantumEnergy: c("J", "quantum-energy", "radiation.quanta", OUTSIDE),
  quantumEnergyEv: c("eV", "quantum-energy", "radiation.quanta", OUTSIDE),
  radiationEntropy: c("J/K", "radiation-entropy-change", "radiation.entropy", OUTSIDE),
  gasEntropy: c("J/K", "entropy", "radiation.configurations", OUTSIDE),
  entropyVolumeCoefficient: c("J/K", "entropy-volume-coefficient", "radiation.entropy", OUTSIDE),
  gasEntropyVolumeCoefficient: c(
    "J/K",
    "entropy-volume-coefficient",
    "radiation.configurations",
    OUTSIDE,
  ),
  meanQuantumEnergyWien: c("J", "mean-quantum-energy", "radiation.quanta", OUTSIDE),
  meanQuantumEnergyWienEv: c("eV", "mean-quantum-energy", "radiation.quanta", OUTSIDE),
  moleculeMeanKineticEnergyEv: c("eV", "energy", "radiation.quanta", OUTSIDE),
  meanEnergyRatio: c("1", "dimensionless-ratio", "radiation.quanta", OUTSIDE),
  ratioAt600THz: c("1", "dimensionless-ratio", "radiation.quanta", OUTSIDE),
  correspondenceVerdict: c("1", "verdict", "lq06.correspondence", ["value", "not-applicable"]),
});

export const LQ06_PRESETS: Readonly<
  Record<
    string,
    Readonly<{ id: string; label: string; description: string; parameters: Lq06Parameters }>
  >
> = Object.freeze({
  theMove: Object.freeze({
    id: "lq-06-the-move",
    label: "The Move (§6 Golden State, 600 THz, 9.06 nJ)",
    description:
      "Golden state: E = 9.055615 nJ, nu = 600 THz, yielding n_eff = 2.277774 × 10^10 quanta of energy 2.4814 eV each.",
    parameters: Object.freeze({
      radiationEnergy: 9.055615e-9,
      frequency: 6.0e14,
      gasParticles: 10,
      volumeRatio: 0.5,
      temperature: 3000,
      selectedSubexpression: "N_E_over_R_beta_nu",
      proposedEnergyElement: "h_nu",
      forkAChoice: "independent-quanta",
      constantSetId: "modern-si-2019",
    }),
  }),
  unrevealedPrompt: Object.freeze({
    id: "lq-06-unrevealed",
    label: "Unrevealed Comparison (Interactive Deduction)",
    description: "Side-by-side entropy formulas before proposing the correspondence.",
    parameters: Object.freeze({
      radiationEnergy: 9.055615e-9,
      frequency: 6.0e14,
      gasParticles: 10,
      volumeRatio: 0.5,
      temperature: 3000,
      selectedSubexpression: "none",
      proposedEnergyElement: "none",
      forkAChoice: "none",
      constantSetId: "modern-si-2019",
    }),
  }),
  forkACoincidence: Object.freeze({
    id: "lq-06-fork-a-coincidence",
    label: "Fork A: Coincidence Branch",
    description:
      "Treating the mathematical identity as an accidental formal coincidence, preserving wave electrodynamics.",
    parameters: Object.freeze({
      radiationEnergy: 9.055615e-9,
      frequency: 6.0e14,
      gasParticles: 10,
      volumeRatio: 0.5,
      temperature: 3000,
      selectedSubexpression: "N_E_over_R_beta_nu",
      proposedEnergyElement: "h_nu",
      forkAChoice: "coincidence",
      constantSetId: "modern-si-2019",
    }),
  }),
  historicalConstants: Object.freeze({
    id: "lq-06-historical-constants",
    label: "Historical Printed Constants (R, beta, N)",
    description:
      "Einstein's printed values R = 8.31 × 10^7, beta = 4.866 × 10^-11, N = 6.17 × 10^23 giving R*beta/N = 6.5537 × 10^-27 erg·s.",
    parameters: Object.freeze({
      radiationEnergy: 9.055615e-9,
      frequency: 6.0e14,
      gasParticles: 10,
      volumeRatio: 0.5,
      temperature: 3000,
      selectedSubexpression: "N_E_over_R_beta_nu",
      proposedEnergyElement: "R_beta_nu_over_N",
      forkAChoice: "independent-quanta",
      constantSetId: "einstein-1905-light-quanta-printed",
    }),
  }),
});
