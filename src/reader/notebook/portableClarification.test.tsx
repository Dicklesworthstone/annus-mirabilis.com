import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { getClarificationKind } from "../stack/kinds.ts";
import {
  parseInstrumentViewId,
  parseTermId,
  portableClarification,
  portableClarificationFromSearch,
} from "../stack/portableTargets.ts";
import { mountReaderNotebook } from "./browser.ts";
import { exportNotebookJson } from "./export.ts";
import { frameForPassage } from "./lastFrame.ts";
import { createNotebookStore, type NotebookStorage } from "./notebookStore.ts";
import {
  emptyNotebook,
  notebookFrameHref,
  parseNotebookDocument,
  parseNotebookFrame,
} from "./schema.ts";

const cleanup: (() => void)[] = [];
beforeEach(installDom);
afterEach(async () => {
  for (const dispose of cleanup.splice(0)) dispose();
  await uninstallDom();
});

const portable = [
  "",
  "foundation:mean-square",
  "instrument-view:bm-01",
  "instrument-view:sr-02:apparatus",
  "instrument-view:light-thread",
  "instrument-view:unknown-instrument",
  "term:gammaFactor",
  "term:rod-events/clockTime",
];
const refused = [
  "run:123",
  "instance:bm-01",
  "tape:private",
  "https://example.org/",
  "foundation:",
  "foundation:mean-square&note=private",
  "instrument-view:bm01",
  "instrument-view:bm-01:default:run-1",
  "instrument-view:bm-01/run-1",
  "instrument-view:../bm-01",
  "instrument-view:bm-01?seed=1905",
  "term:bad-term",
  "term:rod-events/clockTime/extra",
  "term:rod-events/",
  "term:1",
];

const frame = {
  paper: "brownian-motion",
  anchor: "s4-p1",
  view: "english",
  detail: 2,
  lens: "modern",
  open: "",
} as const;

test("public clarification addresses round-trip without admitting runtime or private fields", () => {
  for (const open of portable) {
    expect(portableClarification(open)).toBe(open);
    expect(parseNotebookFrame({ ...frame, open }).open).toBe(open);
    const href = new URL(notebookFrameHref({ ...frame, open }), "https://annus-mirabilis.com");
    expect(href.pathname).toBe("/papers/brownian-motion/s4/view/english/");
    expect(href.hash).toBe("#s4-p1");
    expect(href.searchParams.get("open") ?? "").toBe(open);
  }
  for (const open of refused) {
    expect(portableClarification(open)).toBeNull();
    expect(() => parseNotebookFrame({ ...frame, open })).toThrow();
  }
  for (const value of [undefined, null, 1, {}, ["term:gammaFactor"]])
    expect(portableClarification(value)).toBeNull();
});

test("the notebook retains its old length bound and foundation-only document format", () => {
  const atLimit = "foundation:" + "a".repeat(180 - "foundation:".length);
  expect(portableClarification(atLimit)).toBe(atLimit);
  expect(portableClarification(atLimit + "a")).toBeNull();
  const original = {
    ...emptyNotebook(),
    entries: [{
      id: "old-entry",
      kind: "example",
      frame: { ...frame, open: "foundation:mean-square" },
      title: "Mean square",
      text: "An earlier saved example",
      createdAt: "2026-09-17T14:00:00.000Z",
    }],
  };
  expect(parseNotebookDocument(JSON.parse(JSON.stringify(original)))).toEqual(original);
});

test("extracted reader parsers retain their existing grammar, including explicit unknown instruments", () => {
  const instruments = getClarificationKind("instrument-view");
  const terms = getClarificationKind("term");
  assert.ok(instruments && terms);
  for (const id of ["bm-01", "sr-02:apparatus", "unknown-instrument", "speed-0.6:mode-2"]) {
    expect(parseInstrumentViewId(id)).toEqual({ raw: id });
    expect(instruments.parseId(id)).toEqual({ raw: id });
  }
  for (const id of ["bm01", "bm-01:", "bm-01:mode:run", "../bm-01", "bm-01/run"]) {
    expect(parseInstrumentViewId(id)).toBeNull();
    expect(instruments.parseId(id)).toBeNull();
  }
  expect(parseTermId("gammaFactor")).toEqual({ routeSlug: null, termId: "gammaFactor" });
  expect(parseTermId("rod-events/clockTime")).toEqual({
    routeSlug: "rod-events", termId: "clockTime",
  });
  for (const id of ["gammaFactor", "rod-events/clockTime", "bad-term", "rod-events/clockTime/extra"])
    expect(terms.parseId(id)).toEqual(parseTermId(id));
  expect(parseTermId("bad-term")).toBeNull();
  expect(parseTermId("rod-events/clockTime/extra")).toBeNull();
});

test("ambiguous and invalid query targets never become notebook locations", () => {
  expect(portableClarificationFromSearch("?open=instrument-view%3Asr-02%3Aapparatus&tape=private"))
    .toBe("instrument-view:sr-02:apparatus");
  for (const search of [
    "",
    "?open=run%3Aprivate",
    "?open=foundation%3Amean-square&open=term%3AgammaFactor",
    "?open=instrument-view%3Abm-01%26note%3Dprivate",
    "?open=term%3A%ZZ",
  ]) expect(portableClarificationFromSearch(search)).toBe("");
});

function mount(open: string, reading = false) {
  delete document.documentElement.dataset.detail;
  delete document.documentElement.dataset.lens;
  const passageMarkup = reading
    ? '<article class="reader-passage" data-unit="arg-bm-observable" id="arg-bm-observable"><h3>What should I measure?</h3><p class="passage-question">Which average shows the spreading?</p><div data-reading="0"><p>Compare mean square displacement.</p></div><div class="passage-actions"><a href="/foundations/mean-square/" data-foundation="mean-square">Show me one example first</a></div></article>'
    : '<p id="s4-p1" class="translation-paragraph" data-source-paragraph="s4-p1">Consider the displacement of many particles during the same elapsed time.</p>';
  document.body.innerHTML = '<header><a id="trigger" href="/notebook/">Notebook</a><div id="host"></div></header><main><section data-reader-root data-view="' +
    (reading ? "reading" : "english") + '">' + passageMarkup + '</section></main>';
  let saved: string | null = null;
  const storage: NotebookStorage = {
    maxBytes: 1_048_576,
    read: () => saved === null ? { status: "missing" } : { status: "ok", value: saved },
    write: (document) => {
      saved = JSON.stringify(document);
      return { status: "ok" };
    },
    decode: JSON.parse,
    preserve() {},
    discardFallback() {},
  };
  const store = createNotebookStore(storage);
  const location = {
    pathname: reading ? "/papers/brownian-motion/" : "/papers/brownian-motion/s4/view/english/",
    search: "?detail=2&lens=modern&open=" + encodeURIComponent(open) +
      "&tape=private-tape&seed=1905&note=private-note",
    hash: "",
  };
  const dispose = mountReaderNotebook(
    document.getElementById("host") as HTMLElement,
    document.getElementById("trigger") as HTMLAnchorElement,
    store,
    () => location,
    { dismissed: () => null, dismiss() {} },
  );
  cleanup.push(dispose);
  const passage = document.getElementById(reading ? "arg-bm-observable" : "s4-p1");
  const toggle = document.querySelector<HTMLButtonElement>(".notebook-save-toggle");
  assert.ok(passage && toggle);
  return { store, storage, passage, toggle, location };
}

function action(label: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>(".notebook-save-item")]
    .find((candidate) => candidate.textContent === label);
  assert.ok(button, "The notebook action must be available: " + label);
  button.click();
}

for (const open of ["foundation:mean-square", "instrument-view:light-thread", "instrument-view:sr-02:apparatus", "term:rod-events/clockTime"]) {
  test("saving and remembering a source passage retains the public clarification " + open, () => {
    const { store, storage, passage, toggle, location } = mount(open);
    expect(frameForPassage(passage, location, passage)?.open).toBe(open);
    toggle.click();
    action("Save passage");
    const entry = store.getSnapshot().document.entries[0];
    assert.ok(entry);
    expect(entry.frame.open).toBe(open);
    const href = new URL(notebookFrameHref(entry.frame), "https://annus-mirabilis.com");
    expect(href.searchParams.get("open")).toBe(open);
    expect(href.pathname).toBe(location.pathname);
    expect(href.hash).toBe("#s4-p1");
    expect([...href.searchParams.keys()].sort()).toEqual(["detail", "lens", "open"]);
    const exported = exportNotebookJson(store.getSnapshot().document);
    expect(exported).not.toContain("private-tape");
    expect(exported).not.toContain("private-note");
    expect(parseNotebookDocument(JSON.parse(exported)).entries[0]).toEqual(entry);
    const reopened = createNotebookStore(storage);
    reopened.open();
    expect(reopened.getSnapshot().document.entries[0]).toEqual(entry);

    const bounds = new DOMRect(0, 80, 600, 180);
    passage.getBoundingClientRect = () => bounds;
    passage.getClientRects = () => [bounds] as unknown as DOMRectList;
    toggle.focus();
    toggle.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    window.dispatchEvent(new Event("pagehide"));
    expect(store.getSnapshot().document.lastPlace?.frame.open).toBe(open);
    expect(store.getSnapshot().document.lastPlace?.frame.anchor).toBe("s4-p1");
  });
}

test("a saved next step retains the active target while Save example selects its own foundation", () => {
  const { store, toggle } = mount("instrument-view:bm-01", true);
  toggle.click();
  action("Save next step");
  action("Save example");
  const entries = store.getSnapshot().document.entries;
  const nextStep = entries.find((entry) => entry.kind === "nextStep");
  const example = entries.find((entry) => entry.kind === "example");
  assert.ok(nextStep && example);
  expect(nextStep.frame.open).toBe("instrument-view:bm-01");
  expect(example.frame.open).toBe("foundation:mean-square");
});

test("saving a note from a term clarification keeps its context without placing private prose in its link", () => {
  const { store, toggle } = mount("term:gammaFactor");
  toggle.click();
  action("Add a note");
  const field = document.querySelector<HTMLTextAreaElement>("#reading-notebook-text");
  assert.ok(field);
  const words = "My private question about this symbol";
  field.value = words;
  field.closest("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  const entry = store.getSnapshot().document.entries[0];
  assert.ok(entry);
  expect(entry.frame.open).toBe("term:gammaFactor");
  expect(entry.text).toBe(words);
  expect(notebookFrameHref(entry.frame)).not.toContain("private");
});

test("unsupported or ambiguous open queries do not prevent saving the source passage", () => {
  const { store, passage, toggle, location } = mount("run:private");
  expect(frameForPassage(passage, location, passage)?.open).toBe("");
  location.search = "?open=foundation:mean-square&open=term:gammaFactor";
  expect(frameForPassage(passage, location, passage)?.open).toBe("");
  toggle.click();
  action("Save passage");
  const entry = store.getSnapshot().document.entries[0];
  assert.ok(entry);
  expect(entry.frame.open).toBe("");
  expect(notebookFrameHref(entry.frame)).not.toContain("open=");
});
