"use client";

import { useState } from "react";
import "./foundations.css";

export interface DecayStep {
  readonly n: number;
  readonly t: number; // in seconds
  readonly factorPerStep: number;
  readonly fractionRemaining: number;
  readonly percentage: string;
}

export const DECAY_STEPS: readonly DecayStep[] = [
  { n: 0, t: 0, factorPerStep: 1.0, fractionRemaining: 1.0, percentage: "100.00%" },
  {
    n: 1,
    t: 10,
    factorPerStep: Math.exp(-0.5),
    fractionRemaining: Math.exp(-0.5),
    percentage: "60.65%",
  },
  {
    n: 2,
    t: 20,
    factorPerStep: Math.exp(-0.5),
    fractionRemaining: Math.exp(-1.0),
    percentage: "36.79%",
  },
  {
    n: 3,
    t: 30,
    factorPerStep: Math.exp(-0.5),
    fractionRemaining: Math.exp(-1.5),
    percentage: "22.31%",
  },
  {
    n: 4,
    t: 40,
    factorPerStep: Math.exp(-0.5),
    fractionRemaining: Math.exp(-2.0),
    percentage: "13.53%",
  },
  {
    n: 5,
    t: 50,
    factorPerStep: Math.exp(-0.5),
    fractionRemaining: Math.exp(-2.5),
    percentage: "8.21%",
  },
];

/**
 * Interactive repeated-proportional-change table for foundation:exponentials.
 * Demonstrates how exponential processes compound constant fractional changes,
 * and explains why exponents must be dimensionless quantities.
 */
export function RepeatedProportionalTable() {
  const [selectedStep, setSelectedStep] = useState<number>(1);

  const fallbackStep: DecayStep = {
    n: 0,
    t: 0,
    factorPerStep: 1.0,
    fractionRemaining: 1.0,
    percentage: "100.00%",
  };
  const active = DECAY_STEPS[selectedStep] ?? fallbackStep;

  return (
    <section
      className="foundation-construction repeated-proportional-table"
      aria-labelledby="construction-exponentials-heading"
      data-foundation-construction="exponentials"
    >
      <h3 id="construction-exponentials-heading">
        Interactive construction: repeated proportional changes and dimensionless exponents
      </h3>
      <p>
        In linear change, an equal amount is added in every equal interval: y = y₀ + mt. In
        exponential change, the quantity is multiplied by an equal factor in every interval: y = y₀
        · rⁿ. Because each change is proportional to the current amount, exponential functions
        naturally describe continuous growth and decay.
      </p>

      <fieldset
        className="proportional-controls"
        aria-label="Step selector"
        style={{ border: "none", padding: 0, margin: "1rem 0" }}
      >
        <p style={{ fontWeight: "bold", margin: "0.5rem 0" }}>
          Select a step index n to inspect compounding:
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {DECAY_STEPS.map((step) => (
            <button
              key={step.n}
              type="button"
              onClick={() => setSelectedStep(step.n)}
              aria-pressed={selectedStep === step.n}
              style={{
                padding: "0.4rem 0.8rem",
                border: "1px solid var(--rule)",
                borderRadius: "4px",
                background: selectedStep === step.n ? "var(--accent)" : "var(--paper)",
                color: selectedStep === step.n ? "var(--paper)" : "var(--ink)",
                cursor: "pointer",
              }}
            >
              Step n = {step.n} (t = {step.t}s)
            </button>
          ))}
        </div>
      </fieldset>

      <div
        className="proportional-readout"
        style={{
          border: "1px solid var(--rule)",
          borderRadius: "4px",
          padding: "1rem",
          background: "var(--paper)",
          margin: "1rem 0",
        }}
      >
        <h4 style={{ margin: "0 0 0.5rem 0" }}>Inspection at step n = {active.n}</h4>
        <p style={{ margin: "0.25rem 0" }}>
          <strong>Formula:</strong> f({active.n}) = (e<sup>−0.5</sup>)<sup>{active.n}</sup> = e
          <sup>−{(active.n * 0.5).toFixed(1)}</sup>
        </p>
        <p style={{ margin: "0.25rem 0" }}>
          <strong>Fraction remaining:</strong> {active.fractionRemaining.toFixed(6)} (
          {active.percentage})
        </p>
        <p style={{ margin: "0.25rem 0", color: "var(--muted)", fontSize: "0.9rem" }}>
          Each 10-second interval scales the previous value by exactly e<sup>−0.5</sup> ≈ 0.606531.
        </p>
      </div>

      <div className="construction-table-wrap" style={{ marginTop: "1rem" }}>
        <table
          className="data-table"
          style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}
        >
          <caption style={{ textAlign: "left", fontWeight: "bold", marginBottom: "0.5rem" }}>
            Compounding decay steps with constant multiplier e⁻⁰·⁵
          </caption>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--rule)", textAlign: "left" }}>
              <th scope="col" style={{ padding: "0.4rem" }}>
                Step n
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                Elapsed time t (s)
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                Step multiplier
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                Fraction remaining
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                Percent
              </th>
            </tr>
          </thead>
          <tbody>
            {DECAY_STEPS.map((step) => {
              const isSelected = selectedStep === step.n;
              return (
                <tr
                  key={step.n}
                  style={{
                    borderBottom: "1px solid var(--rule)",
                    fontWeight: isSelected ? "bold" : "normal",
                    backgroundColor: isSelected ? "rgba(0,0,0,0.03)" : "transparent",
                  }}
                >
                  <td style={{ padding: "0.4rem" }}>{step.n}</td>
                  <td style={{ padding: "0.4rem" }}>{step.t}</td>
                  <td style={{ padding: "0.4rem" }}>
                    {step.n === 0 ? "1.000000" : "e⁻⁰·⁵ ≈ 0.606531"}
                  </td>
                  <td style={{ padding: "0.4rem" }}>{step.fractionRemaining.toFixed(6)}</td>
                  <td style={{ padding: "0.4rem" }}>{step.percentage}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="dimensionless-exponents-note" style={{ marginTop: "1.5rem" }}>
        <h4>Why exponents must always be dimensionless</h4>
        <p>
          You cannot evaluate e raised to three meters or five seconds, because the series
          definition e<sup>u</sup> = 1 + u + u²/2! + … would require adding meters to square meters.
          In every physical law, dimensional quantities inside exponents are strictly cancelled by
          matching units:
        </p>
        <ul>
          <li>
            <strong>Wien’s law (Light §4):</strong> e<sup>−βν/T</sup>. The frequency ν (s⁻¹) and
            temperature T (K) are balanced by β = h/k (s·K), making βν/T dimensionless.
          </li>
          <li>
            <strong>Brownian diffusion Gaussian (Brownian §4):</strong> e<sup>−x²/(4Dt)</sup>. The
            numerator x² has units m²; the denominator 4Dt has units (m²/s · s) = m², so x²/(4Dt) is
            purely dimensionless.
          </li>
        </ul>
      </div>

      <div
        className="construction-text-equivalent"
        style={{ fontSize: "0.9rem", marginTop: "1rem" }}
      >
        <h4>Textual summary of the construction</h4>
        <p>
          Equal steps in the independent variable produce equal multiplicative ratios in the
          dependent variable. The characteristic scale τ sets the interval over which the quantity
          changes by a factor of 1/e ≈ 0.367879. All physical exponents are dimensionless ratios of
          the independent variable to this characteristic scale.
        </p>
      </div>
    </section>
  );
}
