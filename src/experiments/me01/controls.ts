import type {
  Me01Notation,
  Me01OffsetDisplay,
  Me01Parameters,
  Me01Premise,
  Me01Step,
} from "./definition.ts";

export type Me01Draft = {
  frameSpeed: string;
  emittedEnergyRestFrame: string;
  emissionAngle: string;
  offsetDisplay: Me01OffsetDisplay;
  premise: Me01Premise;
  step: Me01Step;
  cancelAngleFactors: boolean;
  cancelInternalEnergies: boolean;
  cancelAdditiveConstant: boolean;
  notation: Me01Notation;
};

export function toMe01Draft(p: Me01Parameters): Me01Draft {
  return {
    frameSpeed: String(p.frameSpeed),
    emittedEnergyRestFrame: String(p.emittedEnergyRestFrame),
    emissionAngle: String(p.emissionAngle),
    offsetDisplay: p.offsetDisplay,
    premise: p.premise,
    step: p.step,
    cancelAngleFactors: p.cancelAngleFactors,
    cancelInternalEnergies: p.cancelInternalEnergies,
    cancelAdditiveConstant: p.cancelAdditiveConstant,
    notation: p.notation,
  };
}

export function fromMe01Draft(d: Me01Draft): Me01Parameters {
  const beta = Number.parseFloat(d.frameSpeed);
  const L = Number.parseFloat(d.emittedEnergyRestFrame);
  const phi = Number.parseFloat(d.emissionAngle);

  return {
    frameSpeed: Number.isFinite(beta) ? beta : Number.NaN,
    emittedEnergyRestFrame: Number.isFinite(L) ? L : Number.NaN,
    emissionAngle: Number.isFinite(phi) ? phi : Number.NaN,
    offsetDisplay: d.offsetDisplay,
    premise: d.premise,
    step: d.step,
    cancelAngleFactors: d.cancelAngleFactors,
    cancelInternalEnergies: d.cancelInternalEnergies,
    cancelAdditiveConstant: d.cancelAdditiveConstant,
    notation: d.notation,
  };
}
