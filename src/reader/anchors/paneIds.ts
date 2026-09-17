/**
 * Split-view DOM identity for am-read-anchors-navigation-a6o.
 *
 * The primary pane uses the bare content id. The secondary pane prefixes
 * `pane-b--` and carries `data-anchor` with the same content id, so hash
 * navigation in the focused pane resolves through `data-anchor` and the
 * document never contains duplicate ids.
 */

export const SECONDARY_PANE_PREFIX = "pane-b--" as const;

export type ReaderPane = "primary" | "secondary";

export function paneDomId(contentId: string, pane: ReaderPane): string {
  if (!contentId) {
    throw new TypeError("A pane DOM id requires a content id.");
  }
  return pane === "primary" ? contentId : `${SECONDARY_PANE_PREFIX}${contentId}`;
}

export function contentIdFromDomId(domId: string): string {
  return domId.startsWith(SECONDARY_PANE_PREFIX)
    ? domId.slice(SECONDARY_PANE_PREFIX.length)
    : domId;
}

export function paneDataAnchor(contentId: string, pane: ReaderPane): string | undefined {
  return pane === "secondary" ? contentId : undefined;
}

/** The element id a hash should target in the focused pane. */
export function hashTargetInPane(hash: string, pane: ReaderPane): string {
  const contentId = hash.startsWith("#") ? hash.slice(1) : hash;
  return paneDomId(contentId, pane);
}
