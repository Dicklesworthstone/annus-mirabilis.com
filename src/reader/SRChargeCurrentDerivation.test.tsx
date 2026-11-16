import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  srChargeCurrentAssumptions,
  srChargeCurrentChains,
  srChargeCurrentSourceLinks,
} from "../equations/derivations/srChargeCurrent.ts";
import { SRChargeCurrentDerivation } from "./SRChargeCurrentDerivation.tsx";

describe("the source-linked SR §9 charge/current derivation", () => {
  test("all six arguments and the neutral-mixture explanation are present without hydration", () => {
    const html = renderToStaticMarkup(<SRChargeCurrentDerivation />);
    expect(html).toContain('id="sr-charge-current-derivation"');
    expect(html).toContain('data-argument-id="arg-sr-charge-current"');
    expect(html).toContain('data-historical-status="pedagogical-reconstruction"');
    expect(html).toContain('data-review="draft"');
    expect(html).toContain('data-is-move="true"');
    expect(html).toContain("<math");
    expect(html).not.toContain("katex-error");
    for (const chain of srChargeCurrentChains) {
      expect(html).toContain('data-derivation-chain="' + chain.id + '"');
      for (const step of chain.steps) {
        expect(html).toContain('data-step-id="' + step.id + '"');
        expect(html).toContain('id="' + step.sourceAnchor + '"');
        expect(html).toContain("/foundations/" + step.tool!.replace("foundation:", "") + "/");
      }
    }
    for (const assumption of srChargeCurrentAssumptions)
      expect(html).toContain(assumption.label);
    for (const source of srChargeCurrentSourceLinks)
      expect(html).toContain('href="/papers/special-relativity/view/german/#' + source.anchor + '"');
    expect(html).toContain('href="/lab/sr-12/"');
    expect(html).toContain("4π times the charge density in Gaussian");
    expect(html).toContain("their sum is +0.30");
    expect(html).toContain("summing to −0.50");
    expect(html).toContain("Reversing the boost recovers zero density");
    expect(html).toContain("not a premise attributed to the 1905 derivation");
    expect(html).toContain("continuity equation requires its own derivative argument");
  });

  test("every-step detail retains the cancellation domain and admitted physical premises", () => {
    const html = renderToStaticMarkup(
      <SRChargeCurrentDerivation activeDetail="2" perspective="modern" />,
    );
    expect(html).toContain('data-detail="1" hidden=""');
    expect(html).not.toMatch(/data-detail="2" hidden=""/);
    expect(html).toContain("strictly positive");
    expect(html).toContain("never makes that replacement");
    expect(html).toContain("does not independently derive that law");
    expect(html).toContain("Show every step here");
    expect(html).toContain("same event");
    expect(html).not.toContain("katex-error");
  });
});
