import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { ExperimentDispatch, type ViewLoaders } from "../../experiments/dispatch.tsx";
import { StickyLabRegion } from "../../reader/layout/StickyLabRegion.tsx";
import { getLogger } from "../../testing/log/logger.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { ReadingOnlyKeepContent } from "./KeepContent.tsx";
import { FORBIDDEN_COPY, READING_SETTING_LABELS } from "./schema.ts";

const logger = getLogger("a11y-reading-only");
const BEAD = "am-a11y-reading-only-6wwd";

const EXPLANATION = "The typical distance grows with the square root of time.";
const WORKED = "About 0.8 μm in one second at the printed 1905 inputs.";

describe("reading-only keeps explanations and static worked cases", () => {
  test("the planted negative: reading-only markup still contains the explanation and the worked case", () => {
    const html = renderToStaticMarkup(
      <div data-reading-only="on">
        <ReadingOnlyKeepContent explanation={EXPLANATION} workedCase={WORKED} />
      </div>,
    );
    expect(html).toContain("data-explanation");
    expect(html).toContain("data-static-worked-case");
    expect(html).toContain("data-worked-example");
    expect(html).toContain(EXPLANATION);
    expect(html).toContain(WORKED);
    expect(html).toContain('data-execution-label="static"');
    expect(html).not.toMatch(/display:\s*none/);
    logger.log({
      testId: "keep-content-planted-negative",
      beadId: BEAD,
      outcome: "passed",
      extra: { readingOnly: true },
      message: "explanation and static worked case remain in served markup",
    });
  });

  test("StickyLabRegion serves the worked case beside the live region, so PaperReader cannot drop it", () => {
    const html = renderToStaticMarkup(
      <StickyLabRegion>
        <section id="lab-bm-01">
          <p>Live laboratory heading stays.</p>
        </section>
      </StickyLabRegion>,
    );
    expect(html).toContain("data-static-worked-case");
    expect(html).toContain("data-explanation");
    expect(html).toContain("Live laboratory heading stays.");
    expect(html).toContain("0.8");
    logger.log({
      testId: "keep-content-sticky-lab",
      beadId: BEAD,
      outcome: "passed",
      message: "reader lab region keeps the static case in markup",
    });
  });

  test("no special reading font and no learning-style copy is shipped", () => {
    const panel = readFileSync(new URL("./ReadingSettingsPanel.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("./readingSettings.css", import.meta.url), "utf8");
    const labels = JSON.stringify(READING_SETTING_LABELS);
    const visitorFacing = `${panel}\n${css}\n${labels}`.toLowerCase();
    for (const word of FORBIDDEN_COPY) {
      expect(visitorFacing).not.toContain(word);
    }
    logger.log({
      testId: "keep-content-no-forbidden-copy",
      beadId: BEAD,
      outcome: "passed",
      message: "no dyslexia-font claim and no stored learner type",
    });
  });
});

describe("dispatcher under reading-only", () => {
  beforeEach(async () => {
    await installDom();
  });
  afterEach(async () => {
    await uninstallDom();
  });

  function loaders(): ViewLoaders {
    return {
      "bm-06": async () => ({
        default: () => <div data-testid="fixture-bm-06">bm-06 fixture view</div>,
      }),
    };
  }

  test("with reading-only on, the static case is present and the live view waits for Load this experiment", async () => {
    const container = createContainer();
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(
          createElement(ExperimentDispatch, {
            id: "bm-06",
            instanceId: "test:reading-only",
            viewLoaders: loaders(),
            readingOnly: true,
          }),
        );
      });
      expect(container.querySelector("[data-explanation]")?.textContent).toBeTruthy();
      expect(container.querySelector("[data-static-worked-case]")?.textContent).toContain(
        "static worked case",
      );
      expect(container.querySelector('[data-testid="fixture-bm-06"]')).toBeNull();
      const button = container.querySelector("[data-load-experiment]");
      expect(button).not.toBeNull();
      await act(async () => {
        (button as HTMLButtonElement).click();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(container.querySelector("[data-static-worked-case]")).not.toBeNull();
      expect(container.querySelector('[data-testid="fixture-bm-06"]')).not.toBeNull();
      logger.log({
        testId: "dispatcher-reading-only-keeps-static",
        beadId: BEAD,
        instrumentId: "bm-06",
        outcome: "passed",
        extra: { readingOnly: true },
        message: "load action reveals the view; static case remains",
      });
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
