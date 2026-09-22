import { createModalCloseButton, makeDismissible } from "../../a11y/modal/dismiss.ts";
import { authoredLastPlace, frameForPassage } from "./lastFrame.ts";
import type { NotebookStore } from "./notebookStore.ts";
import { mountNotebookPanel } from "./panel.ts";
import { type NotebookFrame, notebookFrameHref } from "./schema.ts";

/**
 * Which saved place the reader dismissed the "Continue where you left off" line for. Registered in
 * src/platform/storage/keys.ts, so the data panel lists it and "Clear" removes it.
 */
export const RECAP_DISMISSED_KEY = "am:notebook-recap:v1";

export interface RecapMemory {
  dismissed(): string | null;
  dismiss(href: string): void;
}

/** A blocked or full storage leaves the line dismissed for this page view only. */
export const browserRecapMemory: RecapMemory = {
  dismissed() {
    try {
      const raw = localStorage.getItem(RECAP_DISMISSED_KEY);
      const value = raw ? (JSON.parse(raw) as { dismissed?: unknown }).dismissed : null;
      return typeof value === "string" ? value : null;
    } catch {
      return null;
    }
  },
  dismiss(href) {
    try {
      localStorage.setItem(
        RECAP_DISMISSED_KEY,
        JSON.stringify({ schemaVersion: 1, dismissed: href }),
      );
    } catch {
      // Nothing to repair: the line is already gone from this page.
    }
  },
};

/**
 * The only two pages that offer to take a reader back. The owner, 2026-09-22: "these reading
 * reminder things are super annoying". The reminder used to be a bordered block with the recap
 * text prepended to <main> on EVERY page, and dismissing it lasted one page view. On a page with
 * its own content the reader has already chosen where to be.
 */
const RECAP_PAGES = new Set(["/", "/index.html", "/papers", "/papers/", "/papers/index.html"]);

const SVG = "http://www.w3.org/2000/svg";
function icon(d: string) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("d", d);
  svg.append(path);
  return svg;
}
const BOOKMARK = "M7 3.5h10v17l-5-3.8-5 3.8z";
const CROSS = "M6 6 18 18M18 6 6 18";

/** Enhance the existing reader tree without rerendering prose, math or experiment instances. */
export function mountReaderNotebook(
  host: HTMLElement,
  trigger: HTMLAnchorElement,
  store: NotebookStore,
  readingLocation: () => Pick<Location, "pathname" | "search" | "hash"> = () => window.location,
  recapMemory: RecapMemory = browserRecapMemory,
) {
  store.open();
  const mainEl = document.querySelector<HTMLElement>("main");
  if (!mainEl) return () => {};
  const main = mainEl;
  let tracking = true,
    interacted = false,
    disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** Each enhanced passage and the one bookmark button added to it. */
  const owned = new Map<HTMLElement, { controls: HTMLElement; toggle: HTMLButtonElement }>();
  const initialPlace = store.getSnapshot().document.lastPlace;
  let recap: HTMLElement | null = null;
  /** The one open "Save to notebook" menu, if any. Its listeners live only while it is open. */
  let menu: { toggle: HTMLButtonElement; panel: HTMLElement; abort: AbortController } | null = null;
  const panel = mountNotebookPanel(host, store, () => {
    tracking = false;
    recap?.remove();
    recap = null;
  });
  const announce = document.createElement("p");
  announce.className = "notebook-announcement";
  announce.setAttribute("role", "status");
  announce.setAttribute("aria-live", "polite");
  announce.setAttribute("aria-atomic", "true");
  host.append(announce);
  /** Announced, and written under the menu's buttons so a sighted reader sees it too. */
  function message(text: string) {
    announce.textContent = text;
    if (!menu) return;
    let note = menu.panel.querySelector(".notebook-action-note");
    if (!note) {
      note = document.createElement("p");
      note.className = "notebook-action-note";
      menu.panel.append(note);
    }
    note.textContent = text;
  }
  function makeButton(label: string, action: () => void) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "notebook-save-item";
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
  }
  function passageTitle(passage: HTMLElement) {
    return passage.querySelector("h3")?.textContent?.trim() ?? "";
  }
  function closeMenu(returnFocus: boolean) {
    if (!menu) return;
    const { toggle, panel: open, abort } = menu;
    menu = null;
    abort.abort();
    open.remove();
    toggle.setAttribute("aria-expanded", "false");
    toggle.removeAttribute("aria-controls");
    if (returnFocus) toggle.focus({ preventScroll: true });
  }
  /**
   * One small menu per press instead of four buttons under every passage. It is a non-modal
   * panel, so the X, a press outside and Escape all close it through %44's makeDismissible.
   */
  function openMenu(passage: HTMLElement, controls: HTMLElement, toggle: HTMLButtonElement) {
    const same = menu?.toggle === toggle;
    closeMenu(false);
    if (same) return;
    const options = document.createElement("div");
    options.className = "notebook-save-menu";
    options.id = `notebook-save-${passage.id}`;
    options.setAttribute("role", "group");
    options.setAttribute("aria-label", "Save to notebook");
    const close = createModalCloseButton("Close save options");
    const heading = document.createElement("p");
    heading.className = "notebook-save-heading";
    heading.textContent = "Save to notebook";
    const actions = [
      makeButton("Save question", () => save("question", passage)),
      makeButton("Save next step", () => save("nextStep", passage)),
      makeButton("Add a note", () => {
        const frame = frameForPassage(passage, readingLocation(), passage),
          title = passageTitle(passage);
        // The notebook dialog returns focus to what was focused when it opened, so hand it
        // the bookmark before this menu, and the button pressed, leave the page.
        closeMenu(true);
        if (frame && title) panel.open({ frame, title });
      }),
    ];
    const example = [
      ...passage.querySelectorAll<HTMLAnchorElement>(".passage-actions a[data-foundation]"),
    ].find((link) => link.textContent?.trim() === "Show me one example first");
    if (example?.dataset.foundation) {
      const open = `foundation:${example.dataset.foundation}`;
      actions.push(makeButton("Save example", () => save("example", passage, open)));
    }
    options.append(close, heading, ...actions);
    controls.append(options);
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-controls", options.id);
    const abort = new AbortController();
    menu = { toggle, panel: options, abort };
    makeDismissible(options, {
      signal: abort.signal,
      closeButton: close,
      inside: [toggle],
      // A press outside landed where the reader wants to be; the X and Escape come back here.
      onDismiss: (reason) => closeMenu(reason !== "outside"),
    });
    // Tabbing on past the last option leaves the menu, so the menu goes too.
    options.addEventListener(
      "focusout",
      (event) => {
        if (event.relatedTarget instanceof Node && !controls.contains(event.relatedTarget))
          closeMenu(false);
      },
      { signal: abort.signal },
    );
    actions[0]?.focus({ preventScroll: true });
  }
  /** A filled bookmark on every passage the notebook already holds something from. */
  function markSaved() {
    const entries = store.getSnapshot().document.entries;
    for (const [passage, { toggle }] of owned) {
      const frame = frameForPassage(passage, readingLocation(), passage);
      const saved =
        frame !== null &&
        entries.some(
          (entry) => entry.frame.paper === frame.paper && entry.frame.anchor === passage.id,
        );
      const title = passageTitle(passage);
      toggle.toggleAttribute("data-saved", saved);
      toggle.setAttribute(
        "aria-label",
        `Save to notebook${title ? `: ${title}` : ""}${saved ? " (already in your notebook)" : ""}`,
      );
    }
  }
  function save(kind: "question" | "example" | "nextStep", passage: HTMLElement, open = "") {
    const frame = frameForPassage(passage, readingLocation(), passage);
    const title = passageTitle(passage);
    const question = passage.querySelector(".passage-question")?.textContent?.trim() ?? "";
    if (!frame || !title || !question) {
      message("This passage has no supported notebook location.");
      return;
    }
    const target: NotebookFrame = { ...frame, open };
    const text = kind === "example" ? `Authored example for: ${question}` : question;
    const duplicate = store
      .getSnapshot()
      .document.entries.some(
        (entry) =>
          entry.kind === kind &&
          entry.text === text &&
          notebookFrameHref(entry.frame) === notebookFrameHref(target),
      );
    if (duplicate) {
      message("This entry is already in your notebook.");
      return;
    }
    const result = panel.add(kind, target, title, text);
    message(result.ok ? store.getSnapshot().message : result.message);
  }
  function enhance() {
    if (disposed) return;
    let added = false;
    for (const [passage, { controls }] of owned) {
      if (!passage.isConnected) {
        if (menu && controls.contains(menu.panel)) closeMenu(false);
        controls.remove();
        owned.delete(passage);
      }
    }
    for (const passage of main.querySelectorAll<HTMLElement>(
      "article.reader-passage[data-unit][id]",
    )) {
      if (owned.has(passage) || !frameForPassage(passage, readingLocation(), passage)) continue;
      const controls = document.createElement("div");
      controls.className = "notebook-passage-actions";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "notebook-save-toggle";
      toggle.title = "Save to notebook";
      toggle.setAttribute("aria-expanded", "false");
      toggle.append(icon(BOOKMARK));
      toggle.addEventListener("click", () => openMenu(passage, controls, toggle));
      controls.append(toggle);
      owned.set(passage, { controls, toggle });
      // Beside the passage's heading, where a bookmark belongs, not under its last line.
      const heading = passage.querySelector(":scope > h3");
      if (heading) heading.before(controls);
      else passage.prepend(controls);
      added = true;
    }
    if (added) markSaved();
  }
  /** One quiet line on the home page and /papers/, and never again for a place dismissed. */
  function showRecap() {
    if (!initialPlace) return;
    if (!RECAP_PAGES.has(readingLocation().pathname)) return;
    const href = notebookFrameHref(initialPlace.frame);
    if (recapMemory.dismissed() === href) return;
    const line = document.createElement("p");
    line.className = "notebook-recap";
    const link = document.createElement("a");
    link.href = href;
    link.textContent = `Continue where you left off: ${initialPlace.title}`;
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "notebook-recap-dismiss";
    dismiss.setAttribute("aria-label", "Dismiss: continue where you left off");
    dismiss.title = "Dismiss";
    dismiss.append(icon(CROSS));
    dismiss.addEventListener("click", () => {
      recapMemory.dismiss(href);
      line.remove();
      recap = null;
      message("Dismissed. Your notebook still keeps the place.");
    });
    line.append(link, dismiss);
    recap = line;
    main.prepend(line);
  }
  function remember() {
    timer = null;
    if (!tracking || !interacted || disposed || panel.isOpen()) return;
    const passages = [...owned.keys()].filter((passage) => {
      const bounds = passage.getBoundingClientRect();
      return bounds.bottom > 0 && bounds.top < innerHeight && passage.getClientRects().length > 0;
    });
    const focused =
      document.activeElement instanceof Element
        ? document.activeElement.closest<HTMLElement>("article.reader-passage[data-unit]")
        : null;
    const passage =
      focused && passages.includes(focused)
        ? focused
        : passages.sort(
            (a, b) =>
              Math.abs(a.getBoundingClientRect().top) - Math.abs(b.getBoundingClientRect().top),
          )[0];
    if (!passage) return;
    const frame = frameForPassage(passage, readingLocation(), passage);
    if (!frame) return;
    // The existing reader serializes its active foundation to ?open=. It is the only
    // clarification we store until the other kinds expose equally portable locations.
    const open = new URLSearchParams(readingLocation().search).get("open");
    const place = authoredLastPlace(passage, {
      ...frame,
      open: open?.startsWith("foundation:") ? open : "",
    });
    if (place) store.remember(place);
  }
  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(remember, 250);
  }
  function interaction(event: Event) {
    if (event.target instanceof Node && main.contains(event.target)) {
      interacted = true;
      schedule();
    }
  }
  function scroll() {
    if (interacted) schedule();
  }
  function flush() {
    if (timer) clearTimeout(timer);
    remember();
  }
  function storage(event: StorageEvent) {
    if (event.key === "am:notebook:v1" || event.key === null) store.checkForExternalChange();
  }
  function launch(event: MouseEvent) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
      return;
    event.preventDefault();
    panel.open();
  }
  function pageLaunch(event: MouseEvent) {
    if (event.target instanceof Element && event.target.closest("[data-open-notebook]")) {
      if (
        event.button === 0 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.preventDefault();
        panel.open();
      }
    }
  }
  /**
   * The page's "Open your notebook" control ships DISABLED and is enabled here.
   *
   * It used to be an anchor pointing at /notebook/ while standing on /notebook/, relying on the
   * delegated click below to turn it into a panel. Without this script that control reloaded the
   * page the reader was already on and nothing happened, which is the hydration-dependent button
   * AGENTS.md forbids. Shipping it disabled makes the unavailable state visible; enabling it here
   * is what the script arriving actually means.
   *
   * Every matching control is enabled, not just the first, because the same marker is used by
   * SaveComparisonReplay.tsx and a second one may be added without anyone revisiting this line.
   */
  function enableLaunchers() {
    for (const el of document.querySelectorAll("[data-open-notebook][disabled]")) {
      if (el instanceof HTMLButtonElement) el.disabled = false;
    }
  }
  enableLaunchers();

  const observer = new MutationObserver(() => {
    enhance();
    // A control rendered after mount is still a control a reader can press.
    enableLaunchers();
  });
  showRecap();
  enhance();
  const unsubscribe = store.subscribe(markSaved);
  observer.observe(main, { childList: true, subtree: true });
  trigger.addEventListener("click", launch);
  main.addEventListener("click", pageLaunch);
  for (const name of ["pointerdown", "keydown", "touchstart", "wheel"])
    main.addEventListener(name, interaction, { passive: true });
  window.addEventListener("scroll", scroll, { passive: true });
  window.addEventListener("pagehide", flush);
  window.addEventListener("storage", storage);
  window.addEventListener("popstate", enhance);
  window.addEventListener("hashchange", enhance);
  return () => {
    flush();
    disposed = true;
    if (timer) clearTimeout(timer);
    observer.disconnect();
    unsubscribe();
    closeMenu(false);
    trigger.removeEventListener("click", launch);
    main.removeEventListener("click", pageLaunch);
    for (const name of ["pointerdown", "keydown", "touchstart", "wheel"])
      main.removeEventListener(name, interaction);
    window.removeEventListener("scroll", scroll);
    window.removeEventListener("pagehide", flush);
    window.removeEventListener("storage", storage);
    window.removeEventListener("popstate", enhance);
    window.removeEventListener("hashchange", enhance);
    panel.dispose();
    recap?.remove();
    announce.remove();
    for (const { controls } of owned.values()) controls.remove();
    owned.clear();
  };
}
