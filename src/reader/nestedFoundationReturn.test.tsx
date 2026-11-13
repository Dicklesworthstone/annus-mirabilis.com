import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { MAX_CLARIFICATION_DEPTH } from "./navigation/state.ts";
import { ReaderController } from "./ReaderController.tsx";

const ARGUMENT = "arg-bm-independent-steps";
const PARENT = "derivation-step:bm-variance-cross";
const FOUNDATION = "probability-independence";
let root: Root;
let reader: HTMLElement;
let foundation: HTMLDialogElement;
let origin: HTMLAnchorElement;
let controls: HTMLElement;

function must<T extends Element>(scope: ParentNode, selector: string): T {
  const result = scope.querySelector<T>(selector);
  assert(result, `Missing ${selector}`);
  return result;
}

function visibleAt(element: HTMLElement, top: () => number) {
  const bounds = () => new DOMRect(20, top(), 220, 44);
  element.getBoundingClientRect = bounds;
  element.getClientRects = () => [bounds()] as unknown as DOMRectList;
}

async function mountReader() {
  root = createRoot(controls);
  await act(async () => {
    root.render(
      <ReaderController
        registry={{
          paperId: "brownian-motion",
          anchors: [ARGUMENT],
          foundations: [FOUNDATION, "mean-variance-rms"],
        }}
        titles={{
          [FOUNDATION]: "Probability and independence",
          "mean-variance-rms": "Mean, variance and RMS",
        }}
        questions={{ [ARGUMENT]: "Why average the squares?" }}
      />,
    );
  });
}

beforeEach(async () => {
  await installDom();
  history.replaceState(
    { unrelated: "keep" },
    "",
    `/papers/brownian-motion/s4/?detail=2&lens=modern&notation=modern&units=cgs&extra=keep#${ARGUMENT}`,
  );
  reader = document.createElement("main");
  reader.dataset.readerRoot = "";
  // The real registered variance panel is mounted by the reader. Existing foundation shells
  // stand in for the network-loaded lesson bodies: this suite exercises navigation ownership.
  reader.innerHTML = `
    <dialog data-clarification-dialog>
      <button type="button" data-clarification-close>Close lesson</button>
      <p data-compass-question></p><p data-compass-idea></p>
      <button type="button" data-reader-back>One step back</button>
      <button type="button" data-reader-close>Return to the exact step</button>
      <section data-foundation-panel="${FOUNDATION}" hidden>
        <h2 id="clarification-${FOUNDATION}" tabindex="-1">Probability and independence</h2>
        <a data-foundation="mean-variance-rms" href="/foundations/mean-variance-rms/">Mean, variance and RMS</a>
      </section>
      <section data-foundation-panel="mean-variance-rms" hidden>
        <h2 id="clarification-mean-variance-rms" tabindex="-1">Mean, variance and RMS</h2>
        <a data-foundation="${FOUNDATION}" href="/foundations/${FOUNDATION}/">Probability and independence</a>
      </section>
    </dialog>
    <p data-reader-announcement></p>
    <article class="reader-passage" id="${ARGUMENT}" tabindex="-1">
      <p class="passage-question">Why average the squares?</p>
      <a id="variance-origin" data-selection-id="crossTerm" data-clarification-open="${PARENT}"
        href="?open=${PARENT}#${ARGUMENT}">Why do the cross terms vanish?</a>
    </article>
  `;
  document.body.append(reader);
  foundation = must<HTMLDialogElement>(reader, "[data-clarification-dialog]");
  origin = must<HTMLAnchorElement>(reader, "#variance-origin");
  visibleAt(origin, () => 200);
  controls = document.createElement("div");
  reader.prepend(controls);
  await mountReader();
});

afterEach(async () => {
  await act(async () => root.unmount());
  await uninstallDom();
});

async function click(element: HTMLElement, modifiers: MouseEventInit = {}) {
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...modifiers,
  });
  await act(async () => element.dispatchEvent(event));
  return event;
}

async function travel(action: () => void, label = "history traversal") {
  await act(async () => {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Expected ${label}: ${location.href}`)),
        1500,
      );
      window.addEventListener(
        "popstate",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
      action();
    });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

async function openParent() {
  await click(origin);
  const parent = must<HTMLDialogElement>(document, "[data-instrument-clarification-dialog][open]");
  const panel = must<HTMLElement>(parent, '[data-missing-step="bm-variance-cross"]');
  const tool = must<HTMLAnchorElement>(panel, `a[data-foundation="${FOUNDATION}"]`);
  visibleAt(tool, () => 500 - parent.scrollTop);
  return { parent, panel, tool };
}

function expectSettings() {
  const params = new URLSearchParams(location.search);
  expect(params.get("detail")).toBe("2");
  expect(params.get("lens")).toBe("modern");
  expect(params.get("notation")).toBe("modern");
  expect(params.get("units")).toBe("cgs");
  expect(params.get("extra")).toBe("keep");
  expect(location.hash).toBe(`#${ARGUMENT}`);
  expect(history.state.unrelated).toBe("keep");
}

test("variance prerequisite returns to the same expanded panel, exact link and modal scroll, then the passage", async () => {
  const { parent, panel, tool } = await openParent();
  const disclosure = must<HTMLDetailsElement>(panel, "details");
  disclosure.open = true;
  parent.scrollTop = 180;
  const retainedStack = JSON.stringify(history.state.annusClarification);
  const pageScrolls: unknown[][] = [];
  window.scrollBy = (...args: any[]) => {
    pageScrolls.push(args);
  };
  expect(tool.getAttribute("href")).toBe(`/foundations/${FOUNDATION}/`);
  expect((await click(tool)).defaultPrevented).toBe(true);
  expect(foundation.open).toBe(true);
  expect(parent.open).toBe(true);
  expect(document.activeElement).toBe(foundation.querySelector(`#clarification-${FOUNDATION}`));
  expect(new URLSearchParams(location.search).get("open")).toBe(`foundation:${FOUNDATION}`);
  expect(JSON.stringify(history.state.annusClarification)).toBe(retainedStack);
  expectSettings();

  parent.scrollTop = 240;
  await travel(() => must<HTMLButtonElement>(foundation, "[data-reader-close]").click());
  expect(foundation.open).toBe(false);
  expect(parent.open).toBe(true);
  expect(parent.querySelector('[data-missing-step="bm-variance-cross"]')).toBe(panel);
  expect(disclosure.open).toBe(true);
  expect(document.activeElement).toBe(tool);
  expect(parent.scrollTop).toBe(180);
  expect(pageScrolls).toEqual([]);
  expect(new URLSearchParams(location.search).get("open")).toBe(PARENT);
  expectSettings();

  await travel(() => must<HTMLButtonElement>(parent, "[data-compass-return]").click());
  expect(parent.open).toBe(false);
  expect(new URLSearchParams(location.search).has("open")).toBe(false);
  expect(document.activeElement).toBe(origin);
  expect(origin.dataset.restoredSelection).toBe("crossTerm");
  expectSettings();
});

test("Escape closes one foundation layer at a time and leaves the registered parent open", async () => {
  const { parent, panel, tool } = await openParent();
  await click(tool);
  const second = must<HTMLAnchorElement>(foundation, 'a[data-foundation="mean-variance-rms"]');
  visibleAt(second, () => 220);
  await click(second);
  expect(new URLSearchParams(location.search).get("open")).toBe("foundation:mean-variance-rms");
  await travel(() => foundation.dispatchEvent(new Event("cancel", { cancelable: true })));
  expect(new URLSearchParams(location.search).get("open")).toBe(`foundation:${FOUNDATION}`);
  expect(foundation.open).toBe(true);
  expect(document.activeElement).toBe(second);
  expect(parent.querySelector('[data-missing-step="bm-variance-cross"]')).toBe(panel);
  await travel(() => foundation.dispatchEvent(new Event("cancel", { cancelable: true })));
  expect(foundation.open).toBe(false);
  expect(parent.open).toBe(true);
  expect(document.activeElement).toBe(tool);
  await travel(() => parent.dispatchEvent(new Event("cancel", { cancelable: true })));
  expect(parent.open).toBe(false);
  expect(document.activeElement).toBe(origin);
});

test("the foundation X traverses all nested lessons back to one original parent entry", async () => {
  const { parent, tool } = await openParent();
  await click(tool);
  await click(must<HTMLAnchorElement>(foundation, 'a[data-foundation="mean-variance-rms"]'));
  await travel(() => must<HTMLButtonElement>(foundation, "[data-clarification-close]").click());
  expect(foundation.open).toBe(false);
  expect(parent.open).toBe(true);
  expect(document.activeElement).toBe(tool);
  expect(new URLSearchParams(location.search).get("open")).toBe(PARENT);
  await travel(() => must<HTMLButtonElement>(parent, "[data-compass-return]").click());
  expect(new URLSearchParams(location.search).has("open")).toBe(false);
  expect(parent.open).toBe(false);
});

test("saved history states retain a live parent and reconstruct it after leaving the explanation", async () => {
  const snapshot = () => ({ state: structuredClone(history.state), href: location.href });
  async function restore(saved: ReturnType<typeof snapshot>) {
    // happy-dom's HistoryItemList.replace truncates Forward entries. Replay actual captured
    // browser-entry payloads here; native Forward also needs the HTTP application's browser check.
    await act(async () => {
      history.replaceState(saved.state, "", saved.href);
      window.dispatchEvent(new PopStateEvent("popstate", { state: saved.state }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
  }
  const passageEntry = snapshot();
  const { parent, panel, tool } = await openParent();
  const parentEntry = snapshot();
  await click(tool);
  const childEntry = snapshot();
  const triggerId = tool.id;
  await travel(() => history.back(), "Back from child");
  expect(parent.querySelector('[data-missing-step="bm-variance-cross"]')).toBe(panel);
  await restore(childEntry);
  expect(foundation.open).toBe(true);
  expect(parent.querySelector('[data-missing-step="bm-variance-cross"]')).toBe(panel);
  await restore(parentEntry);
  expect(document.activeElement).toBe(tool);
  const parentWithReturn = snapshot();
  await restore(passageEntry);
  expect(parent.open).toBe(false);
  await restore(parentWithReturn);
  const restoredTool = must<HTMLAnchorElement>(parent, `a[data-foundation="${FOUNDATION}"]`);
  visibleAt(restoredTool, () => 500 - parent.scrollTop);
  expect(restoredTool.id).toBe(triggerId);
  expect(parent.open).toBe(true);
  await restore(childEntry);
  expect(foundation.open).toBe(true);
  expect(parent.open).toBe(true);
  await restore(parentWithReturn);
  expect(document.activeElement).toBe(restoredTool);
  expectSettings();
});

test("modified, unknown and unrelated foundation links retain native navigation", async () => {
  const { parent, tool } = await openParent();
  const before = location.href;
  async function expectNative(link: HTMLElement, modifiers: MouseEventInit = {}) {
    let intercepted: boolean | null = null;
    document.addEventListener(
      "click",
      (event) => {
        intercepted = event.defaultPrevented;
        event.preventDefault(); // The test observes native fallback without leaving its DOM fixture.
      },
      { once: true },
    );
    await click(link, modifiers);
    expect(intercepted).toBe(false);
  }
  await expectNative(tool, { ctrlKey: true });
  const unknown = document.createElement("a");
  unknown.href = "/foundations/not-a-registered-lesson/";
  unknown.dataset.foundation = "not-a-registered-lesson";
  parent.append(unknown);
  await expectNative(unknown);
  const unrelated = tool.cloneNode(true) as HTMLAnchorElement;
  document.body.append(unrelated);
  await expectNative(unrelated);
  expect(location.href).toBe(before);
  expect(foundation.open).toBe(false);
  expect(parent.open).toBe(true);
});

test("nested foundations reserve the registered parent's depth and replace only the deepest child", async () => {
  const { parent, panel, tool } = await openParent();
  await click(tool);
  for (let depth = 1; depth <= MAX_CLARIFICATION_DEPTH; depth++) {
    const frame = history.state.annusReader.state.frames.at(-1);
    const link = must<HTMLAnchorElement>(
      foundation,
      `[data-foundation-panel="${frame.foundationId}"] a[data-foundation]`,
    );
    await click(link);
    const saved = history.state.annusReader;
    expect(saved.state.frames.length + saved.nestedFoundation.parentDepth).toBeLessThanOrEqual(
      MAX_CLARIFICATION_DEPTH,
    );
    expect(saved.index - saved.nestedFoundation.baseIndex).toBe(saved.state.frames.length);
  }
  expect(parent.querySelector('[data-missing-step="bm-variance-cross"]')).toBe(panel);
  expect(reader.querySelector("[data-reader-announcement]")?.textContent).toContain(
    "deepest explanation was replaced",
  );
  await travel(() => must<HTMLButtonElement>(foundation, "[data-reader-close]").click());
  expect(document.activeElement).toBe(tool);
  await travel(() => must<HTMLButtonElement>(parent, "[data-compass-return]").click());
  expect(document.activeElement).toBe(origin);
});

test("an invalid nested origin on remount cannot manufacture a registered parent", async () => {
  const { parent, tool } = await openParent();
  await click(tool);
  const saved = structuredClone(history.state);
  saved.annusReader.nestedFoundation.baseIndex = saved.annusReader.index + 1;
  await act(async () => root.unmount());
  history.replaceState(saved, "", location.href);
  await mountReader();
  expect(foundation.open).toBe(true);
  expect(parent.open).toBe(false);
  expect(history.state.annusReader.nestedFoundation).toBeUndefined();
  expect(new URLSearchParams(location.search).get("open")).toBe(`foundation:${FOUNDATION}`);
});

test("a remounted child restores its parent and gives further prerequisite links distinct return IDs", async () => {
  const { parent, tool } = await openParent();
  await click(tool);
  const toolId = tool.id;
  await act(async () => root.unmount());
  await mountReader();
  expect(parent.open).toBe(true);
  expect(foundation.open).toBe(true);
  const restoredTool = must<HTMLAnchorElement>(parent, `a[data-foundation="${FOUNDATION}"]`);
  visibleAt(restoredTool, () => 500 - parent.scrollTop);
  expect(restoredTool.id).toBe(toolId);
  const next = must<HTMLAnchorElement>(foundation, 'a[data-foundation="mean-variance-rms"]');
  visibleAt(next, () => 220);
  await click(next);
  expect(next.id).not.toBe(toolId);
  await travel(() => foundation.dispatchEvent(new Event("cancel", { cancelable: true })));
  expect(document.activeElement).toBe(next);
  await travel(() => must<HTMLButtonElement>(foundation, "[data-reader-close]").click());
  expect(document.activeElement).toBe(restoredTool);
  await travel(() => must<HTMLButtonElement>(parent, "[data-compass-return]").click());
  expect(document.activeElement).toBe(origin);
});
