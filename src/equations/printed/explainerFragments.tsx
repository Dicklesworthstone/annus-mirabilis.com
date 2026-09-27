/**
 * THE LEVELS AS A STATIC FRAGMENT (dispatch 292).
 *
 * The reading faces carry the panel's control and the equation in words, and nothing else: measured
 * on a build of 8d42d5ef, relativity's German face stood at 992,203 bytes gzipped against a recorded
 * 385,289, and its parallel face at 1,867,064, because every panel is written twice, once as markup
 * and once into React's flight data, which for this content is 1.55 times the markup. R2's steps
 * alone were 148,694 of the German face's markup.
 *
 * So the levels are rendered here, at build time, into one HTML string per explanation, written to
 * public/equation-explanations/<paper>/<id>.json, and fetched when a reader first opens a panel.
 * AGENTS.md prescribes exactly this for a face over budget: "a section's R2 and R3 texts load from a
 * static JSON fragment on first expansion, with real links for no-script readers."
 *
 * ONE SOURCE OF MARKUP. The string is rendered from ExplainerBody, the same component the no-script
 * page renders in place, so the fetched panel and the page that holds the full text cannot drift
 * apart. Nothing is cut: every word of every level is in the fragment and on that page.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { ExplainerBody, levelsOf } from "../../reader/faces/EquationExplainer.tsx";
import type { ExplainerLevels } from "./equationExplanations.ts";
import { explainerId } from "./explainerLinks.ts";

export const EXPLAINER_FRAGMENT_DIR = "public/equation-explanations";

export type ExplainerFragment = Readonly<{
  /** Where the file goes, under the repository root. */
  path: string;
  /** Its contents: the levels' markup, and which levels it holds. */
  json: string;
}>;

/** What the page keeps of an explanation: the words a reader meets, and the levels' names. */
export function inlineExplanation(explanation: ExplainerLevels): ExplainerLevels {
  return {
    paper: explanation.paper,
    ...(explanation.display ? { display: explanation.display } : {}),
    ...(explanation.equation ? { equation: explanation.equation } : {}),
    inWords: explanation.inWords,
    levels: levelsOf(explanation),
  };
}

/** One explanation's levels, rendered to the fragment a panel fetches. */
export function explainerFragment(explanation: ExplainerLevels): ExplainerFragment {
  const levels = levelsOf(explanation);
  const html = renderToStaticMarkup(<ExplainerBody explanation={explanation} />);
  return {
    path: `${EXPLAINER_FRAGMENT_DIR}/${explanation.paper}/${explainerId(explanation)}.json`,
    json: `${JSON.stringify({ levels, html })}\n`,
  };
}
