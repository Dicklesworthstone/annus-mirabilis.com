export interface MovingMirrorPlotProps {
  beta: number;
  incidentAngleDeg: number;
  phiReflectedDeg: number;
  frequencyRatio: number;
  radiationPressure: number;
  radiationForce: number;
  incidentPower: number;
  reflectedPower: number;
  workRate: number;
  energyBalanceResidual: number;
  frame: "lab" | "mirror";
  isApplicable: boolean;
  notApplicableReason?: string | undefined;
}

export function MovingMirrorPlot({
  beta,
  incidentAngleDeg,
  phiReflectedDeg,
  frequencyRatio,
  radiationPressure: _radiationPressure,
  radiationForce,
  incidentPower,
  reflectedPower,
  workRate,
  energyBalanceResidual: _energyBalanceResidual,
  frame,
  isApplicable,
  notApplicableReason: _notApplicableReason,
}: MovingMirrorPlotProps) {
  const width = 800;
  const height = 400;

  // Geometry
  const mirrorX = 380;
  const centerY = 200;
  const mirrorHeight = 240;

  // Ray parameters
  const rayLength = 160;
  const phiIncRad = (incidentAngleDeg * Math.PI) / 180;
  const phiReflRad = (phiReflectedDeg * Math.PI) / 180;

  // Incident ray comes from top/left towards mirror at (mirrorX, centerY)
  // In physics coordinate: normal is along +x.
  // Incident wave direction makes angle phi with normal.
  const incStartX = mirrorX - rayLength * Math.cos(phiIncRad);
  const incStartY = centerY - rayLength * Math.sin(phiIncRad);

  // Reflected ray goes away from mirror
  // Angle with +x normal is phiReflectedDeg
  const reflEndX = mirrorX + rayLength * Math.cos(phiReflRad);
  const reflEndY = centerY - rayLength * Math.sin(phiReflRad);

  // Doppler and physical vector colors
  const incColor = "#f59e0b";
  const reflColor =
    frequencyRatio > 1.01 ? "#3b82f6" : frequencyRatio < 0.99 ? "#ef4444" : "#f59e0b";
  const velocityColor = "#10b981";
  const forceColor = "#ec4899";
  const outputColor = "#3b82f6";

  // Power ledger max scale
  const totalPower = Math.max(
    0.1,
    Math.abs(incidentPower),
    Math.abs(reflectedPower) + Math.abs(workRate),
  );
  const incBarH = Math.min(180, (Math.max(0, incidentPower) / totalPower) * 160);
  const reflBarH = Math.min(180, (Math.max(0, reflectedPower) / totalPower) * 160);
  const workBarH = Math.min(180, (Math.max(0, workRate) / totalPower) * 160);

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
          style={{ width: "100%", height: "auto", userSelect: "none" }}
          role="img"
          aria-label={`Moving mirror reflection diagram: mirror speed beta = ${beta.toFixed(2)}, incident angle = ${incidentAngleDeg.toFixed(1)} deg, reflected angle = ${phiReflectedDeg.toFixed(1)} deg`}
        >
          <title>Moving Mirror Reflection and Energy Ledger</title>

          {/* Definitions for arrow markers */}
          <defs>
            <marker
              id="arrow-inc"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill={incColor} />
            </marker>
            <marker
              id="arrow-refl"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill={reflColor} />
            </marker>
            <marker
              id="arrow-normal"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 2 L 8 5 L 0 8 z" fill="currentColor" opacity="0.6" />
            </marker>
            <marker
              id="arrow-velocity"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill={velocityColor} />
            </marker>
            <marker
              id="arrow-force"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill={forceColor} />
            </marker>
          </defs>

          {/* Background Grid & Axis */}
          <line
            x1={40}
            y1={centerY}
            x2={mirrorX + 180}
            y2={centerY}
            stroke="currentColor"
            strokeDasharray="3 3"
            opacity="0.25"
          />

          {/* Mirror Surface */}
          <rect
            x={mirrorX - 6}
            y={centerY - mirrorHeight / 2}
            width={12}
            height={mirrorHeight}
            rx={3}
            fill="currentColor"
            opacity="0.85"
          />
          {/* Mirror Hatching pattern representing backing */}
          {Array.from({ length: 12 }, (_, i) => {
            const y = centerY - mirrorHeight / 2 + 10 + i * 20;
            return {
              id: `mirror-hatch-${y}`,
              y,
            };
          }).map((hatch) => (
            <line
              key={hatch.id}
              x1={mirrorX + 6}
              y1={hatch.y}
              x2={mirrorX + 14}
              y2={hatch.y + 8}
              stroke="currentColor"
              opacity="0.4"
              strokeWidth="1.5"
            />
          ))}

          {/* Mirror normal vector arrow */}
          <line
            x1={mirrorX}
            y1={centerY}
            x2={mirrorX - 80}
            y2={centerY}
            stroke="currentColor"
            opacity="0.5"
            strokeWidth="1.5"
            markerEnd="url(#arrow-normal)"
          />
          <text
            x={mirrorX - 90}
            y={centerY - 10}
            fill="var(--muted)"
            fontSize="12px"
            textAnchor="middle"
          >
            Normal (n)
          </text>

          {/* Mirror Velocity Vector Arrow */}
          {Math.abs(beta) > 0.01 && (
            <g>
              <line
                x1={mirrorX}
                y1={centerY + mirrorHeight / 2 + 24}
                x2={mirrorX + beta * 120}
                y2={centerY + mirrorHeight / 2 + 24}
                stroke={velocityColor}
                strokeWidth="3"
                markerEnd="url(#arrow-velocity)"
              />
              <text
                x={mirrorX + (beta * 120) / 2}
                y={centerY + mirrorHeight / 2 + 42}
                fill={velocityColor}
                fontWeight={500}
                fontSize="12px"
                textAnchor="middle"
              >
                v ={" "}
                {beta > 0 ? `+${beta.toFixed(2)}c (receding)` : `${beta.toFixed(2)}c (approaching)`}
              </text>
            </g>
          )}

          {/* Radiation Pressure / Force Vector on Mirror Face */}
          {isApplicable && radiationForce > 0.001 && (
            <g>
              <line
                x1={mirrorX - 6}
                y1={centerY}
                x2={mirrorX + Math.min(80, Math.max(20, radiationForce * 25))}
                y2={centerY}
                stroke={forceColor}
                strokeWidth="2.5"
                markerEnd="url(#arrow-force)"
              />
              <text
                x={mirrorX + 45}
                y={centerY - 15}
                fill={forceColor}
                fontWeight={500}
                fontSize="12px"
                textAnchor="middle"
              >
                Radiation force F
              </text>
            </g>
          )}

          {/* Ray Paths */}
          {isApplicable ? (
            <g>
              {/* Incident Ray */}
              <line
                x1={incStartX}
                y1={incStartY}
                x2={mirrorX}
                y2={centerY}
                stroke={incColor}
                strokeWidth="3"
                markerMid="url(#arrow-inc)"
              />
              <text
                x={incStartX + 20}
                y={incStartY - 10}
                fill={incColor}
                fontWeight={600}
                fontSize="12px"
              >
                Incident ray (ν, φ = {incidentAngleDeg.toFixed(1)}°)
              </text>

              {/* Reflected Ray */}
              <line
                x1={mirrorX}
                y1={centerY}
                x2={reflEndX}
                y2={reflEndY}
                stroke={reflColor}
                strokeWidth="3"
                markerMid="url(#arrow-refl)"
              />
              <text
                x={reflEndX + 10}
                y={reflEndY - 10}
                fill={reflColor}
                fontWeight={600}
                fontSize="12px"
              >
                Reflected ray (ν′′′/ν = {frequencyRatio.toFixed(3)}, φ′′′ ={" "}
                {phiReflectedDeg.toFixed(1)}°)
              </text>

              {/* Angle arc for incident ray */}
              {incidentAngleDeg > 5 && (
                <path
                  d={`M ${mirrorX - 40} ${centerY} A 40 40 0 0 0 ${mirrorX - 40 * Math.cos(phiIncRad)} ${centerY - 40 * Math.sin(phiIncRad)}`}
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray="2 2"
                  opacity="0.6"
                />
              )}
            </g>
          ) : (
            /* Interception Limit / Horizon Warning */
            <g>
              <line
                x1={incStartX}
                y1={incStartY}
                x2={incStartX + 120 * Math.cos(phiIncRad)}
                y2={incStartY + 120 * Math.sin(phiIncRad)}
                stroke="var(--muted)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <rect
                x={80}
                y={80}
                width={260}
                height={90}
                rx={8}
                fill="var(--wash)"
                stroke="var(--accent)"
                strokeWidth="1.5"
              />
              <text x={95} y={105} fill="var(--accent)" fontWeight="bold" fontSize="12px">
                Interception Horizon: cos(φ) ≤ β
              </text>
              <text x={95} y={125} fill="var(--accent)" fontSize="12px">
                Light speed c cos(φ) ≤ v (receding mirror).
              </text>
              <text x={95} y={145} fill="var(--accent)" fontSize="12px">
                The wavefront cannot catch up with the mirror face.
              </text>
            </g>
          )}

          {/* Energy Ledger Bar Chart (Right side of SVG) */}
          <g transform="translate(580, 40)">
            <rect
              x={0}
              y={0}
              width={200}
              height={320}
              rx={8}
              fill="var(--panel)"
              stroke="var(--line)"
              strokeWidth="1"
            />
            <text
              x={100}
              y={26}
              fill="var(--ink)"
              fontWeight="bold"
              fontSize="12px"
              textAnchor="middle"
            >
              Energy Conservation Ledger
            </text>
            <text x={100} y={42} fill="var(--muted)" fontSize="10px" textAnchor="middle">
              {frame === "mirror" ? "Mirror Rest Frame (k)" : "Laboratory Frame (K)"}
            </text>

            {isApplicable ? (
              <g transform="translate(20, 60)">
                {/* Incident Power Column */}
                <g transform="translate(15, 0)">
                  <text x={25} y={190} fill="var(--ink)" fontSize="10px" textAnchor="middle">
                    Incident
                  </text>
                  <text
                    x={25}
                    y={205}
                    fill={incColor}
                    fontWeight="bold"
                    fontSize="10px"
                    textAnchor="middle"
                  >
                    {incidentPower.toFixed(3)}
                  </text>
                  <rect
                    x={5}
                    y={170 - incBarH}
                    width={40}
                    height={incBarH}
                    rx={3}
                    fill={incColor}
                    opacity="0.9"
                  />
                </g>

                {/* Balance Equals sign */}
                <text
                  x={80}
                  y={110}
                  fill="var(--muted)"
                  fontWeight="bold"
                  fontSize="14px"
                  textAnchor="middle"
                >
                  =
                </text>

                {/* Output Power Column (Reflected + Work) */}
                <g transform="translate(95, 0)">
                  <text x={25} y={190} fill="var(--ink)" fontSize="10px" textAnchor="middle">
                    Refl + Work
                  </text>
                  <text
                    x={25}
                    y={205}
                    fill={outputColor}
                    fontWeight="bold"
                    fontSize="10px"
                    textAnchor="middle"
                  >
                    {(reflectedPower + workRate).toFixed(3)}
                  </text>
                  {/* Reflected power segment */}
                  <rect
                    x={5}
                    y={170 - reflBarH - workBarH}
                    width={40}
                    height={reflBarH}
                    rx={3}
                    fill={reflColor}
                    opacity="0.9"
                  />
                  {/* Work rate segment */}
                  {workBarH > 0 && (
                    <rect
                      x={5}
                      y={170 - workBarH}
                      width={40}
                      height={workBarH}
                      rx={3}
                      fill={velocityColor}
                      opacity="0.9"
                    />
                  )}
                </g>

                {/* Ledger Key */}
                <g transform="translate(0, 220)">
                  <circle cx={10} cy={6} r={4} fill={incColor} />
                  <text x={20} y={10} fill="var(--muted)" fontSize="9px">
                    Incident radiation power
                  </text>

                  <circle cx={10} cy={20} r={4} fill={reflColor} />
                  <text x={20} y={24} fill="var(--muted)" fontSize="9px">
                    Reflected radiation power
                  </text>

                  <circle cx={10} cy={34} r={4} fill={velocityColor} />
                  <text x={20} y={38} fill="var(--muted)" fontSize="9px">
                    Mechanical work rate (P·v·Am)
                  </text>
                </g>
              </g>
            ) : (
              <text x={100} y={140} fill="var(--muted)" fontSize="12px" textAnchor="middle">
                Ledger inactive (no ray hit)
              </text>
            )}
          </g>
        </svg>
      </div>
    </div>
  );
}
