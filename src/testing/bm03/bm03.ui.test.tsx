import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import ConfigurationPage from "../../app/lab/bm-03/page.tsx";
import { ConfigurationLab } from "../../components/lab/bm03/ConfigurationLab.tsx";
import { ConfigurationPlot } from "../../components/lab/bm03/ConfigurationPlot.tsx";
import { BM03_DEFAULTS } from "../../experiments/bm03/definition.ts";
import { evaluateBm03 } from "../../experiments/bm03/session.ts";

describe("BM-03 UI components and route", () => {
  test("ConfigurationPlot renders all 4 steps statically with proper SVGs", () => {
    const steps = ["one-particle", "two-particles", "many-particles", "derivative"] as const;
    for (const step of steps) {
      const p = { ...BM03_DEFAULTS, step };
      const evaluation = evaluateBm03(p);
      const html = renderToStaticMarkup(
        <ConfigurationPlot parameters={p} evaluation={evaluation} clipId={`test-clip-${step}`} />,
      );
      expect(html).toContain("configuration-svg-wrap");
      expect(html).toContain(`data-step="${step}"`);
      expect(html).toContain("<svg");
      expect(html).toContain("</svg>");
    }
  });

  test("ConfigurationPlot reflects printed vs modern notation", () => {
    const pPrinted = {
      ...BM03_DEFAULTS,
      step: "derivative" as const,
      notation: "printed" as const,
    };
    const pModern = { ...BM03_DEFAULTS, step: "derivative" as const, notation: "modern" as const };

    const htmlPrinted = renderToStaticMarkup(
      <ConfigurationPlot
        parameters={pPrinted}
        evaluation={evaluateBm03(pPrinted)}
        clipId="test-clip-p"
      />,
    );
    const htmlModern = renderToStaticMarkup(
      <ConfigurationPlot
        parameters={pModern}
        evaluation={evaluateBm03(pModern)}
        clipId="test-clip-m"
      />,
    );

    expect(htmlPrinted).toContain("2κT");
    expect(htmlPrinted).toContain("V*");
    expect(htmlModern).toContain("k_B T");
    expect(htmlModern).toContain("Np");
  });

  test("ConfigurationLab renders laboratory root with data attributes and noscript fallback", () => {
    const html = renderToStaticMarkup(<ConfigurationLab />);
    expect(html).toContain('data-instrument-id="bm-03"');
    expect(html).toContain('data-execution-label="host"');
    expect(html).toContain("<noscript>");
    expect(html).toContain("JavaScript is off.");
    expect(html).toContain("Predict before deriving");
    expect(html).toContain("Presets and parameters");
    expect(html).toContain("One accepted calculation");
    expect(html).toContain('data-output="factorRatio"');
    expect(html).toContain('data-output="deltaF"');
    expect(html).toContain('data-output="pressure"');
    expect(html).toContain('data-output="lockedClusterPressure"');
  });

  test("ConfigurationPage route renders without errors and includes article sections", () => {
    const html = renderToStaticMarkup(<ConfigurationPage />);
    expect(html).toContain("Why counting positions");
    expect(html).toContain("gives the pressure law.");
    expect(html).toContain('id="configuration-argument"');
    expect(html).toContain("From available volume to free energy");
    expect(html).toContain("Why the complicated molecular factor J drops out");
    expect(html).toContain("The locked-cluster counterexample");
  });
});
