import type { CompiledEquation } from "../../equations/viewTypes.ts";
import { EquationPinError } from "./pinnedEquationStore.ts";

/** Select existing compiled markup; never rewrite LaTeX or infer a printed equivalent. */
export function pinnedEquationView(
  equation: CompiledEquation,
  form: "modern" | "printed",
): CompiledEquation {
  const { notationForm, ...single } = equation;
  if (form === "modern") return single;
  if (notationForm?.state !== "printed") throw new EquationPinError();
  return {
    ...single,
    html: notationForm.html,
    mathml: notationForm.mathml,
    plainLatex: notationForm.plainLatex,
    sentence: notationForm.sentence,
    printedGlyphHtml: notationForm.glyphHtml,
  };
}
