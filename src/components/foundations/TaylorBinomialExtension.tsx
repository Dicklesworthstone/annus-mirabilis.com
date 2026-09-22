"use client";

import { useId } from "react";
import {
  binomialPartialSumsGamma,
  gammaMinusOneCancellationFree,
  gammaMinusOneNaive,
} from "../../foundations/calculus.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * Binomial series extension rendered inside foundation:taylor-expansion (AC4).
 * Presents the relativistic binomial series expansion for the Lorentz factor γ = (1 - v²/c²)⁻¹/²,
 * displaying exact partial sums at v/c = 0.6 and contrasting the cancellation-free evaluation rule
 * with the naive subtraction route at v/c = 10⁻⁴ with both computed values.
 */
export function TaylorBinomialExtension({
  headingLevel = 3,
}: {
  readonly headingLevel?: HeadingLevel;
}) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1),
    SubSub = headingTag(headingLevel, 2);
  const sums036 = binomialPartialSumsGamma(0.36);

  const vOverCLow = 1e-4;
  const xLow = vOverCLow * vOverCLow;
  const firstTermLow = 0.5 * xLow;
  const cancellationFreeVal = gammaMinusOneCancellationFree(vOverCLow);
  const naiveVal = gammaMinusOneNaive(vOverCLow);
  const relDiffFirstTerm = (cancellationFreeVal - firstTermLow) / firstTermLow;
  const relDiffNaive = (naiveVal - firstTermLow) / firstTermLow;

  return (
    <section
      className="foundation-extension taylor-binomial-extension"
      aria-labelledby={headingId}
      data-foundation-extension="taylor-expansion-binomial"
      style={{
        border: "1px solid var(--rule)",
        borderRadius: "6px",
        padding: "1.25rem",
        margin: "1.5rem 0",
        background: "var(--paper)",
      }}
    >
      <header>
        <p className="eyebrow" style={{ margin: "0 0 0.25rem 0" }}>
          Extension · Planned callers: special relativity §4, mass–energy
        </p>
        <Title id={headingId} className="construction-title" style={{ margin: "0 0 0.5rem 0" }}>
          Binomial series expansion for the relativistic Lorentz factor γ
        </Title>
      </header>

      <p>
        In relativistic mechanics, the Lorentz factor γ = (1 − v²/c²)<sup>−1/2</sup> governs time
        dilation, length contraction, and the relativistic kinetic energy E<sub>k</sub> = (γ −
        1)mc². Setting x = (v/c)², the function is expanded using Newton’s generalized binomial
        theorem:
      </p>

      <div
        className="series-display"
        style={{
          padding: "0.8rem",
          background: "rgba(0,0,0,0.03)",
          borderRadius: "4px",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "0.95rem",
          textAlign: "center",
          margin: "0.75rem 0",
        }}
      >
        (1 − x)<sup>−1/2</sup> = 1 + ½ x + ⅜ x² + ⁵/₁₆ x³ + ³⁵/₁₂₈ x⁴ + … &emsp; (|x| &lt; 1)
      </div>

      <Sub>1. Moderate speeds: partial sums at v/c = 0.6 (x = 0.36)</Sub>
      <p>
        At sixty percent the speed of light, x = 0.36. The exact value of γ − 1 is 1/√(1 − 0.36) − 1
        = 1/0.8 − 1 = 0.25. The progressive partial sums illustrate how higher-order terms
        accumulate:
      </p>

      {/*
        am-a3f1. Same defect and same repair as HeldFixedToggle (817d2cc1): a .data-table with no
        scroll wrapper, in a component whose siblings all use construction-table-wrap.

        Measured at 320px against out/: the rows sit at a min-content floor of 377.3px inside a
        288px section, and the page reports scrollWidth 414 against a 320 viewport, +94. That
        floor is a property of the column contents, so no padding or margin change reaches it -
        the same arithmetic that made a padding-only route unexecutable on partial-derivatives.
        The region therefore has to scroll, and a scrolling region has to be reachable.
      */}
      <section
        className="construction-table-wrap"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a region that scrolls must be focusable or its off-screen columns are unreachable by keyboard, which is the access defect the scroll container would otherwise introduce (am-bc6s). Suppressed inline at the site, following ModernOnlySymbolsView.tsx, rather than as a per-file override that turns the rule off for a whole file and carries no reason with it.
        tabIndex={0}
        aria-label="Partial sums of the binomial series at v/c = 0.6, scrollable table"
      >
        <table
          className="data-table"
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.9rem",
            margin: "0.75rem 0",
          }}
        >
          <caption style={{ textAlign: "left", fontWeight: "bold", marginBottom: "0.4rem" }}>
            Partial sums of γ − 1 at x = 0.36 against exact 0.25
          </caption>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--rule)", textAlign: "left" }}>
              <th scope="col" style={{ padding: "0.4rem" }}>
                Order
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                Term added
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                Term value
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                Partial sum
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                Difference to exact (0.25)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid var(--rule)" }}>
              <td style={{ padding: "0.4rem" }}>1st (linear in x)</td>
              <td style={{ padding: "0.4rem" }}>½ x</td>
              <td style={{ padding: "0.4rem", fontFamily: "var(--font-mono, monospace)" }}>
                0.180000
              </td>
              <td
                style={{
                  padding: "0.4rem",
                  fontFamily: "var(--font-mono, monospace)",
                  fontWeight: "bold",
                }}
              >
                {sums036.partialSums[0].toFixed(6)}
              </td>
              <td style={{ padding: "0.4rem", fontFamily: "var(--font-mono, monospace)" }}>
                {(0.25 - sums036.partialSums[0]).toFixed(6)}
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--rule)" }}>
              <td style={{ padding: "0.4rem" }}>2nd (quadratic)</td>
              <td style={{ padding: "0.4rem" }}>⅜ x²</td>
              <td style={{ padding: "0.4rem", fontFamily: "var(--font-mono, monospace)" }}>
                0.048600
              </td>
              <td
                style={{
                  padding: "0.4rem",
                  fontFamily: "var(--font-mono, monospace)",
                  fontWeight: "bold",
                }}
              >
                {sums036.partialSums[1].toFixed(6)}
              </td>
              <td style={{ padding: "0.4rem", fontFamily: "var(--font-mono, monospace)" }}>
                {(0.25 - sums036.partialSums[1]).toFixed(6)}
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--rule)" }}>
              <td style={{ padding: "0.4rem" }}>3rd (cubic)</td>
              <td style={{ padding: "0.4rem" }}>⁵/₁₆ x³</td>
              <td style={{ padding: "0.4rem", fontFamily: "var(--font-mono, monospace)" }}>
                0.014580
              </td>
              <td
                style={{
                  padding: "0.4rem",
                  fontFamily: "var(--font-mono, monospace)",
                  fontWeight: "bold",
                }}
              >
                {sums036.partialSums[2].toFixed(6)}
              </td>
              <td style={{ padding: "0.4rem", fontFamily: "var(--font-mono, monospace)" }}>
                {(0.25 - sums036.partialSums[2]).toFixed(6)}
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--rule)" }}>
              <td style={{ padding: "0.4rem" }}>4th (quartic)</td>
              <td style={{ padding: "0.4rem" }}>³⁵/₁₂₈ x⁴</td>
              <td style={{ padding: "0.4rem", fontFamily: "var(--font-mono, monospace)" }}>
                0.0045927
              </td>
              <td
                style={{
                  padding: "0.4rem",
                  fontFamily: "var(--font-mono, monospace)",
                  fontWeight: "bold",
                }}
              >
                {sums036.partialSums[3].toFixed(6)}
              </td>
              <td style={{ padding: "0.4rem", fontFamily: "var(--font-mono, monospace)" }}>
                {(0.25 - sums036.partialSums[3]).toFixed(6)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <p style={{ fontSize: "0.9rem", color: "var(--muted)" }}>
        Notice that the leading quadratic term 0.18 corresponds to the 0.18L mass–energy fixture
        beside the exact 0.25L, making both the retained classical kinetic energy (½ mv²) and the
        neglected relativistic remainder visible.
      </p>

      <Sub>2. Low speeds: catastrophic cancellation and the cancellation-free rule</Sub>
      <p>
        At everyday velocities such as v/c = 10⁻⁴ (where x = 10⁻⁸), evaluating γ − 1 by naive
        floating-point subtraction suffers catastrophic loss of precision. Because γ ≈ 1.000000005,
        subtracting 1 throws away the leading digits and amplifies round-off error.
      </p>

      <div
        className="evaluation-comparison"
        style={{
          border: "1px solid var(--rule)",
          borderRadius: "4px",
          padding: "1rem",
          background: "var(--paper)",
          margin: "0.75rem 0",
        }}
      >
        <SubSub style={{ margin: "0 0 0.5rem 0" }}>Comparison at v/c = 10⁻⁴ (x = 10⁻⁸)</SubSub>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "0.4rem 1.5rem",
            margin: 0,
            fontSize: "0.9rem",
          }}
        >
          <dt style={{ color: "var(--muted)" }}>First series term (½ x):</dt>
          <dd style={{ margin: 0, fontFamily: "var(--font-mono, monospace)" }}>5.0000000000e-9</dd>

          <dt style={{ fontWeight: "bold", color: "var(--ink)" }}>
            Cancellation-free route (trustworthy):
          </dt>
          <dd
            style={{
              margin: 0,
              fontWeight: "bold",
              fontFamily: "var(--font-mono, monospace)",
              color: "var(--accent)",
            }}
          >
            {cancellationFreeVal.toExponential(10)} (computed: 5.0000000375e-9)
          </dd>

          <dt style={{ color: "var(--muted)" }}>Relative diff to first term:</dt>
          <dd style={{ margin: 0, fontFamily: "var(--font-mono, monospace)" }}>
            {relDiffFirstTerm.toExponential(6)} (exact theoretical 0.75x = 7.500000e-9)
          </dd>

          <dt style={{ color: "var(--muted)" }}>Planted naive route 1/√(1−x) − 1:</dt>
          <dd
            style={{ margin: 0, fontFamily: "var(--font-mono, monospace)", color: "var(--muted)" }}
          >
            {naiveVal.toExponential(10)} (computed: 5.0000001917e-9)
          </dd>

          <dt style={{ color: "var(--muted)" }}>Naive relative difference:</dt>
          <dd
            style={{ margin: 0, fontFamily: "var(--font-mono, monospace)", color: "var(--muted)" }}
          >
            {relDiffNaive.toExponential(6)} (approx 3.833e-8; over five times too large)
          </dd>
        </dl>
      </div>

      <div className="trustworthy-rule-statement callout-limit">
        <strong>Cancellation-free evaluation rule:</strong> The cancellation-free route using
        <code>expm1(-0.5 * log1p(-x))</code> or <code>x / (√(1−x) · (1 + √(1−x)))</code>
        is required for trustworthy numerical evaluation. Naive subtraction in IEEE 754 double
        precision yields 5.0000001917e-9 instead of the true 5.0000000375e-9, corrupting
        relativistic corrections with false precision artifacts.
      </div>
    </section>
  );
}
