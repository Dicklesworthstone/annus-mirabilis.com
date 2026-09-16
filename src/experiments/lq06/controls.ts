import { type Lq06Parameters, LQ06_DEFAULTS } from "./definition.ts";
import { validateLq06Parameters } from "./parameters.ts";

export type Lq06Draft = Readonly<{
  radiationEnergy: string;
  frequency: string;
  gasParticles: string;
  volumeRatio: string;
  temperature: string;
  selectedSubexpression: Lq06Parameters["selectedSubexpression"];
  proposedEnergyElement: Lq06Parameters["proposedEnergyElement"];
  forkAChoice: Lq06Parameters["forkAChoice"];
  constantSetId: string;
}>;

export function toLq06Draft(p: Lq06Parameters = LQ06_DEFAULTS): Lq06Draft {
  return {
    radiationEnergy: (p.radiationEnergy * 1e9).toFixed(4),
    frequency: (p.frequency / 1e12).toFixed(2),
    gasParticles: String(p.gasParticles),
    volumeRatio: p.volumeRatio.toFixed(2),
    temperature: p.temperature.toFixed(0),
    selectedSubexpression: p.selectedSubexpression,
    proposedEnergyElement: p.proposedEnergyElement,
    forkAChoice: p.forkAChoice,
    constantSetId: p.constantSetId,
  };
}

export function fromLq06Draft(d: Lq06Draft): Lq06Parameters {
  const e = Number.parseFloat(d.radiationEnergy) * 1e-9;
  const nu = Number.parseFloat(d.frequency) * 1e12;
  const n = Number.parseInt(d.gasParticles, 10);
  const v = Number.parseFloat(d.volumeRatio);
  const t = Number.parseFloat(d.temperature);

  const res = validateLq06Parameters({
    radiationEnergy: e,
    frequency: nu,
    gasParticles: n,
    volumeRatio: v,
    temperature: t,
    selectedSubexpression: d.selectedSubexpression,
    proposedEnergyElement: d.proposedEnergyElement,
    forkAChoice: d.forkAChoice,
    constantSetId: d.constantSetId,
  });

  if (res.kind !== "accepted") {
    throw new Error(res.refusal.message);
  }

  return res.data;
}
