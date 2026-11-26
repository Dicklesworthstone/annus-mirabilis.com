import { afterEach, beforeAll, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import FoundationPage from "../../app/foundations/[concept]/page.tsx";
import { loadPaper } from "../../content/server.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { loadBilingualEdition } from "../faces/bilingualLoader.ts";
import { mountSourceClarifications } from "../SourceClarificationController.tsx";
import { activeDirectOpenDialog } from "../stack/mountDirectOpen.ts";
import { attachSplitReader } from "./controller.ts";
import { SplitReadingView } from "./SplitReadingView.tsx";

const PATH = "/papers/brownian-motion/s4/view/split/";
const SETTINGS =
  "?panes=reading%2Cenglish&split-pane=companion&detail=2&notation=modern&extra=keep";
const ANCHOR = "arg-bm-observable";
const LESSON = "mean-variance-rms";
const CHILD = "bridge-negative-numbers-direction";
let markup = "";
const pages = new Map<string, string>();
let root: HTMLElement;
let owner: ReturnType<typeof mountSourceClarifications> | undefined;
let detachSplit: (() => void) | undefined;
let originalFetch: typeof fetch;
let requests: string[];

function must<T extends Element>(scope: ParentNode, selector: string): T {
  const node = scope.querySelector<T>(selector);
  assert(node, `Missing ${selector}`);
  return node;
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

function measurable(element: HTMLElement) {
  element.getBoundingClientRect = () => new DOMRect(20, 160, 300, 40);
  element.getClientRects = () => [element.getBoundingClientRect()] as unknown as DOMRectList;
}

async function click(link: HTMLElement) {
  await act(async () => link.click());
}

async function lesson(id: string) {
  await until(
    () =>
      document.querySelector(
        `dialog[open] [data-split-foundation="${id}"] [data-lesson-state=loaded]`,
      ) !== null,
    `the loaded ${id} lesson`,
  );
  return must<HTMLElement>(document, `dialog[open] [data-split-foundation="${id}"]`);
}

async function back() {
  await act(async () => {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Expected browser Back")), 1500);
      window.addEventListener(
        "popstate",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
      history.back();
    });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

beforeAll(async () => {
  const payload = await loadPaper("brownian-motion");
  markup = renderToStaticMarkup(
    await SplitReadingView({
      payload,
      edition: await loadBilingualEdition("brownian-motion"),
      section: "s4",
      availability: {},
    }),
  );
  for (const id of [LESSON, CHILD]) {
    const page = await FoundationPage({ params: Promise.resolve({ concept: id }) });
    pages.set(`/foundations/${id}/`, `<main>${await exportMarkup(page)}</main>`);
  }
}, 30000);

beforeEach(async () => {
  await installDom({ intersections: "visible" });
  history.replaceState({ unrelated: "kept" }, "", `${PATH}${SETTINGS}#${ANCHOR}`);
  window.scrollBy = () => {};
  document.body.innerHTML = markup;
  root = must<HTMLElement>(document, "[data-reader-root]");
  for (const element of root.querySelectorAll<HTMLElement>("a, [id]")) measurable(element);
  requests = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const href = String(input);
    requests.push(href);
    return new Response(pages.get(href) ?? "missing", { status: pages.has(href) ? 200 : 404 });
  }) as typeof fetch;
});

afterEach(async () => {
  await act(async () => owner?.dispose());
  owner = undefined;
  detachSplit?.();
  detachSplit = undefined;
  globalThis.fetch = originalFetch;
  await uninstallDom();
});

async function mount() {
  const comparison = must<HTMLElement>(root, "[data-split-comparison]");
  detachSplit = attachSplitReader(comparison, {
    paper: "brownian-motion",
    section: "s4",
    sections: ["s4"],
    argumentSections: { [ANCHOR]: "s4", "arg-bm-diffusion-equation": "s4" },
    sectionHrefs: { s4: PATH },
    faceHrefs: {
      parallel: "/papers/brownian-motion/s4/view/parallel/",
      german: "/papers/brownian-motion/s4/view/german/",
      english: "/papers/brownian-motion/s4/view/english/",
      gloss: "/papers/brownian-motion/s4/view/gloss/",
      reading: "/papers/brownian-motion/s4/",
      results: "/papers/brownian-motion/s4/view/results/",
      facsimile: "/papers/brownian-motion/s4/view/facsimile/",
    },
  });
  owner = mountSourceClarifications(root);
  await act(async () => owner?.ready);
}

test("the published split explanation keeps ordinary foundation and laboratory destinations without JavaScript", () => {
  const foundations = [...root.querySelectorAll<HTMLAnchorElement>("a[data-foundation]")];
  const labs = [...root.querySelectorAll<HTMLAnchorElement>("a[data-clarification-open]")];
  expect(foundations.length).toBeGreaterThan(0);
  expect(labs.length).toBeGreaterThan(0);
  for (const link of foundations)
    expect(link.getAttribute("href")).toBe(`/foundations/${link.dataset.foundation}/`);
  for (const link of labs)
    expect(link.getAttribute("href")).toBe(
      `/lab/${link.dataset.clarificationOpen?.replace("instrument-view:", "")}/`,
    );
  expect(root.querySelector("dialog")).toBeNull();
  expect(root.querySelector("[data-split-lesson-cache]")).toBeNull();
});

test("recursive split lessons at 320px keep the live parent construction, exact trigger, panes and original history entry", async () => {
  (
    window as unknown as {
      happyDOM: { setWindowSize(size: { width: number; height: number }): void };
    }
  ).happyDOM.setWindowSize({ width: 320, height: 700 });
  await mount();
  const base = location.href;
  const source = must<HTMLElement>(root, "[data-split-source-content]");
  const trigger = must<HTMLAnchorElement>(
    root,
    `#pane-b--${ANCHOR} a[data-foundation="${LESSON}"]`,
  );
  await click(trigger);
  const first = await lesson(LESSON);
  await until(
    () => first.querySelector("[data-construction-slot] textarea") !== null,
    "the real lesson construction",
  );
  const input = must<HTMLTextAreaElement>(first, "[data-construction-slot] textarea");
  await act(async () => {
    input.value = "1, 2, 6";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () =>
    input.form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  const accepted = must<HTMLElement>(first, "[data-construction-slot] [role=status]").textContent;
  expect(accepted).toContain("3 observations");
  const slot = must<HTMLElement>(first, "[data-lesson-body]");
  const nested = must<HTMLAnchorElement>(first, `a[data-foundation="${CHILD}"]`);
  measurable(nested);
  expect(activeDirectOpenDialog(document)?.frame.anchor).toBe(ANCHOR);
  expect(activeDirectOpenDialog(document)?.frame.face).toBe("split");
  expect(activeDirectOpenDialog(document)?.frame.question).toBe(
    must(root, `#pane-b--${ANCHOR} [data-clarification-question]`).textContent,
  );
  await click(nested);
  await lesson(CHILD);
  expect(activeDirectOpenDialog(document)?.depth).toBe(2);
  await back();
  const returned = await lesson(LESSON);
  await until(() => document.activeElement === nested, "focus on the exact prerequisite link");
  expect(must(returned, "[data-lesson-body]")).toBe(slot);
  expect(must<HTMLTextAreaElement>(returned, "[data-construction-slot] textarea")).toBe(input);
  expect(input.value).toBe("1, 2, 6");
  expect(must(returned, "[data-construction-slot] [role=status]").textContent).toBe(accepted);
  expect(requests.filter((href) => href === `/foundations/${LESSON}/`)).toHaveLength(1);
  await click(must<HTMLButtonElement>(document, "dialog[open] [data-clarification-close]"));
  await until(() => !document.querySelector("dialog[open]"), "return to the split reading");
  await until(() => document.activeElement === trigger, "the exact original lesson link");
  expect(location.href).toBe(base);
  expect(history.state.unrelated).toBe("kept");
  expect(must(root, "[data-split-source-content]")).toBe(source);
  expect(must<HTMLSelectElement>(root, "[data-split-source-choice]").value).toBe("english");
  expect(must<HTMLElement>(root, "[data-split-role=source]").hidden).toBe(true);
  expect(must<HTMLElement>(root, "[data-split-role=companion]").hidden).toBe(false);
});

test("split laboratories use the real shared session and browser Forward restores its accepted run", async () => {
  await mount();
  const base = location.href;
  const trigger = must<HTMLAnchorElement>(
    root,
    '[data-clarification-open="instrument-view:bm-06"]',
  );
  await click(trigger);
  await until(
    () => !!document.querySelector('dialog[open] [data-instrument-id="bm-06"][data-run-id]'),
    "the real Brownian lab",
  );
  const first = must<HTMLElement>(document, 'dialog[open] [data-instrument-id="bm-06"]');
  const identity = { instance: first.dataset.instanceId, run: first.dataset.runId };
  const opened = { state: structuredClone(history.state), href: location.href };
  expect(activeDirectOpenDialog(document)?.frame.anchor).toBe("arg-bm-diffusion-equation");
  await back();
  expect(location.href).toBe(base);
  expect(document.activeElement).toBe(trigger);
  // happy-dom truncates Forward on replaceState. Replay the captured real history entry.
  await act(async () => {
    history.replaceState(opened.state, "", opened.href);
    window.dispatchEvent(new PopStateEvent("popstate", { state: opened.state }));
  });
  await until(
    () => !!document.querySelector('dialog[open] [data-instrument-id="bm-06"][data-run-id]'),
    "the retained lab",
  );
  const restored = must<HTMLElement>(document, 'dialog[open] [data-instrument-id="bm-06"]');
  expect(restored.dataset.instanceId).toBe(identity.instance);
  expect(restored.dataset.runId).toBe(identity.run);
  expect(new URLSearchParams(location.search).get("panes")).toBe("reading,english");
});

test("a direct lesson link closes locally; invalid targets and modified clicks keep normal navigation", async () => {
  const direct = new URL(location.href);
  direct.searchParams.set("open", `foundation:${LESSON}`);
  history.replaceState(history.state, "", direct);
  await mount();
  const parent = await lesson(LESSON);
  const nested = must<HTMLAnchorElement>(parent, `a[data-foundation="${CHILD}"]`);
  measurable(nested);
  await click(nested);
  await lesson(CHILD);
  expect(activeDirectOpenDialog(document)?.depth).toBe(2);
  await act(async () => {
    must<HTMLDialogElement>(document, "dialog[open]").dispatchEvent(
      new Event("cancel", { cancelable: true }),
    );
  });
  await lesson(LESSON);
  await until(
    () => document.activeElement === nested,
    "Escape returning to the parent lesson link",
  );
  await click(must<HTMLButtonElement>(document, "dialog[open] [data-compass-return]"));
  expect(new URLSearchParams(location.search).has("open")).toBe(false);
  expect(location.pathname).toBe(PATH);
  expect(location.hash).toBe(`#${ANCHOR}`);
  const modified = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
  const trigger = must<HTMLAnchorElement>(root, `a[data-foundation="${LESSON}"]`);
  trigger.dispatchEvent(modified);
  expect(modified.defaultPrevented).toBe(false);
  await act(async () => owner?.dispose());
  owner = undefined;
  const unknown = new URL(location.href);
  unknown.searchParams.set("open", "foundation:unknown-lesson");
  history.replaceState(history.state, "", unknown);
  owner = mountSourceClarifications(root);
  await act(async () => owner?.ready);
  expect(document.querySelector("dialog[open]")).toBeNull();
  expect(requests).not.toContain("/foundations/unknown-lesson/");
});
