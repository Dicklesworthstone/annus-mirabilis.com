import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { srElectronMeasurementChains } from "../equations/derivations/srElectronMeasurements.ts";
import { SRElectronMeasurementsDerivation } from "./SRElectronMeasurementsDerivation.tsx";

for (const activeDetail of ["0", "1", "2"] as const) {
  test(`the three measured consequences render before hydration at detail ${activeDetail}`, () => {
    const html = renderToStaticMarkup(
      <SRElectronMeasurementsDerivation activeDetail={activeDetail} />,
    );
    expect(html).toContain('id="sr-electron-measurements-derivation"');
    expect(html).toContain('data-review="draft"');
    expect(html).toContain("<math");
    expect(html).not.toContain("katex-error");
    expect(html).not.toContain("gaussianChargeMagnitude");
    expect(html).not.toContain("\\lvert");
    for (const chain of srElectronMeasurementChains)
      for (const step of chain.steps) {
        expect(html).toContain(`data-step-id="${step.id}"`);
        expect(html).toContain(`id="${step.sourceAnchor}"`);
      }
    for (const source of ["eq-s10-d9", "eq-s10-d10", "eq-s10-d11", "eq-s10-d12"])
      expect(html).toContain(`href="/papers/special-relativity/view/german/#${source}"`);
    expect(html).toContain('href="/lab/sr-13/"');
    expect(html).toContain("Show every step here");
    expect(html).toContain("The physical premises and finite domains");
  });
}

test("static explanations preserve units, missing-boundary geometry, and what can distinguish models", () => {
  const html = renderToStaticMarkup(<SRElectronMeasurementsDerivation />);
  expect(html).toContain("Gaussian");
  expect(html).toContain("volts per metre");
  expect(html).toContain("teslas");
  expect(html).toContain("separate electric-only and magnetic-only trials");
  expect(html).toContain("At v = 0 no orbit is traced");
  expect(html).toContain("B = 0 no");
  expect(html).toContain("The deflectability ratio alone does not distinguish");
  expect(html).toContain("Newtonian model");
  expect(html).toContain("independent measurements and their uncertainties");
  expect(html).toContain("<caption>");
  expect(html).toContain("Try a new case: double B");
  expect(html).toContain(
    '<details class="local-steps" open=""><summary>The physical premises and finite domains',
  );
  expect(html).toContain('class="local-steps" open=""');
});

test("modern perspective keeps the same conclusions and primary-source trail", () => {
  const html = renderToStaticMarkup(<SRElectronMeasurementsDerivation perspective="modern" />);
  for (const chain of srElectronMeasurementChains)
    expect(html).toContain(`data-derivation-chain="${chain.id}"`);
  expect(html).toContain("Historian");
  expect(html).toContain("pp. 920–921");
});
