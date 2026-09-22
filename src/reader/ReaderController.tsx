"use client";
import { useEffect, useId } from "react";
import { FACE_REGISTRY } from "./faces/registry.ts";
import { InlineFacsimile } from "./facsimile/InlineFacsimile.tsx";
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
import "../equations/missingStep/register.ts";
import { resolveOpenParam } from "./stack/history.ts";
import { closeDirectOpenDialog, openFromSearch, openFromTrigger } from "./stack/mountDirectOpen.ts";

type Props = {
  registry: ReaderRegistry;
  titles: Readonly<Record<string, string>>;
  questions: Readonly<Record<string, string>>;
};
/** Navigation controls leave the existing prose, math and laboratory subtrees mounted. */
export function ReaderController(props: Props) {
  // App Router history restoration may recreate equal object props. Do not remount
  // the navigation owner and steal focus from the trigger we just restored.
  const navigation = JSON.stringify(props);
  const detailId = useId();
  const copyFallbackId = useId();
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
     * Start from the current location so unrelated query keys survive a face change.
     * Copy-passage links below intentionally build clean portable links instead.
     * A registered clarification remains in the URL until its own return path closes it.
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
      else if (!resolveOpenParam(u.searchParams.get("open"))) u.searchParams.delete("open");
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
      // Reassert the semantic return after native dialog/history focus restoration,
      // unless another navigation has superseded it.
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
        "[data-clarification-open],[data-foundation],[data-view-link],[data-reader-anchor],[data-reader-back],[data-reader-close],[data-copy-passage]",
      );
      if (!control || !root.contains(control)) return;
      if (control.dataset.clarificationOpen) {
        if (!resolveOpenParam(control.dataset.clarificationOpen)) return;
        const anchor = control.closest<HTMLElement>(".reader-passage")?.id ?? state.anchor;
        if (anchor !== state.anchor) {
          state = { ...state, anchor };
          save();
        }
        if (openFromTrigger(document, control, control.dataset.clarificationOpen))
          event.preventDefault();
      } else if (control.hasAttribute("data-foundation")) {
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
      // Capture the navigation target before normalizing the reader-owned settings.
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
      // Foundation clarifications keep their existing owner. Registered kinds share this
      // separate root, mounted outside the current React commit to avoid nested flushSync.
      closeDirectOpenDialog(document, true);
      queueMicrotask(() => openFromSearch(document, openSearchAtPop));
    };
    root.addEventListener("click", click);
    root.addEventListener("change", changeControl);
    dialog.addEventListener("cancel", cancel);
    window.addEventListener("popstate", pop);
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
    <>
      <div className="reader-controls">
        {/* LABELS COME FROM FACE_REGISTRY, never from a literal here (ruling 2026-09-22).
            Four literals restating a declared table are four places for it to drift, and
            they had already drifted: "Argument synopsis" for Results and "Original scan"
            for Facsimile, against the registry's own names used on every face page.

            "Source status" is NOT one of them and is deliberately still a literal. It does
            not name a face: measured on the running app, this link sets data-view="german",
            which hides [data-face-reading] and reveals six [data-face-source] notices
            reading "The reviewed German, aligned English, gloss, facsimile, and split view
            for this passage are not yet available." The registry's "German source" is the
            ROUTE /papers/<x>/view/german/, which renders 23,608 characters of actual
            German. Giving this link the registry's label would put the registry's name on
            something that says the opposite of what the registry's route shows. It is a
            per-passage source-status panel and it is named for what it does. */}
        <nav aria-label="Reading face">
          <a href="?view=reading" data-view-link="reading">
            {FACE_REGISTRY.reading.label}
          </a>
          <a href="?view=results" data-view-link="results">
            {FACE_REGISTRY.results.label}
          </a>
          {/* THE GERMAN SOURCE ROUTE, AND DELIBERATELY WITHOUT data-view-link.
              Any [data-view-link] whose value is in FACES is intercepted at :238 -
              preventDefault, then a client-side view switch - so a route href carrying
              one never navigates while JavaScript is on. This link has to reach
              /papers/<x>/view/german/, which renders 23,608 characters of German for
              brownian-motion and 68,268 across the three papers that have it, so it
              carries no data-view-link and the browser follows it.

              It also cannot share "german" with the link below: the controller marks
              aria-current on every [data-view-link] matching the current view, so two
              would both claim to be the current page. */}
          <a href={`/papers/${props.registry.paperId}/view/german/`}>
            {FACE_REGISTRY.german.label}
          </a>
          <a href="?view=german" data-view-link="german">
            Source status
          </a>
          <a href={`/papers/${props.registry.paperId}/view/facsimile/`} data-view-link="facsimile">
            {FACE_REGISTRY.facsimile.label}
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
        <div className="share-field" data-copy-fallback hidden>
          <label htmlFor={copyFallbackId}>Passage link</label>
          <input id={copyFallbackId} type="text" readOnly />
        </div>
      </div>
      <InlineFacsimile key={props.registry.paperId} paperId={props.registry.paperId} />
    </>
  );
}
