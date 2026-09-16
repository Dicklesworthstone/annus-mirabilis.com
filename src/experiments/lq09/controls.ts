import type { Lq09AbsorptionMode, Lq09Parameters } from "./definition.ts";

export type Lq09Draft = Readonly<{
  frequencyTHz: string;
  ionizationEnergyEv: string;
  incidentPowerMicroWatts: string;
  absorptionEfficiency: string;
  duration: string;
  absorptionMode: Lq09AbsorptionMode;
  declaredFraction: string;
  gasName: string;
  gasCitation: string;
}>;

export function toLq09Draft(p: Lq09Parameters): Lq09Draft {
  return {
    frequencyTHz: (p.frequency / 1e12).toFixed(2),
    ionizationEnergyEv: String(p.ionizationEnergyEv),
    incidentPowerMicroWatts: (p.incidentPower * 1e6).toFixed(2),
    absorptionEfficiency: String(p.absorptionEfficiency),
    duration: String(p.duration),
    absorptionMode: p.absorptionMode,
    declaredFraction: String(p.declaredFraction),
    gasName: p.gasName,
    gasCitation: p.gasCitation,
  };
}

export function fromLq09Draft(d: Lq09Draft): Lq09Parameters {
  const freqTHz = Number.parseFloat(d.frequencyTHz);
  const pMicroW = Number.parseFloat(d.incidentPowerMicroWatts);

  return {
    frequency: Number.isFinite(freqTHz) ? freqTHz * 1e12 : 0,
    ionizationEnergyEv: Number.parseFloat(d.ionizationEnergyEv),
    incidentPower: Number.isFinite(pMicroW) ? pMicroW * 1e-6 : 0,
    absorptionEfficiency: Number.parseFloat(d.absorptionEfficiency),
    duration: Number.parseFloat(d.duration),
    absorptionMode: d.absorptionMode,
    declaredFraction: Number.parseFloat(d.declaredFraction),
    gasName: d.gasName,
    gasCitation: d.gasCitation,
  };
}
