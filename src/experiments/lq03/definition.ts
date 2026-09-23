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

/**
 * The instrument's four readings (R0 to R3), checked against §1, §2 and §4 of the light paper
 * (transcript ap-17-132, Annalen pp. 133–138) and against evaluateLq03 at the defaults after
 * d55745be: x = 5.76 at 600 THz and 5000 K, Wien 0.32 percent low, the classical law 54.9 times
 * Planck's, boundaries x = 4.61 and 0.0199, peaks 294 THz, 580 nm (517 THz) and 408 THz, and a
 * band energy of 0.129 J/m³ both ways. The readings-owners record am-lq-03-spectrum-08vz.yaml
 * carries the same text.
 */
export const LQ03_CAPTION = Object.freeze({
  r0: "A hot body glows at every frequency, most brightly in a middle range that moves higher as the body gets hotter. Wien's formula matches the glow closely at high frequencies and the older classical rule matches it at low ones, and each fails badly where the other works.",
  r1: "Section 1 derives what Maxwell's theory and the electron theory predict for radiation in equilibrium with resonators and a gas: each resonator carries a mean energy (R/N)T, and Planck's relation between resonator and radiation then gives ρ_{ν} = (R/N)(8πν^{2}/L^{3})T. Einstein says this law disagrees with experience and makes the total energy infinite. Section 2 takes Planck's formula, ρ_{ν} = αν^{3}/(e^{βν/T} − 1), which fits all experience so far; for large T/ν it becomes the law of Section 1, and matching the two gives N = 6.17 × 10^{23}. Section 4 works in the opposite limit with Wien's law, ρ = αν^{3}e^{−βν/T}, confirmed for large ν/T, keeping in mind that its results hold only within limits. The instrument draws all three. At 5000 K and a probe at 600 THz, where x = hν/k_{B}T = 5.76, Wien's law is 0.32 percent below Planck's and the classical law gives 54.9 times Planck's value; within a 1 percent tolerance Wien's law holds for x above 4.61 and the classical law for x below 0.0199. The peak depends on how the density is measured: per unit frequency at 294 THz, per unit wavelength at 580 nm, per logarithmic interval at 408 THz. The energy in a band, 0.129 J/m^{3} between 400 and 600 THz, is the same whichever axis is used.",
  r2: "Write x = hν/k_{B}T, the ratio of one quantum's energy to the thermal energy. At 5000 K, k_{B}T/h = 1.042 × 10^{14} Hz, so 600 THz is x = 6.00/1.042 = 5.76. Planck's law is u = (8πhν^{3}/c^{3})/(e^{x} − 1). Wien's law has e^{x} in place of e^{x} − 1, so Wien divided by Planck is (e^{x} − 1)/e^{x} = 1 − e^{−x}: Wien's law is low by the fraction e^{−x}, and e^{−5.76} = 0.0032, 0.32 percent. The classical law replaces e^{x} − 1 by its first term, x, which gives u = 8πν^{2}k_{B}T/c^{3}; classical divided by Planck is (e^{x} − 1)/x. At x = 5.76 that is (316.9 − 1)/5.76 = 54.9, so the classical law gives 54.9 times Planck's value; at x = 0.01 it is (1.01005 − 1)/0.01 = 1.005, only 0.5 percent high. For a 1 percent tolerance, Wien's law needs e^{−x} ≤ 0.01, so x ≥ ln 100 = 4.61, which at 5000 K means above 480 THz; the classical law needs (e^{x} − 1)/x ≤ 1.01, so x ≤ 0.0199, below 2.07 THz. Between the two neither simple law will do. The classical law also has no finite total: ν^{2} grows without limit, so ∫ν^{2}dν over all frequencies is infinite, which is Section 1's objection. The peak of Planck's curve per unit frequency is where x^{3}/(e^{x} − 1) is largest, at x = 2.821, that is 2.821 × 104.2 THz = 294 THz. Per unit wavelength the density picks up a factor c/λ^{2} and peaks at x = 4.965, a wavelength of 580 nm, and c divided by 580 nm is 517 THz, not 294 THz. Per logarithmic interval the peak is at x = 3.921, 408 THz. The energy in a band does not depend on the axis, because u_{λ}dλ and u_{ν}dν describe the same energy: from 400 to 600 THz both give 0.129 J/m^{3}.",
  r3: "Einstein wrote L for the speed of light and ρ_{ν} for the density per unit frequency, with Planck's constants α = 6.10 × 10^{−56} and β = 4.866 × 10^{−11}. He did not use the phrase ultraviolet catastrophe, which is Ehrenfest's of 1911, and names no one for the classical law: Rayleigh had argued for a density growing as ν^{2}T at long wavelengths in June 1900, and Jeans's correction of the coefficient came in 1905. Wien's law dates from 1896 and Planck's formula from October 1900. The value N = 6.17 × 10^{23} is Planck's own; Einstein's point in Section 2 is that it follows from the long-wavelength limit alone, without Planck's theory of resonators.",
});
