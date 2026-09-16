import type { Lq05Parameters } from "../../../experiments/lq05/definition.ts";
import type { Lq05Evaluation } from "../../../experiments/lq05/session.ts";

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
      className="lq05-visual-wrap"
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
        className="lq05-container-box border border-border/80 rounded-xl p-4 bg-muted/20"
        style={{ position: "relative" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <span className="text-xs font-mono font-medium text-foreground/80">
            Total volume V₀ (Full box)
          </span>
          <span className="text-xs font-mono font-semibold text-primary">
            Subvolume V = {f.toFixed(3)} V₀ ({Math.round(f * 100)}%)
          </span>
        </div>

        <svg
          viewBox={`0 0 ${boxWidth} ${boxHeight}`}
          width="100%"
          height="180"
          className="overflow-visible rounded-lg border border-border/60 bg-background"
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
            fill="currentColor"
            className="text-primary/15"
          />
          {/* Subvolume partition boundary */}
          <line
            x1={subWidth}
            y1="0"
            x2={subWidth}
            y2={boxHeight}
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="4 2"
            className="text-primary"
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
              fill={locked ? "#f59e0b" : pt.inside ? "#10b981" : "#3b82f6"}
              stroke="#ffffff"
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
            fill="currentColor"
            className="text-foreground/80"
          >
            Subvolume V
          </text>
          {subWidth < boxWidth - 40 && (
            <text
              x={(boxWidth + subWidth) / 2}
              y={boxHeight - 12}
              textAnchor="middle"
              fontSize="11"
              fill="currentColor"
              className="text-muted-foreground"
            >
              V₀ − V
            </text>
          )}
        </svg>

        <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
          <span>
            Mode:{" "}
            <strong>{locked ? "Locked Cluster (rigidly coupled)" : "Independent Points"}</strong>
          </span>
          <span>
            {locked ? (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                W_locked = f = {lockedRes.value.toFixed(4)}
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                W = fⁿ = ({f.toFixed(2)})^{n} ={" "}
                {independentProbability.linearRepresentable
                  ? independentProbability.value.toExponential(4)
                  : `10^(${independentProbability.log10W.toFixed(2)})`}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* 2. Binomial Distribution Chart P(k) */}
      <div className="border border-border/80 rounded-xl p-4 bg-muted/10">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-xs font-mono uppercase tracking-wide text-foreground/80 font-bold">
            Binomial distribution: Points inside subvolume P(k)
          </h4>
          <span className="text-xs text-muted-foreground">k = 0 .. {n}</span>
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
                    backgroundColor: isAllInside ? "#10b981" : "#6366f1",
                    borderRadius: "2px 2px 0 0",
                  }}
                />
                <span style={{ fontSize: "9px", fontFamily: "monospace", marginTop: "2px" }}>
                  {term.k}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Green bar at k = {n} represents all points inside: W = P({n}) = f^{n}.
        </p>
      </div>

      {/* 3. View-specific diagnostics */}
      {view === "enumeration" && enumeration.status === "value" && (
        <div className="p-3 bg-muted/20 border border-border/70 rounded-lg text-xs">
          <strong>Microstate enumeration:</strong> Total microstates:{" "}
          <span className="font-mono font-bold">
            {enumeration.totalConfigurations.toLocaleString()}
          </span>
          . Favorable:{" "}
          <span className="font-mono font-bold">{enumeration.favorableConfigurations}</span>. Exact
          ratio:{" "}
          <span className="font-mono font-bold">
            1 / {enumeration.totalConfigurations.toLocaleString()}
          </span>
          .
        </div>
      )}

      {view === "sampling" && (
        <div className="p-3 bg-muted/20 border border-border/70 rounded-lg text-xs">
          <strong>Monte Carlo Philox sampling:</strong> {sampling.successCount} successes out of{" "}
          {sampling.trials.toLocaleString()} trials ({sampling.sampleFraction.toExponential(4)}).
          Seed: <code>{sampling.seed}</code>.
        </div>
      )}

      {view === "logarithmic" && (
        <div className="p-3 bg-muted/20 border border-border/70 rounded-lg text-xs">
          <strong>Logarithmic Boltzmann scaling:</strong> log₁₀ W ={" "}
          <span className="font-mono font-bold">{independentProbability.log10W.toFixed(4)}</span>,
          ln W ={" "}
          <span className="font-mono font-bold">{independentProbability.lnW.toFixed(4)}</span>,
          ΔS/k_B ={" "}
          <span className="font-mono font-bold">
            {independentProbability.deltaSOverKb.toFixed(4)}
          </span>
          .
        </div>
      )}
    </div>
  );
}
