"use client";

import { useId } from "react";
import {
  binomialPartialSumsGamma,
  gammaMinusOneCancellationFree,
  gammaMinusOneNaive,
} from "../../foundations/calculus.ts";
import { Sci } from "../lab/Sci.tsx";
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
          Extension · The step the mass–energy paper takes
        </p>
        <Title id={headingId} className="construction-title" style={{ margin: "0 0 0.5rem 0" }}>
          Try it: the Lorentz factor at low speed, term by term
        </Title>
      </header>

      <p>
        The factor 1/√(1 − v²/c²) runs through relativity. It is now called γ; the relativity paper
        writes it β, with V for the speed of light. The mass–energy paper finds that a body's
        kinetic energy falls by L(1/√(1 − v²/V²) − 1) when it emits light of energy L, and then
        expands that bracket. Writing x = v²/c², Newton's binomial series gives:
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
        = 1/0.8 − 1 = 0.25. Add the terms of the series one at a time and the total closes in on it:
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
              {/* No "Order" column: each term's power of x already says its order, and five
                  columns scrolled 61px out of a 316px phone column. */}
              <th scope="col" style={{ padding: "0.4rem" }}>
                Term added
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                Its value
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                Running total
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                Short of 0.25
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid var(--rule)" }}>
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
              <td style={{ padding: "0.4rem" }}>³⁵/₁₂₈ x⁴</td>
              <td style={{ padding: "0.4rem", fontFamily: "var(--font-mono, monospace)" }}>
                0.004593
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
        Keeping only the first term is the paper's own step: "neglecting quantities of fourth and
        higher order", it writes the loss of kinetic energy as (L/V²)(v²/2). At v = 0.6c that gives
        0.18L where the exact bracket gives 0.25L. The paper needs only low speeds, where the
        neglected terms are tiny.
      </p>

      <Sub>2. Low speeds: a computer is also better off with the series</Sub>
      <p>
        At v/c = 10⁻⁴, about 30 kilometres per second, roughly the Earth's speed round the Sun, x =
        10⁻⁸ and γ = 1.000000005. A computer keeps about 16 significant digits, so subtracting 1
        from γ throws away the first eight and leaves an answer made mostly of rounding error. The
        first term of the series, or the bracket rearranged so that nothing close to 1 is
        subtracted, keeps every digit:
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
        <dl className="readout-grid" style={{ fontSize: "0.9rem" }}>
          <dt style={{ color: "var(--muted)" }}>First series term (½ x):</dt>
          <dd style={{ margin: 0, fontFamily: "var(--font-mono, monospace)" }}>
            <Sci value={firstTermLow} digits={10} />
          </dd>

          <dt style={{ fontWeight: "bold", color: "var(--ink)" }}>
            Rearranged, nothing near 1 subtracted:
          </dt>
          <dd
            style={{
              margin: 0,
              fontWeight: "bold",
              fontFamily: "var(--font-mono, monospace)",
              color: "var(--accent)",
            }}
          >
            <Sci value={cancellationFreeVal} digits={10} />
          </dd>

          <dt style={{ color: "var(--muted)" }}>Its difference from the first term, relative:</dt>
          <dd style={{ margin: 0, fontFamily: "var(--font-mono, monospace)" }}>
            <Sci value={relDiffFirstTerm} digits={6} />, which the next term predicts: 0.75x
          </dd>

          <dt style={{ color: "var(--muted)" }}>Direct subtraction, 1/√(1 − x) − 1:</dt>
          <dd
            style={{ margin: 0, fontFamily: "var(--font-mono, monospace)", color: "var(--muted)" }}
          >
            <Sci value={naiveVal} digits={10} />
          </dd>

          <dt style={{ color: "var(--muted)" }}>Its difference from the first term, relative:</dt>
          <dd
            style={{ margin: 0, fontFamily: "var(--font-mono, monospace)", color: "var(--muted)" }}
          >
            <Sci value={relDiffNaive} digits={6} />, about five times the true difference
          </dd>
        </dl>
      </div>

      <div className="trustworthy-rule-statement callout-limit">
        <strong>The rearrangement:</strong> γ − 1 = x / (√(1 − x) · (1 + √(1 − x))). It is the same
        number as 1/√(1 − x) − 1, written so that no two nearly equal quantities are subtracted. At
        low speed, direct subtraction gets the eighth significant figure wrong; the rearrangement
        and the series do not.
      </div>
    </section>
  );
}
