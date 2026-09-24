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
import { NOTATION_TOGGLE_PAPERS } from "./navigation/state.ts";

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

/**
 * HOW FAR THE LETTERS CONTROL REACHES on a paper that has it, counted on the built payload: the
 * formulas it redraws in Einstein's letters, those already in his letters, and those that keep
 * today's letters (each with its note). Null on a paper without the control, whose formulas
 * carry no printed form and would all count as "already his".
 */
export type NotationReach = Readonly<{ switched: number; same: number; held: number; of: number }>;

export function notationReach(paperId: string): NotationReach | null {
  if (!NOTATION_TOGGLE_PAPERS.includes(paperId)) return null;
  const all = BY_PAPER[paperId] ?? [];
  const switched = all.filter((e) => e.notationForm?.state === "printed").length;
  const held = all.filter((e) => e.notationForm?.state === "modern").length;
  return { switched, same: all.length - switched - held, held, of: all.length };
}

/**
 * The control's own help text, so a control that changes one formula in eighteen does not read as
 * a full rendering in Einstein's letters (TanElk, am-read-perspective-toggle-abd).
 */
export function notationReachLine(r: NotationReach): string {
  const parts = [`Einstein's letters change ${r.switched} of this paper's ${r.of} formulas.`];
  const already =
    r.same === 1 ? "1 is already in his letters" : `${r.same} are already in his letters`;
  const kept = `${r.held === 1 ? "1 stays" : `${r.held} stay`} in today's letters, with a note saying so`;
  if (r.same > 0 && r.held > 0) parts.push(`${already}, and ${kept}.`);
  else if (r.same > 0) parts.push(`${already}.`);
  else if (r.held > 0) parts.push(`${kept[0]?.toUpperCase()}${kept.slice(1)}.`);
  return parts.join(" ");
}
