import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import type { Root } from "react-dom/client";
import { ExercisePart } from "../../components/discover/ExercisePart.tsx";
import { ExplanationPart } from "../../components/discover/ExplanationPart.tsx";
import { NumericPart } from "../../components/discover/NumericPart.tsx";
import { JourneyNotebook } from "../../discovery/journeys/JourneyNotebook.tsx";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { getNotebookStore } from "../notebook/browserStore.ts";
import { exerciseResponseHref } from "../notebook/exerciseEntry.ts";
import { exportNotebookHtml } from "../notebook/export.ts";
import { createNotebookStore } from "../notebook/notebookStore.ts";
import { NOTEBOOK_KEY } from "../notebook/schema.ts";
import { createNotebookStorage } from "../notebook/storage.ts";
import { teachBackHref } from "../notebook/teachBackEntry.ts";
import { PASSAGE_PRACTICE, practiceNotebookBinding, practiceQuestionHref } from "./catalogue.ts";
import { PassagePractice } from "./PassagePractice.tsx";

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("The published practice control must be available.");
  return value;
}

describe("saved answers shared by paper practice and Discover", () => {
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
  const field = (scope: ParentNode) =>
    required(scope.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea"));
  async function type(input: HTMLInputElement | HTMLTextAreaElement, text: string) {
    await act(async () => {
      const prototype =
        input.tagName === "TEXTAREA"
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
      required(Object.getOwnPropertyDescriptor(prototype, "value")?.set).call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
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
    const target = button(scope, text);
    expect(target.disabled).toBe(false);
    await act(async () => target.click());
  }
  async function renderPractice(key: string) {
    await act(async () =>
      root.render(
        <div key={key}>
          {PASSAGE_PRACTICE.map((record) => (
            <PassagePractice
              key={record.argument}
              paperId={record.paper}
              sectionId={record.section}
              argumentId={record.argument}
              passageTitle={record.argument}
              sectionPage
            />
          ))}
        </div>,
      ),
    );
  }

  test("all twenty-six answers save only explicitly with their exact source, reopen and export without opening guide-note stores or making requests", async () => {
    const fetch = globalThis.fetch;
    let requests = 0;
    globalThis.fetch = (() => {
      requests++;
      throw new Error("Paper practice answers remain on this device.");
    }) as typeof fetch;
    try {
      await renderPractice("first");
      for (const record of PASSAGE_PRACTICE) {
        for (const question of record.questions) {
          const scope = part(question.part.id);
          const before = window.localStorage.getItem(NOTEBOOK_KEY);
          await type(
            field(scope),
            question.kind === "explanation" ? "My private explanation <b>stays text</b>." : "1",
          );
          expect(window.localStorage.getItem(NOTEBOOK_KEY)).toBe(before);
          await click(
            scope,
            question.kind === "explanation"
              ? "Save explanation in my notebook"
              : "Save response in my notebook",
          );
        }
      }
      const reopened = createNotebookStore(createNotebookStorage());
      reopened.open();
      const document = reopened.getSnapshot().document;
      expect(document.entries).toHaveLength(26);
      const printable = exportNotebookHtml(document);
      for (const entry of document.entries) {
        if (entry.kind !== "exercise" && entry.kind !== "teachBack")
          throw new Error("Practice uses the existing answer entries.");
        const id = entry.kind === "exercise" ? entry.exercise.partId : entry.teachBack.promptId;
        const record = required(
          PASSAGE_PRACTICE.find((record) =>
            record.questions.some((question) => question.part.id === id),
          ),
        );
        const question = required(record.questions.find((question) => question.part.id === id));
        expect(entry.frame.paper).toBe(record.paper);
        expect(entry.frame.anchor).toBe(record.argument);
        const capture = entry.kind === "exercise" ? entry.exercise : entry.teachBack;
        expect(capture.guideRevision).toBe(
          practiceNotebookBinding(record, question)?.context?.revision,
        );
        const href =
          entry.kind === "exercise"
            ? exerciseResponseHref(entry.frame.paper, entry.exercise)
            : teachBackHref(entry.frame.paper, entry.teachBack);
        expect(href).toBe(practiceQuestionHref(record.paper, question));
        expect(printable).toContain(`https://annus-mirabilis.com${href}`);
      }
      expect(printable).toContain("&lt;b&gt;stays text&lt;/b&gt;");
      expect(
        Array.from({ length: window.localStorage.length }, (_, index) =>
          window.localStorage.key(index),
        ),
      ).toEqual([NOTEBOOK_KEY]);
      expect(requests).toBe(0);
      await renderPractice("returned");
      for (const record of PASSAGE_PRACTICE) {
        for (const question of record.questions) {
          const scope = part(question.part.id);
          expect(field(scope).value).toBe("");
          expect(scope.querySelector(".exercise-verdict")).toBeNull();
          await click(
            scope,
            question.kind === "explanation"
              ? "Use this saved explanation"
              : "Use this saved response",
          );
          expect(field(scope).value).toBe(
            question.kind === "explanation" ? "My private explanation <b>stays text</b>." : "1",
          );
          expect(scope.querySelector(".exercise-verdict")).toBeNull();
        }
      }
      expect(getNotebookStore().getSnapshot().document.entries).toHaveLength(26);
    } finally {
      globalThis.fetch = fetch;
    }
  });

  test("the same numeric, expression and prose answers restore between the existing guide provider and the paper without being relabelled", async () => {
    const chosen = [
      "me-mass-given-up-formula",
      "sr-moving-rod-length",
      "lq-intensity-and-greatest-energy",
    ];
    for (const id of chosen) {
      const record = required(
        PASSAGE_PRACTICE.find((record) =>
          record.questions.some((question) => question.part.id === id),
        ),
      );
      const question = required(record.questions.find((question) => question.part.id === id));
      const notebook = { title: question.title, sourceAnchor: record.argument };
      await act(async () =>
        root.render(
          <JourneyNotebook key={`guide-${id}`} paper={record.paper}>
            {question.kind === "expression" && (
              <ExercisePart part={question.part} notebook={notebook} />
            )}
            {question.kind === "numeric" && (
              <NumericPart part={question.part} notebook={notebook} />
            )}
            {question.kind === "explanation" && (
              <ExplanationPart part={question.part} notebook={notebook} />
            )}
          </JourneyNotebook>,
        ),
      );
      const answer =
        question.kind === "explanation"
          ? "Frequency sets each quantum's energy."
          : question.kind === "expression"
            ? "L/V^2"
            : "0.8";
      await type(field(part(id)), answer);
      await click(
        part(id),
        question.kind === "explanation"
          ? "Save explanation in my notebook"
          : "Save response in my notebook",
      );
      const saved = getNotebookStore().getSnapshot().document.entries.at(-1);
      expect(saved).toBeDefined();
      await act(async () =>
        root.render(
          <PassagePractice
            key={`paper-${id}`}
            paperId={record.paper}
            sectionId={record.section}
            argumentId={record.argument}
            passageTitle={record.argument}
            sectionPage
          />,
        ),
      );
      expect(field(part(id)).value).toBe("");
      await click(
        part(id),
        question.kind === "explanation" ? "Use this saved explanation" : "Use this saved response",
      );
      expect(field(part(id)).value).toBe(answer);
      expect(part(id).textContent).not.toContain("earlier version of this question");
      expect(getNotebookStore().getSnapshot().document.entries.at(-1)).toEqual(saved);
    }
  });
});
