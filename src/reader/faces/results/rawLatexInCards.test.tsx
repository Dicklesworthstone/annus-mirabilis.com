/**
 * NO RESULTS CARD SHOWS A READER LATEX SOURCE.
 *
 * "Malformed mathematics fails publication; raw `$LaTeX$` is never visible to a reader" is a
 * product rule. On 2026-10-20 a sweep of all 759 built pages found exactly one page pair breaking
 * it, and the cause was that the four kinds of meaning were the only authored strings on the
 * results card rendered as bare text while every other string on the same card went through
 * `InlineMathText`. The relativity mirror-pressure card's model line names the cos-squared form,
 * so the reader was shown the delimiter and the control sequence as characters.
 *
 * This runs in the bun lane over the rendered faces, needing no build, so the rule is watched
 * where an author can see it break. The pipeline's `static-html` stage asks the same question of
 * the built bytes, which is the layer a no-JavaScript reader is served and the only one a build
 * can be wrong about on its own. Neither replaces the other.
 */

import { describe, expect, test } from "bun:test";
import { readerVisibleText, scanRawLatex } from "../../../content/editions/staticHtmlScan.ts";
import { loadResultCards } from "../../../content/results/resultCards.ts";
import { exportMarkup } from "../../../testing/exportMarkup.ts";
import { FaceFallback } from "../../FaceFallback.tsx";

const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const;

const rendered = await Promise.all(
  PAPERS.map(async (paper) => ({
    paper,
    cards: loadResultCards(process.cwd(), paper)?.cards ?? [],
    html: await exportMarkup(await FaceFallback({ paperId: paper, face: "results" })),
  })),
);

describe("the results faces show no LaTeX source", () => {
  test("every paper's cards reached the markup, so the scan below has a population", () => {
    // Named rather than asserted as an equality: the ledger grows when a plate turns up another
    // result. The property is that each paper has cards and that they are on the page.
    const census = rendered.map((r) => `${r.paper}: ${r.cards.length} cards`).join(", ");
    for (const { paper, cards, html } of rendered) {
      expect(cards.length, `${paper} has no cards (${census})`).toBeGreaterThan(0);
      const onPage = cards.filter((card) => html.includes(`id="result-${card.id}"`));
      expect(onPage.length, `${paper}: ${onPage.length} of ${cards.length} cards on the page`).toBe(
        cards.length,
      );
    }
  });

  test("no reader-visible LaTeX on any card of any paper", () => {
    const findings = rendered.flatMap(({ paper, html }) =>
      scanRawLatex(readerVisibleText(html)).map((f) => `${paper}: ${f.message} -- ${f.sample}`),
    );
    expect(findings).toEqual([]);
  });

  test("the four kinds of meaning are the group this came from, and they typeset their maths", () => {
    // The plant is the record that shipped the defect. Its model line carries inline mathematics;
    // after the repair the delimiter is gone from the text and KaTeX output stands in its place.
    const relativity = rendered.find((r) => r.paper === "special-relativity");
    expect(relativity).toBeDefined();
    const html = relativity?.html ?? "";
    const visible = readerVisibleText(html);
    expect(visible).toContain("for a plane wave and an ideal mirror");
    expect(visible).not.toContain("\\cos");
    expect(visible).not.toContain("\\(");
    // And the formula is really typeset, not merely deleted: KaTeX put the TeX in an annotation.
    expect(html).toContain("\\cos^2\\varphi");
    expect(html).toContain('encoding="application/x-tex"');
  });
});
