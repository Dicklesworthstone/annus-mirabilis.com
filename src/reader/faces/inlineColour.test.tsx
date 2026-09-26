/**
 * Every inline formula on an enforced paper's reading faces is drawn in colour (dispatch 272): the
 * German, English, parallel and gloss faces, which share the inlines. Each span of inline
 * mathematics carries its paper (the colour rules key on it) and the coloured render, and each
 * coloured glyph carries its quantity id. The denominator is printed per face.
 *
 * The gloss prints one section per page (glossSections.ts), and its paper page prints only the
 * first, so the gloss is read from every section's page. Light quanta's introduction prints no
 * formula: its paper gloss page alone would count none.
 */
import { describe, expect, test } from "bun:test";
import type { ReactElement } from "react";
import { ENFORCED_INLINE_PAPERS } from "../../equations/printed/paperInlines.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { PaperPage } from "../PaperPage.tsx";
import { loadBilingualEdition } from "./bilingualLoader.ts";
import { blocksBySection } from "./glossSections.ts";
import { renderInlines } from "./inlines.tsx";

const FACES = ["german", "english", "parallel", "gloss"] as const;

describe("inline formulas on the reading faces", () => {
  test("on every face of every enforced paper, every inline formula is coloured", async () => {
    expect(ENFORCED_INLINE_PAPERS.length).toBeGreaterThan(0);
    for (const paper of ENFORCED_INLINE_PAPERS)
      for (const face of FACES) {
        const edition = await loadBilingualEdition(paper);
        const sections = face === "gloss" ? [...blocksBySection(edition?.blocks ?? []).keys()] : [];
        const pages =
          face === "gloss"
            ? await Promise.all(
                sections.map((section) => PaperPage({ paperId: paper, section, face })),
              )
            : [await PaperPage({ paperId: paper, face })];
        const html = (await Promise.all(pages.map((page) => exportMarkup(page)))).join("\n");
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

  test("a paper the build does not colour is drawn as before, plain", () => {
    // Relativity was the example until it was enforced (dispatch 277); every paper with a reading
    // face now is. The companion dissertation is not, and the build compiles none of its inline
    // formulas, so one of them is drawn plain, with no paper for a colour rule to key on.
    expect(ENFORCED_INLINE_PAPERS).not.toContain("molecular-dimensions");
    const [plain] = renderInlines([{ kind: "math", latex: "k" }], {
      terms: { paper: "molecular-dimensions", holder: "s1-p1" },
    }) as ReactElement<Record<string, unknown>>[];
    expect(plain?.props.className).toBe("inline-math");
    expect(Object.keys(plain?.props ?? {})).not.toContain("data-paper");
    // The positive control: a formula the build compiled for relativity's § 3 is drawn in colour.
    const [coloured] = renderInlines([{ kind: "math", latex: "v" }], {
      terms: { paper: "special-relativity", holder: "s3-p2" },
    }) as ReactElement<Record<string, unknown>>[];
    expect(coloured?.props["data-paper"]).toBe("special-relativity");
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
