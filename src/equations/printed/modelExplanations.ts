/**
 * "EXPLAIN THIS EQUATION" ON A MODEL EQUATION (dispatch 278, step 4). The explanation pages draw the
 * teaching equations as SemanticEquation cards. They carry the same control the printed displays
 * carry, from one of two places, and never from invented prose:
 *
 * - THE DISPLAY'S RECORD, where the equation is bound to a printed display that has one
 *   (content/bindings/<paper>.yaml). The card then shows what the display shows, all five levels,
 *   since it is the same equation in modern letters.
 * - THE EQUATION RECORD'S OWN FIELDS otherwise. Every one of the records carries a `sentence`, which
 *   is the equation in words with each phrase bound to a term, and an `explanation`, which is the
 *   full explanation. They become In words and Full explanation, and the card offers those two
 *   levels alone rather than padding the rest.
 *
 * A record with neither is returned as a gap, by id, for the build to count and name. None of the
 * prose is written here: the sentence and the explanation are the authors', moved, not rephrased.
 *
 * A PHRASE LIGHTS ONLY WHAT ITS CARD CARRIES. The display's words name the display's quantities, and
 * a model equation is the same relation in modern letters, so it need not bind every one of them:
 * mass-energy's exact drop binds the Lorentz factor where the printed display binds v and V. A
 * phrase naming a quantity this card does not bind keeps its words and loses its binding, so that
 * pointing at it never lights nothing.
 *
 * NO COMPILATION. A record's `explanation` is plain prose (measured across all of them: none carries
 * mathematics), so it needs no resolver and no KaTeX, and a card's explainer weighs what its two
 * strings weigh.
 */
import type { CompiledExplanation, ExplainerLevels, WordsPhrase } from "./equationExplanations.ts";

/** What a model equation needs to carry to be explained: the authors' own words. */
export type ExplainableEquation = Readonly<{
  id: string;
  paper: string;
  title: string;
  explanation: string;
  sentence: readonly Readonly<{ text: string; nodeId?: string | undefined }>[];
  terms: readonly Readonly<{ termId: string; quantityId: string }>[];
}>;

export type ModelExplanationGap = Readonly<{ equation: string; paper: string; reason: string }>;

/**
 * The equation's own sentence as phrases, each phrase bound to the quantity its term names, exactly
 * as the card's sentence binds them (SemanticEquation's quantityOfTerm).
 */
export function sentenceAsWords(equation: ExplainableEquation): readonly WordsPhrase[] {
  const quantityOf = new Map(equation.terms.map((term) => [term.termId, term.quantityId]));
  return equation.sentence.map((fragment) => {
    const quantityId = fragment.nodeId ? quantityOf.get(fragment.nodeId) : undefined;
    return quantityId ? { text: fragment.text, quantityId } : { text: fragment.text };
  });
}

/**
 * The explainer for one model equation: the bound display's record where there is one, else the
 * record's own words, else undefined with the reason.
 */
export function modelExplanation(
  equation: ExplainableEquation,
  displayExplanation?: CompiledExplanation | undefined,
): Readonly<{ explainer?: ExplainerLevels; gap?: ModelExplanationGap }> {
  if (displayExplanation) {
    const bound = new Set(equation.terms.map((term) => term.quantityId));
    return {
      explainer: {
        ...displayExplanation,
        inWords: displayExplanation.inWords.map((phrase) =>
          phrase.quantityId && bound.has(phrase.quantityId) ? phrase : { text: phrase.text },
        ),
      },
    };
  }
  const words = sentenceAsWords(equation);
  const explanation = equation.explanation.trim();
  if (words.length === 0 || explanation === "")
    return {
      gap: {
        equation: equation.id,
        paper: equation.paper,
        reason:
          words.length === 0
            ? "the record has no sentence, so there is nothing to say in words"
            : "the record has no explanation",
      },
    };
  return {
    explainer: {
      paper: equation.paper,
      inWords: words,
      r1: [{ kind: "text", text: explanation }],
    },
  };
}
