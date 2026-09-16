/**
 * The `?view=` pre-paint script (bead am-read-shell-routes-3ua). Runs
 * synchronously in `<head>`, before first paint, and sets `data-view` on
 * `<html>` so CSS can show the requested face's placeholder immediately
 * instead of flashing the reading face. This is CSS wiring only: it never
 * reaches the reader root (the body has not been parsed yet), and it is a
 * separate concern from `data-ready`, which `rootArming.inline.ts` owns.
 *
 * `prepaintView` is a real, directly testable function. `PREPAINT_VIEW_SOURCE`
 * derives the exact injected string from `prepaintView.toString()` rather
 * than a hand-copied literal, because a Content-Security-Policy hash is over
 * exact bytes and must never drift from what this file actually exports.
 */
import { FACE_IDS } from "./faces/registry";

const KNOWN_FACE_IDS: readonly string[] = FACE_IDS;

export function prepaintView(): void {
  try {
    const search = location.search.length <= 4096 ? location.search : "";
    const params = new URLSearchParams(search);
    const values = params.getAll("view");
    const value = values.length === 1 ? values[0] : undefined;
    document.documentElement.dataset.view =
      value !== undefined && KNOWN_FACE_IDS.indexOf(value) !== -1 ? value : "reading";
  } catch {
    /* A malformed URL never blocks paint; the reading face is always valid HTML. */
  }
}

/**
 * Inlines `KNOWN_FACE_IDS` as a literal array so the emitted script has no
 * import: it must run standalone in `<head>`, before any module loads.
 */
export const PREPAINT_VIEW_SOURCE = `(${prepaintView
  .toString()
  .replace("KNOWN_FACE_IDS", JSON.stringify(KNOWN_FACE_IDS))})();`;
