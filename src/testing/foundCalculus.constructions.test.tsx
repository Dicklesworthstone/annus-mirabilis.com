import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FoundationConstruction } from "../components/foundations/FoundationConstruction.tsx";
import { HeldFixedToggle } from "../components/foundations/HeldFixedToggle.tsx";
import { LogarithmProductTable } from "../components/foundations/LogarithmProductTable.tsx";
import { NudgeSensitivityDemo } from "../components/foundations/NudgeSensitivityDemo.tsx";
import { RepeatedProportionalTable } from "../components/foundations/RepeatedProportionalTable.tsx";
import { TableToPlotBuilder } from "../components/foundations/TableToPlotBuilder.tsx";
import { TaylorBinomialExtension } from "../components/foundations/TaylorBinomialExtension.tsx";
import { writeCalculusLog } from "./foundCalculus.logger.ts";

test("foundCalculus.constructions: TableToPlotBuilder renders SSR markup, keyboard controls, and textual equivalent", () => {
  const html = renderToStaticMarkup(<TableToPlotBuilder />);

  // Heading and structure
  assert.ok(html.includes("from measurement table to curve"));
  assert.ok(html.includes("table-to-plot-builder"));

  // Keyboard controls
  assert.ok(html.includes('aria-label="Plot builder controls"'));
  assert.ok(html.includes('aria-label="Plot next data point"'));
  assert.ok(html.includes('aria-label="Plot all data points"'));
  assert.ok(html.includes('aria-label="Reset plot to first point"'));
  assert.ok(html.includes('aria-live="polite"'));

  // Table points from Brownian §5
  assert.ok(html.includes("Table of paired measurements (Brownian §5)"));
  assert.ok(html.includes(">0</td>"));
  assert.ok(html.includes(">1</td>"));
  assert.ok(html.includes(">4</td>"));
  assert.ok(html.includes(">9</td>"));
  assert.ok(html.includes(">16</td>"));
  assert.ok(html.includes(">64</td>"));

  // Textual equivalent
  assert.ok(html.includes("Textual summary of the construction"));
  assert.ok(html.includes("square root of time"));

  writeCalculusLog({
    testId: "table-to-plot-builder-ssr-and-a11y",
    foundationId: "functions-graphs",
    callingAnchor: "brownian-motion:s5",
    expected: "Fully rendered SSR table, SVG plot, and keyboard controls",
    actual: "All elements present",
    outcome: "passed",
    message: "Verified TableToPlotBuilder SSR rendering, table data, and keyboard/ARIA controls",
  });
});

test("foundCalculus.constructions: NudgeSensitivityDemo reports Δν, ΔV, and sensitivity ratio with units", () => {
  const html = renderToStaticMarkup(<NudgeSensitivityDemo />);

  assert.ok(html.includes("nudge-sensitivity-demo"));
  assert.ok(html.includes("local sensitivity and derivative units"));
  assert.ok(html.includes('aria-label="Frequency nudge step selection"'));
  assert.ok(html.includes('aria-pressed="true"'));

  // Frequency nudge steps
  assert.ok(html.includes("1.0 × 10¹⁴ Hz"));
  assert.ok(html.includes("5.0 × 10¹³ Hz"));
  assert.ok(html.includes("1.0 × 10¹³ Hz"));
  assert.ok(html.includes("2.0 × 10¹² Hz"));

  // Ratio and units
  assert.ok(html.includes("V·s (or V/Hz)"));
  assert.ok(html.includes("4.135667696e-15"));

  // Textual equivalent
  assert.ok(html.includes("Textual summary of the construction"));
  assert.ok(html.includes("A derivative is not a dimensionless number"));

  writeCalculusLog({
    testId: "nudge-sensitivity-demo-units",
    foundationId: "derivatives",
    callingAnchor: "light-quanta:s8",
    expected: "Sensitivity ratio h/e with units V*s",
    actual: "Ratio 4.135667696e-15 V*s present",
    outcome: "passed",
    message:
      "Verified NudgeSensitivityDemo reports Δν, ΔV, ratio h/e with units and textual equivalent",
  });
});

test("foundCalculus.constructions: HeldFixedToggle explicitly names held-fixed quantities and thermodynamics examples", () => {
  const html = renderToStaticMarkup(<HeldFixedToggle />);

  assert.ok(html.includes("held-fixed-toggle"));
  assert.ok(html.includes("what is held fixed in a partial derivative"));
  assert.ok(html.includes('aria-pressed="true"'));

  // Explicit held-fixed quantities in Brownian motion
  assert.ok(html.includes("Hold time t fixed"));
  assert.ok(html.includes("Time t (a single snapshot across the tube)"));
  assert.ok(html.includes("Spatial concentration gradient"));
  assert.ok(html.includes("particles / µm⁴"));

  // Thermodynamics examples explicitly named
  assert.ok(html.includes("Isothermal"));
  assert.ok(html.includes("Temperature T fixed"));
  assert.ok(html.includes("Adiabatic"));
  assert.ok(html.includes("Entropy S fixed"));
  assert.ok(html.includes("Isochoric"));
  assert.ok(html.includes("Volume V fixed"));

  // Textual equivalent
  assert.ok(html.includes("Textual summary of the construction"));

  writeCalculusLog({
    testId: "held-fixed-toggle-thermodynamics",
    foundationId: "partial-derivatives",
    callingAnchor: "brownian-motion:s3",
    expected: "Explicitly names t fixed, x fixed, isothermal, adiabatic, isochoric",
    actual: "All held-fixed constraints and thermodynamic examples present",
    outcome: "passed",
    message: "Verified HeldFixedToggle names fixed quantities and thermodynamic constraints",
  });
});

test("foundCalculus.constructions: RepeatedProportionalTable renders compounding steps and dimensionless exponents", () => {
  const html = renderToStaticMarkup(<RepeatedProportionalTable />);

  assert.ok(html.includes("repeated-proportional-table"));
  assert.ok(html.includes("repeated proportional changes and dimensionless exponents"));
  assert.ok(html.includes("Step n = 0"));
  assert.ok(html.includes("Step n = 1"));
  assert.ok(html.includes("Step n = 5"));

  // Factor e^-0.5 ~ 0.606531 and fractions
  assert.ok(html.includes("0.606531"));
  assert.ok(html.includes("100.00%"));
  assert.ok(html.includes("60.65%"));
  assert.ok(html.includes("36.79%"));
  assert.ok(html.includes("8.21%"));

  // Dimensionless exponents note citing Wien's law and Gaussian diffusion
  assert.ok(html.includes("Why exponents must always be dimensionless"));
  assert.ok(html.includes("Wien’s law (Light §4)"));
  assert.ok(html.includes("Brownian diffusion Gaussian (Brownian §4)"));

  writeCalculusLog({
    testId: "repeated-proportional-table-exponents",
    foundationId: "exponentials",
    callingAnchor: "brownian-motion:s4",
    expected: "Compounding steps and dimensionless exponents explanation",
    actual: "Table and citations present",
    outcome: "passed",
    message: "Verified RepeatedProportionalTable compounding factors and dimensionless exponents",
  });
});

test("foundCalculus.constructions: LogarithmProductTable carries 1905 'lg' note and product-to-sum table", () => {
  const html = renderToStaticMarkup(<LogarithmProductTable />);

  assert.ok(html.includes("logarithm-product-table"));
  assert.ok(html.includes("turning multiplication into addition"));
  assert.ok(html.includes("Notation: Modern ISO standard (ln = natural log)"));

  // 1905 German historical notation note
  assert.ok(html.includes("1905 historical notation vs Modern ISO standard"));
  assert.ok(html.includes("1905 printed “lg 2”:"));
  assert.ok(html.includes("0.693147")); // ln 2
  assert.ok(html.includes("Modern ISO “lg 2” (log₁₀ 2):"));
  assert.ok(html.includes("0.301030")); // log10 2

  // Product-to-sum table pairs
  assert.ok(html.includes("State W₁"));
  assert.ok(html.includes("State W₂"));
  assert.ok(html.includes("Product W₁ · W₂"));
  assert.ok(html.includes(">2</td>"));
  assert.ok(html.includes(">4</td>"));
  assert.ok(html.includes(">8</td>"));

  // Textual equivalent
  assert.ok(html.includes("Textual summary of the construction"));

  writeCalculusLog({
    testId: "logarithm-product-table-lg-note",
    foundationId: "logarithms",
    callingAnchor: "light-quanta:s5",
    expected: "1905 'lg' note (ln 2 ~0.693147 vs log10 ~0.301030) and product-to-sum table",
    actual: "All notation comparisons and table rows present",
    outcome: "passed",
    message: "Verified LogarithmProductTable 1905 vs ISO note and product-to-sum entries",
  });
});

test("foundCalculus.constructions: TaylorBinomialExtension renders series, partial sums at 0.36, and cancellation-free rule", () => {
  const html = renderToStaticMarkup(<TaylorBinomialExtension />);

  assert.ok(html.includes("taylor-binomial-extension"));
  assert.ok(html.includes('data-foundation-extension="taylor-expansion-binomial"'));
  assert.ok(html.includes("Binomial Series Expansion for the Relativistic Lorentz Factor γ"));

  // Series formula
  assert.ok(html.includes("(1 − x)<sup>−1/2</sup> = 1 + ½ x + ⅜ x² + ⁵/₁₆ x³ + ³⁵/₁₂₈ x⁴"));

  // Partial sums at x = 0.36 (v/c = 0.6)
  assert.ok(html.includes("0.180000"));
  assert.ok(html.includes("0.228600"));
  assert.ok(html.includes("0.243180"));
  assert.ok(html.includes("0.247773"));
  assert.ok(html.includes("0.25"));
  assert.ok(html.includes("0.18L mass–energy fixture beside the exact 0.25L"));

  // Cancellation-free evaluation at v/c = 1e-4
  assert.ok(html.includes("5.0000000375e-9"));
  assert.ok(html.includes("5.0000001917e-9"));
  assert.ok(html.includes("7.500000e-9"));
  assert.ok(html.includes("3.833"));
  assert.ok(html.includes("Cancellation-free evaluation rule:"));
  assert.ok(html.includes("expm1(-0.5 * log1p(-x))"));
  assert.ok(html.includes("is required for trustworthy numerical evaluation"));

  writeCalculusLog({
    testId: "taylor-binomial-extension-rendered",
    foundationId: "taylor-expansion",
    callingAnchor: "special-relativity:s4",
    expected: "Binomial series, partial sums at 0.36, cancellation-free rule with both values",
    actual: "All required values and explanation rule rendered",
    outcome: "passed",
    message:
      "Verified TaylorBinomialExtension renders inside Taylor node with cancellation-free rule",
  });
});

test("foundCalculus.constructions: FoundationConstruction dispatcher renders correct component per foundation ID", () => {
  const ids = [
    { id: "functions-graphs", testClass: "table-to-plot-builder" },
    { id: "derivatives", testClass: "nudge-sensitivity-demo" },
    { id: "partial-derivatives", testClass: "held-fixed-toggle" },
    { id: "exponentials", testClass: "repeated-proportional-table" },
    { id: "logarithms", testClass: "logarithm-product-table" },
    { id: "taylor-expansion", testClass: "taylor-binomial-extension" },
  ];

  for (const { id, testClass } of ids) {
    const html = renderToStaticMarkup(<FoundationConstruction foundationId={id} />);
    assert.ok(
      html.includes(testClass),
      `foundation ${id} must render component with class ${testClass}`,
    );

    // Prefixed id also works
    const prefixedHtml = renderToStaticMarkup(
      <FoundationConstruction foundationId={`foundation:${id}`} />,
    );
    assert.ok(
      prefixedHtml.includes(testClass),
      `foundation:${id} must render component with class ${testClass}`,
    );
  }

  // Unknown foundation returns empty string / null
  const unknownHtml = renderToStaticMarkup(
    <FoundationConstruction foundationId="unknown-concept" />,
  );
  assert.equal(unknownHtml, "");
});
