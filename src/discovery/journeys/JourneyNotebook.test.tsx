import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import BrownianEncounter from "../../app/discover/brownian-motion/page.tsx";
import MassEnergyRoute from "../../app/discover/mass-energy/page.tsx";
import NotebookPage from "../../app/notebook/page.tsx";
import { DiscoveryNotebookControls } from "../notes/NotebookControls.tsx";
import { JOURNEY_NOTE_MANIFESTS, JourneyNotebook } from "./JourneyNotebook.tsx";
import { REAL_JOURNEYS } from "./realJourneys.ts";

describe("private stage notes on the published discovery routes", () => {
  test("minimal manifests use the real guide revisions and exactly the authored stage identities", () => {
    expect(JOURNEY_NOTE_MANIFESTS.map((manifest) => manifest.paper)).toEqual([
      "brownian-motion",
      "mass-energy",
    ]);
    const expected = {
      "brownian-motion": ["step-01", "step-02", "step-03", "step-04", "step-05", "step-07"],
      "mass-energy": ["step-01", "step-02", "step-03", "step-04", "step-05"],
    };
    for (const manifest of JOURNEY_NOTE_MANIFESTS) {
      const journey = REAL_JOURNEYS.find((item) => item.paper === manifest.paper);
      if (!journey) throw new Error("A notes manifest must have its authored journey");
      expect(manifest.revision).toBe(String(journey.revision));
      expect(manifest.stages.map((stage) => stage.id)).toEqual(
        expected[manifest.paper as keyof typeof expected],
      );
      expect(manifest.stages).toEqual(
        journey.stages.map(({ id, title }) => ({ id, title, alternatives: [] })),
      );
      expect(Object.keys(manifest).sort()).toEqual(["paper", "revision", "stages"]);
      for (const stage of manifest.stages) {
        expect(Object.keys(stage).sort()).toEqual(["alternatives", "id", "title"]);
      }
    }
  });

  for (const [paper, Page] of [
    ["brownian-motion", BrownianEncounter],
    ["mass-energy", MassEnergyRoute],
  ] as const) {
    test(`${paper} serves one notes toolbar and every stage form alongside its full static explanation`, () => {
      const html = renderToStaticMarkup(<Page />);
      const manifest = JOURNEY_NOTE_MANIFESTS.find((item) => item.paper === paper);
      if (!manifest) throw new Error("The published guide must expose its notes manifest");
      expect([...html.matchAll(/class="discovery-notebook-controls"/g)].length).toBe(1);
      expect(
        [...html.matchAll(/data-discovery-stage-notes="([^"]+)"/g)].map((match) => match[1]),
      ).toEqual(manifest.stages.map((stage) => stage.id));
      const toolbar = html.indexOf('class="discovery-notebook-controls"');
      expect(toolbar).toBeGreaterThan(html.indexOf("</nav>"));
      expect(toolbar).toBeLessThan(html.indexOf('id="shelf"'));
      expect(html).toContain("Recording notes needs JavaScript");
      expect(html).toContain('<fieldset disabled=""');
      expect([...html.matchAll(/data-stage-worked-example=""/g)].length).toBe(
        manifest.stages.length,
      );
      for (const stage of manifest.stages) {
        const start = html.indexOf(`id="${stage.id}"`);
        const note = html.indexOf(`data-discovery-stage-notes="${stage.id}"`, start);
        const explanation = html.indexOf('data-stage-prose=""', start);
        expect(start).toBeGreaterThan(0);
        expect(note).toBeGreaterThan(start);
        expect(explanation).toBeGreaterThan(note);
      }
    });
  }

  test("the notebook page offers the same two guides and their current notes controls", () => {
    const html = renderToStaticMarkup(<NotebookPage />);
    expect(html).toContain('id="discovery-notes"');
    expect([...html.matchAll(/class="discovery-notebook-controls"/g)].length).toBe(2);
    for (const manifest of JOURNEY_NOTE_MANIFESTS) {
      expect(html).toContain(`id="discovery-notes-${manifest.paper}"`);
      expect(html).toContain(`href="/discover/${manifest.paper}/"`);
    }
    expect(html).toContain("Earlier predictions stay as you wrote them.");
  });

  test("a guide without authored stages keeps its reading and acquires no empty notebook", () => {
    const html = renderToStaticMarkup(
      <JourneyNotebook paper="light-quanta">
        <p>The guide remains readable.</p>
        <DiscoveryNotebookControls />
      </JourneyNotebook>,
    );
    expect(html).toBe("<p>The guide remains readable.</p>");
  });
});
