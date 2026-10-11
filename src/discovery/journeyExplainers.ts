/**
 * The pages' view of src/generated/journey-explanations.json (scripts/build-equations.ts, am-hk4b):
 * the explainer to draw under one discover-page formula, found by its page and its latex.
 *
 * Imported only by server components, and deliberately separate from the checker in
 * `src/content/journeyExplanations.ts`, which reads the YAML and must never reach a page's module
 * graph. This file imports one small JSON and nothing else. No "use client".
 *
 * THE PAGE COMES FROM THE SCOPE, not from a new prop on every call site. `scope.where` is authored
 * as `discover/<paper>[/investigate] <step>`, so its first token IS the page route -- verified
 * against all 39 site entries, which yield exactly the six pages the records declare. Deriving it
 * from `scope.anchor` instead would have meant parsing `discover-light-quanta-investigate` back into
 * a slug that itself contains hyphens.
 */

import type { ExplainerLevels } from "../equations/printed/equationExplanations.ts";
import payload from "../generated/journey-explanations.json";
import type { JourneyScope } from "./journeyFormulas.ts";

const PAGES = (
  payload as unknown as {
    pages: Readonly<Record<string, Readonly<Record<string, ExplainerLevels>>>>;
  }
).pages;

/** The page route a scope belongs to: the first token of its authored `where`. */
export function journeyPageOf(scope: JourneyScope): string {
  return scope.where.split(" ")[0] ?? "";
}

/** The explainer for this formula on this page, or undefined where it has none. */
export function journeyExplainer(scope: JourneyScope, latex: string): ExplainerLevels | undefined {
  return PAGES[journeyPageOf(scope)]?.[latex];
}
