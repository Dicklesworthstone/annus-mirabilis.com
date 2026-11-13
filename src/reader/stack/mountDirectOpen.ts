/** Registered clarifications share one dialog, history stack, and exact focus-return path. */
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { createModalCloseButton, makeDismissible } from "../../a11y/modal/dismiss.ts";
import { RetainedSessionProvider } from "../../experiments/store/retainedSession.tsx";
import { createSessionRetention } from "../../experiments/store/sessionRetention.ts";
import { Compass } from "./Compass.tsx";
import { returnToInterruptedSentence } from "./focus.ts";
import {
  deserializeStackState,
  openClarification,
  resolveOpenParam,
  serializeStackState,
} from "./history.ts";
import { EMPTY_STACK_STATE, type LabReference, type StackFrame, topFrame } from "./stackStore.ts";

const DIALOG_ATTR = "data-instrument-clarification-dialog";
const MOUNT_ATTR = "data-instrument-clarification-mount";
type Mounted = {
  root: Root;
  dialog: HTMLDialogElement;
  frame: StackFrame;
  onCancel: (e: Event) => void;
  /** Removes the X and press-outside listeners (makeDismissible) of this opening. */
  dismissal: AbortController;
};
const mounted = new WeakMap<Document, Mounted>();
const foundationLinkHandlers = new WeakMap<Document, (event: MouseEvent) => void>();
const triggerLabs = new WeakMap<HTMLElement, LabReference>();
type SessionScope = {
  path: string;
  cache: ReturnType<typeof createSessionRetention>;
  owners: number;
  releaseTicket: number;
  dispose(): void;
};
const sessionScopes = new WeakMap<Document, SessionScope>();
let triggerNumber = 0;

/** The reader's foundation owner can nest a lesson without replacing this explanation's root. */
export function activeDirectOpenDialog(doc: Document) {
  const current = mounted.get(doc);
  return current?.dialog.open
    ? {
        dialog: current.dialog,
        frame: current.frame,
        open: `${current.frame.clarification.kind}:${current.frame.clarification.id}`,
        depth: Math.max(
          1,
          deserializeStackState(doc.defaultView?.history.state?.annusClarification?.stack)?.frames
            .length ?? 0,
        ),
      }
    : null;
}

/** Only the active registered dialog forwards its authored prerequisite links, never the document. */
export function listenForDirectOpenFoundations(
  doc: Document,
  handler: (event: MouseEvent) => void,
): () => void {
  foundationLinkHandlers.set(doc, handler);
  return () => {
    if (foundationLinkHandlers.get(doc) === handler) foundationLinkHandlers.delete(doc);
  };
}

function sessionScope(doc: Document): SessionScope {
  const path = doc.defaultView?.location.pathname ?? "";
  const existing = sessionScopes.get(doc);
  if (existing?.path === path) return existing;
  existing?.dispose();
  const cache = createSessionRetention();
  const scope: SessionScope = {
    path,
    cache,
    owners: 0,
    releaseTicket: 0,
    dispose() {
      cache.dispose();
      doc.defaultView?.removeEventListener("pagehide", scope.dispose);
      if (sessionScopes.get(doc) === scope) sessionScopes.delete(doc);
    },
  };
  sessionScopes.set(doc, scope);
  doc.defaultView?.addEventListener("pagehide", scope.dispose);
  return scope;
}

/** A real reader-route owner, with deferred teardown so StrictMode probes retain the scope. */
export function retainReaderLabSessions(doc: Document): () => void {
  const scope = sessionScope(doc);
  scope.owners++;
  scope.releaseTicket++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    scope.owners--;
    const ticket = ++scope.releaseTicket;
    queueMicrotask(() => {
      if (scope.owners === 0 && scope.releaseTicket === ticket) scope.dispose();
    });
  };
}

function ensureDialog(doc: Document) {
  let dialog = doc.querySelector<HTMLDialogElement>(`[${DIALOG_ATTR}]`);
  if (!dialog) {
    dialog = doc.createElement("dialog");
    dialog.setAttribute(DIALOG_ATTR, "");
    // The owner's rule for every overlay: an X at the top right. First, so the compass wraps it.
    const close = createModalCloseButton("Close and return to the passage");
    close.setAttribute("data-clarification-close", "");
    dialog.appendChild(close);
    const mount = doc.createElement("div");
    mount.setAttribute(MOUNT_ATTR, "");
    dialog.appendChild(mount);
    dialog.addEventListener("click", (event) => {
      const active = activeDirectOpenDialog(doc);
      const target = event.target;
      if (!active || active.dialog !== event.currentTarget || !(target instanceof Element)) return;
      const link = target.closest("a[data-foundation]");
      if (link && active.dialog.contains(link)) foundationLinkHandlers.get(doc)?.(event);
    });
    doc.body.appendChild(dialog);
  }
  const mount = dialog.querySelector<HTMLElement>(`[${MOUNT_ATTR}]`);
  if (!mount) throw new Error("Clarification dialog is missing its mount point.");
  return { dialog, mount };
}
/** Idempotent disposal. A same-turn reopening reuses the root instead of racing a queued unmount. */
export function closeDirectOpenDialog(doc: Document, returnFocus = false): void {
  const current = mounted.get(doc);
  if (!current) return;
  if (current.dialog.open) current.dialog.close();
  current.dialog.removeEventListener("cancel", current.onCancel);
  current.dismissal.abort();
  if (returnFocus)
    doc.defaultView?.requestAnimationFrame(() => {
      // Browser Back restores the interrupted control; Forward into another panel must not
      // let this delayed return steal focus from the newly opened clarification.
      if (!mounted.get(doc)?.dialog.open) restore(doc, current.frame);
    });
  queueMicrotask(() => {
    if (mounted.get(doc) !== current || current.dialog.open) return;
    mounted.delete(doc);
    current.root.unmount();
  });
}
function restore(doc: Document, frame: StackFrame): void {
  const win = doc.defaultView;
  if (!win) return;
  const target = returnToInterruptedSentence(win, doc, frame);
  if (target && frame.selectionId) target.element.dataset.restoredSelection = frame.selectionId;
}
/** A click records the real originating passage and viewport position before descending. */
export function openFromTrigger(doc: Document, trigger: HTMLElement, raw: string): boolean {
  const win = doc.defaultView;
  if (!win) return false;
  const previous = win.history.state;
  const reader = doc.querySelector<HTMLElement>("[data-reader-root]");
  const params = new URLSearchParams(win.location.search);
  const anchor =
    trigger.closest<HTMLElement>(".reader-passage")?.id ?? decodeAnchor(win.location.hash);
  if (!trigger.id) trigger.id = `clarification-trigger-${++triggerNumber}`;
  const outcome = openClarification(
    mounted.get(doc)?.dialog.open
      ? (deserializeStackState(previous?.annusClarification?.stack) ?? EMPTY_STACK_STATE)
      : EMPTY_STACK_STATE,
    {
      kind: raw.slice(0, raw.indexOf(":")),
      id: raw.slice(raw.indexOf(":") + 1),
      question:
        trigger.closest(".reader-passage")?.querySelector(".passage-question")?.textContent ??
        "Why does this step follow?",
      openedLab: triggerLabs.get(trigger) ?? null,
      returnTo: {
        anchor,
        face: reader?.dataset.view ?? "reading",
        detail: Number(doc.documentElement.dataset.detail ?? 1),
        perspective: params.get("lens"),
        notation: params.get("notation"),
        unitLayer: params.get("units"),
        selectionId: trigger.dataset.selectionId ?? null,
        formId: null,
        triggerId: trigger.id,
        scrollFraction: trigger.getBoundingClientRect().top / Math.max(1, win.innerHeight),
        lab: mounted.get(doc)?.dialog.open ? (mounted.get(doc)?.frame.openedLab ?? null) : null,
      },
    },
  );
  if (outcome.status !== "descended") return false;
  const url = new URL(win.location.href);
  url.searchParams.set("open", raw);
  if (anchor) url.hash = anchor;
  // Preserve the reader's independent history keys and every unrelated query parameter.
  const state = {
    ...previous,
    annusClarification: { stack: serializeStackState(outcome.state), pushed: true },
  };
  if (outcome.replacedDeepest) win.history.replaceState(state, "", url);
  else win.history.pushState(state, "", url);
  return openFromSearch(doc, url.search);
}
function decodeAnchor(hash: string): string {
  try {
    const value = decodeURIComponent(hash.replace(/^#/, ""));
    return /^[a-zA-Z][a-zA-Z0-9._-]*$/.test(value) ? value : "";
  } catch {
    return "";
  }
}

/** Invalid/unregistered targets never open. No numerical work is started by this navigation. */
export function openFromSearch(doc: Document, search: string): boolean {
  const params = new URLSearchParams(search.length <= 4096 ? search : "");
  if (params.getAll("open").length !== 1) return false;
  const resolved = resolveOpenParam(params.get("open"));
  if (!resolved) return false;
  if (!resolved.definition.descends) {
    const anchorId = resolved.definition.staticHref(resolved.parsedId).replace(/^#/, "");
    doc.getElementById(anchorId)?.scrollIntoView();
    return true;
  }
  const renderKind = resolved.definition.render,
    win = doc.defaultView;
  if (!renderKind || !win) return false;
  const saved = topFrame(
    deserializeStackState(win.history.state?.annusClarification?.stack) ?? EMPTY_STACK_STATE,
  );
  const frame: StackFrame =
    saved?.clarification.kind === resolved.kind && saved.clarification.id === resolved.rawId
      ? saved
      : {
          anchor: decodeAnchor(win.location.hash),
          face: doc.documentElement.dataset.view ?? "reading",
          detail: Number(doc.documentElement.dataset.detail ?? 1),
          perspective: params.get("lens"),
          notation: params.get("notation"),
          unitLayer: params.get("units"),
          selectionId: null,
          formId: null,
          clarification: { kind: resolved.kind, id: resolved.rawId },
          title: resolved.definition.title(resolved.parsedId),
          question: "Opened from a direct link.",
          triggerId: "",
          scrollFraction: 0.15,
          lab: null,
          openedLab: null,
        };
  const { dialog, mount } = ensureDialog(doc);
  dialog.setAttribute("aria-label", frame.title);
  const existing = mounted.get(doc);
  if (existing) {
    dialog.removeEventListener("cancel", existing.onCancel);
    existing.dismissal.abort();
  }
  const root = existing?.root ?? createRoot(mount);
  const onReturn = () => {
    const pushed = !!saved && win.history.state?.annusClarification?.pushed === true;
    closeDirectOpenDialog(doc);
    if (pushed) {
      // The reader's popstate handler restores its own projection before focus is returned.
      win.addEventListener("popstate", () => win.requestAnimationFrame(() => restore(doc, frame)), {
        once: true,
      });
      win.history.back();
    } else {
      const url = new URL(win.location.href);
      url.searchParams.delete("open");
      win.history.replaceState({ ...win.history.state, annusClarification: null }, "", url);
      restore(doc, frame);
    }
  };
  const onCancel = (e: Event) => {
    e.preventDefault();
    onReturn();
  };
  // The X and a press outside the panel return to the passage, as Escape (cancel) does.
  const dismissal = new AbortController();
  makeDismissible(dialog, {
    signal: dismissal.signal,
    escape: false,
    closeButton: dialog.querySelector<HTMLButtonElement>("[data-clarification-close]"),
    onDismiss: () => onReturn(),
  });
  const opening = { root, dialog, frame, onCancel, dismissal };
  mounted.set(doc, opening);
  dialog.addEventListener("cancel", onCancel);
  const instanceId = `${resolved.kind}:${resolved.rawId}`;
  const child = renderKind({
    parsed: resolved.parsedId,
    instanceId,
  });
  const scope = sessionScope(doc);
  const placementKey = JSON.stringify([
    scope.path,
    resolved.kind,
    resolved.rawId,
    frame.anchor,
    frame.triggerId,
  ]);
  const onReference = (reference: LabReference) => {
    if (mounted.get(doc) !== opening) return;
    opening.frame = { ...opening.frame, openedLab: reference };
    const trigger = frame.triggerId ? doc.getElementById(frame.triggerId) : null;
    if (trigger) triggerLabs.set(trigger, reference);
    const current = deserializeStackState(win.history.state?.annusClarification?.stack);
    const top = current && topFrame(current);
    if (
      top &&
      top.clarification.kind === resolved.kind &&
      top.clarification.id === resolved.rawId &&
      top.triggerId === frame.triggerId
    ) {
      win.history.replaceState(
        {
          ...win.history.state,
          annusClarification: {
            ...win.history.state?.annusClarification,
            stack: serializeStackState({
              frames: [...current.frames.slice(0, -1), { ...top, openedLab: reference }],
            }),
          },
        },
        "",
      );
    } else if (
      new URLSearchParams(win.location.search).get("open") === `${resolved.kind}:${resolved.rawId}`
    ) {
      // A direct link has no pushed frame yet. Record its owner without adding a history entry.
      win.history.replaceState(
        {
          ...win.history.state,
          annusClarification: {
            stack: serializeStackState({ frames: [opening.frame] }),
            pushed: false,
          },
        },
        "",
      );
    }
  };
  flushSync(() =>
    root.render(
      createElement(
        "div",
        null,
        createElement(Compass, { frame, onReturn }),
        createElement(
          RetainedSessionProvider,
          {
            key: placementKey,
            cache: scope.cache,
            placementKey,
            instanceId,
            previous: frame.openedLab ?? null,
            onReference,
          },
          child,
        ),
      ),
    ),
  );
  if (!dialog.open) dialog.showModal();
  mount.querySelector<HTMLElement>("[data-clarification-heading]")?.focus({ preventScroll: true });
  return true;
}
