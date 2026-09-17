import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { ValueWithUncertainty } from "./ValueWithUncertainty.tsx";

describe("ValueWithUncertainty Component (am-ver-precision-display-5e5)", () => {
  it("renders value with unit and spoken aria-label", () => {
    const html = renderToString(
      <ValueWithUncertainty
        value={0.79478}
        unit="μm"
        sigFigs={2}
        constantSetId="einstein-1905-brownian-printed"
        constantSetLabel="Einstein 1905"
      />,
    );

    expect(html).toContain("0.79");
    expect(html).toContain("μm");
    expect(html).toContain("(Einstein 1905)");
    expect(html).toContain('aria-label="0.79478 micrometres, under Einstein 1905"');
    expect(html).toContain('data-value="0.79478"');
    expect(html).toContain('data-unit="μm"');
    expect(html).toContain('data-constant-set="einstein-1905-brownian-printed"');
  });

  it("renders guard digit markup distinctly", () => {
    const html = renderToString(
      <ValueWithUncertainty value={6.156365} unit="μm" sigFigs={2} guardDigit={true} />,
    );

    expect(html).toContain("guard-digit");
    expect(html).toContain("6.1");
    expect(html).toContain("6");
  });

  it("renders uncertainty with distinct styling", () => {
    const html = renderToString(
      <ValueWithUncertainty
        value={1.35e-3}
        unit="Pa·s"
        uncertainty={{ kind: "standard", value: 0.05e-3 }}
        sigFigs={3}
      />,
    );

    expect(html).toContain("± 5.00 × 10^-5");
    expect(html).toContain('data-uncertainty-kind="standard"');
  });

  it("renders German locale with decimal comma", () => {
    const html = renderToString(
      <ValueWithUncertainty value={0.79478} unit="μm" sigFigs={3} locale="de-DE" />,
    );

    expect(html).toContain("0,795");
    expect(html).toContain('data-locale="de-DE"');
  });
});
