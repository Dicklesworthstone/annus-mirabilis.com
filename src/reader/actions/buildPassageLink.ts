/**
 * "Copy a link to this passage" (am-read-passage-actions-vbe): composes the
 * document URL for a passage from a closed allowlist of five inputs --
 * origin, paper route, view, detail, lens, and anchor -- reusing
 * `passageHref` (`am-read-shell-routes-3ua`) for the path/query/hash, which
 * already never reads the storage layer and always emits the passage's own
 * canonical paper route regardless of the caller's current route (a tour, a
 * capstone, or a companion panel never leaks into the copied link). This
 * module adds only the origin prefix; it imports nothing from
 * `src/platform/storage/` and never will, since every reader-eye setting
 * (theme, reading-only, measure, type scale, contrast, paragraph spacing)
 * and every local record (notebook, tours, predictions, clarity votes,
 * `?tape=`) is deliberately absent from the five inputs below, not merely
 * unused.
 */

import { passageHref, type ReaderRegistry, type ReaderState } from "../navigation/state.ts";

export type PassageLinkAxes = Pick<ReaderState, "view" | "detail" | "lens" | "anchor">;

export interface BuildPassageLinkInput {
  /** Scheme + host, no trailing slash, e.g. "https://annus-mirabilis.com". */
  readonly origin: string;
  readonly registry: ReaderRegistry;
  readonly axes: PassageLinkAxes;
}

/**
 * The absolute URL for a passage, always the passage's own paper route
 * (never the route the reader happens to be on), with `?view=`, `?detail=`,
 * and `?lens=` present only when they differ from the default reading face,
 * Detail 1, and the paper lens, in that order -- `passageHref`'s own
 * omission and ordering rules, not reimplemented here.
 */
export function buildPassageLink(input: BuildPassageLinkInput): string {
  const path = passageHref(input.registry, input.axes);
  return `${input.origin}${path}`;
}
