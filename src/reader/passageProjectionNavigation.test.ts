import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { createPlaceHold } from "./holdPlace.ts";
import {
  mountPassageProjectionNavigation,
  pendingPassageProjectionReturn,
} from "./passageProjectionNavigation.ts";

let unmount: (() => void) | undefined;
let releaseShared: (() => void) | undefined;
let scrolls: number[];
beforeEach(async () => {
  await installDom();
  scrolls = [];
  Object.defineProperty(window, "innerHeight", { value: 900, configurable: true });
  window.scrollBy = ((options: ScrollToOptions) =>
    scrolls.push(options.top ?? 0)) as typeof window.scrollBy;
});
afterEach(async () => {
  unmount?.();
  unmount = undefined;
  releaseShared?.();
  releaseShared = undefined;
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
