/**
 * "EXPLAIN THIS EQUATION" under a printed display (dispatch 278). The owner, 2026-09-26: "they must
 * have multiple options for explaining in more detail (including in words) what the equation means".
 *
 * It is set inside the display's TermHighlight (PrintedDisplayTerms.tsx), so a phrase of the
 * equation in words lights its term in the formula and the reverse, a press pins it, and Escape
 * clears it, with no island of its own: each phrase and each coloured glyph of a step carries its
 * quantity id, as the display's glyphs do.
 *
 * THE LEVELS, from the display's record (content/equation-explanations/, compiled by the build):
 * In words; Overview (R0); Full explanation (R1); Every step (R2), each step's formula with the
 * reason for it; Historian's margin (R3), where the record has one. A model equation on an
 * explanation page carries the same control, from its bound display's record or from its own
 * sentence and explanation (modelExplanations.ts, dispatch 278 step 4); it then has In words and
 * the full explanation alone, and the panel offers those rather than padding the rest. Opened, the panel shows In words
 * and the level the page's Detail names (Overview, Full explanation or Show every step,
 * :root[data-detail], set before first paint). "Also" opens any other level on this one equation,
 * without changing the page's setting.
 *
 * WHAT THE PAGE CARRIES, AND WHAT IT FETCHES (dispatch 292). Measured on a build of 8d42d5ef:
 * relativity's German face carried 98 panels and stood at 992,203 bytes gzipped against a recorded
 * 385,289, because every panel is written twice, once as markup and once into React's flight data,
 * which for this content is 1.55 times the markup. So the page carries only what a reader meets
 * without asking: the control, the equation in words, and the names of the levels. R0 to R3 are
 * fetched from a static fragment on first expansion (ExplainerFragment.tsx), which is AGENTS.md's
 * own prescription for a face over budget. Nothing is lost and no words are cut: a reader without
 * JavaScript, or one whose fetch fails, is given a real link to the page that holds every level.
 *
 * NO SCRIPT, AND PHRASING ONLY. A printed display is set inside its paragraph's <p>, which may hold
 * no div, details or list, so every element here is a span, and each toggle is a checkbox wrapped in
 * its label, which works without JavaScript and needs no id. The stylesheet (equationExplainer.css)
 * does the rest with :has(). With no JavaScript the pre-paint script never set data-detail: the
 * panel is open on In words, and the levels are one link away.
 */
import { Fragment } from "react";
import {
  explainerFragmentUrl,
  explainerHref,
  explainerId,
} from "../../equations/printed/explainerLinks.ts";
import type { ExplainerLevels, ProsePart } from "../../equations/printed/printedExplanations.ts";
import "./equationExplainer.css";

const LEVELS = [
  { level: "0", name: "Overview" },
  { level: "1", name: "Full explanation" },
  { level: "2", name: "Every step" },
  { level: "3", name: "Historian's margin" },
] as const;

/**
 * Prose with its formulas already drawn, keyed by position (the parts never move). A formula that
 * binds a quantity, or prints a name the notation declares no quantity, is marked as the reading
 * faces mark theirs (inline-math, the paper, data-inline-terms or data-inline-labels), so the page's
 * island lights and pins it and equations.css tints it (dispatch 280, step 1b).
 */
function Prose({ parts, paper }: { parts: readonly ProsePart[]; paper: string }) {
  const keyed = parts.map((part, n) => ({ part, key: `${n}:${part.kind}` }));
  return keyed.map(({ part, key }) =>
    part.kind === "text" ? (
      <Fragment key={key}>{part.text}</Fragment>
    ) : (
      <span
        key={key}
        className={
          part.coloured || part.labelled ? "eq-explain-math inline-math" : "eq-explain-math"
        }
        data-paper={part.coloured || part.labelled ? paper : undefined}
        data-inline-terms={part.coloured ? "" : undefined}
        data-inline-labels={part.labelled ? "" : undefined}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX output compiled by the build from a checked record (equationExplanations.ts): no trust beyond \htmlData term marks, MathML checked equal to the plain render.
        dangerouslySetInnerHTML={{ __html: part.html }}
      />
    ),
  );
}

/** The equation in words, each phrase bound to the quantity it names, so pointing at a phrase lights
 * the glyph in the formula and the reverse. */
export function ExplainerWords({ explanation }: { explanation: ExplainerLevels }) {
  return (
    <span className="eq-explain-words equation-sentence">
      <span className="eq-level-name">In words</span>
      {explanation.inWords.map((phrase, n) =>
        phrase.quantityId ? (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: the phrases are a fixed sentence and never reorder.
            key={n}
            className="equation-quantity"
            data-quantity-id={phrase.quantityId}
          >
            {phrase.text}
          </span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: as above.
          <Fragment key={n}>{phrase.text}</Fragment>
        ),
      )}
    </span>
  );
}

/** Everything a reader asked for: the equation in words, the levels, and the choice of another one.
 * The build renders this into the fragment a panel fetches, and the page that holds the full text
 * renders the same component, so the two can never drift apart. */
export function ExplainerBody({ explanation }: { explanation: ExplainerLevels }) {
  const levels = LEVELS.filter((l) =>
    (explanation.levels ?? levelsOf(explanation)).includes(l.level),
  );
  const steps = (explanation.r2 ?? []).map((step, n) => ({ step, key: `step-${n + 1}` }));
  return (
    <>
      <ExplainerWords explanation={explanation} />
      {explanation.r0 ? (
        <span className="eq-level" data-level="0">
          <span className="eq-level-name">Overview</span>
          <Prose parts={explanation.r0} paper={explanation.paper} />
        </span>
      ) : null}
      {explanation.r1 ? (
        <span className="eq-level" data-level="1">
          <span className="eq-level-name">Full explanation</span>
          <Prose parts={explanation.r1} paper={explanation.paper} />
        </span>
      ) : null}
      {steps.length > 0 ? (
        <span className="eq-level" data-level="2">
          <span className="eq-level-name">Every step</span>
          {/* biome-ignore lint/a11y/useSemanticElements: inline, an <ol> would end the paragraph the display is printed in. */}
          <span className="eq-steps" role="list">
            {steps.map(({ step, key }) => (
              // biome-ignore lint/a11y/useSemanticElements: an <li> needs its <ol>, which a paragraph may not hold.
              <span key={key} className="eq-step" role="listitem">
                <span
                  className={
                    step.coloured || step.labelled
                      ? "eq-step-formula inline-math"
                      : "eq-step-formula"
                  }
                  data-paper={step.coloured || step.labelled ? explanation.paper : undefined}
                  data-inline-terms={step.coloured ? "" : undefined}
                  data-inline-labels={step.labelled ? "" : undefined}
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX output compiled by the build from a checked record, as the prose's formulas are.
                  dangerouslySetInnerHTML={{ __html: step.formula }}
                />
                <span className="eq-step-why">
                  <Prose parts={step.why} paper={explanation.paper} />
                </span>
              </span>
            ))}
          </span>
        </span>
      ) : null}
      {explanation.r3 ? (
        <span className="eq-level" data-level="3">
          <span className="eq-level-name">Historian's margin</span>
          <Prose parts={explanation.r3} paper={explanation.paper} />
        </span>
      ) : null}
      {levels.length > 1 ? (
        <span className="eq-explain-more">
          <span className="eq-level-name">Also</span>
          {levels.map(({ level, name }) => (
            <label key={level} className="eq-explain-also" data-level={level}>
              <input type="checkbox" className="eq-explain-level" data-level={level} />
              {name}
            </label>
          ))}
        </span>
      ) : null}
    </>
  );
}

/** Which levels an explanation fills, in the order the panel offers them. */
export function levelsOf(explanation: ExplainerLevels): readonly string[] {
  const has: Readonly<Record<string, boolean>> = {
    "0": explanation.r0 !== undefined,
    "1": explanation.r1 !== undefined,
    "2": (explanation.r2?.length ?? 0) > 0,
    "3": explanation.r3 !== undefined,
  };
  return LEVELS.filter((l) => has[l.level]).map((l) => l.level);
}

export function EquationExplainer({ explanation }: { explanation: ExplainerLevels }) {
  const levels = explanation.levels ?? [];
  return (
    <span
      className="eq-explainer"
      lang="en"
      data-explains={explainerId(explanation)}
      data-explainer-fragment={explainerFragmentUrl(explanation)}
      // Where the explanation has only one level, that level shows whatever the page's Detail says,
      // rather than an empty panel.
      data-only-level={levels.length === 1 ? levels[0] : undefined}
    >
      {/* A REAL LINK, WHICH SCRIPT UPGRADES (dispatch 292). Followed, it opens the page holding
          every level, which is what a reader without JavaScript gets and what a failed fetch falls
          back to. With script, ExplainerFragments.tsx keeps the reader here: it opens the panel and
          fetches the words. The link is the whole of what a face carries for an equation, so a page
          of ninety-eight displays pays for ninety-eight links and nothing else. */}
      <a className="eq-explain-control" href={explainerHref(explanation)}>
        Explain this equation
      </a>
      <span className="eq-explain-body">
        <span className="eq-explain-levels" aria-live="polite" />
      </span>
    </span>
  );
}
