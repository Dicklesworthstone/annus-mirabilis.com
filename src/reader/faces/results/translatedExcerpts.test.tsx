import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { loadResultCards, type PrintedExcerpt } from "../../../content/results/resultCards.ts";
import { exportMarkup } from "../../../testing/exportMarkup.ts";
import { PaperPage } from "../../PaperPage.tsx";
import { loadBilingualEdition } from "../bilingualLoader.ts";
import { excerptTranslator } from "./translatedExcerpts.ts";

const totals = {
  "brownian-motion": 13,
  "light-quanta": 16,
  "mass-energy": 13,
  "special-relativity": 82,
};

async function face(paper: string, view: "results" | "english" | "parallel") {
  const window = new Window();
  window.document.body.innerHTML = await exportMarkup(
    await PaperPage({ paperId: paper, face: view }),
  );
  return window.document;
}

describe("result quotations in the English edition", () => {
  for (const [paper, total] of Object.entries(totals)) {
    test(`${paper}: every printed excerpt has its edition text and lands on both published faces`, async () => {
      const results = await face(paper, "results");
      const english = await face(paper, "english");
      const parallel = await face(paper, "parallel");
      const cards = loadResultCards(process.cwd(), paper)?.cards ?? [];
      const quotes = [...results.querySelectorAll(".result-card details [data-translation-scope]")];
      expect(quotes).toHaveLength(total);
      for (const record of cards) {
        const card = results.getElementById(`result-${record.id}`);
        const disclosures = card?.querySelectorAll("details.result-translation");
        expect(disclosures).toHaveLength(1);
        expect(disclosures?.[0]?.querySelectorAll("[data-translation-scope]")).toHaveLength(
          record.printed.length,
        );
      }
      for (const quote of quotes) {
        expect(quote.getAttribute("data-translation-scope")).toBe("quotation");
        const units = [...quote.querySelectorAll("[data-excerpt-unit]")];
        const first = units[0]?.getAttribute("data-excerpt-unit");
        const links = [...quote.querySelectorAll(".fine a")].map((a) => a.getAttribute("href"));
        expect(links).toEqual([
          `/papers/${paper}/view/english/#${first}`,
          `/papers/${paper}/view/parallel/#en-${first}`,
        ]);
        expect(
          parallel.getElementById(`en-${first}`)?.getAttribute("data-translation-unit-id"),
        ).toBe(first);
        for (const unit of units) {
          const id = unit.getAttribute("data-excerpt-unit") ?? "";
          const canonical = english.getElementById(id)?.cloneNode(true);
          expect(canonical?.getAttribute("data-translation-unit-id")).toBe(id);
          // Compare the edition's prose and mathematical TeX, excluding its navigation and apparatus.
          const words = (el: typeof canonical) => {
            if (!el) return null;
            for (const math of el.querySelectorAll(".katex"))
              math.replaceWith(math.querySelector("annotation")?.textContent ?? "");
            for (const extra of el.querySelectorAll(
              ".page-turn, [data-action], .term-chips, .equation-explainer, .printed-operation-explorer > :not(:first-child), button, details, .sr-only, .visually-hidden",
            ))
              extra.remove();
            return el.textContent?.replace(/\s+/g, " ").trim();
          };
          // Display terms have their own interactive apparatus in the full edition.
          if (unit.querySelector(".inline-display"))
            expect(unit.querySelector("annotation")?.textContent).toBe(
              canonical?.querySelector("annotation")?.textContent,
            );
          else expect(words(unit.cloneNode(true))).toBe(words(canonical));
        }
      }
    }, 60000);
  }

  test("split sentences keep the intervening equation and editorial omissions stay visible", async () => {
    const paper = "mass-energy";
    const edition = await loadBilingualEdition(paper);
    if (!edition) throw new Error("Missing mass-energy edition");
    const translate = excerptTranslator(edition);
    const excerpt: PrintedExcerpt = {
      kind: "sentences",
      anchor: "s0-p5",
      ordinals: [2],
      publishedSentenceIds: ["s0-p5-s2"],
      text: "",
      page: 639,
    };
    const ids = (quote: ReturnType<typeof translate>) =>
      quote?.runs.map((run) => run.map((unit) => unit.id));
    expect(ids(translate(excerpt))).toEqual([["s0-p5-s2a", "eq-s0-d1", "s0-p5-s2b"]]);
    expect(ids(translate({ ...excerpt, publishedSentenceIds: ["s0-p5-s1", "s0-p5-s3"] }))).toEqual([
      ["s0-p5-s1"],
      ["s0-p5-s3"],
    ]);
    const context = translate({ ...excerpt, publishedSentenceIds: undefined });
    expect(context?.scope).toBe("paragraph");
    expect(context?.firstUnit).toBe("s0-p5-s1");
    const partial = excerptTranslator({
      ...edition,
      units: edition.units.filter((unit) => unit.id !== "s0-p5-s2b"),
    });
    expect(partial(excerpt)?.scope).toBe("paragraph");
    expect(excerptTranslator({ ...edition, units: [] })(excerpt)).toBeUndefined();
  });
});
