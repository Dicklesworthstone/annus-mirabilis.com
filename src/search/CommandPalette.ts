import {
  SEARCH_LIMITS,
  SEARCH_TYPES,
  type SearchHit,
  type SearchType,
  searchResultHref,
} from "./core.ts";
import { type LoadedSearch, searchIndexLoader } from "./loadIndex.ts";

const TYPE_LABELS: Readonly<Record<SearchType, string>> = {
  paper: "Papers",
  section: "Sections",
  argument: "Arguments",
  equation: "Equations",
  instrument: "Laboratories",
  foundation: "Foundations",
  result: "Argument synopses",
  "sentence-de": "German passages",
  "sentence-en": "English passages",
  glossary: "Notation and terms",
  misconception: "Misconceptions",
  margin: "Historical notes",
  timeline: "Timeline",
  "knowledge-card": "Knowledge cards",
  person: "People",
  essay: "Essays",
  "connection-thread": "Connections",
  tour: "Tours",
  capstone: "Capstones",
};
let sequence = 0;
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

/**
 * A lazily mounted, native modal. It owns only its appended subtree and releases every
 * listener on close. Text is assigned with textContent; no result HTML is interpreted.
 * Keeping the controller DOM-native lets the same implementation run in browser fixtures.
 */
export function openCommandPalette(
  options: {
    load?: () => Promise<LoadedSearch>;
    navigate?: (href: string) => void;
    onClose?: () => void;
  } = {},
): () => void {
  const previousFocus = document.activeElement;
  const id = `am-search-${++sequence}`;
  const listeners = new AbortController();
  const events = { signal: listeners.signal };
  let resultListeners = new AbortController();
  let closed = false;
  let loaded: LoadedSearch | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let hits: readonly SearchHit[] = [];
  let active = -1;
  let optionNodes: HTMLAnchorElement[] = [];
  const navigate = options.navigate ?? ((href: string) => window.location.assign(href));
  const dialog = element("dialog", undefined, "search-dialog");
  dialog.id = id;
  dialog.setAttribute("data-search-dialog", "true");
  dialog.setAttribute("aria-labelledby", `${id}-title`);
  dialog.setAttribute("aria-describedby", `${id}-privacy`);
  const heading = element("div", undefined, "search-heading");
  const title = element("h2", "Search the edition");
  title.id = `${id}-title`;
  const closeButton = element("button", "Close search", "secondary");
  closeButton.type = "button";
  heading.append(title, closeButton);
  const privacy = element(
    "p",
    "Queries stay on this device and are not saved. Once loaded, search works offline for the rest of this page session.",
    "fine",
  );
  privacy.id = `${id}-privacy`;
  const label = element("label", "Words, symbols, or a laboratory ID");
  label.htmlFor = `${id}-query`;
  const input = element("input");
  input.id = `${id}-query`;
  input.type = "search";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.maxLength = SEARCH_LIMITS.queryCharacters;
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-haspopup", "listbox");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", `${id}-results`);
  const filters = element("div", undefined, "search-filters");
  const paperLabel = element("label", "Paper or collection");
  const paper = element("select");
  paperLabel.htmlFor = `${id}-paper`;
  paper.id = `${id}-paper`;
  const allPapers = element("option", "All papers and foundations");
  allPapers.value = "";
  paper.append(allPapers);
  const typeLabel = element("label", "Result type");
  const type = element("select");
  type.id = `${id}-type`;
  typeLabel.htmlFor = type.id;
  const allTypes = element("option", "All result types");
  allTypes.value = "";
  type.append(allTypes);
  for (const kind of SEARCH_TYPES) {
    const option = element("option", TYPE_LABELS[kind]);
    option.value = kind;
    type.append(option);
  }
  paperLabel.append(paper);
  typeLabel.append(type);
  filters.append(paperLabel, typeLabel);
  paper.disabled = type.disabled = true;
  const status = element("p", "Loading the search index…", "search-status fine");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");
  const results = element("div", undefined, "search-results");
  results.id = `${id}-results`;
  results.setAttribute("role", "listbox");
  results.setAttribute("aria-label", "Search results");
  const retry = element("button", "Retry loading search", "secondary");
  retry.type = "button";
  retry.hidden = true;
  const browse = element("a", "Browse the papers and outlines instead");
  browse.href = "/papers/";
  const help = element(
    "p",
    "Use Up and Down to select a result, Enter to open it, or Escape to return to your reading.",
    "fine",
  );
  dialog.append(heading, privacy, label, input, filters, status, results, retry, help, browse);

  function close() {
    if (closed) return;
    closed = true;
    if (timer !== undefined) clearTimeout(timer);
    listeners.abort();
    resultListeners.abort();
    if (dialog.open) dialog.close();
    dialog.remove();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
      previousFocus.focus({ preventScroll: true });
    options.onClose?.();
  }
  function select(index: number, scroll = false) {
    active = hits.length ? Math.max(0, Math.min(index, hits.length - 1)) : -1;
    optionNodes.forEach((node, i) => {
      node.setAttribute("aria-selected", String(i === active));
    });
    const node = optionNodes[active];
    if (node) {
      input.setAttribute("aria-activedescendant", node.id);
      if (scroll) node.scrollIntoView({ block: "nearest" });
    } else input.removeAttribute("aria-activedescendant");
  }
  function clearResults() {
    resultListeners.abort();
    resultListeners = new AbortController();
    hits = [];
    optionNodes = [];
    active = -1;
    results.replaceChildren();
    input.removeAttribute("aria-activedescendant");
    input.setAttribute("aria-expanded", "false");
  }
  function openResult(hit: SearchHit) {
    const href = searchResultHref(hit.document);
    close();
    navigate(href);
  }
  function search() {
    if (closed || !loaded) return;
    clearResults();
    if (!input.value.trim()) {
      status.textContent = loaded.engine.size
        ? `${loaded.engine.size} entries available. Try “clocks disagree”, “BM-06”, or “mean square”.`
        : "This release profile has no searchable published records yet. Browse the papers for their availability.";
      return;
    }
    const found = loaded.engine.search(input.value, {
      ...(paper.value ? { paper: paper.value } : {}),
      ...(type.value ? { type: type.value as SearchType } : {}),
      limit: SEARCH_LIMITS.results,
    });
    const groups = new Map<SearchType, SearchHit[]>();
    for (const hit of found)
      groups.set(hit.document.type, [...(groups.get(hit.document.type) ?? []), hit]);
    hits = [...groups.values()].flat();
    let index = 0;
    for (const [kind, groupHits] of groups) {
      const group = element("div", undefined, "search-group");
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", TYPE_LABELS[kind]);
      const groupLabel = element("p", TYPE_LABELS[kind], "eyebrow");
      groupLabel.setAttribute("aria-hidden", "true");
      group.append(groupLabel);
      for (const hit of groupHits) {
        const optionIndex = index++;
        const option = element("a", undefined, "search-option");
        option.id = `${id}-option-${optionIndex}`;
        option.href = searchResultHref(hit.document);
        option.tabIndex = -1;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        option.append(
          element("strong", hit.document.title),
          element(
            "span",
            `${hit.document.scopeLabel} · ${hit.document.lang}${hit.aliasLabel ? ` · ${hit.aliasLabel}` : ""}`,
            "fine",
          ),
          element("span", hit.snippet, "search-snippet"),
        );
        option.addEventListener(
          "mousedown",
          (event) => {
            if (event.button === 0) event.preventDefault();
          },
          { signal: resultListeners.signal },
        );
        option.addEventListener(
          "click",
          (event) => {
            if (
              event.button !== 0 ||
              event.ctrlKey ||
              event.metaKey ||
              event.altKey ||
              event.shiftKey
            )
              return;
            event.preventDefault();
            openResult(hit);
          },
          { signal: resultListeners.signal },
        );
        group.append(option);
        optionNodes.push(option);
      }
      results.append(group);
    }
    input.setAttribute("aria-expanded", String(hits.length > 0));
    select(0);
    status.textContent = hits.length
      ? `${hits.length} result${hits.length === 1 ? "" : "s"} shown${hits.length === SEARCH_LIMITS.results ? "; narrow the search for more specific matches" : ""}.`
      : "No matching entries in this build. Try fewer words, a symbol, or a laboratory ID.";
  }
  function scheduleSearch() {
    if (timer !== undefined) clearTimeout(timer);
    // Stale results must not remain selectable while the reader edits their query.
    clearResults();
    if (loaded) status.textContent = "";
    timer = setTimeout(search, 180);
  }
  async function load() {
    retry.hidden = true;
    status.textContent = "Loading the search index…";
    try {
      const result = await (options.load ?? (() => searchIndexLoader.load()))();
      if (closed) return;
      loaded = result;
      paper.replaceChildren(allPapers);
      for (const name of result.papers) {
        const option = element(
          "option",
          name === "cross-paper" ? "Foundations across papers" : name.replaceAll("-", " "),
        );
        option.value = name;
        paper.append(option);
      }
      paper.disabled = type.disabled = false;
      search();
    } catch {
      if (closed) return;
      status.textContent =
        "Search could not load a complete, verified index. Your reading is unchanged; retry or browse the outlines.";
      retry.hidden = false;
    }
  }
  closeButton.addEventListener("click", close, events);
  dialog.addEventListener(
    "cancel",
    (event) => {
      event.preventDefault();
      close();
    },
    events,
  );
  dialog.addEventListener(
    "keydown",
    (event) => {
      // A search input may consume native Escape to clear its text. One Escape must
      // still close the palette and restore the interrupted reading focus.
      if (event.key === "Escape" && !event.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    },
    events,
  );
  dialog.addEventListener("close", close, events);
  dialog.addEventListener(
    "click",
    (event) => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      )
        close();
    },
    events,
  );
  input.addEventListener("input", scheduleSearch, events);
  paper.addEventListener("change", scheduleSearch, events);
  type.addEventListener("change", scheduleSearch, events);
  retry.addEventListener(
    "click",
    () => {
      void load();
    },
    events,
  );
  input.addEventListener(
    "keydown",
    (event) => {
      if (event.isComposing) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        select(active + (event.key === "ArrowDown" ? 1 : -1), true);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const hit = hits[active];
        if (hit) openResult(hit);
      }
    },
    events,
  );
  document.body.append(dialog);
  try {
    dialog.showModal();
    input.focus();
    void load();
  } catch (error) {
    close();
    throw error;
  }
  return close;
}
