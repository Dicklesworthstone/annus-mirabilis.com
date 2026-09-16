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

export const LQ09_CAPTION = Object.freeze({
  r0: "Single-quantum gas ionization requires photon energy h*nu to meet or exceed the molecular ionization work J_mol. Below this frequency, no single-quantum ionization can occur regardless of beam intensity.",
  r1: "Einstein §9 equates absorbed light energy L with the number of absorbed quanta: j = L / (R*beta*nu). Under the hypothesis that every absorbed quantum ionizes one molecule, the number of ionized gram-molecules is strictly proportional to absorbed energy.",
  r2: "When absorption does not produce ionization with 100% efficiency, the count is a declared fraction a * L / (h*nu), or underdetermined with L / (h*nu) as a strict upper bound. No single-quantum process can yield more ions than absorbed quanta.",
  r3: "Historical note: Einstein tested this threshold against Philipp Lenard's 1900 quartz-transmitted UV air ionization (lambda <= 190 nm, ca. 6.6 V) and Johannes Stark's 1902 cathode-ray gas ionization (ca. 10 V), verifying order-of-magnitude consistency.",
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
    description: "2176.19 THz (9.0 eV) light below the 10.0 eV threshold: no single-quantum ionization.",
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
    description: "Lenard's 1900 quartz UV cutoff at 190 nm (1578.95 THz) corresponding to ca. 6.6 Volt potential.",
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
    description: "Unmeasured non-ionizing channels: reports underdetermined with N_abs upper bound.",
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
