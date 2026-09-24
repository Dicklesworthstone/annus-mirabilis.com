import { FramePair } from "../FramePair.tsx";
import { fixed } from "../presentation.ts";

export interface LightComplexPlotProps {
  beta: number;
  gamma: number;
  phiStationaryDeg: number;
  phiMovingDeg: number;
  energyStationaryJ: number;
  energyMovingJ: number;
  volumeStationaryM3: number;
  volumeMovingM3: number;
  amplitudeStationary: number;
  amplitudeMoving: number;
  energyFactor: number;
  volumeFactor: number;
  energyDensityFactor: number;
  showCountermodel?: boolean | undefined;
  countermodelEnergyJ?: number | undefined;
  countermodelVolumeM3?: number | undefined;
  countermodelEnergyFactor?: number | undefined;
  countermodelVolumeFactor?: number | undefined;
}

export function LightComplexPlot({
  beta,
  gamma,
  phiStationaryDeg,
  phiMovingDeg,
  energyStationaryJ,
  energyMovingJ,
  volumeStationaryM3,
  volumeMovingM3,
  energyFactor,
  volumeFactor,
  energyDensityFactor,
  showCountermodel = true,
  countermodelEnergyJ,
  countermodelEnergyFactor,
  countermodelVolumeFactor,
}: LightComplexPlotProps) {
  const phiRadK = (phiStationaryDeg * Math.PI) / 180;
  const phiRad_k = (phiMovingDeg * Math.PI) / 180;

  // Visual layout
  // Both frames share one 800 × 380 coordinate space, K drawn around x = 200 and k
  // around x = 600; each FramePair panel's viewBox crops its own half. The k ellipse's
  // radii are clamped to 130, so it stays inside x 470 to 730 at every speed.
  const cx1 = 200;
  // Lower than it was (190), to make room for a two-line subtitle. At the panels' text size, 15.84
  // viewBox units with a 20.4-unit line box, the one-line subtitle ran past the panel's right edge and
  // sat on the y-axis label. Title, subtitle and values now stand 21 units apart, above the axis tip.
  const cy = 214;
  const cx2 = 600;
  const baseRadius = 55;

  // Rays
  const rayLen = 95;
  const ray1X = cx1 + rayLen * Math.cos(phiRadK);
  const ray1Y = cy - rayLen * Math.sin(phiRadK);
  const ray2X = cx2 + rayLen * Math.cos(phiRad_k);
  const ray2Y = cy - rayLen * Math.sin(phiRad_k);

  // Transformed ellipsoid dimensions in k
  // Under the simultaneity slice at t'=0, the spherical complex transforms to an ellipsoid
  // with volume ratio 1/q.
  const rx_k = Math.max(15, Math.min(130, baseRadius * Math.sqrt(volumeFactor || 1)));
  const ry_k = Math.max(
    15,
    Math.min(130, baseRadius * Math.sqrt(volumeFactor || 1) * (1 / Math.max(0.2, gamma || 1))),
  );

  // Countermodel rod contraction: rx_rod = baseRadius / gamma, ry_rod = baseRadius
  const rx_rod = Math.max(10, baseRadius / (gamma || 1));
  const ry_rod = baseRadius;

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
            viewBox="10 10 370 360"
            role="img"
            aria-label={`Stationary frame K: a spherical light complex, energy ${energyStationaryJ.toFixed(2)} J, volume ${volumeStationaryM3.toFixed(2)} cubic metres, ray at phi = ${phiStationaryDeg.toFixed(1)} degrees`}
            style={{ width: "100%", height: "auto", userSelect: "none" }}
          >
            <title>Stationary frame K</title>
            <defs>
              <marker
                id="arrow-k-ray"
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
              <text x={40} y={35} fontSize="14" fontWeight="600" fill="var(--ink)">
                Stationary Frame K
              </text>
              <text x={40} y={56} fontSize="12" fill="var(--muted)">
                Spherical light complex
              </text>
              <text x={40} y={77} fontSize="12" fill="var(--muted)">
                E = {energyStationaryJ.toFixed(2)} J · V = {volumeStationaryM3.toFixed(2)} m³
              </text>

              {/* Coordinate axes */}
              <line
                x1={cx1 - 130}
                y1={cy}
                x2={cx1 + 130}
                y2={cy}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <line
                x1={cx1}
                y1={cy - 120}
                x2={cx1}
                y2={cy + 120}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <text x={cx1 + 135} y={cy + 4} fontSize="10" fill="var(--muted)">
                x
              </text>
              <text x={cx1 + 8} y={cy - 104} fontSize="10" fill="var(--muted)">
                y
              </text>

              {/* Spherical light complex boundary */}
              <circle
                cx={cx1}
                cy={cy}
                r={baseRadius}
                fill="var(--plot)"
                fillOpacity={0.15}
                stroke="var(--plot)"
                strokeWidth={2}
              />

              {/* Internal light wave ripples */}
              <circle
                cx={cx1}
                cy={cy}
                r={baseRadius * 0.65}
                fill="none"
                stroke="var(--plot)"
                strokeWidth={1}
                strokeDasharray="3 3"
                strokeOpacity={0.5}
              />
              <circle
                cx={cx1}
                cy={cy}
                r={baseRadius * 0.35}
                fill="none"
                stroke="var(--plot)"
                strokeWidth={1}
                strokeDasharray="3 3"
                strokeOpacity={0.5}
              />

              {/* Propagation ray */}
              <line
                x1={cx1}
                y1={cy}
                x2={ray1X}
                y2={ray1Y}
                stroke="var(--plot)"
                strokeWidth={2.5}
                markerEnd="url(#arrow-k-ray)"
              />
              <circle cx={cx1} cy={cy} r={3} fill="var(--plot)" />

              {/* Angle arc */}
              <path
                d={`M ${cx1 + 25} ${cy} A 25 25 0 ${phiRadK > Math.PI ? 1 : 0} 0 ${cx1 + 25 * Math.cos(phiRadK)} ${cy - 25 * Math.sin(phiRadK)}`}
                fill="none"
                stroke="var(--plot)"
                strokeWidth={1.2}
                strokeDasharray="2 2"
              />
              {/* The angle's value is read in the panel's lower corner. Beside the arc it sat on the
                  circle's edge, and a reader sets φ, so no fixed spot near the ray stays clear. */}
              <text
                x={40}
                y={cy + 112}
                fontSize="12"
                fontFamily="var(--font-mono, monospace)"
                fontWeight="500"
                fill="var(--plot)"
              >
                φ = {phiStationaryDeg.toFixed(1)}°
              </text>
            </g>
          </svg>
          <svg
            viewBox="420 10 370 360"
            role="img"
            aria-label={`Moving frame k at beta = ${beta.toFixed(2)}: the same complex as an ellipsoid, energy ${energyMovingJ.toFixed(2)} J, volume ${volumeMovingM3.toFixed(2)} cubic metres, ray at phi' = ${phiMovingDeg.toFixed(1)} degrees`}
            style={{ width: "100%", height: "auto", userSelect: "none" }}
          >
            <title>Moving frame k</title>
            <defs>
              <marker
                id="arrow-prime-ray"
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
                id="arrow-boost-complex"
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
              <text x={cx2 - 140} y={35} fontSize="14" fontWeight="600" fill="var(--ink)">
                Moving Frame k (β = {beta.toFixed(2)}c)
              </text>
              <text x={cx2 - 140} y={56} fontSize="12" fill="var(--muted)">
                Physical complex
              </text>
              <text x={cx2 - 140} y={77} fontSize="12" fill="var(--muted)">
                E′ = {energyMovingJ.toFixed(2)} J · V′ = {volumeMovingM3.toFixed(2)} m³
              </text>

              {/* Coordinate axes */}
              <line
                x1={cx2 - 130}
                y1={cy}
                x2={cx2 + 130}
                y2={cy}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <line
                x1={cx2}
                y1={cy - 120}
                x2={cx2}
                y2={cy + 120}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <text x={cx2 + 135} y={cy + 4} fontSize="10" fill="var(--muted)">
                x′
              </text>
              <text x={cx2 + 8} y={cy - 104} fontSize="10" fill="var(--muted)">
                y′
              </text>

              {/* Boost vector arrow */}
              <g transform={`translate(${cx2 - 50}, ${cy + 105})`}>
                <line
                  x1={0}
                  y1={0}
                  x2={50}
                  y2={0}
                  stroke="var(--accent)"
                  strokeWidth={2}
                  markerEnd="url(#arrow-boost-complex)"
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

              {/* Countermodel: Material Rod Contraction contour */}
              {showCountermodel ? (
                <g>
                  <ellipse
                    cx={cx2}
                    cy={cy}
                    rx={rx_rod}
                    ry={ry_rod}
                    fill="none"
                    stroke="var(--muted)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                  <text
                    x={cx2 + 40}
                    y={cy + 133}
                    fontSize="9"
                    fontFamily="var(--font-mono, monospace)"
                    fill="var(--muted)"
                  >
                    Rod: 1/γ
                  </text>
                </g>
              ) : null}

              {/* Transformed Light Complex Ellipsoid */}
              <g transform={`rotate(${(-phiRad_k * 180) / Math.PI + 90}, ${cx2}, ${cy})`}>
                <ellipse
                  cx={cx2}
                  cy={cy}
                  rx={ry_k}
                  ry={rx_k}
                  fill={energyFactor > 1 ? "var(--accent)" : "var(--plot)"}
                  fillOpacity={0.2}
                  stroke={energyFactor > 1 ? "var(--accent)" : "var(--plot)"}
                  strokeWidth={2}
                />
              </g>

              {/* Transformed propagation ray */}
              <line
                x1={cx2}
                y1={cy}
                x2={ray2X}
                y2={ray2Y}
                stroke="var(--accent)"
                strokeWidth={2.5}
                markerEnd="url(#arrow-prime-ray)"
              />
              <circle cx={cx2} cy={cy} r={3} fill="var(--accent)" />

              {/* Transformed angle arc */}
              <path
                d={`M ${cx2 + 25} ${cy} A 25 25 0 ${phiRad_k > Math.PI ? 1 : 0} 0 ${cx2 + 25 * Math.cos(phiRad_k)} ${cy - 25 * Math.sin(phiRad_k)}`}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={1.2}
                strokeDasharray="2 2"
              />
              <text
                x={cx2 + 40}
                y={cy + 112}
                fontSize="12"
                fontFamily="var(--font-mono, monospace)"
                fontWeight="500"
                fill="var(--accent)"
              >
                φ′ = {phiMovingDeg.toFixed(1)}°
              </text>
            </g>
          </svg>
        </FramePair>
      </div>

      {/* Diagnostics / Badges Grid */}
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
          <div className="fine">Energy ratio E′/E (q)</div>
          <div
            style={{
              fontSize: "0.875rem",
              fontFamily: "var(--font-mono, monospace)",
              fontWeight: 600,
              marginTop: "0.125rem",
              color: "var(--accent)",
            }}
          >
            {fixed(energyFactor, 6)}
          </div>
          <div className="fine" style={{ marginTop: "0.125rem" }}>
            γ(1 − β cos φ) = ν′/ν
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
          <div className="fine">Volume ratio V′/V (1/q)</div>
          <div
            style={{
              fontSize: "0.875rem",
              fontFamily: "var(--font-mono, monospace)",
              fontWeight: 600,
              marginTop: "0.125rem",
              color: "var(--ink)",
            }}
          >
            {fixed(volumeFactor, 6)}
          </div>
          <div className="fine" style={{ marginTop: "0.125rem" }}>
            1 / [γ(1 − β cos φ)]
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
          <div className="fine">Energy density ratio u′/u</div>
          <div
            style={{
              fontSize: "0.875rem",
              fontFamily: "var(--font-mono, monospace)",
              fontWeight: 600,
              marginTop: "0.125rem",
              color: "var(--ink)",
            }}
          >
            {fixed(energyDensityFactor, 6)}
          </div>
          <div className="fine" style={{ marginTop: "0.125rem" }}>
            q² = (A′/A)²
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
          <div className="fine">Lorentz factor γ</div>
          <div
            style={{
              fontSize: "0.875rem",
              fontFamily: "var(--font-mono, monospace)",
              fontWeight: 600,
              marginTop: "0.125rem",
              color: "var(--ink)",
            }}
          >
            {fixed(gamma, 6)}
          </div>
          <div className="fine" style={{ marginTop: "0.125rem" }}>
            1 / √(1 − β²)
          </div>
        </div>
      </div>

      {showCountermodel &&
      countermodelEnergyFactor !== undefined &&
      countermodelVolumeFactor !== undefined ? (
        <div
          style={{
            padding: "0.75rem",
            borderRadius: "0.375rem",
            border: "1px solid rgba(245, 158, 11, 0.4)",
            background: "rgba(245, 158, 11, 0.1)",
            fontSize: "var(--type-fine)",
          }}
        >
          <div style={{ fontWeight: 600, color: "var(--ink)" }}>
            Countermodel Comparison: &ldquo;Treat the packet like a rigid rod&rdquo;
          </div>
          <p style={{ margin: "0.25rem 0 0", color: "var(--ink)", lineHeight: 1.5 }}>
            If the packet kept light&rsquo;s energy density but had a rigid rod&rsquo;s volume, its
            volume would scale by 1/γ = {fixed(countermodelVolumeFactor, 4)} and its energy by q²/γ
            = {fixed(countermodelEnergyFactor, 4)} (E′_wrong ={" "}
            {countermodelEnergyJ !== undefined ? fixed(countermodelEnergyJ, 3) : "—"} J). The true
            energy factor is q = {fixed(energyFactor, 4)} and the true volume factor is 1/q ={" "}
            {fixed(volumeFactor, 4)}. At cos φ = β they differ; at φ = 90° in K they agree, because
            there q = γ.
          </p>
        </div>
      ) : null}
    </div>
  );
}
