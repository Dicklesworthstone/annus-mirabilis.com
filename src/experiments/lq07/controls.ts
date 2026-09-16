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
    nu1: Number.parseFloat(d.nu1),
    nu2: Number.parseFloat(d.nu2),
    regime: d.regime,
    multiQuantumK: Number.parseInt(d.multiQuantumK, 10),
    sourceTemperatureK: Number.parseFloat(d.sourceTemperatureK),
    bodyTemperatureK: Number.parseFloat(d.bodyTemperatureK),
    absorbedPowerMicrowatts: Number.parseFloat(d.absorbedPowerMicrowatts),
    quantumYield: Number.parseFloat(d.quantumYield),
    channels: d.channels,
  };
}
