import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createContainer, installDom, uninstallDom } from "../../testing/reactDom.ts";
import { FACE_SWITCH_PLACE_KEY } from "../anchors/faceSwitchPlace.ts";
import type { StructureIndex } from "../anchors/mapToFace.ts";
import { sourceStructureIndex } from "../anchors/sourceStructureIndex.ts";
import { FaceSwitchAnchor } from "./FaceSwitchAnchor.tsx";

let reactRoot: Root | null = null;
let replace: typeof window.location.replace;
let scrollIntoView: typeof HTMLElement.prototype.scrollIntoView;
let destinations: string[];
let scrolled: string[];
const PAPER = "/papers/special-relativity";
const QUERY = "?detail=2&lens=modern";
const SENTENCE = "s7-p1-s1";

beforeEach(async () => {
  await installDom();
  window.sessionStorage.clear();
  destinations = [];
  scrolled = [];
  replace = window.location.replace;
  window.location.replace = (url) => {
    destinations.push(String(url));
  };
  scrollIntoView = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = function () {
    scrolled.push(this.id);
  };
  Object.defineProperty(window, "innerHeight", { value: 900, configurable: true });
});

afterEach(async () => {
  await act(async () => reactRoot?.unmount());
  reactRoot = null;
  window.location.replace = replace;
  HTMLElement.prototype.scrollIntoView = scrollIntoView;
  await uninstallDom();
});

function page(path: string, anchor: string, publishedIds: readonly string[] = []) {
  window.history.replaceState({ keep: "reader-history" }, "", `${path}#${anchor}`);
  const reader = document.createElement("article");
  reader.dataset.readerRoot = "";
  reader.dataset.face = "gloss";
  reader.dataset.glossAnchorSections = JSON.stringify({
    s0: ["masthead-title"],
    s7: ["eq-s7-d1", SENTENCE, "s1-p999-s1"],
    s10: ["eq-A", "closing-received"],
  });
  for (const id of publishedIds) {
    const target = document.createElement("p");
    target.id = id;
    target.textContent = "A rendered source unit.";
    target.getBoundingClientRect = () => ({ top: 180, bottom: 220, height: 40 }) as DOMRect;
    reader.append(target);
  }
  document.body.append(reader);
}

async function mount(structureIndex?: StructureIndex) {
  reactRoot = createRoot(createContainer());
  await act(async () => reactRoot?.render(createElement(FaceSwitchAnchor, { structureIndex })));
}

describe("the source-face navigation owner consumes the declared gloss destinations", () => {
  test("an unqualified equation reaches its declared page with the same settings", async () => {
    page(`${PAPER}/view/gloss/${QUERY}`, "eq-A");
    await mount();
    expect(destinations).toEqual([`${PAPER}/s10/view/gloss/${QUERY}#eq-A`]);
    expect(scrolled).toEqual([]);
  });

  test("the intermediate page carries its saved place to the final section", async () => {
    const origin = `${PAPER}/view/gloss/${QUERY}`;
    page(origin, SENTENCE);
    sessionStorage.setItem(
      FACE_SWITCH_PLACE_KEY,
      JSON.stringify({ path: origin, anchorId: SENTENCE, relativeOffset: 0.2 }),
    );
    await mount();
    expect(destinations).toEqual([`${PAPER}/s7/view/gloss/${QUERY}#${SENTENCE}`]);
    const carried = JSON.parse(sessionStorage.getItem(FACE_SWITCH_PLACE_KEY) ?? "null");
    expect(carried).toEqual({
      path: `${PAPER}/s7/view/gloss/${QUERY}`,
      anchorId: SENTENCE,
      relativeOffset: 0.2,
    });

    await act(async () => reactRoot?.unmount());
    reactRoot = null;
    document.body.innerHTML = "";
    page(`${PAPER}/s7/view/gloss/${QUERY}`, SENTENCE, [SENTENCE]);
    await mount();
    expect(destinations).toHaveLength(1);
    expect(sessionStorage.getItem(FACE_SWITCH_PLACE_KEY)).toBeNull();
    expect(document.getElementById(SENTENCE)?.style.scrollMarginTop).toBe("180px");
    expect(scrolled).toContain(SENTENCE);
  });

  test("a moved alias takes precedence over its old section prefix", async () => {
    page(`${PAPER}/s1/view/gloss/${QUERY}`, "s1-p999-s1", ["s1"]);
    await mount();
    expect(destinations).toEqual([`${PAPER}/s7/view/gloss/${QUERY}#s1-p999-s1`]);
    expect(scrolled).toEqual([]);
  });

  test("a local anchor is left where the browser put it and does not redirect", async () => {
    page(`${PAPER}/s10/view/gloss/${QUERY}`, "eq-A", ["eq-A"]);
    await mount();
    expect(destinations).toEqual([]);
    expect(window.location.hash).toBe("#eq-A");
  });

  test("an unknown anchor cannot fall through to prefix-based section guessing", async () => {
    page(`${PAPER}/view/gloss/`, "s7-p999-s1");
    const link = document.createElement("a");
    link.href = `${PAPER}/s7/view/gloss/`;
    document.body.append(link);
    await mount();
    expect(destinations).toEqual([]);
  });
});

describe("a manifest-only inline address survives a paginated gloss switch", () => {
  const inline = `${SENTENCE}-m1`;
  const structure = sourceStructureIndex(
    [
      { id: "s7-p1", section: "s7" },
      { id: SENTENCE, containedIn: "s7-p1", section: "s7" },
      { id: inline, containedIn: SENTENCE, section: "s7" },
    ],
    ["s7"],
  );

  test("the parent selects the section and the destination restores the original transfer", async () => {
    const origin = `${PAPER}/view/gloss/${QUERY}`;
    page(origin, inline);
    sessionStorage.setItem(
      FACE_SWITCH_PLACE_KEY,
      JSON.stringify({ path: origin, anchorId: inline, relativeOffset: 0.2 }),
    );
    await mount(structure);
    expect(destinations).toEqual([`${PAPER}/s7/view/gloss/${QUERY}#${inline}`]);
    expect(JSON.parse(sessionStorage.getItem(FACE_SWITCH_PLACE_KEY) ?? "null")).toEqual({
      path: `${PAPER}/s7/view/gloss/${QUERY}`,
      anchorId: inline,
      relativeOffset: 0.2,
    });

    await act(async () => reactRoot?.unmount());
    reactRoot = null;
    document.body.innerHTML = "";
    page(`${PAPER}/s7/view/gloss/${QUERY}`, inline, [SENTENCE]);
    await mount(structure);
    expect(destinations).toHaveLength(1);
    expect(window.location.hash).toBe(`#${SENTENCE}`);
    expect(scrolled.at(-1)).toBe(SENTENCE);
    expect(document.getElementById(SENTENCE)?.style.scrollMarginTop).toBe("180px");
    expect(sessionStorage.getItem(FACE_SWITCH_PLACE_KEY)).toBeNull();
  });

  test("a sentence already on the whole-paper page needs no section navigation", async () => {
    page(`${PAPER}/view/gloss/${QUERY}`, inline, [SENTENCE]);
    await mount(structure);
    expect(destinations).toEqual([]);
    expect(window.location.hash).toBe(`#${SENTENCE}`);
    expect(scrolled.at(-1)).toBe(SENTENCE);
  });

  test("an unknown formula cannot borrow a real sentence's destination", async () => {
    const absent = `${SENTENCE}-m999`;
    page(`${PAPER}/view/gloss/`, absent);
    await mount(structure);
    expect(destinations).toEqual([]);
    expect(scrolled).toEqual([]);
    expect(window.location.hash).toBe(`#${absent}`);
  });
});
