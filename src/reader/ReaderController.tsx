"use client";
import { useEffect, useId } from "react";
import {
  DETAIL_STORAGE_KEY,
  FACES,
  type Face,
  MAX_CLARIFICATION_DEPTH,
  openFoundation,
  parseDetail,
  parseReaderLocation,
  passageHref,
  type ReaderRegistry,
  type ReaderState,
  restoreReaderState,
} from "./navigation/state";
import "./actions/kindRegistration.ts";
import { closeDirectOpenDialog, openFromSearch } from "./stack/mountDirectOpen.ts";

type Props = {
  registry: ReaderRegistry;
  titles: Readonly<Record<string, string>>;
  questions: Readonly<Record<string, string>>;
};
/** Only navigation metadata crosses this island. Prose, math and laboratory subtrees stay mounted. */
export function ReaderController(props: Props) {
  // App Router history restoration may recreate equal object props. Do not remount
  // the navigation owner and steal focus from the trigger we just restored.
  const navigation = JSON.stringify(props);
  const detailId = useId();
  useEffect(() => {
    const { registry, titles, questions } = JSON.parse(navigation) as Props;
    const rootEl = document.querySelector<HTMLElement>("[data-reader-root]");
    if (!rootEl) return;
    const root = rootEl;
    const dialogEl = root.querySelector<HTMLDialogElement>("[data-clarification-dialog]");
    const announcementEl = root.querySelector<HTMLElement>("[data-reader-announcement]");
    if (!dialogEl || !announcementEl) return;
    const dialog = dialogEl;
    const announcement = announcementEl;
    const detailControls = [...root.querySelectorAll<HTMLSelectElement>("[data-detail-control]")];
    const lensControls = [...root.querySelectorAll<HTMLInputElement>("[data-lens-control]")];
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(DETAIL_STORAGE_KEY);
    } catch {
      /* Reading works without storage. */
    }
    let state =
      restoreReaderState(history.state?.annusReader?.state, registry) ??
      parseReaderLocation(location.search, location.hash, registry, stored);
    let index = Number.isSafeInteger(history.state?.annusReader?.index)
      ? (history.state.annusReader.index as number)
      : 0;
    let trigger = 0;
    let returnAnimation = 0;
    const cancelReturn = () => {
      if (returnAnimation) cancelAnimationFrame(returnAnimation);
      returnAnimation = 0;
    };
    root.dataset.enhanced = "true";
    [...detailControls, ...lensControls].forEach((control) => {
      control.disabled = false;
    });
    /**
     * The next history URL for the current `state`. Starts from the real
     * current `location.href` -- never from a fresh `URLSearchParams()`
     * built only out of the fields this reader tracks -- so a query key
     * this reader does not know about (a search term, an experiment flag
     * added by a future bead) survives a face change instead of being
     * silently dropped (am-read-shell-routes-3ua; see
     * readerViewSwitchHistory.test.ts for the direct assertion).
     * `passageHref`/`readerHref` stay as they are for the "copy passage
     * link" feature below, which intentionally builds a clean, portable
     * link rather than echoing the current URL's ambient state.
     */
    function url() {
      const u = new URL(location.href);
      if (state.view === "reading") u.searchParams.delete("view");
      else u.searchParams.set("view", state.view);
      if (state.detail === 1) u.searchParams.delete("detail");
      else u.searchParams.set("detail", String(state.detail));
      if (state.lens) u.searchParams.set("lens", "modern");
      else u.searchParams.delete("lens");
      const frame = state.frames.at(-1);
      if (frame) u.searchParams.set("open", `foundation:${frame.foundationId}`);
      else u.searchParams.delete("open");
      u.hash = `#${state.anchor}`;
      return u.pathname + u.search + u.hash;
    }
    function save(push = false) {
      const next = { ...history.state, annusReader: { state, index: push ? ++index : index } };
      if (push) history.pushState(next, "", url());
      else history.replaceState(next, "", url());
    }
    function focusReturn(previous: ReaderState) {
      const frame = previous.frames[state.frames.length];
      const origin = frame?.triggerId ? document.getElementById(frame.triggerId) : null;
      const target = origin?.getClientRects().length
        ? origin
        : document.getElementById(state.anchor);
      if (!target) return;
      target.focus({ preventScroll: true });
      const behavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = "auto";
      const delta =
        target.getBoundingClientRect().top -
        (target === origin ? (frame?.relativeY ?? 0.15) : 0.15) * innerHeight;
      if (dialog.open && dialog.contains(target)) dialog.scrollTop += delta;
      else window.scrollBy(0, delta);
      document.documentElement.style.scrollBehavior = behavior;
    }
    function restoreFocus(previous: ReaderState) {
      focusReturn(previous);
      const expected = state;
      // The browser completes native dialog/history focus restoration after the
      // event handler. Reassert the semantic return on the next frame, unless
      // another navigation has already superseded it.
      returnAnimation = requestAnimationFrame(() => {
        returnAnimation = 0;
        if (state === expected) focusReturn(previous);
      });
    }
    function render(previous?: ReaderState, message = "") {
      cancelReturn();
      root.dataset.ready = "false";
      document.documentElement.dataset.detail = String(state.detail);
      document.documentElement.dataset.lens = state.lens ? "modern" : "paper";
      document.documentElement.dataset.view = state.view;
      root.dataset.view = state.view;
      detailControls.forEach((control) => {
        control.value = String(state.detail);
      });
      lensControls.forEach((control) => {
        control.checked = state.lens;
      });
      root.querySelectorAll<HTMLElement>("[data-view-link]").forEach((a) => {
        if (a.dataset.viewLink === state.view) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      });
      const frame = state.frames.at(-1);
      for (const panel of root.querySelectorAll<HTMLElement>("[data-foundation-panel]"))
        panel.hidden = panel.dataset.foundationPanel !== frame?.foundationId;
      if (frame) {
        const heading = root.querySelector<HTMLElement>(
          `[data-foundation-panel="${frame.foundationId}"] h2`,
        );
        if (heading) {
          dialog.setAttribute("aria-labelledby", heading.id);
        }
        const questionEl = root.querySelector<HTMLElement>("[data-compass-question]");
        if (questionEl) {
          questionEl.textContent = questions[state.anchor] ?? "The Brownian displacement argument";
        }
        const ideaEl = root.querySelector<HTMLElement>("[data-compass-idea]");
        if (ideaEl) {
          ideaEl.textContent = titles[frame.foundationId] ?? frame.foundationId;
        }
        if (!dialog.open) dialog.showModal();
        if (
          !previous ||
          previous.frames.at(-1)?.foundationId !== frame.foundationId ||
          previous.frames.length !== state.frames.length
        ) {
          if (previous && previous.frames.length > state.frames.length) restoreFocus(previous);
          else heading?.focus();
        }
      } else {
        if (dialog.open) dialog.close();
        if (previous?.frames.length) restoreFocus(previous);
      }
      if (message) announcement.textContent = message;
      // No face content is code-split or lazily fetched yet: the moment render() has
      // finished synchronously mutating the DOM for this state, the face is ready. A
      // future async-loaded face panel would set this only once its own load settles.
      root.dataset.ready = "true";
    }
    function change(next: ReaderState, push: boolean, message: string) {
      const previous = state;
      state = next;
      save(push);
      render(previous, message);
    }
    function closeOne() {
      if (!state.frames.length) return;
      if (index > 0) history.back();
      else
        change({ ...state, frames: state.frames.slice(0, -1) }, false, "Returned to the argument.");
    }
    const cancel = (event: Event) => {
      event.preventDefault();
      closeOne();
    };
    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      )
        return;
      const control = event.target.closest<HTMLElement>(
        "[data-foundation],[data-view-link],[data-reader-anchor],[data-reader-back],[data-reader-close],[data-copy-passage]",
      );
      if (!control || !root.contains(control)) return;
      if (control.hasAttribute("data-foundation")) {
        const id = control.dataset.foundation;
        if (!id || !registry.foundations.includes(id)) return;
        event.preventDefault();
        const anchor = control.closest<HTMLElement>(".reader-passage")?.id ?? state.anchor;
        if (!control.id) control.id = `reader-trigger-${++trigger}`;
        const base = { ...state, anchor };
        // The reader may have scrolled here without using the outline. Seal the actual return anchor.
        if (anchor !== state.anchor) {
          state = base;
          save();
        }
        change(
          openFoundation(
            base,
            {
              foundationId: id,
              triggerId: control.id,
              relativeY: control.getBoundingClientRect().top / innerHeight,
            },
            registry,
          ),
          state.frames.length < MAX_CLARIFICATION_DEPTH,
          state.frames.length === MAX_CLARIFICATION_DEPTH
            ? "The deepest explanation was replaced; return to the argument is still available."
            : `Opened ${titles[id]}.`,
        );
      } else if (control.dataset.viewLink && FACES.includes(control.dataset.viewLink as Face)) {
        event.preventDefault();
        change(
          { ...state, view: control.dataset.viewLink as Face },
          true,
          "Changed the reading face; the passage and laboratory are preserved.",
        );
      } else if (
        control.dataset.readerAnchor &&
        registry.anchors.includes(control.dataset.readerAnchor)
      ) {
        event.preventDefault();
        change(
          { ...state, anchor: control.dataset.readerAnchor, frames: [] },
          true,
          "Moved to the selected passage.",
        );
        document.getElementById(state.anchor)?.scrollIntoView();
      } else if (control.hasAttribute("data-reader-back")) {
        event.preventDefault();
        closeOne();
      } else if (control.hasAttribute("data-reader-close")) {
        event.preventDefault();
        change({ ...state, frames: [] }, false, "Returned to the exact step.");
      } else if (
        control.dataset.copyPassage &&
        registry.anchors.includes(control.dataset.copyPassage)
      ) {
        event.preventDefault();
        const href = new URL(
          passageHref(registry, { ...state, anchor: control.dataset.copyPassage }),
          location.origin,
        ).href;
        const fallback = () => {
          const box = root.querySelector<HTMLElement>("[data-copy-fallback]");
          if (!box) return;
          box.hidden = false;
          const input = box.querySelector("input");
          if (!input) return;
          input.value = href;
          input.focus();
          input.select();
          announcement.textContent = "Copy the passage link from the selected field.";
        };
        const label = control.dataset.passageLabel?.trim();
        if (navigator.clipboard?.writeText)
          void navigator.clipboard.writeText(href).then(() => {
            announcement.textContent = `Link to ${label && label.length > 0 ? label : "this passage"} copied.`;
          }, fallback);
        else fallback();
      }
    };
    const changeControl = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLSelectElement && detailControls.includes(target)) {
        const detail = parseDetail(target.value) ?? 1;
        try {
          localStorage.setItem(DETAIL_STORAGE_KEY, String(detail));
        } catch {
          /* Optional preference persistence. */
        }
        change(
          { ...state, detail },
          false,
          "Changed detail without restarting the laboratory or closing your explanation.",
        );
      } else if (target instanceof HTMLInputElement && lensControls.includes(target))
        change(
          { ...state, lens: target.checked },
          false,
          target.checked
            ? "Modern qualifications are shown beside the explanation."
            : "Modern qualifications are hidden.",
        );
    };
    const pop = () => {
      // Captured before save() below: save() calls history.replaceState through the closed
      // allowlist of passageHref/readerHref, which does not carry an instrument-view or term
      // ?open= value (only foundation:), and would silently overwrite it in location.search
      // before a deferred read ever saw it.
      const openSearchAtPop = location.search;
      const previous = state,
        restored =
          restoreReaderState(history.state?.annusReader?.state, registry) ??
          parseReaderLocation(location.search, location.hash, registry);
      state = { ...restored, detail: state.detail };
      index = Number.isSafeInteger(history.state?.annusReader?.index)
        ? history.state.annusReader.index
        : 0;
      save();
      const lastFrame = state.frames.at(-1);
      render(
        previous,
        lastFrame
          ? `Returned to ${titles[lastFrame.foundationId] ?? lastFrame.foundationId}.`
          : "Returned to the argument.",
      );
      // A foundation-kind ?open= value is handled entirely by parseReaderLocation/render above;
      // this only ever resolves a kind this bead registers (instrument-view, term), so the two
      // paths never collide (am-read-return-stack-oxa). Deferred one microtask: it mounts a
      // separate React root via flushSync, which React refuses to run synchronously from inside
      // another component's own commit (a "flushSync inside a lifecycle method" conflict).
      closeDirectOpenDialog(document);
      queueMicrotask(() => openFromSearch(document, openSearchAtPop));
    };
    root.addEventListener("click", click);
    root.addEventListener("change", changeControl);
    dialog.addEventListener("cancel", cancel);
    window.addEventListener("popstate", pop);
    // Captured before save() below overwrites location.search through its closed allowlist --
    // see the identical note in pop() above.
    const openSearchOnMount = location.search;
    save();
    render();
    queueMicrotask(() => openFromSearch(document, openSearchOnMount));
    return () => {
      cancelReturn();
      root.removeEventListener("click", click);
      root.removeEventListener("change", changeControl);
      dialog.removeEventListener("cancel", cancel);
      window.removeEventListener("popstate", pop);
      closeDirectOpenDialog(document);
    };
  }, [navigation]);
  return (
    <div className="reader-controls">
      <nav aria-label="Reading face">
        <a href="?view=reading" data-view-link="reading">
          Explanation
        </a>
        <a href="?view=results" data-view-link="results">
          Argument synopsis
        </a>
        <a href="?view=german" data-view-link="german">
          Source status
        </a>
      </nav>
      <div className="reader-options">
        <div className="reader-option">
          <label htmlFor={detailId}>Detail</label>
          <select id={detailId} data-detail-control defaultValue="1" disabled>
            <option value="0">Overview</option>
            <option value="1">Full explanation</option>
            <option value="2">Show every step</option>
          </select>
        </div>
        <label className="check">
          <input type="checkbox" data-lens-control disabled />
          Show modern qualifications
        </label>
      </div>
      <p
        className="reader-announcement fine"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-reader-announcement
      />
      <label className="share-field" data-copy-fallback hidden>
        Passage link
        <input readOnly />
      </label>
    </div>
  );
}
