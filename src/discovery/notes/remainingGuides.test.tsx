import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import type { Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import LightQuantaRoute from "../../app/discover/light-quanta/page.tsx";
import SpecialRelativityRoute from "../../app/discover/special-relativity/page.tsx";
import { LIGHT_QUANTA_SHELF_CARDS } from "../../content/lightQuantaShelf.ts";
import { DISCOVERY_NOTE_KEYS } from "../../platform/storage/keys.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { AuthoredJourneyStage } from "../AuthoredJourneyStage.tsx";
import { JOURNEY_NOTE_MANIFESTS } from "../journeys/JourneyNotebook.tsx";
import { LIGHT_QUANTA_STAGES, WAVE_SUCCESS_STAGE } from "../lightQuanta/stages.ts";
import { decodeNotebook } from "../notebook.ts";
import { SPECIAL_RELATIVITY_STAGES } from "../relativity/stages.ts";
import { KeptStageNotes } from "./KeptStageNotes.tsx";

const guides = [
  {
    paper: "light-quanta" as const,
    Route: LightQuantaRoute,
    stages: LIGHT_QUANTA_STAGES,
    retainedProse: "Send light through two slits and the bright and dark bands",
    retainedDoor: "/discover/light-quanta/investigate/",
  },
  {
    paper: "special-relativity" as const,
    Route: SpecialRelativityRoute,
    stages: SPECIAL_RELATIVITY_STAGES,
    retainedProse: "Hold a coil of wire still and push a magnet into it",
    retainedDoor: "/discover/special-relativity/investigate/",
  },
];

describe("the light-quanta and relativity guides expose their authored guidance and private notes", () => {
  let container: HTMLElement;
  let root: Root;

  beforeEach(async () => {
    await installDom();
    window.localStorage.clear();
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
      if (!setter) throw new Error("The textarea must expose its native setter");
      setter.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  for (const { paper, Route, stages, retainedProse, retainedDoor } of guides) {
    test(`${paper}: every authored argument has its real premises, worked guidance and disabled notes in initial HTML`, () => {
      const html = renderToStaticMarkup(<Route />);
      const page = document.createElement("div");
      page.innerHTML = html;
      expect(stages.length).toBeGreaterThan(0);
      expect(
        [...page.querySelectorAll<HTMLElement>("[data-stage-id]")].map(
          (stage) => stage.dataset.stageId,
        ),
      ).toEqual(stages.map((stage) => stage.id));
      for (const stage of stages) {
        const section = page.querySelector<HTMLElement>(`#${stage.id}`);
        expect(section).not.toBeNull();
        expect(section?.querySelector("h2")?.textContent).toBe(stage.question);
        expect(section?.getAttribute("aria-labelledby")).toBe(`${stage.id}-question`);
        const notes = section?.querySelector(`[data-discovery-stage-notes="${stage.id}"]`);
        expect(notes).not.toBeNull();
        expect(notes?.querySelector("fieldset")?.disabled).toBe(true);
        expect(notes?.textContent).toContain("Recording notes needs JavaScript");
        const worked = section?.querySelector("[data-stage-worked-example]");
        expect(worked?.textContent).toContain(stage.support.workedExample.prompt);
        expect(worked?.textContent).toContain(stage.support.workedExample.result);
        expect(worked?.textContent).toContain(stage.support.partialComparison.explanation);
        expect(worked?.closest("[data-discovery-stage-notes]")).toBeNull();
        for (const premise of stage.premiseRefs) {
          expect(section?.querySelector(`a[href="#card-${premise.cardId}"]`)).not.toBeNull();
          expect(page.querySelector(`[id="card-${premise.cardId}"]`)).not.toBeNull();
        }
        for (const tool of stage.reasoning) {
          expect(
            section?.querySelector(`a[href="/foundations/${tool.foundationId}/"]`),
          ).not.toBeNull();
        }
      }
      const original = [...page.querySelectorAll("p")].find((paragraph) =>
        (paragraph.textContent ?? "").replace(/\s+/g, " ").includes(retainedProse),
      );
      expect(original).toBeDefined();
      expect(original?.closest("details")).toBeNull();
      expect(page.querySelector(`a[href="${retainedDoor}"]`)).not.toBeNull();
      expect(page.querySelector("#step-08 [data-world-check-live]")).not.toBeNull();
      expect(page.querySelector("#step-09")).not.toBeNull();
      expect(page.querySelector(`#discovery-notes-${paper}`)).not.toBeNull();
      console.log(`[discovery guidance] ${paper}: ${stages.length} argument stages rendered`);
    });

    test(`${paper}: recording on the actual guide survives a remount and opens in the notebook with a return link`, async () => {
      const manifest = JOURNEY_NOTE_MANIFESTS.find((item) => item.paper === paper);
      if (!manifest) throw new Error(`Missing public note manifest for ${paper}`);
      const stage = stages[0];
      if (!stage) throw new Error(`Missing authored argument for ${paper}`);
      const key = DISCOVERY_NOTE_KEYS[paper];
      const prediction = `My ${paper} prediction stays private.`;
      await act(async () => root.render(<Route />));
      expect(window.localStorage.getItem(key)).toBeNull();
      const notes = container.querySelector(`[data-discovery-stage-notes="${stage.id}"]`);
      const field = notes?.querySelector<HTMLTextAreaElement>('textarea[id$="-prediction"]');
      if (!field || !notes) throw new Error(`The actual ${paper} page has no prediction field`);
      await type(field, prediction);
      expect(window.localStorage.getItem(key)).toBeNull();
      const record = [...notes.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.textContent === "Record this prediction",
      );
      if (!record) throw new Error("The actual page has no record action");
      expect(record.disabled).toBe(false);
      await act(async () => record.click());
      const raw = window.localStorage.getItem(key);
      expect(decodeNotebook(raw ?? "", manifest).entries[0]?.attempts[0]?.prediction).toBe(
        prediction,
      );
      for (const other of JOURNEY_NOTE_MANIFESTS.filter((item) => item.paper !== paper)) {
        expect(window.localStorage.getItem(DISCOVERY_NOTE_KEYS[other.paper])).toBeNull();
      }
      await act(async () => root.render(null));
      await act(async () => root.render(<Route />));
      expect(
        container.querySelector(`[data-discovery-stage-notes="${stage.id}"]`)?.textContent,
      ).toContain(prediction);
      await act(async () => root.render(<KeptStageNotes manifests={JOURNEY_NOTE_MANIFESTS} />));
      expect(container.textContent).toContain(prediction);
      expect(
        container.querySelector(`a[href="/discover/${paper}/#${stage.id}"]`)?.textContent,
      ).toBe(stage.title);
      expect(window.localStorage.getItem(key)).toBe(raw);
    });
  }

  test("rich existing explanation replaces only the plain prose; worked guidance still comes from the authored stage", () => {
    const authored = {
      ...WAVE_SUCCESS_STAGE,
      support: {
        ...WAVE_SUCCESS_STAGE.support,
        explanation: "Plain prose must not duplicate the preserved explanation.",
        workedExample: {
          ...WAVE_SUCCESS_STAGE.support.workedExample,
          result: "The changed authored result reaches the page.",
        },
      },
    };
    const html = renderToStaticMarkup(
      <AuthoredJourneyStage
        stage={authored}
        shelf={LIGHT_QUANTA_SHELF_CARDS}
        explanation={
          <p>
            A preserved explanation with <em>its emphasis</em>.
          </p>
        }
      />,
    );
    expect(html).toContain("A preserved explanation with <em>its emphasis</em>.");
    expect(html).not.toContain(authored.support.explanation);
    expect(html).toContain(authored.support.workedExample.result);
    const ordinary = renderToStaticMarkup(
      <AuthoredJourneyStage stage={authored} shelf={LIGHT_QUANTA_SHELF_CARDS} />,
    );
    expect(ordinary).toContain(authored.support.explanation);
  });
});
