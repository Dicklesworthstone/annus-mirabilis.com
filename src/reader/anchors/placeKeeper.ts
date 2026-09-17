/**
 * Place-keeping across a face switch, for am-read-anchors-navigation-a6o.
 * "Before a face change, the shell records two things: the first
 * sentence-level (or finer) anchor, in document order, whose element is
 * at least half visible in the viewport; and that element's offset from
 * the viewport top as a fraction of the viewport height. After the new
 * face signals readiness, it scrolls that anchor, or its mapped ancestor,
 * to the same fraction."
 *
 * Geometry is supplied by the caller (real layout in the browser, fixtures
 * in tests); this module does no measuring of its own, matching the
 * pattern of the Detail-axis place-keeper at
 * src/reader/detail/nearestStableAnchor.ts (a different contract: that one
 * picks the deepest unit intersecting the top 40% band, with no relative
 * offset; this one requires at least half the unit's height visible, and
 * always returns a restore fraction, because a face switch -- unlike a
 * Detail change -- can move the anchor to a very different scroll height).
 */

export interface AddressableRect {
  readonly id: string;
  readonly top: number;
  readonly height: number;
}

export interface PlaceKeeperSnapshot {
  readonly anchorId: string;
  /** The anchor's top offset from the viewport top, as a fraction of viewport height. */
  readonly relativeOffset: number;
}

function isAtLeastHalfVisible(rect: AddressableRect, viewportHeight: number): boolean {
  const visibleTop = Math.max(rect.top, 0);
  const visibleBottom = Math.min(rect.top + rect.height, viewportHeight);
  const visible = Math.max(0, visibleBottom - visibleTop);
  return rect.height > 0 && visible >= rect.height / 2;
}

/**
 * Captures the anchor to restore: the first (document-order) unit at
 * least half visible in the viewport, and its relative offset. Ties on
 * visibility resolve to whichever unit appears earlier in `units` (its
 * document order), matching the bead's own tie-break rule. Returns
 * undefined only when nothing is at least half visible (an empty
 * viewport, or a face with no addressable units at all).
 */
export function capturePlace(
  units: readonly AddressableRect[],
  viewportHeight: number,
): PlaceKeeperSnapshot | undefined {
  for (const unit of units) {
    if (isAtLeastHalfVisible(unit, viewportHeight)) {
      return { anchorId: unit.id, relativeOffset: unit.top / viewportHeight };
    }
  }
  return undefined;
}

/**
 * Given the restored anchor's new top offset (its position in the new
 * face's layout, before any scrolling) and the snapshot's relative
 * offset, returns the scroll delta that places the anchor at the same
 * fraction of the viewport it held before -- the amount the caller should
 * add to the current scroll position (`window.scrollBy(0, delta)` or
 * equivalent), not an absolute scroll position, since restoring an
 * absolute pixel offset breaks under font loading, Detail changes, or zoom.
 */
export function restoreDelta(
  newTopBeforeScroll: number,
  snapshot: PlaceKeeperSnapshot,
  viewportHeight: number,
): number {
  return newTopBeforeScroll - snapshot.relativeOffset * viewportHeight;
}
