/**
 * THE GLOSS, ONE SECTION PER PAGE (dispatch 254, TanElk's ruling on the face weights). The gloss
 * face was the heaviest page on the site: relativity's was 11.8 MB raw and 643 KB with brotli, the
 * whole paper glossed word by word. Now /papers/<p>/<section>/view/gloss/ prints only that section,
 * and /papers/<p>/view/gloss/ names every section as a real link and prints the first in full. It
 * works without JavaScript, and every word stays, one section at a time. The reading faces
 * (German, English, parallel) stay whole-paper, because find-in-page must reach the whole paper
 * there; the gloss is a study face, where a section is enough.
 */
import type { SourceBlock } from "../../content/schemas/source.ts";

/**
 * Each section's blocks, in the paper's order. A block with no section of its own joins the next
 * section: the masthead joins the introduction, and "I. Kinematischer Teil" the § 1 it heads. The
 * lines after the last section (the acknowledgment, the date-line, the receipt) join the last.
 */
export function blocksBySection<B extends Pick<SourceBlock, "section">>(
  blocks: readonly B[],
): ReadonlyMap<string, readonly B[]> {
  const out = new Map<string, B[]>();
  let pending: B[] = [];
  let last: string | undefined;
  for (const block of blocks) {
    if (!block.section) {
      pending.push(block);
      continue;
    }
    const list = out.get(block.section) ?? [];
    if (!out.has(block.section)) out.set(block.section, list);
    list.push(...pending, block);
    pending = [];
    last = block.section;
  }
  if (last !== undefined && pending.length > 0) out.get(last)?.push(...pending);
  return out;
}

/** The glossed sentences a section's page prints: gloss units whose sentence is in its blocks. */
export function glossedSentencesIn(
  blocks: readonly Pick<SourceBlock, "sentenceSpans">[],
  glossed: ReadonlySet<string>,
): number {
  let n = 0;
  for (const block of blocks)
    for (const span of block.sentenceSpans ?? []) if (glossed.has(span.id)) n++;
  return n;
}

/** Where a section's gloss is, and where the paper's gloss contents are. */
export const sectionGlossPath = (paper: string, section: string) =>
  `/papers/${paper}/${section}/view/gloss/`;
export const paperGlossPath = (paper: string) => `/papers/${paper}/view/gloss/`;
