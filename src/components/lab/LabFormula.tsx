import { labFormula } from "../../equations/printed/labInlines.ts";
import { FormulaMarkup } from "../../equations/ScopedFormula.tsx";

/**
 * A laboratory's formula in its paper's colours (dispatch 274): read in the paper and sections the
 * lab's manifest names, with the lab's own letters (content/inline-terms/labs.yaml), and drawn as
 * ScopedFormula draws a formula (FormulaMarkup): a formula in a sentence is the page's to light
 * (LabInlineTerms, the faces' inline island), a display lights its own terms and is lit with the
 * page, and a formula the resolver cannot read names its unbound glyphs.
 *
 * `printed`: the lab quotes the formula as the paper prints it, so its letters are read in the
 * paper's notation alone and none of the lab's own readings reach it.
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
