/**
 * The relativity results face as a reader gets it without JavaScript:
 * /papers/special-relativity/view/results/, rendered from the real card records
 * (content/results/special-relativity.yaml), the German face read from the source blocks, equation
 * records and laboratory manifests (dispatch 241), with massEnergyResultsFace.test.tsx's checks.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadResultCards } from "../../../content/results/resultCards.ts";
import { exportMarkup } from "../../../testing/exportMarkup.ts";
import { FaceFallback } from "../../FaceFallback.tsx";
import { PaperPage } from "../../PaperPage.tsx";

const PAPER = "special-relativity";
const records = loadResultCards(process.cwd(), PAPER)?.cards ?? [];
const html = await exportMarkup(await FaceFallback({ paperId: PAPER, face: "results" }));
const german = renderToStaticMarkup(await PaperPage({ paperId: PAPER, face: "german" } as never));

/** The markup of one card, from its opening tag to the next card or the end of the cards. */
function cardHtml(id: string): string {
  const start = html.indexOf(`id="result-${id}"`);
  if (start === -1) return "";
  const next = html.indexOf('<article class="result-card"', start + 1);
  return html.slice(start, next === -1 ? undefined : next);
}

describe("relativity's results face, static", () => {
  test("every card record is on the page, in the records' order, so the checks below examine them", () => {
    expect(records.length).toBeGreaterThan(0);
    const order = records.map((r) => html.indexOf(`id="result-${r.id}"`));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  test("each card quotes Einstein in German, and each quotation links to where it stands on the German face", () => {
    const wrong: string[] = [];
    for (const r of records) {
      const card = cardHtml(r.id);
      if (!card.includes('<blockquote lang="de">')) wrong.push(`${r.id}: no German quotation`);
      for (const p of r.printed) {
        if (!card.includes(`data-printed-anchor="${p.anchor}"`))
          wrong.push(`${r.id}: ${p.anchor} not quoted`);
        if (!card.includes(`href="/papers/${PAPER}/view/german/#${p.anchor}"`))
          wrong.push(`${r.id}: no link to ${p.anchor}`);
        if (!german.includes(`id="${p.anchor}"`))
          wrong.push(`${r.id}: the German face has no ${p.anchor}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  test("no ledger markup and no raw TeX reach the page as text", () => {
    const text = html
      .replace(/<annotation[^>]*>[\s\S]*?<\/annotation>/g, "")
      .replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/\[\[(SPERR|\/SPERR|FN-MARK|EM|EQ-LABEL)/);
    expect(text).not.toMatch(/\$[^$\s][^$]*\$/);
    expect(html).not.toContain("katex-error");
  });

  test("the modern layer is the compiled records, never a placeholder", () => {
    const wrong: string[] = [];
    for (const r of records.filter((x) => x.equations.length > 0)) {
      const card = cardHtml(r.id);
      if (!card.includes(`data-equations="${r.equations.join(" ")}"`))
        wrong.push(`${r.id}: modern layer is not ${r.equations.join(" ")}`);
    }
    expect(records.some((r) => r.equations.length > 0)).toBe(true);
    expect(wrong).toEqual([]);
    expect(html).not.toContain("data-equation-placeholder");
  });

  test("each probe links its laboratory and names the manifest's preset, with no preset in the URL", () => {
    const probes = records.flatMap((r) => r.probes.map((p) => ({ id: r.id, ...p })));
    expect(probes.length).toBeGreaterThan(0);
    const wrong: string[] = [];
    for (const p of probes) {
      const card = cardHtml(p.id);
      if (!card.includes(`href="/lab/${p.instrumentId}/"`))
        wrong.push(`${p.id}: no link to ${p.instrumentId}`);
      if (p.preset && !card.includes(`Choose the preset “${p.preset.label}”`))
        wrong.push(`${p.id}: preset ${p.preset.id} not named`);
    }
    expect(wrong).toEqual([]);
    expect(html).not.toContain("?preset=");
  });
});
