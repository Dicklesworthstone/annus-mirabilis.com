/**
 * Face navigation over a source StructureIndex. sourceStructureIndex.ts projects the manifest's
 * containment; FaceSwitchAnchor supplies the IDs actually rendered on the destination page.
 * Sentence equivalence belongs to weave/contentIds.ts and results associations to result cards.
 *
 * The retained facsimile helper below is not a live PDF owner. resolveFacsimileTarget in
 * src/reader/facsimile/document.ts owns PDF navigation, including aliases, sections and page
 * anchors. Per the owner's 2026-10-08 decision, do not supply a pdfPageByUnit producer here.
 */

import { canonicalContentId, contentIdVariants } from "../weave/contentIds.ts";

export interface StructureUnit {
  readonly id: string;
  /** Absent for a root: a section or a source unit with no declared container. */
  readonly parentId?: string;
}

export interface StructureIndex {
  readonly units: readonly StructureUnit[];
  /** Section id -> the result anchor ids derived in it, for the results face. */
  readonly resultsBySection?: Readonly<Record<string, readonly string[]>>;
  /**
   * Unit id -> its validated 1-based PDF page, already resolved to "the
   * first locator" for a page-crossing block by the source-manifest
   * compiler. This module never picks among locators itself.
   */
  readonly pdfPageByUnit?: Readonly<Record<string, number>>;
}

function parentOf(id: string, index: StructureIndex): string | undefined {
  return index.units.find((u) => u.id === id)?.parentId;
}

/**
 * Maps a source anchor to the nearest unit actually present on a face:
 * the id itself; failing that, for a sentence, its split-sentence
 * counterpart (English half <-> German source, defaulting to the first
 * half `a` when going source -> English, per the bead's own example);
 * failing that, its parent chain (sentence -> paragraph -> section).
 * Returns undefined only if nothing in the chain, including the root
 * section, is present.
 */
export function mapToFace(
  id: string,
  index: StructureIndex,
  presentIds: Pick<ReadonlySet<string>, "has">,
): string | undefined {
  const visited = new Set<string>();
  let current: string | undefined = id;
  while (current !== undefined && !visited.has(current)) {
    visited.add(current);
    // Keep an exact split half before considering its canonical sentence or sibling half.
    if (presentIds.has(current)) return current;
    // Sentence equivalence has one owner, including when the sentence is an inline unit's parent.
    for (const variant of contentIdVariants(current)) {
      if (presentIds.has(variant)) return variant;
    }
    const canonical = canonicalContentId(current);
    // A source manifest contains the German sentence, not the translation's split halves.
    current = parentOf(current, index) ?? parentOf(canonical, index);
  }
  return undefined;
}

/** The result anchors a section's results face shows, or an empty list if none are declared. */
export function mapToResultsFace(sectionId: string, index: StructureIndex): readonly string[] {
  return index.resultsBySection?.[sectionId] ?? [];
}

export type FacsimilePageMapping = Readonly<{
  page: number;
  /** False when no locator was found for the exact unit and an ancestor's page was used instead. */
  exact: boolean;
}>;

/**
 * Maps any source anchor to its facsimile page. A unit with no validated
 * locator maps to its nearest located ancestor (`exact: false`) rather
 * than guessing a page; a chain with no located unit at all returns
 * undefined, which the caller must report, not paper over.
 */
export function mapToFacsimilePage(
  id: string,
  index: StructureIndex,
): FacsimilePageMapping | undefined {
  const pages = index.pdfPageByUnit ?? {};
  let current: string | undefined = id;
  let exact = true;
  while (current !== undefined) {
    const page = pages[current];
    if (page !== undefined) {
      if (page < 1) {
        throw new Error(
          `Facsimile page for unit '${current}' is ${page}, but pdfPageIndex is 1-based: a 0-based reading is a defect, not a valid page.`,
        );
      }
      return { page, exact };
    }
    current = parentOf(current, index);
    exact = false;
  }
  return undefined;
}
