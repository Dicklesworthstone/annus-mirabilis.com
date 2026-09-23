import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

/**
 * LQ-04: the Wien-regime radiation entropy workbench (am-lq-04-entropy-workbench-senj).
 *
 * modern-si-2019 only this pass: einstein-1905-light-quanta-printed is not yet a registered
 * constant set (src/physics/reference/constants.ts's getConstantSet throws
 * constant-set-not-registered for it; owner am-ref-constants-xik). This is the same honest
 * scope limit lq03/definition.ts already states for the same reason against the same owner.
 */
export type Lq04Parameters = Readonly<{
  frequency: number; // nu, Hz
  bandwidth: number; // dNu, Hz
  referenceVolume: number; // V0, m^3
  referenceTemperature: number; // T0, K -- fixes rho0 and, with referenceVolume and bandwidth, the fixed E
  volumeRatio: number; // V / V0, dimensionless
  diluteThresholdX: number; // xMin, dimensionless (default ln 100)
  showUnfixedConstantPanel: boolean;
  illustrativeC: number; // J m^-3 Hz^-1 K^-1, read only when the panel is shown
}>;

export const LQ04_DEFAULTS: Lq04Parameters = Object.freeze({
  frequency: 6.0e14,
  bandwidth: 1.0e12,
  referenceVolume: 1.0e-3,
  referenceTemperature: 3000,
  volumeRatio: 1,
  diluteThresholdX: Math.log(100),
  showUnfixedConstantPanel: false,
  illustrativeC: 1.0e-15,
});

export const LQ04_CLASSES: Readonly<Record<keyof Lq04Parameters, ParameterClass>> = Object.freeze({
  frequency: "input",
  bandwidth: "input",
  referenceVolume: "input",
  referenceTemperature: "input",
  volumeRatio: "measurement",
  diluteThresholdX: "estimator",
  showUnfixedConstantPanel: "presentation",
  illustrativeC: "presentation",
});

export const LQ04_MODEL = Object.freeze({
  id: "lq-04-host-v1",
  constantSetId: "modern-si-2019",
  label: "Ideal model, host calculation",
});

export const LQ04_QUESTION =
  "Within the regime where Wien's law holds, how does the entropy of monochromatic radiation depend on the volume it occupies, and what had to be fixed to get a definite answer?";

export const LQ04_NOT_MODELED: readonly string[] = Object.freeze([
  "Radiation outside the Wien regime",
  "Broad bands",
  "How the constrained states are prepared",
  "Walls, mirrors, adiabatic compression, or any mechanism that changes volume",
  "Any interpretation of E/(hν) as a count of particles",
]);

const c = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });

const OUTSIDE = ["value", "outside-domain"] as const;

export const LQ04_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  radiationEnergy: c("J", "radiation-energy", "lq04.acceptedInputs"),
  initialTemperature: c("K", "wien-temperature", "radiation.entropy", OUTSIDE),
  finalTemperature: c("K", "wien-temperature", "radiation.entropy", OUTSIDE),
  initialX: c("1", "wien-dimensionless-ratio", "radiation.entropy", OUTSIDE),
  finalX: c("1", "wien-dimensionless-ratio", "radiation.entropy", OUTSIDE),
  initialPointwiseDeviation: c("1", "wien-pointwise-deviation", "radiation.spectra", OUTSIDE),
  finalPointwiseDeviation: c("1", "wien-pointwise-deviation", "radiation.spectra", OUTSIDE),
  initialSpectralEntropyDensity: c(
    "J/(m^3 Hz K)",
    "spectral-entropy-density",
    "radiation.entropy",
    OUTSIDE,
  ),
  finalSpectralEntropyDensity: c(
    "J/(m^3 Hz K)",
    "spectral-entropy-density",
    "radiation.entropy",
    OUTSIDE,
  ),
  radiationEntropy: c("J/K", "radiation-entropy-change", "radiation.entropy", OUTSIDE),
  radiationEntropyNumeric: c("J/K", "radiation-entropy-change", "radiation.entropy", OUTSIDE),
  entropyVolumeCoefficient: c("J/K", "entropy-volume-coefficient", "radiation.entropy", OUTSIDE),
  effectiveIndependentCount: c(
    "1",
    "effective-independent-count",
    "lq04.derivedFromEnergyAndPlanckConstant",
    OUTSIDE,
  ),
  unfixedConstantDeltaS: c("J/K", "unfixed-constant-entropy-change", "radiation.entropy", [
    "value",
    "not-applicable",
    "outside-domain",
  ]),
  unfixedConstantExtraTerm: c("J/K", "unfixed-constant-extra-term", "radiation.entropy", [
    "value",
    "not-applicable",
    "outside-domain",
  ]),
});
