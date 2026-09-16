import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export type Lq03Coordinate = "frequency" | "wavelength";
export type Lq03AxisScale = "linear" | "logarithmic";
export type Lq03Convention = "per-hz" | "per-m" | "per-log" | "per-decade";

export type Lq03Parameters = Readonly<{
  T: number;
  coordinate: Lq03Coordinate;
  axisScale: Lq03AxisScale;
  convention: Lq03Convention;
  nu1: number;
  nu2: number;
  showPlanck: boolean;
  showWien: boolean;
  showClassical: boolean;
  epsilon: number;
  probeNu: number;
}>;

export const LQ03_DEFAULTS: Lq03Parameters = Object.freeze({
  T: 5000,
  coordinate: "frequency",
  axisScale: "logarithmic",
  convention: "per-hz",
  nu1: 4e14,
  nu2: 6e14,
  showPlanck: true,
  showWien: true,
  showClassical: true,
  epsilon: 0.01,
  probeNu: 6e14,
});

export const LQ03_CLASSES: Readonly<Record<keyof Lq03Parameters, ParameterClass>> = Object.freeze({
  T: "input",
  coordinate: "presentation",
  axisScale: "presentation",
  convention: "presentation",
  nu1: "measurement",
  nu2: "measurement",
  showPlanck: "presentation",
  showWien: "presentation",
  showClassical: "presentation",
  epsilon: "estimator",
  probeNu: "measurement",
});

export const LQ03_MODEL = Object.freeze({
  id: "lq-03-host-v1",
  constantSetId: "modern-si-2019",
  label: "Ideal model, host calculation",
});

export const LQ03_QUESTION =
  "What does a measured radiation spectrum look like at a given temperature, in which regime is Wien's law or the classical law an accurate description, and what does a density plot actually measure?";

export const LQ03_NOT_MODELED = Object.freeze([
  "emissivity and cavity imperfections",
  "detector and spectrometer response",
  "polarization",
  "non-equilibrium radiation",
  "any photon or quantum-statistical model beyond the displayed formulas",
]);

const c = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });

export const LQ03_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  frequencyEnergyDensity: c(
    "J/(m^3 Hz)",
    "spectral-energy-density-frequency",
    "radiation.spectra",
    ["value", "outside-domain"],
  ),
  wavelengthEnergyDensity: c(
    "J/(m^3 m)",
    "spectral-energy-density-wavelength",
    "radiation.spectra",
    ["value", "outside-domain"],
  ),
  logIntervalEnergyDensity: c("J/m^3", "log-interval-energy-density", "radiation.spectra", [
    "value",
    "outside-domain",
  ]),
  bandEnergy: c("J/m^3", "band-radiant-energy-density", "radiation.bandIntegration", [
    "value",
    "outside-domain",
  ]),
  peakFrequency: c("Hz", "spectral-peak-frequency", "radiation.spectra"),
  peakWavelength: c("m", "spectral-peak-wavelength", "radiation.spectra"),
  regimeReport: c("1", "wien-classical-regime-report", "radiation.spectra"),
});
