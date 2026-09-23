"use client";

import { useId, useState } from "react";
import { PLANCK_TO_ELEMENTARY_CHARGE_RATIO } from "../../foundations/calculus.ts";
import { Sci } from "../lab/Sci.tsx";
import "./foundations.css";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

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
export function NudgeSensitivityDemo({
  headingLevel = 3,
}: {
  readonly headingLevel?: HeadingLevel;
}) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
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
      aria-labelledby={headingId}
      data-foundation-construction="derivatives"
    >
      <Title id={headingId} className="construction-title">
        Try it: nudge the frequency, watch the stopping voltage
      </Title>
      <p>
        In §8 of the light-quanta paper, Einstein predicts that the potential V needed to stop the
        electrons light frees from a metal rises in a straight line with the light's frequency ν,
        with the same slope for every metal. The derivative dV/dν is that slope: how many volts the
        stopping potential rises for each hertz of frequency.
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
        <Sub style={{ margin: "0 0 0.5rem 0" }}>What the model computes</Sub>
        <dl className="readout-grid">
          <dt style={{ color: "var(--muted)" }}>Baseline frequency (ν₀):</dt>
          <dd style={{ margin: 0, fontFamily: "var(--font-mono, monospace)" }}>
            <Sci value={baseNu} digits={2} /> Hz
          </dd>

          <dt style={{ color: "var(--muted)" }}>Frequency nudge (Δν):</dt>
          <dd style={{ margin: 0, fontFamily: "var(--font-mono, monospace)" }}>
            +<Sci value={deltaNu} digits={2} /> Hz
          </dd>

          <dt style={{ color: "var(--muted)" }}>Potential change (ΔV):</dt>
          <dd style={{ margin: 0, fontFamily: "var(--font-mono, monospace)" }}>
            +<Sci value={deltaV} digits={6} /> V
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
            <Sci value={ratio} digits={9} /> V·s (or V/Hz)
          </dd>

          <dt style={{ color: "var(--muted)" }}>Modern h/e (2019 SI):</dt>
          <dd style={{ margin: 0, fontFamily: "var(--font-mono, monospace)" }}>
            <Sci value={PLANCK_TO_ELEMENTARY_CHARGE_RATIO} digits={9} /> V·s
          </dd>
        </dl>
      </div>

      <section
        className="construction-table-wrap"
        style={{ marginTop: "1rem" }}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a region that scrolls must be focusable or its off-screen columns are unreachable by keyboard, which is the access defect the scroll container would otherwise introduce (am-bc6s). Suppressed inline at the site, following ModernOnlySymbolsView.tsx, rather than as a per-file override that turns the rule off for a whole file and carries no reason with it.
        tabIndex={0}
        aria-label="Frequency steps and sensitivity ratio, scrollable table"
      >
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
                  <td style={{ padding: "0.4rem" }}>
                    <Sci value={step.deltaNu} digits={1} />
                  </td>
                  <td style={{ padding: "0.4rem" }}>
                    <Sci value={dv} digits={4} />
                  </td>
                  <td style={{ padding: "0.4rem" }}>
                    <Sci value={dv / step.deltaNu} digits={6} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div
        className="construction-text-equivalent"
        style={{ fontSize: "0.9rem", marginTop: "1rem" }}
      >
        <Sub>What it shows, in words</Sub>
        <p>
          A derivative carries units: volts divided by hertz gives volt-seconds. This model is
          Einstein's §8 straight line, with its slope set to the modern value of h/e, about 4.14 ×
          10⁻¹⁵ V·s. On a straight line every step size gives the same ratio ΔV / Δν, which is why
          the table repeats one number four times; on a curve the ratio would change with the step
          and settle only as Δν shrinks. The model was built with one slope for every metal, so it
          cannot show that real metals share one. Millikan measured that in 1916.
        </p>
      </div>
    </section>
  );
}
