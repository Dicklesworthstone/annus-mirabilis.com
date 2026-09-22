import type { Lq07Parameters } from "../../../experiments/lq07/definition.ts";
import type { Lq07Evaluation } from "../../../experiments/lq07/session.ts";

export interface FluorescencePlotProps {
  parameters: Lq07Parameters;
  evaluation: Lq07Evaluation;
  clipId?: string;
}

function getFrequencyBand(nuTHz: number): { name: string; color: string; wavelengthNm: number } {
  // c = 299792.458 km/s => lambda (nm) = 299792.458 / nu (THz)
  const lambdaNm = Math.round(299792.458 / nuTHz);
  if (nuTHz > 789) {
    return { name: "Ultraviolet (UV)", color: "#7c3aed", wavelengthNm: lambdaNm };
  }
  if (nuTHz >= 400) {
    if (nuTHz > 680) return { name: "Violet", color: "#8b5cf6", wavelengthNm: lambdaNm };
    if (nuTHz > 600) return { name: "Blue", color: "#3b82f6", wavelengthNm: lambdaNm };
    if (nuTHz > 530) return { name: "Green", color: "#10b981", wavelengthNm: lambdaNm };
    if (nuTHz > 510) return { name: "Yellow", color: "#eab308", wavelengthNm: lambdaNm };
    if (nuTHz > 480) return { name: "Orange", color: "#f97316", wavelengthNm: lambdaNm };
    return { name: "Red", color: "#ef4444", wavelengthNm: lambdaNm };
  }
  return { name: "Infrared (IR)", color: "#b91c1c", wavelengthNm: lambdaNm };
}

export function FluorescencePlot({
  parameters,
  evaluation,
  clipId = "lq07-plot-clip",
}: FluorescencePlotProps) {
  const { nu1, nu2, regime, multiQuantumK } = parameters;
  const { budget, rates } = evaluation;

  const band1 = getFrequencyBand(nu1);
  const band2 = getFrequencyBand(nu2);

  const maxEnergyEv = Math.max(
    5.0,
    budget.e1Ev * (regime === "deviation-multi-quantum" ? multiQuantumK : 1.2),
    budget.e2Ev * 1.1,
  );
  const scale = 220 / maxEnergyEv; // px per eV

  const barWidth = 44;
  const svgWidth = 460;
  const svgHeight = 280;
  const groundY = 230;

  const h1Px = budget.e1Ev * scale;
  const h2Px = budget.e2Ev * scale;
  const hOtherPx = budget.allowed ? budget.eOtherEv * scale : 0;
  const hDeficitPx = !budget.allowed ? budget.energyDeficitEv * scale : 0;
  const hMaxPx =
    (budget.status === "value"
      ? budget.e1Ev * (regime === "deviation-multi-quantum" ? multiQuantumK : 1)
      : budget.e1Ev) * scale;

  return (
    <div
      data-testid="lq07-plot-container"
      data-regime={regime}
      data-allowed={budget.allowed ? "true" : "false"}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        width: "100%",
        maxWidth: "42rem",
        margin: "0 auto",
      }}
    >
      {/* 1. Main Energy Budget SVG Chart */}
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
          background: "var(--wash)",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.75rem",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                fontSize: "0.75rem",
                fontFamily: "var(--font-mono, monospace)",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--ink)",
              }}
            >
              Elementary Quantum Energy Ledger
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                padding: "0.125rem 0.5rem",
                borderRadius: "9999px",
                fontWeight: "bold",
                fontFamily: "var(--font-mono, monospace)",
                background:
                  budget.status === "outside-domain"
                    ? "rgba(245, 158, 11, 0.15)"
                    : budget.allowed
                      ? "rgba(16, 185, 129, 0.15)"
                      : "rgba(244, 63, 94, 0.15)",
                color:
                  budget.status === "outside-domain"
                    ? "var(--accent)"
                    : budget.allowed
                      ? "var(--plot)"
                      : "var(--accent)",
                border: `1px solid ${
                  budget.status === "outside-domain"
                    ? "rgba(245, 158, 11, 0.3)"
                    : budget.allowed
                      ? "rgba(16, 185, 129, 0.3)"
                      : "rgba(244, 63, 94, 0.3)"
                }`,
              }}
            >
              {budget.status === "outside-domain"
                ? "Outside Wien Regime"
                : budget.allowed
                  ? "Allowed by Budget"
                  : "Disallowed (Deficit)"}
            </span>
          </div>

          <span
            className="fine"
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.75rem",
            }}
          >
            {regime === "standard-stokes" && "Stokes's Rule (§7)"}
            {regime === "deviation-multi-quantum" && `Deviation Case 1 (k = ${multiQuantumK})`}
            {regime === "deviation-non-wien" && "Deviation Case 2 (Wien Check)"}
            {regime === "modern-thermal" && "Modern Thermal Allowance"}
          </span>
        </div>

        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          width="100%"
          height="240"
          role="img"
          aria-label={`Fluorescence energy budget: incident ${nu1} THz (${budget.e1Ev.toFixed(3)} eV), emitted ${nu2} THz (${budget.e2Ev.toFixed(3)} eV), status ${budget.allowed ? "allowed" : "disallowed"}`}
          style={{
            overflow: "visible",
            borderRadius: "0.5rem",
            border: "1px solid var(--line)",
            background: "var(--panel)",
          }}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x="0" y="0" width={svgWidth} height={svgHeight} rx="8" />
            </clipPath>
            <pattern
              id="deficit-hatch"
              width="8"
              height="8"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="8" stroke="#ef4444" strokeWidth="2.5" />
            </pattern>
          </defs>

          {/* Ground level line */}
          <line
            x1="30"
            y1={groundY}
            x2={svgWidth - 20}
            y2={groundY}
            stroke="var(--line)"
            strokeWidth="1.5"
          />
          <text x="35" y={groundY + 16} fontSize="10" fontFamily="monospace" fill="var(--muted)">
            0 eV (Ground State)
          </text>

          {/* Bar 1: Absorbed Energy */}
          <g transform="translate(90, 0)">
            <rect
              x={-barWidth / 2}
              y={groundY - h1Px}
              width={barWidth}
              height={h1Px}
              fill={band1.color}
              rx="4"
              opacity="0.9"
            />
            <text
              x="0"
              y={groundY - h1Px - 8}
              textAnchor="middle"
              fontSize="11"
              fontWeight="bold"
              fontFamily="monospace"
              fill="var(--ink)"
            >
              {budget.e1Ev.toFixed(3)} eV
            </text>
            <text
              x="0"
              y={groundY + 16}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="var(--ink)"
            >
              Absorbed (hν₁)
            </text>
            <text
              x="0"
              y={groundY + 28}
              textAnchor="middle"
              fontSize="9"
              fontFamily="monospace"
              fill="var(--muted)"
            >
              {nu1} THz · {band1.wavelengthNm} nm
            </text>
          </g>

          {/* Upper bound threshold line */}
          <line
            x1="140"
            y1={groundY - hMaxPx}
            x2={svgWidth - 50}
            y2={groundY - hMaxPx}
            stroke="var(--accent)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <text
            x={svgWidth - 45}
            y={groundY - hMaxPx + 3}
            fontSize="9"
            fontFamily="monospace"
            fontWeight="bold"
            fill="var(--accent)"
          >
            ν₂,max = {(budget.nu2MaxHz / 1e12).toFixed(1)} THz
          </text>

          {/* Bar 2: Emitted Light Energy */}
          <g transform="translate(220, 0)">
            <rect
              x={-barWidth / 2}
              y={groundY - h2Px}
              width={barWidth}
              height={h2Px}
              fill={band2.color}
              rx="4"
              opacity="0.9"
            />
            <text
              x="0"
              y={groundY - h2Px - 8}
              textAnchor="middle"
              fontSize="11"
              fontWeight="bold"
              fontFamily="monospace"
              fill="var(--ink)"
            >
              {budget.e2Ev.toFixed(3)} eV
            </text>
            <text
              x="0"
              y={groundY + 16}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="var(--ink)"
            >
              Emitted (hν₂)
            </text>
            <text
              x="0"
              y={groundY + 28}
              textAnchor="middle"
              fontSize="9"
              fontFamily="monospace"
              fill="var(--muted)"
            >
              {nu2} THz · {band2.wavelengthNm} nm
            </text>
          </g>

          {/* Bar 3: Other Channels (Heat) OR Energy Deficit */}
          <g transform="translate(340, 0)">
            {budget.allowed ? (
              <rect
                x={-barWidth / 2}
                y={groundY - hOtherPx}
                width={barWidth}
                height={Math.max(2, hOtherPx)}
                fill="#10b981"
                rx="4"
                opacity="0.85"
              />
            ) : (
              <rect
                x={-barWidth / 2}
                y={groundY - hDeficitPx}
                width={barWidth}
                height={Math.max(4, hDeficitPx)}
                fill="url(#deficit-hatch)"
                stroke="#ef4444"
                strokeWidth="1.5"
                rx="4"
              />
            )}

            <text
              x="0"
              y={groundY - (budget.allowed ? hOtherPx : hDeficitPx) - 8}
              textAnchor="middle"
              fontSize="11"
              fontWeight="bold"
              fontFamily="monospace"
              fill={budget.allowed ? "var(--plot)" : "var(--accent)"}
            >
              {budget.allowed
                ? `+${budget.eOtherEv.toFixed(3)} eV`
                : `-${budget.energyDeficitEv.toFixed(3)} eV`}
            </text>
            <text
              x="0"
              y={groundY + 16}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="var(--ink)"
            >
              {budget.allowed ? "Heat (E_other)" : "Energy Deficit"}
            </text>
            <text
              x="0"
              y={groundY + 28}
              textAnchor="middle"
              fontSize="9"
              fontFamily="monospace"
              fill="var(--muted)"
            >
              {budget.allowed ? "Dissipated in medium" : "Forbidden by single-quantum"}
            </text>
          </g>
        </svg>

        {/* Reason / Verdict Callout */}
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem",
            borderRadius: "0.5rem",
            border: `1px solid ${
              budget.status === "outside-domain"
                ? "rgba(245, 158, 11, 0.3)"
                : budget.allowed
                  ? "rgba(16, 185, 129, 0.3)"
                  : "rgba(244, 63, 94, 0.3)"
            }`,
            fontSize: "0.75rem",
            lineHeight: 1.6,
            background:
              budget.status === "outside-domain"
                ? "rgba(245, 158, 11, 0.1)"
                : budget.allowed
                  ? "rgba(16, 185, 129, 0.1)"
                  : "rgba(244, 63, 94, 0.1)",
            color: "var(--ink)",
          }}
        >
          <strong>Verdict:</strong> {budget.verdictReason}
        </div>
      </div>

      {/* 2. False-Color Spectral Band Legend */}
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: "0.75rem",
          padding: "1rem",
          background: "var(--wash)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.5rem",
            flexWrap: "wrap",
            gap: "0.25rem",
          }}
        >
          <h4
            style={{
              fontSize: "0.75rem",
              fontFamily: "var(--font-mono, monospace)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--ink)",
              fontWeight: "bold",
              margin: 0,
            }}
          >
            Spectral Bands &amp; False-Color Legend
          </h4>
          <span className="fine" style={{ margin: 0, fontSize: "0.75rem" }}>
            Wavelength λ = c / ν
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
            gap: "0.5rem",
            fontSize: "0.75rem",
          }}
        >
          <div
            style={{
              padding: "0.5rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--line)",
              background: "var(--panel)",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span
              style={{
                width: "0.875rem",
                height: "0.875rem",
                borderRadius: "9999px",
                background: "#7c3aed",
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontWeight: 600 }}>Ultraviolet (UV)</div>
              <div
                className="fine"
                style={{
                  fontSize: "0.625rem",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                &gt; 789 THz (&lt; 380 nm)
              </div>
            </div>
          </div>
          <div
            style={{
              padding: "0.5rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--line)",
              background: "var(--panel)",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span
              style={{
                width: "0.875rem",
                height: "0.875rem",
                borderRadius: "9999px",
                background: "linear-gradient(to right, #3b82f6, #10b981, #ef4444)",
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontWeight: 600 }}>Visible Spectrum</div>
              <div
                className="fine"
                style={{
                  fontSize: "0.625rem",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                400–789 THz (380–750 nm)
              </div>
            </div>
          </div>
          <div
            style={{
              padding: "0.5rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--line)",
              background: "var(--panel)",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span
              style={{
                width: "0.875rem",
                height: "0.875rem",
                borderRadius: "9999px",
                background: "#b91c1c",
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontWeight: 600 }}>Infrared (IR)</div>
              <div
                className="fine"
                style={{
                  fontSize: "0.625rem",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                &lt; 400 THz (&gt; 750 nm)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Rates and Intensity Linearity Readout */}
      {rates.status === "value" && (
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: "0.75rem",
            padding: "1rem",
            background: "var(--wash)",
            fontSize: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.25rem",
            }}
          >
            <span
              style={{
                fontWeight: "bold",
                color: "var(--ink)",
                textTransform: "uppercase",
                fontFamily: "var(--font-mono, monospace)",
                letterSpacing: "0.05em",
              }}
            >
              Weak-Illumination Photon Rates (Zero Threshold)
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono, monospace)",
                color: "var(--accent)",
                fontWeight: 600,
              }}
            >
              Yield Y = {rates.quantumYield.toFixed(2)}
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(130px, 100%), 1fr))",
              gap: "0.75rem",
              paddingTop: "0.25rem",
            }}
          >
            <div>
              <span className="fine" style={{ display: "block", fontSize: "0.6875rem" }}>
                Absorbed Rate Ṅ₁:
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontWeight: "bold",
                  color: "var(--ink)",
                }}
              >
                {rates.absorbedRatePerSecond.toExponential(4)} s⁻¹
              </span>
            </div>
            <div>
              <span className="fine" style={{ display: "block", fontSize: "0.6875rem" }}>
                Emitted Rate Ṅ₂:
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontWeight: "bold",
                  color: "var(--accent)",
                }}
              >
                {rates.emittedRatePerSecond.toExponential(4)} s⁻¹
              </span>
            </div>
            <div>
              <span className="fine" style={{ display: "block", fontSize: "0.6875rem" }}>
                Emitted Power:
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontWeight: "bold",
                  color: "var(--ink)",
                }}
              >
                {(rates.emittedPowerWatts * 1e6).toFixed(4)} μW
              </span>
            </div>
            <div>
              <span className="fine" style={{ display: "block", fontSize: "0.6875rem" }}>
                Heat Dissipated:
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontWeight: "bold",
                  color: "var(--ink)",
                }}
              >
                {(rates.dissipatedHeatWatts * 1e6).toFixed(4)} μW
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
