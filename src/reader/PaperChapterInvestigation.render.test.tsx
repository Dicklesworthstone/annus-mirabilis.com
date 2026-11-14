import { describe, expect, test } from "bun:test";
import { INVESTIGATIONS } from "../discovery/investigation/specs.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { PaperPage } from "./PaperPage.tsx";

describe("chapter practice is on the actual reading routes", () => {
  const chapters = [
    { paper: "light-quanta", section: "s8", other: "s7" },
    { paper: "special-relativity", section: "s4", other: "s3" },
    { paper: "mass-energy", section: "s0", other: null },
  ] as const;
  for (const item of chapters) {
    test(`${item.paper}: one native shared task on the chapter and whole paper, none on other faces`, async () => {
      const spec = INVESTIGATIONS[item.paper];
      for (const section of [item.section, undefined]) {
        const html = await exportMarkup(
          await PaperPage({ paperId: item.paper, ...(section ? { section } : {}) }),
        );
        expect(html.match(new RegExp(`data-ppe-task-id="${spec.promptId}"`, "g"))).toHaveLength(1);
        expect(html).toContain(`id="${spec.laboratoryAnchor}"`);
        expect(html).toContain(`href="/lab/${spec.experimentId}/"`);
        expect(html).toContain(`href="/discover/${item.paper}/#${spec.promptId}"`);
        expect(html).toContain("Read the worked explanation at any time");
        expect(html).toContain('data-inline-lab-mounted="false"');
        expect(html).not.toContain(`data-instrument-id="${spec.experimentId}"`);
        expect(html).not.toContain('hidden id="S:');
        expect(html).not.toContain("In the laboratory at step 08");
      }
      if (item.other) {
        const html = await exportMarkup(
          await PaperPage({ paperId: item.paper, section: item.other }),
        );
        expect(html).not.toContain("data-paper-investigation");
      }
      const source = await exportMarkup(
        await PaperPage({ paperId: item.paper, section: item.section, face: "english" }),
      );
      expect(source).not.toContain("data-paper-investigation");
      const results = await exportMarkup(await PaperPage({ paperId: item.paper, face: "results" }));
      expect(results).not.toContain("data-paper-investigation");
    }, 20_000);
  }
});
