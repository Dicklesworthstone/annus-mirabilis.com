import type { Lq07Parameters } from "../../../experiments/lq07/definition.ts";
import type { Lq07Evaluation } from "../../../experiments/lq07/session.ts";
import { fixed } from "../presentation.ts";
import { Sci } from "../Sci.tsx";

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

/** "Ultraviolet (UV)" read inside a parenthesis: "ultraviolet". */
const plainBand = (name: string) => name.replace(/\s*\(.*\)$/, "").toLowerCase();

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

  const barWidth = 40;
  // 300 units wide, about a phone's width, so a label reads near 12px there: at 460 units, with a
  // fixed 240px height, every label rendered at 8px. The frequencies, wavelengths and the limit's
  // value are HTML under the chart.
  const svgWidth = 300;
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
            <span style={{ fontSize: "var(--type-small)", fontWeight: 600, color: "var(--ink)" }}>
              Elementary quantum energy ledger
            </span>
            <span
              style={{
                fontSize: "var(--type-fine)",
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
                ? "Outside the Wien regime"
                : budget.allowed
                  ? "Allowed by the budget"
                  : "Disallowed (deficit)"}
            </span>
          </div>

          <span
            className="fine"
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "var(--type-fine)",
            }}
          >
            {regime === "standard-stokes" && "Stokes's rule (§7)"}
            {regime === "deviation-multi-quantum" && `Deviation case 1 (k = ${multiQuantumK})`}
            {regime === "deviation-non-wien" && "Deviation case 2 (Wien check)"}
            {regime === "modern-thermal" && "Modern thermal allowance"}
          </span>
        </div>

        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          role="img"
          aria-label={`Fluorescence energy budget: incident ${nu1} THz (${fixed(budget.e1Ev, 3)} eV), emitted ${nu2} THz (${fixed(budget.e2Ev, 3)} eV), status ${budget.allowed ? "allowed" : "disallowed"}`}
          style={{
            display: "block",
            width: "100%",
            maxWidth: "21rem",
            height: "auto",
            margin: "0 auto",
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

          {/* Ground level */}
          <line
            x1="10"
            y1={groundY}
            x2={svgWidth - 10}
            y2={groundY}
            stroke="var(--line)"
            strokeWidth="1.5"
          />
          <text x="10" y={groundY + 34}>
            0 eV
          </text>

          {/* The largest emitted quantum the rule allows */}
          <line
            x1="85"
            y1={groundY - hMaxPx}
            x2={svgWidth - 10}
            y2={groundY - hMaxPx}
            stroke="var(--accent)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <text x={svgWidth - 10} y={groundY - hMaxPx - 5} textAnchor="end" fill="var(--accent)">
            ν₂,max
          </text>

          {[
            {
              key: "absorbed",
              x: 60,
              height: h1Px,
              fill: band1.color,
              value: `${fixed(budget.e1Ev, 3)} eV`,
              valueFill: "var(--ink)",
              name: "absorbed hν₁",
            },
            {
              key: "emitted",
              x: 150,
              height: h2Px,
              fill: band2.color,
              value: `${fixed(budget.e2Ev, 3)} eV`,
              valueFill: "var(--ink)",
              name: "emitted hν₂",
            },
          ].map((bar) => (
            <g key={bar.key}>
              <rect
                x={bar.x - barWidth / 2}
                y={groundY - bar.height}
                width={barWidth}
                height={bar.height}
                fill={bar.fill}
                rx="4"
                opacity="0.9"
              />
              <text
                x={bar.x}
                y={groundY - bar.height - 8}
                textAnchor="middle"
                fontWeight="bold"
                fill={bar.valueFill}
              >
                {bar.value}
              </text>
              <text x={bar.x} y={groundY + 17} textAnchor="middle" fill="var(--ink)">
                {bar.name}
              </text>
            </g>
          ))}

          {/* Other channels (heat), or the energy deficit */}
          <g>
            {budget.allowed ? (
              <rect
                x={240 - barWidth / 2}
                y={groundY - hOtherPx}
                width={barWidth}
                height={Math.max(2, hOtherPx)}
                fill="#10b981"
                rx="4"
                opacity="0.85"
              />
            ) : (
              <rect
                x={240 - barWidth / 2}
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
              x="240"
              y={groundY - (budget.allowed ? hOtherPx : hDeficitPx) - 8}
              textAnchor="middle"
              fontWeight="bold"
              fill={budget.allowed ? "var(--plot)" : "var(--accent)"}
            >
              {budget.allowed
                ? `+${fixed(budget.eOtherEv, 3)} eV`
                : `−${fixed(budget.energyDeficitEv, 3)} eV`}
            </text>
            <text x="240" y={groundY + 17} textAnchor="middle" fill="var(--ink)">
              {budget.allowed ? "heat" : "deficit"}
            </text>
          </g>
        </svg>
        <p className="fine" style={{ margin: "0.6rem 0 0" }}>
          Absorbed: {nu1} THz, {band1.wavelengthNm} nm ({plainBand(band1.name)}). Emitted: {nu2}{" "}
          THz, {band2.wavelengthNm} nm ({plainBand(band2.name)}).{" "}
          {budget.allowed
            ? "Heat: the rest of the absorbed energy, dissipated in the medium."
            : "Energy deficit: the emitted quantum would carry more energy than the absorbed quanta supply."}{" "}
          The dashed line is the largest emitted quantum allowed, ν₂,max ={" "}
          {(budget.nu2MaxHz / 1e12).toFixed(1)} THz.
        </p>

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
            fontSize: "var(--type-fine)",
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
          <h3
            style={{
              fontSize: "var(--type-small)",
              color: "var(--ink)",
              fontWeight: 600,
              margin: 0,
            }}
          >
            Spectral bands and false-colour legend
          </h3>
          <span className="fine" style={{ margin: 0, fontSize: "var(--type-fine)" }}>
            Wavelength λ = c / ν
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
            gap: "0.5rem",
            fontSize: "var(--type-fine)",
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
              <div style={{ fontWeight: 600 }}>Visible spectrum</div>
              <div
                className="fine"
                style={{
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
      {rates.status === "not-applicable" && rates.reason && (
        <p className="fine" data-rates-status="not-applicable">
          No emission rates: {rates.reason}
        </p>
      )}
      {rates.status === "value" && (
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: "0.75rem",
            padding: "1rem",
            background: "var(--wash)",
            fontSize: "var(--type-fine)",
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
            <span style={{ fontWeight: 600, color: "var(--ink)" }}>
              Weak-illumination photon rates (zero threshold)
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
              <span className="fine" style={{ display: "block" }}>
                Absorbed rate Ṅ₁:
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontWeight: "bold",
                  color: "var(--ink)",
                }}
              >
                <Sci value={rates.absorbedRatePerSecond} digits={4} /> s⁻¹
              </span>
            </div>
            <div>
              <span className="fine" style={{ display: "block" }}>
                Emitted rate Ṅ₂:
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontWeight: "bold",
                  color: "var(--accent)",
                }}
              >
                <Sci value={rates.emittedRatePerSecond} digits={4} /> s⁻¹
              </span>
            </div>
            <div>
              <span className="fine" style={{ display: "block" }}>
                Emitted power:
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontWeight: "bold",
                  color: "var(--ink)",
                }}
              >
                {fixed(rates.emittedPowerWatts * 1e6, 4)} μW
              </span>
            </div>
            <div>
              <span className="fine" style={{ display: "block" }}>
                {rates.dissipatedHeatWatts < 0 ? "Heat drawn from the body:" : "Heat dissipated:"}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontWeight: "bold",
                  color: "var(--ink)",
                }}
              >
                {fixed(Math.abs(rates.dissipatedHeatWatts) * 1e6, 4)} μW
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
