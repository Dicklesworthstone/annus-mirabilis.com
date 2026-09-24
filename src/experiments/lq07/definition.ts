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

/** The instrument's four readings, shown on the reader's detail setting. Mirrored in
 * content/editorial/readings-owners/am-lq-07-fluorescence-zjai.yaml, which the readings audit reads. */
export const LQ07_CAPTION = Object.freeze({
  r0: "When light makes a substance glow, the glow comes out at a lower frequency than the light that excites it, and the light-quantum picture says why: one absorbed quantum can pay for at most one emitted quantum of no greater energy. Einstein also named the conditions under which that rule could fail.",
  r1: "§7 applies the light quantum to photoluminescence. Suppose the exciting light of frequency ν₁ and the emitted light of frequency ν₂ both consist of quanta of energy (R/N)βν, hν in modern notation, and that each absorbed quantum, at least while the exciting quanta are sparse, gives rise on its own to one emitted quantum, possibly with other light or heat besides. Then energy requires hν₂ ≤ hν₁, so ν₂ ≤ ν₁, which is Stokes's rule. The instrument draws this energy ledger. At its defaults ν₁ = 850 THz, a quantum of 3.515 eV. Emitting at 850 THz uses all of it; emitting at 600 THz (2.481 eV) leaves 1.034 eV for heat; emitting at 900 THz would need 0.207 eV more than one quantum has, so the lab calls it disallowed and reports no emission. §7 also predicts that in weak light the emitted light is proportional to the exciting light, with no lower limit of intensity. With 1 μW absorbed and one emission for every two absorptions, 1.78 × 10^{12} quanta are absorbed and 8.88 × 10^{11} emitted each second, and a millionth of the power gives a millionth of each rate. Einstein named two cases in which the rule could fail: so many quanta converting at once that one emitted quantum draws on several absorbed ones, which the lab shows as a bound of kν₁; and exciting light unlike black radiation in the range of Wien's law, for which the lab derives no bound. A third setting, in which the body's own heat supplies the difference, is a modern allowance and is labelled as not in the paper.",
  r2: "Start with the energy of one quantum. In modern notation it is hν, with h = 6.626 × 10^{−34} J·s. For ν₁ = 850 THz = 8.50 × 10^{14} s^{−1} that is 5.632 × 10^{−19} J, and dividing by the electron's charge, 1.602 × 10^{−19} C, expresses it as 3.515 eV, the energy an electron gains across 3.515 volts. Now follow one absorbed quantum. Einstein's premise is that, while the exciting quanta are sparse, each one acts alone: its 3.515 eV must cover the emitted quantum and anything else produced, such as heat. Nothing else supplies energy, so the emitted quantum can carry at most 3.515 eV, and since its energy is h times its frequency, its frequency can be at most 850 THz. Try three emitted frequencies. At 850 THz the emitted quantum takes all 3.515 eV and nothing is left over. At 600 THz it takes h × 6.00 × 10^{14} s^{−1} = 2.481 eV, and the remaining 3.515 − 2.481 = 1.034 eV goes to heat. At 900 THz it would need 3.722 eV, which is 0.207 eV more than was absorbed, so this model forbids it. Now the rates. Power is energy per second, so 1 μW of absorbed light at 5.632 × 10^{−19} J per quantum is 10^{−6}/(5.632 × 10^{−19}) = 1.78 × 10^{12} quanta absorbed per second. If one absorption in two leads to an emission, 8.88 × 10^{11} quanta are emitted each second, carrying 0.5 μW at 850 THz, and the other 0.5 μW becomes heat. Halve the power and every rate halves; divide it by a million and every rate is divided by a million but never becomes zero, because each quantum acts independently of the others. That is §7's prediction of proportionality with no threshold. The deviation cases change the premises. If the quanta are so dense that k of them pool their energy into one emitted quantum, the budget becomes k × 3.515 eV, so with k = 2 the limit rises to 1700 THz, and the lab reports no rates, since emission is then not proportional to absorption. If the exciting light comes from a source so hot that Wien's law fails at 850 THz, for instance 50 000 K, where hν/kT = 0.82, the quantum description is not admitted and the lab gives no bound. Under the modern allowance the body contributes thermal energy, taken here as 10 kT = 0.2585 eV at 300 K, which raises the limit to 912.5 THz. At 900 THz, with every absorption leading to an emission, 1.059 μW comes out for 1 μW absorbed, and the other 0.059 μW is heat drawn from the body.",
  r3: "Stokes stated the rule in 1852 as an observation about fluorescent substances; §7 is Einstein's derivation of it from the light quantum and energy conservation, and its predictions, proportionality without a threshold in weak light and exceptions only in the two named cases, were offered for experiment rather than checked in the paper. Einstein wrote the quantum as (R/N)βν, with β from Wien's law; h is Planck's notation. Both deviation cases later became real physics under other names: absorption of two quanta at once was worked out by Göppert-Mayer in 1931 and seen with lasers in 1961, and Pringsheim proposed in 1929 that anti-Stokes emission fed by a body's heat could cool it, which Epstein and colleagues observed in a solid in 1995. The thermal allowance here is a simple modern estimate, not a model of any substance.",
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
    label: "Deviation case 2 (a 20,000 K source, outside the Wien regime)",
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
    label: "Modern thermal allowance (emitting body at 300 K)",
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
