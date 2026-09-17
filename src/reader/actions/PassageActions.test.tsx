import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReaderRegistry } from "../navigation/state.ts";
import { PassageActions } from "./PassageActions.tsx";
import type { PassageActions as PassageActionsData } from "./passageActions.schema.ts";

const REGISTRY: ReaderRegistry = {
  paperId: "brownian-motion",
  anchors: ["s4-p2-s1"],
  foundations: [],
};
const ORIGIN = "https://annus-mirabilis.com";
const AXES = { view: "reading" as const, detail: 1 as const, lens: false, anchor: "s4-p2-s1" };

function render(
  actions: PassageActionsData,
  extra: Partial<Parameters<typeof PassageActions>[0]> = {},
) {
  return renderToStaticMarkup(
    <PassageActions
      actions={actions}
      passageLabel="section 4, paragraph 2, sentence 1"
      origin={ORIGIN}
      registry={REGISTRY}
      axes={AXES}
      {...extra}
    />,
  );
}

describe("PassageActions: an action renders only when its content exists", () => {
  test("a bare hard:false record renders none of the five authored actions", () => {
    const html = render({ hard: false });
    expect(html).not.toContain("Why?");
    expect(html).not.toContain("Show the missing step");
    expect(html).not.toContain("Show me one example first");
    expect(html).not.toContain("Try it");
    expect(html).not.toContain("Read the original");
  });

  test("the copy-link action always renders, since it needs no authored content", () => {
    const html = render({ hard: false });
    expect(html).toContain("Copy a link to this passage");
  });

  test("why renders its authored text inline", () => {
    const html = render({
      hard: true,
      why: "The mean square displacement grows linearly in time.",
    });
    expect(html).toContain("Why?");
    expect(html).toContain("The mean square displacement grows linearly in time.");
  });

  test("missingStep and example each render only when authored", () => {
    const html = render({ hard: true, missingStep: "step text", example: "example text" });
    expect(html).toContain("Show the missing step");
    expect(html).toContain("step text");
    expect(html).toContain("Show me one example first");
    expect(html).toContain("example text");
  });

  test("tryIt without a resolved href does not render a broken link", () => {
    const html = render({ hard: false, tryIt: { kind: "static", staticExampleId: "ex-1" } });
    expect(html).not.toContain("Try it");
  });

  test("tryIt with a resolved href renders a real link", () => {
    const html = render(
      { hard: false, tryIt: { kind: "instrument", instrumentId: "bm-06" } },
      { tryItHref: "/lab/bm-06/?preset=bm-06-default" },
    );
    expect(html).toMatch(/<a[^>]*href="\/lab\/bm-06\/\?preset=bm-06-default"[^>]*>Try it<\/a>/);
  });

  test("original without a resolved href does not render", () => {
    const html = render({ hard: false, original: ["s4-p2-s1"] });
    expect(html).not.toContain("Read the original");
  });

  test("original with a resolved href renders a real link", () => {
    const html = render(
      { hard: false, original: ["s4-p2-s1"] },
      { originalHref: "/papers/brownian-motion/?view=german#s4-p2-s1" },
    );
    expect(html).toMatch(
      /<a[^>]*href="\/papers\/brownian-motion\/\?view=german#s4-p2-s1"[^>]*>Read the original<\/a>/,
    );
  });
});

describe("PassageActions: copy-link", () => {
  test("the no-script href equals buildPassageLink's output for the default axes at this anchor", () => {
    const html = render(
      { hard: false },
      { axes: { ...AXES, view: "german", detail: 2, lens: true } },
    );
    expect(html).toContain(
      'data-copy-link-noscript-href="https://annus-mirabilis.com/papers/brownian-motion/#s4-p2-s1"',
    );
  });

  test("the copy button's accessible name names the passage", () => {
    const html = render({ hard: false });
    expect(html).toMatch(
      /aria-label="Copy a link to this passage: section 4, paragraph 2, sentence 1"/,
    );
  });

  test("no clipboard fallback field renders before any copy attempt", () => {
    const html = render({ hard: false });
    expect(html).not.toContain('aria-label="Link to section 4, paragraph 2, sentence 1"');
  });
});

describe("PassageActions: obstacle menu integration", () => {
  test("the obstacle menu renders when obstacleResponses are declared", () => {
    const html = render({
      hard: true,
      obstacleResponses: { tooMuchAtOnce: { explanation: "test" } },
    });
    expect(html).toContain("What is getting in the way?");
  });

  test("a hard passage still offers the obstacle menu when no responses are authored", () => {
    const html = render({ hard: true });
    expect(html).toContain("What is getting in the way?");
    expect(html).toContain("This answer is not yet authored for this passage.");
  });

  test("the obstacle menu is absent when the passage is not hard and has no responses", () => {
    const html = render({ hard: false });
    expect(html).not.toContain("What is getting in the way?");
  });
});
