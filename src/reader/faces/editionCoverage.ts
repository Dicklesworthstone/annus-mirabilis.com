/**
 * What an edition does not cover yet, and what its German column must say about itself.
 *
 * An edition can arrive a section at a time (dispatch 189: "one section is one unit"). Special
 * relativity's first English units covered the masthead and the introduction, and the English and
 * parallel faces showed them with no word that §§ 1-10 were still to come, so a reader could take
 * the introduction for the paper. These faces now name the sections no translation unit reaches.
 *
 * The German column of the parallel face takes its label from the ledger draft's notice. A paper
 * with no draft face (special relativity, whose draft's paragraphs do not yet pair with the
 * manifest) had none, and its machine-drafted German showed unlabelled. editionGermanNotice
 * derives the label from the blocks' own review status instead, so an unreviewed block is never
 * shown as if it were reviewed.
 */
import type { SourceFaceNotice } from "../../content/provenance/sourceFaceNotice.ts";
import type { GlossUnit, SourceBlock, TranslationUnit } from "../../content/schemas/source.ts";
import { type BlockReviewStatus, editionBlocksReviewed } from "../faceAvailability.ts";

type SectionedBlock = Pick<SourceBlock, "id" | "section" | "sentenceSpans">;

/**
 * The paper's sections, in its own order, that no translation unit reaches. A unit reaches a
 * section when one of its source references names a block in that section or one of that block's
 * sentences. The masthead and part headings carry no section and reach none.
 */
export function untranslatedSections(
  sectionIds: readonly string[],
  blocks: readonly SectionedBlock[],
  units: readonly Pick<TranslationUnit, "sourceRefs">[],
): readonly string[] {
  const sectionOf = new Map<string, string>();
  for (const block of blocks) {
    if (!block.section) continue;
    sectionOf.set(block.id, block.section);
    for (const span of block.sentenceSpans ?? []) sectionOf.set(span.id, block.section);
  }
  const reached = new Set<string>();
  for (const unit of units)
    for (const ref of unit.sourceRefs) {
      const section = sectionOf.get(ref.id);
      if (section) reached.add(section);
    }
  return sectionIds.filter((id) => !reached.has(id));
}

/**
 * The paper's sections, in its own order, that no gloss unit reaches (dispatch 207). A gloss unit
 * reaches a section when its sentenceId names a block in that section or one of that block's
 * sentences. A masthead reaches none, whatever section it carries: Brownian motion's frozen
 * manifest files its title and author line under s0, and a glossed title is not a glossed
 * introduction. The gloss arrives a section at a time like the translation, and its face names
 * what it does not cover yet from this.
 */
export function unglossedSections(
  sectionIds: readonly string[],
  blocks: readonly (SectionedBlock & Partial<Pick<SourceBlock, "kind">>)[],
  glossUnits: readonly Pick<GlossUnit, "sentenceId">[],
): readonly string[] {
  const sectionOf = new Map<string, string>();
  for (const block of blocks) {
    if (!block.section || block.kind === "masthead") continue;
    sectionOf.set(block.id, block.section);
    for (const span of block.sentenceSpans ?? []) sectionOf.set(span.id, block.section);
  }
  const reached = new Set<string>();
  for (const unit of glossUnits) {
    const section = sectionOf.get(unit.sentenceId);
    if (section) reached.add(section);
  }
  return sectionIds.filter((id) => !reached.has(id));
}

/** The paper's sections, in its own order, that no German source block belongs to. */
export function missingGermanSections(
  sectionIds: readonly string[],
  blocks: readonly Pick<SourceBlock, "section">[],
): readonly string[] {
  const present = new Set(blocks.map((b) => b.section).filter((s): s is string => Boolean(s)));
  return sectionIds.filter((id) => !present.has(id));
}

/**
 * "the introduction and §§ 2–10": s0 is the introduction, s<n> is § n, and three or more
 * consecutive sections collapse to a range. An id of another shape is named as it is.
 */
export function sectionsLabel(ids: readonly string[]): string {
  const numbers: number[] = [];
  const parts: string[] = [];
  let introduction = false;
  for (const id of ids) {
    const n = /^s(\d+)$/.exec(id);
    if (!n) parts.push(id);
    else if (n[1] === "0") introduction = true;
    else numbers.push(Number(n[1]));
  }
  numbers.sort((a, b) => a - b);
  const runs: string[] = [];
  for (let i = 0; i < numbers.length; ) {
    let j = i;
    while (j + 1 < numbers.length && numbers[j + 1] === (numbers[j] as number) + 1) j++;
    if (j - i >= 2) runs.push(`${numbers[i]}–${numbers[j]}`);
    else for (let k = i; k <= j; k++) runs.push(String(numbers[k]));
    i = j + 1;
  }
  const sections =
    runs.length === 0
      ? []
      : [
          `${runs.length === 1 && !runs[0]?.includes("–") ? "§" : "§§"} ${
            runs.length === 1 ? runs[0] : `${runs.slice(0, -1).join(", ")} and ${runs.at(-1)}`
          }`,
        ];
  const all = [...(introduction ? ["the introduction"] : []), ...sections, ...parts];
  return all.length <= 1 ? (all[0] ?? "") : `${all.slice(0, -1).join(", ")} and ${all.at(-1)}`;
}

/** The label and sentence the parallel face's German column carries. */
export type GermanColumnNotice = Pick<SourceFaceNotice, "state" | "label" | "body">;

/**
 * The German column's label when no ledger draft supplies one: a machine-draft notice while any
 * block is unreviewed (faceAvailability.ts sourceBlockIsReviewed), and none for a reviewed
 * edition or an empty one. Every clause is what the blocks' status fields say.
 */
export function editionGermanNotice(
  blocks: readonly BlockReviewStatus[],
): GermanColumnNotice | undefined {
  if (blocks.length === 0 || editionBlocksReviewed(blocks)) return undefined;
  return {
    state: "machine-draft",
    label: "Machine draft, not reviewed",
    body: "This German text has not been reviewed by a human. No reviewer has checked it against the printed page.",
  };
}
