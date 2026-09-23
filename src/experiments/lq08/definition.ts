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

export const LQ08_HISTORICAL_CHECK = Object.freeze({
  neglectStatement:
    "Einstein sets P' = 0 as a deliberate neglect of escape work for order-of-magnitude comparison against Lenard's spark-potential observations, not as a physical prediction for a named metal.",
  notNamedMetalStatement:
    "This is not a prediction for any named metal; any real substance has P' > 0, so its stopping potential at this frequency is lower by exactly the amount the work function contributes.",
  representationA: Object.freeze({
    stoppingPotentialVolts: 4.3385,
    printedText: "ca. 4,3 Volt",
    slopeVsPerHz: 4.2121e-15,
    modernSlopeVsPerHz: 4.1357e-15,
  }),
});

/**
 * The instrument's four readings (R0 to R3), checked against §8 of the light paper (transcript
 * ap-17-132, Annalen pp. 145–147) and against evaluateLq08 at the defaults and the presets: 2.48 eV
 * quanta at 600 THz, a 532 THz threshold for Φ = 2.2 eV, 0.281 V, 2.52 × 10^{15} quanta and
 * 2.52 × 10^{14} electrons a second, 40.3 μA doubling to 80.6 μA at 2 mW, and 4.26 V for §8's
 * check. The readings-owners record am-lq-08-photoelectric-va5a.yaml carries the same text.
 */
export const LQ08_CAPTION = Object.freeze({
  r0: "Light shining on a metal knocks electrons out of it. In this model, brighter light releases more of them each second but none faster, while light of a higher frequency makes the fastest ones faster, as Einstein expected if light gives up its energy in separate quanta.",
  r1: "Section 8 applies the light quantum to cathode rays produced by light. In the simplest picture, which Einstein says he will assume, one quantum gives its whole energy hν to one electron; the electron spends a work Φ, characteristic of the body, in leaving it, so the fastest electrons come out with kinetic energy hν − Φ. A body charged positive just enough to keep them all in, to the potential V_{s}, satisfies eV_{s} = hν − Φ. Two consequences follow. Plotted against ν, V_{s} is a straight line whose slope, h/e, does not depend on the substance. And if each quantum acts independently of the rest, the intensity of the light changes how many electrons leave each second, not how fast they go. The defaults, 600 THz light at 1 mW on a hypothetical surface with Φ = 2.2 eV, give quanta of 2.48 eV, a threshold at 532 THz and a stopping potential of 0.281 V; with one quantum in ten releasing an electron, 2.52 × 10^{14} electrons leave each second, a current of 40.3 μA. Doubling the power doubles the current and leaves 0.281 V unchanged.",
  r2: "Start with one quantum. Its energy is hν, Planck's constant times the frequency: h = 6.626 × 10^{−34} J s and ν = 6.00 × 10^{14} Hz give hν = 3.976 × 10^{−19} J. An electronvolt, the energy an electron gains in falling through one volt, is 1.602 × 10^{−19} J, so hν = 3.976/1.602 = 2.48 eV. To leave the metal an electron must do the work Φ, here 2.2 eV. If the quantum gives all its energy to one electron at the surface, the most that electron can keep is 2.481 − 2.2 = 0.281 eV. To stop it, charge the metal positive: an electron climbing back against a potential V loses eV of energy, so it turns back once eV equals its kinetic energy, and the fastest one needs V_{s} = 0.281 V. That is the stopping potential. A quantum that carries less than Φ releases nothing, so the light must have hν at least Φ, or ν at least ν_{0} = Φ/h = (2.2 × 1.602 × 10^{−19})/(6.626 × 10^{−34}) = 5.32 × 10^{14} Hz, which is 532 THz. Now the intensity. A power of 1 mW delivers 10^{−3} J each second; shared into quanta of 3.976 × 10^{−19} J, that is 10^{−3}/(3.976 × 10^{−19}) = 2.52 × 10^{15} quanta each second. If one in ten releases an electron, 2.52 × 10^{14} electrons leave each second, and since each carries 1.602 × 10^{−19} C the current is 2.52 × 10^{14} × 1.602 × 10^{−19} = 4.03 × 10^{−5} A, or 40.3 μA. Double the power to 2 mW and there are twice as many quanta, so twice the current, 80.6 μA; each quantum still carries 2.48 eV, so the fastest electron still needs 0.281 V to stop. Einstein's own check sets the work to nothing, Φ = 0, and takes ν = 1.03 × 10^{15} Hz, where the solar spectrum ends in the ultraviolet. Then eV_{s} = hν gives 4.26 V with today's constants. He printed 4.3 V and said it agrees in order of magnitude with Lenard's results.",
  r3: "Einstein wrote the quantum's energy as (R/N)βν, with R the gas constant, N the number of molecules in a gram-molecule and β the constant in Wien's exponent, so (R/N)β is Planck's h. He wrote Π for the potential, ε for the electron's charge and P for the work, and also gave the law per gram-equivalent of charge, ΠE = Rβν − P′. He called complete transfer to one electron the simplest picture, and allowed that an electron might take up only part of a quantum, in which case ΠE + P′ ≤ Rβν. In 1905 the prediction was untested: Lenard had reported in 1902 that the electrons' speed does not depend on the intensity of the light, but nobody had yet measured the straight line Einstein predicted. Millikan did so in 1916, finding a slope that gave Planck's h to within about half a percent, while calling the theory by which Einstein had reached the equation untenable. The word photon is Lewis's, from 1926.",
});
