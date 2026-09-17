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

  // Doppler color calculation
  const reflColor = frequencyRatio < 0.8 ? "#ef4444" : frequencyRatio > 1.2 ? "#3b82f6" : "#f59e0b";
  const incColor = "#f59e0b";

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
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border/50 bg-background/80 p-4 shadow-sm">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none"
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
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
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
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#ec4899" />
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
            className="fill-muted-foreground text-xs"
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
                stroke="#10b981"
                strokeWidth="3"
                markerEnd="url(#arrow-velocity)"
              />
              <text
                x={mirrorX + (beta * 120) / 2}
                y={centerY + mirrorHeight / 2 + 42}
                className="fill-emerald-500 font-medium text-xs"
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
                stroke="#ec4899"
                strokeWidth="2.5"
                markerEnd="url(#arrow-force)"
              />
              <text
                x={mirrorX + 45}
                y={centerY - 15}
                className="fill-pink-500 font-medium text-xs"
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
                className="fill-amber-500 font-semibold text-xs"
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
                className="font-semibold text-xs"
                style={{ fill: reflColor }}
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
                stroke="#94a3b8"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <rect
                x={80}
                y={80}
                width={260}
                height={90}
                rx={8}
                fill="#fee2e2"
                stroke="#ef4444"
                strokeWidth="1.5"
              />
              <text x={95} y={105} className="fill-red-800 font-bold text-xs">
                Interception Horizon: cos(φ) ≤ β
              </text>
              <text x={95} y={125} className="fill-red-700 text-xs">
                Light speed c cos(φ) ≤ v (receding mirror).
              </text>
              <text x={95} y={145} className="fill-red-700 text-xs">
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
              fill="currentColor"
              opacity="0.04"
              stroke="currentColor"
              strokeWidth="1"
              className="text-border"
            />
            <text x={100} y={26} className="fill-foreground font-bold text-xs" textAnchor="middle">
              Energy Conservation Ledger
            </text>
            <text x={100} y={42} className="fill-muted-foreground text-[10px]" textAnchor="middle">
              {frame === "mirror" ? "Mirror Rest Frame (k)" : "Laboratory Frame (K)"}
            </text>

            {isApplicable ? (
              <g transform="translate(20, 60)">
                {/* Incident Power Column */}
                <g transform="translate(15, 0)">
                  <text x={25} y={190} className="fill-foreground text-[10px]" textAnchor="middle">
                    Incident
                  </text>
                  <text
                    x={25}
                    y={205}
                    className="fill-amber-500 font-bold text-[10px]"
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
                    fill="#f59e0b"
                    opacity="0.9"
                  />
                </g>

                {/* Balance Equals sign */}
                <text
                  x={80}
                  y={110}
                  className="fill-muted-foreground font-bold text-sm"
                  textAnchor="middle"
                >
                  =
                </text>

                {/* Output Power Column (Reflected + Work) */}
                <g transform="translate(95, 0)">
                  <text x={25} y={190} className="fill-foreground text-[10px]" textAnchor="middle">
                    Refl + Work
                  </text>
                  <text
                    x={25}
                    y={205}
                    className="fill-blue-500 font-bold text-[10px]"
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
                      fill="#10b981"
                      opacity="0.9"
                    />
                  )}
                </g>

                {/* Ledger Key */}
                <g transform="translate(0, 220)">
                  <circle cx={10} cy={6} r={4} fill="#f59e0b" />
                  <text x={20} y={10} className="fill-muted-foreground text-[9px]">
                    Incident radiation power
                  </text>

                  <circle cx={10} cy={20} r={4} fill={reflColor} />
                  <text x={20} y={24} className="fill-muted-foreground text-[9px]">
                    Reflected radiation power
                  </text>

                  <circle cx={10} cy={34} r={4} fill="#10b981" />
                  <text x={20} y={38} className="fill-muted-foreground text-[9px]">
                    Mechanical work rate (P·v·Am)
                  </text>
                </g>
              </g>
            ) : (
              <text x={100} y={140} className="fill-muted-foreground text-xs" textAnchor="middle">
                Ledger inactive (no ray hit)
              </text>
            )}
          </g>
        </svg>
      </div>
    </div>
  );
}
