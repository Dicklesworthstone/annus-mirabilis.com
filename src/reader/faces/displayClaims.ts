/**
 * EACH DISPLAY IS PRINTED ONCE, WHERE THE COMPOSITOR PUT IT.
 *
 * A paragraph that runs through a displayed equation carries it as a zero-width math inline with
 * `display: true`, naming the equation block by id (content/schemas/inlines.ts). The equation block
 * exists as well, so an anchor and an alignment edge can name it. Rendering both printed every such
 * display twice in a German column: once inside the sentence that introduces it, and once more
 * after the paragraph, where it was never printed. A face therefore renders the display inside its
 * paragraph and skips the equation block that paragraph claims. An equation block that no
 * paragraph claims still stands alone. GermanDraftFace makes the same choice for the ledger draft
 * (its claimedEquationIds).
 */
import type { Inline } from "../../content/schemas/inlines.ts";
import type { SourceBlock } from "../../content/schemas/source.ts";

function displayIds(inlines: readonly Inline[], into: Set<string>): void {
  for (const node of inlines) {
    if (node.kind === "math" && node.display === true && node.equationId) into.add(node.equationId);
    else if (node.kind === "emphasis") displayIds(node.inlines, into);
  }
}

/** Equation block ids that some non-equation block renders in place as a display inline. */
export function claimedDisplayIds(blocks: readonly SourceBlock[]): ReadonlySet<string> {
  const claimed = new Set<string>();
  for (const block of blocks) if (block.kind !== "equation") displayIds(block.inlines, claimed);
  return claimed;
}

/** The blocks a face renders in sequence: every block except an equation a paragraph prints. */
export function withoutClaimedDisplays<T extends SourceBlock>(blocks: readonly T[]): T[] {
  const claimed = claimedDisplayIds(blocks);
  return blocks.filter((b) => !(b.kind === "equation" && claimed.has(b.id)));
}
