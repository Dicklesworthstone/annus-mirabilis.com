/**
 * A laboratory page's formulas as targets (dispatch 274): the island the reading faces and the
 * explanations mount (InlineTermLighting, NavyKite's 0c067e18), once per lab page. Pointing at a
 * coloured glyph of a formula in the lab's sentences lights every copy of its quantity on the page,
 * in the sentences and in the lab's displays; pressing it pins the quantity and opens the inspector
 * just after the formula; a second press, a press elsewhere, or Escape clears it.
 *
 * The facts are built with the page (build-equations.ts, lab-inlines.json) from the same formulas
 * the page draws (labFormulaSites.ts, labInlines.ts), and only this lab's quantities reach the
 * island. A lab with no coloured formula mounts nothing.
 */
import { type InlineQuantity, InlineTermLighting } from "../../equations/InlineTermLighting.tsx";
import payload from "../../generated/lab-inlines.json";

const LABS = (
  payload as unknown as {
    labs: Readonly<
      Record<
        string,
        Readonly<{ paper: string; quantities: Readonly<Record<string, InlineQuantity>> }>
      >
    >;
  }
).labs;

export function LabInlineTerms({ lab }: { lab: string }) {
  const own = LABS[lab];
  return own && Object.keys(own.quantities).length > 0 ? (
    <InlineTermLighting paper={own.paper} quantities={own.quantities} />
  ) : null;
}
