"use client";

import { useId, useState } from "react";
import "./foundations.css";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

export interface DataPoint {
  readonly t: number;
  readonly x2: number;
  readonly rms: number;
}

export const BROWNIAN_PLOT_POINTS: readonly DataPoint[] = [
  { t: 0, x2: 0, rms: 0.0 },
  { t: 1, x2: 4, rms: 2.0 },
  { t: 4, x2: 16, rms: 4.0 },
  { t: 9, x2: 36, rms: 6.0 },
  { t: 16, x2: 64, rms: 8.0 },
];

/**
 * Interactive table-to-plot builder for foundation:functions-graphs.
 * Builds a √t displacement curve from a table worked out from λx² = 2Dt. The values are
 * computed for D = 2 µm²/s and are labelled as such: they were captioned "Table of paired
 * measurements (Brownian §5)" until 2026-09-22, which presented invented numbers as
 * Einstein's data (AGENTS.md, "no manufactured historical data").
 * Operable by keyboard and fully rendered for no-JavaScript visitors.
 */
export function TableToPlotBuilder({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const [plottedCount, setPlottedCount] = useState<number>(BROWNIAN_PLOT_POINTS.length);

  const complete = plottedCount >= BROWNIAN_PLOT_POINTS.length;
  const atStart = plottedCount <= 1;

  const plotNext = () => {
    setPlottedCount((c) => Math.min(c + 1, BROWNIAN_PLOT_POINTS.length));
  };

  const plotAll = () => {
    setPlottedCount(BROWNIAN_PLOT_POINTS.length);
  };

  const resetPlot = () => {
    setPlottedCount(1);
  };

  // SVG coordinate mapping
  const width = 360;
  const height = 200;
  const pad = { left: 45, right: 20, top: 20, bottom: 35 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const toSvgX = (t: number) => pad.left + (t / 16) * plotW;
  const toSvgY = (rms: number) => pad.top + plotH - (rms / 8) * plotH;

  return (
    <section
      className="foundation-construction table-to-plot-builder"
      aria-labelledby={headingId}
      data-foundation-construction="functions-graphs"
    >
      <Title id={headingId} className="construction-title">
        Try it: from a table to a curve
      </Title>
      <p>
        In §4 of the Brownian paper, a particle's root-mean-square displacement in a time t is λx =
        √(2Dt). The mean square grows in proportion to the time, so the typical displacement grows
        only as the square root of the time. The table below is worked out from that formula for D =
        2 µm²/s. Plot it point by point to see what square-root growth looks like.
      </p>

      {/* aria-disabled, not disabled: a disabled button loses focus the moment it is disabled, so
          plotting the last point or pressing Reset sent a keyboard reader back to the top of the
          page. An aria-disabled button keeps focus and does nothing when pressed, and the status
          line below announces the new count. No aria-label: the visible words are the name. */}
      <fieldset
        className="construction-controls"
        aria-label="Plot builder controls"
        style={{ border: "none", padding: 0, margin: 0 }}
      >
        <button type="button" onClick={complete ? undefined : plotNext} aria-disabled={complete}>
          Plot next point ({plottedCount}/{BROWNIAN_PLOT_POINTS.length})
        </button>
        <button type="button" onClick={complete ? undefined : plotAll} aria-disabled={complete}>
          Plot all
        </button>
        <button type="button" onClick={atStart ? undefined : resetPlot} aria-disabled={atStart}>
          Reset to the first point
        </button>
        <span className="construction-status" aria-live="polite">
          Showing {plottedCount} of {BROWNIAN_PLOT_POINTS.length} points plotted.
        </span>
      </fieldset>

      <div
        className="construction-display"
        style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", margin: "1rem 0" }}
      >
        <figure style={{ margin: 0 }}>
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Scatter plot of displacement against time with ${plottedCount} points plotted`}
            style={{
              background: "var(--paper)",
              border: "1px solid var(--rule)",
              borderRadius: "4px",
            }}
          >
            {/* Grid lines & axes */}
            <line
              x1={pad.left}
              y1={pad.top + plotH}
              x2={pad.left + plotW}
              y2={pad.top + plotH}
              stroke="var(--ink)"
              strokeWidth="1.5"
            />
            <line
              x1={pad.left}
              y1={pad.top}
              x2={pad.left}
              y2={pad.top + plotH}
              stroke="var(--ink)"
              strokeWidth="1.5"
            />

            {/* Theoretical curve (dashed) */}
            <path
              d={Array.from({ length: 33 }, (_, i) => {
                const t = (i / 32) * 16;
                const rms = 2.0 * Math.sqrt(t);
                const cmd = i === 0 ? "M" : "L";
                return `${cmd} ${toSvgX(t).toFixed(1)} ${toSvgY(rms).toFixed(1)}`;
              }).join(" ")}
              fill="none"
              stroke="var(--muted)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />

            {/* Plotted points */}
            {BROWNIAN_PLOT_POINTS.slice(0, plottedCount).map((p) => (
              <g key={p.t}>
                <circle
                  cx={toSvgX(p.t)}
                  cy={toSvgY(p.rms)}
                  r="5"
                  fill="var(--accent)"
                  stroke="var(--paper)"
                  strokeWidth="1.5"
                />
                <text
                  x={toSvgX(p.t) + 6}
                  y={toSvgY(p.rms) - 6}
                  fontSize="11"
                  fill="var(--ink)"
                  fontFamily="var(--font-mono, monospace)"
                >
                  ({p.t}s, {p.rms}µm)
                </text>
              </g>
            ))}

            {/* Axis labels */}
            <text
              x={pad.left + plotW / 2}
              y={height - 6}
              textAnchor="middle"
              fontSize="12"
              fill="var(--ink)"
            >
              Time t (seconds)
            </text>
            <text
              x={14}
              y={pad.top + plotH / 2}
              textAnchor="middle"
              fontSize="12"
              fill="var(--ink)"
              transform={`rotate(-90 14 ${pad.top + plotH / 2})`}
            >
              RMS displacement (µm)
            </text>
          </svg>
          <figcaption style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "0.4rem" }}>
            Dashed line: λx = √(2Dt). Dots: the rows of the table.
          </figcaption>
        </figure>

        <section
          className="construction-table-wrap"
          style={{ flex: "1 1 240px", minWidth: "240px" }}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a region that scrolls must be focusable or its off-screen columns are unreachable by keyboard, which is the access defect the scroll container would otherwise introduce (am-bc6s). Suppressed inline at the site, following ModernOnlySymbolsView.tsx, rather than as a per-file override that turns the rule off for a whole file and carries no reason with it.
          tabIndex={0}
          aria-label="Time and mean square displacement worked out from λx² = 2Dt, scrollable table"
        >
          <table
            className="data-table"
            style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}
          >
            <caption style={{ textAlign: "left", fontWeight: "bold", marginBottom: "0.5rem" }}>
              Worked out from λx² = 2Dt with D = 2 µm²/s. These are not measurements.
            </caption>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--rule)", textAlign: "left" }}>
                <th scope="col" style={{ padding: "0.4rem" }}>
                  Time t (s)
                </th>
                <th scope="col" style={{ padding: "0.4rem" }}>
                  ⟨x²⟩ (µm²)
                </th>
                <th scope="col" style={{ padding: "0.4rem" }}>
                  √⟨x²⟩ (µm)
                </th>
                <th scope="col" style={{ padding: "0.4rem" }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {BROWNIAN_PLOT_POINTS.map((p, idx) => {
                const isPlotted = idx < plottedCount;
                return (
                  <tr
                    key={p.t}
                    style={{
                      borderBottom: "1px solid var(--rule)",
                      backgroundColor: isPlotted ? "transparent" : "rgba(0,0,0,0.03)",
                    }}
                  >
                    <td style={{ padding: "0.4rem" }}>{p.t}</td>
                    <td style={{ padding: "0.4rem" }}>{p.x2}</td>
                    <td style={{ padding: "0.4rem" }}>{p.rms.toFixed(1)}</td>
                    <td
                      style={{
                        padding: "0.4rem",
                        color: isPlotted ? "var(--ink)" : "var(--muted)",
                      }}
                    >
                      {isPlotted ? "Plotted" : "Not yet"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>

      <div
        className="construction-text-equivalent"
        style={{ fontSize: "0.9rem", marginTop: "1rem" }}
      >
        <Sub>What it shows, in words</Sub>
        <p>
          Each row pairs a time in seconds with the mean square displacement in square micrometres
          and its square root. Four times the time gives twice the displacement, not four times: the
          displacement grows as the square root of time. A particle drifting at a steady speed would
          go four times as far.
        </p>
      </div>
    </section>
  );
}
