/**
 * Which source faces a paper has, and where in them a passage's section begins.
 *
 * Three things on a paper page send a reader to the source: each passage's "Read the original"
 * action, its "Source context" line, and the notice ?view=german shows in its place. They used to
 * decide separately, and none asked whether the face had anything in it: all three pointed at
 * German, English and gloss on every paper, and at #<argument id>, an id no face renders. They now
 * share this, which decides by the chooser's own rule (faceAvailability.ts) and aims at an id the
 * German face really has.
 *
 * Server-only: the German draft is read from its provenance receipt on disk.
 */
import { loadGermanSourceFace } from "../content/editions/germanSourceFace.ts";
import type { RouteSlug } from "../content/ids.ts";
import {
  editionBlocksReviewed,
  type FaceAvailability,
  faceAvailability,
  germanFaceRendersEdition,
} from "./faceAvailability.ts";
import { loadBilingualEdition } from "./faces/bilingualLoader.ts";
import type { FaceId } from "./faces/registry.ts";

export interface PaperSourceFaces {
  readonly availability: Readonly<Record<FaceId, FaceAvailability>>;
  /** The German face renders the drafted ledger, not a compiled edition. */
  readonly germanIsDraft: boolean;
  /**
   * The ids the German face publishes as anchors: the edition's block ids, or the draft's manifest
   * anchors. Empty when the paper has no German text, so a link to a printed paragraph can wait
   * for its text instead of naming an id no page has.
   */
  readonly germanAnchors: ReadonlySet<string>;
  /**
   * "#s1" where the source has a block with the section's id; "#s0-p1" for a section that starts
   * with a paragraph instead (an introduction has no heading); "" when it has neither, so the link
   * opens the face rather than naming an id that is not there.
   */
  sectionFragment(section: string): string;
  /**
   * "#<unit id>" for the English face's first unit whose source sits in `section`, or "" when the
   * edition says of none, so the link opens the face rather than naming an id it lacks. Passages
   * are not yet bound to paragraphs, so this is the section's first sentence, not the passage's.
   */
  englishSectionFragment(section: string): string;
}

export async function paperSourceFaces(paperId: string): Promise<PaperSourceFaces> {
  const edition = await loadBilingualEdition(paperId).catch(() => null);
  const blocks = edition?.blocks ?? [];
  // The same choice PaperPage makes: the draft stays the German face until every block is reviewed.
  const draft = editionBlocksReviewed(blocks) ? null : loadGermanSourceFace(paperId as RouteSlug);
  const rendersEdition = germanFaceRendersEdition(blocks, draft?.blocks.length ?? 0);
  const availability = faceAvailability({
    blocks: blocks.length,
    units: edition?.units.length ?? 0,
    glossUnits: edition?.glossUnits?.length ?? 0,
    germanDraftBlocks: draft?.blocks.length ?? 0,
  });
  // What the German face publishes: the edition's block ids, or the draft's manifest anchors.
  const anchors = new Set<string>(
    rendersEdition ? blocks.map((b) => b.id) : Object.values(draft?.anchors.anchorOf ?? {}),
  );
  // Each block's section, under its own id and its sentences' ids, which is what a unit's
  // sourceRefs name; then the first unit, in the face's order, whose source lies in each section.
  const sectionOf = new Map<string, string>();
  for (const block of blocks) {
    if (!block.section) continue;
    sectionOf.set(block.id, block.section);
    for (const span of block.sentenceSpans ?? []) sectionOf.set(span.id, block.section);
  }
  const firstUnit = new Map<string, string>();
  for (const unit of edition?.units ?? []) {
    const section = unit.sourceRefs.map((r) => sectionOf.get(r.id)).find((s) => s !== undefined);
    if (section !== undefined && !firstUnit.has(section)) firstUnit.set(section, unit.id);
  }
  return {
    availability,
    germanIsDraft: !rendersEdition,
    germanAnchors: anchors,
    englishSectionFragment: (section) => {
      const id = firstUnit.get(section);
      return id ? `#${id}` : "";
    },
    sectionFragment: (section) =>
      anchors.has(section) ? `#${section}` : anchors.has(`${section}-p1`) ? `#${section}-p1` : "",
  };
}

/** The German face at a passage's section, or null when the paper has no German text. */
export function originalHref(
  paperId: string,
  sources: PaperSourceFaces,
  section: string,
): string | null {
  return sources.availability.german === "available"
    ? `/papers/${paperId}/view/german/${sources.sectionFragment(section)}`
    : null;
}
