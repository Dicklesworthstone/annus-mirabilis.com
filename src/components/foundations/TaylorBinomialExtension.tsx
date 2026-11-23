"use client";

import { useEffect, useId, useState } from "react";
import {
  gammaMinusOneCancellationFree,
  gammaMinusOneNaive,
} from "../../foundations/calculus.ts";
import {
  INITIAL_TAYLOR_COMPARISON,
  readTaylorApproximation,
  type TaylorRefusal,
  TAYLOR_TERM_COUNTS,
} from "../../foundations/taylorApproximation.ts";
import { Sci } from "../lab/Sci.tsx";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";
import { TaylorApproximationPlot } from "./TaylorApproximationPlot.tsx";

const TERM_LABELS = ["½ x", "⅜ x²", "⁵/₁₆ x³", "³⁵/₁₂₈ x⁴"] as const;

/** The six-place reference remains legible; small nonzero values never print as zero. */
function TaylorValue({ value }: { readonly value: number }) {
  if (value === 0) return <>0</>;
  if (Math.abs(value) >= 1e-5 && Math.abs(value) < 1000) return <>{value.toFixed(6)}</>;
  return <Sci value={value} digits={6} />;
}

function RemainderPercent({ value }: { readonly value: number | null }) {
  return value === null ? (
    <>Not defined at rest</>
  ) : (
    <>
      <Sci value={Number((100 * value).toPrecision(5))} />%
    </>
  );
}

/**
 * Compare retained terms at an accepted speed, with the original moderate- and low-speed
 * examples still readable without JavaScript. All editable results come from one comparison.
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
  const [ready, setReady] = useState(false);
  const [comparison, setComparison] = useState(INITIAL_TAYLOR_COMPARISON);
  const [speedText, setSpeedText] = useState("0.6");
  const [termCount, setTermCount] = useState(1);
  const [error, setError] = useState<TaylorRefusal | null>(null);
  useEffect(() => setReady(true), []);
  const pending = speedText !== String(comparison.speed) || termCount !== comparison.count;

  function apply(speed = speedText, count = termCount) {
    const result = readTaylorApproximation(speed, count);
    if (result.kind === "refused") {
      setError(result);
      return;
    }
    setComparison(result.comparison);
    setSpeedText(String(result.comparison.speed));
    setTermCount(result.comparison.count);
    setError(null);
  }

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

      <Sub>1. How much does a finite approximation leave out?</Sub>
      <p>
        Start with the paper's first retained term, then add more. The full expression is evaluated
        without subtracting two numbers near one. Its remainder is calculated separately, so a
        small difference does not disappear merely because the two displayed totals agree.
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
      >
        <fieldset className="construction-controls" disabled={!ready}>
          <legend>Choose a speed and a truncation</legend>
          <label htmlFor={headingId + "-speed"}>Speed as a fraction of light speed, v/c</label>
          <input
            id={headingId + "-speed"}
            name="taylor-speed"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            maxLength={64}
            value={speedText}
            aria-invalid={error?.field === "speed" ? true : undefined}
            aria-describedby={
              headingId + "-speed-help" + (error?.field === "speed" ? " " + headingId + "-error" : "")
            }
            onInput={(event) => {
              setSpeedText(event.currentTarget.value);
              setError(null);
            }}
          />
          <p id={headingId + "-speed-help"} className="fine">
            Use zero or a speed from 10<sup>−30</sup> up to, but not including, 1. Decimal or
            power-of-ten input is accepted, for example 0.6 or 1e-4. Apply the entries to change
            the calculation and every table together.
          </p>
          <label htmlFor={headingId + "-terms"}>Number of retained terms</label>
          <select
            id={headingId + "-terms"}
            name="taylor-terms"
            value={termCount}
            aria-invalid={error?.field === "terms" ? true : undefined}
            aria-describedby={error?.field === "terms" ? headingId + "-error" : undefined}
            onChange={(event) => {
              setTermCount(Number(event.currentTarget.value));
              setError(null);
            }}
          >
            {TAYLOR_TERM_COUNTS.map((count) => (
              <option key={count} value={count}>
                {count === 1 ? "1 term: the paper's low-speed approximation" : count + " terms"}
              </option>
            ))}
          </select>
          <div className="actions">
            <button type="submit">Apply comparison</button>
            <button type="button" onClick={() => apply("0.0001")}>
              Low speed (0.0001c)
            </button>
            <button type="button" onClick={() => apply("1e-10")}>
              Tiny speed (10⁻¹⁰c)
            </button>
            <button type="button" onClick={() => apply("0.99")}>
              Near light speed (0.99c)
            </button>
            <button type="button" onClick={() => apply("0.6", 1)}>
              Restore the worked example
            </button>
          </div>
          {error ? (
            <p id={headingId + "-error"} role="alert">
              {error.message} The last accepted speed and approximation are still shown.
            </p>
          ) : pending ? (
            <p className="fine">
              These entries are not applied. The current results are unchanged.
            </p>
          ) : null}
        </fieldset>
      </form>

      <div data-taylor-current>
        <p role="status" aria-atomic="true">
          Accepted speed: <Sci value={comparison.speed} />c.{" "}
          {comparison.speed === 0 ? (
            <>
              At rest, the full expression and every partial sum are zero. Their relative difference
              is undefined.
            </>
          ) : (
            <>
              Keeping {comparison.count}{" "}
              {comparison.count === 1 ? "term leaves" : "terms leaves"}{" "}
              <RemainderPercent value={comparison.selected.relativeRemainder} /> of the full
              expression out.
            </>
          )}
        </p>
        <dl className="readout-grid">
          <dt>Full expression, γ − 1</dt>
          <dd data-taylor-output="exact">
            <TaylorValue value={comparison.exact} />
          </dd>
          <dt>Selected partial sum</dt>
          <dd data-taylor-output="approximation">
            <TaylorValue value={comparison.selected.sum} />
          </dd>
          <dt>Positive remainder left out</dt>
          <dd data-taylor-output="remainder">
            <TaylorValue value={comparison.selected.remainder} />
          </dd>
          <dt>Remainder as a percentage of the full expression</dt>
          <dd data-taylor-output="relative">
            <RemainderPercent value={comparison.selected.relativeRemainder} />
          </dd>
        </dl>

        <TaylorApproximationPlot comparison={comparison} />

        <section
          className="construction-table-wrap"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: readers must be able to reach columns in the horizontally scrollable arithmetic table.
          tabIndex={0}
          aria-label="Retained terms and their remainders"
        >
          <table className="data-table">
            <caption>
              Partial sums of γ − 1 at v/c = <Sci value={comparison.speed} />, x ={" "}
              <Sci value={comparison.x} />. Full expression <TaylorValue value={comparison.exact} />.
            </caption>
            <thead>
              <tr>
                <th scope="col">Term added</th>
                <th scope="col">Its value</th>
                <th scope="col">Running total</th>
                <th scope="col">Remainder</th>
                <th scope="col">Percentage left out</th>
              </tr>
            </thead>
            <tbody>
              {comparison.terms.map((row) => (
                <tr
                  key={row.count}
                  data-taylor-order={row.count}
                  data-selected={row.count === comparison.count}
                >
                  <th scope="row">
                    {TERM_LABELS[row.count - 1]}
                    {row.count === comparison.count ? " (selected)" : ""}
                  </th>
                  <td>
                    <TaylorValue value={row.term} />
                  </td>
                  <td>
                    <TaylorValue value={row.sum} />
                  </td>
                  <td data-taylor-remainder={row.count}>
                    <TaylorValue value={row.remainder} />
                  </td>
                  <td>
                    <RemainderPercent value={row.relativeRemainder} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <details>
          <summary>Compare the same truncation at other speeds</summary>
          <section
            className="construction-table-wrap"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users need the complete comparison when this table is wider than the page.
            tabIndex={0}
            aria-label="The selected approximation at other speeds"
          >
            <table className="data-table">
              <caption>
                {comparison.count} retained {comparison.count === 1 ? "term" : "terms"} at eight
                sample speeds. More terms help at every nonzero speed, but four terms are still a
                poor approximation near light speed.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Speed, v/c</th>
                  <th scope="col">Full expression</th>
                  <th scope="col">Partial sum</th>
                  <th scope="col">Percentage left out</th>
                </tr>
              </thead>
              <tbody>
                {comparison.samples.map((sample) => (
                  <tr key={sample.speed} data-taylor-sample={sample.speed}>
                    <th scope="row">
                      <Sci value={sample.speed} />
                    </th>
                    <td>
                      <TaylorValue value={sample.exact} />
                    </td>
                    <td>
                      <TaylorValue value={sample.approximation} />
                    </td>
                    <td>
                      <RemainderPercent value={sample.relativeRemainder} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </details>
      </div>

      <p className="fine">
        Reference at v = 0.6c: keeping only the first term gives 0.18L where the full expression
        gives 0.25L. The paper's own step, “neglecting quantities of fourth and higher order”,
        concerns low speeds. It identifies the coefficient of v², without treating the first term
        as exact at every speed.{" "}
        <a href="/papers/mass-energy/#arg-me-small-speed">
          Read that coefficient comparison in the paper.
        </a>
      </p>

      <Sub>2. Low speeds: a computer is also better off with the series</Sub>
      <p>
        At v/c = 10⁻⁴, about 30 kilometres per second, roughly the Earth's speed round the Sun, x =
        10⁻⁸ and γ = 1.000000005. A computer keeps about 16 significant digits. Subtracting 1
        from γ loses about eight of them: the result stays close, but that precision loss is larger
        than the first omitted series term. The rearranged full expression avoids this subtraction;
        keeping only the first series term is a separate approximation with its own small remainder:
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
        low speed, direct subtraction gets the eighth significant figure wrong. The rearrangement
        avoids that loss; a truncated series has the separate remainder shown above.
      </div>
      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          Each retained term is positive at a nonzero speed. Adding terms raises the approximation
          toward the full expression, while the positive remainder shrinks. At the initial speed,
          0.6c, one term leaves out 28 per cent; four leave out about 0.89 per cent. At much lower
          speeds the first term is already close. Near light speed even four terms miss most of
          the full expression, so “the series converges” does not mean a short truncation is useful.
        </p>
        <p>
          At zero speed all these values are zero and a relative error would divide by zero.
          At a tiny nonzero speed the remainder is still positive, even when rounding makes two
          displayed totals look equal. That truncation error is separate from the loss of numerical
          precision illustrated by direct subtraction.
        </p>
      </div>
    </section>
  );
}
