import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export type Lq08Parameters = Readonly<{
  incidentPower: number;
  frequency: number;
  workFunction: number;
  quantumEfficiency: number;
  collectorPotential: number;
}>;

export const LQ08_DEFAULTS: Lq08Parameters = Object.freeze({
  incidentPower: 0.001, // 1 mW in Watts
  frequency: 6.0e14, // 600 THz in Hz
  workFunction: 2.2, // 2.2 eV (Sodium default)
  quantumEfficiency: 0.1, // 10%
  collectorPotential: 0.0, // 0 V
});

export const LQ08_CLASSES: Readonly<Record<keyof Lq08Parameters, ParameterClass>> = Object.freeze({
  incidentPower: "input",
  frequency: "input",
  workFunction: "input",
  quantumEfficiency: "input",
  collectorPotential: "measurement",
});

export const LQ08_MODEL = Object.freeze({
  id: "lq08-photoelectric-reference-v1",
  constantSetId: "modern-si-2019",
  label: "Photoelectric apparatus · reference model, host calculation",
});

const c = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });

export const LQ08_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  incidentPower: c("W", "radiant-power", "lq08.acceptedInputs"),
  frequency: c("Hz", "monochromatic-frequency", "lq08.acceptedInputs"),
  workFunction: c("eV", "work-function", "lq08.acceptedInputs"),
  quantumEfficiency: c("1", "quantum-efficiency", "lq08.acceptedInputs"),
  collectorPotential: c("V", "collector-potential", "lq08.acceptedInputs"),
  quantumEnergy: c("J", "quantum-energy", "photoelectric.quantumEnergy"),
  thresholdFrequency: c("Hz", "threshold-frequency", "photoelectric.thresholdFrequency"),
  maxKineticEnergy: c("J", "max-kinetic-energy", "photoelectric.kMax", [
    "value",
    "not-applicable",
    "outside-domain",
  ]),
  stoppingPotentialMagnitude: c(
    "V",
    "stopping-potential",
    "photoelectric.stoppingPotentialMagnitude",
    ["value", "not-applicable", "outside-domain"],
  ),
  quantumRate: c("s^-1", "quantum-rate", "photoelectric.quantumRate"),
  emissionRate: c("s^-1", "emission-rate", "photoelectric.emissionRate"),
  photocurrent: c("A", "photocurrent", "photoelectric.photocurrent", [
    "value",
    "underdetermined",
    "outside-domain",
  ]),
});

export const LQ08_NOT_MODELED: readonly string[] = Object.freeze([
  "Real-material electron energy distributions and yields",
  "Contact potentials and surface states",
  "Space charge",
  "Reflection losses",
  "Emission angles",
  "Multi-photon or thermionic emission",
  "The timing of individual emissions",
  "Energy transfer models beyond the declared complete or partial cases",
  "Any claim that the moving marks depict photons",
]);

export const LQ08_PRESETS = Object.freeze({
  intensityProbe: Object.freeze({
    id: "lq-08-intensity-probe",
    label: "The intensity probe (rate vs energy)",
    description: "Monochromatic 600 THz on hypothetical Phi = 2.0 eV with 1 mW incident power.",
    parameters: Object.freeze({
      incidentPower: 0.001,
      frequency: 6.0e14,
      workFunction: 2.0,
      quantumEfficiency: 0.1,
      collectorPotential: 0.0,
    }),
  }),
  historicalCheck: Object.freeze({
    id: "lq-08-historical-check",
    label: "Einstein 1905 §8 check (Lenard spark order-of-magnitude)",
    description: "Einstein's 1905 order-of-magnitude check with neglected escape work (P' = 0).",
    parameters: Object.freeze({
      incidentPower: 0.001,
      frequency: 1.03e15,
      workFunction: 0.0,
      quantumEfficiency: 0.1,
      collectorPotential: 0.0,
    }),
  }),
  twoMetals: Object.freeze({
    id: "lq-08-two-metals",
    label: "Two metals comparison (2.0 eV vs 3.0 eV)",
    description: "Compare stopping line slopes and threshold shifts between two metals.",
    parameters: Object.freeze({
      incidentPower: 0.001,
      frequency: 8.0e14,
      workFunction: 3.0,
      quantumEfficiency: 0.1,
      collectorPotential: 0.0,
    }),
  }),
  // Aliases for backwards compatibility
  sodiumStandard: Object.freeze({
    id: "sodium-standard",
    label: "Sodium Standard (Yellow-Green, 600 THz)",
    description: "Monochromatic 600 THz (~500 nm) on fresh sodium (Phi = 2.2 eV).",
    parameters: Object.freeze({
      incidentPower: 0.001,
      frequency: 6.0e14,
      workFunction: 2.2,
      quantumEfficiency: 0.1,
      collectorPotential: 0.0,
    }),
  }),
  subThreshold: Object.freeze({
    id: "sub-threshold",
    label: "Sub-Threshold (Red Light, 450 THz)",
    description: "450 THz red light: photon energy 1.86 eV < 2.2 eV. No electrons emitted.",
    parameters: Object.freeze({
      incidentPower: 0.005,
      frequency: 4.5e14,
      workFunction: 2.2,
      quantumEfficiency: 0.1,
      collectorPotential: 0.0,
    }),
  }),
});
