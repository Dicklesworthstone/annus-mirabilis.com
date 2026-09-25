import { typedOrNaN } from "../controls/typedNumber.ts";
import type { Lq07Channels, Lq07Parameters, Lq07Regime } from "./definition.ts";

export type Lq07Draft = Readonly<{
  nu1: string;
  nu2: string;
  regime: Lq07Regime;
  multiQuantumK: string;
  sourceTemperatureK: string;
  bodyTemperatureK: string;
  absorbedPowerMicrowatts: string;
  quantumYield: string;
  channels: Lq07Channels;
}>;

export function toLq07Draft(p: Lq07Parameters): Lq07Draft {
  return {
    nu1: String(p.nu1),
    nu2: String(p.nu2),
    regime: p.regime,
    multiQuantumK: String(p.multiQuantumK),
    sourceTemperatureK: String(p.sourceTemperatureK),
    bodyTemperatureK: String(p.bodyTemperatureK),
    absorbedPowerMicrowatts: String(p.absorbedPowerMicrowatts),
    quantumYield: String(p.quantumYield),
    channels: p.channels,
  };
}

export function fromLq07Draft(d: Lq07Draft): Lq07Parameters {
  return {
    // parseFloat took "12abc" as 12 and parseInt took k = 2.5 as 2, without a word. A blank or
    // partial field now reaches the validator as NaN or as itself, and is refused by name.
    nu1: typedOrNaN(d.nu1),
    nu2: typedOrNaN(d.nu2),
    regime: d.regime,
    multiQuantumK: typedOrNaN(d.multiQuantumK),
    sourceTemperatureK: typedOrNaN(d.sourceTemperatureK),
    bodyTemperatureK: typedOrNaN(d.bodyTemperatureK),
    absorbedPowerMicrowatts: typedOrNaN(d.absorbedPowerMicrowatts),
    quantumYield: typedOrNaN(d.quantumYield),
    channels: d.channels,
  };
}
