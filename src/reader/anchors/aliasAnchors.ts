/**
 * Static alias anchors so a retired id lands without JavaScript.
 * Placed at the successor's location; `id` is the retired spelling.
 *
 * NOT `hidden`, AND THAT IS THE WHOLE POINT OF THIS FILE. It returned `hidden: true` until
 * 2026-10-08, which cannot land a reader anywhere: a `hidden` element is `display: none`, so it has
 * no box, and the browser makes it `:target` and then has nothing to scroll to. Measured in both
 * engines on a synthetic 6,000px page, navigating from scrollY 0:
 *
 *     fragment         chromium       webkit         rect
 *     #alias-hidden    scrollY 0      scrollY 0      0 x 0      <- what this module used to emit
 *     #alias-visible   scrollY 4066   scrollY 4066   0 x 18     <- what it emits now
 *     #target-b        scrollY 4066   scrollY 4066   800 x 18   <- the paragraph itself
 *
 * An empty inline span is the right shape for this: zero width, so it costs nothing visually, and
 * the line's height, so it has a box to scroll to. The live inline implementation at
 * GermanFace.tsx:103 reached the same answer and is where the measurement above came from.
 *
 * Whether this module or that inline code survives is an owner call recorded on am-to1q; this fix
 * only ensures that neither answer can be wired in a state that silently does not work.
 */

export type AliasAnchorProps = Readonly<{
  id: string;
  "data-alias": "";
}>;

export function aliasAnchorProps(retiredId: string): AliasAnchorProps {
  if (!retiredId) throw new TypeError("An alias anchor needs the retired content id.");
  return Object.freeze({ id: retiredId, "data-alias": "" as const });
}
