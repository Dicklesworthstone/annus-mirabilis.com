/**
 * "Explain this equation" under a laboratory's display (dispatch 301). The wiring, not the records:
 * that a displayed formula with an entry draws the control, that one without draws none rather than
 * an empty one, that a formula inside a sentence never draws it, and that the panel carries the
 * identity its fragment is named from rather than the levels themselves.
 */
import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { labExplainer } from "../../equations/printed/labExplainers.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { LabFormula, LabInlineFormula } from "./LabFormula.tsx";

/** LQ-08's three displayed formulas, as its page writes them. */
const PRINTED_LAW = "\\Pi\\varepsilon = \\frac{R}{N}\\beta\\nu - P";
const MODERN_LAW = "e V_s = h\\nu - \\Phi \\implies V_s = \\frac{h}{e}\\nu - \\frac{\\Phi}{e}";
const WORKED_VALUE = "V_s \\approx \\frac{h\\nu}{e} \\approx 4.3\\ \\text{V}";

async function drawn(element: Parameters<typeof exportMarkup>[0]) {
  const { document } = new Window();
  document.body.innerHTML = await exportMarkup(element);
  return document;
}

describe("a laboratory's display carries its explanation", () => {
  test("a formula that is one of the paper's printed displays draws the control", async () => {
    const document = await drawn(<LabFormula lab="lq-08" latex={PRINTED_LAW} />);
    const panel = document.querySelector(".eq-explainer");
    expect(panel).not.toBeNull();
    // Its identity is the printed display's, so the fragment it fetches and the page its no-script
    // link goes to are the ones the reading face already has.
    expect(panel?.getAttribute("data-explains")).toBe("eq-s8-d2");
    expect(document.querySelector(".formula[data-latex]")).not.toBeNull();
  });

  test("a form the paper does not print draws the control under its own id", async () => {
    const document = await drawn(<LabFormula lab="lq-08" latex={MODERN_LAW} />);
    expect(document.querySelector(".eq-explainer")?.getAttribute("data-explains")).toBe(
      "lab-lq-08-stopping-potential-modern",
    );
  });

  test("a formula judged incidental draws no control, rather than an empty one", async () => {
    const document = await drawn(<LabFormula lab="lq-08" latex={WORKED_VALUE} />);
    expect(document.querySelector(".eq-explainer")).toBeNull();
    // and the formula itself is unchanged.
    expect(document.querySelector(".formula[data-latex]")).not.toBeNull();
  });

  test("a formula inside a sentence never draws it", async () => {
    const document = await drawn(<LabInlineFormula lab="lq-08" latex={PRINTED_LAW} />);
    expect(document.querySelector(".eq-explainer")).toBeNull();
  });

  test("what the page carries is a real link to the page that holds every level", async () => {
    const document = await drawn(<LabFormula lab="lq-08" latex={PRINTED_LAW} />);
    const panel = document.querySelector(".eq-explainer");
    // Since dispatch 292 a face carries the control and nothing else: the levels are fetched from a
    // static fragment, and without JavaScript the control is followed to a page that holds them.
    const control = panel?.querySelector("a.eq-explain-control");
    expect(control?.getAttribute("href")).toBe("/equations/light-quanta/eq-s8-d2/");
    expect(panel?.getAttribute("data-explainer-fragment")).toBe(
      "/equation-explanations/light-quanta/eq-s8-d2.json",
    );
    // No level is written into the lab page, which is the whole point of the fragment.
    expect(panel?.querySelector(".eq-step-formula")).toBeNull();
    const explainer = labExplainer("lq-08", PRINTED_LAW);
    expect(explainer?.levels?.length ?? 0).toBeGreaterThan(0);
    expect(explainer?.r1).toBeUndefined();
  });

  test("a lab's own record links to its own page and fragment", async () => {
    const document = await drawn(<LabFormula lab="lq-08" latex={MODERN_LAW} />);
    const panel = document.querySelector(".eq-explainer");
    expect(panel?.querySelector("a.eq-explain-control")?.getAttribute("href")).toBe(
      "/equations/light-quanta/lab-lq-08-stopping-potential-modern/",
    );
    expect(panel?.getAttribute("data-explainer-fragment")).toBe(
      "/equation-explanations/light-quanta/lab-lq-08-stopping-potential-modern.json",
    );
  });

  test("every explainer the payload holds names an identity, since its fragment is named from it", () => {
    for (const latex of [PRINTED_LAW, MODERN_LAW]) {
      const explainer = labExplainer("lq-08", latex);
      expect(explainer?.display ?? explainer?.equation).toBeTruthy();
    }
  });
});
