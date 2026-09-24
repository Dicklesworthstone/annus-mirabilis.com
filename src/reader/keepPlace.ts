/**
 * A FACE SWITCH KEEPS THE READER'S PLACE (am-ep-reader-k0z: "a deep-linked passage survives face
 * switching").
 *
 * Choosing Results, and then Reading, from the face links changed the view and announced "the
 * passage and laboratory are preserved", but not where the reader was: the new face lays out
 * differently, so the same scroll offset lands somewhere else. Measured on live 01478983 at
 * 1280x800, from /papers/light-quanta/#arg-lq-independent-configurations with that passage at
 * the top: after Results it stood 10,062px below the top of the viewport, and after Reading again
 * 14,354px.
 *
 * So the controller notes the passage at the top of the viewport before the switch, and after it
 * scrolls so that the same passage stands where it stood. Passages keep their element across
 * faces (each face is a part of the same article), so the element is the identity.
 */

export type Place = Readonly<{ passage: Element; top: number }>;

type Rect = Readonly<{ top: number; bottom: number }>;

/**
 * The passage the reader is at: the first whose box reaches below the top of the viewport and
 * starts above its bottom. Null when none is on screen (the reader is above the first passage, in
 * the page's introduction, for instance), and then nothing is moved.
 */
export function placeOf(
  passages: readonly Element[],
  viewportHeight: number,
  rectOf: (passage: Element) => Rect = (passage) => passage.getBoundingClientRect(),
): Place | null {
  for (const passage of passages) {
    const rect = rectOf(passage);
    if (rect.bottom > 0 && rect.top < viewportHeight && rect.bottom > rect.top)
      return { passage, top: rect.top };
  }
  return null;
}

/**
 * How far to scroll so the passage stands where it stood; 0 when it no longer has a box.
 *
 * A reader deep in a long passage (its top far above the viewport) may switch to a face where the
 * passage is short; holding the old offset would scroll it out of sight. So when the passage began
 * above the viewport, at least 30% of the viewport's height stays on it, and its top never comes
 * below the viewport's top edge. Measured on live 01478983 at 1280x800: arg-lq-fixed-band-volume is
 * 1,613px tall on the reading face and 899px on Results, so a reader 1,605px into it would have kept
 * none of it on screen; with the floor, 240px of it stays.
 */
export function scrollToKeep(
  place: Place,
  viewportHeight: number,
  rectOf: (passage: Element) => Rect = (passage) => passage.getBoundingClientRect(),
): number {
  const rect = rectOf(place.passage);
  const height = rect.bottom - rect.top;
  if (height <= 0) return 0;
  const target =
    place.top < 0 ? Math.max(place.top, Math.min(0, 0.3 * viewportHeight - height)) : place.top;
  return rect.top - target;
}
