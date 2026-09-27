import { labExplainer } from "../../equations/printed/labExplainers.ts";
import { labFormula } from "../../equations/printed/labInlines.ts";
import { FormulaMarkup } from "../../equations/ScopedFormula.tsx";
import { EquationExplainer } from "../../reader/faces/EquationExplainer.tsx";

/**
 * A laboratory's formula in its paper's colours (dispatch 274): read in the paper and sections the
 * lab's manifest names, with the lab's own letters (content/inline-terms/labs.yaml), and drawn as
 * ScopedFormula draws a formula (FormulaMarkup): a formula in a sentence is the page's to light
 * (LabInlineTerms, the faces' inline island), a display lights its own terms and is lit with the
 * page, and a formula the resolver cannot read names its unbound glyphs.
 *
 * `printed`: the lab quotes the formula as the paper prints it, so its letters are read in the
 * paper's notation alone and none of the lab's own readings reach it.
 *
 * "EXPLAIN THIS EQUATION" UNDER A DISPLAY (dispatch 301). A displayed formula carries the same
 * control the printed displays carry, from content/lab-explanations/<lab>.yaml: the paper's own
 * record where the lab draws one of its printed displays, so the reader meets the same words in
 * both places, or the lab's own words for a form the paper does not print. A formula judged
 * incidental, and one with no entry yet, has no explainer and draws no control rather than an empty
 * one. A formula inside a sentence never carries it: the sentence around it is its explanation.
 *
 * The panel weighs what its words weigh and no more. Its levels are not in this page: they are in a
 * static fragment it fetches on first expansion, which for a reused record is the one the reading
 * face already fetches (explainerFragments.tsx, dispatch 292).
 */
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
  return (
    <FormulaMarkup
      result={labFormula(lab, latex, displayMode, printed === true)}
      latex={latex}
      displayMode={displayMode}
      tabIndex={tabIndex}
      name="lab-formula"
      id={lab}
    />
  );
}

/** A displayed formula on a lab page, in its lab's scope, with its explanation where it has one. */
export function LabFormula({
  lab,
  latex,
  tabIndex,
  printed,
}: Readonly<{ lab: string; latex: string; tabIndex?: number; printed?: boolean }>) {
  const explanation = labExplainer(lab, latex);
  const formula = (
    <LabMath lab={lab} latex={latex} displayMode={true} tabIndex={tabIndex} printed={printed} />
  );
  // The pair is wrapped only when there is something to pair it with, so a lab page's markup is
  // unchanged wherever no entry has been written yet.
  return explanation ? (
    <div className="lab-formula-explained" data-lab-formula-explained={lab}>
      {formula}
      <EquationExplainer explanation={explanation} />
    </div>
  ) : (
    formula
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
