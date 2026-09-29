import type { SourceBlock, TranslationUnit } from "../../content/schemas/source.ts";

/**
 * WHICH SECTION A TRANSLATION UNIT BELONGS TO (dispatch 480).
 *
 * This mapping already existed, inline in paperSourceFaces.ts, where it picks each section's first
 * English unit for a passage link. It is extracted here because a second reader needed it and a
 * second copy is the seam this repository keeps paying for: EnglishFace renders units and had no
 * way to ask which section one is in, so a section's English face rendered the WHOLE paper. Eleven
 * of relativity's section English faces measured 343.5 to 343.7 kB gzipped, within 200 bytes of
 * each other and of the whole paper's face, carrying 106,302 to 106,325 visible characters against
 * the whole paper's 106,333: a spread of 0.02%. The size was the symptom; a reader who opened §3's
 * English face was served all ten sections.
 *
 * A unit names its sources as `sourceRefs`, and a ref is a BLOCK id or a SENTENCE id, so the index
 * carries both: a block under its own id, and each of its sentence spans under theirs. That is what
 * the original comment in paperSourceFaces.ts says it is for, and both callers now read one index.
 */

/** Each block's section, under the block's own id and under each of its sentences' ids. */
export function sectionOfSourceId(blocks: readonly SourceBlock[]): ReadonlyMap<string, string> {
  const sectionOf = new Map<string, string>();
  for (const block of blocks) {
    if (!block.section) continue;
    sectionOf.set(block.id, block.section);
    for (const span of block.sentenceSpans ?? []) sectionOf.set(span.id, block.section);
  }
  return sectionOf;
}

/** The section a unit's first resolvable source ref sits in, or undefined. */
export function unitSection(
  unit: Pick<TranslationUnit, "sourceRefs">,
  sectionOf: ReadonlyMap<string, string>,
): string | undefined {
  return unit.sourceRefs.map((ref) => sectionOf.get(ref.id)).find((s) => s !== undefined);
}

/**
 * The units of one section, in the order given. A unit whose refs resolve to no section is kept:
 * the masthead's units carry no section and head every face, and a face that dropped a unit it
 * could not place would lose text silently rather than showing it in the wrong section.
 */
export function unitsInSection<T extends Pick<TranslationUnit, "sourceRefs">>(
  units: readonly T[],
  sectionOf: ReadonlyMap<string, string>,
  sectionId: string,
): readonly T[] {
  return units.filter((unit) => {
    const section = unitSection(unit, sectionOf);
    return section === undefined || section === sectionId;
  });
}
