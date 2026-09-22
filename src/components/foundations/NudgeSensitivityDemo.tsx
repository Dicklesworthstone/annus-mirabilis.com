"use client";

import { useState } from "react";
import { PLANCK_TO_ELEMENTARY_CHARGE_RATIO } from "../../foundations/calculus.ts";
import "./foundations.css";

export interface NudgeStep {
  readonly label: string;
  readonly deltaNu: number; // in Hz
}

export const NUDGE_STEPS: readonly NudgeStep[] = [
  { label: "+1.0 × 10¹⁴ Hz (large step)", deltaNu: 1.0e14 },
  { label: "+5.0 × 10¹³ Hz (medium step)", deltaNu: 5.0e13 },
  { label: "+1.0 × 10¹³ Hz (small nudge)", deltaNu: 1.0e13 },
  { label: "+2.0 × 10¹² Hz (fine nudge)", deltaNu: 2.0e12 },
];

/**
 * Interactive nudge-sensitivity demo for foundation:derivatives.
 * Nudges incoming photon frequency and observes stopping potential change,
 * reporting Δν, ΔV, and the sensitivity ratio ΔV/Δν = h/e with units.
 */
export function NudgeSensitivityDemo() {
  const [selectedIndex, setSelectedIndex] = useState<number>(2); // Default to small nudge
  const baseNu = 6.0e14; // Base frequency in Hz (visible light, 500 nm)

  const fallbackStep: NudgeStep = { label: "+1.0 × 10¹³ Hz (small nudge)", deltaNu: 1.0e13 };
  const currentStep = NUDGE_STEPS[selectedIndex] ?? fallbackStep;
  const deltaNu = currentStep.deltaNu;
  const deltaV = deltaNu * PLANCK_TO_ELEMENTARY_CHARGE_RATIO;
  const ratio = deltaV / deltaNu;

  return (
    <section
      className="foundation-construction nudge-sensitivity-demo"
      aria-labelledby="construction-nudge-heading"
      data-foundation-construction="derivatives"
    >
      <h3 id="construction-nudge-heading">
        Interactive construction: local sensitivity and derivative units
      </h3>
      <p>
        In section 8 of the light-quanta paper, Einstein predicts that when light liberates
        electrons from a cathode, increasing the light frequency ν increases the required stopping
        potential V linearly. The derivative dV/dν is the local sensitivity of stopping voltage to
        incident frequency.
      </p>

      <fieldset
        className="nudge-controls"
        aria-label="Frequency nudge step selection"
        style={{ border: "none", padding: 0, margin: 0 }}
      >
        <p style={{ fontWeight: "bold", margin: "0.5rem 0" }}>Choose a frequency step Δν:</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
          {NUDGE_STEPS.map((step, idx) => (
            <button
              key={step.label}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              aria-pressed={selectedIndex === idx}
              style={{
                padding: "0.4rem 0.8rem",
                border: "1px solid var(--rule)",
                borderRadius: "4px",
                background: selectedIndex === idx ? "var(--accent)" : "var(--paper)",
                color: selectedIndex === idx ? "var(--paper)" : "var(--ink)",
                cursor: "pointer",
              }}
            >
              {step.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div
        className="nudge-readout"
        style={{
          border: "1px solid var(--rule)",
          borderRadius: "4px",
          padding: "1rem",
          background: "var(--paper)",
          margin: "1rem 0",
        }}
      >
        <h4 style={{ margin: "0 0 0.5rem 0" }}>Observed sensitivity response</h4>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "0.4rem 1.5rem",
            margin: 0,
          }}
        >
          <dt style={{ color: "var(--muted)" }}>Baseline frequency (ν₀):</dt>
          <dd style={{ margin: 0, fontFamily: "var(--font-mono, monospace)" }}>
            {baseNu.toExponential(2)} Hz
          </dd>

          <dt style={{ color: "var(--muted)" }}>Frequency nudge (Δν):</dt>
          <dd style={{ margin: 0, fontFamily: "var(--font-mono, monospace)" }}>
            +{deltaNu.toExponential(2)} Hz
          </dd>

          <dt style={{ color: "var(--muted)" }}>Potential change (ΔV):</dt>
          <dd style={{ margin: 0, fontFamily: "var(--font-mono, monospace)" }}>
            +{deltaV.toExponential(6)} V
          </dd>

          <dt style={{ fontWeight: "bold", color: "var(--ink)" }}>Sensitivity ratio (ΔV / Δν):</dt>
          <dd
            style={{
              margin: 0,
              fontWeight: "bold",
              fontFamily: "var(--font-mono, monospace)",
              color: "var(--accent)",
            }}
          >
            {ratio.toExponential(9)} V·s (or V/Hz)
          </dd>

          <dt style={{ color: "var(--muted)" }}>Universal ratio h/e:</dt>
          <dd style={{ margin: 0, fontFamily: "var(--font-mono, monospace)" }}>
            {PLANCK_TO_ELEMENTARY_CHARGE_RATIO.toExponential(9)} V·s
          </dd>
        </dl>
      </div>

      <div className="construction-table-wrap" style={{ marginTop: "1rem" }}>
        <table
          className="data-table"
          style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}
        >
          <caption style={{ textAlign: "left", fontWeight: "bold", marginBottom: "0.5rem" }}>
            Summary of frequency steps and sensitivity ratio
          </caption>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--rule)", textAlign: "left" }}>
              <th scope="col" style={{ padding: "0.4rem" }}>
                Nudge size
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                Δν (Hz)
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                ΔV (V)
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                Ratio ΔV / Δν (V·s)
              </th>
            </tr>
          </thead>
          <tbody>
            {NUDGE_STEPS.map((step, idx) => {
              const dv = step.deltaNu * PLANCK_TO_ELEMENTARY_CHARGE_RATIO;
              const isSelected = selectedIndex === idx;
              return (
                <tr
                  key={step.label}
                  style={{
                    borderBottom: "1px solid var(--rule)",
                    fontWeight: isSelected ? "bold" : "normal",
                    backgroundColor: isSelected ? "rgba(0,0,0,0.03)" : "transparent",
                  }}
                >
                  <td style={{ padding: "0.4rem" }}>{step.label.split(" (")[0]}</td>
                  <td style={{ padding: "0.4rem" }}>{step.deltaNu.toExponential(1)}</td>
                  <td style={{ padding: "0.4rem" }}>{dv.toExponential(4)}</td>
                  <td style={{ padding: "0.4rem" }}>{(dv / step.deltaNu).toExponential(6)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className="construction-text-equivalent"
        style={{ fontSize: "0.9rem", marginTop: "1rem" }}
      >
        <h4>Textual summary of the construction</h4>
        <p>
          A derivative is not a dimensionless number; it has physical units determined by the ratio
          of output units to input units. Here, dividing volts by hertz yields volt-seconds.
          Regardless of how small the nudge step Δν is chosen, the ratio ΔV / Δν evaluates to the
          exact physical constant h/e ≈ 4.14 × 10⁻¹⁵ V·s, confirming that the sensitivity of
          stopping potential to frequency is universal and independent of the metal.
        </p>
      </div>
    </section>
  );
}
