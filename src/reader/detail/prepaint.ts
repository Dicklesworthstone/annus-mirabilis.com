import { DETAIL_STORAGE_KEY, FACES, parseDetail } from "../navigation/state.ts";

const STORAGE_KEY: string = DETAIL_STORAGE_KEY;
const VIEW_IDS: readonly string[] = FACES;
const PARSE_DETAIL: typeof parseDetail = parseDetail;

/**
 * Sets `data-detail`, `data-lens`, and `data-view` on `<html>` before first
 * paint, from `?detail=`/`?lens=`/`?view=` or `localStorage`, so
 * `src/reader/reader.css` shows the matching static reading with no client
 * render and no flash of the wrong one. Only static, trusted code is
 * embedded; query text never becomes JavaScript or HTML.
 *
 * A real, directly testable function. `READER_PREPAINT` below derives the
 * exact injected string from this function's own `.toString()`, splicing in
 * the real `parseDetail` (never a second, hand-copied dictionary that could
 * drift from it, the way `src/platform/storage/keys.ts`'s placeholder
 * `allowedValues` once nearly did) the same way `rootArming.inline.ts`
 * splices in its face list — because a Content-Security-Policy hash is over
 * exact bytes.
 */
export function applyReaderPrepaint(): void {
  try {
    const params = new URLSearchParams(location.search.length <= 4096 ? location.search : "");
    const single = (key: string) => (params.getAll(key).length === 1 ? params.get(key) : null);
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* Storage may be blocked or full; the query value or the default still apply. */
    }
    const parseDetailValue = PARSE_DETAIL;
    const detail = parseDetailValue(single("detail")) ?? parseDetailValue(stored) ?? 1;
    document.documentElement.dataset.detail = String(detail);
    document.documentElement.dataset.lens = single("lens") === "modern" ? "modern" : "paper";
    const view = single("view");
    document.documentElement.dataset.view =
      view !== null && VIEW_IDS.indexOf(view) !== -1 ? view : "reading";
  } catch {
    /* A failed arm leaves data-detail/data-lens/data-view unset; CSS falls back to R1/paper/reading. */
  }
}

export const READER_PREPAINT = `(${applyReaderPrepaint
  .toString()
  .replace("STORAGE_KEY", JSON.stringify(STORAGE_KEY))
  .replace("PARSE_DETAIL", parseDetail.toString())
  .replace("VIEW_IDS", JSON.stringify(VIEW_IDS))})();`;
