import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { resultCardsFor } from "./fromRecords.ts";
import { ResultCard } from "./ResultCard.tsx";

describe("the edition's actual result cards expose their later evidence", () => {
  test("the photoelectric result renders the source, publication date and evidential limits without JavaScript", async () => {
    const cards = await resultCardsFor("light-quanta");
    const card = cards?.find((entry) => entry.resultId === "lq-photoelectric-energy");
    expect(card).toBeDefined();
    if (!card) return;
    expect(card.reception.map((entry) => entry.datasetId)).toContain("millikan-1916-sodium");
    const html = renderToStaticMarkup(<ResultCard card={card} />);
    expect(html).toContain('data-result-layer="reception"');
    expect(html).toContain('data-date-precision="month"');
    expect(html).toContain("published March 1916");
    expect(html).toContain("Figure 6");
    expect(html).toContain("contact potential");
    expect(html).toContain("not a premise available to Einstein in 1905");
    expect(html).toContain('href="https://archive.org/details/sim_physical-review_1916-03_7_3"');
    expect(html).not.toContain("2026-09-26");
    expect(html).not.toContain("fixture-dataset");

    const unrelated = cards?.filter((entry) => entry.resultId !== card.resultId) ?? [];
    expect(unrelated.length).toBeGreaterThan(0);
    for (const other of unrelated) {
      expect(other.reception).toEqual([]);
      expect(renderToStaticMarkup(<ResultCard card={other} />)).not.toContain(
        'data-result-layer="reception"',
      );
    }
  });
});
