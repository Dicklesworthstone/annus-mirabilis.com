/**
 * Which reading faces actually have something to show, DERIVED (pane28, routed
 * 2026-09-22: "the chooser reads face availability from the same place the faces
 * themselves do").
 *
 * WHY THIS FILE EXISTS. The predicates were already in the codebase, but not in one
 * place: PaperPage's dispatch decided face by face, inline, whether to render a real
 * face or fall through to FaceFallback. The chooser had no access to any of it, so it
 * offered eight equal doors while english, gloss and parallel are empty for every
 * paper and german is set for three of four. Copying those conditions into the
 * chooser would have made a second source of truth for one question - the defect %29
 * is currently unpicking on the route side, where a shadowing page reports a route
 * written while the registry reports it unwritten. So the dispatch and the chooser
 * now call the same function.
 *
 * WHY facsimile IS "unknown" AND NOT A BOOLEAN. Its availability is decided by
 * loadFacsimileDocument, which reads the source YAML, reads the block manifest, and
 * then STREAMS THE WHOLE PDF to verify a SHA-256 - 1.6 to 4.4 MB per paper. The
 * cheap prefix of that check (is a scan pinned, is it admitted for publication)
 * answers only the negative cases; a positive answer costs the hash. FaceFallback
 * states the constraint this would break: "Only the explicit source face reads the
 * PDF; ordinary reading remains static and light." So this module refuses to claim,
 * rather than guessing from the cheap prefix or making every face page hash a PDF.
 * A caller that HAS already resolved the document can pass the answer in.
 *
 * The two non-source faces are always available because they are rendered from the
 * compiled paper itself rather than from an edition: `reading` is the explanation and
 * `results` projects argument recaps. `split` follows its default pair's source pane,
 * parallel: with no parallel face, the split page is a notice and a link back to the
 * explanation, so it is offered as not yet available rather than as a face.
 */

import type { FaceId } from "./faces/registry.ts";

/** `unknown` means NOT ESTABLISHED, and is never rendered as either a promise or a refusal. */
export type FaceAvailability = "available" | "empty" | "unknown";

/**
 * The counts the source faces are decided from. Every field is a length the caller
 * already holds: PaperPage loads the bilingual edition to render, and the German
 * draft loader reads one provenance receipt.
 */
export interface FaceContentCounts {
  /** Source blocks in the compiled bilingual edition. */
  readonly blocks: number;
  /** Translation units in the compiled bilingual edition. */
  readonly units: number;
  /** Gloss units in the compiled bilingual edition. */
  readonly glossUnits: number;
  /**
   * Blocks in the hand/machine-drafted German source face, which exists for papers
   * with no compiled edition. German is available when EITHER has blocks.
   */
  readonly germanDraftBlocks: number;
  /**
   * Passed only by a caller that has already resolved the facsimile document, so the
   * PDF is not read twice and is never read just to draw a chooser.
   */
  readonly facsimile?: FaceAvailability | undefined;
}

const has = (n: number): FaceAvailability => (n > 0 ? "available" : "empty");

/**
 * Availability per face. Mirrors PaperPage's dispatch exactly, and the dispatch calls
 * these helpers so the two cannot drift.
 */
export function faceAvailability(
  counts: FaceContentCounts,
): Readonly<Record<FaceId, FaceAvailability>> {
  return Object.freeze({
    reading: "available",
    results: "available",
    split: parallelFaceHasContent(counts.blocks, counts.units) ? "available" : "empty",
    german: has(counts.blocks + counts.germanDraftBlocks),
    english: has(counts.units),
    // Parallel and gloss need BOTH sides: a German block with no translation unit, or
    // no gloss unit, renders nothing to pair.
    parallel: counts.blocks > 0 && counts.units > 0 ? "available" : "empty",
    gloss: counts.blocks > 0 && counts.glossUnits > 0 ? "available" : "empty",
    facsimile: counts.facsimile ?? "unknown",
  } as const);
}

/** The dispatch's own predicates, exported so the chooser and the renderer share them. */
export const germanFaceHasContent = (blocks: number, draftBlocks: number): boolean =>
  blocks > 0 || draftBlocks > 0;
export const englishFaceHasContent = (units: number): boolean => units > 0;
export const parallelFaceHasContent = (blocks: number, units: number): boolean =>
  blocks > 0 && units > 0;
export const glossFaceHasContent = (blocks: number, glossUnits: number): boolean =>
  blocks > 0 && glossUnits > 0;
