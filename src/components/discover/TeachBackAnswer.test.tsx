import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import type { Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import BrownianRoute from "../../app/discover/brownian-motion/page.tsx";
import LightQuantaRoute from "../../app/discover/light-quanta/page.tsx";
import MassEnergyRoute from "../../app/discover/mass-energy/page.tsx";
import RelativityRoute from "../../app/discover/special-relativity/page.tsx";
import { checkVoice } from "../../content/checks/voice/index.ts";
import { JOURNEY_NOTE_MANIFESTS } from "../../discovery/journeys/JourneyNotebook.tsx";
import type { NoteManifest } from "../../discovery/notebook.ts";
import { DiscoveryNotebookProvider } from "../../discovery/notes/context.tsx";
import { getNotebookStore } from "../../reader/notebook/browserStore.ts";
import { exportNotebookHtml } from "../../reader/notebook/export.ts";
import { createNotebookStore } from "../../reader/notebook/notebookStore.ts";
import { mountNotebookPanel } from "../../reader/notebook/panel.ts";
import { NOTEBOOK_KEY } from "../../reader/notebook/schema.ts";
import { createNotebookStorage } from "../../reader/notebook/storage.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { type ExplanationExercisePart, ExplanationPart } from "./ExplanationPart.tsx";

const PART: ExplanationExercisePart = {
  id: "private-teach-back",
  prompt: "Why can the signed average vanish while the spread grows?",
  criteria: ["Left and right displacements cancel in a sum.", "Their squares do not cancel."],
  workedExplanation:
    "Opposite displacements cancel in the signed sum; the squared displacements remain positive.",
};
const manifest: NoteManifest = { paper: "brownian-motion", revision: "3", stages: [] };
const binding = { title: "The signed average and the spread", sourceAnchor: "arg-bm-gaussian" };
function BoundExplanation({ revision = "3" }: { revision?: string }) {
  return (
    <DiscoveryNotebookProvider manifest={{ ...manifest, revision }}>
      <ExplanationPart part={PART} notebook={binding} />
    </DiscoveryNotebookProvider>
  );
}
const guides = [
  {
    paper: "light-quanta",
    Route: LightQuantaRoute,
    ids: [
      "lq-intensity-and-greatest-energy",
      "lq-locked-positions",
      "lq-ppe-below-and-above-threshold",
    ],
  },
  { paper: "brownian-motion", Route: BrownianRoute, ids: ["bm-square-root-in-words"] },
  {
    paper: "special-relativity",
    Route: RelativityRoute,
    ids: ["sr-neither-observer-wrong", "sr-ppe-two-paths-one-reading"],
  },
  { paper: "mass-energy", Route: MassEnergyRoute, ids: ["me-equal-and-opposite"] },
] as const;

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined)
    throw new Error("A required guide control is missing.");
  return value;
}

describe("private explanations on the four published guides", () => {
  let container: HTMLElement;
  let root: Root;
  beforeEach(async () => {
    await installDom();
    window.localStorage.clear();
    // The real shared in-tab owner accepts the test browser's explicit fresh notebook.
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
  async function type(field: HTMLTextAreaElement, value: string) {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      if (!setter) throw new Error("The textarea requires its native setter.");
      setter.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  function island(id = PART.id) {
    const result = container.querySelector<HTMLElement>(`[data-teach-back-answer="${id}"]`);
    if (!result) throw new Error(`Missing saved explanation control: ${id}`);
    return result;
  }
  async function save(id = PART.id) {
    const button = island(id).querySelector<HTMLButtonElement>("button");
    expect(button?.disabled).toBe(false);
    await act(async () => button?.click());
  }

  for (const { paper, Route, ids } of guides) {
    test(`${paper}: initial HTML keeps each complete worked comparison and a usable private textarea`, () => {
      const view = document.createElement("div");
      view.innerHTML = renderToStaticMarkup(<Route />);
      expect(
        [...view.querySelectorAll<HTMLElement>("[data-teach-back-answer]")].map(
          (item) => item.dataset.teachBackAnswer,
        ),
      ).toEqual([...ids]);
      for (const id of ids) {
        const part = required(view.querySelector<HTMLElement>(`[data-exercise-part="${id}"]`));
        expect(part.dataset.outcome).toBe("needs-human-reading");
        expect(part.querySelector<HTMLTextAreaElement>("textarea")?.disabled).toBe(false);
        expect(part.querySelector("textarea")?.getAttribute("name")).toBeNull();
        expect(part.querySelector<HTMLButtonElement>("button")?.disabled).toBe(true);
        const comparison = required(
          part.querySelector<HTMLDetailsElement>("details.exercise-worked"),
        );
        expect(comparison.textContent).toContain("Compare with a worked explanation");
        expect(comparison.querySelectorAll("li").length).toBeGreaterThanOrEqual(2);
        expect(comparison.closest("[data-teach-back-answer]")).toBeNull();
        expect(part.textContent).toContain("Saving needs JavaScript");
      }
    });

    test(`${paper}: every bound explanation saves in the real notebook and returns after remount`, async () => {
      const before = window.localStorage.getItem(NOTEBOOK_KEY);
      await act(async () => root.render(<Route />));
      expect(window.localStorage.getItem(NOTEBOOK_KEY)).toBe(before);
      const revision = required(
        JOURNEY_NOTE_MANIFESTS.find((item) => item.paper === paper),
      ).revision;
      for (const id of ids) {
        const field = required(island(id).querySelector<HTMLTextAreaElement>("textarea"));
        await type(field, `My reasoning for ${id}.`);
        const prior = window.localStorage.getItem(NOTEBOOK_KEY);
        expect(island(id).querySelector("details")).toBeNull();
        await save(id);
        expect(window.localStorage.getItem(NOTEBOOK_KEY)).not.toBe(prior);
      }
      const reloaded = createNotebookStore(createNotebookStorage());
      reloaded.open();
      const entries = reloaded.getSnapshot().document.entries;
      expect(entries.map((item) => item.kind)).toEqual(ids.map(() => "teachBack"));
      expect(entries.map((item) => item.frame.paper)).toEqual(ids.map(() => paper));
      for (const saved of entries) {
        if (saved.kind !== "teachBack")
          throw new Error("An explanation must have its typed capture.");
        expect(saved.teachBack.guideRevision).toBe(revision);
        expect(saved.text).toBe(`My reasoning for ${saved.teachBack.promptId}.`);
        expect(saved.frame.anchor).toStartWith("arg-");
      }
      await act(async () => root.render(<Route key="returned" />));
      for (const id of ids) expect(island(id).textContent).toContain(`My reasoning for ${id}.`);
    });
  }

  test("drafts never autosave; explicit revisions retain earlier words and show in the notebook", async () => {
    await act(async () => root.render(<BoundExplanation />));
    const before = window.localStorage.getItem(NOTEBOOK_KEY);
    const field = required(island().querySelector<HTMLTextAreaElement>("textarea"));
    await type(field, "My first explanation <script>private</script>.");
    expect(window.localStorage.getItem(NOTEBOOK_KEY)).toBe(before);
    await save();
    expect(island().querySelector<HTMLButtonElement>("button")?.disabled).toBe(true);
    await type(field, "My revised explanation: the squares still add.");
    await save();
    const store = getNotebookStore();
    expect(store.getSnapshot().document.entries.map((entry) => entry.text)).toEqual([
      "My first explanation <script>private</script>.",
      "My revised explanation: the squares still add.",
    ]);
    expect(container.querySelector("script")).toBeNull();
    const host = createContainer();
    const panel = mountNotebookPanel(host, store, () => {}, { inline: true });
    try {
      expect(host.textContent).toContain(PART.prompt);
      expect(host.textContent).toContain("My first explanation <script>private</script>.");
      expect(
        host.querySelectorAll(`a[href="/discover/brownian-motion/#explanation-${PART.id}"]`).length,
      ).toBeGreaterThan(0);
      expect(
        [...host.querySelectorAll("button")].some((button) => button.textContent === "Edit note"),
      ).toBe(false);
      const printable = exportNotebookHtml(store.getSnapshot().document);
      expect(printable).toContain("My revised explanation");
      expect(printable).toContain("&lt;script&gt;private&lt;/script&gt;");
    } finally {
      panel.dispose();
      removeContainer(host);
    }
    await act(async () => root.render(<BoundExplanation key="returned" revision="4" />));
    expect(island().textContent).toContain("belongs to guide revision 3");
    expect(island().textContent).toContain(PART.prompt);
    expect(island().querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("");
    expect(store.getSnapshot().document.entries[0]?.kind).toBe("teachBack");
  });

  test("storage blocked keeps an exportable explanation in the tab with a plain notice and no request", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    const fetch = globalThis.fetch;
    let requests = 0;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
    globalThis.fetch = (() => {
      requests++;
      throw new Error("No request may carry an explanation.");
    }) as typeof fetch;
    try {
      await act(async () => root.render(<BoundExplanation />));
      await type(
        required(island().querySelector<HTMLTextAreaElement>("textarea")),
        "Private reasoning stays here.",
      );
      await save();
      expect(getNotebookStore().getSnapshot().persistence).toBe("session-only");
      expect(island().textContent).toContain("could not be saved on this device");
      expect(exportNotebookHtml(getNotebookStore().getSnapshot().document)).toContain(
        "Private reasoning stays here.",
      );
      expect(requests).toBe(0);
      expect(window.location.href).not.toContain("Private");
      expect(container.querySelector("details.exercise-worked")?.textContent).toContain(
        PART.workedExplanation,
      );
    } finally {
      globalThis.fetch = fetch;
      if (descriptor) Object.defineProperty(window, "localStorage", descriptor);
    }
  });

  test("saving instructions contain no assessment language and pass the existing task-feedback lint", () => {
    const html = renderToStaticMarkup(<BoundExplanation />);
    const view = document.createElement("div");
    view.innerHTML = html;
    const copy = required(view.querySelector("[data-teach-back-answer]")).textContent ?? "";
    expect(
      checkVoice(copy, { context: "task-feedback" }).filter(
        (finding) => finding.severity === "error",
      ),
    ).toEqual([]);
    expect(copy).not.toMatch(/\b(score|streak|grade|correct|incorrect)\b/i);
  });
});
