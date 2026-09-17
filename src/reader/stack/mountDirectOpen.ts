/**
 * am-read-return-stack-oxa. The direct-link path: on load and on popstate, check `?open=`
 * against the closed kind registry and mount it -- this bead's "Direct link" acceptance
 * criterion ("A direct ?open= link opens the clarification with the compass").
 *
 * SCOPE NOTE. This module does NOT wire the "click a trigger mid-read to descend" path: no
 * trigger UI exists anywhere in this repository yet to produce an `?open=` URL from a click (the
 * bead's own text: "'Try it' in am-read-passage-actions-vbe lands on" the instrument-view kind --
 * that bead is not landed). It also does not touch src/reader/navigation/state.ts's existing
 * foundation-only frame stack or src/reader/ReaderController.tsx's foundation dialog at all: a
 * `foundation:` value is not a kind this bead registers, so resolveOpenParam refuses it here and
 * the existing foundation logic (unmodified) continues to own it, exactly as before this bead
 * touched anything.
 */
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { Compass } from "./Compass.tsx";
import { resolveOpenParam } from "./history.ts";
import type { StackFrame } from "./stackStore.ts";

const DIALOG_ATTR = "data-instrument-clarification-dialog";
const MOUNT_ATTR = "data-instrument-clarification-mount";

let activeRoot: Root | null = null;

function ensureDialog(doc: Document): Readonly<{ dialog: HTMLDialogElement; mount: HTMLElement }> {
  let dialog = doc.querySelector<HTMLDialogElement>(`[${DIALOG_ATTR}]`);
  if (!dialog) {
    dialog = doc.createElement("dialog");
    dialog.setAttribute(DIALOG_ATTR, "");
    dialog.setAttribute("aria-label", "Instrument clarification");
    const mount = doc.createElement("div");
    mount.setAttribute(MOUNT_ATTR, "");
    dialog.appendChild(mount);
    doc.body.appendChild(dialog);
  }
  const mount = dialog.querySelector<HTMLElement>(`[${MOUNT_ATTR}]`);
  if (!mount) throw new Error("Instrument clarification dialog is missing its mount point.");
  return { dialog, mount };
}

/** Closes the direct-open dialog (if any) and unmounts its React root. Idempotent: safe to call
 * when nothing is open. */
export function closeDirectOpenDialog(doc: Document): void {
  const dialog = doc.querySelector<HTMLDialogElement>(`[${DIALOG_ATTR}]`);
  if (dialog?.open) dialog.close();
  if (activeRoot) {
    activeRoot.unmount();
    activeRoot = null;
  }
}

/**
 * Resolves `?open=` from `search` against the closed kind registry. A descending kind (currently
 * only `instrument-view`) mounts in a dialog with the compass; a non-descending kind (`term`)
 * scrolls to its static anchor with no dialog and no frame, per this bead's "ordinary term click
 * adds no history entry" contract extended to the direct-link case. Returns true if something was
 * opened, false for a null, unregistered, or parser-refused value -- never throws, matching this
 * bead's "Invalid values" requirement ("ignored without breaking the page").
 */
export function openFromSearch(doc: Document, search: string): boolean {
  const params = new URLSearchParams(search);
  const resolved = resolveOpenParam(params.get("open"));
  if (!resolved) return false;

  if (!resolved.definition.descends) {
    const anchorId = resolved.definition.staticHref(resolved.parsedId).replace(/^#/, "");
    doc.getElementById(anchorId)?.scrollIntoView();
    return true;
  }

  if (!resolved.definition.render) return false;

  const { dialog, mount } = ensureDialog(doc);
  const frame: StackFrame = {
    anchor: "",
    face: "reading",
    detail: 1,
    perspective: null,
    notation: null,
    unitLayer: null,
    selectionId: null,
    formId: null,
    clarification: { kind: resolved.kind, id: resolved.rawId },
    title: resolved.definition.title(resolved.parsedId),
    question: "Opened from a direct link.",
    triggerId: "",
    scrollFraction: 0.15,
    lab: null,
  };

  activeRoot?.unmount();
  const root = createRoot(mount);
  activeRoot = root;
  // Synchronous commit, not the default concurrent scheduling: a reader following a direct link
  // must see the dialog's real content the instant it opens, never an empty flash, and tests
  // that call this from inside another component's effect need the nested root fully settled
  // before they can assert on it.
  flushSync(() => {
    root.render(
      createElement(
        "div",
        null,
        createElement(Compass, { frame, onReturn: () => closeDirectOpenDialog(doc) }),
        resolved.definition.render({
          parsed: resolved.parsedId,
          instanceId: `${resolved.kind}:${resolved.rawId}`,
        }),
      ),
    );
  });
  if (!dialog.open) dialog.showModal();
  return true;
}
