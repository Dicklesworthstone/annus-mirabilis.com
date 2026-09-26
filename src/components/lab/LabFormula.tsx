import { renderToString } from "katex";
import { labFormula } from "../../equations/printed/labInlines.ts";
import { TermHighlight } from "../../equations/TermHighlight.tsx";
import "../../equations/equations.css";
import "../../generated/quantity-colours-by-paper.css";

/**
 * A laboratory's formula in its paper's colours (dispatch 274): each term the notation concordance
 * binds in the lab's scope is marked with its quantity and coloured as on the reading faces, and
 * lit as there. A formula in a sentence is the page's to light (LabInlineTerms, the faces' inline
 * island): pointing at a glyph lights every copy of its quantity on the page, a press pins it with
 * the inspector after the formula. A display lights its own terms (TermHighlight), as a printed
 * display does on the faces, and is lit with the page.
 *
 * Its own component, not an option of Formula or InlineFormula: those also render on the reading
 * and Discover pages, and a client island imported there ships there whether or not it renders.
 *
 * A formula the resolver cannot read in full renders as before, plain, and names the glyphs it
 * could not bind (data-inline-refused), so it is never plain in silence. A formula whose atoms are
 * all operators or declared non-quantities renders plain, with nothing to colour.
 *
 * `printed`: the lab quotes the formula as the paper prints it, so its letters are read in the
 * paper's notation alone and none of the lab's own readings (content/inline-terms/labs.yaml) reach
 * it.
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

function LabMath({
  lab,
  latex,
  displayMode,
  tabIndex,
  printed,
}: Readonly<{
  lab: string;
  latex: string;
  displayMode: boolean;
  tabIndex?: number | undefined;
  printed?: boolean | undefined;
}>) {
  const result = labFormula(lab, latex, displayMode, printed === true);
  const Element = displayMode ? "div" : "span";
  const className = displayMode ? "formula" : "formula-inline";
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
          data-lab-formula={lab}
        >
          {drawn}
        </span>
      );
    return (
      <TermHighlight
        as="div"
        className="printed-display-terms"
        data-paper={result.compiled.paper}
        data-lab-formula={lab}
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
      data-lab-formula={lab}
      data-inline-refused={refused}
      data-lab-formula-bound={result.kind === "resolved" ? "none" : undefined}
      data-lab-formula-unscoped={result.kind === "unscoped" ? "true" : undefined}
      {...{ dangerouslySetInnerHTML: { __html: plain(latex, displayMode) } }}
    />
  );
}

/** A displayed formula on a lab page, in its lab's scope. */
export function LabFormula({
  lab,
  latex,
  tabIndex,
  printed,
}: Readonly<{ lab: string; latex: string; tabIndex?: number; printed?: boolean }>) {
  return (
    <LabMath lab={lab} latex={latex} displayMode={true} tabIndex={tabIndex} printed={printed} />
  );
}

/** A formula inside a sentence on a lab page, in its lab's scope. */
export function LabInlineFormula({
  lab,
  latex,
  printed,
}: Readonly<{ lab: string; latex: string; printed?: boolean }>) {
  return <LabMath lab={lab} latex={latex} displayMode={false} printed={printed} />;
}
