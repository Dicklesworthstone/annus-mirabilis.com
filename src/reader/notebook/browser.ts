import { authoredLastPlace, frameForPassage, shouldUseCompactRecap } from "./lastFrame.ts";
import type { NotebookStore } from "./notebookStore.ts";
import { mountNotebookPanel } from "./panel.ts";
import { type NotebookFrame, notebookFrameHref } from "./schema.ts";

/** Enhance the existing reader tree without rerendering prose, math or experiment instances. */
export function mountReaderNotebook(
  host: HTMLElement,
  trigger: HTMLAnchorElement,
  store: NotebookStore,
  readingLocation: () => Pick<Location, "pathname" | "search" | "hash"> = () => window.location,
) {
  store.open();
  const main = document.querySelector<HTMLElement>("main");
  if (!main) return () => {};
  let tracking = true,
    interacted = false,
    disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const owned = new Map<HTMLElement, HTMLElement>();
  const initialPlace = store.getSnapshot().document.lastPlace;
  let recap: HTMLElement | null = null;
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
  function message(text: string) {
    announce.textContent = text;
    const controls =
      document.activeElement instanceof Element
        ? document.activeElement.closest(".notebook-passage-actions")
        : null;
    if (controls) {
      let note = controls.querySelector(".notebook-action-note");
      if (!note) {
        note = document.createElement("p");
        note.className = "notebook-action-note";
        controls.append(note);
      }
      note.textContent = text;
    }
  }
  function makeButton(label: string, action: () => void) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
  }
  function save(kind: "question" | "example" | "nextStep", passage: HTMLElement, open = "") {
    const frame = frameForPassage(passage, readingLocation(), passage);
    const title = passage.querySelector("h3")?.textContent?.trim() ?? "";
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
    for (const [passage, controls] of owned) {
      if (!passage.isConnected) {
        controls.remove();
        owned.delete(passage);
      }
    }
    for (const passage of main!.querySelectorAll<HTMLElement>(
      "article.reader-passage[data-unit][id]",
    )) {
      if (owned.has(passage) || !frameForPassage(passage, readingLocation(), passage)) continue;
      const controls = document.createElement("div");
      controls.className = "notebook-passage-actions actions";
      controls.setAttribute("aria-label", "Keep this passage");
      const question = makeButton("Save question", () => save("question", passage));
      const mark = makeButton("Save next step", () => save("nextStep", passage));
      const note = makeButton("Add a note", () => {
        const frame = frameForPassage(passage, readingLocation(), passage),
          title = passage.querySelector("h3")?.textContent?.trim();
        if (frame && title) panel.open({ frame, title });
      });
      controls.append(question, mark, note);
      const example = [
        ...passage.querySelectorAll<HTMLAnchorElement>(".passage-actions a[data-foundation]"),
      ].find((link) => link.textContent?.trim() === "Show me one example first");
      if (example?.dataset.foundation) {
        const open = `foundation:${example.dataset.foundation}`;
        controls.append(makeButton("Save example", () => save("example", passage, open)));
      }
      owned.set(passage, controls);
      passage.append(controls);
    }
  }
  function showRecap() {
    if (!initialPlace) return;
    const section = document.createElement("section");
    section.className = "notebook-recap";
    section.setAttribute("aria-label", "Continue reading");
    const link = document.createElement("a");
    link.href = notebookFrameHref(initialPlace.frame);
    link.textContent = `Continue where you were: ${initialPlace.title}`;
    section.append(link);
    if (!shouldUseCompactRecap(initialPlace, readingLocation().pathname, readingLocation().hash)) {
      const label = document.createElement("p");
      label.textContent =
        initialPlace.recapKind === "overview" ? "Saved authored overview" : "Saved authored recap";
      const text = document.createElement("p");
      text.textContent = initialPlace.recap;
      section.append(label, text);
    }
    section.append(
      makeButton("Dismiss reading reminder", () => {
        section.remove();
        recap = null;
      }),
    );
    recap = section;
    main!.prepend(section);
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
    if (event.target instanceof Node && main!.contains(event.target)) {
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
  const observer = new MutationObserver(enhance);
  showRecap();
  enhance();
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
    for (const controls of owned.values()) controls.remove();
    owned.clear();
  };
}
