import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export type Lq07Regime =
  | "standard-stokes"
  | "deviation-multi-quantum"
  | "deviation-non-wien"
  | "modern-thermal";

export type Lq07Channels = "light-plus-heat" | "light-only";

export type Lq07Parameters = Readonly<{
  nu1: number; // in THz
  nu2: number; // in THz
  regime: Lq07Regime;
  multiQuantumK: number;
  sourceTemperatureK: number;
  bodyTemperatureK: number;
  absorbedPowerMicrowatts: number;
  quantumYield: number;
  channels: Lq07Channels;
}>;

export const LQ07_DEFAULTS: Lq07Parameters = Object.freeze({
  nu1: 850,
  nu2: 850,
  regime: "standard-stokes",
  multiQuantumK: 1,
  sourceTemperatureK: 5800,
  bodyTemperatureK: 300,
  absorbedPowerMicrowatts: 1.0,
  quantumYield: 0.5,
  channels: "light-plus-heat",
});

export const LQ07_CLASSES: Readonly<Record<keyof Lq07Parameters, ParameterClass>> = Object.freeze({
  nu1: "input",
  nu2: "input",
  regime: "input",
  multiQuantumK: "input",
  sourceTemperatureK: "input",
  bodyTemperatureK: "input",
  absorbedPowerMicrowatts: "input",
  quantumYield: "input",
  channels: "input",
});

export const LQ07_QUESTION =
  "Why can the frequency of emitted fluorescent light not exceed that of the exciting light under the light-quantum hypothesis, and what are the exact conditions for exceptions?";

export const LQ07_CAPTION = Object.freeze({
  r0: "Under single-quantum transformation, the emitted quantum cannot exceed the absorbed quantum: hν₂ ≤ hν₁, meaning the emitted frequency cannot exceed the exciting frequency (Stokes's rule).",
  r1: "Einstein §7 shows that Stokes's empirical rule follows naturally from single-quantum energy conservation: hν₁ = hν₂ + E, where E ≥ 0 is the energy passed to other channels.",
  r2: "Einstein explicitly names two deviation cases: (1) multi-quantum absorption, where k absorbed quanta raise the limit to kν₁, and (2) exciting radiation outside the Wien domain, where the single-quantum derivation does not apply.",
  r3: "Historical note: Stokes's 1852 rule was widely considered an absolute law until anti-Stokes lines were observed. Einstein's energy-accounting derivation correctly predicted the possibility of multi-photon deviations and weak-light linearity with zero threshold.",
});

export const LQ07_MODEL = Object.freeze({
  id: "lq07-fluorescence-v1",
  constantSetId: "modern-si-2019",
  label: "Fluorescence energy budget & weak-illumination rates · host calculation",
  assumptions: Object.freeze([
    "The exciting light consists of energy quanta of magnitude hν₁ as derived for the Wien regime.",
    "The absorption and emission of light are elementary processes occurring via single quanta (unless in deviation case 1).",
    "Each absorbed quantum is transformed into a light quantum of frequency ν₂ and/or non-optical energy channels (heat).",
    "Energy is strictly conserved in every elementary transformation: hν₁ = hν₂ + E, where E ≥ 0 is the energy passed to other channels.",
  ]),
  notModeled: Object.freeze([
    "Detailed atomic or molecular energy level structures and transition dipoles.",
    "Non-radiative decay kinetics and intermediate triplet states (phosphorescence timescales).",
    "Spatial propagation, self-absorption, and re-emission geometry inside the bulk medium.",
    "Coherent optical effects and laser amplification.",
  ]),
});

const c = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });

export const LQ07_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  allowed: c("", "boolean-verdict", "photoelectric.fluorescenceBudget", [
    "value",
    "outside-domain",
    "not-applicable",
  ]),
  nu2Max: c("THz", "cyclic-frequency", "photoelectric.fluorescenceBudget", [
    "value",
    "outside-domain",
    "not-applicable",
  ]),
  e1Ev: c("eV", "energy", "photoelectric.fluorescenceBudget", [
    "value",
    "outside-domain",
    "not-applicable",
  ]),
  e2Ev: c("eV", "energy", "photoelectric.fluorescenceBudget", [
    "value",
    "outside-domain",
    "not-applicable",
  ]),
  eOtherEv: c("eV", "energy", "photoelectric.fluorescenceBudget", [
    "value",
    "outside-domain",
    "not-applicable",
  ]),
  energyDeficitEv: c("eV", "energy", "photoelectric.fluorescenceBudget", [
    "value",
    "outside-domain",
    "not-applicable",
  ]),
  absorbedRate: c("s^-1", "event-rate", "photoelectric.fluorescenceRates", [
    "value",
    "outside-domain",
    "not-applicable",
  ]),
  emittedRate: c("s^-1", "event-rate", "photoelectric.fluorescenceRates", [
    "value",
    "outside-domain",
    "not-applicable",
  ]),
  emittedPowerWatts: c("W", "power", "photoelectric.fluorescenceRates", [
    "value",
    "outside-domain",
    "not-applicable",
  ]),
  dissipatedHeatWatts: c("W", "power", "photoelectric.fluorescenceRates", [
    "value",
    "outside-domain",
    "not-applicable",
  ]),
});

export const LQ07_PRESETS: Readonly<
  Record<string, Readonly<{ label: string; description: string; parameters: Lq07Parameters }>>
> = Object.freeze({
  "lq-07-stokes-rule": Object.freeze({
    label: "Stokes's rule (§7 as printed)",
    description:
      "Standard single-quantum budget: exciting UV light at 850 THz (3.515 eV) bounds emission to ν₂ ≤ 850 THz.",
    parameters: Object.freeze({
      nu1: 850,
      nu2: 850,
      regime: "standard-stokes",
      multiQuantumK: 1,
      sourceTemperatureK: 5800,
      bodyTemperatureK: 300,
      absorbedPowerMicrowatts: 1.0,
      quantumYield: 0.5,
      channels: "light-plus-heat",
    }),
  }),
  "lq-07-anti-stokes-disallowed": Object.freeze({
    label: "Anti-Stokes disallowed (900 THz proposal)",
    description:
      "Proposing ν₂ = 900 THz (3.722 eV) results in a 0.207 eV deficit under standard single-quantum assumptions.",
    parameters: Object.freeze({
      nu1: 850,
      nu2: 900,
      regime: "standard-stokes",
      multiQuantumK: 1,
      sourceTemperatureK: 5800,
      bodyTemperatureK: 300,
      absorbedPowerMicrowatts: 1.0,
      quantumYield: 0.5,
      channels: "light-plus-heat",
    }),
  }),
  "lq-07-deviation-multi": Object.freeze({
    label: "Deviation case 1 (k = 2 multi-quantum)",
    description:
      "Two absorbed quanta (7.031 eV) raise the bound on ν₂ to 1700 THz, allowing 900 THz emission.",
    parameters: Object.freeze({
      nu1: 850,
      nu2: 900,
      regime: "deviation-multi-quantum",
      multiQuantumK: 2,
      sourceTemperatureK: 5800,
      bodyTemperatureK: 300,
      absorbedPowerMicrowatts: 1.0,
      quantumYield: 0.5,
      channels: "light-plus-heat",
    }),
  }),
  "lq-07-deviation-non-wien": Object.freeze({
    label: "Deviation case 2 (T_src = 20,000 K non-Wien source)",
    description:
      "Exciting radiation outside the Wien domain (exp(−x) = 0.130 > 0.01) is refused: the single-quantum derivation assumes the Wien regime.",
    parameters: Object.freeze({
      nu1: 850,
      nu2: 850,
      regime: "deviation-non-wien",
      multiQuantumK: 1,
      sourceTemperatureK: 20000,
      bodyTemperatureK: 300,
      absorbedPowerMicrowatts: 1.0,
      quantumYield: 0.5,
      channels: "light-plus-heat",
    }),
  }),
  "lq-07-modern-thermal": Object.freeze({
    label: "Modern thermal allowance (T_body = 300 K)",
    description:
      "Thermal energy of the emitting body (+0.259 eV from vibrational modes) raises the bound on ν₂ to 912.51 THz (labeled modern lens).",
    parameters: Object.freeze({
      nu1: 850,
      nu2: 900,
      regime: "modern-thermal",
      multiQuantumK: 1,
      sourceTemperatureK: 5800,
      bodyTemperatureK: 300,
      absorbedPowerMicrowatts: 1.0,
      quantumYield: 0.5,
      channels: "light-plus-heat",
    }),
  }),
});
