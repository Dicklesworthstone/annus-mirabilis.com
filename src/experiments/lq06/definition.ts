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

/**
 * The instrument's four readings (R0 to R3), checked against §4 to §6 of the light paper
 * (transcript ap-17-132, Annalen pp. 141–144) and against the prepared default snapshot
 * (lq06-example.json): E = 9.056 × 10^{−9} J at 600 THz, 2.28 × 10^{10} quanta of 2.48 eV, the
 * entropy changes −2.18 × 10^{−13} and −9.57 × 10^{−23} J/K at half the volume, and the Wien mean
 * 0.776 eV against 0.388 eV at 3000 K. The readings-owners record
 * am-lq-06-coefficient-match-n8pe.yaml carries the same text.
 */
export const LQ06_CAPTION = Object.freeze({
  r0: "When faint light of one colour is squeezed into half the room, its entropy falls by the same rule as a gas of independent particles does. Matching the two rules says how many particles the light would have to contain, and so how much energy each one carries, an amount set by the colour of the light.",
  r1: "Section 4 found that radiation of energy E in a narrow band at frequency ν, where Wien's law holds, changes its entropy with volume as S − S_{0} = (E/βν) ln(v/v_{0}). Section 5 used Boltzmann's principle, S − S_{0} = (R/N) ln W: for n independent moving points the probability that all of them are in a part v of the volume v_{0} is W = (v/v_{0})^{n}, so S − S_{0} = (R/N) n ln(v/v_{0}). Section 6 writes the radiation result in the same form, S − S_{0} = (R/N) ln[(v/v_{0})^{(N/R)(E/βν)}], and reads off the probability that all the radiation energy is in v. The exponent plays the part of n: the energy behaves as if it consisted of n = NE/(Rβν) independent quanta, each of size Rβν/N, which is hν. At the defaults, 9.06 × 10^{−9} J at 600 THz, that is 2.28 × 10^{10} quanta of 2.48 eV. Halving the volume lowers the radiation's entropy by 2.18 × 10^{−13} J/K, as it would for a gas of that many points; the instrument's gas of 10 points loses 9.57 × 10^{−23} J/K. Einstein then compared the mean quantum of a whole Wien spectrum, 3(R/N)T, with a molecule's mean kinetic energy, (3/2)(R/N)T: at 3000 K, 0.776 eV against 0.388 eV, a factor of 2.",
  r2: "Boltzmann's principle ties entropy to probability: S − S_{0} = (R/N) ln W, where R/N, the gas constant divided by the number of molecules in a mole, is 1.381 × 10^{−23} J/K. Take n independent points moving about a box of volume v_{0}. The chance that one of them is, at a given moment, in a part v of the box is v/v_{0}. Because they move independently, the chance that all n are there together is the product, (v/v_{0})^{n}. With 10 points and half the box, that is (1/2)^{10} = 1/1024. The entropy difference is then (R/N) ln[(v/v_{0})^{n}] = (R/N) n ln(v/v_{0}) = 1.381 × 10^{−23} × 10 × ln 0.5 = −9.57 × 10^{−23} J/K. Now the radiation. Section 4 gives S − S_{0} = (E/βν) ln(v/v_{0}). Pull R/N out in front, E/βν = (R/N) × (N/R)(E/βν), and use the rule that a number times a logarithm is the logarithm of a power: S − S_{0} = (R/N) ln[(v/v_{0})^{(N/R)(E/βν)}]. Set this beside the gas. The two have the same form if n = (N/R)(E/βν). Divide the energy by that count to find the energy of one part: E/n = Rβν/N. With today's constants Rβ/N is Planck's h, 6.626 × 10^{−34} J s, so each part carries hν = 6.626 × 10^{−34} × 6.00 × 10^{14} = 3.976 × 10^{−19} J, or 2.48 eV. The defaults hold E = 9.056 × 10^{−9} J, so n = 9.056 × 10^{−9}/(3.976 × 10^{−19}) = 2.28 × 10^{10}. The radiation's coefficient E/βν is n times R/N, 2.28 × 10^{10} × 1.381 × 10^{−23} = 3.145 × 10^{−13} J/K, and halving the volume changes the entropy by 3.145 × 10^{−13} × ln 0.5 = −2.18 × 10^{−13} J/K. The probability that all that light is in one half at once is 1/2 raised to the power 2.28 × 10^{10}, too small to write out. Last, the mean quantum. Over a whole Wien spectrum at temperature T, the energy per unit frequency is αν^{3}e^{−βν/T}, and the number of quanta per unit frequency is that divided by Rβν/N; the ratio of the two integrals is 3(R/N)T. At 3000 K that is 3 × 1.381 × 10^{−23} × 3000 = 1.243 × 10^{−19} J, or 0.776 eV, twice a gas molecule's (3/2)(R/N)T = 0.388 eV. A 600 THz quantum, at 2.48 eV, is 3.20 times the mean.",
  r3: "Einstein wrote lg for the natural logarithm and v for the volume, and he never wrote h: the quantum is Rβν/N, built from the values of R, N and β that Planck had used. With R = 8.31 × 10^{7} erg per mole and kelvin, N = 6.17 × 10^{23} and β = 4.866 × 10^{−11} s K, Rβ/N comes to 6.55 × 10^{−27} erg s, about 1.1 percent below the modern h; the paper does not print the product. He stated the conclusion with its limits: monochromatic radiation of low density, within the range of Wien's formula, behaves thermodynamically as if it consisted of mutually independent quanta. Planck had introduced energy elements hν in 1900 for the resonators of his cavity, not for the radiation itself. The comparison of 3(R/N)T with (3/2)(R/N)T is Einstein's own, at the end of Section 6.",
});
