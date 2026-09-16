import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import IndependentConfigurationsPage from "../../app/lab/lq-05/page.tsx";
import { IndependentConfigurationsLab } from "../../components/lab/lq05/IndependentConfigurationsLab.tsx";
import { IndependentConfigurationsPlot } from "../../components/lab/lq05/IndependentConfigurationsPlot.tsx";
import { LQ05_DEFAULTS } from "../../experiments/lq05/definition.ts";
import { evaluateLq05 } from "../../experiments/lq05/session.ts";

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
    expect(htmlLocked).toContain("Locked Cluster (rigidly coupled)");
  });

  test("IndependentConfigurationsLab renders laboratory root with data attributes and noscript fallback", () => {
    const html = renderToStaticMarkup(<IndependentConfigurationsLab />);
    expect(html).toContain('data-instrument-id="lq-05"');
    expect(html).toContain('data-execution-label="host"');
    expect(html).toContain("<noscript>");
    expect(html).toContain("JavaScript disabled");
    expect(html).toContain("Predict Mode");
    expect(html).toContain("Presets");
    expect(html).toContain("Calculated Microstate &amp; Entropy Outputs");
    expect(html).toContain("Relative State Probability");
    expect(html).toContain("Dimensionless Entropy Change ΔS/k_B");
  });

  test("IndependentConfigurationsPage route renders without errors and includes article sections", () => {
    const html = renderToStaticMarkup(<IndependentConfigurationsPage />);
    expect(html).toContain("Independent Configurations and the Gas Analogy");
    expect(html).toContain("The Independence Argument in Einstein 1905 §5");
    expect(html).toContain("W = (V / V₀)ⁿ");
    expect(html).toContain("Light Quanta · Paper 1, §5 Heuristic Foundation");
  });
});
