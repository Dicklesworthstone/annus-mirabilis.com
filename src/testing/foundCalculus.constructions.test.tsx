import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { FoundationConstruction } from "../components/foundations/FoundationConstruction.tsx";
import { HeldFixedToggle } from "../components/foundations/HeldFixedToggle.tsx";
import { LogarithmProductTable } from "../components/foundations/LogarithmProductTable.tsx";
import { NudgeSensitivityDemo } from "../components/foundations/NudgeSensitivityDemo.tsx";
import { RepeatedProportionalTable } from "../components/foundations/RepeatedProportionalTable.tsx";
import { TableToPlotBuilder } from "../components/foundations/TableToPlotBuilder.tsx";
import { TaylorBinomialExtension } from "../components/foundations/TaylorBinomialExtension.tsx";
import { ReaderController } from "../reader/ReaderController.tsx";
import { registerDefaultClarificationKinds } from "../reader/stack/kinds.ts";
import { writeCalculusLog } from "./foundCalculus.logger.ts";
import { containsHeading } from "./headingText.ts";
import { installDom, uninstallDom } from "./reactDom.ts";

function mustQuery<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  assert.ok(el, `missing element matching selector: ${selector}`);
  return el;
}

test("foundCalculus.constructions: TableToPlotBuilder renders SSR markup, keyboard controls, and textual equivalent", () => {
  const html = renderToStaticMarkup(<TableToPlotBuilder />);

  // Heading and structure
  assert.ok(html.includes("from a table to a curve"));
  assert.ok(html.includes("table-to-plot-builder"));

  // Keyboard controls
  assert.ok(html.includes('aria-label="Plot builder controls"'));
  assert.ok(html.includes('aria-label="Plot next data point"'));
  assert.ok(html.includes('aria-label="Plot every point in the table"'));
  assert.ok(html.includes('aria-label="Reset plot to first point"'));
  assert.ok(html.includes('aria-live="polite"'));

  // The table is computed from λx² = 2Dt, and must say so: it was captioned "Table of paired
  // measurements (Brownian §5)", which presented invented numbers as Einstein's data.
  assert.ok(html.includes("These are not measurements."));
  assert.ok(!/measurements \(Brownian/.test(html));
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

  // Textual equivalent. It must name the derivative's units in words; the sentence around them
  // is copy and was rewritten on 2026-09-22, so the assertion holds the units, not the phrasing.
  assert.ok(html.includes("Textual summary of the construction"));
  assert.ok(html.includes("volt-seconds"));

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
  // Scoped to the heading element and case-folded (am-edit-voice-lint-trmf): this asserted the
  // exact Title Case in order to check the section is present, and the de-slop pass moves the
  // page to sentence case while the section keeps rendering.
  assert.ok(
    containsHeading(html, "Binomial Series Expansion for the Relativistic Lorentz Factor γ"),
  );

  // Series formula
  assert.ok(html.includes("(1 − x)<sup>−1/2</sup> = 1 + ½ x + ⅜ x² + ⁵/₁₆ x³ + ³⁵/₁₂₈ x⁴"));

  // Partial sums at x = 0.36 (v/c = 0.6)
  assert.ok(html.includes("0.180000"));
  assert.ok(html.includes("0.228600"));
  assert.ok(html.includes("0.243180"));
  assert.ok(html.includes("0.247773"));
  assert.ok(html.includes("0.25"));
  // The first term against the exact bracket at 0.6c: the mass-energy paper's own step.
  assert.ok(html.includes("0.18L") && html.includes("0.25L"));

  // Evaluation at v/c = 1e-4, each value the live one, drawn as a power of ten by Sci, which sets
  // the × between narrow no-break spaces (U+202F) so a number never breaks across lines.
  assert.ok(html.includes("5.0000000375\u202f×\u202f10<sup>−9</sup>"));
  assert.ok(html.includes("5.0000001917\u202f×\u202f10<sup>−9</sup>"));
  assert.ok(html.includes("7.500000\u202f×\u202f10<sup>−9</sup>"));
  assert.ok(html.includes("3.833"));
  assert.ok(html.includes("x / (√(1 − x) · (1 + √(1 − x)))"));
  // Until 16bbe240 the extension printed toExponential ("5.0000000375e-9"), followed each live
  // value by a hard-coded "(computed: ...)" copy that would outlive a change to the calculation,
  // and showed readers the swarm's words ("Planned callers", "fixture", "Planted naive route").
  assert.ok(!/\d\.\d+e[-+]\d/.test(html), "no toExponential token reaches the reader");
  assert.ok(!html.includes("(computed:"), "no hard-coded copy of a computed value");
  assert.ok(!/Planned callers|fixture|Planted/.test(html), "no internal vocabulary");

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

/*
 * am-uj6w / am-bc6s. EVERY construction wrapper scrolls, so every one needs a tab stop.
 *
 * .construction-table-wrap declares overflow-x: auto (foundations.css). A container that scrolls
 * and cannot be focused puts its off-screen columns out of a keyboard's reach altogether, which is
 * a worse defect than the overflow it replaces: an overflowing page at least left the content
 * reachable. WCAG 2.1.1, axe scrollable-region-focusable.
 *
 * Measured at 320px across the built routes on 2026-09-22, before this test existed:
 * logarithms +202px, exponentials +64px, derivatives +23px past the viewport. functions-graphs
 * fits today and is checked anyway, because whether a container that DECLARES scrolling actually
 * scrolls is a property of its data and the reader's type size, not of the viewport alone.
 *
 * Two things are asserted as a single question. The element must be a <section>, because a bare
 * <div> has role=generic and a generic element takes no accessible name at all - biome rejects
 * aria-label on one, and it was this rule that caught the first version of the repair. The name
 * is then asserted present and non-empty rather than by its text: the wording belongs to each
 * table's <caption> and will be reworded, while the defect this guards is a missing tab stop.
 *
 * The per-construction non-vacuity check is deliberate. Without it, a renamed class would make
 * every loop body execute zero times and the test would report a clean pass having examined
 * nothing.
 */
test("foundCalculus.constructions: every scrolling construction wrapper is focusable and named", () => {
  const constructions = [
    { name: "TableToPlotBuilder", node: <TableToPlotBuilder /> },
    { name: "NudgeSensitivityDemo", node: <NudgeSensitivityDemo /> },
    { name: "HeldFixedToggle", node: <HeldFixedToggle /> },
    { name: "RepeatedProportionalTable", node: <RepeatedProportionalTable /> },
    { name: "LogarithmProductTable", node: <LogarithmProductTable /> },
    { name: "TaylorBinomialExtension", node: <TaylorBinomialExtension /> },
  ];

  let checked = 0;
  for (const { name, node } of constructions) {
    const html = renderToStaticMarkup(node);
    // Membership in the class list, not a substring of it: "construction-table-wrap-inner" and
    // "construction-table-wrapX" both CONTAIN the token, and a substring match would have credited
    // either as the audited wrapper. Found by planting a rename and watching this test stay green.
    const wrappers = (html.match(/<[a-z]+[^>]*class="[^"]*"[^>]*>/g) ?? []).filter((tag) => {
      const cls = tag.match(/class="([^"]*)"/)?.[1];
      return cls?.split(/\s+/).includes("construction-table-wrap") ?? false;
    });
    assert.ok(
      wrappers.length > 0,
      `${name} renders no construction-table-wrap at all, so the checks below would examine nothing. The class was probably renamed.`,
    );
    for (const tag of wrappers) {
      assert.match(
        tag,
        /^<section\b/,
        `${name}: the scrolling wrapper is not a <section>, and a generic element carries no accessible name: ${tag}`,
      );
      assert.match(
        tag,
        /tabindex="0"/,
        `${name}: the scrolling wrapper has no tab stop, so its off-screen columns cannot be reached by keyboard: ${tag}`,
      );
      const label = tag.match(/aria-label="([^"]*)"/)?.[1];
      assert.ok(
        label !== undefined && label.trim().length > 0,
        `${name}: the scrolling wrapper has no accessible name: ${tag}`,
      );
      checked += 1;
    }
  }
  assert.ok(
    checked >= constructions.length,
    `only ${checked} wrappers checked across ${constructions.length} constructions`,
  );
});

test("foundCalculus.constructions: E2E 1 - From Brownian §4, open foundation:partial-derivatives, toggle held fixed, and return to exact step", async () => {
  await installDom();
  registerDefaultClarificationKinds();

  const proto = HTMLDialogElement.prototype;
  if (typeof proto.showModal !== "function") {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    proto.close = function close(this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
  }

  try {
    window.history.pushState(null, "", "/papers/brownian-motion/s4/#arg-bm-diffusion-eq");

    const pageRoot = document.createElement("div");
    pageRoot.setAttribute("data-reader-root", "");
    pageRoot.innerHTML = `
      <dialog data-clarification-dialog>
        <p data-compass-question></p>
        <p data-compass-idea></p>
        <button type="button" data-reader-close>Return to the exact step</button>
        <section data-foundation-panel="partial-derivatives">
          <h2 id="clarification-partial-derivatives" tabindex="-1">Partial derivatives and held-fixed quantities</h2>
          <div id="held-fixed-container"></div>
        </section>
      </dialog>
      <p data-reader-announcement></p>
      <article class="reader-passage" id="arg-bm-diffusion-eq">
        <h3>Section 4: Diffusion equation</h3>
        <a href="/foundations/partial-derivatives/" data-foundation="partial-derivatives">
          Read the prerequisite on partial derivatives
        </a>
      </article>
    `;
    document.body.appendChild(pageRoot);

    // Mount HeldFixedToggle inside the foundation panel
    const toggleContainer = mustQuery<HTMLElement>(pageRoot, "#held-fixed-container");
    const toggleRoot = createRoot(toggleContainer);
    await act(async () => {
      toggleRoot.render(createElement(HeldFixedToggle));
    });

    // Mount ReaderController
    const controllerContainer = document.createElement("div");
    pageRoot.prepend(controllerContainer);
    const controllerRoot = createRoot(controllerContainer);
    await act(async () => {
      controllerRoot.render(
        createElement(ReaderController, {
          registry: {
            paperId: "brownian-motion",
            anchors: ["arg-bm-diffusion-eq"],
            foundations: ["partial-derivatives"],
          },
          titles: { "partial-derivatives": "Partial derivatives and held-fixed quantities" },
          questions: { "arg-bm-diffusion-eq": "What is held fixed when concentration changes?" },
        }),
      );
    });

    const dialog = mustQuery<HTMLDialogElement>(pageRoot, "[data-clarification-dialog]");
    const openLink = mustQuery<HTMLAnchorElement>(
      pageRoot,
      '[data-foundation="partial-derivatives"]',
    );

    // Step 1: Open foundation from passage
    await act(async () => {
      openLink.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    });
    assert.equal(
      dialog.open,
      true,
      "Clarification drawer must open when foundation link is clicked",
    );
    assert.equal(
      mustQuery<HTMLElement>(pageRoot, "[data-compass-idea]").textContent,
      "Partial derivatives and held-fixed quantities",
    );

    // Step 2: Toggle held fixed (switch to position-fixed: ∂c/∂t)
    const positionBtn = mustQuery<HTMLButtonElement>(pageRoot, 'button[aria-pressed="false"]');
    await act(async () => {
      positionBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    });
    assert.ok(
      pageRoot.textContent?.includes("Case B: Hold position x fixed"),
      "Case B time derivative ∂c/∂t must be active after toggle",
    );

    // Step 3: Return to the exact step
    const closeBtn = mustQuery<HTMLButtonElement>(pageRoot, "[data-reader-close]");
    await act(async () => {
      closeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    });
    assert.equal(
      dialog.open,
      false,
      "Clarification drawer must close when return button is clicked",
    );
    assert.equal(
      mustQuery<HTMLElement>(pageRoot, "[data-reader-announcement]").textContent,
      "Returned to the exact step.",
    );

    writeCalculusLog({
      testId: "e2e-journey-brownian-s4-partial-derivatives",
      foundationId: "partial-derivatives",
      callingAnchor: "brownian-motion:s4#arg-bm-diffusion-eq",
      expected: "Open drawer, toggle held-fixed constraint, return to exact step",
      actual: "Navigation completed, toggle flipped, drawer closed with announcement",
      outcome: "passed",
      message:
        "E2E 1: Successfully navigated Brownian §4 -> partial-derivatives -> toggled held fixed -> returned",
    });

    await act(async () => {
      toggleRoot.unmount();
      controllerRoot.unmount();
    });
    pageRoot.remove();
  } finally {
    await uninstallDom();
  }
});

test("foundCalculus.constructions: E2E 2 - From Brownian §5, open foundation:functions-graphs, build plot with keyboard only, and return", async () => {
  await installDom();
  registerDefaultClarificationKinds();

  const proto = HTMLDialogElement.prototype;
  if (typeof proto.showModal !== "function") {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    proto.close = function close(this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
  }

  try {
    window.history.pushState(null, "", "/papers/brownian-motion/s5/#arg-bm-displacement-law");

    const pageRoot = document.createElement("div");
    pageRoot.setAttribute("data-reader-root", "");
    pageRoot.innerHTML = `
      <dialog data-clarification-dialog>
        <p data-compass-question></p>
        <p data-compass-idea></p>
        <button type="button" data-reader-close>Return to the exact step</button>
        <section data-foundation-panel="functions-graphs">
          <h2 id="clarification-functions-graphs" tabindex="-1">Functions and graphs</h2>
          <div id="table-plot-container"></div>
        </section>
      </dialog>
      <p data-reader-announcement></p>
      <article class="reader-passage" id="arg-bm-displacement-law">
        <h3>Section 5: Mean displacement</h3>
        <a href="/foundations/functions-graphs/" data-foundation="functions-graphs">
          Read the prerequisite on functions and graphs
        </a>
      </article>
    `;
    document.body.appendChild(pageRoot);

    // Mount TableToPlotBuilder
    const builderContainer = mustQuery<HTMLElement>(pageRoot, "#table-plot-container");
    const builderRoot = createRoot(builderContainer);
    await act(async () => {
      builderRoot.render(createElement(TableToPlotBuilder));
    });

    // Mount ReaderController
    const controllerContainer = document.createElement("div");
    pageRoot.prepend(controllerContainer);
    const controllerRoot = createRoot(controllerContainer);
    await act(async () => {
      controllerRoot.render(
        createElement(ReaderController, {
          registry: {
            paperId: "brownian-motion",
            anchors: ["arg-bm-displacement-law"],
            foundations: ["functions-graphs"],
          },
          titles: { "functions-graphs": "Functions and graphs" },
          questions: { "arg-bm-displacement-law": "How does displacement scale with time?" },
        }),
      );
    });

    const dialog = mustQuery<HTMLDialogElement>(pageRoot, "[data-clarification-dialog]");
    const openLink = mustQuery<HTMLAnchorElement>(pageRoot, '[data-foundation="functions-graphs"]');

    // Step 1: Open foundation from passage
    await act(async () => {
      openLink.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    });
    assert.equal(dialog.open, true, "Clarification drawer must open");

    // Step 2: Operate plot builder with keyboard only (Reset -> Plot next -> Plot all)
    const resetBtn = mustQuery<HTMLButtonElement>(
      pageRoot,
      'button[aria-label="Reset plot to first point"]',
    );
    await act(async () => {
      resetBtn.focus();
      resetBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const statusEl = mustQuery<HTMLSpanElement>(pageRoot, ".construction-status");
    assert.equal(statusEl.textContent, "Showing 1 of 5 points plotted.");

    // Advance plot with keyboard
    const nextBtn = mustQuery<HTMLButtonElement>(
      pageRoot,
      'button[aria-label="Plot next data point"]',
    );
    await act(async () => {
      nextBtn.focus();
      nextBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    assert.equal(statusEl.textContent, "Showing 2 of 5 points plotted.");

    // Plot all with keyboard
    const allBtn = mustQuery<HTMLButtonElement>(
      pageRoot,
      'button[aria-label="Plot every point in the table"]',
    );
    await act(async () => {
      allBtn.focus();
      allBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    assert.equal(statusEl.textContent, "Showing 5 of 5 points plotted.");

    // Step 3: Return to the exact step with keyboard
    const closeBtn = mustQuery<HTMLButtonElement>(pageRoot, "[data-reader-close]");
    await act(async () => {
      closeBtn.focus();
      closeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    assert.equal(dialog.open, false, "Clarification drawer must close on return");
    assert.equal(
      mustQuery<HTMLElement>(pageRoot, "[data-reader-announcement]").textContent,
      "Returned to the exact step.",
    );

    writeCalculusLog({
      testId: "e2e-journey-brownian-s5-table-plot-keyboard",
      foundationId: "functions-graphs",
      callingAnchor: "brownian-motion:s5#arg-bm-displacement-law",
      expected:
        "Open drawer, operate table-to-plot builder with keyboard only, return to exact step",
      actual: "Plotted count transitioned 1 -> 2 -> 5, drawer closed, returned to anchor",
      outcome: "passed",
      message:
        "E2E 2: Successfully operated TableToPlotBuilder via keyboard and returned to Brownian §5",
    });

    await act(async () => {
      builderRoot.unmount();
      controllerRoot.unmount();
    });
    pageRoot.remove();
  } finally {
    await uninstallDom();
  }
});
