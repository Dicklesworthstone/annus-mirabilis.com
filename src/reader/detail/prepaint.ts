import { type Detail, DETAIL_STORAGE_KEY, FACES, parseDetail } from "../navigation/state.ts";

const STORAGE_KEY: string = DETAIL_STORAGE_KEY;
const VIEW_IDS: readonly string[] = FACES;

/**
 * Sets `data-detail`, `data-lens`, and `data-view` on `<html>` before first
 * paint, from `?detail=`/`?lens=`/`?view=` or `localStorage`, so
 * `src/reader/reader.css` shows the matching static reading with no client
 * render and no flash of the wrong one. Only static, trusted code is
 * embedded; query text never becomes JavaScript or HTML.
 *
 * A real, directly testable function. `READER_PREPAINT` below derives the
 * exact injected string from this function's own `.toString()` and passes the
 * real storage key, the real `parseDetail` and the real face list as arguments
 * — never a second, hand-copied dictionary that could drift from them.
 *
 * They are arguments, not names spliced into the body, because a production
 * build minifies this module: `.toString()` then returns a body referencing the
 * renamed constants (`p`, `o`), the name-based `.replace` calls matched nothing,
 * the emitted IIFE referenced free variables, and the `catch` below swallowed
 * the ReferenceError. `data-detail` was never set in any built page, so every
 * reader arriving with `?detail=` or a stored preference silently got the
 * default. Positional arguments survive minification; identifier names do not.
 */
export function applyReaderPrepaint(
  storageKey: string,
  parseDetailValue: (input: string | null) => Detail | null,
  viewIds: readonly string[],
): void {
  try {
    const params = new URLSearchParams(location.search.length <= 4096 ? location.search : "");
    const single = (key: string) => (params.getAll(key).length === 1 ? params.get(key) : null);
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(storageKey);
    } catch {
      /* Storage may be blocked or full; the query value or the default still apply. */
    }
    const detail = parseDetailValue(single("detail")) ?? parseDetailValue(stored) ?? 1;
    document.documentElement.dataset.detail = String(detail);
    document.documentElement.dataset.lens = single("lens") === "modern" ? "modern" : "paper";
    const view = single("view");
    document.documentElement.dataset.view =
      view !== null && viewIds.indexOf(view) !== -1 ? view : "reading";
  } catch {
    /* A failed arm leaves data-detail/data-lens/data-view unset; CSS falls back to R1/paper/reading. */
  }
}

export const READER_PREPAINT = `(${applyReaderPrepaint.toString()})(${JSON.stringify(
  STORAGE_KEY,
)},${parseDetail.toString()},${JSON.stringify(VIEW_IDS)});`;
