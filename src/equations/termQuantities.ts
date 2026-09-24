/**
 * TERMS AS TARGETS (dispatch 144): each KaTeX term span in a compiled equation's HTML carries its
 * term id (data-term), and its quantity is known only from the equation's term list. This adds the
 * quantity id to the span itself, so the formula, the sentence, the chips and the legend can all be
 * matched on one attribute, data-quantity-id, by exact value.
 *
 * EXACT, NEVER BY PREFIX. A term id is looked up whole in a map; one the map does not hold is left
 * as it was. The donor's ColorizedEquation matched by substring and prefix (`v.id.includes(varId)`,
 * `startsWith("var_" + id)`), which AGENTS.md bans: a quantity whose id begins another's would
 * light up with it.
 */
import type { CompiledEquation } from "./viewTypes.ts";

const TERM_ATTRIBUTE = /data-term="([^"]*)"/g;

/** Escapes a value for a double-quoted HTML attribute. Quantity ids are camel case; this is a guard. */
function attributeValue(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** The equation's KaTeX HTML with data-quantity-id beside each data-term its term list names. */
export function withQuantityIds(
  html: string,
  terms: readonly Pick<CompiledEquation["terms"][number], "termId" | "quantityId">[],
): string {
  const quantityOf = new Map(terms.map((t) => [t.termId, t.quantityId]));
  return html.replace(TERM_ATTRIBUTE, (whole, termId: string) => {
    const quantityId = quantityOf.get(termId);
    return quantityId === undefined
      ? whole
      : `${whole} data-quantity-id="${attributeValue(quantityId)}"`;
  });
}
