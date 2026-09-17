import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { buildPassageLink } from "./buildPassageLink.ts";
import { PassageActionsBar } from "./PassageActionsBar.tsx";
import { validatePassageActions } from "./passageActions.schema.ts";

const ACTIONS = validatePassageActions({
  hard: true,
  why: "mean-variance-rms",
  missingStep: "bridge-squaring-square-roots",
  example: "mean-variance-rms",
  tryIt: { instrumentId: "bm-01" },
  original: ["arg-bm-observable"],
  obstacleResponses: {
    algebraicMove: { explanation: "Square first." },
  },
});

describe("PassageActionsBar", () => {
  test("each available action is a real link, including the no-script copy href", () => {
    const html = renderToStaticMarkup(
      <PassageActionsBar
        paperId="brownian-motion"
        passageId="arg-bm-observable"
        passageLabel="Zero average is not no movement"
        actions={ACTIONS}
      />,
    );
    expect(html).toContain("Why?");
    expect(html).toContain("/foundations/mean-variance-rms/");
    expect(html).toContain("Show the missing step");
    expect(html).toContain("/foundations/bridge-squaring-square-roots/");
    expect(html).toContain("Show me one example first");
    expect(html).toContain("/lab/bm-01/");
    expect(html).toContain("Read the original");
    expect(html).toContain("/papers/brownian-motion/view/german/");
    expect(html).toContain('data-copy-passage="arg-bm-observable"');
    expect(html).toContain('data-passage-label="Zero average is not no movement"');
    expect(html).toContain("Copy a link to this passage: Zero average is not no movement");
    const defaultHref = "/papers/brownian-motion/#arg-bm-observable";
    expect(html).toContain(`href="${defaultHref}"`);
    expect(
      buildPassageLink({
        origin: "https://annus-mirabilis.com",
        registry: {
          paperId: "brownian-motion",
          anchors: ["arg-bm-observable"],
          foundations: [],
        },
        axes: { view: "reading", detail: 1, lens: false, anchor: "arg-bm-observable" },
      }),
    ).toBe(`https://annus-mirabilis.com${defaultHref}`);
  });

  test("an action with no content is omitted, never filled with a generic page", () => {
    const html = renderToStaticMarkup(
      <PassageActionsBar
        paperId="brownian-motion"
        passageId="arg-x"
        passageLabel="x"
        actions={validatePassageActions({ hard: false })}
      />,
    );
    expect(html).not.toContain("Why?");
    expect(html).not.toContain("Try it");
    expect(html).toContain("Link to this passage");
  });
});
