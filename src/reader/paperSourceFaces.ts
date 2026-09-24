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
import { type FaceAvailability, faceAvailability } from "./faceAvailability.ts";
import { loadBilingualEdition } from "./faces/bilingualLoader.ts";
import type { FaceId } from "./faces/registry.ts";

export interface PaperSourceFaces {
  readonly availability: Readonly<Record<FaceId, FaceAvailability>>;
  /** The German face renders the drafted ledger, not a compiled edition. */
  readonly germanIsDraft: boolean;
  /**
   * "#s1" where the source has a block with the section's id; "#s0-p1" for a section that starts
   * with a paragraph instead (an introduction has no heading); "" when it has neither, so the link
   * opens the face rather than naming an id that is not there.
   */
  sectionFragment(section: string): string;
}

export async function paperSourceFaces(paperId: string): Promise<PaperSourceFaces> {
  const edition = await loadBilingualEdition(paperId).catch(() => null);
  const editionBlocks = edition?.blocks.length ?? 0;
  const draft = editionBlocks === 0 ? loadGermanSourceFace(paperId as RouteSlug) : null;
  const availability = faceAvailability({
    blocks: editionBlocks,
    units: edition?.units.length ?? 0,
    glossUnits: edition?.glossUnits?.length ?? 0,
    germanDraftBlocks: draft?.blocks.length ?? 0,
  });
  // What the German face publishes: the edition's block ids, or the draft's manifest anchors.
  const anchors = new Set<string>(
    editionBlocks > 0
      ? (edition?.blocks.map((b) => b.id) ?? [])
      : Object.values(draft?.anchors.anchorOf ?? {}),
  );
  return {
    availability,
    germanIsDraft: editionBlocks === 0,
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
