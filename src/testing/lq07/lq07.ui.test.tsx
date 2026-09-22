import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import FluorescencePage from "../../app/lab/lq-07/page.tsx";
import { FluorescenceLab } from "../../components/lab/lq07/FluorescenceLab.tsx";
import { FluorescencePlot } from "../../components/lab/lq07/FluorescencePlot.tsx";
import { LQ07_DEFAULTS } from "../../experiments/lq07/definition.ts";
import { evaluateLq07 } from "../../experiments/lq07/session.ts";
import { containsHeading } from "../headingText.ts";

/**
 * Heading assertions here compare case-insensitively AND are scoped to heading elements
 * (am-edit-voice-lint-trmf). They asserted the exact Title Case of a heading in order to
 * check that the SECTION IS PRESENT, so they broke when the de-slop pass moved these pages
 * to the site's sentence case while every section they protect was still rendering.
 *
 * containsHeading is the shared helper, not a local lowercase: text outside an h1-h6 cannot
 * satisfy it. That matters because the first repair of this kind WAS a local lowercase, and
 * it let an aria-label two elements away stand in for a heading that had been deleted.
 */

describe("LQ-07 UI components and route", () => {
  test("FluorescencePlot renders allowed and disallowed energy ledgers statically with proper SVGs", () => {
    const pAllowed = { ...LQ07_DEFAULTS, nu1: 850, nu2: 850 };
    const pDisallowed = { ...LQ07_DEFAULTS, nu1: 850, nu2: 900 };

    const htmlAllowed = renderToStaticMarkup(
      <FluorescencePlot
        parameters={pAllowed}
        evaluation={evaluateLq07(pAllowed)}
        clipId="test-clip-allowed"
      />,
    );
    const htmlDisallowed = renderToStaticMarkup(
      <FluorescencePlot
        parameters={pDisallowed}
        evaluation={evaluateLq07(pDisallowed)}
        clipId="test-clip-disallowed"
      />,
    );

    expect(htmlAllowed).toContain('data-testid="lq07-plot-container"');
    expect(htmlAllowed).toContain('data-allowed="true"');
    expect(htmlAllowed).toContain("Allowed by Budget");
    expect(htmlAllowed).toContain("<svg");
    expect(htmlAllowed).toContain("</svg>");
    expect(htmlAllowed).toContain("Spectral Bands");

    expect(htmlDisallowed).toContain('data-allowed="false"');
    expect(htmlDisallowed).toContain("Disallowed (Deficit)");
    expect(htmlDisallowed).toContain("Energy Deficit");
  });

  test("FluorescencePlot renders false-color legend with UV, Visible, and IR bands", () => {
    const html = renderToStaticMarkup(
      <FluorescencePlot
        parameters={LQ07_DEFAULTS}
        evaluation={evaluateLq07(LQ07_DEFAULTS)}
        clipId="test-clip-legend"
      />,
    );

    expect(html).toContain("Ultraviolet (UV)");
    expect(html).toContain("Visible Spectrum");
    expect(html).toContain("Infrared (IR)");
  });

  test("FluorescenceLab renders laboratory root with data attributes and noscript fallback", () => {
    const html = renderToStaticMarkup(<FluorescenceLab />);
    expect(html).toContain('data-instrument-id="lq-07"');
    expect(html).toContain('data-execution-label="host"');
    expect(html).toContain("<noscript>");
    expect(html).toContain("JavaScript disabled");
    expect(html).toContain("Predict Mode");
    expect(html).toContain("Presets");
    expect(html).toContain("Calculated Energy Ledger &amp; Transition Quantities");
    expect(html).toContain("Budget Verdict");
    expect(html).toContain("Maximum Allowed Frequency");
  });

  test("FluorescencePage route renders without errors and includes article sections", () => {
    const html = renderToStaticMarkup(<FluorescencePage />);
    expect(html).toContain("Single-Quantum Energy Budget");
    expect(containsHeading(html, "The Single-Quantum Energy Budget in Einstein 1905 §7")).toBe(
      true,
    );
    expect(html).toContain("hν₁ = hν₂ + E_other");
    expect(containsHeading(html, "The Two Historical Deviation Cases")).toBe(true);
    expect(html).toContain("Light Quanta · Paper 1, §7 Energy Conservation");
  });
});
