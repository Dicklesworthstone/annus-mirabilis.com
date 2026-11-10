import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BROWNIAN_SHELF_CARDS } from "../content/brownianShelf.ts";
import { AuthoredJourneyStage } from "./AuthoredJourneyStage.tsx";
import { OBSERVABLE_STAGE } from "./brownian/stages.ts";
import { MassEnergyStage } from "./massEnergy/MassEnergyStage.tsx";
import { COEFFICIENT_STAGE, TWO_LEDGERS_STAGE } from "./massEnergy/stages.ts";

describe("the shared authored-stage renderer", () => {
  test("supplied shelf cards, guidance and narrative render without a notebook provider", () => {
    const html = renderToStaticMarkup(
      <AuthoredJourneyStage stage={OBSERVABLE_STAGE} shelf={BROWNIAN_SHELF_CARDS} />,
    );
    expect(html).toContain('href="#card-gouy-1888-brownian-motion"');
    expect(html).toContain("Note sur le mouvement brownien");
    expect(html).toContain("Imagine marking each particle");
    expect(html).toContain("Work through this step");
    expect(html).toContain("What the premises decide so far");
    expect(html).not.toContain("data-discovery-stage-notes");
  });

  test("mass-energy's formula stays between its original paragraphs and exercises remain after support", () => {
    const html = renderToStaticMarkup(
      <MassEnergyStage
        stage={COEFFICIENT_STAGE}
        afterFirstParagraph={<p data-formula-slot="">The existing rich formula</p>}
      >
        <p data-exercise-slot="">The existing exercise</p>
      </MassEnergyStage>,
    );
    const firstParagraph = html.indexOf('data-stage-prose=""');
    const secondParagraph = html.indexOf('data-stage-prose=""', firstParagraph + 1);
    expect(firstParagraph).toBeGreaterThan(0);
    expect(html.indexOf("data-formula-slot")).toBeGreaterThan(firstParagraph);
    expect(html.indexOf("data-formula-slot")).toBeLessThan(secondParagraph);
    expect(html.indexOf("data-exercise-slot")).toBeGreaterThan(
      html.indexOf("data-stage-worked-example"),
    );
  });

  test("the declared 1905 import remains visibly distinct from the 1904 premises", () => {
    const html = renderToStaticMarkup(<MassEnergyStage stage={TWO_LEDGERS_STAGE} />);
    expect(html).toContain('href="#card-einstein-1905-light-complex-transformation"');
    expect(html).toContain("(imported from 1905)");
    expect(html).toContain('href="#card-helmholtz-1847-conservation-of-energy"');
    expect(html).toContain("(1847)");
  });
});
