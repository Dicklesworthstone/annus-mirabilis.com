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

/** The instrument's four readings, shown on the reader's detail setting. Mirrored in
 * content/editorial/readings-owners/am-lq-04-entropy-workbench-senj.yaml, which the readings audit reads. */
export const LQ04_CAPTION = Object.freeze({
  r0: "When faint light of one colour is given more room at the same energy, its entropy rises by the same logarithmic law as an ideal gas that expands. That shared law is the clue the paper follows next.",
  r1: "Section 3 turns a radiation law into an entropy: at fixed energy, the entropy S = v∫φ(ρ, ν)dν is a maximum, and with dS = dE/T this gives ∂φ/∂ρ = 1/T, where φ vanishes when the density ρ is zero. Section 4 takes Wien's law, ρ = αν³e^{−βν/T}, which experiment had confirmed for large ν/T, solves it for 1/T and integrates. For radiation of energy E in a narrow band from ν to ν + dν filling a volume v, the dependence on volume is S − S_{0} = (E/βν) ln(v/v_{0}). The instrument holds E, ν and dν fixed, lets you choose the volume ratio, and refuses a state dense enough for Wien's law to fail.",
  r2: "Start from Wien's law, ρ = αν³e^{−βν/T}, where ρ is the energy per unit volume and per unit of frequency. Taking the natural logarithm of both sides gives ln(ρ/αν³) = −βν/T, so 1/T = −(1/βν) ln(ρ/αν³). Section 3 showed that ∂φ/∂ρ = 1/T, so φ is found by integrating 1/T with respect to ρ from φ = 0 at ρ = 0; the result is φ = −(ρ/βν){ln(ρ/αν³) − 1}. Now put the energy E, in the band dν, inside a volume v. Then ρ = E/(v dν), and the entropy is S = vφ dν = −(E/βν){ln(E/(vαν³dν)) − 1}. Only one part of this depends on v: −(E/βν) ln(1/v), which is (E/βν) ln v. Subtracting the same expression at the volume v_{0} leaves S − S_{0} = (E/βν) ln(v/v_{0}). At the instrument's defaults (ν = 6 × 10^{14} Hz, T_{0} = 3000 K, one litre, a band 10^{12} Hz wide) the snapshot has E = 9.06 × 10^{−9} J and E/(βν) = 3.14 × 10^{−13} J/K. Doubling the volume multiplies that coefficient by ln 2, about 0.693, so the entropy rises by 2.18 × 10^{−13} J/K. The same energy is now spread thinner, so ρ halves and βν/T rises by exactly ln 2, from 9.60 to 10.29: the radiation is colder, 2798 K, and further inside the regime where Wien's law holds.",
  r3: "Einstein printed lg for the natural logarithm and used β for the constant in Wien's exponent, so his coefficient E/βν is, in modern notation, k_{B}E/(hν), since β = h/k_{B}. He said plainly that Wien's law is not exactly valid and that his results hold only within certain limits. The comparison with an ideal gas or a dilute solution is his own sentence at the end of Section 4; reading the coefficient in terms of independent energy quanta of size Rβν/N comes only in Section 6, after the probability argument of Section 5. Planck's formula of 1901 was already known, and Einstein works in its Wien limit on purpose.",
});

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
