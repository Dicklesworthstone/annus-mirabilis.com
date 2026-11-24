import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { createContainer, installDom, removeContainer, uninstallDom } from "../testing/reactDom.ts";
import { createSearchEngine, SEARCH_LIMITS, type SearchDocument } from "./core.ts";
import type { LoadedSearch } from "./loadIndex.ts";
import { SearchResults } from "./SearchResults.tsx";
import { readSearchLocation, searchResultsHref } from "./searchLocation.ts";

// Authored fixture passages, not historical quotations or supplied engine answers.
const base: SearchDocument = {
  id: "mean",
  title: "Mean square displacement",
  text: "Mean square displacement reveals diffusion.",
  type: "argument",
  paper: "brownian-motion",
  section: "s5",
  lang: "en",
  terms: [],
  route: "/papers/brownian-motion/",
  anchor: "mean",
  face: "reading",
  scopeLabel: "Test passage",
};
const loaded: LoadedSearch = {
  engine: createSearchEngine([
    base,
    {
      ...base,
      id: "clock",
      title: "Clock synchronization",
      text: "Clock synchronization.",
      anchor: "clock",
    },
    { ...base, id: "other-paper", paper: "light-quanta" },
    { ...base, id: "other-type", type: "equation" },
  ]),
  papers: ["brownian-motion", "light-quanta"],
  buildDigest: "test-build",
  profile: "preview",
};

const pagedDocuments: readonly SearchDocument[] = Array.from(
  { length: SEARCH_LIMITS.results * 2 + 7 },
  (_, index) => ({
    ...base,
    id: "match-" + String(index).padStart(3, "0"),
    anchor: "match-" + String(index).padStart(3, "0"),
    title: "Diffusion example " + String(index).padStart(3, "0"),
    type: index % 2 === 0 ? "equation" : "argument",
  }),
);
const pagedSearch: LoadedSearch = {
  ...loaded,
  engine: createSearchEngine([
    ...pagedDocuments,
    { ...base, id: "only-clock", anchor: "only-clock", title: "Clock synchronization", text: "Clocks." },
  ]),
};

function deferred() {
  let resolve!: (value: LoadedSearch) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<LoadedSearch>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("full-page search", () => {
  let host: HTMLElement;
  let root: Root | undefined;
  beforeEach(async () => {
    await installDom();
    window.history.replaceState(null, "", "/search/results/");
    host = createContainer();
  });
  afterEach(async () => {
    await act(async () => root?.unmount());
    root = undefined;
    removeContainer(host);
    await uninstallDom();
  });
  async function mount(load: () => Promise<LoadedSearch>) {
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(SearchResults, { load }));
    });
  }
  async function restore(query: string, paper = "", type = "") {
    const href = searchResultsHref({ query, paper, type: type as "" | "argument" });
    if (!href) throw new Error("Test search link must be valid");
    // Do NOT add `window.dispatchEvent(new Event("hashchange"))` here. happy-dom emits its own
    // hashchange for a replaceState that changes the fragment, and it emits it ASYNCHRONOUSLY,
    // through its internal task queue rather than through window.dispatchEvent. A manual dispatch
    // beside it is therefore a second event, not the only one, and the component's listener runs
    // twice per restore. That is what made the two tests below fail from the commit that added
    // them: the index loaded three times where the test counted two, and the manual dispatch
    // arrived before mount (reaching nothing) while happy-dom's own arrived after (reaching the
    // listener), so the duplicate was invisible in the ordering. Awaiting waitUntilComplete inside
    // act drains that queue while React is still watching, so one restore delivers one hashchange.
    await act(async () => {
      window.history.replaceState(null, "", href);
      await (
        globalThis as { happyDOM?: { waitUntilComplete(): Promise<void> } }
      ).happyDOM?.waitUntilComplete();
    });
  }
  const titles = () =>
    [...host.querySelectorAll(".full-search-results h2")].map((n) => n.textContent);

  test("server HTML has a labeled form without controls that submit the query to a server", () => {
    let calls = 0;
    host.innerHTML = renderToString(
      createElement(SearchResults, {
        load: async () => {
          calls++;
          return loaded;
        },
      }),
    );
    expect(calls).toBe(0);
    expect(host.querySelector('form[role="search"]')).not.toBeNull();
    expect(host.querySelectorAll("input[name], select[name]").length).toBe(0);
    expect(host.querySelector('label[for="edition-search-query"]')).not.toBeNull();
    expect(host.querySelector('a[href*="#q="]')).toBeNull();
  });

  test("a shared quoted search restores both filters and links to the real source face", async () => {
    await restore('"mean square"', "brownian-motion", "argument");
    await mount(async () => loaded);
    expect(titles()).toEqual(["Mean square displacement"]);
    const link = host.querySelector<HTMLAnchorElement>(".full-search-results a");
    expect(link?.getAttribute("href")).toBe("/papers/brownian-motion/?view=reading#mean");
    const share = host.querySelector<HTMLAnchorElement>('a[href^="/search/results/#"]');
    expect(share).not.toBeNull();
    const url = new URL(share?.href ?? "");
    expect(url.search).toBe("");
    expect(readSearchLocation(url.hash)).toEqual({
      query: '"mean square"',
      paper: "brownian-motion",
      type: "argument",
    });
  });

  test("a superseded load cannot overwrite results from a newer shared search", async () => {
    const first = deferred();
    const second = deferred();
    let calls = 0;
    await restore("diffusion");
    await mount(() => (++calls === 1 ? first.promise : second.promise));
    await restore("clock");
    expect(calls).toBe(2);
    await act(async () => second.resolve(loaded));
    expect(titles()).toEqual(["Clock synchronization"]);
    await act(async () => first.resolve(loaded));
    expect(titles()).toEqual(["Clock synchronization"]);
  });

  test("editing a filter invalidates pending results and removes stale share links", async () => {
    const pending = deferred();
    await restore("diffusion");
    await mount(() => pending.promise);
    const select = host.querySelector<HTMLSelectElement>("#edition-search-type");
    expect(select).not.toBeNull();
    await act(async () => {
      if (!select) throw new Error("Missing result-type control");
      select.value = "equation";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => pending.resolve(loaded));
    expect(titles()).toEqual([]);
    expect(host.querySelector('a[href^="/search/results/#"]')).toBeNull();
    expect(host.querySelector('[role="status"]')?.textContent).toContain("then choose Search");
  });

  test("index failure remains retryable through the same form", async () => {
    let calls = 0;
    await restore("clock");
    await mount(async () => {
      if (++calls === 1) throw new Error("Network unavailable");
      return loaded;
    });
    expect(host.querySelector('[role="status"]')?.textContent).toContain("could not load");
    await act(async () => {
      const form = host.querySelector("form");
      if (!form) throw new Error("Missing search form");
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(calls).toBe(2);
    expect(titles()).toEqual(["Clock synchronization"]);
  });

  test("an invalid shared filter is refused before loading any index", async () => {
    window.history.replaceState(null, "", "/search/results/#q=light&type=secret");
    let calls = 0;
    await mount(async () => {
      calls++;
      return loaded;
    });
    expect(calls).toBe(0);
    expect(titles()).toEqual([]);
    expect(host.querySelector('[role="status"]')?.textContent).toContain("link is invalid");
  });

  test("a valid but unknown collection is not silently broadened, and can be cleared", async () => {
    await restore("clock", "missing-collection");
    await mount(async () => loaded);
    expect(titles()).toEqual([]);
    expect(host.querySelector<HTMLSelectElement>("#edition-search-paper")?.value).toBe(
      "missing-collection",
    );
    const clear = host.querySelector<HTMLButtonElement>('button[type="button"]');
    expect(clear).not.toBeNull();
    await act(async () => clear?.click());
    expect(titles()).toEqual(["Clock synchronization"]);
  });
  function pagingButton(label: string): HTMLButtonElement {
    const button = [
      ...host.querySelectorAll<HTMLButtonElement>('nav[aria-label="Search result pages"] button'),
    ].find((candidate) => candidate.textContent?.trim() === label);
    if (!button) throw new Error("Missing pagination button: " + label);
    return button;
  }

  test("every result can be reached in bounded pages without fetching again or changing the URL", async () => {
    let loads = 0;
    await restore("diffusion");
    await mount(async () => {
      loads++;
      return pagedSearch;
    });
    const href = window.location.href;
    const historyLength = window.history.length;
    const pageSize = SEARCH_LIMITS.results;
    const first = titles();
    expect(first).toEqual(pagedDocuments.slice(0, pageSize).map((entry) => entry.title));
    expect(pagingButton("Previous results").disabled).toBe(true);
    expect(host.querySelector('[role="status"]')?.textContent).toContain(
      String(pagedDocuments.length) + " results.",
    );

    await act(async () => pagingButton("Next results").click());
    const second = titles();
    expect(second).toEqual(pagedDocuments.slice(pageSize, pageSize * 2).map((entry) => entry.title));
    expect(host.querySelector("ol.full-search-results")?.getAttribute("start")).toBe(String(pageSize + 1));
    expect(document.activeElement).toBe(host.querySelector('[role="status"]'));
    const share = host.querySelector<HTMLAnchorElement>('a[href^="/search/results/#"]');
    expect(readSearchLocation(new URL(share?.href ?? "").hash)).toEqual({
      query: "diffusion", paper: "", type: "",
    });
    expect(share?.parentElement?.textContent).toContain("Opens at the first result page.");

    await act(async () => pagingButton("Next results").click());
    const last = titles();
    expect([...first, ...second, ...last]).toEqual(pagedDocuments.map((entry) => entry.title));
    expect(pagingButton("Next results").disabled).toBe(true);
    expect(host.querySelectorAll(".full-search-results > li").length).toBeLessThanOrEqual(pageSize);
    await act(async () => pagingButton("Previous results").click());
    expect(titles()).toEqual(second);
    await act(async () => pagingButton("Previous results").click());
    expect(titles()).toEqual(first);
    expect(loads).toBe(1);
    expect(window.location.href).toBe(href);
    expect(window.history.length).toBe(historyLength);
  });

  test("editing a filter and restoring another query reset the page and discard previous navigation", async () => {
    await restore("diffusion");
    await mount(async () => pagedSearch);
    await act(async () => pagingButton("Next results").click());
    const select = host.querySelector<HTMLSelectElement>("#edition-search-type");
    if (!select) throw new Error("Missing result-type control");
    await act(async () => {
      select.value = "equation";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(titles()).toEqual([]);
    expect(host.querySelector('nav[aria-label="Search result pages"]')).toBeNull();
    expect(host.querySelector('a[href^="/search/results/#"]')).toBeNull();
    await act(async () => {
      const form = host.querySelector("form");
      if (!form) throw new Error("Missing search form");
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(titles()).toEqual(
      pagedDocuments.filter((entry) => entry.type === "equation")
        .slice(0, SEARCH_LIMITS.results).map((entry) => entry.title),
    );
    expect(host.querySelector("ol.full-search-results")?.getAttribute("start")).toBe("1");
    expect(pagingButton("Previous results").disabled).toBe(true);

    await restore("clock");
    expect(titles()).toEqual(["Clock synchronization"]);
    expect(host.querySelector('nav[aria-label="Search result pages"]')).toBeNull();
    expect(host.querySelector("ol.full-search-results")?.getAttribute("start")).toBe("1");
  });

});
