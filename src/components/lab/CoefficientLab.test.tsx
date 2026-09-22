import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import CoefficientPage from "../../app/lab/me-02/page.tsx";
import { DEFAULT_PREPARED_EXAMPLE } from "../../experiments/me02/session.ts";
import { CoefficientLab } from "./CoefficientLab.tsx";

describe("CoefficientLab: static rendering (no JavaScript)", () => {
  const html = renderToStaticMarkup(<CoefficientLab example={DEFAULT_PREPARED_EXAMPLE} />);

  test("renders the 0.6c snapshot numbers from the owner, not placeholders", () => {
    expect(html).toContain("0.25");
    expect(html).toContain("0.18");
    expect(html).toContain("1.3889");
  });

  test("has exactly one instrument root, addressable as me-02", () => {
    expect(html).toContain('data-instrument-id="me-02"');
  });

  test("declares a host execution label", () => {
    expect(html).toContain('data-execution-label="host"');
  });

  test("includes a noscript notice so a no-JavaScript reader is never shown an empty box", () => {
    expect(html).toContain("<noscript>");
    expect(html).toContain("JavaScript is off");
  });

  test("notModeled is present, non-empty, and shown as a plain line", () => {
    expect(html).toContain("Not modeled:");
    expect(html).toContain("accelerated motion");
    expect(html).toContain("modern momentum formulations");
  });

  test("the action contract is typed entry and named-speed buttons, not a slider", () => {
    expect(html).not.toContain('type="range"');
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain("Show 0.6c");
    expect(html).toContain("Show 0.01c");
    expect(html).toContain("Show vanishing speed");
  });

  test("SVG bars consume snapshot scalars rather than an empty rectangle", () => {
    expect(html).toContain('data-bar="exact"');
    expect(html).toContain('data-bar="quadratic"');
    expect(html).toContain('data-bar="proxy"');
    expect(html).toContain('data-bar="limit"');
    expect(html).toContain('data-width="200"');
  });

  test("printed-factor wording comes from the prepared example, not a live percentage", () => {
    expect(html).toContain("the printed factor is 0.1385 percent larger than the modern c^2");
    expect(html).toContain("einstein-1905-mass-energy-printed");
    expect(html).toContain("modern-si-2019");
  });

  test("renders no script tags itself: works without JavaScript", () => {
    expect(html).not.toContain("<script");
  });
});

describe("ME-02 route", () => {
  test("the page renders the laboratory and the coefficient argument", () => {
    const html = renderToStaticMarkup(<CoefficientPage />);
    expect(html).toContain('data-instrument-id="me-02"');
    expect(html).toContain("A smaller energy of motion");
    expect(html).toContain('id="coefficient-argument"');
    expect(html).toContain("The finite-speed proxy is not the limit");
    expect(html).toContain("explicit radical, 1/√(1 − v²/V²)");
    expect(html).toContain("Not modeled:");
  });
});
