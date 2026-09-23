/**
 * Each paper's compiled semantic equations by id, for the reading's formula blocks that name
 * them (ColouredFormula). Route-local payloads from build-equations.ts; a paper with no admitted
 * equations yields an empty map, and its formulas render plainly.
 */
import type { CompiledEquation } from "../equations/viewTypes.ts";
import brownian from "../generated/brownian-equations.json";
import lightQuanta from "../generated/light-quanta-equations.json";
import massEnergy from "../generated/mass-energy-equations.json";
import specialRelativity from "../generated/special-relativity-equations.json";

const BY_PAPER: Readonly<Record<string, readonly CompiledEquation[]>> = {
  "brownian-motion": brownian.equations as readonly CompiledEquation[],
  "mass-energy": massEnergy.equations as readonly CompiledEquation[],
  "light-quanta": lightQuanta.equations as readonly CompiledEquation[],
  "special-relativity": specialRelativity.equations as readonly CompiledEquation[],
};

const LESSONS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "brownian-motion": brownian.foundationTitles,
  "mass-energy": massEnergy.foundationTitles,
  "light-quanta": lightQuanta.foundationTitles,
  "special-relativity": specialRelativity.foundationTitles,
};

/** Titles of the lessons the equations' notes cite, restricted to these equations. */
export function lessonTitlesFor(
  paperId: string,
  equations: readonly CompiledEquation[],
): Readonly<Record<string, string>> {
  const all = LESSONS[paperId] ?? {};
  const cited = new Set(equations.flatMap((e) => e.notes.map((n) => n.foundation)));
  return Object.fromEntries(Object.entries(all).filter(([id]) => cited.has(id)));
}

export function paperEquations(paperId: string): ReadonlyMap<string, CompiledEquation> {
  return new Map((BY_PAPER[paperId] ?? []).map((e) => [e.id, e]));
}
