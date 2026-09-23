import type { Lq05Parameters } from "../../../experiments/lq05/definition.ts";
import type { Lq05Evaluation } from "../../../experiments/lq05/session.ts";
import { PowerOfTen, Sci } from "../Sci.tsx";

export interface IndependentConfigurationsPlotProps {
  parameters: Lq05Parameters;
  evaluation: Lq05Evaluation;
  clipId?: string;
}

export function IndependentConfigurationsPlot({
  parameters,
  evaluation,
  clipId = "lq05-plot-clip",
}: IndependentConfigurationsPlotProps) {
  const { n, f, view, locked } = parameters;
  const { independentProbability, binomial, enumeration, locked: lockedRes, sampling } = evaluation;

  const boxWidth = 320;
  const boxHeight = 160;
  const subWidth = boxWidth * f;

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
              fontSize: "0.75rem",
              fontFamily: "var(--font-mono, monospace)",
              fontWeight: 500,
              color: "var(--ink)",
            }}
          >
            Total volume V₀ (Full box)
          </span>
          <span
            style={{
              fontSize: "0.75rem",
              fontFamily: "var(--font-mono, monospace)",
              fontWeight: 600,
              color: "var(--accent)",
            }}
          >
            Subvolume V = {f.toFixed(3)} V₀ ({Math.round(f * 100)}%)
          </span>
        </div>

        <svg
          viewBox={`0 0 ${boxWidth} ${boxHeight}`}
          width="100%"
          height="180"
          style={{
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
              pointId: `particle-${cx.toFixed(3)}-${cy.toFixed(3)}`,
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
            fontSize: "0.75rem",
            color: "var(--muted)",
          }}
        >
          <span>
            Mode:{" "}
            <strong style={{ color: "var(--ink)" }}>
              {locked ? "Locked cluster (rigidly coupled)" : "Independent points"}
            </strong>
          </span>
          <span>
            {locked ? (
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                W_locked = f = {lockedRes.value.toFixed(4)}
              </span>
            ) : (
              <span style={{ color: "var(--ink)", fontWeight: 600 }}>
                W = fⁿ = ({f.toFixed(2)})<sup>{n}</sup> ={" "}
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
        style={{
          border: "1px solid var(--line)",
          borderRadius: "0.75rem",
          padding: "1rem",
          background: "var(--panel)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.5rem",
          }}
        >
          <h4
            style={{
              fontSize: "var(--type-small)",
              color: "var(--ink)",
              fontWeight: 600,
              margin: 0,
            }}
          >
            Binomial distribution: points inside subvolume P(k)
          </h4>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--muted)",
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            k = 0 .. {n}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "2px",
            height: "90px",
            paddingTop: "8px",
          }}
        >
          {binomial.terms.map((term) => {
            const heightPct = Math.max(2, Math.min(100, term.probability * 100 * 2.5));
            const isAllInside = term.k === n;
            return (
              <div
                key={`term-${term.k}`}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  height: "100%",
                  justifyContent: "flex-end",
                }}
                title={`k = ${term.k}: P = ${term.probability.toFixed(4)} (${term.exactProbability.numerator}/${term.exactProbability.denominator})`}
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
                    fontSize: "9px",
                    fontFamily: "var(--font-mono, monospace)",
                    marginTop: "2px",
                    color: "var(--muted)",
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
          style={{
            padding: "0.75rem",
            background: "var(--wash)",
            border: "1px solid var(--line)",
            borderRadius: "0.5rem",
            fontSize: "0.75rem",
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
          style={{
            padding: "0.75rem",
            background: "var(--wash)",
            border: "1px solid var(--line)",
            borderRadius: "0.5rem",
            fontSize: "0.75rem",
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
          style={{
            padding: "0.75rem",
            background: "var(--wash)",
            border: "1px solid var(--line)",
            borderRadius: "0.5rem",
            fontSize: "0.75rem",
            color: "var(--ink)",
          }}
        >
          <strong>Logarithmic Boltzmann scaling:</strong> log₁₀ W ={" "}
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: "bold" }}>
            {independentProbability.log10W.toFixed(4)}
          </span>
          , ln W ={" "}
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: "bold" }}>
            {independentProbability.lnW.toFixed(4)}
          </span>
          , ΔS/k_B ={" "}
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: "bold" }}>
            {independentProbability.deltaSOverKb.toFixed(4)}
          </span>
          .
        </div>
      )}
    </div>
  );
}
