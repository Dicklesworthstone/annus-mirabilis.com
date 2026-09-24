/**
 * WHERE A FORMULA IN TODAY'S LETTERS SENDS THE READER FOR EINSTEIN'S (dispatch 138, answer 1).
 *
 * The note under a formula that keeps today's letters used to say "Einstein's are on the German
 * source face" on every paper, and on special-relativity that face shows "not yet available". It
 * is computed now, by the face chooser's own rule (paperSourceFaces.ts): the German face when it
 * renders text, otherwise the facsimile, the pinned PDF, and neither when there is neither. It
 * never names a face that has nothing in it.
 */
export type NotationNoteTarget = Readonly<{
  face: "german" | "facsimile";
  href: string;
  /**
   * The part of the German face the link opens at ("§4", "the introduction"). The notes on one
   * page link to different sections, so the link names its section: a page's links that share a
   * name must share a destination (linkNames.test.tsx).
   */
  part?: string;
}>;

export function notationNoteTarget(input: {
  paperId: string;
  /** The German face renders text (faceAvailability says "available"). */
  germanAvailable: boolean;
  /** "#s3" or "" (paperSourceFaces.sectionFragment), for the formula's own section. */
  germanFragment: string;
  /** The pinned facsimile's public path, when the file exists. */
  pdfHref: string | null;
  /** How a reader names the formula's section ("§4"); used only with a section fragment. */
  part?: string | undefined;
}): NotationNoteTarget | undefined {
  if (input.germanAvailable)
    return {
      face: "german",
      href: `/papers/${input.paperId}/view/german/${input.germanFragment}`,
      ...(input.germanFragment && input.part ? { part: input.part } : {}),
    };
  if (input.pdfHref) return { face: "facsimile", href: input.pdfHref };
  return undefined;
}
