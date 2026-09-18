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
  const width = 800;
  const height = 380;
  const cx1 = 200;
  const cy = 190;
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
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Light complex transformation diagram: stationary frame K with sphere volume = ${volumeStationaryM3.toFixed(2)} m^3, moving frame k with transformed volume = ${volumeMovingM3.toFixed(2)} m^3`}
          style={{ width: "100%", height: "auto", userSelect: "none" }}
        >
          <title>Relativistic Light Complex Transformation (Einstein 1905 §8)</title>

          {/* Dividing line */}
          <line
            x1={width / 2}
            y1={20}
            x2={width / 2}
            y2={height - 20}
            stroke="var(--line)"
            strokeDasharray="4 4"
          />

          {/* Frame K Left Pane */}
          <g>
            <text x={40} y={35} fontSize="14" fontWeight="600" fill="var(--ink)">
              Stationary Frame K
            </text>
            <text x={40} y={55} fontSize="12" fill="var(--muted)">
              Spherical light complex · E = {energyStationaryJ.toFixed(2)} J · V ={" "}
              {volumeStationaryM3.toFixed(2)} m³
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
            <text x={cx1} y={cy - 125} fontSize="10" fill="var(--muted)" textAnchor="middle">
              y
            </text>

            {/* Spherical light complex boundary */}
            <circle
              cx={cx1}
              cy={cy}
              r={baseRadius}
              fill="#3b82f6"
              fillOpacity={0.15}
              stroke="#2563eb"
              strokeWidth={2}
            />

            {/* Internal light wave ripples */}
            <circle
              cx={cx1}
              cy={cy}
              r={baseRadius * 0.65}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={1}
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
            <circle
              cx={cx1}
              cy={cy}
              r={baseRadius * 0.35}
              fill="none"
              stroke="#3b82f6"
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
              stroke="#1d4ed8"
              strokeWidth={2.5}
              markerEnd="url(#arrow-k-ray)"
            />
            <circle cx={cx1} cy={cy} r={3} fill="#1d4ed8" />

            {/* Angle arc */}
            <path
              d={`M ${cx1 + 25} ${cy} A 25 25 0 ${phiRadK > Math.PI ? 1 : 0} 0 ${cx1 + 25 * Math.cos(phiRadK)} ${cy - 25 * Math.sin(phiRadK)}`}
              fill="none"
              stroke="#1d4ed8"
              strokeWidth={1.2}
              strokeDasharray="2 2"
            />
            <text
              x={cx1 + 32}
              y={cy - 10}
              fontSize="12"
              fontFamily="var(--font-mono, monospace)"
              fontWeight="500"
              fill="#1d4ed8"
            >
              φ = {phiStationaryDeg.toFixed(1)}°
            </text>
          </g>

          {/* Frame k Right Pane */}
          <g>
            <text x={cx2 - 140} y={35} fontSize="14" fontWeight="600" fill="var(--ink)">
              Moving Frame k (β = {beta.toFixed(2)}c)
            </text>
            <text x={cx2 - 140} y={55} fontSize="12" fill="var(--muted)">
              Physical complex · E′ = {energyMovingJ.toFixed(2)} J · V′ ={" "}
              {volumeMovingM3.toFixed(2)} m³
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
            <text x={cx2} y={cy - 125} fontSize="10" fill="var(--muted)" textAnchor="middle">
              y′
            </text>

            {/* Boost vector arrow */}
            <g transform={`translate(${cx2 - 50}, ${cy + 105})`}>
              <line
                x1={0}
                y1={0}
                x2={50}
                y2={0}
                stroke="#f59e0b"
                strokeWidth={2}
                markerEnd="url(#arrow-boost-complex)"
              />
              <text
                x={25}
                y={-5}
                fontSize="10"
                fontFamily="var(--font-mono, monospace)"
                fill="#f59e0b"
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
                  stroke="#ea580c"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
                <text
                  x={cx2 + rx_rod + 6}
                  y={cy + ry_rod - 10}
                  fontSize="9"
                  fontFamily="var(--font-mono, monospace)"
                  fill="#ea580c"
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
                fill={energyFactor > 1 ? "#ef4444" : "#10b981"}
                fillOpacity={0.2}
                stroke={energyFactor > 1 ? "#dc2626" : "#059669"}
                strokeWidth={2}
              />
            </g>

            {/* Transformed propagation ray */}
            <line
              x1={cx2}
              y1={cy}
              x2={ray2X}
              y2={ray2Y}
              stroke="#dc2626"
              strokeWidth={2.5}
              markerEnd="url(#arrow-prime-ray)"
            />
            <circle cx={cx2} cy={cy} r={3} fill="#dc2626" />

            {/* Transformed angle arc */}
            <path
              d={`M ${cx2 + 25} ${cy} A 25 25 0 ${phiRad_k > Math.PI ? 1 : 0} 0 ${cx2 + 25 * Math.cos(phiRad_k)} ${cy - 25 * Math.sin(phiRad_k)}`}
              fill="none"
              stroke="#dc2626"
              strokeWidth={1.2}
              strokeDasharray="2 2"
            />
            <text
              x={cx2 + 32}
              y={cy - 10}
              fontSize="12"
              fontFamily="var(--font-mono, monospace)"
              fontWeight="500"
              fill="#dc2626"
            >
              φ′ = {phiMovingDeg.toFixed(1)}°
            </text>
          </g>

          {/* Markers */}
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
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#1d4ed8" />
            </marker>
            <marker
              id="arrow-prime-ray"
              viewBox="0 0 10 10"
              refX={5}
              refY={5}
              markerWidth={6}
              markerHeight={6}
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
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
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
            </marker>
          </defs>
        </svg>
      </div>

      {/* Diagnostics / Badges Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "0.75rem",
          fontSize: "0.75rem",
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
            {energyFactor.toFixed(6)}
          </div>
          <div className="fine" style={{ fontSize: "0.625rem", marginTop: "0.125rem" }}>
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
            {volumeFactor.toFixed(6)}
          </div>
          <div className="fine" style={{ fontSize: "0.625rem", marginTop: "0.125rem" }}>
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
            {energyDensityFactor.toFixed(6)}
          </div>
          <div className="fine" style={{ fontSize: "0.625rem", marginTop: "0.125rem" }}>
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
            {gamma.toFixed(6)}
          </div>
          <div className="fine" style={{ fontSize: "0.625rem", marginTop: "0.125rem" }}>
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
            fontSize: "0.75rem",
          }}
        >
          <div style={{ fontWeight: 600, color: "var(--ink)" }}>
            Countermodel Comparison: &ldquo;Treat the packet like a rigid rod&rdquo;
          </div>
          <p style={{ margin: "0.25rem 0 0", color: "var(--ink)", lineHeight: 1.5 }}>
            If the packet were treated as a rigid rod, both energy and volume would scale by 1/γ ={" "}
            {countermodelVolumeFactor.toFixed(4)} (E′_wrong ={" "}
            {countermodelEnergyJ !== undefined ? countermodelEnergyJ.toFixed(3) : "—"} J). The true
            energy factor is q = {energyFactor.toFixed(4)} and the true volume factor is 1/q ={" "}
            {volumeFactor.toFixed(4)}. At φ = 90° in K those differ from 1/γ by γ². At cos φ = β
            they do not.
          </p>
        </div>
      ) : null}
    </div>
  );
}
