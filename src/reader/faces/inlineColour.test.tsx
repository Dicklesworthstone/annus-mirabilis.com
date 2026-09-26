/**
 * Every inline formula on an enforced paper's reading faces is drawn in colour (dispatch 272): the
 * German, English, parallel and gloss faces, which share the inlines. Each span of inline
 * mathematics carries its paper (the colour rules key on it) and the coloured render, and each
 * coloured glyph carries its quantity id. The denominator is printed per face.
 */
import { describe, expect, test } from "bun:test";
import type { ReactElement } from "react";
import { ENFORCED_INLINE_PAPERS } from "../../equations/printed/paperInlines.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { PaperPage } from "../PaperPage.tsx";
import { renderInlines } from "./inlines.tsx";

const FACES = ["german", "english", "parallel", "gloss"] as const;

describe("inline formulas on the reading faces", () => {
  test("on every face of every enforced paper, every inline formula is coloured", async () => {
    expect(ENFORCED_INLINE_PAPERS.length).toBeGreaterThan(0);
    for (const paper of ENFORCED_INLINE_PAPERS)
      for (const face of FACES) {
        const html = await exportMarkup(await PaperPage({ paperId: paper, face }));
        const spans = [...html.matchAll(/<span class="inline-math"([^>]*)>/g)].map(
          (m) => m[1] ?? "",
        );
        const drawn = spans.filter((attributes) => attributes.includes(`data-paper="${paper}"`));
        console.log(
          `${paper} ${face}: ${drawn.length} of ${spans.length} inline formulas in colour`,
        );
        expect(spans.length).toBeGreaterThan(0);
        expect(drawn.length).toBe(spans.length);
        // Each coloured glyph names its quantity, and colour never stands alone: the MathML is there.
        expect(html).toContain('data-inline-terms=""');
        expect(html).toMatch(
          /<span class="inline-math"[^>]*data-paper="[^"]+"[^>]*><span class="katex"><span class="katex-mathml">/,
        );
      }
  });

  test("a paper not yet enforced is drawn as before, plain", async () => {
    const html = await exportMarkup(
      await PaperPage({ paperId: "special-relativity", face: "german" }),
    );
    const spans = [...html.matchAll(/<span class="inline-math"([^>]*)>/g)].map((m) => m[1] ?? "");
    expect(spans.length).toBeGreaterThan(0);
    expect(spans.filter((a) => a.includes("data-paper="))).toEqual([]);
  });

  test("a plain inline formula carries no colour props at all, not even undefined ones", () => {
    // React's flight data writes an undefined prop as "$undefined": two such keys on each of
    // relativity's 410 plain formulas grew its German face past its record (dispatch 272).
    const [plain] = renderInlines([{ kind: "math", latex: "q" }], {
      terms: { paper: "special-relativity", holder: "s0-p1" },
    }) as ReactElement<Record<string, unknown>>[];
    expect(plain?.props.className).toBe("inline-math");
    expect(Object.keys(plain?.props ?? {})).not.toContain("data-paper");
    expect(Object.keys(plain?.props ?? {})).not.toContain("data-inline-terms");
  });
});
