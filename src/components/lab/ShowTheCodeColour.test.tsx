import { describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { extractTypeScriptExport } from "../../content/kernel/extractTypeScript.ts";
import { computeBm01StokesEinsteinTrace } from "../../content/kernel/trace.ts";
import { paperQuantityColours } from "../../equations/quantityColourView.ts";
import { ShowTheCode } from "./ShowTheCode.tsx";

/*
  One colour per quantity reaches the code (owner's ruling, 2026-09-22): an identifier and a trace
  row take the colour their quantity has in the paper's equations, the same var(--q-n) the formula
  uses. Before, identifiers took a hue hashed from the id (dark green on the dark theme) and trace
  rows the three role colours, so viscosity was ochre in the equation and brown beside it.
*/
const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const extracted = extractTypeScriptExport({
  root,
  modulePath: "src/content/kernel/__fixtures__/ts/target.ts",
  exportName: "evaluateStokesEinstein",
  revision: "fixture",
});
const listing = {
  displayRole: "reference-implementation" as const,
  language: "ts" as const,
  exportName: "evaluateStokesEinstein",
  filePath: extracted.filePath,
  revision: extracted.revision,
  sourceHash: extracted.sourceHash,
  source: extracted.source,
  words: "Take the temperature and the viscosity and compute the diffusion coefficient.",
  equationId: "eq-model-bm-diffusivity",
  independentReferences: [] as { experimentId: string; quantityId: string }[],
  identifierBindings: [
    { kernelFunction: "evaluateStokesEinstein", identifier: "eta", quantityId: "viscosity" },
  ],
  trace: computeBm01StokesEinsteinTrace(),
};

/** The opening tag of the first element carrying this quantity id with this tag name. */
function openTag(html: string, tag: string, quantityId: string): string {
  const match = new RegExp(`<${tag}\\b[^>]*data-quantity-id="${quantityId}"[^>]*>`).exec(html);
  expect(match).not.toBeNull();
  return match?.[0] ?? "";
}

describe("show-the-code uses the paper's quantity colours", () => {
  const viscosity = paperQuantityColours("brownian-motion").viscosity;

  test("viscosity has a colour in the Brownian paper, so the checks below are not vacuous", () => {
    expect(viscosity?.slot).toBeGreaterThanOrEqual(0);
  });

  test("an identifier and a trace row take the quantity's slot, not a hashed or role hue", () => {
    const html = renderToStaticMarkup(<ShowTheCode listings={[listing]} />);
    const slot = `--qc:var(--q-${viscosity?.slot})`;
    expect(openTag(html, "span", "viscosity")).toContain(slot);
    expect(openTag(html, "span", "viscosity")).toContain("color:var(--qc, inherit)");
    expect(openTag(html, "span", "viscosity")).not.toMatch(/color:hsl/);
    expect(openTag(html, "tr", "viscosity")).toContain(slot);
  });

  test("a quantity no Brownian equation shows keeps the ink: no colour it does not have", () => {
    expect(paperQuantityColours("brownian-motion").molarGasConstant).toBeUndefined();
    const html = renderToStaticMarkup(<ShowTheCode listings={[listing]} />);
    expect(openTag(html, "tr", "molarGasConstant")).not.toContain("--qc");
  });

  test("a listing whose paper cannot be told takes no quantity colour at all", () => {
    const html = renderToStaticMarkup(
      <ShowTheCode listings={[{ ...listing, equationId: undefined }]} />,
    );
    expect(html).not.toContain("--qc:var(--q-");
  });
});
