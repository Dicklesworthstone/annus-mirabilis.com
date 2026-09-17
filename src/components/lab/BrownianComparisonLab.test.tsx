import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import example from "../../generated/bm01-comparison.json";
import { BrownianComparisonLab } from "./BrownianComparisonLab.tsx";

describe("controlled Brownian comparison: real prepared results and server rendering", () => {
  const html = renderToStaticMarkup(<BrownianComparisonLab example={example} />);
  test("the complete worked comparison does not require a browser or a worker", () => {
    expect(html).toContain('data-comparison-phase="example"');
    expect(html).toContain("Static worked comparison");
    expect(html).toContain("0.70711");
    expect(html).toContain('data-comparison-output="diffusionCoefficient"');
    expect(html.match(/data-comparison-output=/gu)?.length).toBe(6);
    expect(html.match(/data-comparison-input=/gu)?.length).toBe(11);
    expect(html).toContain("<noscript>");
  });
  test("the same axes use non-color distinctions and every input lock is readable", () => {
    expect(html.match(/<polyline/gu)?.length).toBe(2);
    expect(html).toContain('stroke-dasharray="8 5"');
    expect(html).toContain("Held fixed (locked)");
    expect(html).toContain("Baseline: solid line and round marker");
    expect(html).toContain("Variant: dashed line and square marker");
  });
  test("common random numbers are never mislabeled independent trials", () => {
    expect(html).toContain("these are not independent trials");
    expect(html).toContain("This comparison does not offer independent-seed confidence intervals");
    expect(html).toContain("Host calculation; no WASM artifact is claimed");
  });
  test("value-bearing controls have separate explicit labels", () => {
    expect(html).not.toMatch(/<label\b[^>]*>[^<]*(?:<input|<select)/u);
    expect(html).toContain("Input to vary</label>");
    expect(html).toContain("Requested particle radius (μm)</label>");
    expect(html).toContain("<fieldset disabled");
  });
});
