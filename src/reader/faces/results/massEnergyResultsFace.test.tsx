/**
 * The mass-energy results face as a reader gets it without JavaScript: /papers/mass-energy/view/results/
 * rendered from the real card records (content/results/mass-energy.yaml), German face, equation
 * records, laboratory manifests and scenario owner (am-me-results-cards-c6mf).
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadResultCards } from "../../../content/results/resultCards.ts";
import { loadPaper } from "../../../content/server.ts";
import { PRINTED_FACTOR_WORDING } from "../../../physics/reference/massEnergy.ts";
import { exportMarkup } from "../../../testing/exportMarkup.ts";
import { FaceFallback } from "../../FaceFallback.tsx";
import { PaperPage } from "../../PaperPage.tsx";

const PAPER = "mass-energy";
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

describe("mass-energy's results face, static", () => {
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

  test("the conversion card shows both constant sets and the owner's own comparison", () => {
    const card = cardHtml("me-mass-decrease");
    expect(card).toContain('data-constant-set-id="einstein-1905-mass-energy-printed"');
    expect(card).toContain('data-constant-set-id="modern-si-2019"');
    expect(card).toContain(">1 g<");
    expect(card).toContain("1.0013851 g");
    expect(card).toContain(PRINTED_FACTOR_WORDING);
  });

  test("a premise and a comparison are labelled as such", () => {
    const card = cardHtml("me-kinetic-energy-drop");
    expect(card).toContain('data-qualification="premise"');
    expect(card).toContain('data-qualification="comparison"');
    expect(card).toContain("A comparison, not a premise");
  });

  test("nothing a reader cannot use: no pending task, no typesetting error, no E = mc²", async () => {
    expect(html).not.toMatch(/pending am-/);
    expect(html).not.toContain("katex-error");
    expect(html.replace(/<[^>]+>/g, "")).not.toMatch(/E\s*=\s*mc/);
    // The argument's own outline stays below the cards, so a face change still lands on a passage.
    const { arguments: passages } = await loadPaper(PAPER);
    expect(passages.length).toBeGreaterThan(0);
    for (const a of passages) expect(html).toContain(`id="${a.id}"`);
  });
});
