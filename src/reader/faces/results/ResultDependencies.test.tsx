import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { resultDependenciesFor } from "../../../content/results/resultDependencies.ts";
import { paperEquations } from "../../paperEquations.ts";
import { ResultsFace } from "../ResultsFace.tsx";
import { resultCardsFor } from "./fromRecords.ts";
import { ResultDependencies } from "./ResultDependencies.tsx";

const paper = "brownian-motion";
const cards = await resultCardsFor(paper);
if (!cards) throw new Error("The real Brownian cards must load.");
const equations = paperEquations(paper);
const supports = new Map(
  cards.flatMap((card) =>
    card.support?.kind === "checked-proof" ? [[card.resultId, card.support] as const] : [],
  ),
);
const results = resultDependenciesFor(
  paper,
  cards.map((card) => card.resultId),
  supports,
  equations,
);

describe("the result dependency navigation a reader can actually use", () => {
  test("the real results face mounts the navigation and its introduction lands on it", () => {
    const html = renderToStaticMarkup(
      <ResultsFace paper={paper} cards={cards} equations={equations} />,
    );
    expect(html).toContain('href="#result-dependencies"');
    expect(html).toContain('id="result-dependencies"');
    expect(html).toContain('data-genealogy-slot="true"');
    expect(html).toContain("How these results fit together");
    for (const card of cards) {
      expect(html).toContain(`data-dependency-result="${card.resultId}"`);
      expect(html).toContain(`id="result-${card.resultId}"`);
    }
  });

  test("links, scope and assumptions are in static HTML with no graph controls to hydrate", () => {
    const html = renderToStaticMarkup(<ResultDependencies results={results} />);
    expect(html).toContain("Inputs in the source-order route");
    expect(html).toContain("Inputs in a teaching route");
    expect(html).toContain("Used by these routes");
    expect(html).toContain(
      'href="/papers/brownian-motion/view/results/#result-bm-osmotic-pressure"',
    );
    expect(html).toContain('href="/papers/brownian-motion/#arg-bm-independent-steps"');
    expect(html).toContain('href="/papers/brownian-motion/s3/#bm-equilibrium-derivation"');
    expect(html).toContain("What the calculation takes as given");
    expect(html).toContain("Stokes mobility and its domain");
    expect(html).toContain('class="local-steps result-dependencies-assumptions"');
    expect(html).toContain("<details");
    expect(html).not.toContain("<button");
    const words = html.replace(/<[^>]+>/g, "");
    expect(words).not.toMatch(/eq-model-|chain-bm-|arg-bm-/);
    expect(words).not.toContain("\\(");
  });

  test("a supplied genealogy still overrides the default navigation", () => {
    const html = renderToStaticMarkup(
      <ResultsFace
        paper={paper}
        cards={cards}
        equations={equations}
        genealogy={<p>Chosen route</p>}
      />,
    );
    expect(html).toContain("Chosen route");
    expect(html).not.toContain('data-result-dependencies=""');
    expect(html).not.toContain('href="#result-dependencies"');
    const absent = renderToStaticMarkup(
      <ResultsFace paper={paper} cards={cards} equations={equations} genealogy={false} />,
    );
    expect(absent).not.toContain('data-genealogy-slot="true"');
  });

  test("an unresolved optional route cannot hide the paper's result cards", () => {
    const unresolved = cards.map((card) =>
      card.resultId === "bm-diffusion-coefficient" ? { ...card, support: undefined } : card,
    );
    const html = renderToStaticMarkup(
      <ResultsFace paper={paper} cards={unresolved} equations={equations} />,
    );
    for (const card of cards) expect(html).toContain(`id="result-${card.resultId}"`);
    expect(html).not.toContain('data-result-dependencies=""');
    expect(html).not.toContain('href="#result-dependencies"');
    expect(html).not.toContain("result-dependencies-unresolved");
  });

  test("the optional-route boundary does not conceal an unrelated rendering failure", () => {
    const broken = new Map(equations);
    const failure = new Error("A different failure in the equation owner");
    broken.get = () => {
      throw failure;
    };
    expect(() =>
      renderToStaticMarkup(<ResultsFace paper={paper} cards={cards} equations={broken} />),
    ).toThrow(failure);
  });

  test("an unproved postulate remains readable beside the checked routes and the detailed import route", async () => {
    const relativity = await resultCardsFor("special-relativity");
    if (!relativity) throw new Error("The actual relativity results must load.");
    const html = renderToStaticMarkup(
      <ResultsFace
        paper="special-relativity"
        cards={relativity}
        equations={paperEquations("special-relativity")}
      />,
    );
    expect(html).toContain('data-dependency-result="sr-two-postulates"');
    expect(html).toContain('data-dependency-result="sr-transformation-equations"');
    expect(html).toContain("Takes a premise");
    expect(html).toContain('id="light-complex-genealogy"');
    expect(html).toContain('data-dependency-cross-paper="energy-transformation"');
    expect(html).toContain("Recorded use across papers");
    expect(html).toContain(
      'href="/papers/mass-energy/view/results/#result-me-light-energy-transformation"',
    );
    expect(html).toContain('href="/papers/special-relativity/#arg-sr-lorentz-map"');
  });
});
