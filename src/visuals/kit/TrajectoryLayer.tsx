import { type ReactElement, useEffect, useRef } from "react";
import { viewIdentityAttributes } from "./identity.ts";
import type { Projector, ViewIdentityProps } from "./types.ts";

export interface TracerPath {
  readonly id: string | number;
  /** Flattened [x0, y0, x1, y1, ...] or typed array buffer. */
  readonly positions: Float32Array | Float64Array | readonly number[];
  readonly color?: string;
  readonly isHighlighted?: boolean;
}

export interface TrajectoryLayerProps extends ViewIdentityProps {
  readonly tracers: readonly TracerPath[];
  readonly xProjector: Projector;
  readonly yProjector: Projector;
  readonly totalEnsembleCount?: number;
  readonly width?: number;
  readonly height?: number;
  readonly mode?: "canvas" | "svg";
  readonly selectedQuantityId?: string;
  readonly quantityId?: string;
  readonly renderConventionNote?: boolean;
}

export function TrajectoryLayer({
  instanceId,
  runId,
  snapshotVersion,
  tracers,
  xProjector,
  yProjector,
  totalEnsembleCount,
  width = 600,
  height = 400,
  mode = "svg",
  selectedQuantityId,
  quantityId,
  renderConventionNote = true,
}: TrajectoryLayerProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [xMin, xMax] = xProjector.domain;
  const [yMin, yMax] = yProjector.domain;

  // Viewport exit census: calculate drawn vs offscreen based on final position
  let drawnCount = 0;
  let offscreenCount = 0;

  for (const tracer of tracers) {
    const len = tracer.positions.length;
    if (len >= 2) {
      const finalX = tracer.positions[len - 2];
      const finalY = tracer.positions[len - 1];
      if (finalX !== undefined && finalY !== undefined) {
        const inX = finalX >= Math.min(xMin, xMax) && finalX <= Math.max(xMin, xMax);
        const inY = finalY >= Math.min(yMin, yMax) && finalY <= Math.max(yMin, yMax);
        if (inX && inY) {
          drawnCount++;
        } else {
          offscreenCount++;
        }
      }
    }
  }

  const effectiveTotal = totalEnsembleCount ?? tracers.length;

  // Canvas rendering effect
  useEffect(() => {
    if (mode !== "canvas" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    for (const tracer of tracers) {
      const pos = tracer.positions;
      if (pos.length < 2) continue;

      const p0 = pos[0];
      const p1 = pos[1];
      if (p0 === undefined || p1 === undefined) continue;

      ctx.beginPath();
      const px0 = xProjector(p0);
      const py0 = yProjector(p1);
      ctx.moveTo(px0, py0);

      for (let i = 2; i < pos.length; i += 2) {
        const piX = pos[i];
        const piY = pos[i + 1];
        if (piX !== undefined && piY !== undefined) {
          const px = xProjector(piX);
          const py = yProjector(piY);
          ctx.lineTo(px, py);
        }
      }

      ctx.strokeStyle = tracer.color ?? "#3b82f6";
      ctx.lineWidth =
        tracer.isHighlighted || (selectedQuantityId && selectedQuantityId === quantityId) ? 2.5 : 1;
      ctx.stroke();

      // Current position marker
      const lastX = pos[pos.length - 2];
      const lastY = pos[pos.length - 1];
      if (lastX !== undefined && lastY !== undefined) {
        const lastPx = xProjector(lastX);
        const lastPy = yProjector(lastY);
        ctx.beginPath();
        ctx.arc(lastPx, lastPy, 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = tracer.color ?? "#3b82f6";
        ctx.fill();
      }
    }
  }, [mode, tracers, xProjector, yProjector, width, height, selectedQuantityId, quantityId]);

  const identityAttrs = viewIdentityAttributes({ instanceId, runId, snapshotVersion });

  return (
    <div
      className="trajectory-layer"
      {...identityAttrs}
      data-drawn-count={drawnCount}
      data-offscreen-count={offscreenCount}
      data-ensemble-count={effectiveTotal}
      data-quantity-id={quantityId}
      style={{ maxWidth: "100%", overflowX: "hidden", boxSizing: "border-box" }}
    >
      {mode === "canvas" ? (
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="trajectory-canvas"
          role="img"
          aria-label={`Tracer paths: ${drawnCount} visible in viewport, ${offscreenCount} offscreen out of ${effectiveTotal} total ensemble.`}
          style={{ maxWidth: "100%", height: "auto", display: "block" }}
        />
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height="auto"
          className="trajectory-svg"
          aria-label={`Tracer paths: ${drawnCount} visible, ${offscreenCount} offscreen.`}
          style={{ maxWidth: "100%", display: "block" }}
        >
          {tracers.map((tracer) => {
            const pos = tracer.positions;
            if (pos.length < 2) return null;

            const points: string[] = [];
            for (let i = 0; i < pos.length; i += 2) {
              const piX = pos[i];
              const piY = pos[i + 1];
              if (piX !== undefined && piY !== undefined) {
                const px = xProjector(piX);
                const py = yProjector(piY);
                if (Number.isFinite(px) && Number.isFinite(py)) {
                  points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
                }
              }
            }
            if (points.length === 0) return null;

            const lastX = pos[pos.length - 2];
            const lastY = pos[pos.length - 1];
            const finalPx = lastX !== undefined ? xProjector(lastX) : Number.NaN;
            const finalPy = lastY !== undefined ? yProjector(lastY) : Number.NaN;

            return (
              <g key={`tracer-${tracer.id}`} className="tracer-item">
                <polyline
                  points={points.join(" ")}
                  fill="none"
                  stroke={tracer.color ?? "currentColor"}
                  strokeWidth={tracer.isHighlighted ? 2.5 : 1}
                  opacity={0.7}
                />
                {Number.isFinite(finalPx) && Number.isFinite(finalPy) && (
                  <circle cx={finalPx} cy={finalPy} r={2.5} fill={tracer.color ?? "currentColor"} />
                )}
              </g>
            );
          })}
        </svg>
      )}

      {/* Census telemetry banner */}
      <div className="trajectory-census" style={{ fontSize: 11 }}>
        <span className="census-drawn">{`${drawnCount} in viewport`}</span>
        <span className="census-offscreen">{` · ${offscreenCount} offscreen`}</span>
        <span className="census-total">{` (${effectiveTotal} total particles in ensemble)`}</span>
      </div>

      {/* Polyline rendering convention notice */}
      {renderConventionNote && (
        <p className="rendering-convention-note" style={{ fontSize: 10 }}>
          Note: Straight lines connecting sample intervals are a visual rendering convention and do
          not represent instantaneous trajectory velocities between collision events.
        </p>
      )}
    </div>
  );
}
