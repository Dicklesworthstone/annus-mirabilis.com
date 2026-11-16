import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { srDopplerChains, srDopplerSourceLinks } from "../equations/derivations/srDoppler.ts";
import { SRDopplerDerivation } from "./SRDopplerDerivation.tsx";

describe("the source-linked SR §7 derivation", () => {
  test("all phase, frequency and direction steps are present without hydration", () => {
    const html = renderToStaticMarkup(<SRDopplerDerivation />);
    expect(html).toContain('id="sr-doppler-derivation"');
    expect(html).toContain('data-argument-id="arg-sr-doppler-aberration"');
    expect(html).toContain('data-historical-status="pedagogical-reconstruction"');
    expect(html).toContain('data-is-move="true"');
    expect(html).toContain("<math");
    expect(html).not.toContain("katex-error");
    expect(html).not.toContain("y_{\\mathrm{y}}");
    expect(html).not.toMatch(/aria-label="[^"]*y sub y/);
    for (const chain of srDopplerChains) {
      expect(html).toContain(`data-derivation-chain="${chain.id}"`);
      for (const step of chain.steps) {
        expect(html).toContain(`data-step-id="${step.id}"`);
        expect(html).toContain(`id="${step.sourceAnchor}"`);
        expect(html).toContain(`/foundations/${step.tool!.replace("foundation:", "")}/`);
      }
    }
    for (const source of srDopplerSourceLinks)
      expect(html).toContain(`href="/papers/special-relativity/view/german/#${source.anchor}"`);
    expect(html).toContain('href="/lab/sr-09/"');
    expect(html).toContain("independently variable");
    expect(html).toContain("propagation direction in K");
    expect(html).toContain("q = 1.25");
    expect(html).toContain("q = 0.8");
    expect(html).toContain("physical premises");
  });

  test("every-step detail retains the coefficient and domain explanations", () => {
    const html = renderToStaticMarkup(
      <SRDopplerDerivation activeDetail="2" perspective="modern" />,
    );
    expect(html).toContain('data-detail="1" hidden=""');
    expect(html).not.toMatch(/data-detail="2" hidden=""/);
    expect(html).toContain("strictly positive");
    expect(html).toContain("No numerical fit");
    expect(html).toContain("Show every step here");
    expect(html).toContain("ordinary frequency");
  });
});
