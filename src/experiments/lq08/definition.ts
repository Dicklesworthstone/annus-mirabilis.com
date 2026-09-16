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
