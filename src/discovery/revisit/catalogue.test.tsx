import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import BrownianRoute from "../../app/discover/brownian-motion/page.tsx";
import LightQuantaRoute from "../../app/discover/light-quanta/page.tsx";
import MassEnergyRoute from "../../app/discover/mass-energy/page.tsx";
import RevisitPage from "../../app/discover/revisit/page.tsx";
import RelativityRoute from "../../app/discover/special-relativity/page.tsx";
import { DISCOVERY_PAPERS } from "../../content/schemas/discovery.ts";
import { explanationOutcome } from "../exercises/explanation.ts";
import { REAL_JOURNEYS } from "../journeys/realJourneys.ts";
import { REVISIT_CASES } from "./catalogue.ts";
import { revisitHref, revisitPromptId } from "./links.ts";

const guides = {
  "brownian-motion": BrownianRoute,
  "light-quanta": LightQuantaRoute,
  "special-relativity": RelativityRoute,
  "mass-energy": MassEnergyRoute,
};

describe("changed cases retain their authored reasoning and actual return destinations", () => {
  test("every authored transfer case becomes one human-read explanation without duplicating its science", () => {
    const authored = REAL_JOURNEYS.flatMap((journey) =>
      journey.stages.flatMap((stage) =>
        stage.support.transferCase ? [{ paper: journey.paper, stage }] : [],
      ),
    );
    expect(authored.length).toBeGreaterThan(0);
    expect(REVISIT_CASES.map((item) => `${item.paper}:${item.stageId}`).sort()).toEqual(
      authored.map(({ paper, stage }) => `${paper}:${stage.id}`).sort(),
    );
    expect(new Set(REVISIT_CASES.map((item) => item.id)).size).toBe(REVISIT_CASES.length);
    for (const item of REVISIT_CASES) {
      const original = authored.find(
        ({ paper, stage }) => paper === item.paper && stage.id === item.stageId,
      )?.stage;
      expect(original).toBeDefined();
      expect(item.transferCase).toBe(original?.support.transferCase);
      expect(item.originalExample).toBe(original?.support.workedExample);
      expect(item.part.workedExplanation).toBe(item.transferCase.explanation);
      expect(item.part.criteria).toEqual([
        `What changes: ${item.transferCase.whatChanges}`,
        `What stays valid: ${item.transferCase.whatStaysValid}`,
      ]);
      expect(explanationOutcome(item.part).kind).toBe("needs-human-reading");
      expect(item.instrument).toBe(original?.instrument);
    }
  });

  test("each return reaches a rendered guide anchor and an existing argument belonging to that paper", () => {
    for (const paper of DISCOVERY_PAPERS) {
      const Route = guides[paper];
      const guideHtml = renderToStaticMarkup(<Route />);
      const cases = REVISIT_CASES.filter((item) => item.paper === paper);
      expect(cases.length).toBeGreaterThan(0);
      for (const item of cases) {
        expect(item.stageHref).toBe(`/discover/${paper}/#${item.stageId}`);
        expect(guideHtml).toContain(`id="${item.stageId}"`);
        expect(item.sourceAnchor).toBeTruthy();
        const argument = JSON.parse(
          readFileSync(
            new URL(
              `../../../content/arguments/${paper}/${item.sourceAnchor}.json`,
              import.meta.url,
            ),
            "utf8",
          ),
        );
        expect(argument.kind).toBe("argument");
        expect(argument.paper).toBe(paper);
        expect(argument.id).toBe(item.sourceAnchor);
        expect(item.sourceHref).toBe(`/papers/${paper}/#${argument.id}`);
      }
    }
  });

  test("without JavaScript every case, original example, worked explanation and answer box is available", () => {
    const html = renderToStaticMarkup(<RevisitPage />);
    for (const item of REVISIT_CASES) {
      expect(html).toContain(`data-revisit-case="${item.id}"`);
      expect(html).not.toContain(`data-revisit-case="${item.id}" hidden`);
      expect(html).toContain(`id="explanation-${item.id}"`);
      expect(html).toContain(`for="explanation-${item.id}"`);
      expect(html).toContain(renderToStaticMarkup(item.originalExample.prompt));
      expect(html).toContain(renderToStaticMarkup(item.originalExample.result));
      expect(html).toContain(renderToStaticMarkup(item.transferCase.explanation));
      expect(html).toContain(`href="${item.stageHref}"`);
      expect(html).toContain(`href="${item.sourceHref}"`);
      expect(html).toContain(`href="${revisitHref(item.paper, item.stageId)}"`);
      expect(item.part.id).toBe(revisitPromptId(item.paper, item.stageId));
    }
    expect(html).toContain("Compare with a worked explanation");
    expect(html).toContain("Your words are not analyzed, assessed or sent anywhere");
    expect(html).toContain(
      "Every case, original example and worked explanation is available below",
    );
    expect(html).not.toContain('data-outcome="invalid"');
  });
});
