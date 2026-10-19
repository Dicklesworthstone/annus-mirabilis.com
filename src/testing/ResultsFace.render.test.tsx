import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ResultsFace } from "../reader/faces/ResultsFace.tsx";
import type { ResultCard } from "../reader/faces/results/types.ts";

function minimalCard(resultId: string, section: string): ResultCard {
  return {
    resultId,
    paper: "brownian-motion",
    sectionAnchors: [section],
    printedEquationIds: [`eq-${resultId}`],
    oneSentence: `Sentence for ${resultId}.`,
    decoder: [],
    printedChecks: [],
    probes: [],
    misconceptionIds: [],
    usedBy: [],
    meanings: {
      argumentStatus: "derived",
      modelStatus: "idealized",
      evidentialRole: "theoretical-prediction",
      historicalStatus: "as-printed",
    },
    sources: [{ paper: "brownian-motion", anchor: section }],
    selectionReason: "test fixture",
    support: {
      proofRouteId: "route-x",
      chainId: "chain-x",
      routeKind: "source-order",
      entryAssumptions: [],
      alternativeRoutes: [],
      empiricalInputs: [],
      verificationState: { status: "verified" },
      isPublicationReady: true,
    },
    limitations: [{ argumentId: "arg-x", text: "A limit." }],
    reception: [],
  };
}

describe("ResultsFace.render: card ordering, section filter, genealogy slot", () => {
  test("renders every card in the order given, each with its own anchor", () => {
    const cards = [minimalCard("r1", "s4"), minimalCard("r2", "s5")];
    const html = renderToStaticMarkup(<ResultsFace paper="brownian-motion" cards={cards} />);
    expect(html.indexOf('id="result-r1"')).toBeLessThan(html.indexOf('id="result-r2"'));
  });

  test("renders a section filter only when more than one section is present", () => {
    const one = renderToStaticMarkup(<ResultsFace paper="p" cards={[minimalCard("r1", "s4")]} />);
    expect(one).not.toContain("results-face-filter");
    const two = renderToStaticMarkup(
      <ResultsFace paper="p" cards={[minimalCard("r1", "s4"), minimalCard("r2", "s5")]} />,
    );
    expect(two).toContain("results-face-filter");
  });

  test("leaves the genealogy slot out when none is supplied, naming no pending task to a reader", () => {
    const html = renderToStaticMarkup(<ResultsFace paper="p" cards={[minimalCard("r1", "s4")]} />);
    expect(html).not.toContain('data-genealogy-slot="true"');
    expect(html).not.toContain("pending am-eq-genealogy-hmm");
  });

  test("renders a supplied genealogy node in the reserved slot instead of the placeholder", () => {
    const html = renderToStaticMarkup(
      <ResultsFace
        paper="p"
        cards={[minimalCard("r1", "s4")]}
        genealogy={<div data-testid="genealogy-tree">tree</div>}
      />,
    );
    expect(html).toContain('data-testid="genealogy-tree"');
    expect(html).not.toContain("pending am-eq-genealogy-hmm");
  });

  /**
   * THE FILTER'S LINKS MUST LAND SOMEWHERE, which nothing asked until 2026-10-18.
   *
   * The test above asserts the nav is PRESENT when there is more than one section. Presence was
   * true and the control was dead: it emitted `href="#section-s4"` and no element on the page
   * carried that id, so all 24 such links on the three built results faces landed at the top of
   * the page. A dead fragment returns 200 and looks like a working control, which is why only a
   * check that resolves the href against the page's own ids can see it.
   *
   * Scoped to the filter nav on purpose. The cards also carry fragment links into the GERMAN face
   * (`#s5-p2-s7`), whose targets live on another page, so asserting that every href in this markup
   * resolves locally would be false for links that are correct.
   */
  function filterNav(html: string): string {
    const nav = html.match(/<nav class="results-face-filter"[^>]*>[\s\S]*?<\/nav>/u);
    expect(nav, "the markup must contain the section filter nav").not.toBeNull();
    return (nav as RegExpMatchArray)[0];
  }

  test("every section-filter link lands on an id this page carries", () => {
    const cards = [minimalCard("r1", "s4"), minimalCard("r2", "s5"), minimalCard("r3", "s10")];
    const html = renderToStaticMarkup(<ResultsFace paper="p" cards={cards} />);
    const nav = filterNav(html);

    const targets = [...nav.matchAll(/href="#([^"]+)"/gu)].map((m) => m[1] as string);
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/gu)].map((m) => m[1] as string));

    // Non-vacuity, written down: three sections means three links, and a nav that rendered none
    // would satisfy an "all resolve" assertion while proving nothing.
    expect(targets.length).toBe(3);
    expect(targets.filter((target) => !ids.has(target))).toEqual([]);

    // Each link lands on the FIRST card of its section, which is what makes the anchor exist.
    expect(nav).toContain('href="#result-r1"');
    expect(nav).toContain('href="#result-r2"');
    expect(nav).toContain('href="#result-r3"');

    // The retired spelling, kept as an explicit negative so it cannot return under a green suite.
    expect(nav).not.toContain('href="#section-');
  });

  test("sections are ordered by number, so s10 does not sit between s1 and s2", () => {
    // The built relativity face read s0, s1, s10, s2, s3 ... because the anchors were sorted as
    // strings. Cards are handed in deliberately out of order so the nav cannot pass by accident.
    const cards = [minimalCard("r10", "s10"), minimalCard("r2", "s2"), minimalCard("r1", "s1")];
    const nav = filterNav(renderToStaticMarkup(<ResultsFace paper="p" cards={cards} />));
    const labels = [...nav.matchAll(/>([^<>]+)<\/a>/gu)].map((m) => m[1] as string);
    expect(labels).toEqual(["s1", "s2", "s10"]);
  });

  test("an anchor that is not s<n> is ordered last rather than crashing the sort", () => {
    // Paper 3 has part headings, and a future card could carry one. The fallback keeps the nav
    // rendering instead of throwing on a shape the regex does not match.
    const cards = [minimalCard("rp", "part-1"), minimalCard("r2", "s2"), minimalCard("r1", "s1")];
    const nav = filterNav(renderToStaticMarkup(<ResultsFace paper="p" cards={cards} />));
    const labels = [...nav.matchAll(/>([^<>]+)<\/a>/gu)].map((m) => m[1] as string);
    expect(labels).toEqual(["s1", "s2", "part-1"]);
    expect(nav).toContain('href="#result-rp"');
  });
});
