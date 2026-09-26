import { renderToString } from "katex";
import { type LabFormula as Resolution, scopedFormula } from "./printed/labInlines.ts";
import { TermHighlight } from "./TermHighlight.tsx";
import "./equations.css";
import "../generated/quantity-colours-by-paper.css";

/**
 * A formula in its paper's colours, read in a paper and the sections given (dispatch 274, split out
 * of the labs' LabFormula for GreenBarn's explanation displays, 273). Each term the notation
 * concordance binds there is marked with its quantity and coloured as on the reading faces:
 * - a formula in a sentence takes the faces' inline markup (inline-math, data-inline-terms,
 *   data-paper), which the page's island lights and pins page-wide (InlineTermLighting);
 * - a display lights its own terms (TermHighlight), as a printed display does, and is lit with the
 *   page.
 * A formula the resolver cannot read in full renders plain and names the glyphs it could not bind
 * (data-inline-refused), so it is never plain in silence; one whose atoms are all operators or
 * declared non-quantities renders plain, with nothing to colour.
 *
 * Its own component, not an option of Formula or InlineFormula: those also render on pages that
 * should not ship the client island, and a client island imported there ships there whether or not
 * it renders.
 */
function plain(latex: string, displayMode: boolean): string {
  return renderToString(latex, {
    displayMode,
    output: "htmlAndMathml",
    throwOnError: true,
    strict: "error",
    trust: false,
  });
}

/**
 * The markup of a resolved or refused formula. `name` is the marker the page's tests find it by:
 * data-<name> holds `id`, with data-<name>-bound="none" when there is nothing to colour and
 * data-<name>-unscoped when no scope was given.
 */
export function FormulaMarkup({
  result,
  latex,
  displayMode,
  tabIndex,
  name,
  id,
}: Readonly<{
  result: Resolution;
  latex: string;
  displayMode: boolean;
  tabIndex?: number | undefined;
  name: "lab-formula" | "scoped-formula";
  id: string;
}>) {
  const Element = displayMode ? "div" : "span";
  const className = displayMode ? "formula" : "formula-inline";
  const marker = { [`data-${name}`]: id };
  if (result.kind === "resolved" && result.compiled.terms.length > 0) {
    const drawn = (
      <Element
        className={className}
        tabIndex={tabIndex}
        data-latex={latex}
        {...{ dangerouslySetInnerHTML: { __html: result.compiled.html } }}
      />
    );
    // A formula in a sentence takes the faces' inline markup, which the page's island finds, with
    // the same tints and none of .printed-display-terms' display: block, which broke each coloured
    // inline formula onto a line of its own.
    if (!displayMode)
      return (
        <span
          className="inline-math"
          data-inline-terms=""
          data-paper={result.compiled.paper}
          {...marker}
        >
          {drawn}
        </span>
      );
    return (
      <TermHighlight
        as="div"
        className="printed-display-terms"
        data-paper={result.compiled.paper}
        {...marker}
      >
        {drawn}
      </TermHighlight>
    );
  }
  const refused =
    result.kind === "refused"
      ? [...new Set(result.problems.map((p) => p.glyph))].join(" ")
      : undefined;
  return (
    <Element
      className={className}
      tabIndex={tabIndex}
      data-latex={latex}
      {...marker}
      data-inline-refused={refused}
      {...{
        [`data-${name}-bound`]: result.kind === "resolved" ? "none" : undefined,
        [`data-${name}-unscoped`]: result.kind === "unscoped" ? "true" : undefined,
      }}
      {...{ dangerouslySetInnerHTML: { __html: plain(latex, displayMode) } }}
    />
  );
}

/**
 * A formula read in `paper`'s notation in `sections` (s0 to s10), with no lab's letters: a display
 * when `display`, else in its sentence. `where` names it in each refusal and on its marker.
 */
export function ScopedFormula({
  paper,
  sections,
  latex,
  display,
  where,
  tabIndex,
}: Readonly<{
  paper: string;
  sections: readonly string[];
  latex: string;
  display?: boolean;
  where: string;
  tabIndex?: number;
}>) {
  const displayMode = display === true;
  return (
    <FormulaMarkup
      result={scopedFormula({ paper, sections, where }, latex, displayMode)}
      latex={latex}
      displayMode={displayMode}
      tabIndex={tabIndex}
      name="scoped-formula"
      id={where}
    />
  );
}
