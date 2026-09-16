import type { Me01Parameters } from "../../../experiments/me01/definition.ts";
import type { Me01Snapshot } from "../../../experiments/me01/session.ts";

export interface TwoLedgersPlotProps {
  parameters: Me01Parameters;
  evaluation: Me01Snapshot;
  clipId: string;
}

function toScalar(
  res: { status: string; value?: number | Float64Array } | undefined,
  fallback: number,
): number {
  if (res && res.status === "value" && typeof res.value === "number") return res.value;
  return fallback;
}

export function TwoLedgersPlot({ parameters, evaluation, clipId }: TwoLedgersPlotProps) {
  const { frameSpeed, emittedEnergyRestFrame, emissionAngle, notation, premise, step } = parameters;
  const isModern = notation === "modern";
  const isRelaxed = premise === "relaxed";

  const defaultGamma = 1 / Math.sqrt(Math.max(0.01, 1 - frameSpeed * frameSpeed));
  const sumVal = toScalar(evaluation.pulseSumMoving, defaultGamma * emittedEnergyRestFrame);
  const gammaVal = emittedEnergyRestFrame > 0 ? sumVal / emittedEnergyRestFrame : defaultGamma;
  const p1Val = toScalar(evaluation.pulse1Moving, 0.5 * gammaVal * emittedEnergyRestFrame);
  const p2Val = toScalar(evaluation.pulse2Moving, 0.5 * gammaVal * emittedEnergyRestFrame);
  const subVal = toScalar(
    evaluation.subtractionDifference,
    (gammaVal - 1) * emittedEnergyRestFrame,
  );

  // Visual layout
  const cx = 180;
  const cy = 130;
  const rad = (emissionAngle * Math.PI) / 180;

  // Arrow lengths scaled to energy
  const baseLen = 70;
  const len1 = Math.max(20, Math.min(130, baseLen * (p1Val / 0.5)));
  const len2 = Math.max(20, Math.min(130, baseLen * (p2Val / 0.5)));

  const x1 = cx + len1 * Math.cos(rad);
  const y1 = cy - len1 * Math.sin(rad);
  const x2 = cx - len2 * Math.cos(rad);
  const y2 = cy + len2 * Math.sin(rad);

  const gammaSymbol = isModern ? "γ" : "1/√(1 - v²/V²)";

  return (
    <div
      className="two-ledgers-svg-wrap"
      data-step={step}
      data-premise={premise}
      data-notation={notation}
      data-instrument-id="me-01"
    >
      <svg
        viewBox="0 0 620 280"
        className="two-ledgers-canvas"
        role="img"
        aria-label={`Two ledgers and opposite pulses diagram: speed beta = ${frameSpeed}, angle phi = ${emissionAngle} degrees`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="10" y="10" width="600" height="260" rx="8" />
          </clipPath>
          <linearGradient id={`${clipId}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-bg-subtle, #fbfaf7)" />
            <stop offset="100%" stopColor="var(--color-bg-inset, #f0ede6)" />
          </linearGradient>
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
          <marker
            id="arrow-pulse2"
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
            id="arrow-velocity"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 2 L 8 5 L 0 8 z" fill="#059669" />
          </marker>
        </defs>

        {/* Card background */}
        <rect
          x="10"
          y="10"
          width="600"
          height="260"
          rx="8"
          fill={`url(#${clipId}-grad)`}
          stroke="var(--color-border, #d1cfc7)"
          strokeWidth="1.5"
        />

        {/* Left pane: Physical emission in moving frame */}
        <g className="emission-geometry">
          <text x="25" y="32" fontSize="13" fontWeight="bold" fill="currentColor">
            Moving Observer Frame (v = {frameSpeed} c)
          </text>
          <text x="25" y="48" fontSize="11" fill="var(--color-text-muted, #666)">
            Angle φ = {emissionAngle}° relative to velocity vector
          </text>

          {/* Reference line / axis of motion */}
          <line
            x1="40"
            y1={cy}
            x2="320"
            y2={cy}
            stroke="var(--color-border-subtle, #cbd5e1)"
            strokeDasharray="4 4"
            strokeWidth="1"
          />

          {/* Observer velocity vector */}
          {Math.abs(frameSpeed) > 0 && (
            <g className="velocity-vector">
              <line
                x1={cx}
                y1={cy + 45}
                x2={cx + (frameSpeed > 0 ? 60 : -60)}
                y2={cy + 45}
                stroke="#059669"
                strokeWidth="2.5"
                markerEnd="url(#arrow-velocity)"
              />
              <text
                x={cx + (frameSpeed > 0 ? 30 : -30)}
                y={cy + 62}
                textAnchor="middle"
                fontSize="11"
                fontWeight="bold"
                fill="#059669"
              >
                v = {frameSpeed} c
              </text>
            </g>
          )}

          {/* Pulse 1 arrow */}
          <line
            x1={cx}
            y1={cy}
            x2={x1}
            y2={y1}
            stroke="#2563eb"
            strokeWidth="3.5"
            markerEnd="url(#arrow-pulse1)"
          />
          {/* Pulse 2 arrow */}
          <line
            x1={cx}
            y1={cy}
            x2={x2}
            y2={y2}
            stroke="#ea580c"
            strokeWidth="3.5"
            markerEnd="url(#arrow-pulse2)"
          />

          {/* Emitting body at rest in its own frame */}
          <circle cx={cx} cy={cy} r="16" fill="#334155" stroke="#1e293b" strokeWidth="2" />
          <text
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            fontSize="10"
            fill="#ffffff"
            fontWeight="bold"
          >
            Body
          </text>

          {/* Labels for pulses */}
          <text
            x={x1 + (Math.cos(rad) >= 0 ? 8 : -8)}
            y={y1 - 6}
            textAnchor={Math.cos(rad) >= 0 ? "start" : "end"}
            fontSize="11"
            fontWeight="bold"
            fill="#2563eb"
          >
            Pulse 1: {p1Val.toFixed(4)} L
          </text>
          <text
            x={x2 + (Math.cos(rad) <= 0 ? 8 : -8)}
            y={y2 + 14}
            textAnchor={Math.cos(rad) <= 0 ? "start" : "end"}
            fontSize="11"
            fontWeight="bold"
            fill="#ea580c"
          >
            Pulse 2: {p2Val.toFixed(4)} L
          </text>
        </g>

        {/* Right pane: Side-by-side ledgers & Subtraction summary */}
        <g className="ledger-summary" transform="translate(340, 20)">
          <rect
            x="0"
            y="0"
            width="255"
            height="235"
            rx="6"
            fill="var(--color-bg-card, #ffffff)"
            stroke="var(--color-border, #e2e8f0)"
            strokeWidth="1"
          />

          <text x="12" y="22" fontSize="12" fontWeight="bold" fill="currentColor">
            Energy Balance Accounts
          </text>

          {/* Rest frame ledger */}
          <g transform="translate(12, 35)">
            <text x="0" y="10" fontSize="11" fontWeight="bold" fill="#475569">
              Rest Frame (K₀):
            </text>
            <text x="0" y="26" fontSize="11" fill="currentColor">
              Light emitted = L/2 + L/2 = <tspan fontWeight="bold">1.0000 L</tspan>
            </text>
            <text x="0" y="40" fontSize="11" fill="currentColor">
              Balance: <tspan fontFamily="monospace">E₀ - E₁ = L</tspan>
            </text>
          </g>

          {/* Moving frame ledger */}
          <g transform="translate(12, 90)">
            <text x="0" y="10" fontSize="11" fontWeight="bold" fill="#475569">
              Moving Frame (k, speed v):
            </text>
            <text x="0" y="26" fontSize="11" fill="currentColor">
              Light emitted = <tspan fontWeight="bold">{sumVal.toFixed(4)} L</tspan> (={" "}
              {gammaSymbol}·L)
            </text>
            <text x="0" y="40" fontSize="11" fill="currentColor">
              Balance: <tspan fontFamily="monospace">H₀ - H₁ = {gammaSymbol}·L</tspan>
            </text>
          </g>

          {/* Divider */}
          <line x1="12" y1="145" x2="243" y2="145" stroke="#cbd5e1" strokeWidth="1" />

          {/* The Subtraction Move */}
          <g transform="translate(12, 155)">
            <text x="0" y="12" fontSize="11" fontWeight="bold" fill="#0f172a">
              The Subtraction Move:
            </text>
            <text x="0" y="28" fontSize="11" fill="currentColor" fontFamily="monospace">
              (H₀ - E₀) - (H₁ - E₁) = L({gammaSymbol} - 1)
            </text>
            <text x="0" y="44" fontSize="11" fill="currentColor">
              Drop in energy of motion:{" "}
              <tspan fontWeight="bold" fill={isRelaxed ? "#b45309" : "#059669"}>
                {isRelaxed ? "Underdetermined" : `${subVal.toFixed(4)} L`}
              </tspan>
            </text>
            <text x="0" y="58" fontSize="10" fill="var(--color-text-muted, #64748b)">
              {isRelaxed
                ? "Premise relaxed: C ≠ C' leaves ΔK unknown."
                : "Internal rest energies cancel out."}
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}
