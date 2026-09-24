/**
 * WHERE A FORMULA IN TODAY'S LETTERS SENDS THE READER FOR EINSTEIN'S (dispatch 138, answer 1).
 *
 * The note under a formula that keeps today's letters used to say "Einstein's are on the German
 * source face" on every paper, and on special-relativity that face shows "not yet available". It
 * is computed now, by the face chooser's own rule (paperSourceFaces.ts): the German face when it
 * renders text, otherwise the facsimile, the pinned PDF, and neither when there is neither. It
 * never names a face that has nothing in it.
 */
export type NotationNoteTarget = Readonly<{ face: "german" | "facsimile"; href: string }>;

export function notationNoteTarget(input: {
  paperId: string;
  /** The German face renders text (faceAvailability says "available"). */
  germanAvailable: boolean;
  /** "#s3" or "" (paperSourceFaces.sectionFragment), for the formula's own section. */
  germanFragment: string;
  /** The pinned facsimile's public path, when the file exists. */
  pdfHref: string | null;
}): NotationNoteTarget | undefined {
  if (input.germanAvailable)
    return { face: "german", href: `/papers/${input.paperId}/view/german/${input.germanFragment}` };
  if (input.pdfHref) return { face: "facsimile", href: input.pdfHref };
  return undefined;
}
