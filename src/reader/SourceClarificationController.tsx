"use client";

import { useEffect, useState } from "react";
import { TERM_READY_EVENT } from "../equations/termNavigation.ts";
import {
  SPLIT_CLARIFICATIONS_DISPOSE,
  splitFoundation,
  splitInstrumentTarget,
} from "./split/clarificationTargets.ts";

type DirectOpenOwner = typeof import("./stack/mountDirectOpen.ts");

type SourceClarifications = Readonly<{
  ready: Promise<void>;
  dispose: () => void;
}>;

/** Only registered source-page targets need the laboratory/clarification bundle. */
function sourceTarget(search: string, split: boolean): string | null {
  if (search.length > 4096) return null;
  const values = new URLSearchParams(search).getAll("open");
  const target = values.length === 1 ? values[0] : undefined;
  if (!target) return null;
  return target.startsWith("instrument-view:") ||
    target.startsWith("term:") ||
    (split && target.startsWith("foundation:"))
    ? target
    : null;
}

/**
 * The source faces keep their own text, alignment and face-switch owners. This adapter supplies
 * only the registered clarification lifecycle they were missing: the same dialog, retained
 * laboratory and return path used by ReaderController. Split reading also uses that owner for
 * its in-context lessons; the ordinary reading face keeps its existing foundation panels.
 */
export function mountSourceClarifications(
  root: HTMLElement,
  onUnavailable: () => void = () => {},
): SourceClarifications {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  if (!win || root.dataset.view === "reading" || root.querySelector("[data-clarification-dialog]"))
    return { ready: Promise.resolve(), dispose: () => {} };

  const path = win.location.pathname;
  const split = root.dataset.view === "split";
  let active = true;
  let revision = 0;
  let owner: DirectOpenOwner | undefined;
  let loading: Promise<DirectOpenOwner> | undefined;
  let releaseSessions: (() => void) | undefined;
  let detachFoundations: (() => void) | undefined;
  let pendingTerm: { search: string; revision: number; queued: boolean } | undefined;

  const loadOwner = (): Promise<DirectOpenOwner> => {
    loading ??= (async () => {
      const [loaded] = await Promise.all([
        import("./stack/mountDirectOpen.ts"),
        split
          ? import("./split/foundationKind.tsx").then((kind) => kind.registerSplitFoundationKind())
          : undefined,
      ]);
      return loaded;
    })();
    return loading;
  };
  const adoptOwner = (loaded: DirectOpenOwner) => {
    owner = loaded;
    releaseSessions ??= owner.retainReaderLabSessions(doc);
    if (split) detachFoundations ??= owner.listenForDirectOpenFoundations(doc, onClick);
  };
  const onClick = (event: MouseEvent) => {
    if (
      !split ||
      !active ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest<HTMLAnchorElement>(
      "a[data-foundation], a[data-clarification-open]",
    );
    if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
    if (!root.contains(link) && !owner?.activeDirectOpenDialog(doc)?.dialog.contains(link)) return;
    const foundation = link.dataset.foundation;
    const raw =
      foundation && splitFoundation(root, foundation)
        ? `foundation:${foundation}`
        : splitInstrumentTarget(link.getAttribute("href") ?? "");
    if (!raw) return;
    event.preventDefault();
    const before = win.location.href;
    const ticket = ++revision;
    pendingTerm = undefined;
    void loadOwner()
      .then((loaded) => {
        if (
          !active ||
          ticket !== revision ||
          !root.isConnected ||
          !link.isConnected ||
          win.location.pathname !== path ||
          win.location.href !== before
        )
          return;
        adoptOwner(loaded);
        if (!loaded.openFromTrigger(doc, link, raw)) win.location.assign(link.href);
      })
      .catch(() => {
        loading = undefined;
        if (active && ticket === revision && win.location.href === before)
          win.location.assign(link.href);
      });
  };

  // Inline lighting can attach to an outer <main>, so readiness is observed on the document.
  // Only an unanswered request is retried; later hydration must not repin a term after Escape.
  const onTermsReady = () => {
    const request = pendingTerm;
    if (!request || request.queued) return;
    request.queued = true;
    queueMicrotask(() => {
      request.queued = false;
      if (
        !active ||
        pendingTerm !== request ||
        request.revision !== revision ||
        !root.isConnected ||
        win.location.pathname !== path ||
        win.location.search !== request.search
      )
        return;
      try {
        if (owner?.openFromSearch(doc, request.search)) pendingTerm = undefined;
      } catch {
        pendingTerm = undefined;
        owner?.closeDirectOpenDialog(doc);
        onUnavailable();
      }
    });
  };

  const synchronize = async (returnFocus = false): Promise<void> => {
    const ticket = ++revision;
    pendingTerm = undefined;
    if (!active) return;
    if (win.location.pathname !== path) {
      owner?.closeDirectOpenDialog(doc);
      return;
    }
    owner?.closeDirectOpenDialog(doc, returnFocus);
    const search = win.location.search;
    const target = sourceTarget(search, split);
    if (!target) return;
    try {
      const loaded = await loadOwner();
      // A delayed chunk must not reopen a dialog after Back, route departure or effect cleanup.
      if (
        !active ||
        ticket !== revision ||
        !root.isConnected ||
        win.location.pathname !== path ||
        win.location.search !== search
      )
        return;
      adoptOwner(loaded);
      // The owner validates the kind and id. This continuation also runs outside React's commit.
      const opened = loaded.openFromSearch(doc, search);
      if (!opened && target.startsWith("term:"))
        pendingTerm = { search, revision: ticket, queued: false };
    } catch {
      loading = undefined;
      if (active && ticket === revision && win.location.pathname === path) {
        owner?.closeDirectOpenDialog(doc);
        onUnavailable();
      }
    }
  };
  const onPopState = () => {
    void synchronize(true);
  };
  win.addEventListener("popstate", onPopState);
  if (split) root.addEventListener("click", onClick);
  doc.addEventListener(TERM_READY_EVENT, onTermsReady);
  const ready = synchronize();
  return {
    ready,
    dispose() {
      if (!active) return;
      active = false;
      revision++;
      pendingTerm = undefined;
      win.removeEventListener("popstate", onPopState);
      root.removeEventListener("click", onClick);
      doc.removeEventListener(TERM_READY_EVENT, onTermsReady);
      owner?.closeDirectOpenDialog(doc);
      detachFoundations?.();
      root.dispatchEvent(new Event(SPLIT_CLARIFICATIONS_DISPOSE));
      root.querySelector("[data-split-lesson-cache]")?.remove();
      releaseSessions?.();
    },
  };
}

/** Mounted by the shared source-face chooser; ordinary reading loads no clarification bundle. */
export function SourceClarificationController() {
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-reader-root]");
    if (!root) return;
    const mounted = mountSourceClarifications(root, () => setUnavailable(true));
    return mounted.dispose;
  }, []);
  return unavailable ? (
    <p className="notice">
      This explanation could not open. The source passage remains available, and you can{" "}
      <a href="/lab/">open the laboratory catalogue</a>.
    </p>
  ) : null;
}
