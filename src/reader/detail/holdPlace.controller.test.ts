/**
 * The reader stays on their passage through a Detail change and while a whole-paper page's steps
 * load (am-read-detail-axis-sfc criteria 9 and 14), with ReaderController mounted. The test DOM has
 * no layout, so a small one is modelled: passages stack in document order, a passage whose steps
 * are shut is 850px (its full explanation), an open one is 150px plus 40 for the placeholder link
 * or 1,300 once its steps have arrived. window.scrollBy moves the page.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { ReaderController } from "../ReaderController.tsx";
import { forgetStepsPages } from "../stepsBody.ts";

const IDS = ["arg-a", "arg-b", "arg-c"] as const;
const REGISTRY = Object.freeze({
  paperId: "mass-energy",
  anchors: Object.freeze([...IDS]),
  foundations: Object.freeze([]),
});

let reactRoot: Root | null = null;
let scrollY = 0;
let restoreRect: (() => void) | null = null;

function heightOf(article: Element): number {
  const steps = article.querySelector<HTMLDetailsElement>('details[data-reading="2"]');
  if (!steps?.open) return 850;
  return 150 + (steps.querySelector("[data-steps-body]") ? 40 : 1_300);
}

function installLayout() {
  const original = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this.tagName !== "ARTICLE") return original.call(this);
    let at = 0;
    for (const article of document.querySelectorAll("article.reader-passage")) {
      if (article === this) break;
      at += heightOf(article);
    }
    const top = at - scrollY;
    const height = heightOf(this);
    return { top, bottom: top + height, height } as DOMRect;
  };
  restoreRect = () => {
    Element.prototype.getBoundingClientRect = original;
  };
  window.scrollBy = ((options: ScrollToOptions) => {
    scrollY += options.top ?? 0;
  }) as typeof window.scrollBy;
  Object.defineProperty(window, "innerHeight", { value: 900, configurable: true });
}

beforeEach(async () => {
  await installDom();
  scrollY = 0;
  forgetStepsPages();
  try {
    localStorage.clear();
  } catch {
    /* storage may be blocked */
  }
  installLayout();
});
afterEach(async () => {
  await act(async () => reactRoot?.unmount());
  reactRoot = null;
  restoreRect?.();
  restoreRect = null;
  await uninstallDom();
});

const inline = (id: string) => `
  <article id="${id}" data-unit="${id}" class="reader-passage">
    <h3>${id}</h3>
    <details class="local-steps reading-version" data-reading="2"><summary>Show every step here: ${id}</summary><p>Steps of ${id}.</p></details>
  </article>`;

const deferred = (id: string) => `
  <article id="${id}" data-unit="${id}" class="reader-passage">
    <h3>${id}</h3>
    <details class="local-steps reading-version" data-reading="2"><summary>Show every step here: ${id}</summary><p class="fine" data-steps-body="${id}" data-steps-src="/papers/mass-energy/s0/"><a href="/papers/mass-energy/s0/#${id}">Read every step on this section's own page</a></p></details>
  </article>`;

async function mount(passages: string) {
  const root = document.createElement("div");
  root.setAttribute("data-reader-root", "");
  root.innerHTML = `
    <dialog data-clarification-dialog></dialog>
    <p data-reader-announcement></p>
    ${passages}`;
  document.body.append(root);
  const container = document.createElement("div");
  root.prepend(container);
  reactRoot = createRoot(container);
  await act(async () => {
    reactRoot?.render(
      createElement(ReaderController, { registry: REGISTRY, titles: {}, questions: {} }),
    );
  });
  return root;
}

const topOf = (id: string) =>
  Math.round(document.getElementById(id)?.getBoundingClientRect().top ?? NaN);

describe("a Detail change keeps the reader's passage", () => {
  test("at Show every step and back, the passage at the reading line stays where it stood", async () => {
    const root = await mount(IDS.map(inline).join(""));
    // The reader is at the top of arg-c, with the last 69px of arg-b above it.
    scrollY = 2 * 850 - 69;
    expect(topOf("arg-c")).toBe(69);

    const select = root.querySelector<HTMLSelectElement>("[data-detail-control]");
    expect(select).not.toBeNull();
    for (const value of ["2", "1"]) {
      await act(async () => {
        if (!select) return;
        select.disabled = false;
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(document.documentElement.dataset.detail).toBe(value);
      expect(topOf("arg-c")).toBe(69);
    }
    // The browser's own anchoring is back once the page is left alone.
    window.dispatchEvent(new Event("wheel"));
    expect(document.documentElement.style.overflowAnchor).toBe("");
  });
});

describe("arriving at a passage while the steps above it load", () => {
  test("?detail=2#arg-c puts arg-c at the top and keeps it there as each passage's steps land", async () => {
    const sectionPage = `<!doctype html><html><body>${IDS.map(inline).join("")}</body></html>`;
    const originalFetch = globalThis.fetch;
    let release: () => void = () => {};
    const arrived = new Promise<void>((resolve) => {
      release = resolve;
    });
    globalThis.fetch = (async () => {
      await arrived;
      return new Response(sectionPage, { status: 200 });
    }) as unknown as typeof fetch;
    try {
      window.history.replaceState(null, "", "/papers/mass-energy/?detail=2#arg-c");
      const root = await mount(IDS.map(deferred).join(""));
      // The page's own openings fire `toggle`, as a browser does.
      await act(async () => {
        for (const d of root.querySelectorAll("details")) d.dispatchEvent(new Event("toggle"));
      });
      expect(topOf("arg-c")).toBe(0);
      await act(async () => {
        release();
        for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
      });
      const loaded = [...root.querySelectorAll<HTMLElement>("details")].map(
        (d) => d.dataset.stepsState,
      );
      expect(loaded).toEqual(["loaded", "loaded", "loaded"]);
      expect(topOf("arg-c")).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
