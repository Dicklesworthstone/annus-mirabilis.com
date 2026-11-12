import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { PaperPage } from "../PaperPage.tsx";
import { mountReaderNotebook } from "./browser.ts";
import { exportNotebookHtml, exportNotebookJson } from "./export.ts";
import { authoredLastPlace } from "./lastFrame.ts";
import { createNotebookStore, type NotebookStorage } from "./notebookStore.ts";
import { notebookFrameHref, parseNotebookDocument } from "./schema.ts";

const PAPER = "brownian-motion";
const SECTION = "s4";
const FACES = ["german", "english", "parallel", "gloss"] as const;
type Face = (typeof FACES)[number];
const pages = new Map<Face, Promise<string>>();
const cleanup: (() => void)[] = [];

beforeEach(installDom);
afterEach(async () => {
  for (const dispose of cleanup.splice(0)) dispose();
  await uninstallDom();
});

function page(face: Face) {
  let html = pages.get(face);
  if (!html) {
    html = PaperPage({ paperId: PAPER, section: SECTION, face }).then(exportMarkup);
    pages.set(face, html);
  }
  return html;
}

function backend() {
  let saved: string | null = null;
  let blocked = false;
  const storage: NotebookStorage = {
    maxBytes: 1_048_576,
    read: () =>
      blocked
        ? { status: "unavailable" }
        : saved === null
          ? { status: "missing" }
          : { status: "ok", value: saved },
    write: (document) => {
      if (blocked) return { status: "unavailable" };
      saved = JSON.stringify(document);
      return { status: "ok" };
    },
    decode: JSON.parse,
    preserve() {},
    discardFallback() {},
  };
  return {
    storage,
    saved: () => saved,
    block: () => {
      blocked = true;
    },
  };
}

async function mount(face: Face, io = backend()) {
  document.body.innerHTML = `<header><a id="trigger" href="/notebook/">Notebook</a><div id="host"></div></header><main>${await page(face)}</main>`;
  const location = {
    pathname: `/papers/${PAPER}/${SECTION}/view/${face}/`,
    search: "?detail=2&lens=modern&private=not-for-a-link",
    hash: "",
  };
  const store = createNotebookStore(io.storage);
  const dispose = mountReaderNotebook(
    document.getElementById("host") as HTMLElement,
    document.getElementById("trigger") as HTMLAnchorElement,
    store,
    () => location,
    { dismissed: () => null, dismiss() {} },
  );
  cleanup.push(dispose);
  return { store, io, dispose };
}

function target(face: Face, englishHalf = false): HTMLElement {
  const selector =
    face === "gloss"
      ? 'section.gloss-sentence[id^="s4-p"]'
      : face === "english" || englishHalf
        ? "p.translation-paragraph[data-source-paragraph]"
        : ".source-paragraph[id]";
  const element = document.querySelector<HTMLElement>(selector);
  assert.ok(element, `The actual ${face} page must contain its source passage.`);
  return element;
}

function toggleFor(passage: HTMLElement): HTMLButtonElement {
  const button =
    passage.querySelector<HTMLButtonElement>(".notebook-save-toggle") ??
    passage.previousElementSibling?.querySelector<HTMLButtonElement>(".notebook-save-toggle");
  assert.ok(button, "The source passage needs its own usable notebook action.");
  return button;
}

function action(label: string): HTMLButtonElement {
  const button = [...document.querySelectorAll<HTMLButtonElement>(".notebook-save-item")].find(
    (candidate) => candidate.textContent === label,
  );
  assert.ok(button, `Missing notebook action: ${label}`);
  return button;
}

for (const face of FACES) {
  test(`the actual ${face} face saves a passage, exports it and reopens its exact source address`, async () => {
    const { store, io, dispose } = await mount(face);
    const passage = target(face);
    const originalText = passage.textContent;
    const toggle = toggleFor(passage);
    expect(toggle.getAttribute("aria-label")).toContain("Save to notebook");
    toggle.focus();
    toggle.click();
    expect(action("Save passage").closest('[role="group"]')).not.toBeNull();
    action("Save passage").click();
    const entry = store.getSnapshot().document.entries[0];
    assert.ok(entry);
    expect(entry.kind).toBe("note");
    expect(entry.frame).toMatchObject({
      paper: PAPER,
      view: face,
      detail: 2,
      lens: "modern",
      open: "",
    });
    expect(entry.text).toContain("excerpt");
    expect(entry.text).not.toContain("Save to notebook");
    expect(entry.text).not.toContain("Show the German source");
    expect(entry.text).not.toContain("Read the German sentence:");
    const href = notebookFrameHref(entry.frame);
    expect(href).toBe(
      `/papers/${PAPER}/${SECTION}/view/${face}/?detail=2&lens=modern#${entry.frame.anchor}`,
    );
    expect(href).not.toContain("not-for-a-link");
    expect(document.getElementById(entry.frame.anchor)).not.toBeNull();
    expect(toggle.hasAttribute("data-saved")).toBe(true);
    action("Save passage").click();
    expect(store.getSnapshot().document.entries.length).toBe(1);

    const exported = exportNotebookJson(store.getSnapshot().document);
    expect(parseNotebookDocument(JSON.parse(exported)).entries[0]).toEqual(entry);
    const readable = document.createElement("div");
    readable.innerHTML = exportNotebookHtml(store.getSnapshot().document);
    expect(readable.querySelector("article a")?.getAttribute("href")).toBe(
      `https://annus-mirabilis.com${href}`,
    );

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement === toggle).toBe(true);
    dispose();
    cleanup.pop();
    expect(document.querySelector(".notebook-save-toggle")).toBeNull();
    expect(passage.textContent).toBe(originalText);

    const reopened = await mount(face, io);
    expect(reopened.store.getSnapshot().document.entries[0]).toEqual(entry);
    expect(toggleFor(target(face)).hasAttribute("data-saved")).toBe(true);
  }, 60_000);
}

test("a private note in the parallel English half preserves its distinct en- anchor", async () => {
  const { store } = await mount("parallel");
  const passage = target("parallel", true);
  const toggle = toggleFor(passage);
  toggle.focus();
  toggle.click();
  action("Add a note").click();
  const field = document.querySelector<HTMLTextAreaElement>("#reading-notebook-text");
  assert.ok(field);
  const words = "My private question <script>must stay text</script>";
  field.value = words;
  field.closest("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  const entry = store.getSnapshot().document.entries[0];
  assert.ok(entry);
  expect(entry.text).toBe(words);
  expect(entry.frame.anchor.startsWith("en-")).toBe(true);
  expect(entry.frame.view).toBe("parallel");
  const href = notebookFrameHref(entry.frame);
  expect(
    document
      .getElementById(new URL(href, "https://annus-mirabilis.com").hash.slice(1))
      ?.closest('[data-parallel-half="english"]'),
  ).not.toBeNull();
  expect(href).not.toContain("private");
  const html = exportNotebookHtml(store.getSnapshot().document);
  expect(html).toContain("&lt;script&gt;must stay text&lt;/script&gt;");
  expect(html).not.toContain("<script>");
}, 60_000);

for (const face of ["english", "gloss"] as const) {
  test(`an interrupted ${face} reader retains the source excerpt and exact section after keyboard use`, async () => {
    const { store, io } = await mount(face);
    const passage = target(face);
    // happy-dom has no layout; supply the measured viewport boundary, not another notebook owner.
    const bounds = new DOMRect(0, 80, 600, 180);
    passage.getBoundingClientRect = () => bounds;
    passage.getClientRects = () => [bounds] as unknown as DOMRectList;
    window.dispatchEvent(new Event("pagehide"));
    expect(store.getSnapshot().document.lastPlace).toBeNull();
    const toggle = toggleFor(passage);
    toggle.focus();
    toggle.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    window.dispatchEvent(new Event("pagehide"));
    const place = store.getSnapshot().document.lastPlace;
    assert.ok(place);
    expect(place.recapKind).toBe("source-excerpt");
    expect(place.recap).toContain("excerpt");
    expect(notebookFrameHref(place.frame)).toContain(`/s4/view/${face}/`);
    const reopened = createNotebookStore(io.storage);
    reopened.open();
    expect(reopened.getSnapshot().document.lastPlace).toEqual(place);
    const html = exportNotebookHtml(reopened.getSnapshot().document);
    expect(html).toContain("An excerpt from the passage as it read when you saved it");
    expect(html).not.toContain("The recap as it read");
    expect(html).not.toContain("The overview as it read");
  }, 60_000);
}

test("source saving keeps the excerpt in this tab when browser storage is blocked", async () => {
  const io = backend();
  io.block();
  const { store } = await mount("german", io);
  toggleFor(target("german")).click();
  action("Save passage").click();
  expect(store.getSnapshot().persistence).toBe("session-only");
  expect(store.getSnapshot().document.entries[0]?.text).toContain("German source excerpt");
  expect(document.querySelector(".notebook-announcement")?.textContent).toContain(
    "Export them before leaving",
  );
  expect(io.saved()).toBeNull();
  expect(target("german").textContent?.length).toBeGreaterThan(0);
}, 60_000);

test("source resume refuses malformed foundation addresses without throwing", async () => {
  const { store } = await mount("english");
  const passage = target("english");
  toggleFor(passage).click();
  action("Save passage").click();
  const frame = store.getSnapshot().document.entries[0]?.frame;
  assert.ok(frame);
  const valid = authoredLastPlace(passage, frame);
  assert.ok(valid);
  expect(valid.recapKind).toBe("source-excerpt");
  expect(authoredLastPlace(passage, { ...frame, open: "foundation:bad!" })).toBeNull();
}, 60_000);
