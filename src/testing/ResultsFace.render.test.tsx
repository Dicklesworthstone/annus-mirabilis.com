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
    limitation: { argumentId: "arg-x", text: "A limit." },
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

  test("reserves the genealogy slot with an honest placeholder when none is supplied", () => {
    const html = renderToStaticMarkup(<ResultsFace paper="p" cards={[minimalCard("r1", "s4")]} />);
    expect(html).toContain('data-genealogy-slot="true"');
    expect(html).toContain("pending am-eq-genealogy-hmm");
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
});
