import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import type { Root } from "react-dom/client";
import RevisitPage from "../../app/discover/revisit/page.tsx";
import { getNotebookStore } from "../../reader/notebook/browserStore.ts";
import { exportNotebookHtml, exportNotebookJson } from "../../reader/notebook/export.ts";
import { createNotebookStore } from "../../reader/notebook/notebookStore.ts";
import { mountNotebookPanel } from "../../reader/notebook/panel.ts";
import { NOTEBOOK_KEY } from "../../reader/notebook/schema.ts";
import { createNotebookStorage } from "../../reader/notebook/storage.ts";
import { teachBackHref } from "../../reader/notebook/teachBackEntry.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { JOURNEY_NOTE_MANIFESTS } from "../journeys/JourneyNotebook.tsx";
import { KeptStageNotes } from "../notes/KeptStageNotes.tsx";
import { createStoredNotebookSession } from "../storedNotebook.ts";
import { REVISIT_CASES, REVISIT_OPTIONS, REVISIT_STAGE_LINKS } from "./catalogue.ts";
import { selectionFromHash } from "./RevisitBrowser.tsx";

function required<T>(value: T | null | undefined): T {
  assert.ok(value, "The actual revisit workflow must expose this element.");
  return value;
}
const BROWNIAN = required(
  REVISIT_CASES.find((item) => item.paper === "brownian-motion" && item.stageId === "step-03"),
);
const LIGHT = required(
  REVISIT_CASES.find((item) => item.paper === "light-quanta" && item.stageId === "step-07"),
);

describe("a reader revisits, keeps private reasoning and returns to the same changed case", () => {
  let container: HTMLElement;
  let root: Root;
  beforeEach(async () => {
    await installDom();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/discover/revisit/");
    expect(getNotebookStore().reloadConfirmed().ok).toBe(true);
    container = createContainer();
    const { createRoot } = await import("react-dom/client");
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    removeContainer(container);
    await uninstallDom();
  });
  const card = (id: string) =>
    required(container.querySelector<HTMLElement>(`[data-revisit-case="${id}"]`));
  const box = (id: string) => required(card(id).querySelector<HTMLTextAreaElement>("textarea"));
  async function choose(name: string, value: string) {
    const select = required(container.querySelector<HTMLSelectElement>(`select[name="${name}"]`));
    await act(async () => {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  async function type(id: string, value: string) {
    const field = box(id);
    await act(async () => {
      const setter = required(
        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set,
      );
      setter.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  async function save(id: string) {
    const button = required(
      card(id).querySelector<HTMLButtonElement>("[data-teach-back-answer] button"),
    );
    expect(button.disabled).toBe(false);
    await act(async () => button.click());
  }

  test("changing paper and case retains unsaved drafts and makes no notebook write", async () => {
    await act(async () => root.render(<RevisitPage />));
    const initial = window.localStorage.getItem(NOTEBOOK_KEY);
    const field = box(BROWNIAN.id);
    await type(BROWNIAN.id, "I am still deciding why the equilibrium stays the same.");
    await choose("revisit-paper", "light-quanta");
    await choose("revisit-case", LIGHT.id);
    expect(card(BROWNIAN.id).closest("[hidden]")).not.toBeNull();
    expect(card(LIGHT.id).closest("[hidden]")).toBeNull();
    await type(LIGHT.id, "Two inputs change the event's energy budget.");
    await choose("revisit-paper", "brownian-motion");
    await choose("revisit-case", BROWNIAN.id);
    expect(box(BROWNIAN.id)).toBe(field);
    expect(field.value).toBe("I am still deciding why the equilibrium stays the same.");
    expect(box(LIGHT.id).value).toBe("Two inputs change the event's energy budget.");
    expect(card(BROWNIAN.id).closest("[hidden]")).toBeNull();
    expect(window.localStorage.getItem(NOTEBOOK_KEY)).toBe(initial);
    expect(window.location.hash).toBe(`#explanation-${BROWNIAN.id}`);
    expect(window.location.href).not.toContain("equilibrium");
    expect(card(BROWNIAN.id).querySelector(".exercise-worked summary")?.textContent).toBe(
      "Compare with a worked explanation",
    );
  });

  test("answers append in the real notebook, survive reload and reopen this card from notebook and export", async () => {
    await act(async () => root.render(<RevisitPage />));
    const first = "The rates change; I need to separate the rate from equilibrium.";
    const revised =
      "Mobility and diffusion both halve while the equilibrium concentration profile stays the same.";
    await type(BROWNIAN.id, first);
    await save(BROWNIAN.id);
    await type(BROWNIAN.id, revised);
    await save(BROWNIAN.id);
    const reloaded = createNotebookStore(createNotebookStorage());
    reloaded.open();
    const entries = reloaded.getSnapshot().document.entries;
    expect(entries.map((item) => item.text)).toEqual([first, revised]);
    for (const entry of entries) {
      assert.equal(entry.kind, "teachBack");
      if (entry.kind !== "teachBack") continue;
      expect(entry.frame.paper).toBe(BROWNIAN.paper);
      expect(entry.frame.anchor).toBe(BROWNIAN.sourceAnchor);
      expect(entry.teachBack.promptId).toBe(BROWNIAN.id);
      expect(entry.teachBack.prompt).toBe(BROWNIAN.part.prompt);
      expect(teachBackHref(entry.frame.paper, entry.teachBack)).toBe(BROWNIAN.href);
    }
    const json = JSON.parse(exportNotebookJson(reloaded.getSnapshot().document));
    expect(json.entries).toEqual(entries);
    expect(exportNotebookHtml(reloaded.getSnapshot().document)).toContain(
      `https://annus-mirabilis.com${BROWNIAN.href}`,
    );
    const host = createContainer();
    const panel = mountNotebookPanel(host, reloaded, () => {}, { inline: true });
    try {
      expect(host.querySelector(`a[href="${BROWNIAN.href}"]`)).not.toBeNull();
      expect(host.textContent).toContain(first);
      expect(host.textContent).toContain(revised);
    } finally {
      panel.dispose();
      removeContainer(host);
    }
    await act(async () => root.render(<RevisitPage key="returned" />));
    expect(box(BROWNIAN.id).value).toBe("");
    const history = required(card(BROWNIAN.id).querySelector("[data-teach-back-answer] details"));
    expect(history.textContent).toContain(first);
    expect(history.textContent).toContain(revised);
    expect(
      card(BROWNIAN.id).querySelector("[data-exercise-part]")?.getAttribute("data-outcome"),
    ).toBe("needs-human-reading");
  });

  test("a saved fragment reveals its case on arrival and after a different paper was selected", async () => {
    window.history.replaceState(null, "", LIGHT.href);
    await act(async () => root.render(<RevisitPage />));
    expect(card(LIGHT.id).closest("[hidden]")).toBeNull();
    expect(card(BROWNIAN.id).closest("[hidden]")).not.toBeNull();
    await choose("revisit-paper", "brownian-motion");
    await type(BROWNIAN.id, "Keep this draft while following the other link.");
    await act(async () => {
      window.history.replaceState(null, "", LIGHT.href);
      window.dispatchEvent(new Event("hashchange"));
    });
    expect(card(LIGHT.id).closest("[hidden]")).toBeNull();
    expect(box(BROWNIAN.id).value).toBe("Keep this draft while following the other link.");
    expect(selectionFromHash("#%E0%A4%A", REVISIT_OPTIONS)).toBeNull();
    expect(selectionFromHash("#an-unrelated-anchor", REVISIT_OPTIONS)).toBeNull();
    expect(selectionFromHash("#revisit-paper-brownian-motion", REVISIT_OPTIONS)).toEqual({
      paper: "brownian-motion",
      caseId: "all",
    });
  });

  test("an explicitly saved discovery topic offers its changed case without inventing study history", async () => {
    const manifest = required(JOURNEY_NOTE_MANIFESTS.find((item) => item.paper === BROWNIAN.paper));
    const session = createStoredNotebookSession(manifest);
    session.load();
    session.capture(BROWNIAN.stageId, "A more viscous liquid should slow both fluxes.", null);
    expect(
      session.getSnapshot().document.entries.some((entry) => entry.stageId === BROWNIAN.stageId),
    ).toBe(true);
    await act(async () =>
      root.render(
        <KeptStageNotes manifests={JOURNEY_NOTE_MANIFESTS} revisits={REVISIT_STAGE_LINKS} />,
      ),
    );
    expect(container.querySelector(`a[href="${BROWNIAN.href}"]`)?.textContent).toBe(
      "Try this idea in a changed case",
    );
    expect(container.querySelector(`a[href="${LIGHT.href}"]`)).toBeNull();
    expect(container.querySelector(`a[href="${BROWNIAN.stageHref}"]`)).not.toBeNull();
  });
});
