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
import { FACE_IDS } from "./faces/registry.ts";

export const KNOWN_FACE_IDS: readonly string[] = FACE_IDS;

/**
 * A FACE'S OWN PAGE IS NOT ARMED. /papers/<paper>/view/<face>/ renders its root as that face,
 * complete, and mounts no shell island that would set it ready again: armed, its root sat at
 * data-ready="false" and data-view="reading" for good (measured on live 68b45872: 12 of 14 face
 * pages of light quanta and special relativity, with JavaScript on). So only a root rendered as
 * the reading face, which the shell readies after hydration, is armed; a root rendered as any
 * other face keeps what the server wrote. (The explanation is here rather than in the body
 * because the body is shipped inline in every page.)
 */
export function armReaderRoot(knownFaceIds: readonly string[]): void {
  try {
    const script = document.currentScript;
    const root = script?.parentElement;
    if (!root?.dataset) return;
    const rendered = root.dataset.view;
    if (rendered !== undefined && rendered !== "reading") return;
    root.dataset.ready = "false";
    const requested = document.documentElement.dataset.view;
    root.dataset.view =
      requested !== undefined && knownFaceIds.indexOf(requested) !== -1 ? requested : "reading";
  } catch {
    /* A failed arm leaves data-ready unset; the harness reports that as not-ready, correctly. */
  }
}

export const ROOT_ARMING_SOURCE = `(${armReaderRoot.toString()})(${JSON.stringify(
  KNOWN_FACE_IDS,
)});`;
