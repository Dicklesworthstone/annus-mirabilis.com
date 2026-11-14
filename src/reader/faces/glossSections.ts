/**
 * THE GLOSS, ONE SECTION PER PAGE (dispatch 254, TanElk's ruling on the face weights). The gloss
 * face was the heaviest page on the site: relativity's was 11.8 MB raw and 643 KB with brotli, the
 * whole paper glossed word by word. Now /papers/<p>/<section>/view/gloss/ prints only that section,
 * and /papers/<p>/view/gloss/ names every section as a real link and prints the first in full. It
 * works without JavaScript, and every word stays, one section at a time. The reading faces
 * (German, English, parallel) stay whole-paper, because find-in-page must reach the whole paper
 * there; the gloss is a study face, where a section is enough.
 */
import type { Inline, SourceBlock } from "../../content/schemas/source.ts";

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

/** Only authored inline addresses join the index, including formulas inside emphasis or notes. */
function inlineAddresses(inlines: readonly Inline[]): string[] {
  return inlines.flatMap((node) => {
    if (node.kind === "emphasis") return inlineAddresses(node.inlines);
    if (node.kind === "misprint" && "math" in node) return inlineAddresses([node.math]);
    return node.kind === "math" && node.inlineId ? [node.inlineId] : [];
  });
}

/**
 * The addresses served by each section's gloss, including blocks whose ids carry no section.
 * Use the same placement as the renderer: part headings join the next section and closing lines
 * the last. Retired addresses follow their already-resolved source aliases, not their old prefix.
 */
export function glossAnchorSections(
  blocks: readonly Pick<SourceBlock, "id" | "section" | "sentenceSpans" | "inlines">[],
  aliases: Readonly<Record<string, string>> = {},
): Readonly<Record<string, readonly string[]>> {
  const sections = new Map<string, Set<string>>();
  const sectionOf = new Map<string, string>();
  for (const [section, members] of blocksBySection(blocks)) {
    const ids = new Set<string>([section]);
    for (const block of members) {
      for (const id of [
        block.id,
        ...(block.sentenceSpans ?? []).map((span) => span.id),
        ...inlineAddresses(block.inlines),
      ]) {
        ids.add(id);
        sectionOf.set(id, section);
      }
    }
    sections.set(section, ids);
  }
  for (const [retired, target] of Object.entries(aliases)) {
    const section = sectionOf.get(target);
    if (section !== undefined && !sectionOf.has(retired)) sections.get(section)?.add(retired);
  }
  return Object.fromEntries([...sections].map(([section, ids]) => [section, [...ids]]));
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
