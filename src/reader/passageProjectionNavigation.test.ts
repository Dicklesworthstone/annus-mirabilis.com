import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { FACE_SWITCH_PLACE_KEY } from "./anchors/faceSwitchPlace.ts";
import { createPlaceHold } from "./holdPlace.ts";
import {
  mountPassageProjectionNavigation,
  pendingPassageProjectionReturn,
} from "./passageProjectionNavigation.ts";

let unmount: (() => void) | undefined;
let releaseShared: (() => void) | undefined;
let scrolls: number[];
let destinations: string[];
beforeEach(async () => {
  await installDom();
  scrolls = [];
  destinations = [];
  sessionStorage.clear();
  spyOn(window.location, "assign").mockImplementation((url) => {
    destinations.push(String(url));
  });
  Object.defineProperty(window, "innerHeight", { value: 900, configurable: true });
  window.scrollBy = ((options: ScrollToOptions) =>
    scrolls.push(options.top ?? 0)) as typeof window.scrollBy;
});
afterEach(async () => {
  unmount?.();
  unmount = undefined;
  releaseShared?.();
  releaseShared = undefined;
  mock.restore();
  await uninstallDom();
});

function fixture() {
  window.history.replaceState(
    { unrelated: "kept" },
    "",
    "/papers/mass-energy/view/german/?detail=2",
  );
  const root = document.createElement("div");
  root.dataset.readerRoot = "";
  root.dataset.view = "german";
  root.innerHTML =
    '<p id="s0-p7">The body emits light.</p><details data-passage-projections="s0-p7" open><summary>Explore this passage</summary><a data-passage-projection-link href="/lab/me-01/">Experiment</a></details>';
  document.body.append(root);
  const paragraph = root.querySelector<HTMLElement>("p");
  if (!paragraph) throw new Error("fixture paragraph missing");
  paragraph.getBoundingClientRect = () => ({ top: 90, bottom: 190, height: 100 }) as DOMRect;
  const link = root.querySelector<HTMLAnchorElement>("a");
  if (!link) throw new Error("fixture link missing");
  return { root, link };
}

/** Observe our handler before cancelling the test DOM's native page navigation. */
function follow(link: HTMLAnchorElement, options: MouseEventInit = {}): boolean {
  let preventedByController: boolean | undefined;
  const observe = (event: MouseEvent) => {
    preventedByController = event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener("click", observe, { once: true });
  link.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...options }),
  );
  document.removeEventListener("click", observe);
  if (preventedByController === undefined) throw new Error("click did not reach the document");
  return preventedByController;
}

describe("returning from a passage projection", () => {
  test("records the exact source passage without intercepting or rewriting its real link", () => {
    const { root, link } = fixture();
    unmount = mountPassageProjectionNavigation(root);
    expect(follow(link)).toBe(false);
    expect(link.getAttribute("href")).toBe("/lab/me-01/");
    expect(window.location.hash).toBe("#s0-p7");
    expect(window.location.search).toBe("?detail=2");
    expect(window.history.state.unrelated).toBe("kept");
    expect(window.history.state.passageProjectionReturn).toEqual({
      path: "/papers/mass-energy/view/german/?detail=2",
      anchor: "s0-p7",
      relativeOffset: 0.1,
    });
  });

  test("reopens the disclosure and restores the passage after a full-document Back", () => {
    const { root, link } = fixture();
    unmount = mountPassageProjectionNavigation(root);
    follow(link);
    unmount();
    const disclosure = root.querySelector("details");
    if (disclosure) disclosure.open = false;
    const paragraph = root.querySelector<HTMLElement>("p");
    if (paragraph) paragraph.getBoundingClientRect = () => ({ top: 690, bottom: 790 }) as DOMRect;
    unmount = mountPassageProjectionNavigation(root);
    expect(disclosure?.open).toBe(true);
    expect(scrolls).toContain(600);
    expect(window.history.state.passageProjectionReturn).toBeUndefined();
  });

  test("an empty German footnote anchor returns to its visible body while keeping the original URL id", () => {
    const { root } = fixture();
    root.innerHTML =
      '<li class="footnote-item"><div class="footnote-body"><span id="s0-fn1" data-footnote-anchor="s0-fn1"></span>Footnote text.</div>' +
      '<details data-passage-projections="s0-fn1" open><summary>Explore this passage</summary>' +
      '<a data-passage-projection-link href="/lab/me-01/">Experiment</a></details></li>';
    const anchor = root.querySelector<HTMLElement>("#s0-fn1");
    const body = root.querySelector<HTMLElement>(".footnote-body");
    const link = root.querySelector<HTMLAnchorElement>("a");
    expect(anchor && body && link).not.toBeNull();
    if (!anchor || !body || !link) return;
    let bodyTop = 90;
    anchor.getBoundingClientRect = () =>
      ({ top: bodyTop + 20, bottom: bodyTop + 20, height: 0 }) as DOMRect;
    body.getBoundingClientRect = () =>
      ({ top: bodyTop, bottom: bodyTop + 100, height: 100 }) as DOMRect;
    unmount = mountPassageProjectionNavigation(root);
    follow(link);
    expect(window.location.hash).toBe("#s0-fn1");
    expect(window.history.state.passageProjectionReturn.relativeOffset).toBe(0.1);
    unmount();
    bodyTop = 690;
    unmount = mountPassageProjectionNavigation(root);
    expect(scrolls).toContain(600);
    expect(window.history.state.anchor).toBe("s0-fn1");
    expect(window.history.state.relativeOffset).toBe(0.1);
  });

  test("updates the explanation controller's stored anchor while preserving its other settings", () => {
    const { root, link } = fixture();
    window.history.replaceState(
      { annusReader: { index: 4, state: { anchor: "old", detail: 2, lens: true } } },
      "",
    );
    unmount = mountPassageProjectionNavigation(root);
    follow(link);
    expect(window.history.state.annusReader).toEqual({
      index: 4,
      state: { anchor: "s0-p7", detail: 2, lens: true },
    });
  });

  test("shares the reader's existing hold through return and reflow, then restores its original anchoring", () => {
    const { root } = fixture();
    const paragraph = root.querySelector<HTMLElement>("p");
    expect(paragraph).not.toBeNull();
    if (!paragraph) return;
    let at = 900;
    let scrollY = 0;
    paragraph.getBoundingClientRect = () =>
      ({ top: at - scrollY, bottom: at - scrollY + 100, height: 100 }) as DOMRect;
    window.scrollBy = ((options: ScrollToOptions) => {
      scrollY += options.top ?? 0;
    }) as typeof window.scrollBy;
    const observed: (() => void)[] = [];
    class Observer {
      constructor(callback: () => void) {
        observed.push(callback);
      }
      observe() {}
      disconnect() {}
    }
    Object.defineProperty(window, "ResizeObserver", { value: Observer, configurable: true });
    document.documentElement.style.overflowAnchor = "auto";
    const shared = createPlaceHold(root);
    releaseShared = () => shared.release();
    // ReaderController's initial fragment landing precedes the projection's return.
    shared.hold({ passage: paragraph, top: 16 });
    window.history.replaceState(
      {
        passageProjectionReturn: {
          path: window.location.pathname + window.location.search,
          anchor: paragraph.id,
          relativeOffset: 0.1,
        },
      },
      "",
      "#s0-p7",
    );
    unmount = mountPassageProjectionNavigation(root, window, { hold: shared });
    expect(observed).toHaveLength(1);
    expect(paragraph.getBoundingClientRect().top).toBe(90);
    at += 600; // The steps above the return passage arrive.
    observed[0]?.();
    expect(paragraph.getBoundingClientRect().top).toBe(90);
    unmount();
    expect(shared.active()).toBe(true); // The reader, not this listener, owns its lifetime.
    shared.release();
    expect(document.documentElement.style.overflowAnchor).toBe("auto");
  });

  test("consuming a return also repairs stale compatible fields for the source-face history owner", () => {
    const { root } = fixture();
    window.history.replaceState(
      {
        unrelated: "kept",
        face: "german",
        anchor: "stale-sentence",
        relativeOffset: 0.3,
        passageProjectionReturn: {
          path: window.location.pathname + window.location.search,
          anchor: "s0-p7",
          relativeOffset: 0.1,
        },
      },
      "",
      "#s0-p7",
    );
    unmount = mountPassageProjectionNavigation(root);
    expect(window.history.state).toEqual({
      unrelated: "kept",
      face: "german",
      anchor: "s0-p7",
      relativeOffset: 0.1,
    });
  });

  test("modified clicks, external links and missing anchors leave the current history alone", () => {
    const { root, link } = fixture();
    unmount = mountPassageProjectionNavigation(root);
    follow(link, { ctrlKey: true });
    expect(window.history.state).toEqual({ unrelated: "kept" });
    link.href = "https://example.org/";
    follow(link);
    expect(window.history.state).toEqual({ unrelated: "kept" });
    link.href = "/lab/me-01/";
    root.querySelector("details")?.setAttribute("data-passage-projections", "missing");
    follow(link);
    expect(window.history.state).toEqual({ unrelated: "kept" });
  });

  test("a same-document projection synchronizes the reader but leaves native navigation and history alone", () => {
    const { root, link } = fixture();
    link.href = `${window.location.pathname}${window.location.search}#s0-p7`;
    const href = link.getAttribute("href");
    const departed: string[] = [];
    unmount = mountPassageProjectionNavigation(root, window, {
      onDeparture: (anchor) => departed.push(anchor),
    });
    expect(follow(link)).toBe(false);
    expect(departed).toEqual(["s0-p7"]);
    expect(link.getAttribute("href")).toBe(href);
    expect(window.history.state).toEqual({ unrelated: "kept" });
    expect(pendingPassageProjectionReturn(root)).toBeNull();
  });

  test("does not restore a malformed or another page's history record", () => {
    const { root } = fixture();
    for (const record of [
      { path: "/elsewhere/", anchor: "s0-p7", relativeOffset: 0.1 },
      {
        path: window.location.pathname + window.location.search,
        anchor: "s0-p7",
        relativeOffset: Infinity,
      },
      {
        path: window.location.pathname + window.location.search,
        anchor: "missing",
        relativeOffset: 0.1,
      },
    ]) {
      window.history.replaceState({ passageProjectionReturn: record }, "");
      const stop = mountPassageProjectionNavigation(root);
      stop();
    }
    expect(scrolls).toEqual([]);
  });
});

function readingResultsFixture(anchor = "arg-sr-charge-current") {
  window.history.replaceState(
    {
      unrelated: "kept",
      annusReader: { index: 4, state: { anchor, detail: 2, lens: true } },
    },
    "",
    "/papers/special-relativity/?detail=2&lens=modern#" + anchor,
  );
  const root = document.createElement("div");
  root.dataset.readerRoot = "";
  root.dataset.view = "reading";
  root.innerHTML =
    '<a data-reader-face-link="results" ' +
    'href="/papers/special-relativity/view/results/">Results</a>' +
    '<section id="s9" class="reader-section">' +
    '<article id="arg-sr-charge-current" class="reader-passage">' +
    '<p id="s9-p2-s1">Charge and current transform together.</p></article></section>';
  document.body.append(root);
  const link = root.querySelector<HTMLAnchorElement>("a");
  if (!link) throw new Error("results fixture is missing its face link");
  let top = 90;
  for (const element of root.querySelectorAll<HTMLElement>("[id]")) {
    element.getBoundingClientRect = () => ({ top, bottom: top + 100, height: 100 }) as DOMRect;
  }
  return {
    root,
    link,
    grow() {
      top = 690;
    },
  };
}

describe("Explanation to Results preserves the section and exact return", () => {
  test("a deep argument reaches Results and Back restores its exact viewport", () => {
    const { root, link, grow } = readingResultsFixture();
    const href = link.getAttribute("href");
    const origin = window.location.href;
    unmount = mountPassageProjectionNavigation(root);
    sessionStorage.setItem(FACE_SWITCH_PLACE_KEY, "an earlier face transfer");
    expect(follow(link)).toBe(true);
    expect(destinations).toEqual(["http://localhost/papers/special-relativity/view/results/#s9"]);
    expect(link.getAttribute("href")).toBe(href);
    expect(window.location.href).toBe(origin);
    expect(window.history.state.annusReader).toEqual({
      index: 4,
      state: { anchor: "arg-sr-charge-current", detail: 2, lens: true },
    });
    expect(pendingPassageProjectionReturn(root)).toEqual({
      path: "/papers/special-relativity/?detail=2&lens=modern",
      anchor: "arg-sr-charge-current",
      relativeOffset: 0.1,
    });
    expect(sessionStorage.getItem(FACE_SWITCH_PLACE_KEY)).toBeNull();

    unmount();
    grow();
    unmount = mountPassageProjectionNavigation(root);
    expect(scrolls).toContain(600);
    expect(window.location.href).toBe(origin);
    expect(window.history.state.anchor).toBe("arg-sr-charge-current");
    expect(window.history.state.relativeOffset).toBe(0.1);
    expect(window.history.state.passageProjectionReturn).toBeUndefined();
    expect(window.history.state.unrelated).toBe("kept");
  });

  for (const anchor of ["s9", "s9-p2-s1"]) {
    test(anchor + " retains its exact origin while Results receives its section", () => {
      const { root, link } = readingResultsFixture(anchor);
      unmount = mountPassageProjectionNavigation(root);
      expect(follow(link)).toBe(true);
      expect(destinations).toEqual(["http://localhost/papers/special-relativity/view/results/#s9"]);
      expect(window.location.hash).toBe("#" + anchor);
      expect(pendingPassageProjectionReturn(root)?.anchor).toBe(anchor);
    });
  }

  test("modified clicks, new tabs and downloads preserve native navigation and history", () => {
    const { root, link } = readingResultsFixture();
    const state = window.history.state;
    unmount = mountPassageProjectionNavigation(root);
    for (const options of [
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
    ]) {
      expect(follow(link, options)).toBe(false);
    }
    link.target = "_blank";
    expect(follow(link)).toBe(false);
    link.target = "";
    link.download = "results.html";
    expect(follow(link)).toBe(false);
    expect(destinations).toEqual([]);
    expect(window.history.state).toEqual(state);
    expect(link.getAttribute("href")).toBe("/papers/special-relativity/view/results/");
  });

  test("foreign routes, unknown anchors and source faces keep native navigation", () => {
    const { root, link } = readingResultsFixture();
    const state = window.history.state;
    unmount = mountPassageProjectionNavigation(root);
    for (const href of [
      "/papers/brownian-motion/view/results/",
      "https://example.org/papers/special-relativity/view/results/",
    ]) {
      link.href = href;
      expect(follow(link)).toBe(false);
    }
    link.href = "/papers/special-relativity/view/results/";
    root.dataset.view = "german";
    expect(follow(link)).toBe(false);
    root.dataset.view = "reading";
    window.history.replaceState(state, "", "#missing");
    expect(follow(link)).toBe(false);
    expect(destinations).toEqual([]);
    expect(window.history.state).toEqual(state);
  });
});
