/**
 * am-read-shell-routes-3ua. Direct assertions on the two behaviours the
 * donor's viewModeFromSearch/applyPatentViewToUrl got right and a naive
 * "?view=english renders the English face" test would never catch: a face
 * change pushes exactly one history entry, and it preserves every other
 * query key and the hash. ReaderController.tsx's url() is the real call
 * site; it used to build the next URL from src/reader/navigation/state.ts's
 * readerHref/passageHref, which construct a fresh URLSearchParams from only
 * {view, detail, lens, open} and never read the current location at all --
 * silently dropping any other query key. url() now starts from the real
 * current location.href and only sets/deletes the specific keys it tracks.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { ReaderController } from "../reader/ReaderController.tsx";
import { registerDefaultClarificationKinds } from "../reader/stack/kinds.ts";
import { installDom, uninstallDom } from "./reactDom.ts";

beforeEach(async () => {
  await installDom();
  registerDefaultClarificationKinds();
});
afterEach(uninstallDom);

const REGISTRY = Object.freeze({
  paperId: "brownian-motion",
  anchors: Object.freeze(["s1"]),
  foundations: Object.freeze([]),
});

function buildPageDom(): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-reader-root", "");
  root.innerHTML = `
    <dialog data-clarification-dialog></dialog>
    <p data-reader-announcement></p>
    <p data-compass-question></p>
    <p data-compass-idea></p>
    <label data-copy-fallback hidden><input /></label>
    <a data-view-link="reading" href="?view=reading">Reading</a>
    <a data-view-link="results" href="?view=results">Results</a>
    <a data-view-link="german" href="?view=german">German</a>
    <p id="s1">The passage.</p>
  `;
  document.body.appendChild(root);
  return root;
}

async function mount() {
  const pageRoot = buildPageDom();
  const container = document.createElement("div");
  pageRoot.prepend(container);
  const reactRoot = createRoot(container);
  await act(async () => {
    reactRoot.render(
      createElement(ReaderController, { registry: REGISTRY, titles: {}, questions: {} }),
    );
  });
  return { pageRoot, reactRoot };
}

function clickViewLink(pageRoot: HTMLElement, view: string) {
  const link = pageRoot.querySelector<HTMLElement>(`[data-view-link="${view}"]`);
  if (!link) throw new Error(`No view link for '${view}' in the test DOM.`);
  link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
}

describe("view-switch history: exactly one entry per real change", () => {
  test("switching faces twice grows history by exactly two entries", async () => {
    window.history.pushState(null, "", "/papers/brownian-motion/#s1");
    const before = window.history.length;
    const { pageRoot, reactRoot } = await mount();
    await act(async () => {
      clickViewLink(pageRoot, "results");
    });
    await act(async () => {
      clickViewLink(pageRoot, "german");
    });
    expect(window.history.length - before).toBe(2);
    act(() => {
      reactRoot.unmount();
    });
  });
});

describe("view-switch preservation: an existing query key and hash survive the switch", () => {
  test("an unrelated ?q= query key survives a face switch", async () => {
    window.history.pushState(null, "", "/papers/brownian-motion/?q=term#s1");
    const { pageRoot, reactRoot } = await mount();
    await act(async () => {
      clickViewLink(pageRoot, "results");
    });
    const params = new URL(location.href).searchParams;
    expect(params.get("q")).toBe("term");
    expect(params.get("view")).toBe("results");
    act(() => {
      reactRoot.unmount();
    });
  });

  test("switching faces twice still preserves the unrelated query key both times", async () => {
    window.history.pushState(null, "", "/papers/brownian-motion/?q=term#s1");
    const { pageRoot, reactRoot } = await mount();
    await act(async () => {
      clickViewLink(pageRoot, "results");
    });
    expect(new URL(location.href).searchParams.get("q")).toBe("term");
    await act(async () => {
      clickViewLink(pageRoot, "german");
    });
    const params = new URL(location.href).searchParams;
    expect(params.get("q")).toBe("term");
    expect(params.get("view")).toBe("german");
    act(() => {
      reactRoot.unmount();
    });
  });

  test("the hash survives a face switch when it already equals the tracked anchor", async () => {
    window.history.pushState(null, "", "/papers/brownian-motion/#s1");
    const { pageRoot, reactRoot } = await mount();
    await act(async () => {
      clickViewLink(pageRoot, "results");
    });
    expect(location.hash).toBe("#s1");
    act(() => {
      reactRoot.unmount();
    });
  });

  /*
    A fragment the reader never followed must not be invented. The site-wide fragment handler
    (search/launcher.ts) focuses whatever the fragment names, so an invented #<first passage>
    put the 3px focus ring round the first passage of every paper on load.
  */
  test("a page opened without a fragment is not given one, on mount or on a face switch", async () => {
    window.history.pushState(null, "", "/papers/brownian-motion/");
    const { pageRoot, reactRoot } = await mount();
    expect(location.hash).toBe("");
    await act(async () => {
      clickViewLink(pageRoot, "results");
    });
    expect(location.hash).toBe("");
    expect(new URL(location.href).searchParams.get("view")).toBe("results");
    act(() => {
      reactRoot.unmount();
    });
  });

  test("choosing a passage names it in the address", async () => {
    window.history.pushState(null, "", "/papers/brownian-motion/");
    const { pageRoot, reactRoot } = await mount();
    const link = document.createElement("a");
    link.setAttribute("data-reader-anchor", "s1");
    link.setAttribute("href", "#s1");
    pageRoot.appendChild(link);
    await act(async () => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });
    expect(location.hash).toBe("#s1");
    act(() => {
      reactRoot.unmount();
    });
  });

  test("switching back to the default 'reading' face removes ?view= rather than writing the fallback back", async () => {
    window.history.pushState(null, "", "/papers/brownian-motion/?q=term&view=results#s1");
    const { pageRoot, reactRoot } = await mount();
    await act(async () => {
      clickViewLink(pageRoot, "reading");
    });
    const params = new URL(location.href).searchParams;
    expect(params.has("view")).toBe(false);
    expect(params.get("q")).toBe("term");
    act(() => {
      reactRoot.unmount();
    });
  });
});
