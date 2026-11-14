import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  act,
  Children,
  type ComponentProps,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DISCOVERY_PAPERS } from "../../content/schemas/discovery.ts";
import { loadPaper } from "../../content/server.ts";
import { PPE_TASK } from "../../discovery/brownian/journeyII.ts";
import { JOURNEY_NOTE_MANIFESTS } from "../../discovery/journeys/JourneyNotebook.tsx";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { ReaderController } from "../ReaderController.tsx";
import {
  PASSAGE_PRACTICE,
  practiceAnchor,
  practiceForPassage,
  practiceHref,
  practiceNavigationFor,
  practiceNotebookBinding,
  practiceQuestionHref,
} from "./catalogue.ts";
import { PassagePractice } from "./PassagePractice.tsx";

let container: HTMLDivElement;
beforeEach(async () => {
  await installDom();
  container = document.createElement("div");
  document.body.append(container);
});
afterEach(async () => {
  await uninstallDom();
});

async function paperElement(paper: string, section?: string) {
  if (paper === "brownian-motion") {
    const { PaperReader } = await import("../PaperReader.tsx");
    return PaperReader({ section });
  }
  const { PaperPage } = await import("../PaperPage.tsx");
  return PaperPage({ paperId: paper, ...(section ? { section } : {}) });
}

async function renderPaper(paper: string, section?: string) {
  return exportMarkup(await paperElement(paper, section));
}

function controllerIn(
  node: ReactNode,
): ReactElement<ComponentProps<typeof ReaderController>> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode }>(child)) continue;
    if (child.type === ReaderController)
      return child as ReactElement<ComponentProps<typeof ReaderController>>;
    const found = controllerIn(child.props.children);
    if (found) return found;
  }
  return undefined;
}

describe("practice beside the argument that supplies it", () => {
  test("all nineteen checked questions and seven prose questions have a real, correctly scoped passage and the current guide identity", async () => {
    const questions = PASSAGE_PRACTICE.flatMap((record) => record.questions);
    expect(PASSAGE_PRACTICE).toHaveLength(13);
    expect(questions).toHaveLength(26);
    expect(questions.filter((question) => question.kind !== "explanation")).toHaveLength(19);
    expect(new Set(questions.map((question) => question.part.id)).size).toBe(26);
    expect(Object.isFrozen(PASSAGE_PRACTICE)).toBe(true);
    for (const paper of DISCOVERY_PAPERS) {
      const payload = await loadPaper(paper);
      const current = JOURNEY_NOTE_MANIFESTS.find((manifest) => manifest.paper === paper);
      expect(current).toBeDefined();
      expect(practiceNavigationFor(paper, undefined, payload.arguments).anchors).toEqual([]);
      for (const record of PASSAGE_PRACTICE.filter((entry) => entry.paper === paper)) {
        const source = payload.arguments.find((argument) => argument.id === record.argument);
        expect(source?.section).toBe(record.section);
        expect(payload.paper.sections.some((section) => section.id === record.section)).toBe(true);
        expect(Object.isFrozen(record.questions)).toBe(true);
        expect(practiceForPassage(paper, record.section, record.argument)).toBe(record);
        expect(practiceForPassage(paper, "s999", record.argument)).toBeUndefined();
        expect(
          practiceForPassage("another-paper", record.section, record.argument),
        ).toBeUndefined();
        const navigation = practiceNavigationFor(paper, record.section, payload.arguments);
        expect(navigation.anchors).toContain(practiceAnchor(record));
        expect(navigation.questions[practiceAnchor(record)]).toBe(source?.question);
        for (const question of record.questions) {
          expect(practiceNotebookBinding(record, question)).toEqual({
            title: question.title,
            sourceAnchor: source?.id,
            context: { paper, revision: current?.revision },
          });
          expect(question.part.prompt.trim().length).toBeGreaterThan(0);
          expect(question.part.workedExplanation.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  test("the real shell registry preserves a practice arrival through the controller and retains its parent passage for navigation", async () => {
    const { createRoot } = await import("react-dom/client");
    for (const paper of DISCOVERY_PAPERS) {
      const record = PASSAGE_PRACTICE.find((entry) => entry.paper === paper);
      if (!record) throw new Error("Every paper must offer practice.");
      const payload = await loadPaper(paper);
      const source = payload.arguments.find((argument) => argument.id === record.argument);
      if (!source) throw new Error("Practice must have its real source argument.");
      const controller = controllerIn(await paperElement(paper, record.section));
      if (!controller) throw new Error("The actual reading shell must mount its controller.");
      const anchor = practiceAnchor(record);
      expect(controller.props.registry.anchors).toContain(anchor);
      expect(controller.props.questions[anchor]).toBe(source.question);
      expect(controller.props.registry.anchors).toContain(source.id);
      const whole = controllerIn(await paperElement(paper));
      expect(whole?.props.registry.anchors).not.toContain(anchor);
      container.innerHTML = `<main data-reader-root data-view="reading">
        <div data-controller-host></div>
        <dialog data-clarification-dialog></dialog><p data-reader-announcement></p>
        <article class="reader-passage" data-unit="${source.id}" id="${source.id}" tabindex="-1">
          <div data-face-reading><details id="${anchor}" tabindex="-1"><summary>Practice</summary></details></div>
          <button data-reader-anchor="${source.id}">Return to this argument</button>
        </article>
      </main>`;
      const controls = container.querySelector<HTMLElement>("[data-controller-host]");
      if (!controls) throw new Error("The arrival fixture must mount the real controller.");
      window.history.replaceState({}, "", practiceHref(record));
      const root = createRoot(controls);
      try {
        await act(async () => root.render(controller));
        expect(window.location.hash).toBe(`#${anchor}`);
        expect(window.history.state.annusReader.state.anchor).toBe(anchor);
        expect(container.querySelector("[data-reader-root]")?.getAttribute("data-view")).toBe(
          "reading",
        );
        const jump = container.querySelector<HTMLButtonElement>("[data-reader-anchor]");
        if (!jump) throw new Error("The source passage jump must be available.");
        await act(async () => jump.click());
        expect(window.location.hash).toBe(`#${source.id}`);
        expect(document.activeElement?.id).toBe(source.id);
      } finally {
        await act(async () => root.unmount());
      }
    }
  }, 60_000);

  test("each disclosure carries the original prompt, worked explanation, notebook binding and discovery address without JavaScript", () => {
    for (const record of PASSAGE_PRACTICE) {
      container.innerHTML = renderToStaticMarkup(
        <PassagePractice
          paperId={record.paper}
          sectionId={record.section}
          argumentId={record.argument}
          passageTitle="The source argument"
          sectionPage
        />,
      );
      const disclosure = container.querySelector<HTMLDetailsElement>("details.passage-practice");
      expect(disclosure?.open).toBe(false);
      expect(disclosure?.id).toBe(practiceAnchor(record));
      expect(container.querySelectorAll("[data-exercise-part]")).toHaveLength(
        record.questions.length,
      );
      for (const question of record.questions) {
        const part = container.querySelector(`[data-exercise-part="${question.part.id}"]`);
        expect(part?.textContent).toContain(question.part.prompt);
        expect(part?.querySelector("details.exercise-worked")?.textContent).toContain(
          question.part.workedExplanation,
        );
        expect(
          part?.querySelector(
            question.kind === "explanation"
              ? "[data-teach-back-answer]"
              : "[data-saved-exercise-response]",
          ),
        ).not.toBeNull();
        expect(
          container.querySelector(`a[href="${practiceQuestionHref(record.paper, question)}"]`),
        ).not.toBeNull();
        if (question.kind === "explanation") {
          for (const criterion of question.part.criteria)
            expect(part?.textContent).toContain(criterion);
        }
      }
    }
  });

  test("modern counterexamples, later arguments and observation-dependent questions keep their setup and limits", () => {
    for (const record of PASSAGE_PRACTICE) {
      container.innerHTML = renderToStaticMarkup(
        <PassagePractice
          paperId={record.paper}
          sectionId={record.section}
          argumentId={record.argument}
          passageTitle="The source argument"
          sectionPage
        />,
      );
      for (const question of record.questions) {
        if (!question.preparation) continue;
        const scope = container
          .querySelector(`[data-exercise-part="${question.part.id}"]`)
          ?.closest("fieldset");
        expect(scope?.textContent).toContain(question.preparation.label);
        for (const paragraph of question.preparation.paragraphs)
          expect(scope?.textContent).toContain(paragraph);
        for (const link of question.preparation.links ?? [])
          expect(scope?.querySelector(`a[href="${link.href}"]`)).not.toBeNull();
      }
      if (record.argument === "arg-me-mass-change") {
        expect(container.textContent).toContain("Later argument: 1906");
        expect(container.textContent).toContain("not part of the September 1905 paper");
        expect(container.textContent).toContain("energy leaving the box");
      }
      if (record.argument === "arg-lq-independent-configurations") {
        expect(container.textContent).toContain("Modern counterexample");
        expect(container.textContent).toContain("not an experiment reported in the paper");
      }
    }
  });

  test("the actual section routes place each group inside its own argument, and never repeat another section's questions", async () => {
    const routes = new Map(
      PASSAGE_PRACTICE.map((record) => [`${record.paper}/${record.section}`, record]),
    );
    for (const { paper, section } of routes.values()) {
      container.innerHTML = await renderPaper(paper, section);
      const expected = PASSAGE_PRACTICE.filter(
        (record) => record.paper === paper && record.section === section,
      );
      expect(container.querySelectorAll("[data-passage-practice]")).toHaveLength(expected.length);
      for (const record of expected) {
        const practice = container.querySelector(`[data-passage-practice="${record.argument}"]`);
        expect(practice?.closest("article")?.id).toBe(record.argument);
        expect(practice?.closest("[data-face-reading]")).not.toBeNull();
        for (const question of record.questions) {
          expect(
            practice?.querySelector(`[data-exercise-part="${question.part.id}"]`),
          ).not.toBeNull();
          expect(
            container.querySelectorAll(`[data-exercise-part="${question.part.id}"]`),
          ).toHaveLength(1);
        }
      }
    }
  }, 60_000);

  test("whole-paper routes link to the exact section disclosure without duplicating its answer islands, and Brownian keeps its existing final practice", async () => {
    for (const paper of DISCOVERY_PAPERS) {
      container.innerHTML = await renderPaper(paper);
      const expected = PASSAGE_PRACTICE.filter((record) => record.paper === paper);
      expect(container.querySelectorAll("[data-passage-practice]")).toHaveLength(0);
      expect(container.querySelectorAll("[data-passage-practice-link]")).toHaveLength(
        expected.length,
      );
      for (const record of expected) {
        const link = container.querySelector(`[data-passage-practice-link="${record.argument}"] a`);
        expect(link?.getAttribute("href")).toBe(practiceHref(record));
        expect(link?.closest("article")?.id).toBe(record.argument);
        for (const question of record.questions)
          expect(container.querySelector(`[data-exercise-part="${question.part.id}"]`)).toBeNull();
      }
      if (paper === "brownian-motion") {
        expect(
          container.querySelectorAll(`[data-ppe-task-id="${PPE_TASK.promptId}"]`),
        ).toHaveLength(1);
      }
    }
    container.innerHTML = await renderPaper("brownian-motion", "s5");
    expect(container.querySelectorAll(`[data-ppe-task-id="${PPE_TASK.promptId}"]`)).toHaveLength(1);
    container.innerHTML = await renderPaper("brownian-motion", "s3");
    expect(
      container.querySelectorAll("[data-passage-practice], [data-passage-practice-link]"),
    ).toHaveLength(0);
  }, 60_000);
});
