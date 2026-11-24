import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { attachInlineLighting, type InlinePin } from "../equations/InlineTermLighting.tsx";
import { TERM_READY_EVENT } from "../equations/termNavigation.ts";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { FaceChooser } from "./FaceChooser.tsx";
import { AlignmentController } from "./faces/AlignmentController.tsx";
import { mountSourceClarifications } from "./SourceClarificationController.tsx";

const PATH = "/papers/brownian-motion/s4/view/english/";
const SETTINGS = "?detail=2&lens=modern&notation=modern&units=cgs&extra=keep";
const ANCHOR = "s4-p1";
const OPEN = "instrument-view:bm-06";
let reactRoot: Root | null = null;
let directMount: ReturnType<typeof mountSourceClarifications> | null = null;
let detachInline: (() => void) | null = null;
let sourceRoot: HTMLElement;
let passage: HTMLElement;
let container: HTMLElement;

function must<T extends Element>(scope: ParentNode, selector: string): T {
  const element = scope.querySelector<T>(selector);
  assert(element, `Missing ${selector}`);
  return element;
}

async function until(ready: () => boolean, label: string) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (ready()) return;
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    });
  }
  throw new Error(`Expected ${label}`);
}

function withOpen(value = OPEN) {
  const url = new URL(`${PATH}${SETTINGS}#${ANCHOR}`, location.origin);
  url.searchParams.set("open", value);
  return url.pathname + url.search + url.hash;
}

async function mountChooser() {
  reactRoot = createRoot(container);
  await act(async () => {
    reactRoot?.render(
      <>
        <FaceChooser paperId="brownian-motion" section="s4" current="english" />
        <AlignmentController
          index={{
            sourceToTarget: new Map(),
            targetToSource: new Map(),
            orderedSentenceIds: [ANCHOR],
            orderedUnitIds: [],
          }}
        />
      </>,
    );
  });
}

async function laboratory() {
  await until(
    () => document.querySelector('dialog[open] section[data-instrument-id="bm-06"]') !== null,
    "the real Brownian laboratory in the source clarification",
  );
  return must<HTMLElement>(
    document,
    'dialog[open] section[data-instrument-id="bm-06"]',
  );
}

function expectSourceAddress() {
  const query = new URLSearchParams(location.search);
  expect(location.pathname).toBe(PATH);
  expect(location.hash).toBe(`#${ANCHOR}`);
  expect(query.get("detail")).toBe("2");
  expect(query.get("lens")).toBe("modern");
  expect(query.get("notation")).toBe("modern");
  expect(query.get("units")).toBe("cgs");
  expect(query.get("extra")).toBe("keep");
  expect(history.state.unrelated).toBe("kept");
  expect(sourceRoot.dataset.view).toBe("english");
  expect(document.getElementById(ANCHOR)).toBe(passage);
}

beforeEach(async () => {
  await installDom({ intersections: "visible" });
  history.replaceState({ unrelated: "kept" }, "", `${PATH}${SETTINGS}#${ANCHOR}`);
  // A source face owns its face on the reader root even when the prepaint default says reading.
  document.documentElement.dataset.view = "reading";
  window.scrollBy = () => {};
  sourceRoot = document.createElement("div");
  sourceRoot.dataset.readerRoot = "";
  sourceRoot.dataset.view = "english";
  sourceRoot.innerHTML = `<p id="${ANCHOR}" data-source-sentence data-sentence-id="${ANCHOR}" tabindex="-1">The source passage remains here.</p>`;
  document.body.append(sourceRoot);
  passage = must<HTMLElement>(sourceRoot, `#${ANCHOR}`);
  passage.getBoundingClientRect = () => new DOMRect(20, 120, 500, 44);
  passage.getClientRects = () => [passage.getBoundingClientRect()] as unknown as DOMRectList;
  container = document.createElement("div");
  sourceRoot.prepend(container);
});

afterEach(async () => {
  detachInline?.();
  detachInline = null;
  directMount?.dispose();
  directMount = null;
  await act(async () => reactRoot?.unmount());
  reactRoot = null;
  await uninstallDom();
});

test("the actual source chooser opens a registered laboratory and returns to the same source passage", async () => {
  history.replaceState(history.state, "", withOpen());
  await mountChooser();
  const lab = await laboratory();
  expect(lab.dataset.runId).toBeTruthy();
  expect(Number.isSafeInteger(Number(lab.dataset.snapshotVersion))).toBe(true);
  const { activeDirectOpenDialog } = await import("./stack/mountDirectOpen.ts");
  expect(activeDirectOpenDialog(document)?.frame.face).toBe("english");
  expect(activeDirectOpenDialog(document)?.frame.anchor).toBe(ANCHOR);
  expectSourceAddress();
  const dialog = must<HTMLDialogElement>(document, "dialog[data-instrument-clarification-dialog][open]");
  await act(async () => must<HTMLButtonElement>(dialog, "[data-compass-return]").click());
  expect(dialog.open).toBe(false);
  expect(new URLSearchParams(location.search).has("open")).toBe(false);
  expect(document.activeElement).toBe(passage);
  expectSourceAddress();
});

test("Back closes a source laboratory and a restored Forward entry reuses its accepted instance", async () => {
  const base = { state: structuredClone(history.state), href: location.href };
  history.pushState(history.state, "", withOpen());
  await mountChooser();
  const first = await laboratory();
  const identity = { instance: first.dataset.instanceId, run: first.dataset.runId };
  const opened = { state: structuredClone(history.state), href: location.href };
  await act(async () => {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Expected Back to the source")), 1500);
      window.addEventListener("popstate", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      history.back();
    });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
  expect(document.querySelector("dialog[data-instrument-clarification-dialog][open]")).toBeNull();
  expect(location.href).toBe(base.href);
  expect(document.activeElement).toBe(passage);
  expectSourceAddress();
  // happy-dom replaceState truncates Forward entries. Replay the actual captured browser entry,
  // as the existing nestedFoundationReturn suite does, so its real lifecycle handler is exercised.
  await act(async () => {
    history.replaceState(opened.state, "", opened.href);
    window.dispatchEvent(new PopStateEvent("popstate", { state: opened.state }));
  });
  const restored = await laboratory();
  expect(restored.dataset.instanceId).toBe(identity.instance);
  expect(restored.dataset.runId).toBe(identity.run);
  expectSourceAddress();
});

test("source sentence shortcuts do not consume the opened laboratory's keyboard input", async () => {
  history.replaceState(history.state, "", withOpen());
  await mountChooser();
  const lab = await laboratory();
  const input = must<HTMLInputElement>(lab, "input");
  input.focus();
  const event = new KeyboardEvent("keydown", {
    key: "ArrowDown",
    bubbles: true,
    cancelable: true,
  });
  await act(async () => input.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(false);
  expect(document.activeElement).toBe(input);
  expect(sourceRoot.querySelector("[data-aligned-active]")).toBeNull();
});

test("a cancelled asynchronous opening never mounts after the source route has gone away", async () => {
  history.replaceState(history.state, "", withOpen());
  directMount = mountSourceClarifications(sourceRoot);
  directMount.dispose();
  await directMount.ready;
  expect(document.querySelector("dialog[data-instrument-clarification-dialog][open]")).toBeNull();
  expectSourceAddress();
});

test("ordinary, duplicate and invalid targets leave source reading and its URL intact", async () => {
  for (const search of [
    SETTINGS,
    `${SETTINGS}&open=instrument-view%3Abm-06&open=term%3AdiffusionCoefficient`,
    `${SETTINGS}&open=instrument-view%3Abm-06%3Abad%3Aaddress`,
    `${SETTINGS}&open=foundation%3Aprobability-independence`,
  ]) {
    history.replaceState(history.state, "", `${PATH}${search}#${ANCHOR}`);
    const before = location.href;
    directMount = mountSourceClarifications(sourceRoot);
    await directMount.ready;
    expect(document.querySelector("dialog[data-instrument-clarification-dialog][open]")).toBeNull();
    expect(location.href).toBe(before);
    expectSourceAddress();
    directMount.dispose();
    directMount = null;
  }
});

test("the shared inline owner reports a missing term target instead of claiming it opened", async () => {
  const { openFromSearch } = await import("./stack/mountDirectOpen.ts");
  expect(openFromSearch(document, "?open=term%3AnoPublishedQuantityHere")).toBe(false);
  expect(document.querySelector("dialog[data-instrument-clarification-dialog][open]")).toBeNull();
});

test("a delayed inline owner handles the saved source term once without repinning after Escape", async () => {
  const outer = document.createElement("main");
  sourceRoot.before(outer);
  outer.append(sourceRoot);
  passage.innerHTML =
    '<span class="inline-math" data-inline-terms data-paper="brownian-motion">' +
    '<span data-quantity-id="diffusionCoefficient">D</span></span>';
  const formula = must<HTMLElement>(passage, ".inline-math");
  const glyph = must<HTMLElement>(formula, "[data-quantity-id]");
  const pins: (InlinePin | null)[] = [];
  history.replaceState(history.state, "", withOpen("term:brownian-motion/diffusionCoefficient"));
  const address = location.href;
  directMount = mountSourceClarifications(sourceRoot);
  await directMount.ready;
  expect(pins).toEqual([]);
  expect(glyph.hasAttribute("data-lit")).toBe(false);
  expect(document.querySelector("dialog[data-instrument-clarification-dialog]")).toBeNull();

  // The real inline owner attaches to the outer main after the source adapter tried to open.
  // Its readiness event bubbles through document, not through the inner source reader root.
  await act(async () => {
    detachInline = attachInlineLighting(outer, "brownian-motion", (pin) => pins.push(pin));
    await Promise.resolve();
  });
  expect(pins.length).toBe(1);
  expect(pins[0]?.quantityId).toBe("diffusionCoefficient");
  expect(pins[0]?.formula).toBe(formula);
  expect(glyph.getAttribute("data-lit")).toBe("true");
  expect(document.activeElement).toBe(formula);
  expect(location.href).toBe(address);
  expect(history.state.annusClarification).toBeUndefined();
  expectSourceAddress();

  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  expect(pins.at(-1)).toBeNull();
  const afterEscape = pins.length;
  await act(async () => {
    outer.dispatchEvent(new Event(TERM_READY_EVENT, { bubbles: true }));
    await Promise.resolve();
  });
  expect(pins.length).toBe(afterEscape);
  expect(glyph.hasAttribute("data-lit")).toBe(false);
  expect(location.href).toBe(address);
  expect(document.querySelector("dialog[data-instrument-clarification-dialog]")).toBeNull();
});
