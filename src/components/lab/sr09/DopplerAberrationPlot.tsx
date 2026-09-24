import { FramePair } from "../FramePair.tsx";
import { fixed, toFixedReadable } from "../presentation.ts";
import { Sci } from "../Sci.tsx";

export interface DopplerAberrationPlotProps {
  beta: number;
  gamma?: number | undefined;
  thetaStationaryDeg: number;
  thetaMovingDeg: number;
  frequencyStationaryTHz: number;
  frequencyMovingTHz: number;
  dopplerFactor: number;
  cosThetaMoving: number;
  sinThetaMoving?: number | undefined;
  detectorCrossings?: number | undefined;
  earthOrbitAberrationFormatted: string;
  secondOrderShift: number;
  recedingFactor?: number | undefined;
  approachingFactor?: number | undefined;
}

export function DopplerAberrationPlot({
  beta,
  thetaStationaryDeg,
  thetaMovingDeg,
  frequencyStationaryTHz,
  frequencyMovingTHz,
  dopplerFactor,
  cosThetaMoving,
  earthOrbitAberrationFormatted,
  secondOrderShift,
}: DopplerAberrationPlotProps) {
  const thetaRadK = (thetaStationaryDeg * Math.PI) / 180;
  const thetaRad_k = (thetaMovingDeg * Math.PI) / 180;

  // Visual layout
  // Both frames share one 800 × 400 coordinate space, K drawn around x = 200 and k
  // around x = 600; each FramePair panel's viewBox crops its own half.
  const cx1 = 200;
  // Lower than it was (200), and each panel 20 units taller, to make room for a two-line subtitle.
  // At the panels' text size (15.84 viewBox units, a 20.4-unit line box) the one-line subtitle's
  // baseline sat 12 units above the y-axis letter, which it overlapped in both panels.
  const cy = 214;
  const cx2 = 600;
  const radius = 120;

  // Ray vectors
  const rayLen = 100;
  const ray1X = cx1 + rayLen * Math.cos(thetaRadK);
  const ray1Y = cy - rayLen * Math.sin(thetaRadK);
  const ray2X = cx2 + rayLen * Math.cos(thetaRad_k);
  const ray2Y = cy - rayLen * Math.sin(thetaRad_k);

  // Wavefront lines in K (perpendicular to ray)
  const numWavefronts = 5;
  const spacingK = 18;
  const spacing_k = Math.max(6, Math.min(36, spacingK / (dopplerFactor || 1)));

  const waveLinesK = Array.from({ length: numWavefronts }, (_, i) => {
    const offset = (i - 2) * spacingK;
    const px = cx1 + offset * Math.cos(thetaRadK);
    const py = cy - offset * Math.sin(thetaRadK);
    const perpLen = 60;
    const x1 = px - perpLen * Math.sin(thetaRadK);
    const y1 = py - perpLen * Math.cos(thetaRadK);
    const x2 = px + perpLen * Math.sin(thetaRadK);
    const y2 = py + perpLen * Math.cos(thetaRadK);
    return { x1, y1, x2, y2 };
  });

  const waveLines_k = Array.from({ length: numWavefronts }, (_, i) => {
    const offset = (i - 2) * spacing_k;
    const px = cx2 + offset * Math.cos(thetaRad_k);
    const py = cy - offset * Math.sin(thetaRad_k);
    const perpLen = 60;
    const x1 = px - perpLen * Math.sin(thetaRad_k);
    const y1 = py - perpLen * Math.cos(thetaRad_k);
    const x2 = px + perpLen * Math.sin(thetaRad_k);
    const y2 = py + perpLen * Math.cos(thetaRad_k);
    return { x1, y1, x2, y2 };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div
        style={{
          borderRadius: "0.5rem",
          border: "1px solid var(--line)",
          background: "var(--panel)",
          padding: "1rem",
        }}
      >
        <FramePair>
          <svg
            viewBox="10 20 370 340"
            role="img"
            aria-label={`Stationary frame K: the source ray at theta = ${toFixedReadable(thetaStationaryDeg, 1)} degrees, frequency ${toFixedReadable(frequencyStationaryTHz, 1)} THz`}
            style={{ width: "100%", height: "auto", userSelect: "none" }}
          >
            <title>Stationary frame K</title>
            <defs>
              <marker
                id="arrow-k"
                viewBox="0 0 10 10"
                refX={5}
                refY={5}
                markerWidth={6}
                markerHeight={6}
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--plot)" />
              </marker>
            </defs>
            {/* Frame K Left Pane */}
            <g>
              <text x={40} y={40} fontSize="14" fontWeight="600" fill="var(--ink)">
                Stationary Frame K
              </text>
              <text x={40} y={61} fontSize="12" fill="var(--muted)">
                Source frame
              </text>
              <text x={40} y={82} fontSize="12" fill="var(--muted)">
                ν = {toFixedReadable(frequencyStationaryTHz, 1)} THz · θ ={" "}
                {toFixedReadable(thetaStationaryDeg, 1)}°
              </text>

              {/* Coordinate axes */}
              <line
                x1={cx1 - radius}
                y1={cy}
                x2={cx1 + radius}
                y2={cy}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <line
                x1={cx1}
                y1={cy - radius}
                x2={cx1}
                y2={cy + radius}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <text x={cx1 + radius + 8} y={cy + 4} fontSize="10" fill="var(--muted)">
                x
              </text>
              <text x={cx1 + 8} y={cy - radius + 16} fontSize="10" fill="var(--muted)">
                y
              </text>

              {/* Wavefronts */}
              {waveLinesK.map((line) => (
                <line
                  key={`k-wave-${line.x1.toFixed(1)}-${line.y1.toFixed(1)}`}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke="var(--plot)"
                  strokeWidth={1.5}
                  strokeOpacity={0.6}
                />
              ))}

              {/* Propagation ray */}
              <line
                x1={cx1}
                y1={cy}
                x2={ray1X}
                y2={ray1Y}
                stroke="var(--plot)"
                strokeWidth={2.5}
                markerEnd="url(#arrow-k)"
              />
              <circle cx={cx1} cy={cy} r={3} fill="var(--plot)" />

              {/* Angle arc */}
              <path
                d={`M ${cx1 + 30} ${cy} A 30 30 0 ${thetaRadK > Math.PI ? 1 : 0} 0 ${cx1 + 30 * Math.cos(thetaRadK)} ${cy - 30 * Math.sin(thetaRadK)}`}
                fill="none"
                stroke="var(--plot)"
                strokeWidth={1.2}
                strokeDasharray="2 2"
              />
              {/* The angle's value is read in the panel's lower corner: beside the arc it sat among the
                  wavefronts, which turn with θ, so no fixed spot near the ray stays clear. */}
              <text
                x={cx1 + 40}
                y={cy + radius - 14}
                fontSize="12"
                fontFamily="var(--font-mono, monospace)"
                fontWeight="500"
                fill="var(--plot)"
              >
                θ = {toFixedReadable(thetaStationaryDeg, 1)}°
              </text>
            </g>
          </svg>
          <svg
            viewBox="420 20 370 340"
            role="img"
            aria-label={`Moving frame k at beta = ${fixed(beta, 3)}: the same ray at theta' = ${toFixedReadable(thetaMovingDeg, 1)} degrees, frequency ${toFixedReadable(frequencyMovingTHz, 1)} THz`}
            style={{ width: "100%", height: "auto", userSelect: "none" }}
          >
            <title>Moving frame k</title>
            <defs>
              <marker
                id="arrow-prime"
                viewBox="0 0 10 10"
                refX={5}
                refY={5}
                markerWidth={6}
                markerHeight={6}
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
              </marker>
              <marker
                id="arrow-boost"
                viewBox="0 0 10 10"
                refX={5}
                refY={5}
                markerWidth={6}
                markerHeight={6}
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
              </marker>
            </defs>
            {/* Frame k Right Pane */}
            <g>
              <text x={cx2 - 140} y={40} fontSize="14" fontWeight="600" fill="var(--ink)">
                Moving Frame k (β = {fixed(beta, 3)}c)
              </text>
              <text x={cx2 - 140} y={61} fontSize="12" fill="var(--muted)">
                Observer frame
              </text>
              <text x={cx2 - 140} y={82} fontSize="12" fill="var(--muted)">
                ν′ = {toFixedReadable(frequencyMovingTHz, 1)} THz · θ′ ={" "}
                {toFixedReadable(thetaMovingDeg, 1)}°
              </text>

              {/* Coordinate axes */}
              <line
                x1={cx2 - radius}
                y1={cy}
                x2={cx2 + radius}
                y2={cy}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <line
                x1={cx2}
                y1={cy - radius}
                x2={cx2}
                y2={cy + radius}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <text x={cx2 + radius + 8} y={cy + 4} fontSize="10" fill="var(--muted)">
                x′
              </text>
              <text x={cx2 + 8} y={cy - radius + 16} fontSize="10" fill="var(--muted)">
                y′
              </text>

              {/* Boost vector arrow */}
              <g transform={`translate(${cx2 - 60}, ${cy + radius - 20})`}>
                <line
                  x1={0}
                  y1={0}
                  x2={50}
                  y2={0}
                  stroke="var(--accent)"
                  strokeWidth={2}
                  markerEnd="url(#arrow-boost)"
                />
                <text
                  x={25}
                  y={-9}
                  fontSize="10"
                  fontFamily="var(--font-mono, monospace)"
                  fill="var(--accent)"
                  textAnchor="middle"
                >
                  v = {beta.toFixed(2)}c
                </text>
              </g>

              {/* Transformed Wavefronts */}
              {waveLines_k.map((line) => (
                <line
                  key={`k-prime-wave-${line.x1.toFixed(1)}-${line.y1.toFixed(1)}`}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke={dopplerFactor > 1 ? "var(--accent)" : "var(--plot)"}
                  strokeWidth={1.5}
                  strokeOpacity={0.7}
                />
              ))}

              {/* Transformed Propagation ray */}
              <line
                x1={cx2}
                y1={cy}
                x2={ray2X}
                y2={ray2Y}
                stroke="var(--accent)"
                strokeWidth={2.5}
                markerEnd="url(#arrow-prime)"
              />
              <circle cx={cx2} cy={cy} r={3} fill="var(--accent)" />

              {/* Transformed Angle arc */}
              <path
                d={`M ${cx2 + 30} ${cy} A 30 30 0 ${thetaRad_k > Math.PI ? 1 : 0} 0 ${cx2 + 30 * Math.cos(thetaRad_k)} ${cy - 30 * Math.sin(thetaRad_k)}`}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={1.2}
                strokeDasharray="2 2"
              />
              <text
                x={cx2 + 40}
                y={cy + radius - 14}
                fontSize="12"
                fontFamily="var(--font-mono, monospace)"
                fontWeight="500"
                fill="var(--accent)"
              >
                θ′ = {toFixedReadable(thetaMovingDeg, 1)}°
              </text>
            </g>
          </svg>
        </FramePair>
      </div>

      {/* Numerical Invariants and Diagnostics Badges */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))",
          gap: "0.75rem",
          fontSize: "var(--type-fine)",
        }}
      >
        <div
          style={{
            padding: "0.625rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--line)",
            background: "var(--wash)",
          }}
        >
          <div className="fine">Doppler factor ν′/ν</div>
          <div
            style={{
              fontSize: "0.875rem",
              fontFamily: "var(--font-mono, monospace)",
              fontWeight: 600,
              marginTop: "0.125rem",
              color: "var(--accent)",
            }}
          >
            {fixed(dopplerFactor, 6)}
          </div>
          <div className="fine" style={{ marginTop: "0.125rem" }}>
            γ(1 − β cos θ)
          </div>
        </div>

        <div
          style={{
            padding: "0.625rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--line)",
            background: "var(--wash)",
          }}
        >
          <div className="fine">Aberration cos θ′</div>
          <div
            style={{
              fontSize: "0.875rem",
              fontFamily: "var(--font-mono, monospace)",
              fontWeight: 600,
              marginTop: "0.125rem",
              color: "var(--ink)",
            }}
          >
            {fixed(cosThetaMoving, 6)}
          </div>
          <div className="fine" style={{ marginTop: "0.125rem" }}>
            (cos θ − β) / (1 − β cos θ)
          </div>
        </div>

        {earthOrbitAberrationFormatted ? (
          <div
            style={{
              padding: "0.625rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--line)",
              background: "var(--wash)",
            }}
          >
            <div className="fine">Earth orbit aberration</div>
            <div
              style={{
                fontSize: "0.875rem",
                fontFamily: "var(--font-mono, monospace)",
                fontWeight: 600,
                marginTop: "0.125rem",
                color: "var(--accent)",
              }}
            >
              {earthOrbitAberrationFormatted}
            </div>
            <div className="fine" style={{ marginTop: "0.125rem" }}>
              Modern calculation at 29.8 km/s
            </div>
          </div>
        ) : null}

        {Number.isFinite(secondOrderShift) ? (
          <div
            style={{
              padding: "0.625rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--line)",
              background: "var(--wash)",
            }}
          >
            <div className="fine">Second-order shift γ − 1</div>
            <div
              style={{
                fontSize: "0.875rem",
                fontFamily: "var(--font-mono, monospace)",
                fontWeight: 600,
                marginTop: "0.125rem",
                color: "var(--ink)",
              }}
            >
              <Sci value={secondOrderShift} digits={4} />
            </div>
            <div className="fine" style={{ marginTop: "0.125rem" }}>
              Measured by Ives and Stilwell in 1938, later evidence
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
