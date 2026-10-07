/**
 * Nearest-ancestor, results, split-sentence, and facsimile mapping for
 * am-read-anchors-navigation-a6o. Pure functions over a `StructureIndex`
 * the caller supplies (a fixture in tests; the compiler's per-paper
 * structure index in production).
 *
 * THAT PARENTHESIS USED TO SAY the index was waiting on am-cm-source-manifest-6qa and that
 * "content/source-blocks/brownian-motion/manifest.yaml carries `units: []` today". Re-measured
 * 2026-10-07: that bead is closed and all four manifests are inventoried -- mass-energy 53,
 * light-quanta 263, brownian-motion 178, special-relativity 436 units. So the stated blocker is
 * gone.
 *
 * WHAT IS STILL MISSING IS A PRODUCER, and saying so is the point of this note, because the old
 * wording sent a reader to look at the manifests. `StructureIndex` appears in this module and its
 * two test files and NOWHERE else: nothing in `src/content` builds one, and nothing in production
 * calls `mapToFace`, `mapToResultsFace` or `mapToFacsimilePage`.
 *
 * The inputs for a producer are on disk now. Every unit carries `locators[].page` (53 of 53 for
 * mass-energy), so `pdfPageByUnit` is derivable; and sentence-to-paragraph parentage follows the id
 * grammar, with 28 of mass-energy's 53 units resolving to a parent that is itself a unit. The part
 * that needs a decision rather than a loop is the level above: a paragraph's parent is a section,
 * and sections are not among the manifest's unit kinds. Filed as its own bead.
 */

import { sourceSentenceId, splitSentenceIds } from "../../content/anchors.ts";

export interface StructureUnit {
  readonly id: string;
  /** Undefined only for a root unit (a section, which has no parent). */
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
  presentIds: ReadonlySet<string>,
): string | undefined {
  if (presentIds.has(id)) return id;

  const sentenceMatch = id.match(/^(s\d+-p\d+-s\d+)([ab])?$/);
  if (sentenceMatch?.[1]) {
    const source = sourceSentenceId(id);
    if (presentIds.has(source)) return source;
    const [a, b] = splitSentenceIds(source);
    if (presentIds.has(a)) return a;
    if (presentIds.has(b)) return b;
  }

  let current = id;
  for (;;) {
    const parent = parentOf(current, index);
    if (parent === undefined) return undefined;
    if (presentIds.has(parent)) return parent;
    current = parent;
  }
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
