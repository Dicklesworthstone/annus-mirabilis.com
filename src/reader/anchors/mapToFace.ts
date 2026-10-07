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
 * AND THE REPLACEMENT DIAGNOSIS WAS ALSO WRONG. It said, on 2026-10-07, that "what is still missing
 * is a producer", and filed am-to1q for one. Walking the import graph from `src/app/` the same day
 * says the gap is not a missing producer but a SECOND OWNER, for two of this module's three jobs:
 *
 *     src/reader/facsimile/document.ts        9 routes   unit -> PDF page, from the SAME manifest
 *     src/reader/weave/contentIds.ts          4 routes   canonical / split-sentence mapping
 *     src/reader/anchors/mapToFace.ts         0 routes   this module
 *
 * `projectFacsimileDocument` reads `content/source-blocks/<slug>/manifest.yaml` -- the exact input a
 * `StructureIndex` producer was to read -- and `resolveFacsimileTarget` resolves a content id to a
 * PDF page from it, strictly more richly than `mapToFacsimilePage` below: it also accepts aliases,
 * page anchors, and a bare section id. So a producer feeding `pdfPageByUnit` would not connect an
 * orphan, it would install a rival to a live reader path, which is the thing "kernels own the law"
 * forbids. Whether `mapToFacsimilePage` is retired or kept as the pure half is a removal decision
 * and belongs to the owner; it is NOT settled here, and nothing in this module may be deleted to
 * settle it.
 *
 * The split-sentence arm was the same shape and IS now fixed, by consuming the owner rather than a
 * copy of its grammar. See the comment at that arm.
 *
 * WHAT REMAINS GENUINELY UNOWNED is the nearest-ancestor walk and `resultsBySection`: `parentId`
 * appears in this module and its two tests and nowhere else, and so does `resultsBySection`.
 *
 * THIS MODULE IS NOT ALONE. Five of the eight modules in this directory have zero non-test
 * importers -- aliasAnchors, mapToFace, paneIds, placeKeeper, scrollRestore -- and all five were
 * built by am-read-anchors-navigation-a6o, which is still OPEN. `placeKeeper.ts` names its live
 * twin in its own docblock: `src/reader/detail/nearestStableAnchor.ts`, the Detail-axis
 * place-keeper, reaches 8 routes. The face-axis one reaches none. The debt is recorded and gated in
 * `unwiredAnchorModules.test.ts` beside this file.
 */

import { contentIdVariants, isSentenceContentId } from "../weave/contentIds.ts";

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

  // THE SPLIT-SENTENCE ARM HAS ONE OWNER, and it is not this module. `src/reader/weave/contentIds.ts`
  // already decides what counts as a sentence anchor and which ids one can be rendered under, and its
  // own docblock says it exists "so no face -- German face, English face, or a future gloss/parallel
  // face -- ever has to reimplement that mapping". This module reimplemented it anyway: the guard here
  // was an inline `/^(s\d+-p\d+-s\d+)([ab])?$/`, character-for-character the private
  // `SENTENCE_PATTERN` of src/content/anchors.ts, which is NOT exported. A copied grammar beside an
  // unexported original cannot be kept in step: were the id grammar to admit a third split suffix,
  // the owner would learn it and this copy would not, and the divergence would be silent because
  // `contentIdVariants` returns the same three ids in the same preference order this arm wanted.
  //
  // Measured before the change: the two predicates agreed on all 21 probe ids, which is what a copy
  // looks like while it is still fresh rather than evidence that copying is safe.
  if (isSentenceContentId(id)) {
    // `contentIdVariants` canonicalises its own argument, so an English half and its German source
    // id both produce the same three variants in the same order; no outer canonicalisation here.
    for (const variant of contentIdVariants(id)) {
      if (presentIds.has(variant)) return variant;
    }
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
