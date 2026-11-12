import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { FACE_SWITCH_PLACE_KEY } from "./anchors/faceSwitchPlace.ts";
import { FaceSwitchAnchor } from "./faces/FaceSwitchAnchor.tsx";
import { DETAIL_STORAGE_KEY } from "./navigation/state.ts";
import { passageFaceLinks, passageFaceOrigin, passageProjectionsAt } from "./passageFaceSwitch.ts";
import { mountPassageProjectionNavigation } from "./passageProjectionNavigation.ts";
import { ReaderController } from "./ReaderController.tsx";

const PAPER = "/papers/mass-energy/";
const SENTENCE = "s0-p12-s1";
const ARGUMENT = "arg-me-mass-change";
let reactRoot: Root | null = null;
let stop: (() => void) | undefined;
let destinations: string[];
let scrollY = 0;
let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView;

beforeEach(async () => {
  await installDom();
  localStorage.clear();
  sessionStorage.clear();
  destinations = [];
  scrollY = 0;
  Object.defineProperty(window, "innerHeight", { value: 900, configurable: true });
  window.scrollBy = ((options: ScrollToOptions) => {
    scrollY += options.top ?? 0;
  }) as typeof window.scrollBy;
  originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = function () {
    scrollY +=
      this.getBoundingClientRect().top - (Number.parseFloat(this.style.scrollMarginTop) || 0);
  };
  spyOn(window.location, "assign").mockImplementation((href) => destinations.push(String(href)));
});

async function clearSurface() {
  stop?.();
  stop = undefined;
  await act(async () => reactRoot?.unmount());
  reactRoot = null;
  document.body.replaceChildren();
  scrollY = 0;
}

afterEach(async () => {
  await clearSurface();
  mock.restore();
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  await uninstallDom();
});

function geometry(element: HTMLElement, top: () => number, height = 100) {
  element.getBoundingClientRect = () =>
    ({ top: top() - scrollY, bottom: top() - scrollY + height, height }) as DOMRect;
}

function menu(anchor: string, arguments_: readonly string[] = [ARGUMENT]) {
  return `<details data-passage-projections="${anchor}"><summary>Explore this passage</summary>
    <ul><li data-projection="german"><a data-passage-projection-link href="${PAPER}view/german/#s0-p12">Opening paragraph 12</a></li>
    <li data-projection="english"><a data-passage-projection-link href="${PAPER}view/english/#${SENTENCE}">Opening paragraph 12</a></li>
    <li data-projection="explanation">${arguments_.map((id) => `<a data-passage-projection-link href="${PAPER}#${id}">Explanation of ${id}</a>`).join("")}</li></ul></details>`;
}

function source(arguments_: readonly string[] = [ARGUMENT]) {
  window.history.replaceState({ unrelated: "source" }, "", `${PAPER}view/german/#${SENTENCE}`);
  const root = document.createElement("div");
  root.dataset.readerRoot = "";
  root.dataset.view = "german";
  root.innerHTML = `<nav><a data-view-link="reading" href="${PAPER}">Explanation</a></nav>
    <p id="s0-p12"><span id="${SENTENCE}">The emitting body loses mass.</span></p>${menu("s0-p12", arguments_)}`;
  document.body.append(root);
  let top = 180;
  const sentence = root.querySelector<HTMLElement>(`#${SENTENCE}`) as HTMLElement;
  geometry(sentence, () => top);
  geometry(root.querySelector<HTMLElement>("#s0-p12") as HTMLElement, () => top - 20, 300);
  return {
    root,
    sentence,
    tab: root.querySelector<HTMLAnchorElement>("[data-view-link]") as HTMLAnchorElement,
    move: (next: number) => {
      top = next;
    },
  };
}

async function mountSource(root: HTMLElement) {
  const host = document.createElement("div");
  root.prepend(host);
  reactRoot = createRoot(host);
  await act(async () => reactRoot?.render(createElement(FaceSwitchAnchor)));
  stop = mountPassageProjectionNavigation(root);
}

async function reading() {
  window.history.replaceState({ unrelated: "reading" }, "", `${PAPER}#${ARGUMENT}`);
  const root = document.createElement("div");
  root.dataset.readerRoot = "";
  root.dataset.view = "reading";
  root.innerHTML = `<dialog data-clarification-dialog></dialog><p data-reader-announcement></p>
    <article id="arg-me-import" class="reader-passage" data-unit="arg-me-import">Earlier argument.</article>
    <article id="${ARGUMENT}" class="reader-passage" data-unit="${ARGUMENT}">Mass change.
    ${menu(ARGUMENT)}</article>`;
  // The argument explains two paragraphs. A remembered exact source must beat an arbitrary
  // first-paragraph choice, while an unrelated visit must still offer both real destinations.
  root
    .querySelector('[data-projection="german"]')
    ?.insertAdjacentHTML(
      "beforeend",
      `<a data-passage-projection-link href="${PAPER}view/german/#s0-p13">Opening paragraph 13</a>`,
    );
  document.body.append(root);
  const argument = root.querySelector<HTMLElement>(`#${ARGUMENT}`) as HTMLElement;
  geometry(argument, () => 900, 700);
  const host = document.createElement("div");
  root.prepend(host);
  reactRoot = createRoot(host);
  await act(async () => {
    reactRoot?.render(
      createElement(ReaderController, {
        registry: { paperId: "mass-energy", anchors: ["arg-me-import", ARGUMENT], foundations: [] },
        titles: {},
        questions: {},
      }),
    );
  });
  return {
    root,
    argument,
    tab: root.querySelector<HTMLAnchorElement>(
      '[data-reader-face-link="german"]',
    ) as HTMLAnchorElement,
  };
}

/** Cancel only the test DOM's native navigation, after both real click owners have observed it. */
function follow(link: HTMLAnchorElement, options: MouseEventInit = {}) {
  let prevented = false;
  document.addEventListener(
    "click",
    (event) => {
      prevented = event.defaultPrevented;
      event.preventDefault();
    },
    { once: true },
  );
  link.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...options }),
  );
  return prevented;
}

describe("the global face chooser follows the authored passage relation", () => {
  for (const [sourceTop, storedDetail] of [
    [180, null],
    [180, "0"],
    [180, "2"],
    [-40, null],
  ] as const) {
    test(`source → explanation → exact source keeps top ${sourceTop}px with stored Detail ${storedDetail ?? "default"}`, async () => {
      const fraction = sourceTop / 900;
      const first = source();
      first.move(sourceTop);
      await mountSource(first.root);
      first.move(-2000); // Reaching the nonsticky chooser must not erase the sentence's last position.
      expect(follow(first.tab)).toBe(true);
      expect(destinations).toEqual([`${PAPER}#${ARGUMENT}`]);
      expect(first.tab.getAttribute("href")).toBe(PAPER);
      expect(window.history.state.passageProjectionReturn).toMatchObject({
        anchor: SENTENCE,
        relativeOffset: fraction,
      });
      expect(JSON.parse(sessionStorage.getItem(FACE_SWITCH_PLACE_KEY) ?? "null")).toMatchObject({
        anchorId: ARGUMENT,
        path: PAPER,
        relativeOffset: fraction,
        projectionOrigin: { href: `${PAPER}view/german/#${SENTENCE}` },
      });

      await clearSurface();
      if (storedDetail) localStorage.setItem(DETAIL_STORAGE_KEY, storedDetail);
      const explanation = await reading();
      expect(window.location.hash).toBe(`#${ARGUMENT}`);
      expect(window.history.state.annusReader.state.anchor).toBe(ARGUMENT);
      expect(explanation.argument.getBoundingClientRect().top).toBeCloseTo(sourceTop, 8);
      if (storedDetail)
        expect(new URLSearchParams(window.location.search).get("detail")).toBe(storedDetail);
      expect(sessionStorage.getItem(FACE_SWITCH_PLACE_KEY)).toBeNull();
      expect(follow(explanation.tab)).toBe(true);
      expect(destinations.at(-1)).toBe(`${PAPER}view/german/#${SENTENCE}`);
      expect(explanation.root.querySelector("[data-face-switch-choices]")).toBeNull();
      expect(explanation.tab.getAttribute("href")).toBe(`${PAPER}view/german/`);

      await clearSurface();
      const returned = source();
      returned.move(1600);
      await mountSource(returned.root);
      expect(returned.sentence.getBoundingClientRect().top).toBeCloseTo(sourceTop, 8);
      expect(sessionStorage.getItem(FACE_SWITCH_PLACE_KEY)).toBeNull();
    });
  }

  test("many explanations are a real choice, and choosing one retains the exact source sentence", async () => {
    const { root, tab } = source(["arg-me-two-ledgers", ARGUMENT]);
    await mountSource(root);
    follow(tab);
    expect(destinations).toEqual([]);
    const links = [...root.querySelectorAll<HTMLAnchorElement>("[data-face-switch-choices] a")];
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      `${PAPER}#arg-me-two-ledgers`,
      `${PAPER}#${ARGUMENT}`,
    ]);
    expect(document.activeElement).toBe(links[0]);
    expect(follow(links[1] as HTMLAnchorElement)).toBe(false);
    expect(JSON.parse(sessionStorage.getItem(FACE_SWITCH_PLACE_KEY) ?? "null")).toMatchObject({
      anchorId: ARGUMENT,
      projectionOrigin: { href: `${PAPER}view/german/#${SENTENCE}` },
    });
  });

  test("a fresh explanation visit offers all bound source paragraphs without silently picking one", async () => {
    const { root, tab } = await reading();
    follow(tab);
    expect(destinations).toEqual([]);
    expect(
      [...root.querySelectorAll<HTMLAnchorElement>("[data-face-switch-choices] a")].map(
        (link) => link.hash,
      ),
    ).toEqual(["#s0-p12", "#s0-p13"]);
    const cancel = root.querySelector<HTMLButtonElement>("[data-face-switch-choices] button");
    cancel?.click();
    expect(root.querySelector("[data-face-switch-choices]")).toBeNull();
    expect(document.activeElement).toBe(tab);
  });

  test("declared missing explanations stay missing, with an operable return to reading", async () => {
    const { root, tab } = source([]);
    await mountSource(root);
    follow(tab);
    expect(destinations).toEqual([]);
    expect(root.querySelector("[data-face-switch-choices]")?.textContent).toContain(
      "No explanations have been linked",
    );
    expect(root.querySelector("[data-face-switch-choices] a")).toBeNull();
    root.querySelector<HTMLButtonElement>("[data-face-switch-choices] button")?.click();
    expect(document.activeElement).toBe(tab);
  });

  test("modified clicks and blocked storage retain ordinary navigation and the authored destination", async () => {
    const { root, tab } = source();
    await mountSource(root);
    expect(follow(tab, { ctrlKey: true })).toBe(false);
    expect(destinations).toEqual([]);
    expect(sessionStorage.getItem(FACE_SWITCH_PLACE_KEY)).toBeNull();
    spyOn(window.sessionStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(follow(tab)).toBe(true);
    expect(destinations).toEqual([`${PAPER}#${ARGUMENT}`]);
  });

  test("English groups and parallel German sentences use rendered ownership, not matching id spellings", () => {
    window.history.replaceState({}, "", `${PAPER}view/parallel/#source-second`);
    const root = document.createElement("div");
    root.innerHTML = `<p id="s0-p12"><span id="source-second">German sentence</span></p>
      <p data-source-block="s0-p12"><span id="translated-first">First</span><span id="translated-second">Second</span></p>
      ${menu("translated-first")}`;
    document.body.append(root);
    for (const anchor of ["source-second", "translated-second"]) {
      const projections = passageProjectionsAt(root, anchor);
      expect(projections).toHaveLength(1);
      expect(passageFaceLinks(projections, "reading").map((link) => link.href)).toEqual([
        `${PAPER}#${ARGUMENT}`,
      ]);
    }
    expect(passageProjectionsAt(root, "missing-sentence")).toEqual([]);
  });

  test("a stale, foreign, or no-longer-bound source cannot override the current argument's destinations", async () => {
    const { root } = await reading();
    const projections = passageProjectionsAt(root, ARGUMENT);
    const origin = {
      readingAnchor: ARGUMENT,
      href: `${PAPER}view/german/#${SENTENCE}`,
      paragraphs: [`${PAPER}view/german/#s0-p12`],
      relativeOffset: 0.2,
    };
    expect(passageFaceOrigin(origin, ARGUMENT, projections, window.location.href)).toEqual(origin);
    for (const change of [
      { readingAnchor: "arg-me-import" },
      { href: "/papers/brownian-motion/view/german/#s0-p12-s1" },
      { href: "https://example.org/papers/mass-energy/view/german/#s0-p12-s1" },
      { paragraphs: [`${PAPER}view/german/#s0-p99`] },
      { relativeOffset: Infinity },
    ])
      expect(
        passageFaceOrigin({ ...origin, ...change }, ARGUMENT, projections, window.location.href),
      ).toBeNull();
  });
});
