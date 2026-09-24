/**
 * The notebook's controls follow what it holds.
 *
 * Before: an empty notebook, which is what every reader meets first on /notebook/ and in the
 * header's sheet, offered "Export notebook JSON", "Export readable notebook" and "Clear notebook"
 * beside "No entries yet", three buttons with nothing to act on. The two export buttons now appear
 * with the first entry, Clear stays while a remembered reading place is left to forget, and import
 * is always there, because a notebook reaches a new device through it exactly when that device's
 * notebook is empty.
 *
 * A real store over an in-memory backend, mounted into a happy-dom page.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { createNotebookStore, type NotebookStorage } from "./notebookStore.ts";
import { mountNotebookPanel } from "./panel.ts";
import { emptyNotebook } from "./schema.ts";

const frame = {
  paper: "brownian-motion",
  anchor: "arg-bm-observable",
  view: "reading",
  detail: 1,
  lens: "paper",
  open: "",
} as const;
const entry = {
  id: "n1",
  text: "Why does the mean square grow with time?",
  kind: "note",
  frame,
  title: "The observable",
  createdAt: "2026-09-24T09:00:00.000Z",
} as const;
const place = {
  frame,
  title: "The observable",
  recap: "The mean square adds.",
  recapKind: "authored-recap",
} as const;

/** The same in-memory backend the store's own tests use, holding one saved document. */
function backend(saved: unknown): NotebookStorage {
  let value: string | null = saved === null ? null : JSON.stringify(saved);
  return {
    maxBytes: 64000,
    read: () => (value === null ? { status: "missing" } : { status: "ok", value }),
    write(document: unknown) {
      value = JSON.stringify(document);
      return { status: "ok" };
    },
    decode: JSON.parse,
    preserve() {},
    discardFallback() {},
  } as unknown as NotebookStorage;
}

/** In the order the page uses (browser.ts): the store is opened, then the panel is mounted. */
function mount(saved: unknown) {
  const store = createNotebookStore(backend(saved));
  store.open();
  const host = document.createElement("div");
  document.body.append(host);
  const panel = mountNotebookPanel(host, store, () => {}, { inline: true });
  const control = (name: string) =>
    [...host.querySelectorAll("button")].find((b) => b.textContent === name);
  const shown = (name: string) => {
    const el = control(name);
    expect(el).toBeDefined();
    return el?.hidden === false;
  };
  return { store, host, panel, shown };
}

describe("the notebook's controls follow what it holds", () => {
  beforeEach(async () => {
    await installDom();
  });
  afterEach(async () => {
    await uninstallDom();
  });

  test("an empty notebook shows how to save and how to import, and no export or clear", () => {
    const { host, shown, panel } = mount(null);
    expect(host.textContent).toContain("No entries yet");
    expect(shown("Export notebook JSON")).toBe(false);
    expect(shown("Export readable notebook")).toBe(false);
    expect(shown("Clear notebook")).toBe(false);
    const importFile = host.querySelector<HTMLInputElement>('input[type="file"]');
    expect(importFile).not.toBeNull();
    expect(importFile?.hidden).toBe(false);
    panel.dispose();
  });

  test("the first entry brings both export buttons and clear", () => {
    const { store, shown, panel } = mount(null);
    expect(shown("Export notebook JSON")).toBe(false);
    expect(store.add(entry).ok).toBe(true);
    expect(shown("Export notebook JSON")).toBe(true);
    expect(shown("Export readable notebook")).toBe(true);
    expect(shown("Clear notebook")).toBe(true);
    panel.dispose();
  });

  test("a saved notebook opens with them", () => {
    const { shown, panel } = mount({ ...emptyNotebook(), entries: [entry] });
    expect(shown("Export notebook JSON")).toBe(true);
    expect(shown("Export readable notebook")).toBe(true);
    expect(shown("Clear notebook")).toBe(true);
    panel.dispose();
  });

  test("with no entries but a remembered reading place, clear stays and export does not", () => {
    const { shown, panel } = mount({ ...emptyNotebook(), lastPlace: place });
    expect(shown("Clear notebook")).toBe(true);
    expect(shown("Export notebook JSON")).toBe(false);
    expect(shown("Export readable notebook")).toBe(false);
    panel.dispose();
  });
});
