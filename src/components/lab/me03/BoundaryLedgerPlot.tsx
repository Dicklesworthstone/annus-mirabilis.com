import type { Me03Parameters } from "../../../experiments/me03/definition.ts";
import type { Me03Snapshot } from "../../../experiments/me03/session.ts";
import { SciSvg } from "../Sci.tsx";

export interface BoundaryLedgerPlotProps {
  parameters: Me03Parameters;
  evaluation: Me03Snapshot;
  clipId: string;
}

function toScalar(
  res: { status: string; value?: number | Float64Array } | undefined,
  fallback: number,
): number {
  if (res && res.status === "value" && typeof res.value === "number") return res.value;
  return fallback;
}

const SUPERSCRIPT: Readonly<Record<string, string>> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

/** The reference strings spell a power with a caret ("10^-10", "c^2"); a reader reads 10⁻¹⁰. */
function powers(text: string): string {
  return text.replace(/\^(-?\d+)/g, (_, exponent: string) =>
    [...exponent].map((ch) => SUPERSCRIPT[ch] ?? ch).join(""),
  );
}

/** "4.259 × 10^9 kg/s (4.3 million tonnes/s)" as a value line and the note after it. */
export function splitFigure(text: string): { value: string; note: string } {
  const match = /^(.*\S)\s+(\([^()]*\))$/.exec(text);
  return match
    ? { value: powers(match[1] ?? text), note: powers(match[2] ?? "") }
    : { value: powers(text), note: "" };
}

export function BoundaryLedgerPlot({ parameters, evaluation, clipId }: BoundaryLedgerPlotProps) {
  const { boundary, disposition, emittedEnergy, mode, pulseSystem, notation } = parameters;
  const isModern = notation === "modern";
  const isFourMomentum = mode === "four-momentum";
  const card = evaluation.card;
  const massChange = splitFigure(card.massChangeFormatted);

  const energyDelta = toScalar(evaluation.energyChange, -emittedEnergy);
  const massDelta =
    evaluation.massChange.status === "value" ? (evaluation.massChange.value as number) : null;
  const invMass = toScalar(evaluation.invariantMass, 0);

  // SVG dimensions
  const width = 640;
  const height = 300;

  return (
    <div
      className="boundary-ledger-svg-wrap"
      data-boundary={boundary}
      data-disposition={disposition}
      data-mode={mode}
      data-card-id={card.id}
      data-instrument-id="me-03"
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="boundary-ledger-canvas"
        role="img"
        aria-label={`System boundary energy ledger: boundary=${boundary}, disposition=${disposition}, mode=${mode}`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="10" y="10" width={width - 20} height={height - 20} rx="8" />
          </clipPath>
          <linearGradient id={`${clipId}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--paper)" />
            <stop offset="100%" stopColor="var(--wash)" />
          </linearGradient>
          <marker
            id="arrow-energy"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ea580c" />
          </marker>
          <marker
            id="arrow-pulse1"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#2563eb" />
          </marker>
        </defs>

        {/* Card Background */}
        <rect
          x="10"
          y="10"
          width={width - 20}
          height={height - 20}
          rx="8"
          fill={`url(#${clipId}-grad)`}
          stroke="var(--line)"
          strokeWidth="1.5"
        />

        {/* Left Pane: Visual Boundary Diagrams */}
        <g className="boundary-diagram" transform="translate(20, 20)">
          <text x="5" y="15" fontSize="13" fontWeight="bold" fill="currentColor">
            {isFourMomentum
              ? "Four-Momentum Invariant Mass Geometry"
              : "Thermodynamic Boundary & Flux"}
          </text>
          <text x="5" y="32" fontSize="11" fill="var(--muted)">
            {isFourMomentum
              ? `System: ${pulseSystem} (m = √[P·P] = ${invMass === 0 ? "0" : isModern ? "L/c²" : "L/V²"})`
              : `Selected Boundary: ${boundary} (${disposition})`}
          </text>

          {!isFourMomentum ? (
            <g transform="translate(10, 45)">
              {/* Outer Enclosing System Boundary Box */}
              <rect
                x="10"
                y="10"
                width="260"
                height="190"
                rx="10"
                fill={boundary === "combined-isolated-system" ? "var(--wash)" : "none"}
                stroke={boundary === "combined-isolated-system" ? "var(--accent)" : "var(--line)"}
                strokeWidth={boundary === "combined-isolated-system" ? "2.5" : "1.5"}
                strokeDasharray={boundary === "combined-isolated-system" ? "none" : "6 4"}
              />
              <text
                x="20"
                y="30"
                fontSize="11"
                fontWeight={boundary === "combined-isolated-system" ? "bold" : "normal"}
                fill={boundary === "combined-isolated-system" ? "var(--accent)" : "var(--muted)"}
              >
                Combined Isolated System
              </text>

              {/* Emitting Body Boundary */}
              <rect
                x="30"
                y="60"
                width="100"
                height="100"
                rx="8"
                fill={boundary === "body-alone" ? "var(--wash)" : "var(--panel)"}
                stroke={boundary === "body-alone" ? "var(--accent)" : "var(--line)"}
                strokeWidth={boundary === "body-alone" ? "2.5" : "1.5"}
              />
              <text
                x="80"
                y="105"
                textAnchor="middle"
                fontSize="12"
                fontWeight="bold"
                fill="var(--ink)"
              >
                Source Body
              </text>
              <text x="80" y="125" textAnchor="middle" fontSize="10" fill="var(--muted)">
                Δm = -L/c²
              </text>

              {/* Radiation Channel / Arrow */}
              {disposition === "escapes" ? (
                <g className="radiation-escapes">
                  <line
                    x1="130"
                    y1="110"
                    x2="285"
                    y2="110"
                    stroke="#ea580c"
                    strokeWidth="3"
                    markerEnd="url(#arrow-energy)"
                  />
                  <text
                    x="210"
                    y="100"
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="bold"
                    fill="#ea580c"
                  >
                    Radiation Escapes (+L)
                  </text>
                </g>
              ) : (
                <g className="radiation-retained">
                  <path
                    d="M 130 110 Q 200 70 210 130"
                    fill="none"
                    stroke="#ea580c"
                    strokeWidth="2.5"
                    markerEnd="url(#arrow-energy)"
                  />
                  <rect
                    x="180"
                    y="130"
                    width="70"
                    height="40"
                    rx="4"
                    fill="var(--wash)"
                    stroke="var(--line)"
                  />
                  <text
                    x="215"
                    y="155"
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--ink)"
                    fontWeight="bold"
                  >
                    Absorber
                  </text>
                  <text
                    x="215"
                    y="100"
                    textAnchor="middle"
                    fontSize="10"
                    fill="#ea580c"
                    fontWeight="bold"
                  >
                    Retained Inside
                  </text>
                </g>
              )}
            </g>
          ) : (
            <g transform="translate(20, 50)">
              {/* Four-Momentum Visual */}
              <rect
                x="0"
                y="0"
                width="260"
                height="180"
                rx="8"
                fill="var(--wash)"
                stroke="var(--line)"
                strokeWidth="1"
              />
              {pulseSystem === "single-pulse" && (
                <g transform="translate(130, 90)">
                  <line
                    x1="0"
                    y1="0"
                    x2="80"
                    y2="0"
                    stroke="#2563eb"
                    strokeWidth="3"
                    markerEnd="url(#arrow-pulse1)"
                  />
                  <circle cx="0" cy="0" r="6" fill="#2563eb" />
                  <text
                    x="0"
                    y="-15"
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="bold"
                    fill="var(--ink)"
                  >
                    Single Light Pulse: P = (L/c, L/c, 0, 0)
                  </text>
                  <text
                    x="0"
                    y="25"
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--ink)"
                    fontWeight="bold"
                  >
                    P·P = 0 ⟹ Invariant Mass m = 0
                  </text>
                </g>
              )}
              {pulseSystem === "two-collinear" && (
                <g transform="translate(130, 90)">
                  <line
                    x1="-30"
                    y1="-10"
                    x2="60"
                    y2="-10"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                    markerEnd="url(#arrow-pulse1)"
                  />
                  <line
                    x1="-30"
                    y1="10"
                    x2="60"
                    y2="10"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                    markerEnd="url(#arrow-pulse1)"
                  />
                  <text
                    x="0"
                    y="-25"
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="bold"
                    fill="var(--ink)"
                  >
                    Two Collinear Pulses: P = (L/c, L/c, 0, 0)
                  </text>
                  <text
                    x="0"
                    y="35"
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--ink)"
                    fontWeight="bold"
                  >
                    P·P = 0 ⟹ Invariant Mass m = 0
                  </text>
                </g>
              )}
              {pulseSystem === "two-opposite" && (
                <g transform="translate(130, 90)">
                  <line
                    x1="0"
                    y1="0"
                    x2="70"
                    y2="0"
                    stroke="#2563eb"
                    strokeWidth="3"
                    markerEnd="url(#arrow-pulse1)"
                  />
                  <line
                    x1="0"
                    y1="0"
                    x2="-70"
                    y2="0"
                    stroke="#ea580c"
                    strokeWidth="3"
                    markerEnd="url(#arrow-energy)"
                  />
                  <circle cx="0" cy="0" r="7" fill="var(--ink)" />
                  <text
                    x="0"
                    y="-20"
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="bold"
                    fill="var(--ink)"
                  >
                    Two Opposite Pulses: P = (L/c, 0, 0, 0)
                  </text>
                  <text
                    x="0"
                    y="30"
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--ink)"
                    fontWeight="bold"
                  >
                    P·P = (L/c)² ⟹ Invariant Mass m = {isModern ? "L/c²" : "L/V²"}
                  </text>
                </g>
              )}
            </g>
          )}
        </g>

        {/* Right Pane: Ledger Accounts & Selected Card 7 Facts */}
        <g className="ledger-card-summary" transform="translate(330, 20)">
          <rect
            x="0"
            y="0"
            width="280"
            height="250"
            rx="6"
            fill="var(--panel)"
            stroke="var(--line)"
            strokeWidth="1"
          />

          <text x="12" y="20" fontSize="12" fontWeight="bold" fill="currentColor">
            {isFourMomentum ? "Four-Momentum Summary" : "Boundary Energy Ledger"}
          </text>

          {/* Active Ledger Readouts */}
          <g transform="translate(12, 32)">
            <text x="0" y="10" fontSize="11" fill="var(--muted)">
              Active Boundary:{" "}
              <tspan fontWeight="bold" fill="var(--ink)">
                {boundary}
              </tspan>
            </text>
            <text x="0" y="26" fontSize="11" fill="var(--muted)">
              Energy change ΔE:{" "}
              <tspan fontWeight="bold" fill="var(--ink)">
                {energyDelta > 0 ? `+${energyDelta}` : `${energyDelta}`} J
              </tspan>
            </text>
            <text x="0" y="42" fontSize="11" fill="var(--muted)">
              Mass change Δm:{" "}
              <tspan fontWeight="bold" fill="var(--accent)">
                {massDelta !== null ? (
                  massDelta === 0 ? (
                    "0 (unchanged)"
                  ) : (
                    <>
                      <SciSvg value={massDelta} digits={4} /> kg
                    </>
                  )
                ) : (
                  "Not assigned (1905)"
                )}
              </tspan>
            </text>
          </g>

          <line x1="12" y1="90" x2="268" y2="90" stroke="var(--line)" strokeWidth="1" />

          {/* The selected card's name and its mass change, each value on its own line. The pane is
              256 units wide inside; "Case Study: The Sun (Radiated Luminosity)" and every card's
              mass change ran past it, cut off at the drawing's edge. The card's energy figure,
              whether matter crosses, and "closed but not isolated" are facts 3, 6 and 7 in the
              panel under the drawing, so they are not repeated here. */}
          <g transform="translate(12, 100)">
            <text x="0" y="12" fill="var(--muted)">
              Case study
            </text>
            <text x="0" y="30" fontWeight="bold" fill="var(--ink)">
              {card.label}
            </text>
            <text x="0" y="54" fill="var(--muted)">
              Mass change
            </text>
            <text x="0" y="72" fontWeight="bold" fill="var(--accent)">
              {massChange.value}
            </text>
            {massChange.note && (
              <text x="0" y="90" fill="var(--ink)">
                {massChange.note}
              </text>
            )}
          </g>
        </g>
      </svg>
    </div>
  );
}
