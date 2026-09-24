import type { Lq05Parameters } from "../../../experiments/lq05/definition.ts";
import type { Lq05Evaluation } from "../../../experiments/lq05/session.ts";
import { fixed } from "../presentation.ts";
import { PowerOfTen, Sci } from "../Sci.tsx";

export interface IndependentConfigurationsPlotProps {
  parameters: Lq05Parameters;
  evaluation: Lq05Evaluation;
  clipId?: string;
  /**
   * A predict gate's attribute (PredictGate.tsx). The container drawing and the mode stay in view;
   * the W readout, the binomial chart and the view's figures answer the prompt, so they wait.
   */
  response?: Readonly<{ "data-predict-response": "shown" | "awaiting" }>;
}

export function IndependentConfigurationsPlot({
  parameters,
  evaluation,
  clipId = "lq05-plot-clip",
  response,
}: IndependentConfigurationsPlotProps) {
  const { n, f, view, locked } = parameters;
  const { independentProbability, binomial, enumeration, locked: lockedRes, sampling } = evaluation;

  const boxWidth = 320;
  const boxHeight = 160;
  const subWidth = boxWidth * f;
  // The histogram has n + 1 bars and n reaches 60. Each bar shrinks to its share of the row, and only
  // every labelStep-th bar carries its k, with the last one (every point inside) always labelled:
  // a two-digit label needs about 20px, and a phone's row is about 290px for up to 61 bars.
  const labelStep = [1, 2, 5, 10, 20, 50].find((step) => step * 14 >= n + 1) ?? 100;

  return (
    <div
      data-testid="lq05-visual-wrap"
      data-view={view}
      data-locked={locked ? "true" : "false"}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        width: "100%",
        maxWidth: "640px",
        margin: "0 auto",
      }}
    >
      {/* 1. Main Spatial Container and Point Placement Visualization */}
      <div
        style={{
          position: "relative",
          border: "1px solid var(--line)",
          borderRadius: "0.75rem",
          padding: "1rem",
          background: "var(--panel)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <span
            style={{
              fontSize: "var(--type-fine)",
              fontFamily: "var(--font-mono, monospace)",
              fontWeight: 500,
              color: "var(--ink)",
            }}
          >
            Total volume V₀ (Full box)
          </span>
          <span
            style={{
              fontSize: "var(--type-fine)",
              fontFamily: "var(--font-mono, monospace)",
              fontWeight: 600,
              color: "var(--accent)",
            }}
          >
            Subvolume V = {fixed(f, 3)} V₀ ({Math.round(f * 100)}%)
          </span>
        </div>

        <svg
          viewBox={`0 0 ${boxWidth} ${boxHeight}`}
          width="100%"
          height="180"
          style={{
            // At 606px wide on a desktop the 320-unit box printed its two labels at 24.9px; 22rem
            // keeps them near 14px and changes nothing on a phone.
            maxWidth: "22rem",
            overflow: "visible",
            borderRadius: "0.5rem",
            border: "1px solid var(--line)",
            background: "var(--wash)",
          }}
          role="img"
          aria-label={`Volume container with subvolume fraction ${f.toFixed(2)} and ${n} ${locked ? "locked" : "independent"} points`}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x="0" y="0" width={boxWidth} height={boxHeight} rx="8" />
            </clipPath>
          </defs>

          {/* Subvolume highlight */}
          <rect
            x="0"
            y="0"
            width={subWidth}
            height={boxHeight}
            fill="var(--accent)"
            opacity="0.15"
          />
          {/* Subvolume partition boundary */}
          <line
            x1={subWidth}
            y1="0"
            x2={subWidth}
            y2={boxHeight}
            stroke="var(--accent)"
            strokeWidth="2"
            strokeDasharray="4 2"
          />

          {/* Render points */}
          {Array.from({ length: Math.min(n, 60) }, (_, i) => {
            const xNorm = locked ? 0.15 + (i % 6) * 0.04 : ((i * 37 + 19) % 97) / 100;
            const yNorm = locked ? 0.3 + Math.floor(i / 6) * 0.12 : ((i * 53 + 23) % 89) / 100;
            const cx = 16 + xNorm * (boxWidth - 32);
            const cy = 16 + yNorm * (boxHeight - 32);
            const inside = cx <= subWidth;
            return {
              pointId: `particle-${fixed(cx, 3)}-${fixed(cy, 3)}`,
              cx,
              cy,
              inside,
            };
          }).map((pt) => (
            <circle
              key={pt.pointId}
              cx={pt.cx}
              cy={pt.cy}
              r={locked ? "5" : "4.5"}
              fill={locked ? "var(--accent)" : pt.inside ? "var(--plot)" : "var(--muted)"}
              stroke="var(--paper)"
              strokeWidth="1.5"
              opacity="0.9"
            />
          ))}

          {/* Partition Label */}
          <text
            x={Math.max(10, subWidth / 2)}
            y={boxHeight - 12}
            textAnchor="middle"
            fontSize="11"
            fontWeight="bold"
            fill="var(--ink)"
          >
            Subvolume V
          </text>
          {subWidth < boxWidth - 40 && (
            <text
              x={(boxWidth + subWidth) / 2}
              y={boxHeight - 12}
              textAnchor="middle"
              fontSize="11"
              fill="var(--muted)"
            >
              V₀ − V
            </text>
          )}
        </svg>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "0.5rem",
            fontSize: "var(--type-fine)",
            color: "var(--muted)",
          }}
        >
          <span>
            Mode:{" "}
            <strong style={{ color: "var(--ink)" }}>
              {locked ? "Locked cluster (rigidly coupled)" : "Independent points"}
            </strong>
          </span>
          <span {...response}>
            {locked ? (
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                W<sub>locked</sub> = f = {fixed(lockedRes.value, 4)}
              </span>
            ) : (
              <span style={{ color: "var(--ink)", fontWeight: 600 }}>
                W = f<sup>n</sup> = ({f.toFixed(2)})<sup>{n}</sup> ={" "}
                {independentProbability.linearRepresentable ? (
                  <Sci value={independentProbability.value} digits={4} />
                ) : (
                  <PowerOfTen exponent={independentProbability.log10W} digits={2} />
                )}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* 2. Binomial Distribution Chart P(k) */}
      <div
        {...response}
        style={{
          border: "1px solid var(--line)",
          borderRadius: "0.75rem",
          padding: "1rem",
          background: "var(--panel)",
        }}
      >
        <h3
          style={{
            fontSize: "var(--type-small)",
            color: "var(--ink)",
            fontWeight: 600,
            margin: "0 0 0.5rem",
          }}
        >
          Binomial distribution P(k): the chance that k of the {n} points lie inside
        </h3>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: n > 30 ? "1px" : "2px",
            height: "90px",
            paddingTop: "8px",
          }}
        >
          {binomial.terms.map((term) => {
            const heightPct = Math.max(2, Math.min(100, term.probability * 100 * 2.5));
            const isAllInside = term.k === n;
            const labelled = isAllInside || (term.k % labelStep === 0 && n - term.k >= labelStep);
            return (
              <div
                key={`term-${term.k}`}
                style={{
                  flex: "1 1 0",
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  height: "100%",
                  justifyContent: "flex-end",
                }}
                title={`k = ${term.k}: P = ${fixed(term.probability, 4)} (${term.exactProbability.numerator}/${term.exactProbability.denominator})`}
              >
                <div
                  style={{
                    width: "100%",
                    height: `${heightPct}%`,
                    backgroundColor: isAllInside ? "var(--accent)" : "var(--plot)",
                    borderRadius: "2px 2px 0 0",
                  }}
                />
                <span
                  style={{
                    fontSize: "var(--type-fine)",
                    fontFamily: "var(--font-mono, monospace)",
                    marginTop: "2px",
                    color: "var(--muted)",
                    whiteSpace: "nowrap",
                    visibility: labelled ? undefined : "hidden",
                  }}
                >
                  {term.k}
                </span>
              </div>
            );
          })}
        </div>
        <p
          style={{
            fontSize: "var(--type-fine)",
            color: "var(--muted)",
            marginTop: "0.5rem",
            marginBottom: 0,
          }}
        >
          The last bar, k = {n}, is every point inside: W = P({n}) = f<sup>{n}</sup>.
        </p>
      </div>

      {/* 3. View-specific diagnostics */}
      {view === "enumeration" && enumeration.status === "value" && (
        <div
          {...response}
          style={{
            padding: "0.75rem",
            background: "var(--wash)",
            border: "1px solid var(--line)",
            borderRadius: "0.5rem",
            fontSize: "var(--type-fine)",
            color: "var(--ink)",
          }}
        >
          <strong>Microstate enumeration:</strong> Total microstates:{" "}
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: "bold" }}>
            {enumeration.totalConfigurations.toLocaleString()}
          </span>
          . Favorable:{" "}
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: "bold" }}>
            {enumeration.favorableConfigurations}
          </span>
          . Exact ratio:{" "}
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: "bold" }}>
            1 / {enumeration.totalConfigurations.toLocaleString()}
          </span>
          .
        </div>
      )}

      {view === "sampling" && (
        <div
          {...response}
          style={{
            padding: "0.75rem",
            background: "var(--wash)",
            border: "1px solid var(--line)",
            borderRadius: "0.5rem",
            fontSize: "var(--type-fine)",
            color: "var(--ink)",
          }}
        >
          <strong>Monte Carlo Philox sampling:</strong> {sampling.successCount} successes out of{" "}
          {sampling.trials.toLocaleString()} trials (
          <Sci value={sampling.sampleFraction} digits={4} />
          ). Seed:{" "}
          <code style={{ fontFamily: "var(--font-mono, monospace)" }}>{sampling.seed}</code>.
        </div>
      )}

      {view === "logarithmic" && (
        <div
          {...response}
          style={{
            padding: "0.75rem",
            background: "var(--wash)",
            border: "1px solid var(--line)",
            borderRadius: "0.5rem",
            fontSize: "var(--type-fine)",
            color: "var(--ink)",
          }}
        >
          <strong>Logarithmic Boltzmann scaling:</strong> log₁₀ W ={" "}
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: "bold" }}>
            {fixed(independentProbability.log10W, 4)}
          </span>
          , ln W ={" "}
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: "bold" }}>
            {fixed(independentProbability.lnW, 4)}
          </span>
          , ΔS/k_B ={" "}
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: "bold" }}>
            {fixed(independentProbability.deltaSOverKb, 4)}
          </span>
          .
        </div>
      )}
    </div>
  );
}
