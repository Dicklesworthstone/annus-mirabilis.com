import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { WeaveFlag } from "../../experiments/weave/types.ts";
import {
  WeaveHighlighter,
  weaveAccessiblePrefix,
  weaveTreatmentClass,
} from "./WeaveHighlighter.tsx";

function flag(overrides: Partial<WeaveFlag>): WeaveFlag {
  return {
    predicateId: "p1",
    meaning: "quantity-compared",
    lit: false,
    state: "not-evaluable",
    pointerText: "This is the pointer text.",
    targets: ["s4-p1"],
    ...overrides,
  };
}

describe("WeaveHighlighter: the presentational island", () => {
  test("an unlit flag renders children plain, with no mark and no pointer text", () => {
    const html = renderToStaticMarkup(
      <WeaveHighlighter flag={flag({ lit: false })}>the sentence text</WeaveHighlighter>,
    );
    expect(html).toContain("the sentence text");
    expect(html).toContain('data-weave-lit="false"');
    expect(html).not.toContain("<mark");
    expect(html).not.toContain("This is the pointer text.");
  });

  test("a missing flag (predicate not declared for this sentence) also renders children plain", () => {
    const html = renderToStaticMarkup(
      <WeaveHighlighter flag={undefined}>plain text</WeaveHighlighter>,
    );
    expect(html).toContain("plain text");
    expect(html).toContain('data-weave-lit="false"');
  });

  test("a lit flag wraps children in a mark carrying the predicate id, meaning, and state", () => {
    const html = renderToStaticMarkup(
      <WeaveHighlighter flag={flag({ lit: true, state: "enter" })}>
        the sentence text
      </WeaveHighlighter>,
    );
    expect(html).toContain("<mark");
    expect(html).toContain('data-weave-predicate="p1"');
    expect(html).toContain('data-weave-meaning="quantity-compared"');
    expect(html).toContain('data-weave-state="enter"');
    expect(html).toContain("the sentence text");
  });

  for (const meaning of [
    "assumption-active",
    "quantity-compared",
    "agreement-within-stated-bound",
    "outside-selected-domain",
  ] as const) {
    test(`meaning "${meaning}" carries a distinct accessible-name prefix and treatment class (never color alone)`, () => {
      const html = renderToStaticMarkup(
        <WeaveHighlighter flag={flag({ lit: true, meaning, state: "enter" })}>
          text
        </WeaveHighlighter>,
      );
      // React's server renderer HTML-escapes apostrophes (' -> &#x27;) in text content.
      expect(html).toContain(weaveAccessiblePrefix(meaning).replace(/'/g, "&#x27;"));
      expect(html).toContain(weaveTreatmentClass(meaning));
      expect(html).toContain("visually-hidden");
    });
  }

  test("the four meanings carry four distinct prefixes and four distinct treatment classes", () => {
    const meanings = [
      "assumption-active",
      "quantity-compared",
      "agreement-within-stated-bound",
      "outside-selected-domain",
    ] as const;
    const prefixes = new Set(meanings.map(weaveAccessiblePrefix));
    const treatments = new Set(meanings.map(weaveTreatmentClass));
    expect(prefixes.size).toBe(4);
    expect(treatments.size).toBe(4);
  });

  test("outside-selected-domain shows pointer text only when expanded is true", () => {
    const collapsed = renderToStaticMarkup(
      <WeaveHighlighter
        flag={flag({ lit: true, meaning: "outside-selected-domain", state: "enter" })}
        expanded={false}
      >
        text
      </WeaveHighlighter>,
    );
    expect(collapsed).not.toContain("This is the pointer text.");

    const expanded = renderToStaticMarkup(
      <WeaveHighlighter
        flag={flag({ lit: true, meaning: "outside-selected-domain", state: "enter" })}
        expanded={true}
      >
        text
      </WeaveHighlighter>,
    );
    expect(expanded).toContain("This is the pointer text.");
  });

  test("a non-outside-selected-domain lit flag always shows its pointer text regardless of expanded", () => {
    const html = renderToStaticMarkup(
      <WeaveHighlighter
        flag={flag({ lit: true, meaning: "quantity-compared", state: "enter" })}
        expanded={false}
      >
        text
      </WeaveHighlighter>,
    );
    expect(html).toContain("This is the pointer text.");
  });

  test("reduced motion is recorded as a data attribute for CSS to gate transitions on", () => {
    const html = renderToStaticMarkup(
      <WeaveHighlighter flag={flag({ lit: true, state: "enter" })} reducedMotion={true}>
        text
      </WeaveHighlighter>,
    );
    expect(html).toContain('data-weave-reduced-motion="true"');
  });
});
