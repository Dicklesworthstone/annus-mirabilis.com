import { ExperimentRuntimeError } from "../refusal.ts";

/** Constant-set identity is part of the experiment, not a label chosen by the view. */
export const AVOGADRO_BASES = Object.freeze({
  0: Object.freeze({
    setId: "modern-si-2019",
    label: "Modern SI consistency check",
    interpretation: "The gas constant is defined from the molecular number and Boltzmann constant. These diffusion calculations check consistency; they do not independently measure the defined molecular number.",
    provenance: "BIPM SI definitions (2019).",
  }),
  1: Object.freeze({
    setId: "einstein-1905-brownian-printed",
    label: "Historical gas measurement",
    interpretation: "The gas constant was measured without counting molecules. The diffusion calculations can infer a molecular number without importing its modern definition. The supplied observations remain illustrative, not historical measurements.",
    provenance: "The edition's 1905 Brownian constant set: R = 8.31 J/(mol K) is an explicitly recorded editorial input for section 5, not a numeral printed in that paper.",
  }),
});
export type AvogadroBasis = (typeof AVOGADRO_BASES)[keyof typeof AVOGADRO_BASES];
/** Call with parameters accepted by validateAvogadroParameters. */
export function avogadroBasis(parameters: Readonly<{ constantBasis: number }>): AvogadroBasis {
  if (parameters.constantBasis === 0) return AVOGADRO_BASES[0];
  if (parameters.constantBasis === 1) return AVOGADRO_BASES[1];
  throw new ExperimentRuntimeError("parameters-rejected", "Choose a registered gas-constant basis.", "avogadro");
}
