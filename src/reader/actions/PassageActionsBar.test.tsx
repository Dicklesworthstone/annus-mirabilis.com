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
    expect(html).toContain('aria-label="Why?: Zero average is not no movement"');
    expect(html).toContain('aria-label="Show the missing step: Zero average is not no movement"');
    expect(html).toContain(
      'aria-label="Show me one example first: Zero average is not no movement"',
    );
    expect(html).toContain('aria-label="Try it: Tracer ensemble"');
    expect(html).toContain(
      'aria-label="Read the original German: Zero average is not no movement"',
    );
    expect(html).toContain(
      'aria-label="Copy a link to this passage: Zero average is not no movement"',
    );
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

  test("tryIt for bm-07 renders accessible name 'Try it: Molecular-number inference' (AC2)", () => {
    const html = renderToStaticMarkup(
      <PassageActionsBar
        paperId="brownian-motion"
        passageId="arg-bm-inference"
        passageLabel="What would let us count molecules?"
        actions={validatePassageActions({
          hard: false,
          tryIt: { instrumentId: "bm-07" },
        })}
      />,
    );
    expect(html).toContain('aria-label="Try it: Molecular-number inference"');
  });

  test("two passages offering the same action types never receive identical accessible names (AC4)", () => {
    const html1 = renderToStaticMarkup(
      <PassageActionsBar
        paperId="brownian-motion"
        passageId="arg-bm-observable"
        passageLabel="Zero average is not no movement"
        actions={ACTIONS}
      />,
    );
    const html2 = renderToStaticMarkup(
      <PassageActionsBar
        paperId="brownian-motion"
        passageId="arg-bm-independent-steps"
        passageLabel="Why the square grows with time"
        actions={validatePassageActions({
          hard: false,
          why: "probability-independence",
          missingStep: "random-walks",
          example: "random-walks",
          tryIt: { instrumentId: "bm-05" },
          original: ["arg-bm-independent-steps"],
        })}
      />,
    );

    const extractLinkAriaLabels = (markup: string) => {
      const matches = [...markup.matchAll(/<a\s+[^>]*aria-label="([^"]+)"/g)];
      return matches.map((m) => m[1]);
    };

    const labels1 = extractLinkAriaLabels(html1);
    const labels2 = extractLinkAriaLabels(html2);

    expect(labels1.length).toBeGreaterThan(0);
    expect(labels2.length).toBeGreaterThan(0);

    // Negative assertion: two passages that offer the same action types must not share any accessible names
    for (const label of labels1) {
      expect(labels2).not.toContain(label);
    }
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
