/**
 * The pages' view of src/generated/equation-explanations.json (scripts/build-equations.ts, dispatch
 * 278): a printed display's explanation, compiled, found by its paper and display id. A display with
 * no record that passed finds nothing, and its face shows no control. Imported only by server
 * components, so the payload never reaches the reader's JavaScript. No "use client".
 */
import payload from "../../generated/equation-explanations.json";
import type { CompiledExplanation } from "./equationExplanations.ts";

export type {
  CompiledExplanation,
  CompiledStep,
  ExplainerLevels,
  ProsePart,
  WordsPhrase,
} from "./equationExplanations.ts";

const PAPERS = (
  payload as unknown as {
    papers: Readonly<Record<string, { displays: Readonly<Record<string, CompiledExplanation>> }>>;
  }
).papers;

/** The explanation of this printed display, or undefined where it has none yet. */
export function printedExplanation(
  paper: string | undefined,
  display: string | undefined,
): CompiledExplanation | undefined {
  if (paper === undefined || display === undefined) return undefined;
  return PAPERS[paper]?.displays[display];
}
