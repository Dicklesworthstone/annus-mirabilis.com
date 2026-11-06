/** The existing navigation owners cooperate with passage projection departure and return. */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { FaceSwitchAnchor } from "./faces/FaceSwitchAnchor.tsx";
import { mountPassageProjectionNavigation } from "./passageProjectionNavigation.ts";
import { ReaderController } from "./ReaderController.tsx";

let reactRoot: Root | null = null;
let stopProjection: (() => void) | undefined;
let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView;
let scrollY = 0;
let scrolledAnchors: string[];

beforeEach(async () => {
  await installDom();
  localStorage.clear();
  sessionStorage.clear();
  scrollY = 0;
  scrolledAnchors = [];
  Object.defineProperty(window, "innerHeight", { value: 900, configurable: true });
  window.scrollBy = ((options: ScrollToOptions) => {
    scrollY += options.top ?? 0;
  }) as typeof window.scrollBy;
  originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = function () {
    scrolledAnchors.push(this.id);
    scrollY +=
      this.getBoundingClientRect().top - (Number.parseFloat(this.style.scrollMarginTop) || 0);
  };
});

afterEach(async () => {
  stopProjection?.();
  stopProjection = undefined;
  await act(async () => reactRoot?.unmount());
  reactRoot = null;
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  await uninstallDom();
});

/** Let both real owners observe the click, then cancel only the test DOM's native navigation. */
function follow(link: HTMLAnchorElement) {
  document.addEventListener("click", (event) => event.preventDefault(), { once: true });
  link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
}

function sourceFixture() {
  window.history.replaceState(
    { unrelated: "kept" },
    "",
    "/papers/mass-energy/view/german/#s0-p1-s1",
  );
  const root = document.createElement("div");
  root.dataset.readerRoot = "";
  root.dataset.view = "german";
  root.innerHTML =
    '<p id="s0-p1-s1">Earlier sentence.</p><p id="s0-p7">The departure paragraph.</p>' +
    '<details data-passage-projections="s0-p7" open><summary>Explore this passage</summary>' +
    '<a data-passage-projection-link href="/lab/me-01/">Experiment</a></details>';
  document.body.append(root);
  let addedHeight = 0;
  const old = root.querySelector<HTMLElement>("#s0-p1-s1");
  const departure = root.querySelector<HTMLElement>("#s0-p7");
  const link = root.querySelector<HTMLAnchorElement>("a");
  if (!old || !departure || !link) throw new Error("source fixture missing a passage or link");
  old.getBoundingClientRect = () =>
    ({ top: 30 - scrollY, bottom: 130 - scrollY, height: 100 }) as DOMRect;
  departure.getBoundingClientRect = () =>
    ({
      top: 90 + addedHeight - scrollY,
      bottom: 190 + addedHeight - scrollY,
      height: 100,
    }) as DOMRect;
  return {
    root,
    old,
    departure,
    link,
    grow: () => {
      addedHeight = 600;
    },
  };
}

async function mountSource(root: HTMLElement) {
  const container = document.createElement("div");
  root.prepend(container);
  reactRoot = createRoot(container);
  await act(async () => reactRoot?.render(createElement(FaceSwitchAnchor)));
}

describe("projection navigation with the existing source-face owner", () => {
  test("a same-document projection leaves the source owner's subsequent history write enabled", async () => {
    const { root, link } = sourceFixture();
    link.href = `${window.location.pathname}${window.location.search}#s0-p7`;
    await mountSource(root);
    stopProjection = mountPassageProjectionNavigation(root);
    follow(link);
    expect(window.history.state.passageProjectionReturn).toBeUndefined();
    window.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => setTimeout(resolve, 350));
    // The fixture cancels native navigation, so the current sentence remains the source owner's
    // address. Its write proves the self-link left no projection lock or substituted paragraph.
    expect(window.history.state.anchor).toBe("s0-p1-s1");
    expect(window.history.state.face).toBe("german");
    expect(window.history.state.passageProjectionReturn).toBeUndefined();
  });

  test("a pending sentence debounce cannot overwrite an explicitly captured paragraph departure", async () => {
    const { root, link } = sourceFixture();
    await mountSource(root);
    stopProjection = mountPassageProjectionNavigation(root);
    window.dispatchEvent(new Event("scroll"));
    follow(link);
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(window.history.state.anchor).toBe("s0-p7");
    expect(window.history.state.passageProjectionReturn.anchor).toBe("s0-p7");
    expect(window.history.state.relativeOffset).toBe(0.1);
  });

  test.each(["projection-first", "source-first"] as const)(
    "%s restoration holds only the captured passage and keeps later source writes consistent",
    async (order) => {
      const { root, departure, link, grow } = sourceFixture();
      if (order === "projection-first") stopProjection = mountPassageProjectionNavigation(root);
      await mountSource(root);
      if (order === "source-first") stopProjection = mountPassageProjectionNavigation(root);
      follow(link);
      // A stale source record must not beat the dedicated return, whichever listener runs first.
      window.history.replaceState(
        { ...window.history.state, anchor: "s0-p1-s1", relativeOffset: 30 / 900 },
        "",
      );
      grow();
      window.dispatchEvent(new Event("pageshow"));
      expect(scrolledAnchors).not.toContain("s0-p1-s1");
      expect(departure.getBoundingClientRect().top).toBe(90);
      expect(window.history.state.passageProjectionReturn).toBeUndefined();
      expect(window.history.state.anchor).toBe("s0-p7");
      window.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => setTimeout(resolve, 350));
      expect(window.history.state.anchor).toBe("s0-p7");
      expect(window.history.state.relativeOffset).toBe(0.1);
    },
  );
});

describe("projection navigation with the existing reading controller", () => {
  test("the live departure anchor survives a later Detail save without losing lens or URL settings", async () => {
    window.history.replaceState(
      { unrelated: "kept" },
      "",
      "/papers/mass-energy/?detail=2&lens=modern&notation=modern#arg-old",
    );
    document.documentElement.dataset.notation = "modern";
    const root = document.createElement("div");
    root.dataset.readerRoot = "";
    root.dataset.view = "reading";
    root.innerHTML =
      "<dialog data-clarification-dialog></dialog><p data-reader-announcement></p>" +
      '<article id="arg-old" data-unit="arg-old" class="reader-passage">Earlier argument.</article>' +
      '<article id="arg-new" data-unit="arg-new" class="reader-passage">The departure argument.' +
      '<details data-passage-projections="arg-new" open><summary>Explore this passage</summary>' +
      '<a data-passage-projection-link href="/lab/me-01/">Experiment</a></details></article>';
    document.body.append(root);
    const container = document.createElement("div");
    root.prepend(container);
    reactRoot = createRoot(container);
    await act(async () => {
      reactRoot?.render(
        createElement(ReaderController, {
          registry: { paperId: "mass-energy", anchors: ["arg-old", "arg-new"], foundations: [] },
          titles: {},
          questions: {},
        }),
      );
    });
    const link = root.querySelector<HTMLAnchorElement>("[data-passage-projection-link]");
    const detail = root.querySelector<HTMLSelectElement>("[data-detail-control]");
    expect(link).not.toBeNull();
    expect(detail).not.toBeNull();
    if (!link || !detail) return;
    follow(link);
    await act(async () => {
      detail.value = "0";
      detail.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(window.history.state.annusReader.state).toMatchObject({
      anchor: "arg-new",
      detail: 0,
      lens: true,
      view: "reading",
      frames: [],
    });
    expect(window.location.hash).toBe("#arg-new");
    expect(new URLSearchParams(window.location.search).get("notation")).toBe("modern");
    expect(window.history.state.unrelated).toBe("kept");
  });
});
