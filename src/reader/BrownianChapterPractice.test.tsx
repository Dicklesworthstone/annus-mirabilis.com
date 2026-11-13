import { describe, expect, test } from "bun:test";
import { PPE_TASK } from "../discovery/brownian/journeyII.ts";
import { INVESTIGATIONS } from "../discovery/investigation/specs.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { PaperReader } from "./PaperReader.tsx";

describe("Brownian chapter-end practice in the served reading", () => {
  test("the whole paper and §5 place the existing task after the last passage", async () => {
    for (const section of [undefined, "s5"]) {
      const html = await exportMarkup(await PaperReader({ section }));
      expect(html).toContain(`data-ppe-task-id="${PPE_TASK.promptId}"`);
      expect(html.indexOf(`data-ppe-task-id="${PPE_TASK.promptId}"`)).toBeGreaterThan(
        html.indexOf('id="arg-bm-inference"'),
      );
      expect(html).toContain(PPE_TASK.perturbPrompt);
      expect(html).toContain("Record a prediction, compare readings or open a saved investigation");
      expect(html).toContain(`id="${INVESTIGATIONS["brownian-motion"].laboratoryAnchor}"`);
      expect(html).toContain('href="/notebook/"');
      expect(html).toContain(`href="/discover/brownian-motion/#${PPE_TASK.promptId}"`);
      expect(html).not.toMatch(/<section\b[^>]*\bdata-instrument-id="bm-01"/);
      expect(html).not.toContain("tracerPositions");
    }
  });

  test("an earlier section does not repeat the chapter's task or its investigation controls", async () => {
    const html = await exportMarkup(await PaperReader({ section: "s3" }));
    expect(html).not.toContain(`data-ppe-task-id="${PPE_TASK.promptId}"`);
    expect(html).not.toContain(`id="${INVESTIGATIONS["brownian-motion"].laboratoryAnchor}"`);
    expect(html).toContain('data-inline-lab-mounted="false"');
  });
});
