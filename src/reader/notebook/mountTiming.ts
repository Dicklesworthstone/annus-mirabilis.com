/**
 * WHEN THE NOTEBOOK MOUNTS (TanElk's dispatch 114: the notebook plan, "go").
 *
 * The notebook's code is about 35 KB brotli on live: its own chunks (10.3 and 4.0 KB), and the
 * refusal registry (13.9 KB) and tolerance module (7.2 KB) its replay validation imports. Every
 * page loaded it straight after hydration to draw the passages' bookmarks, and with it the
 * reading pages' JavaScript during load was 214,765 to 228,693 bytes against 204,800.
 *
 * On a reading page it now mounts on the reader's first interaction, or once the page has been
 * open five seconds and the browser is idle. It does not mount on a light read of the saved
 * notebook. The store records the reading place (browser.ts `remember`) on the first scroll or
 * touch, so it would load for nearly every reader seconds later anyway, and a lighter parse would
 * catch an invalid notebook later than the store does. What is validated, and when a bad notebook
 * is quarantined, is unchanged.
 *
 * Some pages mount at once, as before:
 * - the home page and /papers/: the "Continue where you left off" line is prepended to <main>,
 *   and inserting it seconds later would move the page under the reader;
 * - /notebook/: it holds the notebook itself;
 * - any page with an "Open your notebook" control ([data-open-notebook]): /notebook/'s ships
 *   disabled until the notebook mounts, and a disabled button may never report the press that
 *   would mount it.
 */

/**
 * The only two pages that offer to take a reader back (browser.ts). The owner, 2026-09-22: "these
 * reading reminder things are super annoying". The reminder used to be a bordered block with the
 * recap text prepended to <main> on EVERY page, and dismissing it lasted one page view. On a page
 * with its own content the reader has already chosen where to be.
 */
export const RECAP_PAGES: ReadonlySet<string> = new Set([
  "/",
  "/index.html",
  "/papers",
  "/papers/",
  "/papers/index.html",
]);

/** The events that count as the reader's first interaction. */
export const FIRST_INTERACTION = [
  "pointerdown",
  "keydown",
  "touchstart",
  "wheel",
  "scroll",
] as const;

/** Five seconds, then the browser's next idle moment. */
export const MOUNT_FALLBACK_MS = 5000;

export function mountsAtOnce(document: Document, pathname: string): boolean {
  return (
    RECAP_PAGES.has(pathname) ||
    document.querySelector("[data-notebook-inline], [data-open-notebook]") !== null
  );
}
