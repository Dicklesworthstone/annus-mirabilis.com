import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import type { Root } from "react-dom/client";
import { ExplanationPart } from "../../components/discover/ExplanationPart.tsx";
import { getNotebookStore } from "../../reader/notebook/browserStore.ts";
import { exerciseResponseHref } from "../../reader/notebook/exerciseEntry.ts";
import { exportNotebookHtml, exportNotebookJson } from "../../reader/notebook/export.ts";
import { createNotebookStore } from "../../reader/notebook/notebookStore.ts";
import { NOTEBOOK_KEY } from "../../reader/notebook/schema.ts";
import { createNotebookStorage } from "../../reader/notebook/storage.ts";
import { teachBackHref } from "../../reader/notebook/teachBackEntry.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { DiscoveryNotebookProvider } from "../notes/context.tsx";
import { connectionAnswerLocation } from "./answerLocations.ts";
import { ConnectionExercises } from "./ConnectionExercises.tsx";
import { CROSS_JOURNEY_EXERCISES } from "./records.ts";

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("Expected a published answer control.");
  return value;
}

describe("private answers on the published Connections tasks", () => {
  let host: HTMLElement;
  let root: Root;
  beforeEach(async () => {
    await installDom();
    window.localStorage.clear();
    expect(getNotebookStore().reloadConfirmed().ok).toBe(true);
    host = createContainer();
    const { createRoot } = await import("react-dom/client");
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    removeContainer(host);
    await uninstallDom();
  });
  const part = (id: string) =>
    required(host.querySelector<HTMLElement>(`[data-exercise-part="${id}"]`));
  const textarea = (scope: ParentNode) =>
    required(scope.querySelector<HTMLTextAreaElement>("textarea"));
  const input = (scope: ParentNode) => required(scope.querySelector<HTMLInputElement>("input"));
  async function type(field: HTMLInputElement | HTMLTextAreaElement, text: string) {
    await act(async () => {
      const prototype =
        field.tagName === "TEXTAREA"
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
      required(Object.getOwnPropertyDescriptor(prototype, "value")?.set).call(field, text);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  function button(scope: ParentNode, text: string) {
    return required(
      [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
        (item) => item.textContent === text,
      ),
    );
  }
  async function click(scope: ParentNode, text: string) {
    const control = button(scope, text);
    expect(control.disabled).toBe(false);
    await act(async () => control.click());
  }
  async function render() {
    await act(async () => root.render(<ConnectionExercises exercises={CROSS_JOURNEY_EXERCISES} />));
  }

  test("every published numeric, expression and prose part saves explicitly, reloads and exports with its own source and return link", async () => {
    const fetch = globalThis.fetch;
    let requests = 0;
    globalThis.fetch = (() => {
      requests++;
      throw new Error("Private work must remain on this device.");
    }) as typeof fetch;
    try {
      await render();
      const entries = CROSS_JOURNEY_EXERCISES.flatMap((exercise) =>
        exercise.sections.flatMap((section) => section.parts),
      );
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        const scope = part(entry.part.id);
        const before = window.localStorage.getItem(NOTEBOOK_KEY);
        const field = entry.kind === "explanation" ? textarea(scope) : input(scope);
        await type(
          field,
          entry.kind === "explanation" ? "My private comparison <script>in words</script>." : "1",
        );
        expect(window.localStorage.getItem(NOTEBOOK_KEY)).toBe(before);
        await click(
          scope,
          entry.kind === "explanation"
            ? "Save explanation in my notebook"
            : "Save response in my notebook",
        );
      }
      const reopened = createNotebookStore(createNotebookStorage());
      reopened.open();
      const document = reopened.getSnapshot().document;
      expect(document.entries).toHaveLength(entries.length);
      const readable = exportNotebookHtml(document);
      for (const saved of document.entries) {
        if (saved.kind !== "exercise" && saved.kind !== "teachBack")
          throw new Error("A connection answer has the existing typed notebook entry.");
        const id = saved.kind === "exercise" ? saved.exercise.partId : saved.teachBack.promptId;
        const location = required(connectionAnswerLocation(id));
        expect(saved.frame.paper).toBe(location.paper);
        expect(saved.frame.anchor).toBe(location.sourceAnchor);
        const capture = saved.kind === "exercise" ? saved.exercise : saved.teachBack;
        expect(capture.guideRevision).toMatch(/^connection:[0-9a-f]{64}$/);
        const href =
          saved.kind === "exercise"
            ? exerciseResponseHref(saved.frame.paper, saved.exercise)
            : teachBackHref(saved.frame.paper, saved.teachBack);
        expect(readable).toContain(`https://annus-mirabilis.com${href}`);
        expect(href).not.toContain(saved.id);
        expect(href).not.toContain("private");
      }
      expect(readable).toContain("&lt;script&gt;in words&lt;/script&gt;");
      expect(readable).not.toContain("<script>");
      expect(
        Array.from({ length: window.localStorage.length }, (_, index) =>
          window.localStorage.key(index),
        ),
      ).toEqual([NOTEBOOK_KEY]);
      expect(requests).toBe(0);
      await act(async () =>
        root.render(<ConnectionExercises key="returned" exercises={CROSS_JOURNEY_EXERCISES} />),
      );
      for (const entry of entries)
        expect(part(entry.part.id).textContent).toContain(
          entry.kind === "explanation" ? "Your saved explanations" : "Your saved responses",
        );
    } finally {
      globalThis.fetch = fetch;
    }
  });

  test("prose restores only on request and a changed draft invalidates replacement even when changed back", async () => {
    await render();
    const scope = part("cross-journey-statistical-papers-explanation");
    const answer = textarea(scope);
    await type(answer, "My first comparison.");
    await click(scope, "Save explanation in my notebook");
    await type(answer, "My later draft.");
    await click(scope, "Use this saved explanation");
    expect(answer.value).toBe("My later draft.");
    expect(scope.querySelector('[aria-label="Replace explanation preview"]')).not.toBeNull();
    await type(answer, "Another draft.");
    await type(answer, "My later draft.");
    expect(scope.querySelector('[aria-label="Replace explanation preview"]')).toBeNull();
    await click(scope, "Use this saved explanation");
    await click(scope, "Replace the explanation with this saved version");
    expect(answer.value).toBe("My first comparison.");
    expect(button(scope, "Save explanation in my notebook").disabled).toBe(true);
    expect(getNotebookStore().getSnapshot().document.entries).toHaveLength(1);
    await type(answer, "A revised comparison.");
    await click(scope, "Save explanation in my notebook");
    expect(
      getNotebookStore()
        .getSnapshot()
        .document.entries.map((entry) => entry.text),
    ).toEqual(["My first comparison.", "A revised comparison."]);
  });

  test("a changed prose criterion changes the saved definition and leaves the previous explanation readable without restoring it", async () => {
    await render();
    const id = "cross-journey-statistical-papers-explanation";
    await type(textarea(part(id)), "My explanation under the earlier criteria.");
    await click(part(id), "Save explanation in my notebook");
    const revised = CROSS_JOURNEY_EXERCISES.map((exercise) => ({
      ...exercise,
      sections: exercise.sections.map((section) => ({
        ...section,
        parts: section.parts.map((entry) =>
          entry.kind === "explanation" && entry.part.id === id
            ? {
                ...entry,
                part: {
                  ...entry.part,
                  criteria: entry.part.criteria.map((criterion, index) =>
                    index === 0 ? `${criterion} State its assumed regime explicitly.` : criterion,
                  ),
                },
              }
            : entry,
        ),
      })),
    }));
    await act(async () => root.render(<ConnectionExercises exercises={revised} />));
    const scope = part(id);
    expect(textarea(scope).value).toBe("");
    expect(scope.textContent).toContain("My explanation under the earlier criteria.");
    expect(scope.textContent).toContain("comparison criteria have changed");
    expect(
      [...scope.querySelectorAll("button")].some(
        (item) => item.textContent === "Use this saved explanation",
      ),
    ).toBe(false);
  });

  test("numeric and expression restore clears checked results and edited drafts cannot reuse a pending confirmation", async () => {
    await render();
    for (const [id, value] of [
      ["cross-journey-doppler-eigenvalue-receding", "0.5"],
      ["cross-journey-doppler-eigenvalue-expression", "sqrt((1-beta)/(1+beta))"],
    ]) {
      const scope = part(required(id));
      await type(input(scope), required(value));
      await click(scope, "Save response in my notebook");
      await type(input(scope), "2");
      await act(async () => {
        required(scope.querySelector("form")).dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      });
      for (let index = 0; index < 20 && !scope.querySelector(".exercise-verdict"); index++)
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        });
      expect(scope.querySelector(".exercise-verdict")).not.toBeNull();
      await click(scope, "Use this saved response");
      await type(input(scope), "3");
      await type(input(scope), "2");
      expect(scope.querySelector('[aria-label="Replace exercise answer preview"]')).toBeNull();
      await click(scope, "Use this saved response");
      await click(scope, "Replace the answer with this saved response");
      expect(input(scope).value).toBe(value);
      expect(scope.querySelector(".exercise-verdict")).toBeNull();
    }
  });

  test("import keeps the current prose draft and invalidates a preview whose saved version changed", async () => {
    await render();
    const scope = part("cross-journey-statistical-papers-explanation");
    await type(textarea(scope), "The saved comparison.");
    await click(scope, "Save explanation in my notebook");
    const store = getNotebookStore();
    const incoming = JSON.parse(exportNotebookJson(store.getSnapshot().document));
    incoming.entries[0].text = "The imported comparison.";
    await type(textarea(scope), "My current draft.");
    await click(scope, "Use this saved explanation");
    await act(async () => {
      const preview = store.previewImport(incoming);
      expect(preview.ok).toBe(true);
      if (preview.ok) expect(store.commitMerge(preview.review).ok).toBe(true);
    });
    expect(textarea(scope).value).toBe("My current draft.");
    expect(scope.textContent).toContain("The imported comparison.");
    expect(scope.querySelector('[aria-label="Replace explanation preview"]')).toBeNull();
  });

  test("blocked storage keeps the explicitly bound numeric and prose responses exportable in this tab", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
    try {
      await render();
      const numeric = part("cross-journey-doppler-eigenvalue-receding");
      await type(input(numeric), "0.5");
      await click(numeric, "Save response in my notebook");
      const prose = part("cross-journey-statistical-papers-explanation");
      await type(textarea(prose), "A comparison kept while storage is blocked.");
      await click(prose, "Save explanation in my notebook");
      const snapshot = getNotebookStore().getSnapshot();
      expect(snapshot.persistence).toBe("session-only");
      expect(snapshot.document.entries).toHaveLength(2);
      expect(prose.textContent).toContain("could not be saved on this device");
      expect(exportNotebookJson(snapshot.document)).toContain(
        "A comparison kept while storage is blocked.",
      );
    } finally {
      if (descriptor) Object.defineProperty(window, "localStorage", descriptor);
    }
  });

  test("the existing guide provider still supplies the question identity and permits explicit prose restoration", async () => {
    const question = {
      id: "bm-saved-guide-regression",
      prompt: "Why can the signed average vanish while the spread grows?",
      criteria: ["Opposite signed displacements cancel.", "Their squares remain positive."],
      workedExplanation:
        "Opposite displacements cancel in the signed sum, while their positive squares still measure a growing spread.",
    };
    const guide = (key: string) => (
      <DiscoveryNotebookProvider
        key={key}
        manifest={{ paper: "brownian-motion", revision: "3", stages: [] }}
      >
        <ExplanationPart
          part={question}
          notebook={{ title: "The average and the spread", sourceAnchor: "arg-bm-gaussian" }}
        />
      </DiscoveryNotebookProvider>
    );
    await act(async () => root.render(guide("first")));
    await type(
      textarea(part(question.id)),
      "Cancellation does not make the squared displacement vanish.",
    );
    await click(part(question.id), "Save explanation in my notebook");
    const saved = getNotebookStore().getSnapshot().document.entries[0];
    expect(saved?.frame.paper).toBe("brownian-motion");
    if (saved?.kind !== "teachBack")
      throw new Error("The guide still saves a typed teach-back entry.");
    expect(saved.teachBack.guideRevision).toBe("3");
    expect(teachBackHref(saved.frame.paper, saved.teachBack)).toBe(
      `/discover/brownian-motion/#explanation-${question.id}`,
    );
    await act(async () => root.render(guide("returned")));
    expect(textarea(part(question.id)).value).toBe("");
    await click(part(question.id), "Use this saved explanation");
    expect(textarea(part(question.id)).value).toBe(saved.text);
    expect(getNotebookStore().getSnapshot().document.entries).toHaveLength(1);
  });
});
