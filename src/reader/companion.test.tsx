/**
 * The Brownian companion column carries the section it sits beside: the printed page the section
 * begins on and a key to its symbols. It held a placeholder sentence in every state before.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PaperReader } from "./PaperReader.tsx";

/** The side column's companion, not the phone sheet's copy of it. */
function sideColumn(html: string): string {
  const start = html.indexOf("data-reader-companion-column");
  const end = html.indexOf("</aside>", start);
  expect(start).toBeGreaterThan(-1);
  return html.slice(start, end);
}

const symbolIds = (column: string) =>
  [...column.matchAll(/<li class="equation-quantity" data-quantity-id="([^"]+)"/g)].map(
    (m) => m[1],
  );

describe("the Brownian companion column", () => {
  test("on §4 it shows page 556, where §4 begins, and §4's symbols", async () => {
    const column = sideColumn(renderToStaticMarkup(await PaperReader({ section: "s4" })));
    expect(column).toContain('src="/figures/plates/pages/ap-17-549/556.webp"');
    // Not the paper's first page, which a plate keyed by the paper would show.
    expect(column).not.toContain("ap-17-549/549.webp");
    expect(column).toContain('href="/papers/brownian-motion/s4/view/german/"');
    expect(column).toContain("Symbols in §4");
    expect(symbolIds(column)).toContain("diffusionCoefficient");
    expect(new Set(symbolIds(column)).size).toBe(symbolIds(column).length);
  });

  test("on §5 it shows page 559 and §5's own symbols", async () => {
    const column = sideColumn(renderToStaticMarkup(await PaperReader({ section: "s5" })));
    expect(column).toContain('src="/figures/plates/pages/ap-17-549/559.webp"');
    expect(column).toContain("Symbols in §5");
    // §5 brings viscosity into the argument; §4 does not.
    expect(symbolIds(column)).toContain("viscosity");
    const s4 = sideColumn(renderToStaticMarkup(await PaperReader({ section: "s4" })));
    expect(symbolIds(s4)).not.toContain("viscosity");
  });

  test("on the whole paper it points to the section pages and shows no plate", async () => {
    const column = sideColumn(renderToStaticMarkup(await PaperReader()));
    expect(column).not.toContain("companion-plate");
    expect(column).toContain('href="/papers/brownian-motion/s4/"');
    expect(column).toContain('href="/papers/brownian-motion/s5/"');
    expect(column).not.toContain("so the German argument keeps the main column");
  });
});
