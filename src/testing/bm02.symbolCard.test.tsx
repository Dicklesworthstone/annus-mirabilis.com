import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import OsmoticPartitionPage from "../app/lab/bm-02/page.tsx";

/**
 * am-bm-02-osmotic-partition-n13x: the symbol card for n, N_p and N_A is present at every reading.
 * The lab named N_p and n only where they were used and never mentioned N_A, the letter Einstein
 * writes N. The card sits outside the detail readings, so no reading setting hides it.
 */
describe("BM-02 symbol card", () => {
  const html = renderToStaticMarkup(<OsmoticPartitionPage />);
  const start = html.indexOf('aria-label="Three symbols that are easy to confuse"');
  const card = start < 0 ? "" : html.slice(start, html.indexOf("</section>", start));

  test("the card renders once, as a focusable named region", () => {
    expect(start).toBeGreaterThan(0);
    expect(html.split('aria-label="Three symbols that are easy to confuse"').length - 1).toBe(1);
    expect(html.slice(html.lastIndexOf("<section", start), start + 1)).toContain('tabindex="0"');
  });

  test("it names N_p, n and N_A, and says Einstein writes N_A as N", () => {
    const text = card.replace(/<[^>]+>/g, "");
    expect(text).toContain("How many suspended particles are in the chamber");
    expect(text).toContain("Their number density");
    expect(text).toContain("Avogadro");
    expect(text).toContain("Einstein writes it N.");
    expect(text).toContain("this laboratory does not use it");
  });

  test("it is not inside a detail reading that a setting could hide", () => {
    expect(start).toBeGreaterThan(0);
    const before = html.slice(0, start);
    const openDetail = before.lastIndexOf("data-detail=");
    const closedSince = openDetail < 0 || before.indexOf("</p>", openDetail) > 0;
    expect(closedSince).toBe(true);
  });
});
