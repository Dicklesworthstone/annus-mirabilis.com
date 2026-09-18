import type {
  Me03Boundary,
  Me03CardId,
  Me03Mode,
  Me03Notation,
  Me03Parameters,
  Me03PulseSystem,
  Me03RadiationDisposition,
} from "./definition.ts";

export type Me03Draft = {
  boundary: Me03Boundary;
  disposition: Me03RadiationDisposition;
  emittedEnergy: string;
  inputEnergy: string;
  cardId: Me03CardId;
  mode: Me03Mode;
  pulseSystem: Me03PulseSystem;
  notation: Me03Notation;
  boxMass: string;
  boxLength: string;
  pulseEnergy: string;
  assignLightMass: boolean;
  magnification: number;
};

export function toMe03Draft(p: Me03Parameters): Me03Draft {
  return {
    boundary: p.boundary,
    disposition: p.disposition,
    emittedEnergy: String(p.emittedEnergy),
    inputEnergy: String(p.inputEnergy),
    cardId: p.cardId,
    mode: p.mode,
    pulseSystem: p.pulseSystem,
    notation: p.notation,
    boxMass: String(p.boxMass ?? 1.0),
    boxLength: String(p.boxLength ?? 1.0),
    pulseEnergy: String(p.pulseEnergy ?? 1.0),
    assignLightMass: p.assignLightMass ?? true,
    magnification: p.magnification ?? 1e17,
  };
}

export function fromMe03Draft(d: Me03Draft): Me03Parameters {
  const L = Number.parseFloat(d.emittedEnergy);
  const inputE = Number.parseFloat(d.inputEnergy);
  const M = Number.parseFloat(d.boxMass);
  const ell = Number.parseFloat(d.boxLength);
  const E = Number.parseFloat(d.pulseEnergy);

  return {
    boundary: d.boundary,
    disposition: d.disposition,
    emittedEnergy: Number.isFinite(L) ? L : Number.NaN,
    inputEnergy: Number.isFinite(inputE) ? inputE : Number.NaN,
    cardId: d.cardId,
    mode: d.mode,
    pulseSystem: d.pulseSystem,
    notation: d.notation,
    boxMass: Number.isFinite(M) ? M : Number.NaN,
    boxLength: Number.isFinite(ell) ? ell : Number.NaN,
    pulseEnergy: Number.isFinite(E) ? E : Number.NaN,
    assignLightMass: d.assignLightMass,
    magnification: d.magnification,
  };
}
