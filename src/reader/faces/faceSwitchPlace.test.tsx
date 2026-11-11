/** Address changes must not carry an earlier passage into a face switch or history entry. */
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { FaceSwitchAnchor } from "./FaceSwitchAnchor.tsx";

const PAPER = "/papers/special-relativity";
const SENTENCE = "s4-p3-s1";
const NEXT_SENTENCE = "s7-p1-s1";
const PLACE_KEY = "am:reader:v1:face-switch-place";
let reactRoot: Root | null = null;
let destinations: string[];
let scrolled: string[];
let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView;
let frames: Map<number, FrameRequestCallback>;

beforeEach(async () => {
  await installDom();
  sessionStorage.clear();
  destinations = [];
  scrolled = [];
  frames = new Map();
  let frame = 0;
  Object.defineProperty(window, "innerHeight", { value: 900, configurable: true });
  window.requestAnimationFrame = (callback) => {
    frames.set(++frame, callback);
    return frame;
  };
  window.cancelAnimationFrame = (id) => {
    frames.delete(id);
  };
  window.scrollBy = (() => {}) as typeof window.scrollBy;
  originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = function () {
    scrolled.push(this.id);
  };
  spyOn(window.location, "assign").mockImplementation((url) => {
    destinations.push(String(url));
  });
});

afterEach(async () => {
  await act(async () => reactRoot?.unmount());
  reactRoot = null;
  mock.restore();
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  await uninstallDom();
});

function fixture(face = "german", hash = SENTENCE) {
  window.history.replaceState({ unrelated: "kept" }, "", `${PAPER}/view/${face}/#${hash}`);
  const root = document.createElement("div");
  root.dataset.readerRoot = "";
  root.dataset.view = face;
  root.innerHTML =
    '<p id="s4-p3-s1">The earlier sentence.</p><h2 id="s7">Section seven</h2>' +
    '<p id="s7-p1-s1">The next sentence.</p>' +
    `<a data-view-link="english" href="${PAPER}/view/english/">English</a>`;
  document.body.append(root);
  let earlierTop = 90;
  let nextTop = 180;
  const earlier = root.querySelector<HTMLElement>(`#${SENTENCE}`);
  const next = root.querySelector<HTMLElement>(`#${NEXT_SENTENCE}`);
  const link = root.querySelector<HTMLAnchorElement>("a");
  if (!earlier || !next || !link) throw new Error("face fixture is missing its sentences or link");
  earlier.getBoundingClientRect = () =>
    ({ top: earlierTop, bottom: earlierTop + 100, height: 100 }) as DOMRect;
  next.getBoundingClientRect = () =>
    ({ top: nextTop, bottom: nextTop + 100, height: 100 }) as DOMRect;
  return {
    root,
    link,
    moveOffscreen() {
      earlierTop = -2000;
      nextTop = -1000;
    },
  };
}

async function mount(root: HTMLElement) {
  const container = document.createElement("div");
  root.prepend(container);
  reactRoot = createRoot(container);
  await act(async () => reactRoot?.render(createElement(FaceSwitchAnchor)));
}

function follow(link: HTMLAnchorElement) {
  link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
}

function flushFrames() {
  const callbacks = [...frames.values()];
  frames.clear();
  for (const callback of callbacks) callback(0);
}

describe("face-switch place ownership", () => {
  test("a section change cannot inherit a sentence without a hashchange event", async () => {
    const { root, link, moveOffscreen } = fixture();
    await mount(root);
    moveOffscreen();
    window.history.replaceState(window.history.state, "", `${PAPER}/view/german/#s7`);
    sessionStorage.setItem(
      PLACE_KEY,
      JSON.stringify({ anchorId: SENTENCE, relativeOffset: 0.1, path: `${PAPER}/view/english/` }),
    );
    follow(link);
    expect(destinations).toEqual([`${PAPER}/view/english/#s7`]);
    expect(sessionStorage.getItem(PLACE_KEY)).toBeNull();
  });

  test("the unchanged address keeps its place while the chooser is reached", async () => {
    const { root, link, moveOffscreen } = fixture();
    await mount(root);
    moveOffscreen();
    follow(link);
    expect(destinations).toEqual([`${PAPER}/view/english/#${SENTENCE}`]);
    expect(JSON.parse(sessionStorage.getItem(PLACE_KEY) ?? "null")).toEqual({
      anchorId: SENTENCE,
      relativeOffset: 0.1,
      path: `${PAPER}/view/english/`,
    });
  });

  test("hashchange captures the new sentence before it leaves the viewport", async () => {
    const { root, link, moveOffscreen } = fixture();
    await mount(root);
    window.history.replaceState(window.history.state, "", `${PAPER}/view/german/#${NEXT_SENTENCE}`);
    window.dispatchEvent(new Event("hashchange"));
    moveOffscreen();
    follow(link);
    expect(JSON.parse(sessionStorage.getItem(PLACE_KEY) ?? "null")).toEqual({
      anchorId: NEXT_SENTENCE,
      relativeOffset: 0.2,
      path: `${PAPER}/view/english/`,
    });
  });

  test("a trailing history write cannot record a different fragment", async () => {
    const { root, moveOffscreen } = fixture();
    await mount(root);
    moveOffscreen();
    window.history.replaceState(window.history.state, "", `${PAPER}/view/german/#s7`);
    window.dispatchEvent(new Event("scroll"));
    flushFrames();
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(window.history.state.anchor).toBeUndefined();
    expect(window.history.state.unrelated).toBe("kept");
  });

  test("history still records an off-screen place when its address has not changed", async () => {
    const { root, moveOffscreen } = fixture();
    await mount(root);
    moveOffscreen();
    window.dispatchEvent(new Event("scroll"));
    flushFrames();
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(window.history.state).toMatchObject({
      anchor: SENTENCE,
      relativeOffset: 0.1,
      face: "german",
      unrelated: "kept",
    });
  });

  test("the destination ignores a transfer for a different passage", async () => {
    const { root } = fixture("english", "s7");
    sessionStorage.setItem(
      PLACE_KEY,
      JSON.stringify({ anchorId: SENTENCE, relativeOffset: 0.1, path: `${PAPER}/view/english/` }),
    );
    await mount(root);
    expect(scrolled).not.toContain(SENTENCE);
    expect(window.location.hash).toBe("#s7");
    expect(sessionStorage.getItem(PLACE_KEY)).toBeNull();
  });

  test("Back cannot replay a same-face history record for a different fragment", async () => {
    const { root } = fixture("german", "s7");
    await mount(root);
    window.history.replaceState(
      { face: "german", anchor: SENTENCE, relativeOffset: 0.1, unrelated: "kept" },
      "",
    );
    window.dispatchEvent(new Event("popstate"));
    expect(scrolled).not.toContain(SENTENCE);
    expect(window.location.hash).toBe("#s7");
  });

  test("Back still restores the matching address from history", async () => {
    const { root } = fixture();
    await mount(root);
    window.history.replaceState(
      { face: "german", anchor: SENTENCE, relativeOffset: 0.1, unrelated: "kept" },
      "",
    );
    window.dispatchEvent(new Event("popstate"));
    expect(scrolled).toContain(SENTENCE);
    expect(window.history.state.unrelated).toBe("kept");
  });

  test("a matching transfer still restores the chosen sentence", async () => {
    const { root } = fixture("english");
    sessionStorage.setItem(
      PLACE_KEY,
      JSON.stringify({ anchorId: SENTENCE, relativeOffset: 0.1, path: `${PAPER}/view/english/` }),
    );
    await mount(root);
    expect(scrolled).toContain(SENTENCE);
    expect(sessionStorage.getItem(PLACE_KEY)).toBeNull();
  });
});

async function transferredReader() {
  const view = fixture("english");
  sessionStorage.setItem(
    PLACE_KEY,
    JSON.stringify({ anchorId: SENTENCE, relativeOffset: 0.1, path: `${PAPER}/view/english/` }),
  );
  await mount(view.root);
  return view;
}

describe("transferred and history scroll holds share a lifecycle", () => {
  test("the transfer wins over an older history record on the initial mount", async () => {
    const { root } = fixture("english");
    window.history.replaceState({ face: "english", anchor: SENTENCE, relativeOffset: 0.3 }, "");
    sessionStorage.setItem(
      PLACE_KEY,
      JSON.stringify({ anchorId: SENTENCE, relativeOffset: 0.1, path: `${PAPER}/view/english/` }),
    );
    await mount(root);
    expect(document.getElementById(SENTENCE)?.style.scrollMarginTop).toBe("90px");
    const importedFrames = [...frames.keys()];
    const shown = new Event("pageshow");
    Object.defineProperty(shown, "persisted", { value: false });
    window.dispatchEvent(shown);
    expect(document.getElementById(SENTENCE)?.style.scrollMarginTop).toBe("90px");
    for (const id of importedFrames) expect(frames.has(id)).toBe(true);
    expect(scrolled).toEqual([SENTENCE]);
  });

  test("a later popstate replaces the transfer and survives its paired hashchange", async () => {
    await transferredReader();
    const previousFrames = [...frames.keys()];
    expect(previousFrames.length).toBeGreaterThan(0);
    window.history.replaceState(
      { face: "english", anchor: NEXT_SENTENCE, relativeOffset: 0.3 },
      "",
      `${PAPER}/view/english/#${NEXT_SENTENCE}`,
    );
    window.dispatchEvent(new Event("popstate"));
    expect(scrolled.at(-1)).toBe(NEXT_SENTENCE);
    expect(document.getElementById(NEXT_SENTENCE)?.style.scrollMarginTop).toBe("270px");
    for (const id of previousFrames) expect(frames.has(id)).toBe(false);
    const restoredFrames = [...frames.keys()];
    expect(restoredFrames.length).toBeGreaterThan(0);
    // Native fragment Back emits hashchange after popstate has restored the new address.
    window.dispatchEvent(new Event("hashchange"));
    for (const id of restoredFrames) expect(frames.has(id)).toBe(true);
  });

  test("pagehide stops each hold and persisted pageshow restores the current entry", async () => {
    await transferredReader();
    expect(frames.size).toBeGreaterThan(0);
    window.history.replaceState({ face: "english", anchor: SENTENCE, relativeOffset: 0.25 }, "");
    window.dispatchEvent(new Event("pagehide"));
    expect(frames.size).toBe(0);
    const shown = new Event("pageshow");
    Object.defineProperty(shown, "persisted", { value: true });
    window.dispatchEvent(shown);
    expect(document.getElementById(SENTENCE)?.style.scrollMarginTop).toBe("225px");
    expect(scrolled).toEqual([SENTENCE, SENTENCE]);
    expect(frames.size).toBeGreaterThan(0);
    window.dispatchEvent(new Event("pagehide"));
    expect(frames.size).toBe(0);
  });

  test("a new fragment stops the old transfer without replaying stale history", async () => {
    await transferredReader();
    window.history.replaceState(
      { face: "english", anchor: SENTENCE, relativeOffset: 0.1 },
      "",
      `${PAPER}/view/english/#s7`,
    );
    window.dispatchEvent(new Event("popstate"));
    window.dispatchEvent(new Event("pageshow"));
    expect(window.location.hash).toBe("#s7");
    expect(scrolled).toEqual([SENTENCE]);
    expect(frames.size).toBe(0);
  });

  test("hashchange alone releases the hold from the previous address", async () => {
    await transferredReader();
    expect(frames.size).toBeGreaterThan(0);
    window.history.replaceState(window.history.state, "", `${PAPER}/view/english/#s7`);
    window.dispatchEvent(new Event("hashchange"));
    expect(frames.size).toBe(0);
    expect(scrolled).toEqual([SENTENCE]);
    expect(window.location.hash).toBe("#s7");
  });
});
