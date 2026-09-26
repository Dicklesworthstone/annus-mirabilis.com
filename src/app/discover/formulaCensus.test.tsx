/**
 * The Discover pages' formulas in their papers' colours (dispatch 276): the census.
 *
 * It renders the eight Discover pages, the four journeys and their investigations, as the page
 * tests do, and reads every displayed or inline formula wrapper on them (class "formula" or
 * "formula-inline"). A laboratory's own formulas (data-lab-formula) are the lab resolver's and are
 * left to it. Each remaining formula must have come through the Discover resolver
 * (src/discovery/journeyFormulas.ts), so it resolved in its step's scope; and it must carry its
 * quantities (data-quantity-id) or say it has none to colour. On the built pages of b16bc66b, 65
 * KaTeX formulas were drawn there and 6 were coloured, and those 6 were an embedded laboratory's.
 *
 * It imports the pages, so it reads what they render whatever draws it; the last test also holds
 * the rendered formulas to src/discovery/journeyFormulaList.ts, the list the build's palette reads.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DISCOVER_FORMULAS } from "../../discovery/journeyFormulaList.ts";
import BrownianInvestigation from "./brownian-motion/investigate/page.tsx";
import BrownianJourney from "./brownian-motion/page.tsx";
import LightQuantaInvestigation from "./light-quanta/investigate/page.tsx";
import LightQuantaJourney from "./light-quanta/page.tsx";
import MassEnergyInvestigation from "./mass-energy/investigate/page.tsx";
import MassEnergyJourney from "./mass-energy/page.tsx";
import RelativityInvestigation from "./special-relativity/investigate/page.tsx";
import RelativityJourney from "./special-relativity/page.tsx";

const PAGES = {
  "discover/light-quanta": LightQuantaJourney,
  "discover/light-quanta/investigate": LightQuantaInvestigation,
  "discover/brownian-motion": BrownianJourney,
  "discover/brownian-motion/investigate": BrownianInvestigation,
  "discover/special-relativity": RelativityJourney,
  "discover/special-relativity/investigate": RelativityInvestigation,
  "discover/mass-energy": MassEnergyJourney,
  "discover/mass-energy/investigate": MassEnergyInvestigation,
} as const;

/** Each formula wrapper's opening tag, and the markup up to the next wrapper or the page's end. */
function formulasOf(html: string): { tag: string; body: string }[] {
  const starts = [...html.matchAll(/<(?:div|span) class="formula(?:-inline)?"[^>]*>/g)];
  return starts.map((m, i) => ({
    tag: m[0],
    body: html.slice(m.index, starts[i + 1]?.index ?? html.length),
  }));
}

const quantityIdsOf = (body: string): string[] => [
  ...new Set([...body.matchAll(/data-quantity-id="([^"]+)"/g)].map((m) => m[1] ?? "")),
];

describe("every formula on the Discover pages is drawn in its paper's colours, or says why not", () => {
  const census = Object.entries(PAGES).map(([page, Page]) => {
    const html = renderToStaticMarkup(<Page />);
    const own = formulasOf(html).filter((f) => !f.tag.includes("data-lab-formula"));
    return { page, own };
  });

  test("each is resolved in its step's scope, and carries its quantities or declares it has none", () => {
    const problems: string[] = [];
    let coloured = 0;
    let none = 0;
    for (const { page, own } of census)
      for (const { tag, body } of own) {
        const latex = /data-latex="([^"]*)"/.exec(tag)?.[1] ?? "?";
        if (!tag.includes("data-journey-formula="))
          problems.push(`${page}: ${latex} is drawn plain, not through JourneyFormula`);
        else if (tag.includes('data-journey-formula-bound="none"')) none++;
        else if (quantityIdsOf(body).length > 0) coloured++;
        else problems.push(`${page}: ${latex} names no quantity and does not say so`);
      }
    expect(problems).toEqual([]);
    // Non-vacuity: every page with formulas was read, and most of what they draw is coloured.
    const counts = Object.fromEntries(census.map((c) => [c.page, c.own.length]));
    expect(counts["discover/special-relativity/investigate"]).toBeGreaterThan(0);
    expect(counts["discover/mass-energy/investigate"]).toBeGreaterThan(0);
    expect(coloured).toBeGreaterThan(none);
    expect(none).toBeGreaterThan(0);
  });

  test("a coloured formula's root names its paper, which the colour rules key on", () => {
    const html = renderToStaticMarkup(<RelativityInvestigation />);
    const at = html.indexOf('data-latex="a(v)=a(-v)"');
    expect(at).toBeGreaterThan(-1);
    expect(html.lastIndexOf('data-paper="special-relativity"', at)).toBeGreaterThan(
      html.lastIndexOf("<details", at) - 1,
    );
  });

  test("the pages draw exactly the formulas the build's palette reads, no more and no fewer", () => {
    // A quantity gets its paper's colour only when a view in scripts/build-equations.ts names it,
    // and the build reads the Discover formulas from journeyFormulaList.ts. A formula drawn on a
    // page and missing from the list would keep a quantity out of the palette; an entry no page
    // draws would put one in for nothing.
    const attribute = (value: string) =>
      value
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
    const drawn = new Set(
      census.flatMap(({ own }) =>
        own.flatMap(({ tag }) => {
          const latex = /data-latex="([^"]*)"/.exec(tag)?.[1];
          const anchor = /data-journey-formula="([^"]*)"/.exec(tag)?.[1];
          return latex && anchor ? [`${anchor}\u0000${attribute(latex)}`] : [];
        }),
      ),
    );
    const listed = new Set(DISCOVER_FORMULAS.map((f) => `${f.scope.anchor}\u0000${f.latex}`));
    // Non-vacuity: both sides hold the pages' formulas.
    expect(drawn.size).toBeGreaterThan(30);
    expect([...drawn].filter((k) => !listed.has(k))).toEqual([]);
    expect([...listed].filter((k) => !drawn.has(k))).toEqual([]);
  });
});
