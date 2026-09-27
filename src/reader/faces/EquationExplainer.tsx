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
 * reason for it; Historian's margin (R3), where the record has one. Opened, the panel shows In words
 * and the level the page's Detail names (Overview, Full explanation or Show every step,
 * :root[data-detail], set before first paint). "Also" opens any other level on this one equation,
 * without changing the page's setting.
 *
 * NO SCRIPT, AND PHRASING ONLY. A printed display is set inside its paragraph's <p>, which may hold
 * no div, details or list, so every element here is a span, and each toggle is a checkbox wrapped in
 * its label, which works without JavaScript and needs no id. The stylesheet (equationExplainer.css)
 * does the rest with :has(). With no JavaScript the pre-paint script never set data-detail: the
 * panel is open on In words and the full explanation, and every other level is one toggle away.
 * Every level is in the static HTML.
 */
import { Fragment } from "react";
import type {
  CompiledExplanation,
  ProsePart,
} from "../../equations/printed/printedExplanations.ts";
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

export function EquationExplainer({ explanation }: { explanation: CompiledExplanation }) {
  const levels = LEVELS.filter((l) => l.level !== "3" || explanation.r3 !== undefined);
  const steps = explanation.r2.map((step, n) => ({ step, key: `step-${n + 1}` }));
  return (
    <span className="eq-explainer" lang="en" data-explains={explanation.display}>
      <label className="eq-explain-control">
        <input type="checkbox" className="eq-explain-open" />
        Explain this equation
      </label>
      <span className="eq-explain-body">
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
        <span className="eq-level" data-level="0">
          <span className="eq-level-name">Overview</span>
          <Prose parts={explanation.r0} paper={explanation.paper} />
        </span>
        <span className="eq-level" data-level="1">
          <span className="eq-level-name">Full explanation</span>
          <Prose parts={explanation.r1} paper={explanation.paper} />
        </span>
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
        {explanation.r3 ? (
          <span className="eq-level" data-level="3">
            <span className="eq-level-name">Historian's margin</span>
            <Prose parts={explanation.r3} paper={explanation.paper} />
          </span>
        ) : null}
        <span className="eq-explain-more">
          <span className="eq-level-name">Also</span>
          {levels.map(({ level, name }) => (
            <label key={level} className="eq-explain-also" data-level={level}>
              <input type="checkbox" className="eq-explain-level" data-level={level} />
              {name}
            </label>
          ))}
        </span>
      </span>
    </span>
  );
}
