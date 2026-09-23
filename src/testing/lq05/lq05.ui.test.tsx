import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import IndependentConfigurationsPage from "../../app/lab/lq-05/page.tsx";
import { IndependentConfigurationsLab } from "../../components/lab/lq05/IndependentConfigurationsLab.tsx";
import { IndependentConfigurationsPlot } from "../../components/lab/lq05/IndependentConfigurationsPlot.tsx";
import { LQ05_DEFAULTS } from "../../experiments/lq05/definition.ts";
import { evaluateLq05 } from "../../experiments/lq05/session.ts";
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

describe("LQ-05 UI components and route", () => {
  test("IndependentConfigurationsPlot renders all 3 views statically with proper SVGs", () => {
    const views = ["enumeration", "sampling", "logarithmic"] as const;
    for (const view of views) {
      const p = { ...LQ05_DEFAULTS, view };
      const evaluation = evaluateLq05(p);
      const html = renderToStaticMarkup(
        <IndependentConfigurationsPlot
          parameters={p}
          evaluation={evaluation}
          clipId={`test-clip-${view}`}
        />,
      );
      expect(html).toContain("lq05-visual-wrap");
      expect(html).toContain(`data-view="${view}"`);
      expect(html).toContain("<svg");
      expect(html).toContain("</svg>");
    }
  });

  test("IndependentConfigurationsPlot renders locked regime visual differences", () => {
    const pIndep = { ...LQ05_DEFAULTS, locked: false };
    const pLocked = { ...LQ05_DEFAULTS, locked: true };

    const htmlIndep = renderToStaticMarkup(
      <IndependentConfigurationsPlot
        parameters={pIndep}
        evaluation={evaluateLq05(pIndep)}
        clipId="test-clip-indep"
      />,
    );
    const htmlLocked = renderToStaticMarkup(
      <IndependentConfigurationsPlot
        parameters={pLocked}
        evaluation={evaluateLq05(pLocked)}
        clipId="test-clip-locked"
      />,
    );

    expect(htmlIndep).toContain("W = fⁿ");
    expect(htmlLocked).toContain("W_locked = f");
    expect(htmlLocked).toContain("Locked cluster (rigidly coupled)");
  });

  test("IndependentConfigurationsLab renders laboratory root with data attributes and noscript fallback", () => {
    const html = renderToStaticMarkup(<IndependentConfigurationsLab />);
    expect(html).toContain('data-instrument-id="lq-05"');
    expect(html).toContain('data-execution-label="host"');
    expect(html).toContain("<noscript>");
    expect(html).toContain("JavaScript disabled");
    // The prediction sits in a closed disclosure under the drawing, and the presets are the
    // family's "Try" group (lq-05 instrument-first).
    expect(html).toContain("<summary>Predict first</summary>");
    expect(html).toContain("<legend>Try</legend>");
    expect(containsHeading(html, "Calculated microstate and entropy outputs")).toBe(true);
    expect(html).toContain("Relative state probability");
    // Boltzmann's constant is typeset, k with a lowered B, where it used to print "k_B".
    expect(html).toContain("Dimensionless entropy change ΔS/k<sub>B</sub>");
  });

  test("IndependentConfigurationsPage route renders without errors and includes article sections", () => {
    const html = renderToStaticMarkup(<IndependentConfigurationsPage />);
    expect(containsHeading(html, "Independent Configurations and the Gas Analogy")).toBe(true);
    expect(containsHeading(html, "The Independence Argument in Einstein 1905 §5")).toBe(true);
    expect(html).toContain("W = (V / V₀)ⁿ");
    expect(html).toContain("Light quanta · Paper 1, §5 heuristic foundation");
  });
});
