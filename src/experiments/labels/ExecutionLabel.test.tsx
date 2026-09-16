import { afterAll, describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getLogger } from "../../testing/log/logger.ts";
import type { ExecutionStateKind } from "../provenance/executionState.ts";
import { ExecutionLabel } from "./ExecutionLabel.tsx";
import { executionLabelFor } from "./executionLabelFor.ts";

const logger = getLogger("execution-labels");
const BEAD = "am-inst-execution-labels-5ywv";

const STATES: readonly ExecutionStateKind[] = [
  "frankensim-accepted",
  "host-accepted",
  "static-example",
  "unavailable",
];

describe("ExecutionLabel", () => {
  test("each derived state renders its public wording and data-execution-label", () => {
    for (const state of STATES) {
      const info = executionLabelFor(state);
      const html = renderToStaticMarkup(createElement(ExecutionLabel, { state }));
      expect(html).toContain(info.text);
      expect(html).toContain(`data-execution-label="${info.dataExecutionLabel}"`);
      expect(html).toContain(`data-execution-state="${state}"`);
    }
    logger.log({
      testId: "execution-label-four-states",
      beadId: BEAD,
      extra: { states: [...STATES] },
      outcome: "passed",
      message: "ExecutionLabel renders the four public wordings",
    });
  });

  test("only frankensim-accepted produces the FrankenSim wording", () => {
    for (const state of STATES) {
      const html = renderToStaticMarkup(createElement(ExecutionLabel, { state }));
      if (state === "frankensim-accepted") {
        expect(html).toContain("Ideal model, computed with FrankenSim");
        expect(html).toContain('data-execution-label="frankensim"');
      } else {
        expect(html).not.toContain("computed with FrankenSim");
        expect(html).not.toContain('data-execution-label="frankensim"');
      }
    }
  });
});

afterAll(async () => {
  await logger.flush();
});
