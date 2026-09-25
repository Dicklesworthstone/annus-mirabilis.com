"use client";
import { useEffect, useId, useRef } from "react";
import { makeDismissible } from "../a11y/modal/dismiss.ts";
import {
  applyElsewhere,
  clearUnitOverride,
  effectiveDetailForUnit,
  initialOverrideState,
  setGlobalDetail,
  setUnitOverride,
} from "./detail/applyElsewhere.ts";
import type { FaceAvailability } from "./faceAvailability.ts";
import { FACE_REGISTRY, type FaceId } from "./faces/registry.ts";
import { faceTabList } from "./faceTabs.ts";
import { InlineFacsimile } from "./facsimile/InlineFacsimile.tsx";
import { createPlaceHold, landingPlace, readingPlace } from "./holdPlace.ts";
import { placeOf, scrollToKeep } from "./keepPlace.ts";
import { loadLessonBody, unmountLessonConstructions } from "./lessonBody.ts";
import {
  DETAIL_STORAGE_KEY,
  type Detail,
  FACES,
  type Face,
  MAX_CLARIFICATION_DEPTH,
  NOTATION_STORAGE_KEY,
  NOTATION_TOGGLE_PAPERS,
  type Notation,
  openFoundation,
  parseDetail,
  parseNotation,
  parseReaderLocation,
  passageHref,
  type ReaderRegistry,
  type ReaderState,
  restoreReaderState,
} from "./navigation/state";
import { loadStepsBody, unmountStepsConstructions } from "./stepsBody.ts";
import "./actions/kindRegistration.ts";
import "../equations/missingStep/register.ts";
import { resolveOpenParam } from "./stack/history.ts";
import { closeDirectOpenDialog, openFromSearch, openFromTrigger } from "./stack/mountDirectOpen.ts";

type Props = {
  registry: ReaderRegistry;
  titles: Readonly<Record<string, string>>;
  questions: Readonly<Record<string, string>>;
  /** The Letters control's reach on this paper, from the built payload (notationReachLine). */
  notationHelp?: string | undefined;
  /**
   * The paper has result cards (content/results), which live on its results page. The Results tab
   * then goes there, as the German source tab does, instead of switching this page in place to
   * the passages' recaps, where a reader with JavaScript would never meet the cards.
   */
  resultCards?: boolean | undefined;
  /**
   * Which faces have something, derived by the face pages' own rule (paperSourceFaces, from
   * faceAvailability). The tabs come from faceTabList, the list FaceChooser also uses, so this
   * page offers the faces the face pages offer, in the same order. Absent, every face is a tab.
   */
  availability?: Readonly<Partial<Record<FaceId, FaceAvailability>>> | undefined;
};
/** The nearest element above `el` whose id the page registers as a place to return to. */
function enclosingAnchor(el: HTMLElement, anchors: readonly string[]): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement)
    if (node.id && anchors.includes(node.id)) return node;
  return null;
}
/** Navigation controls leave the existing prose, math and laboratory subtrees mounted. */
export function ReaderController(props: Props) {
  // App Router history restoration may recreate equal object props. Do not remount
  // the navigation owner and steal focus from the trigger we just restored.
  const navigation = JSON.stringify(props);
  const detailId = useId();
  const notationId = useId();
  const notationHelpId = useId();
  // The Letters control is this component's own element, on the papers that have it; a ref, not a
  // lookup, so a paper without it simply has none.
  const notationRef = useRef<HTMLSelectElement>(null);
  const copyFallbackId = useId();
  // The explanation is the face on screen, so every empty face waits in the pending line.
  const faceTabs = faceTabList(props.availability, "reading");
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
    const notationControls = notationRef.current ? [notationRef.current] : [];
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
    /*
      WHETHER THE URL NAMES A PASSAGE, which is not the same as whether the reader has one.
      `state.anchor` always holds a passage - with no fragment it is the first one - and url()
      used to write it into the address on mount. So a reader who opened /papers/light-quanta/
      was given /papers/light-quanta/#entry-light-quanta, and one frame later the site-wide
      fragment handler (search/launcher.ts) did what it should for a followed link: it focused
      that passage. Nothing had been followed. Measured on BUILD 2, 5 of 5 paper routes loaded
      with the first passage focused and :focus-visible, which drew the 3px accent focus ring
      around it: the "First encounter" box that reads like an error on light-quanta,
      special-relativity and mass-energy is that ring, not its own styling.
      The fragment is now written only when it was there on arrival or the reader has since
      moved to a passage; history navigation re-reads it. The anchor itself is unchanged.
    */
    let urlNamesPassage = location.hash.length > 1;
    /*
      PER-PASSAGE OVERRIDES OF THE PAGE'S DETAIL (am-read-detail-axis-sfc): a passage whose steps
      the reader opened, or closed, against the page's level. The page's Detail control never
      clears one. "Apply this to the rest of the page", which appears beside the latest override,
      clears them all and makes that passage's level the page's.
    */
    let layers = initialOverrideState(state.detail);
    let applyDetail: HTMLElement | null = null;
    // The reader's passage stays where it stood while a Detail change or loading steps reshape the
    // page above it (holdPlace.ts); WebKit has no scroll anchoring of its own.
    const placeHold = createPlaceHold(root);
    const passageInView = () =>
      readingPlace(
        [...root.querySelectorAll("article.reader-passage[data-unit]")],
        window.innerHeight,
      );
    const loadSteps = (placeholder: HTMLElement) =>
      loadStepsBody(placeholder, {
        insert: (change) => placeHold.across(passageInView, change),
      });
    const unitOf = (steps: Element) => steps.closest("article[data-unit]")?.id ?? "";
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
    // The pre-paint script already chose the letters (query, then storage, then Einstein's); the
    // control starts from what the page shows.
    notationControls.forEach((control) => {
      control.value = document.documentElement.dataset.notation === "modern" ? "modern" : "printed";
      control.disabled = false;
    });
    /**
     * LETTERS, Einstein's or today's (am-read-perspective-toggle-abd). Every formula carries both
     * forms and CSS shows one, so nothing re-renders; a formula that keeps today's letters gains or
     * loses its one-line note, so the passage in view is held in place across the change. The
     * choice is stored, and the address names it only when it is not the default.
     */
    function setNotation(notation: Notation) {
      placeHold.across(passageInView, () => {
        document.documentElement.dataset.notation = notation;
      });
      try {
        localStorage.setItem(NOTATION_STORAGE_KEY, notation);
      } catch {
        /* Optional preference persistence. */
      }
      const u = new URL(location.href);
      if (notation === "modern") u.searchParams.set("notation", "modern");
      else u.searchParams.delete("notation");
      history.replaceState(history.state, "", u);
      notationControls.forEach((control) => {
        control.value = notation;
      });
      announcement.textContent =
        notation === "printed"
          ? "Formulas are shown in Einstein's letters. One that cannot be says so."
          : "Formulas are shown in today's letters.";
    }
    /**
     * Start from the current location so unrelated query keys survive a face change.
     * Copy-passage links below intentionally build clean portable links instead.
     * A registered clarification remains in the URL until its own return path closes it.
     */
    function url() {
      const u = new URL(location.href);
      // An unknown ?view= falls back to the explanation and stays in the address as it
      // arrived: the fallback is the page's to decide, and rewriting the link is not.
      if (state.view !== "reading") u.searchParams.set("view", state.view);
      else if (FACES.includes(u.searchParams.get("view") as Face)) u.searchParams.delete("view");
      if (state.detail === 1) u.searchParams.delete("detail");
      else u.searchParams.set("detail", String(state.detail));
      if (state.lens) u.searchParams.set("lens", "modern");
      else u.searchParams.delete("lens");
      const frame = state.frames.at(-1);
      if (frame) u.searchParams.set("open", `foundation:${frame.foundationId}`);
      else if (!resolveOpenParam(u.searchParams.get("open"))) u.searchParams.delete("open");
      // A fragment already in the address counts too: an in-page link the browser followed
      // natively names a passage without passing through this controller.
      u.hash = urlNamesPassage || location.hash.length > 1 ? `#${state.anchor}` : "";
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
      const swapReadings = () => {
        document.documentElement.dataset.detail = String(state.detail);
        // The steps reading is one <details> per passage (PaperPage, PaperReader). At "Show every
        // step" it IS the passage's text, so it is open; leaving that level closes it again. A
        // passage the reader set on its own (an override) keeps its setting either way, and
        // otherwise a reader's own open or closed choice is left alone.
        if (state.detail === 2 || previous?.detail === 2)
          for (const steps of root.querySelectorAll<HTMLDetailsElement>(
            'details[data-reading="2"]',
          ))
            steps.open = effectiveDetailForUnit(layers, unitOf(steps)) === 2;
      };
      // A Detail change keeps the passage at the reader's reading line where it stood.
      if (previous && previous.detail !== state.detail)
        placeHold.across(passageInView, swapReadings);
      else swapReadings();
      document.documentElement.dataset.lens = state.lens ? "modern" : "paper";
      // The historian's margins are disclosures, so a reader without script can open them; the
      // modern lens opens every one, and reader.css hides them all under the paper lens.
      root.querySelectorAll<HTMLDetailsElement>('details[data-reading="3"]').forEach((margin) => {
        margin.open = state.lens;
      });
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
        // The lesson's body arrives when it opens (lessonBody.ts); its title is already here.
        const lessonBody = root.querySelector<HTMLElement>(
          `[data-foundation-panel="${frame.foundationId}"] [data-lesson-body]`,
        );
        if (lessonBody) void loadLessonBody(lessonBody);
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
        // Outside every passage, the place to come back to is the nearest enclosing element the
        // page registers as an anchor: the Brownian first encounter, which is not a
        // .reader-passage (the other three entrances are), and whose id PaperReader registers.
        const place =
          control.closest<HTMLElement>(".reader-passage") ??
          enclosingAnchor(control, registry.anchors);
        const anchor = place?.id ?? state.anchor;
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
        // WHERE THE READER IS AFTER THE SWITCH. When the address names a passage, the new face
        // opens at it, as arriving by that link does: the face links sit at the top of the page,
        // so a reader who scrolled up to them has already left the passage, and keeping the
        // viewport's place kept the page top (measured on live b2077fc1: after Results, the named
        // passage stood 10,062px down). With no passage named, the passage at the top of the
        // viewport stays where it stood (keepPlace.ts).
        const named = urlNamesPassage ? document.getElementById(state.anchor) : null;
        const place = named
          ? null
          : placeOf(
              [...root.querySelectorAll("article.reader-passage[data-unit]")],
              window.innerHeight,
            );
        change(
          { ...state, view: control.dataset.viewLink as Face },
          true,
          "Changed the reading face; the passage and laboratory are preserved.",
        );
        if (named) named.scrollIntoView({ block: "start", behavior: "instant" });
        else {
          const delta = place ? scrollToKeep(place, window.innerHeight) : 0;
          if (delta !== 0) window.scrollBy({ top: delta, behavior: "instant" });
        }
      } else if (
        control.dataset.readerAnchor &&
        registry.anchors.includes(control.dataset.readerAnchor)
      ) {
        event.preventDefault();
        urlNamesPassage = true;
        change(
          { ...state, anchor: control.dataset.readerAnchor, frames: [] },
          true,
          "Moved to the selected passage.",
        );
        // Focus follows the jump, so the next Tab starts in the passage rather than back in the
        // outline (measured on live at 320: Enter on a chip left focus on the chip). Sections and
        // passages carry tabIndex -1; after a mouse click the move draws no focus ring.
        const target = document.getElementById(state.anchor);
        target?.scrollIntoView();
        target?.focus({ preventScroll: true });
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
            // The status line is out of sight (reader.css), so the button confirms where the
            // reader is looking; its accessible name is unchanged and the status line speaks.
            const shown = control.textContent;
            control.textContent = "Link copied";
            window.setTimeout(() => {
              if (control.textContent === "Link copied") control.textContent = shown;
            }, 2000);
          }, fallback);
        else fallback();
      }
    };
    function setDetail(detail: Detail, message: string) {
      // The page's level alone never clears an override (applyElsewhere.ts).
      layers = setGlobalDetail(layers, detail);
      try {
        localStorage.setItem(DETAIL_STORAGE_KEY, String(detail));
      } catch {
        /* Optional preference persistence. */
      }
      change({ ...state, detail }, false, message);
    }
    /**
     * A passage's steps opened or closed against the page's level is an override: open is "Show
     * every step" (2), closed at "Show every step" is the full explanation (1). Set back to the
     * page's level, it is not. The page's own openings and closings match its level, so they
     * never count.
     */
    function noteOverride(details: HTMLDetailsElement) {
      const unit = unitOf(details);
      if (!unit) return;
      const level: Detail = details.open ? 2 : state.detail === 2 ? 1 : state.detail;
      layers =
        level === state.detail
          ? clearUnitOverride(layers, unit)
          : setUnitOverride(layers, unit, level);
      const latest = [...layers.overrides.keys()].at(-1);
      const beside = layers.overrides.has(unit) ? unit : latest;
      placeApply(
        beside
          ? root.querySelector<HTMLDetailsElement>(
              `article[id="${CSS.escape(beside)}"] details[data-reading="2"]`,
            )
          : null,
      );
    }
    /** The latest override's level becomes the page's, and the overrides go (applyElsewhere.ts). */
    function applyToPage() {
      layers = applyElsewhere(layers);
      placeApply(null);
      setDetail(
        layers.globalDetail,
        layers.globalDetail === 2
          ? "Every step is shown in every passage."
          : "The full explanation is shown in every passage.",
      );
    }
    /**
     * The one "Apply this to the rest of the page" control, beside the latest override. Script
     * makes it, so the page's markup never holds it and it takes its own listener rather than
     * the root's delegated one, which answers controls the markup carries.
     */
    function placeApply(at: HTMLDetailsElement | null) {
      if (!at) {
        applyDetail?.remove();
        applyDetail = null;
        return;
      }
      if (!applyDetail) {
        applyDetail = document.createElement("p");
        applyDetail.className = "fine";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondary";
        button.setAttribute("data-apply-detail", "");
        button.textContent = "Apply this to the rest of the page";
        button.addEventListener("click", applyToPage);
        applyDetail.append(button);
      }
      at.after(applyDetail);
    }
    const changeControl = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLSelectElement && detailControls.includes(target)) {
        setDetail(
          parseDetail(target.value) ?? 1,
          "Changed detail without restarting the laboratory or closing your explanation.",
        );
      } else if (target instanceof HTMLSelectElement && notationControls.includes(target)) {
        setNotation(parseNotation(target.value) ?? "printed");
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
      urlNamesPassage = location.hash.length > 1;
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
    // On a whole-paper page a passage's steps load when its disclosure first opens, whether the
    // reader opened it or "Show every step" did (stepsBody.ts). `toggle` does not bubble, so it is
    // caught on the way down; a disclosure already open before this ran is loaded here.
    const toggleSteps = (event: Event) => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement)) return;
      if (details.matches('details[data-reading="2"]')) noteOverride(details);
      if (!details.open) return;
      const placeholder = details.querySelector<HTMLElement>(":scope > [data-steps-body]");
      if (placeholder) void loadSteps(placeholder);
    };
    root.addEventListener("toggle", toggleSteps, true);
    for (const placeholder of root.querySelectorAll<HTMLElement>(
      "details[open] > [data-steps-body]",
    ))
      void loadSteps(placeholder);
    /* The owner's rule for every overlay: an X top right, and a press outside closes it. Both
       close the whole lesson stack and return to the passage, as "Return to the exact step"
       does; Escape keeps its own meaning here, one step back (the cancel handler above). */
    const dismissal = new AbortController();
    makeDismissible(dialog, {
      signal: dismissal.signal,
      escape: false,
      closeButton: dialog.querySelector<HTMLButtonElement>("[data-clarification-close]"),
      onDismiss: () => {
        if (state.frames.length)
          change({ ...state, frames: [] }, false, "Returned to the exact step.");
      },
    });
    const openSearchOnMount = location.search;
    save();
    render();
    /*
      ARRIVING AT A NAMED PASSAGE WHILE THE STEPS ABOVE IT LOAD (?detail=2#arg-...): the fragment
      scroll set off for where the passage stood before they arrived, so the passage is put at the
      top now and held there while they land.
    */
    const named = urlNamesPassage ? document.getElementById(state.anchor) : null;
    if (named && root.querySelector('details[data-reading="2"][open] > [data-steps-body]')) {
      placeHold.hold(landingPlace(named));
    }
    queueMicrotask(() => openFromSearch(document, openSearchOnMount));
    /*
      THE OUTLINE SAYS WHERE THE READER IS. Each section of the outline is a group whose first
      link names a .reader-section; the section crossing the upper part of the viewport is
      marked aria-current="location" and its group data-current, and data-spy on the nav lets
      reader.css show passage links for that section only. Measured on BUILD 4 at 1440x900, the
      sticky outline was 1,606px tall on light-quanta and 1,907px on special-relativity, so the
      later sections could not be reached from it until the page ended; with one section open it
      fits. Without JavaScript nothing is marked and every link shows.
      Above the first section and below the last, nothing is current, which is true.
    */
    const outlineNav = root.querySelector<HTMLElement>(".reader-outline nav");
    const tracked = [...(outlineNav?.children ?? [])].flatMap((group) => {
      const link = group.querySelector<HTMLAnchorElement>(":scope > a[data-reader-anchor]");
      const target = link ? document.getElementById(link.dataset.readerAnchor ?? "") : null;
      return link && target?.classList.contains("reader-section")
        ? [{ group: group as HTMLElement, link, target }]
        : [];
    });
    let spy: IntersectionObserver | undefined;
    if (outlineNav && tracked.length > 1 && typeof IntersectionObserver !== "undefined") {
      const crossing = new Set<Element>();
      spy = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) crossing.add(entry.target);
            else crossing.delete(entry.target);
          }
          const current = tracked.find((t) => crossing.has(t.target));
          for (const t of tracked) {
            t.group.toggleAttribute("data-current", t === current);
            if (t === current) t.link.setAttribute("aria-current", "location");
            else if (t.link.getAttribute("aria-current") === "location")
              t.link.removeAttribute("aria-current");
          }
        },
        { rootMargin: "-20% 0px -70% 0px" },
      );
      for (const t of tracked) spy.observe(t.target);
      outlineNav.dataset.spy = "";
    }
    return () => {
      spy?.disconnect();
      if (outlineNav) delete outlineNav.dataset.spy;
      cancelReturn();
      root.removeEventListener("click", click);
      root.removeEventListener("change", changeControl);
      dialog.removeEventListener("cancel", cancel);
      window.removeEventListener("popstate", pop);
      root.removeEventListener("toggle", toggleSteps, true);
      dismissal.abort();
      closeDirectOpenDialog(document);
      unmountLessonConstructions();
      unmountStepsConstructions();
      placeApply(null);
      placeHold.release();
    };
  }, [navigation]);
  return (
    <>
      <div className="reader-controls">
        {/* LABELS COME FROM FACE_REGISTRY, never from a literal here (ruling 2026-09-22).
            Four literals restating a declared table are four places for it to drift, and
            they had already drifted: "Argument synopsis" for Results and "Original scan"
            for Facsimile, against the registry's own names used on every face page.

            There used to be a fifth link here, "Source status". It was not a face: it set
            data-view="german" in place, which hid the explanation and showed one notice per
            passage, "The reviewed German, aligned English, gloss, facsimile, and split view
            for this passage are not yet available." A reader offered it would not choose it,
            and the source faces are the tabs below. ?view=german still resolves for links that
            carry it. */}
        {/* THE FACES THE FACE PAGES OFFER, IN THEIR ORDER (faceTabs.ts). These were four literal
            links, written before any English existed, so once the English of every paper was
            final a reader landing here still could not reach it. The tabs sit in div.face-tabs
            and the empty faces in the "Not yet available" line under them, both inside the
            landmark, as FaceChooser has them on the face pages. */}
        <nav aria-label="Reading face">
          <div className="face-tabs">
            {/* Current in the static HTML too: this page IS the explanation, and without
                JavaScript nothing else would ever mark it. The controller takes over after. */}
            <a href="?view=reading" data-view-link="reading" aria-current="page">
              {FACE_REGISTRY.reading.label}
            </a>
            {/* EVERY FACE ROUTE BELOW IS A LINK WITHOUT data-view-link, AND DELIBERATELY SO.
                Written for the German source link, and it holds for each of them: any
                [data-view-link] whose value is in FACES is intercepted by the root click
                handler (its `control.dataset.viewLink` branch) -
                preventDefault, then a client-side view switch - so a route href carrying
                one never navigates while JavaScript is on. The German link has to reach
                /papers/<x>/view/german/, which renders 23,608 characters of German for
                brownian-motion and 68,268 across the three papers that have it, so it
                carries no data-view-link and the browser follows it.

                Facsimile had the same treatment, and for a measured reason rather than
                symmetry. Its link already pointed at the route, but carrying
                data-view-link="facsimile" meant that handler intercepted it and switched the
                in-page view instead: clicked, it landed on ?view=facsimile#... and never
                left the paper page. Dropping the attribute removed NO rendered state.
                Measured on the built page by setting data-view directly, the eight view
                values collapse to four distinct renderings, and facsimile is byte-identical
                to german - 12,483 characters, the same six [data-face-source] panels, which
                ?view=german still reaches. What the route adds is real: light-quanta and
                mass-energy serve an actual facsimile viewer there (7,802 and 3,976 characters
                of text), and brownian-motion and special-relativity serve an honest
                "unavailable" page that says so and carries the chooser.

                English, parallel, gloss and split view are routes too, with their own
                pages, and nothing on this page renders them in place. */}
            {faceTabs.tabs.map((id) =>
              id === "results" ? (
                /* The href is the static results page, so without JavaScript the link reaches
                   the results face; with it, data-view-link switches the face in place as before.
                   A paper with result cards drops data-view-link, so the link is followed with
                   JavaScript too: the cards are on that page and nowhere on this one. */
                <a
                  key={id}
                  href={`/papers/${props.registry.paperId}/view/results/`}
                  {...(props.resultCards ? {} : { "data-view-link": "results" })}
                  data-face-state={props.availability?.[id] ?? undefined}
                >
                  {FACE_REGISTRY.results.label}
                </a>
              ) : (
                <a
                  key={id}
                  href={`/papers/${props.registry.paperId}/view/${id}/`}
                  data-face-state={props.availability?.[id] ?? undefined}
                >
                  {FACE_REGISTRY[id].label}
                </a>
              ),
            )}
          </div>
          {faceTabs.pending.length > 0 ? (
            <p className="face-pending fine">
              Not yet available:{" "}
              {faceTabs.pending.map((id, i) => (
                <span key={id}>
                  {i > 0 ? " · " : null}
                  <a href={`/papers/${props.registry.paperId}/view/${id}/`} data-face-state="empty">
                    {FACE_REGISTRY[id].label}
                  </a>
                </span>
              ))}
            </p>
          ) : null}
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
          {NOTATION_TOGGLE_PAPERS.includes(props.registry.paperId) ? (
            <div className="reader-option">
              <label htmlFor={notationId}>Letters</label>
              <select
                id={notationId}
                ref={notationRef}
                data-notation-control
                defaultValue="printed"
                aria-describedby={props.notationHelp ? notationHelpId : undefined}
                disabled
              >
                <option value="printed">Einstein's letters</option>
                <option value="modern">Today's letters</option>
              </select>
            </div>
          ) : null}
          <label className="check">
            <input type="checkbox" data-lens-control disabled />
            Show modern qualifications
          </label>
        </div>
        {NOTATION_TOGGLE_PAPERS.includes(props.registry.paperId) && props.notationHelp ? (
          <p className="fine" id={notationHelpId} data-notation-reach>
            {props.notationHelp}
          </p>
        ) : null}
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
