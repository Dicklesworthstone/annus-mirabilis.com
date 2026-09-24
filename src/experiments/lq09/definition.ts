import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export type Lq09AbsorptionMode = "all-absorbed-ionizes" | "declared-fraction" | "unknown";

export type Lq09Parameters = Readonly<{
  frequency: number; // in Hz
  ionizationEnergyEv: number; // J_mol in eV
  incidentPower: number; // in Watts
  absorptionEfficiency: number; // eta_abs in [0, 1]
  duration: number; // in seconds
  absorptionMode: Lq09AbsorptionMode;
  declaredFraction: number; // a in [0, 1]
  gasName: string;
  gasCitation: string;
}>;

export const LQ09_DEFAULTS: Lq09Parameters = Object.freeze({
  frequency: 2.90159e15, // 2901.59 THz (12.0 eV)
  ionizationEnergyEv: 10.0, // 10.0 eV
  incidentPower: 1e-6, // 1 uW (10^-6 W)
  absorptionEfficiency: 0.5, // 50%
  duration: 1.0, // 1.0 s
  absorptionMode: "all-absorbed-ionizes",
  declaredFraction: 1.0,
  gasName: "Air (Lenard 1900 reference)",
  gasCitation: "P. Lenard, Ann. d. Phys. 3, p. 298, 1900",
});

export const LQ09_CLASSES: Readonly<Record<keyof Lq09Parameters, ParameterClass>> = Object.freeze({
  frequency: "input",
  ionizationEnergyEv: "input",
  incidentPower: "input",
  absorptionEfficiency: "input",
  duration: "input",
  absorptionMode: "input",
  declaredFraction: "input",
  gasName: "input",
  gasCitation: "input",
});

export const LQ09_QUESTION =
  "How does single-quantum energy conservation set the frequency threshold for gas ionization, and what determines the relation between absorbed light energy and the count of ionized molecules?";

/** The instrument's four readings, shown on the reader's detail setting. Mirrored in
 * content/editorial/readings-owners/am-lq-09-ionization-mbul.yaml, which the readings audit reads. */
export const LQ09_CAPTION = Object.freeze({
  r0: "If ultraviolet light ionizes a gas one quantum at a time, each quantum must carry at least the work needed to ionize one molecule, and the number of molecules ionized should equal the number of quanta absorbed. Einstein proposed the second statement as a test worth making.",
  r1: "§9 assumes that in the ionization of a gas by ultraviolet light each absorbed light quantum ionizes one gas molecule. Two consequences follow. First, the ionization work per gram-equivalent, J, cannot exceed the energy of the absorbed quanta: Rβν ≥ J, or per molecule hν ≥ J. Second, absorbed light energy L ionizes j = L/(Rβν) gram-molecules, for any gas that shows no appreciable absorption without ionization at that frequency. The instrument works both at its defaults: J = 10 eV per molecule, light of 2901.59 THz whose quanta carry 12.0 eV, 2.0 eV more than needed, so the threshold is 2418 THz, a wavelength of 124 nm. With 1 μW of light, half of it absorbed, for 1 s, L = 5 × 10^{−7} J, and 2.60 × 10^{11} quanta are absorbed; if each ionizes one molecule, 2.60 × 10^{11} molecules are ionized, 4.32 × 10^{−13} gram-molecules. If only a declared share ionizes, the count is that share of the quanta, 7.80 × 10^{10} for a share of 0.3. If the share is unknown, the lab reports the count as not fixed, with the absorbed quanta as its upper limit, and never more ions than quanta. Below the threshold, at 2000 THz (8.27 eV), no single quantum can ionize, and the count is not applicable rather than zero. A named gas must come with a cited source for its ionization energy.",
  r2: "Start with one quantum. Its energy is hν; at 2901.59 THz that is 6.626 × 10^{−34} J·s × 2.90159 × 10^{15} s^{−1} = 1.923 × 10^{−18} J, which is 12.0 eV. To ionize a molecule the quantum must supply the ionization work, here J = 10 eV, so it has 2.0 eV to spare. The lowest frequency that can do it is where hν equals J: ν = J/h = 10 eV/(4.136 × 10^{−15} eV·s) = 2.418 × 10^{15} s^{−1}, or 2418 THz, and the wavelength there is c/ν = 124 nm. At 2000 THz a quantum carries only 8.27 eV, 1.73 eV short, so under §9's assumption nothing is ionized, however much light arrives, because no quantum can pool its energy with another. Now count. 1 μW for 1 s is 10^{−6} J of light; half is absorbed, so L = 5 × 10^{−7} J. Dividing by the energy of one quantum, 5 × 10^{−7}/1.923 × 10^{−18} = 2.60 × 10^{11} quanta absorbed. If every absorbed quantum ionizes one molecule, 2.60 × 10^{11} molecules are ionized. A gram-molecule holds N = 6.022 × 10^{23} molecules, so that is 2.60 × 10^{11}/6.022 × 10^{23} = 4.32 × 10^{−13} gram-molecules, which is Einstein's j = L/(Rβν) written per molecule: L divided by N hν. If only a share a of the absorbed quanta ionize, multiply by a: 0.3 × 2.60 × 10^{11} = 7.80 × 10^{10}. If the share is unknown, the equation no longer fixes a number; all that survives is that ions cannot outnumber absorbed quanta, since each ion needs a quantum of its own. That is why the lab states an upper limit and not a value. §9 restricts j = L/(Rβν) to gases with no appreciable absorption unaccompanied by ionization, because light absorbed in some other way would add to L without adding ions.",
  r3: "Einstein compared the first consequence with two measurements. Lenard's largest wavelength effective in ionizing air, about 1.9 × 10^{−5} cm, gives Rβν = 6.4 × 10^{12} erg per gram-equivalent, about 6.5 eV per molecule, as an upper limit for J; Stark's smallest ionization voltage for air, about 10 volts at platinum anodes, gives the upper limit 9.6 × 10^{12}, which Einstein called nearly equal, while noting in a footnote that inside the gas the ionization voltage for negative ions is five times larger. The count j = L/(Rβν) was offered as the test he thought most important, not as a result. Modern first ionization energies of oxygen and nitrogen molecules, about 12.1 and 15.6 eV, exceed both limits, so what Lenard and Stark measured cannot have been the single-quantum ionization of those molecules that §9 assumed. The lab's default of 10 eV follows Stark's figure.",
});

export const LQ09_MODEL = Object.freeze({
  id: "lq09-ionization-reference-v1",
  constantSetId: "modern-si-2019",
  label: "Gas ionization bounds and count · reference model, host calculation",
});

const c = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });

export const LQ09_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  incidentPower: c("W", "radiant-power", "lq09.acceptedInputs"),
  frequency: c("Hz", "monochromatic-frequency", "lq09.acceptedInputs"),
  ionizationEnergyPerMolecule: c("eV", "ionization-energy", "lq09.acceptedInputs"),
  absorptionEfficiency: c("1", "absorption-efficiency", "lq09.acceptedInputs"),
  duration: c("s", "duration", "lq09.acceptedInputs"),
  absorbedLightEnergy: c("J", "energy", "photoelectric.ionizationCount"),
  quantumEnergy: c("J", "quantum-energy", "photoelectric.ionizationBounds"),
  quantumEnergyEv: c("eV", "quantum-energy", "photoelectric.ionizationBounds"),
  thresholdFrequency: c("Hz", "threshold-frequency", "photoelectric.ionizationBounds"),
  thresholdWavelengthNm: c("nm", "wavelength", "photoelectric.ionizationBounds"),
  excessEnergyEv: c("eV", "energy", "photoelectric.ionizationBounds"),
  singleQuantumAllowed: c("1", "boolean-verdict", "photoelectric.ionizationBounds"),
  quantumRate: c("s^-1", "quantum-rate", "photoelectric.ionizationCount"),
  absorbedQuantumRate: c("s^-1", "quantum-rate", "photoelectric.ionizationCount"),
  ionizationRate: c("s^-1", "ionization-rate", "photoelectric.ionizationCount", [
    "value",
    "not-applicable",
    "underdetermined",
    "outside-domain",
  ]),
  ionizationCount: c("1", "count", "photoelectric.ionizationCount", [
    "value",
    "not-applicable",
    "underdetermined",
    "outside-domain",
  ]),
  ionizedGramMolecules: c("mol", "amount-of-substance", "photoelectric.ionizationCount", [
    "value",
    "not-applicable",
    "underdetermined",
    "outside-domain",
  ]),
});

export const LQ09_NOT_MODELED: readonly string[] = Object.freeze([
  "Secondary ionization and cascade ionization by energetic photoelectrons in dense gases",
  "Multi-photon ionization processes occurring at extreme optical field intensities",
  "Molecular dissociation channels competing with direct ionization without charge separation",
  "Collisional de-excitation and recombination kinetics over extended reaction times",
  "Spatial beam divergence, gas column pressure gradients, and non-uniform absorption profiles",
  "Detailed autoionization resonances and vibrational-electronic coupling manifolds",
]);

export const LQ09_PRESETS = Object.freeze({
  thresholdStandard: Object.freeze({
    id: "lq-09-threshold",
    label: "Golden Standard (12 eV UV, 10 eV Ionization)",
    description: "2901.59 THz (12.0 eV) on 10.0 eV ionization threshold with 50% absorption.",
    parameters: Object.freeze({
      frequency: 2.90159e15,
      ionizationEnergyEv: 10.0,
      incidentPower: 1e-6,
      absorptionEfficiency: 0.5,
      duration: 1.0,
      absorptionMode: "all-absorbed-ionizes" as Lq09AbsorptionMode,
      declaredFraction: 1.0,
      gasName: "Air (Lenard 1900 reference)",
      gasCitation: "P. Lenard, Ann. d. Phys. 3, p. 298, 1900",
    }),
  }),
  subThreshold: Object.freeze({
    id: "lq-09-sub-threshold",
    label: "Sub-Threshold (9 eV UV, 10 eV Ionization)",
    description:
      "2176.19 THz (9.0 eV) light below the 10.0 eV threshold: no single-quantum ionization.",
    parameters: Object.freeze({
      frequency: 2.17619e15,
      ionizationEnergyEv: 10.0,
      incidentPower: 1e-6,
      absorptionEfficiency: 0.5,
      duration: 1.0,
      absorptionMode: "all-absorbed-ionizes" as Lq09AbsorptionMode,
      declaredFraction: 1.0,
      gasName: "Air (Lenard 1900 reference)",
      gasCitation: "P. Lenard, Ann. d. Phys. 3, p. 298, 1900",
    }),
  }),
  historicalChecks: Object.freeze({
    id: "lq-09-historical-checks",
    label: "Historical Lenard Check (190 nm UV, 6.459 eV)",
    description:
      "Lenard's 1900 longest ionizing wavelength for air, 190 nm (1578.95 THz), about 6.65 volts per unit charge; the paper prints the energy, not the voltage.",
    parameters: Object.freeze({
      frequency: 1.57895e15,
      ionizationEnergyEv: 6.459,
      incidentPower: 1e-6,
      absorptionEfficiency: 1.0,
      duration: 1.0,
      absorptionMode: "all-absorbed-ionizes" as Lq09AbsorptionMode,
      declaredFraction: 1.0,
      gasName: "Air (Lenard 1900)",
      gasCitation: "P. Lenard, Ann. d. Phys. 3, p. 298, 1900",
    }),
  }),
  starkCathodeCheck: Object.freeze({
    id: "lq-09-stark-check",
    label: "Historical Stark Check (10 Volt Cathode Rays)",
    description: "Johannes Stark's 1902 gas ionization threshold at 10 Volts cathode potential.",
    parameters: Object.freeze({
      frequency: 2.37404e15,
      ionizationEnergyEv: 9.948,
      incidentPower: 1e-6,
      absorptionEfficiency: 1.0,
      duration: 1.0,
      absorptionMode: "all-absorbed-ionizes" as Lq09AbsorptionMode,
      declaredFraction: 1.0,
      gasName: "Air (Stark 1902)",
      gasCitation: "J. Stark, Die Elektrizität in Gasen, p. 57, 1902",
    }),
  }),
  declaredFraction: Object.freeze({
    id: "lq-09-fraction-025",
    label: "Declared Efficiency (a = 0.25)",
    description: "25% of absorbed quanta produce ionization; 75% dissipate without ion formation.",
    parameters: Object.freeze({
      frequency: 2.90159e15,
      ionizationEnergyEv: 10.0,
      incidentPower: 1e-6,
      absorptionEfficiency: 0.5,
      duration: 1.0,
      absorptionMode: "declared-fraction" as Lq09AbsorptionMode,
      declaredFraction: 0.25,
      gasName: "Air (test fixture)",
      gasCitation: "Laboratory test fixture",
    }),
  }),
  unknownAbsorption: Object.freeze({
    id: "lq-09-unknown-absorption",
    label: "Unknown Absorption State",
    description:
      "Unmeasured non-ionizing channels: reports underdetermined with N_abs upper bound.",
    parameters: Object.freeze({
      frequency: 2.90159e15,
      ionizationEnergyEv: 10.0,
      incidentPower: 1e-6,
      absorptionEfficiency: 0.5,
      duration: 1.0,
      absorptionMode: "unknown" as Lq09AbsorptionMode,
      declaredFraction: 1.0,
      gasName: "Uncharacterized Gas",
      gasCitation: "Hypothetical scenario fixture",
    }),
  }),
});
