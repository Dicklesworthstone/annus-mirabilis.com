import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { srLightComplexDerivation } from "../equations/derivations/srLightComplex.ts";
import { SRLightComplexDerivation } from "./SRLightComplexDerivation.tsx";

describe("SR §8 light-complex reader derivation", () => {
  test("renders the complete chain, marked move and source returns without hydration", () => {
    const html = renderToStaticMarkup(<SRLightComplexDerivation />);
    expect(html).toContain('data-derivation-chain="chain-sr-light-complex"');
    expect(html).toContain('data-historical-status="pedagogical-reconstruction"');
    expect(html).toContain('data-review="draft"');
    expect(html).toContain('data-is-move="true"');
    expect(html).toContain("The move:");
    expect(html).toContain("<math");
    expect(html).not.toContain("katex-error");
    expect(html).not.toMatch(/aria-label="[^"]*\\(?:nu|gamma|varphi)/);
    for (const step of srLightComplexDerivation.steps) {
      expect(html).toContain(`data-step-id="${step.id}"`);
      expect(html).toContain(`id="${step.sourceAnchor}"`);
      expect(html).toContain(`/foundations/${step.tool!.replace("foundation:", "")}/`);
    }
    for (const source of ["eq-s7-d7", "eq-s7-d11", "eq-s8-d3", "eq-s8-d4"]) {
      expect(html).toContain(`href="/papers/special-relativity/view/german/#${source}"`);
    }
    expect(html).toContain("That direction cannot distinguish them.");
    expect(html).toContain("cos φ = 0.6");
  });

  test("the caller can select every-step reading without losing the other readings", () => {
    const html = renderToStaticMarkup(
      <SRLightComplexDerivation activeDetail="2" perspective="modern" />,
    );
    expect(html).toContain('data-detail="1" hidden=""');
    expect(html).not.toMatch(/data-detail="2" hidden=""/);
    expect(html).toContain("determinant is q");
    expect(html).toContain("Show every step here");
  });
});
