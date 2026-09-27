/**
 * The pages' view of src/generated/lab-explanations.json (scripts/build-equations.ts, dispatch 291):
 * the explainer to draw under one laboratory's formula, found by the lab and the formula's latex.
 *
 * Imported only by server components, and deliberately separate from labExplanations.ts, which reads
 * the lab pages' own source with the TypeScript parser: that parser must never reach a page's module
 * graph. This file imports one small JSON and nothing else. No "use client".
 */
import type { ExplainerLevels } from "./equationExplanations.ts";
import payload from "../../generated/lab-explanations.json";

const LABS = (
  payload as unknown as {
    labs: Readonly<Record<string, Readonly<Record<string, ExplainerLevels>>>>;
  }
).labs;

/** The explainer for this lab's formula, or undefined where it has none. */
export function labExplainer(lab: string, latex: string): ExplainerLevels | undefined {
  return LABS[lab]?.[latex];
}
