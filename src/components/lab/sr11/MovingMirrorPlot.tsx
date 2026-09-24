import { fixed } from "../presentation.ts";
import "./sr11.css";
import { Sci } from "../Sci.tsx";

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

// Drawing frame. The rays are drawn in screen coordinates with y pointing down, and the physics
// y-axis is mapped onto it unchanged: the incident ray travels along (cos φ, sin φ), so it arrives
// from the upper left, and the reflected ray leaves along (cos φ′′′, sin φ′′′), below the normal.
export const MIRROR_FRAME = {
  width: 470,
  height: 410,
  mirrorX: 270,
  centerY: 175,
  mirrorHeight: 210,
  rayLength: 150,
} as const;

/** Where the drawn rays start and end. Exported so a test can check the reflection is a mirror
 * image of the incidence about the normal, not a retrace of it. */
export function mirrorRayGeometry(incidentAngleDeg: number, phiReflectedDeg: number) {
  const { mirrorX, centerY, rayLength } = MIRROR_FRAME;
  const phiInc = (incidentAngleDeg * Math.PI) / 180;
  const phiRefl = (phiReflectedDeg * Math.PI) / 180;
  // Near the axis the two rays lie on top of each other; they are drawn a few units apart there
  // so both stay visible, one just above the normal and one just below.
  const nearAxis = Math.sin(phiInc) < 0.1 && Math.sin(phiRefl) < 0.1;
  const split = nearAxis ? 6 : 0;
  return {
    incidentStart: {
      x: mirrorX - rayLength * Math.cos(phiInc),
      y: centerY - rayLength * Math.sin(phiInc) - split,
    },
    incidentEnd: { x: mirrorX, y: centerY - split },
    reflectedStart: { x: mirrorX, y: centerY + split },
    reflectedEnd: {
      x: mirrorX + rayLength * Math.cos(phiRefl),
      y: centerY + rayLength * Math.sin(phiRefl) + split,
    },
  };
}

const clampLabelX = (x: number) => Math.min(MIRROR_FRAME.width - 50, Math.max(50, x));
const midpoint = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  `${a.x},${a.y} ${(a.x + b.x) / 2},${(a.y + b.y) / 2} ${b.x},${b.y}`;

const labelStyle = {
  fill: "var(--ink)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--sr11-label, 13px)",
} as const;

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
  const { width, height, mirrorX, centerY, mirrorHeight } = MIRROR_FRAME;
  const phiIncRad = (incidentAngleDeg * Math.PI) / 180;
  const rays = mirrorRayGeometry(incidentAngleDeg, phiReflectedDeg);

  // Doppler and physical vector colors
  const incColor = "#f59e0b";
  const reflColor =
    frequencyRatio > 1.01 ? "#3b82f6" : frequencyRatio < 0.99 ? "#ef4444" : "#f59e0b";
  const reflWords =
    frequencyRatio > 1.01
      ? "reflected light, at a higher frequency"
      : frequencyRatio < 0.99
        ? "reflected light, at a lower frequency"
        : "reflected light, at the same frequency";
  const velocityColor = "#10b981";
  const forceColor = "#ec4899";

  // Energy per second at the mirror. A receding mirror is pushed, so the light does work on it
  // and that work leaves with the reflected light. An approaching mirror does work on the light,
  // so its work arrives with the incident light. Both rows share one scale.
  const workIn = Math.max(0, -workRate);
  const workOut = Math.max(0, workRate);
  const inflow = Math.max(0, incidentPower) + workIn;
  const outflow = Math.max(0, reflectedPower) + workOut;
  const scale = Math.max(1e-12, inflow, outflow);
  const pct = (x: number) => `${((Math.max(0, x) / scale) * 100).toFixed(1)}%`;

  // The velocity has its own lane below the lowest point a reflected ray or its label can reach
  // (centerY + rayLength, plus the label), so a ray leaving steeply downward never crosses it.
  const velocityY = height - 38;
  const velocityWords =
    Math.abs(beta) <= 0.01
      ? "mirror at rest"
      : beta > 0
        ? `v = +${beta.toFixed(2)}c, receding`
        : `v = ${beta.toFixed(2)}c, approaching`;

  return (
    <div className="sr11-figure">
      <div className="sr11-figure-grid">
        <div className="sr11-diagram">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Moving mirror: speed β = ${beta.toFixed(2)}, light arriving at ${incidentAngleDeg.toFixed(1)} degrees from the normal${isApplicable ? ` and leaving at ${phiReflectedDeg.toFixed(1)} degrees` : ", never reaching the mirror"}`}
          >
            <title>Moving mirror with incident and reflected light</title>
            <defs>
              <marker
                id="arrow-inc"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill={incColor} />
              </marker>
              <marker
                id="arrow-refl"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill={reflColor} />
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

            {/* The normal, drawn through the point where the light meets the mirror */}
            <line
              x1={30}
              y1={centerY}
              x2={width - 20}
              y2={centerY}
              stroke="currentColor"
              strokeDasharray="3 3"
              opacity="0.3"
            />
            <text x={width - 20} y={centerY + 22} textAnchor="end" style={labelStyle}>
              normal
            </text>

            {/* Mirror, with hatching on its back */}
            <rect
              x={mirrorX - 6}
              y={centerY - mirrorHeight / 2}
              width={12}
              height={mirrorHeight}
              rx={3}
              fill="currentColor"
              opacity="0.85"
            />
            {Array.from({ length: 10 }, (_, i) => centerY - mirrorHeight / 2 + 10 + i * 20).map(
              (y) => (
                <line
                  key={`mirror-hatch-${y}`}
                  x1={mirrorX + 6}
                  y1={y}
                  x2={mirrorX + 14}
                  y2={y + 8}
                  stroke="currentColor"
                  opacity="0.4"
                  strokeWidth="1.5"
                />
              ),
            )}

            {/* Mirror velocity */}
            {Math.abs(beta) > 0.01 && (
              <line
                x1={mirrorX}
                y1={velocityY}
                x2={mirrorX + beta * 110}
                y2={velocityY}
                stroke={velocityColor}
                strokeWidth="3"
                markerEnd="url(#arrow-velocity)"
              />
            )}
            <text
              x={clampLabelX(mirrorX + (Math.abs(beta) > 0.01 ? beta * 55 : 0))}
              y={velocityY + 24}
              textAnchor="middle"
              style={labelStyle}
            >
              {velocityWords}
            </text>

            {/* Radiation force on the mirror */}
            {isApplicable && radiationForce > 0.001 && (
              <g>
                <line
                  x1={mirrorX + 6}
                  y1={centerY}
                  x2={mirrorX + 6 + Math.min(80, Math.max(24, radiationForce * 25))}
                  y2={centerY}
                  stroke={forceColor}
                  strokeWidth="2.5"
                  markerEnd="url(#arrow-force)"
                />
                <text x={mirrorX + 36} y={centerY - 12} textAnchor="middle" style={labelStyle}>
                  F
                </text>
              </g>
            )}

            {isApplicable ? (
              <g>
                <polyline
                  points={midpoint(rays.incidentStart, rays.incidentEnd)}
                  fill="none"
                  stroke={incColor}
                  strokeWidth="3"
                  markerMid="url(#arrow-inc)"
                />
                <text
                  x={clampLabelX(rays.incidentStart.x)}
                  y={rays.incidentStart.y - 12}
                  textAnchor="middle"
                  style={labelStyle}
                >
                  incident
                </text>
                <polyline
                  points={midpoint(rays.reflectedStart, rays.reflectedEnd)}
                  fill="none"
                  stroke={reflColor}
                  strokeWidth="3"
                  markerMid="url(#arrow-refl)"
                />
                <text
                  x={clampLabelX(rays.reflectedEnd.x)}
                  y={rays.reflectedEnd.y + 24}
                  textAnchor="middle"
                  style={labelStyle}
                >
                  reflected
                </text>
                {incidentAngleDeg > 5 && incidentAngleDeg < 85 && (
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
              <g>
                <line
                  x1={rays.incidentStart.x}
                  y1={rays.incidentStart.y}
                  x2={rays.incidentStart.x + 120 * Math.cos(phiIncRad)}
                  y2={rays.incidentStart.y + 120 * Math.sin(phiIncRad)}
                  stroke="var(--muted)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
                <text
                  x={clampLabelX(rays.incidentStart.x)}
                  y={rays.incidentStart.y - 12}
                  textAnchor="middle"
                  style={labelStyle}
                >
                  incident
                </text>
              </g>
            )}
          </svg>
          {isApplicable ? null : (
            <p className="fine sr11-no-reflection">
              No reflection at these settings. Along the normal the light moves at c·cos φ ={" "}
              {fixed(Math.cos(phiIncRad), 3)}c, no faster than the mirror at {fixed(beta, 3)}c, so
              it never reaches the mirror.
            </p>
          )}
        </div>

        <div className="sr11-ledger">
          <p className="sr11-ledger-title">Energy per second</p>
          <p className="fine sr11-ledger-frame">
            At the mirror, in the{" "}
            {frame === "mirror" ? "mirror rest frame (k)" : "laboratory frame (K)"}
          </p>
          {isApplicable ? (
            <>
              <div className="sr11-ledger-row">
                <span className="sr11-ledger-label">In</span>
                <span className="sr11-bar" aria-hidden="true">
                  <span
                    className="sr11-seg"
                    style={{ width: pct(incidentPower), background: incColor }}
                  />
                  {workIn > 0 ? (
                    <span
                      className="sr11-seg"
                      style={{ width: pct(workIn), background: velocityColor }}
                    />
                  ) : null}
                </span>
                <span className="sr11-ledger-value">
                  <Sci value={inflow} digits={4} /> W
                </span>
              </div>
              <div className="sr11-ledger-row">
                <span className="sr11-ledger-label">Out</span>
                <span className="sr11-bar" aria-hidden="true">
                  <span
                    className="sr11-seg"
                    style={{ width: pct(reflectedPower), background: reflColor }}
                  />
                  {workOut > 0 ? (
                    <span
                      className="sr11-seg"
                      style={{ width: pct(workOut), background: velocityColor }}
                    />
                  ) : null}
                </span>
                <span className="sr11-ledger-value">
                  <Sci value={outflow} digits={4} /> W
                </span>
              </div>
              <ul className="fine sr11-key">
                <li>
                  <span
                    className="sr11-swatch"
                    style={{ background: incColor }}
                    aria-hidden="true"
                  />
                  incident light
                </li>
                <li>
                  <span
                    className="sr11-swatch"
                    style={{ background: reflColor }}
                    aria-hidden="true"
                  />
                  {reflWords}
                </li>
                {workRate !== 0 ? (
                  <li>
                    <span
                      className="sr11-swatch"
                      style={{ background: velocityColor }}
                      aria-hidden="true"
                    />
                    {workRate > 0
                      ? "work the light does pushing the mirror"
                      : "work the approaching mirror does on the light"}{" "}
                    (P·v·A<sub>m</sub>)
                  </li>
                ) : null}
                <li>
                  <span
                    className="sr11-swatch"
                    style={{ background: forceColor }}
                    aria-hidden="true"
                  />
                  F, the radiation force on the mirror
                </li>
              </ul>
            </>
          ) : (
            <p className="fine">Nothing is exchanged: no light reaches the mirror.</p>
          )}
        </div>
      </div>
    </div>
  );
}
