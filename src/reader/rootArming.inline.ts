/**
 * The reader-root arming script (bead am-read-shell-routes-3ua): the
 * harness's DOM readiness contract. It is the reader root's first child,
 * runs synchronously as the document is parsed (before any face content
 * paints), and sets `data-ready="false"` plus the root's own `data-view` —
 * copied from `<html data-view>`, which the head pre-paint script
 * (`prepaintView.inline.ts`) set for CSS. A head script cannot reach the
 * reader root directly, because the body has not been parsed yet when it
 * runs; this script exists precisely to bridge that gap once the root
 * itself is in the DOM. The shell island later sets `data-ready="true"`
 * once the active face's panel has rendered, its anchors are in the DOM,
 * and hydration has finished — never this script's job.
 *
 * `armReaderRoot` is a real, directly testable function.
 * `ROOT_ARMING_SOURCE` derives the exact injected string from
 * `armReaderRoot.toString()`, never a hand-copied literal, because a
 * Content-Security-Policy hash is over exact bytes.
 */
import { FACE_IDS } from "./faces/registry";

const KNOWN_FACE_IDS: readonly string[] = FACE_IDS;

export function armReaderRoot(): void {
  try {
    const script = document.currentScript;
    const root = script?.parentElement;
    if (!root?.dataset) return;
    root.dataset.ready = "false";
    const requested = document.documentElement.dataset.view;
    root.dataset.view =
      requested !== undefined && KNOWN_FACE_IDS.indexOf(requested) !== -1 ? requested : "reading";
  } catch {
    /* A failed arm leaves data-ready unset; the harness reports that as not-ready, correctly. */
  }
}

export const ROOT_ARMING_SOURCE = `(${armReaderRoot
  .toString()
  .replace("KNOWN_FACE_IDS", JSON.stringify(KNOWN_FACE_IDS))})();`;
