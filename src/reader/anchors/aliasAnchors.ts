/**
 * SUPERSEDED SPELLING, NO PRODUCTION CALLER (am-50bk triage, 2026-10-24). The measurement below is
 * sound and the conclusion it reached is live on the site -- but through a different spelling, so
 * read this before using `aliasAnchorProps`.
 *
 * `GermanFace.tsx` and `GermanDraftFace.tsx` each emit the alias span themselves, as
 * `<span id={retired} data-alias-of={target} />`: the retired id with no `hidden`, which is the
 * property this file established, PLUS the successor's id, which `AliasHashRewrite.tsx` needs in
 * order to rewrite the hash. `aliasAnchorProps` returns `{ id, "data-alias": "" }`, carrying no
 * target, so it cannot feed that island. The live form ships in 19 built pages and is checked in
 * the bun lane by `germanFaceSourceBlocks.test.tsx`, which asserts each retired id is an alias OF
 * the right successor.
 *
 * One residue worth knowing: `scripts/e2e/aliasAnchorLands.e2e.test.ts` ties its engine measurement
 * to the code by asserting this module's key set, `["data-alias", "id"]`. Its own docblock says
 * that without such a tie "the test proves a fact about HTML and says nothing about this
 * repository" -- and the tie is to this module rather than to the spelling the site serves.
 *
 * ---- the measurement, as authored ----
 *
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
 * An empty inline span is the right shape for this: it costs nothing visually and still has a box.
 *
 * THE MECHANISM IS THE BOX, NOT ITS SIZE, and the table above reads as though it were size because
 * its landing case happened to sit inline among text. Measured on the real site afterwards
 * (scripts/e2e/aliasAnchorLands.e2e.test.ts): relativity's live alias span reports 0 x 0 with
 * `display: inline` and ONE client rect, because it is a bare inline span between two block
 * elements and generates no line box -- and it lands perfectly, at scrollY 3379 against its
 * successor's 3386. A zero-height laid-out element has a box with a position, which is all a
 * fragment scroll needs; `display: none` has no box at all. So the invariant to keep is
 * "not display:none", not "has height".
 *
 * The live inline implementation at GermanFace.tsx:103 reached the same answer and is where the
 * measurements came from.
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
