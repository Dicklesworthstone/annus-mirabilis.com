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
import assert from "node:assert/strict";
import type { PreparedBm01Comparison } from "../../experiments/bm01/comparison.ts";
import { createBm01ComparisonSession } from "../../experiments/bm01/comparisonSession.ts";
import rawExample from "../../generated/bm01-comparison.json";
import { installDom, observedTestIntersections, uninstallDom } from "../../testing/reactDom.ts";
import { createNotebookStore, type NotebookStorage } from "./notebookStore.ts";
import { mountNotebookPanel } from "./panel.ts";
import { makeReplayEntry } from "./saveReplay.ts";
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
function backend(saved: unknown, maxBytes = 64000): NotebookStorage {
  let value: string | null = saved === null ? null : JSON.stringify(saved);
  return {
    maxBytes,
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
function mount(saved: unknown, maxBytes = 64000) {
  const io = backend(saved, maxBytes);
  const store = createNotebookStore(io);
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
  return { store, host, panel, shown, io };
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

  test("failed saved reload keeps an open note draft, then a successful retry replaces it", () => {
    const io = backend({ ...emptyNotebook(), entries: [entry] });
    const read = io.read;
    let blocked = false;
    io.read = () => (blocked ? { status: "unavailable" } : read());
    const store = createNotebookStore(io);
    store.open();
    const host = document.createElement("div");
    document.body.append(host);
    const panel = mountNotebookPanel(host, store, () => {}, { inline: true });
    const click = (name: string) => {
      const control = [...host.querySelectorAll("button")].find((b) => b.textContent === name);
      expect(control).toBeDefined();
      control?.click();
    };
    try {
      const replacement = {
        ...emptyNotebook(),
        entries: [{ ...entry, id: "other", text: "Saved in another tab" }],
      };
      io.write(replacement);
      store.checkForExternalChange();
      expect(store.getSnapshot().persistence).toBe("conflict");
      const before = store.getSnapshot();
      const saved = read();
      click("Edit note");
      const textarea = host.querySelector("textarea");
      const form = host.querySelector("form");
      if (!textarea || !form) throw new Error("The notebook editor is missing.");
      textarea.value = "An unfinished draft that must survive a failed load";
      click("Load saved notebook");
      blocked = true;
      click("Confirm");

      expect(store.getSnapshot()).toBe(before);
      expect(read()).toEqual(saved);
      expect(host.querySelector('[role="alert"]')?.textContent).toContain("unchanged");
      expect(textarea.value).toBe("An unfinished draft that must survive a failed load");
      expect(form.hidden).toBe(false);

      blocked = false;
      click("Load saved notebook");
      click("Confirm");
      expect(store.getSnapshot().document).toEqual(replacement);
      expect(store.getSnapshot().persistence).toBe("saved");
      expect(host.querySelector('[role="alert"]')?.textContent).toBe("");
      expect(textarea.value).toBe("");
      expect(form.hidden).toBe(true);
    } finally {
      panel.dispose();
    }
  });
});

/** Real scalar evidence, captured through the same boundary as the reader's Save action. */
async function savedComparisons() {
  const session = createBm01ComparisonSession(
    "notebook-panel-comparisons",
    rawExample as PreparedBm01Comparison,
    () => assert.fail("Opening a saved notebook must not start a calculation"),
  );
  const first = await makeReplayEntry(
    {
      state: session.getServerSnapshot(),
      passage: { contentRevision: null, translationRevision: null },
      before: "My first explanation",
      after: "My revised explanation",
      notes: "Saved notes",
    },
    "00000000-0000-4000-8000-000000000001",
    "2026-09-24T09:00:00.000Z",
  );
  return [first, { ...first, id: "00000000-0000-4000-8000-000000000002" }] as const;
}

function required<T extends Element = HTMLElement>(scope: ParentNode, selector: string): T {
  const element = scope.querySelector<T>(selector);
  assert.ok(element, `The mounted notebook must contain ${selector}`);
  return element;
}

async function openReplay(host: HTMLElement, id: string) {
  required<HTMLButtonElement>(host, `[data-replay-inspect="${id}"]`).click();
  const deadline = Date.now() + 5000;
  while (!host.querySelector(`[data-replay-entry="${id}"]`)) {
    assert.ok(Date.now() < deadline, "The saved comparison must open");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return required(host, `[data-replay-entry="${id}"]`);
}

async function settleReplayImports() {
  await Promise.all([import("./replayView.ts"), import("./replayCurrent.ts")]);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe("open notebook comparisons retain unrelated private work", () => {
  beforeEach(async () => {
    await installDom({ intersections: "manual" });
  });
  afterEach(async () => {
    await uninstallDom();
  });

  test("saving one comparison preserves another editor's draft and accepted evidence", async () => {
    const [first, second] = await savedComparisons();
    const { store, host, panel } = mount(
      { ...emptyNotebook(), entries: [first, second] },
      4 * 1_048_576,
    );
    try {
      const firstView = await openReplay(host, first.id);
      const secondView = await openReplay(host, second.id);
      const draft = required<HTMLTextAreaElement>(secondView, '[data-replay-field="before"]');
      draft.value = "An unfinished explanation in the other comparison";
      required<HTMLTextAreaElement>(firstView, '[data-replay-field="notes"]').value =
        "The first comparison is now saved";
      required<HTMLFormElement>(firstView, "form").dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );

      expect(firstView.isConnected).toBe(false);
      expect(required(host, `[data-replay-entry="${second.id}"]`)).toBe(secondView);
      expect(required(secondView, '[data-replay-field="before"]')).toBe(draft);
      expect(draft.value).toBe("An unfinished explanation in the other comparison");
      expect(observedTestIntersections()).toContain(secondView);
      expect(observedTestIntersections()).not.toContain(firstView);
      expect(store.getSnapshot().document.entries.find((item) => item.id === second.id)).toEqual(
        second,
      );

      // Its original handler must still save the retained draft to the right entry.
      required<HTMLFormElement>(secondView, "form").dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      const saved = store.getSnapshot().document.entries.find((item) => item.id === second.id);
      assert.ok(saved?.kind === "replay");
      expect(saved.replay.explanationBefore).toBe(
        "An unfinished explanation in the other comparison",
      );
      expect(saved.replay.baseline).toEqual(second.replay.baseline);
      expect(saved.replay.variant).toEqual(second.replay.variant);
      expect(saved.replay.tape).toEqual(second.replay.tape);
      expect(store.getSnapshot().document.entries.find((item) => item.id === first.id)?.text).toBe(
        "The first comparison is now saved",
      );
    } finally {
      panel.dispose();
    }
  });

  test("remember and retry preserve the focused textarea and selection", async () => {
    const [first] = await savedComparisons();
    const { store, host, panel } = mount({ ...emptyNotebook(), entries: [first] }, 4 * 1_048_576);
    try {
      const view = await openReplay(host, first.id);
      const article = view.closest("article");
      const section = article?.parentElement;
      const draft = required<HTMLTextAreaElement>(view, '[data-replay-field="after"]');
      draft.value = "Keep my unfinished explanation and selected words";
      draft.focus();
      draft.setSelectionRange(8, 18, "backward");
      expect(store.remember(place).ok).toBe(true);
      expect(store.retry().ok).toBe(true);

      expect(view.isConnected).toBe(true);
      expect(view.closest("article")).toBe(article);
      expect(article?.parentElement).toBe(section);
      expect(document.activeElement).toBe(draft);
      expect(draft.value).toBe("Keep my unfinished explanation and selected words");
      expect(draft.selectionStart).toBe(8);
      expect(draft.selectionEnd).toBe(18);
      expect(draft.selectionDirection).toBe("backward");
      expect(observedTestIntersections()).toEqual([view]);
      expect(store.getSnapshot().document.entries).toEqual([first]);
    } finally {
      panel.dispose();
    }
  });

  test("reviewed imports keep the current draft and add a separate version", async () => {
    const [first] = await savedComparisons();
    const { store, host, panel } = mount({ ...emptyNotebook(), entries: [first] }, 4 * 1_048_576);
    try {
      const view = await openReplay(host, first.id);
      const draft = required<HTMLTextAreaElement>(view, '[data-replay-field="notes"]');
      draft.value = "My current unfinished notes";
      const incoming = { ...first, text: "Different notes from the exported notebook" };
      const preview = store.previewImport({ ...emptyNotebook(), entries: [incoming] });
      assert.ok(preview.ok);
      expect(preview.review.plan.keptBoth).toBe(1);
      expect(store.commitMerge(preview.review).ok).toBe(true);

      expect(required(host, `[data-replay-entry="${first.id}"]`)).toBe(view);
      expect(draft.value).toBe("My current unfinished notes");
      const entries = store.getSnapshot().document.entries;
      expect(entries.find((item) => item.id === first.id)).toEqual(first);
      expect(entries.find((item) => item.id !== first.id)?.text).toBe(incoming.text);
      expect(host.querySelectorAll(".notebook-entry")).toHaveLength(2);
      expect(observedTestIntersections()).toEqual([view]);
    } finally {
      panel.dispose();
    }
  });

  test("confirmed reload replaces changed entries and disposes deleted comparisons", async () => {
    const [first, second] = await savedComparisons();
    const { store, host, panel, io } = mount(
      { ...emptyNotebook(), entries: [first, second] },
      4 * 1_048_576,
    );
    try {
      const firstView = await openReplay(host, first.id);
      const secondView = await openReplay(host, second.id);
      const changed = {
        ...first,
        replay: { ...first.replay, explanationBefore: "A saved revision from the other tab" },
      };
      expect(io.write({ ...emptyNotebook(), entries: [changed] }).status).toBe("ok");
      store.checkForExternalChange();
      expect(store.getSnapshot().persistence).toBe("conflict");
      expect(firstView.isConnected).toBe(true);
      expect(secondView.isConnected).toBe(true);
      expect(store.reloadConfirmed().ok).toBe(true);

      expect(firstView.isConnected).toBe(false);
      expect(secondView.isConnected).toBe(false);
      expect(observedTestIntersections()).toHaveLength(0);
      expect(host.querySelector(`[data-replay-inspect="${second.id}"]`)).toBeNull();
      const revised = await openReplay(host, first.id);
      expect(required<HTMLTextAreaElement>(revised, '[data-replay-field="before"]').value).toBe(
        "A saved revision from the other tab",
      );
      expect(store.clearConfirmed().ok).toBe(true);
      expect(revised.isConnected).toBe(false);
      expect(observedTestIntersections()).toHaveLength(0);
      expect(host.textContent).toContain("No entries yet");
    } finally {
      panel.dispose();
    }
  });

  test("pending opens survive unrelated saves and reject removed or replaced entries", async () => {
    const [first, second] = await savedComparisons();
    const { store, host, panel } = mount(
      { ...emptyNotebook(), entries: [first, second] },
      4 * 1_048_576,
    );
    try {
      required<HTMLButtonElement>(host, `[data-replay-inspect="${first.id}"]`).click();
      required<HTMLButtonElement>(host, `[data-replay-inspect="${second.id}"]`).click();
      expect(store.remember(place).ok).toBe(true);
      expect(store.remove(first.id).ok).toBe(true);
      expect(store.add(first).ok).toBe(true);
      await settleReplayImports();

      const retained = required(host, `[data-replay-entry="${second.id}"]`);
      expect(host.querySelector(`[data-replay-entry="${first.id}"]`)).toBeNull();
      const replacement = required<HTMLButtonElement>(host, `[data-replay-inspect="${first.id}"]`);
      expect(replacement.disabled).toBe(false);
      expect(replacement.hidden).toBe(false);
      expect(observedTestIntersections()).toEqual([retained]);

      // Clear while the replacement's own import is pending; neither it nor old work may attach.
      replacement.click();
      expect(store.clearConfirmed().ok).toBe(true);
      await settleReplayImports();
      expect(host.querySelector("[data-replay-entry]")).toBeNull();
      expect(observedTestIntersections()).toHaveLength(0);
    } finally {
      panel.dispose();
    }
  });

  test("disposing a panel invalidates its pending comparison import", async () => {
    const [first] = await savedComparisons();
    const { host, panel } = mount({ ...emptyNotebook(), entries: [first] }, 4 * 1_048_576);
    required<HTMLButtonElement>(host, `[data-replay-inspect="${first.id}"]`).click();
    panel.dispose();
    await settleReplayImports();
    expect(host.querySelector("[data-replay-entry]")).toBeNull();
    expect(observedTestIntersections()).toHaveLength(0);
  });
});
