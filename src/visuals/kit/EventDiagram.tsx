import type { ReactElement } from "react";
import type { Projector } from "./types.ts";

export interface Worldline {
  readonly id: string;
  readonly label?: string;
  /** Points [x, ct]. */
  readonly points: readonly (readonly [number, number])[];
  readonly color?: string;
  readonly isLightlike?: boolean;
}

export interface SpacetimeEvent {
  readonly id: string;
  readonly x: number;
  readonly ct: number;
  readonly label?: string;
  readonly color?: string;
}

export interface EventDiagramProps {
  readonly xProjector: Projector;
  readonly ctProjector: Projector;
  readonly worldlines?: readonly Worldline[];
  readonly events?: readonly SpacetimeEvent[];
  readonly showLightcones?: boolean;
  readonly lightconeOrigin?: readonly [number, number];
  readonly width?: number;
  readonly height?: number;
  readonly attributionLabel?: string | undefined;
}

/**
 * 2D Spacetime / Minkowski Event Diagram (x vs ct).
 */
export function EventDiagram({
  xProjector,
  ctProjector,
  worldlines = [],
  events = [],
  showLightcones = true,
  lightconeOrigin = [0, 0],
  width = 500,
  height = 500,
  attributionLabel = "H. Minkowski (1908)",
}: EventDiagramProps): ReactElement {
  const [ox, oct] = lightconeOrigin;
  const pox = xProjector(ox);
  const poct = ctProjector(oct);

  const [xMin, xMax] = xProjector.domain;
  const dx = Math.max(Math.abs(xMax - ox), Math.abs(xMin - ox));

  const lcLeft0 = xProjector(ox - dx);
  const lcLeft1 = ctProjector(oct + dx);
  const lcRight0 = xProjector(ox + dx);
  const lcRight1 = ctProjector(oct + dx);

  const lcPastLeft0 = xProjector(ox - dx);
  const lcPastLeft1 = ctProjector(oct - dx);
  const lcPastRight0 = xProjector(ox + dx);
  const lcPastRight1 = ctProjector(oct - dx);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="event-diagram"
      data-minkowski-convention="1908"
      data-historical-attribution={attributionLabel || undefined}
      role="img"
      aria-label="Spacetime event diagram showing worldlines, lightcones, and discrete events."
    >
      {/* Lightcones */}
      {showLightcones && Number.isFinite(pox) && Number.isFinite(poct) && (
        <g className="lightcones" opacity={0.35}>
          {/* Future lightcone */}
          <polygon
            points={`${pox},${poct} ${lcLeft0},${lcLeft1} ${lcRight0},${lcRight1}`}
            fill="currentColor"
            fillOpacity={0.15}
          />
          <line
            x1={pox}
            y1={poct}
            x2={lcLeft0}
            y2={lcLeft1}
            stroke="currentColor"
            strokeDasharray="3 3"
          />
          <line
            x1={pox}
            y1={poct}
            x2={lcRight0}
            y2={lcRight1}
            stroke="currentColor"
            strokeDasharray="3 3"
          />

          {/* Past lightcone */}
          <polygon
            points={`${pox},${poct} ${lcPastLeft0},${lcPastLeft1} ${lcPastRight0},${lcPastRight1}`}
            fill="currentColor"
            fillOpacity={0.15}
          />
          <line
            x1={pox}
            y1={poct}
            x2={lcPastLeft0}
            y2={lcPastLeft1}
            stroke="currentColor"
            strokeDasharray="3 3"
          />
          <line
            x1={pox}
            y1={poct}
            x2={lcPastRight0}
            y2={lcPastRight1}
            stroke="currentColor"
            strokeDasharray="3 3"
          />
        </g>
      )}

      {/* Worldlines */}
      {worldlines.map((wl) => {
        const pts = wl.points
          .map(([x, ct]) => `${xProjector(x).toFixed(1)},${ctProjector(ct).toFixed(1)}`)
          .join(" ");
        return (
          <g key={`wl-${wl.id}`} className="worldline">
            <polyline
              points={pts}
              fill="none"
              stroke={wl.color ?? "currentColor"}
              strokeWidth={wl.isLightlike ? 1.5 : 2}
              strokeDasharray={wl.isLightlike ? "4 4" : undefined}
            >
              {wl.label && <title>{wl.label}</title>}
            </polyline>
          </g>
        );
      })}

      {/* Discrete Events */}
      {events.map((ev) => {
        const px = xProjector(ev.x);
        const py = ctProjector(ev.ct);
        if (!Number.isFinite(px) || !Number.isFinite(py)) return null;

        return (
          <g key={`ev-${ev.id}`} className="spacetime-event">
            <circle
              cx={px}
              cy={py}
              r={4}
              fill={ev.color ?? "currentColor"}
              stroke="white"
              strokeWidth={1}
            />
            {ev.label && (
              <text x={px + 6} y={py - 6} fontSize={11} fill="currentColor">
                {ev.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Historical Attribution Label */}
      {attributionLabel && (
        <text
          x={width - 8}
          y={height - 8}
          textAnchor="end"
          fontSize={10}
          fill="currentColor"
          opacity={0.6}
          data-testid="minkowski-label"
          className="font-serif italic select-none"
        >
          {attributionLabel}
        </text>
      )}
    </svg>
  );
}
