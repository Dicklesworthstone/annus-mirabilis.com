/**
 * Route-level scroll restoration for am-read-anchors-navigation-a6o.
 *
 * `history.scrollRestoration` is `"manual"`. Back and forward restore the
 * face, the content-id anchor, and a relative viewport fraction from
 * history.state -- never an absolute pixel offset, which breaks under font
 * load, Detail changes, and zoom.
 */

export type ScrollRestoreRecord = Readonly<{
  face: string;
  anchor: string;
  /** Anchor top as a fraction of viewport height. Not pixels. */
  relativeOffset: number;
}>;

export function setManualScrollRestoration(historyLike: { scrollRestoration: string }): void {
  historyLike.scrollRestoration = "manual";
}

export function parseScrollRestoreRecord(input: unknown): ScrollRestoreRecord | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  if ("scrollY" in o || "topPx" in o || "pixelOffset" in o) {
    return null;
  }
  if (typeof o.face !== "string" || !o.face) return null;
  if (typeof o.anchor !== "string" || !o.anchor) return null;
  if (typeof o.relativeOffset !== "number" || !Number.isFinite(o.relativeOffset)) return null;
  return Object.freeze({
    face: o.face,
    anchor: o.anchor,
    relativeOffset: o.relativeOffset,
  });
}

/**
 * The scroll delta that places `newTopBeforeScroll` at the stored fraction.
 * Same contract as placeKeeper.restoreDelta; kept here so route restoration
 * does not depend on measuring code.
 */
export function restoreRelativeDelta(
  newTopBeforeScroll: number,
  relativeOffset: number,
  viewportHeight: number,
): number {
  return newTopBeforeScroll - relativeOffset * viewportHeight;
}

/** True when the restored position is within 8 CSS px of the captured fraction. */
export function withinRestoreTolerance(actualTop: number, expectedTop: number): boolean {
  return Math.abs(actualTop - expectedTop) <= 8;
}
