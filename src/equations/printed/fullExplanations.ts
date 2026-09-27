/**
 * Every level of every explanation, for /equations/<paper>/<id>/ alone (dispatch 292): the page a
 * reader without JavaScript is given, and where a panel sends one whose fragment fails to load. The
 * faces import printedExplanations.ts instead, which carries the words a reader meets without
 * asking and nothing else. No face, laboratory or island imports this module.
 */
import payload from "../../generated/equation-explanations-full.json";
import type { ExplainerLevels } from "./equationExplanations.ts";

type Papers = Readonly<Record<string, { displays: Readonly<Record<string, ExplainerLevels>> }>>;
const FULL = payload as unknown as {
  papers: Papers;
  equations: Readonly<Record<string, ExplainerLevels>>;
};

/** Every explanation that has a page, as { paper, display } pairs for generateStaticParams. */
export function everyExplanationRoute(): readonly Readonly<{ paper: string; display: string }>[] {
  return [
    ...Object.entries(FULL.papers).flatMap(([paper, own]) =>
      Object.keys(own.displays).map((display) => ({ paper, display })),
    ),
    ...Object.values(FULL.equations).map((e) => ({
      paper: e.paper,
      display: e.equation ?? "",
    })),
  ].filter((route) => route.display !== "");
}

/** One explanation in full, found by its paper and the display or equation it explains. */
export function fullExplanation(paper: string, id: string): ExplainerLevels | undefined {
  const own = FULL.papers[paper]?.displays[id];
  if (own) return own;
  const equation = FULL.equations[id];
  return equation && equation.paper === paper ? equation : undefined;
}
