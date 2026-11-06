import {
  COMPANION_LABELS,
  SOURCE_LABELS,
  type SplitCompanion,
  type SplitLocation,
  type SplitPane,
  type SplitSource,
  splitSectionDestination,
  splitSelectionFromSearch,
  withSplitSelection,
} from "./selection.ts";

const modified = (event: MouseEvent) =>
  event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;

/** Enhance static text in place. No source, explanation or numerical value is fetched or recomputed. */
export function attachSplitReader(root: HTMLElement, scope: SplitLocation): () => void {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  if (!win) return () => {};
  const sourcePane = root.querySelector<HTMLElement>('[data-split-role="source"]');
  const companionPane = root.querySelector<HTMLElement>('[data-split-role="companion"]');
  const tabs = root.querySelector<HTMLElement>("[data-split-tabs]");
  const sourceTab = root.querySelector<HTMLAnchorElement>('[data-split-tab="source"]');
  const companionTab = root.querySelector<HTMLAnchorElement>('[data-split-tab="companion"]');
  const sourceChoice = root.querySelector<HTMLSelectElement>("[data-split-source-choice]");
  const companionChoice = root.querySelector<HTMLSelectElement>("[data-split-companion-choice]");
  const controls = root.querySelector<HTMLFieldSetElement>("[data-split-controls]");
  const explanation = root.querySelector<HTMLElement>("[data-split-explanation]");
  const results = root.querySelector<HTMLElement>("[data-split-results]");
  const columns = root.querySelector<HTMLElement>("[data-split-columns]");
  if (
    !sourcePane ||
    !companionPane ||
    !tabs ||
    !sourceTab ||
    !companionTab ||
    !sourceChoice ||
    !companionChoice ||
    !controls ||
    !explanation ||
    !results ||
    !columns
  )
    return () => {};

  const media = win.matchMedia("(max-width: 48em)");
  let { selection, notice } = splitSelectionFromSearch(win.location.search);
  let active: SplitPane = "source";
  let frame: number | undefined;
  const panes = { source: sourcePane, companion: companionPane };
  const tabFor = { source: sourceTab, companion: companionTab };

  const render = () => {
    root.dataset.splitEnhanced = "true";
    root.dataset.splitSource = selection.source;
    root.dataset.splitCompanion = selection.companion;
    sourcePane.dataset.splitPane = selection.source;
    companionPane.dataset.splitPane = selection.companion;
    sourceChoice.value = selection.source;
    companionChoice.value = selection.companion;
    controls.disabled = false;
    controls.hidden = false;
    const status = root.querySelector<HTMLElement>("[data-split-notice]");
    if (status) {
      status.textContent = notice;
      status.hidden = notice.length === 0;
    }
    for (const el of root.querySelectorAll<HTMLElement>("[data-split-source-label]"))
      el.textContent = SOURCE_LABELS[selection.source];
    for (const el of root.querySelectorAll<HTMLElement>("[data-split-companion-label]"))
      el.textContent = COMPANION_LABELS[selection.companion];
    sourceTab.textContent = SOURCE_LABELS[selection.source];
    companionTab.textContent = COMPANION_LABELS[selection.companion];
    for (const el of sourcePane.querySelectorAll<HTMLElement>("[data-split-language]")) {
      el.hidden = selection.source !== "parallel" && el.dataset.splitLanguage !== selection.source;
    }
    explanation.hidden = selection.companion !== "reading";
    results.hidden = selection.companion !== "results";
    // Match DOM and visual order, including keyboard traversal and the screen-reader sequence.
    const order: readonly SplitPane[] = selection.reversed
      ? ["companion", "source"]
      : ["source", "companion"];
    const first = order[0];
    if (first && columns.firstElementChild !== panes[first]) columns.prepend(panes[first]);
    if (first && tabs.firstElementChild !== tabFor[first]) tabs.prepend(tabFor[first]);
    if (media.matches) tabs.setAttribute("role", "tablist");
    else tabs.removeAttribute("role");
    for (const pane of ["source", "companion"] as const) {
      const visible = !media.matches || active === pane;
      // Resizing a desktop comparison must not leave keyboard focus in its now-hidden pane.
      if (!visible && panes[pane].contains(doc.activeElement)) tabFor[active].focus();
      panes[pane].hidden = !visible;
      if (media.matches) {
        panes[pane].setAttribute("role", "tabpanel");
        panes[pane].setAttribute("aria-labelledby", tabFor[pane].id);
        panes[pane].tabIndex = 0;
        tabFor[pane].setAttribute("role", "tab");
        tabFor[pane].setAttribute("aria-selected", String(active === pane));
        tabFor[pane].setAttribute("aria-controls", panes[pane].id);
        tabFor[pane].tabIndex = active === pane ? 0 : -1;
      } else {
        panes[pane].removeAttribute("role");
        panes[pane].setAttribute("aria-labelledby", `split-${pane}-heading`);
        panes[pane].removeAttribute("tabindex");
        tabFor[pane].removeAttribute("role");
        tabFor[pane].removeAttribute("aria-selected");
        tabFor[pane].removeAttribute("aria-controls");
        tabFor[pane].removeAttribute("tabindex");
      }
    }
    const sourceLink = root.querySelector<HTMLAnchorElement>("[data-split-source-face-link]");
    if (sourceLink) sourceLink.href = scope.faceHrefs[selection.source];
    const companionLink = root.querySelector<HTMLAnchorElement>("[data-split-companion-face-link]");
    if (companionLink) {
      companionLink.href = scope.faceHrefs[selection.companion];
      companionLink.textContent =
        selection.companion === "reading"
          ? "Open this explanation on its own"
          : "Open these results on their own";
    }
    for (const link of root.querySelectorAll<HTMLAnchorElement>("[data-split-section-link]")) {
      const next = withSplitSelection(new URL(link.href), selection);
      const current = new URL(win.location.href);
      next.search = current.search;
      next.searchParams.set(
        "panes",
        withSplitSelection(current, selection).searchParams.get("panes") ?? "parallel,reading",
      );
      next.searchParams.delete("split-pane");
      link.href = next.href;
    }
  };

  const write = (mode: "push" | "replace", hash?: string) => {
    const next = withSplitSelection(new URL(win.location.href), selection);
    next.searchParams.set("split-pane", active);
    if (hash !== undefined) next.hash = hash;
    if (next.href !== win.location.href)
      win.history[mode === "push" ? "pushState" : "replaceState"](win.history.state, "", next);
    notice = "";
    render();
  };

  const revealHash = (focus: boolean) => {
    let id: string;
    try {
      id = decodeURIComponent(win.location.hash.slice(1));
    } catch {
      return;
    }
    if (!id || id.length > 240) return;
    let target = doc.getElementById(id);
    if (!target || !root.contains(target)) return;
    const original = target;
    if (companionPane.contains(target)) {
      active = "companion";
      // Pane and heading hashes are shared by both choices. Only an actual content target
      // overrides the saved choice; otherwise Results would turn into Explanation on reload.
      if (results.contains(target)) selection = { ...selection, companion: "results" };
      else if (explanation.contains(target)) selection = { ...selection, companion: "reading" };
    } else if (sourcePane.contains(target)) {
      active = "source";
      const language = target.closest<HTMLElement>("[data-split-language]");
      if (
        language &&
        selection.source !== "parallel" &&
        language.dataset.splitLanguage !== selection.source
      ) {
        const row = target.closest<HTMLElement>("[data-split-source-row]");
        target =
          row?.querySelector<HTMLElement>(`[data-split-language="${selection.source}"]`) ??
          row ??
          target;
      }
    }
    render();
    for (
      let parent = original.parentElement;
      parent && parent !== root;
      parent = parent.parentElement
    ) {
      if (parent.tagName === "DETAILS") (parent as HTMLDetailsElement).open = true;
    }
    if (frame !== undefined) win.cancelAnimationFrame(frame);
    const landing = target;
    frame = win.requestAnimationFrame(() => {
      landing.scrollIntoView?.({ block: "start" });
      if (focus) {
        if (!landing.hasAttribute("tabindex")) landing.tabIndex = -1;
        landing.focus({ preventScroll: true });
      }
    });
  };

  const restore = () => {
    const url = new URL(win.location.href);
    const destination = splitSectionDestination(url, scope);
    if (destination) {
      win.location.replace(destination.href);
      return;
    }
    ({ selection, notice } = splitSelectionFromSearch(url.search));
    active =
      url.searchParams.get("split-pane") === "companion"
        ? "companion"
        : selection.reversed
          ? "companion"
          : "source";
    if (url.searchParams.get("split-pane") === "source") active = "source";
    render();
    revealHash(false);
  };

  const onChange = (event: Event) => {
    if (event.target === sourceChoice) {
      selection = { ...selection, source: sourceChoice.value as SplitSource };
      active = "source";
    } else if (event.target === companionChoice) {
      selection = { ...selection, companion: companionChoice.value as SplitCompanion };
      active = "companion";
    } else return;
    write("push", panes[active].id);
  };

  const onClick = (event: MouseEvent) => {
    if (modified(event)) return;
    const target = event.target as Element | null;
    const tab = target?.closest<HTMLElement>("[data-split-tab]");
    if (tab) {
      event.preventDefault();
      active = tab.dataset.splitTab === "companion" ? "companion" : "source";
      write("push", panes[active].id);
      return;
    }
    if (target?.closest("[data-split-swap]")) {
      selection = { ...selection, reversed: !selection.reversed };
      write("push");
      return;
    }
    const crossLink = target?.closest<HTMLAnchorElement>("a[data-split-go]");
    if (crossLink) {
      event.preventDefault();
      active = crossLink.dataset.splitGo === "source" ? "source" : "companion";
      if (active === "companion") selection = { ...selection, companion: "reading" };
      write("push", new URL(crossLink.href).hash);
      revealHash(true);
      return;
    }
    // Sentence-alignment controls can reveal the other language even from a single-language face.
    if (
      sourcePane.contains(target) &&
      target?.closest('[data-action="show-aligned-source"], [data-action="show-aligned-target"]') &&
      selection.source !== "parallel"
    ) {
      selection = { ...selection, source: "parallel" };
      write("replace");
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as Element | null;
    if (!media.matches || !target?.closest("[data-split-tab]")) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") active = selection.reversed ? "companion" : "source";
    else if (event.key === "End") active = selection.reversed ? "source" : "companion";
    else active = active === "source" ? "companion" : "source";
    write("replace", panes[active].id);
    tabFor[active].focus();
  };

  const sourceKeys = (event: KeyboardEvent) => {
    // The existing alignment controller navigates German sentences. Let an English-only pane
    // retain ordinary page scrolling rather than attempting to focus its hidden German partner.
    if (selection.source === "english" && ["j", "k", "ArrowDown", "ArrowUp"].includes(event.key))
      event.stopPropagation();
  };
  const resize = () => render();
  root.addEventListener("change", onChange);
  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeyDown);
  sourcePane.addEventListener("keydown", sourceKeys, true);
  win.addEventListener("popstate", restore);
  win.addEventListener("hashchange", restore);
  media.addEventListener("change", resize);
  restore();

  return () => {
    root.removeEventListener("change", onChange);
    root.removeEventListener("click", onClick);
    root.removeEventListener("keydown", onKeyDown);
    sourcePane.removeEventListener("keydown", sourceKeys, true);
    win.removeEventListener("popstate", restore);
    win.removeEventListener("hashchange", restore);
    media.removeEventListener("change", resize);
    if (frame !== undefined) win.cancelAnimationFrame(frame);
    controls.disabled = true;
    controls.hidden = true;
    sourcePane.hidden = false;
    companionPane.hidden = false;
    explanation.hidden = false;
    results.hidden = true;
    for (const language of sourcePane.querySelectorAll<HTMLElement>("[data-split-language]"))
      language.hidden = false;
    root.removeAttribute("data-split-enhanced");
  };
}
