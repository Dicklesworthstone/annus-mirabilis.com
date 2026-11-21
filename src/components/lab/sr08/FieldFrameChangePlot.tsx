"use client";

import { useId } from "react";
import type { PublishedResult } from "../../../experiments/store/instanceStore.ts";
import { display } from "../presentation.ts";
import { Sci } from "../Sci.tsx";
import "./sr08.css";

export interface FieldFrameChangePlotProps {
  readonly electricStationary?: PublishedResult;
  readonly electricMoving?: PublishedResult;
  readonly magneticStationary?: PublishedResult;
  readonly magneticMoving?: PublishedResult;
  readonly forceLab?: PublishedResult;
  readonly forceComoving?: PublishedResult;
  readonly frame: "stationary" | "moving";
  readonly unitLayer: "si" | "gaussian";
  readonly decompose: boolean;
}

// A vector arrives as a NumericView, not a Float64Array. Testing for Float64Array never matched,
// so every field and force was drawn as zero while the invariants beneath them were not.
function extractVector(res: PublishedResult | undefined): [number, number, number] {
  if (res?.status !== "value" || typeof res.value === "number" || res.value.length < 3) {
    return [0, 0, 0];
  }
  return [res.value.at(0), res.value.at(1), res.value.at(2)];
}

export function FieldFrameChangePlot({
  electricStationary,
  electricMoving,
  magneticStationary,
  magneticMoving,
  forceLab,
  forceComoving,
  frame,
  unitLayer,
  decompose,
}: FieldFrameChangePlotProps) {
  const id = useId();
  const E_stat = extractVector(electricStationary);
  const E_mov = extractVector(electricMoving);
  const B_stat = extractVector(magneticStationary);
  const B_mov = extractVector(magneticMoving);
  const F_stat = extractVector(forceLab);
  const F_mov = extractVector(forceComoving);

  const isMoving = frame === "moving";
  const E_active = isMoving ? E_mov : E_stat;
  const B_active = isMoving ? B_mov : B_stat;
  const F_active = isMoving ? F_mov : F_stat;

  // Scale vector arrows for 2D projection on xy plane
  const cx = 160;
  const cy = 110;
  const maxField = Math.max(
    Number.MIN_VALUE,
    Math.hypot(E_stat[0], E_stat[1]),
    Math.hypot(E_mov[0], E_mov[1]),
  );

  const ex = cx + (E_active[0] / maxField) * 60;
  const ey = cy - (E_active[1] / maxField) * 60;
  const maxMagnetic = Math.max(
    Number.MIN_VALUE,
    Math.hypot(B_stat[0], B_stat[1]),
    Math.hypot(B_mov[0], B_mov[1]),
  );
  const bx = cx + (B_active[0] / maxMagnetic) * 50;
  const by = cy - (B_active[1] / maxMagnetic) * 50;

  const maxForce = Math.max(
    Number.MIN_VALUE,
    Math.hypot(F_stat[0], F_stat[1]),
    Math.hypot(F_mov[0], F_mov[1]),
  );
  const fx = cx + (F_active[0] / maxForce) * 35;
  const fy = cy - (F_active[1] / maxForce) * 35;

  return (
    <div className="field-plot-container">
      {/* The frame is named in HTML: as a badge inside the drawing its words ran past the badge
          and into the y-axis label. */}
      <p className="sr08-plot-frame">
        {isMoving ? "Moving frame k" : "Laboratory frame K"}, SI units
        {unitLayer === "gaussian" ? " (printed-name guide open)" : ""}
      </p>
      <svg
        role="img"
        aria-labelledby={`${id}-title ${id}-desc`}
        viewBox="0 0 340 220"
        width="100%"
        height="220"
        className="field-svg"
      >
        <title id={`${id}-title`}>
          {isMoving
            ? "Field projections in the moving frame k"
            : "Field projections in the laboratory frame K"}
        </title>
        <desc id={`${id}-desc`}>
          Electric field E, magnetic field B and force F projected onto the x–y plane. The three
          arrows use separate scales. The omitted z components and complete vectors are listed
          below; a zero projection does not mean a zero vector.
        </desc>

        {/* Background Grid */}
        <defs>
          <marker
            id={`${id}-arrow-e`}
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#e65100" />
          </marker>
          <marker
            id={`${id}-arrow-b`}
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0277bd" />
          </marker>
          <marker
            id={`${id}-arrow-f`}
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--sr08-force)" />
          </marker>
        </defs>

        <rect
          x="10"
          y="10"
          width="320"
          height="200"
          rx="8"
          fill="var(--panel)"
          stroke="var(--line)"
        />

        {/* Axes */}
        <line x1="30" y1={cy} x2="310" y2={cy} stroke="var(--line)" strokeDasharray="3 3" />
        <line x1={cx} y1="20" x2={cx} y2="200" stroke="var(--line)" strokeDasharray="3 3" />
        <text x="300" y={cy - 6} fontSize="10" fill="var(--muted)">
          {isMoving ? "ξ" : "x"}
        </text>
        <text x={cx + 6} y="30" fontSize="10" fill="var(--muted)">
          {isMoving ? "η" : "y"}
        </text>

        {/* Electric Field Vector E */}
        {E_active[0] !== 0 || E_active[1] !== 0 ? (
          <g>
            <line
              x1={cx}
              y1={cy}
              x2={ex}
              y2={ey}
              stroke="#e65100"
              strokeWidth="3"
              markerEnd={`url(#${id}-arrow-e)`}
            />
            <text x={ex + 8} y={ey} fontSize="12" fontWeight="bold" fill="#e65100">
              E{isMoving ? "′" : ""}
            </text>
          </g>
        ) : null}

        {/* Lorentz Force Vector F */}
        {F_active[0] !== 0 || F_active[1] !== 0 ? (
          <g>
            <line
              x1={cx}
              y1={cy}
              x2={fx}
              y2={fy}
              stroke="var(--sr08-force)"
              strokeWidth="2"
              markerEnd={`url(#${id}-arrow-f)`}
            />
            <text
              x={fx - 8}
              y={fy + 4}
              textAnchor="end"
              fontSize="10"
              fontWeight="bold"
              fill="var(--sr08-force)"
            >
              F {isMoving ? "′" : ""}
            </text>
          </g>
        ) : null}

        {B_active[0] !== 0 || B_active[1] !== 0 ? (
          <g>
            <line
              x1={cx}
              y1={cy}
              x2={bx}
              y2={by}
              stroke="#0277bd"
              strokeWidth="2"
              strokeDasharray="5 2"
              markerEnd={`url(#${id}-arrow-b)`}
            />
            <text x={bx + 6} y={by + 14} fontSize="12" fill="#0277bd">
              B{isMoving ? "′" : ""}
            </text>
          </g>
        ) : null}

        {/* Perpendicular / Parallel decomposition lines */}
        {decompose ? (
          <>
            <line
              x1={cx}
              y1={cy}
              x2={ex}
              y2={cy}
              stroke="#e65100"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
            <line
              x1={ex}
              y1={cy}
              x2={ex}
              y2={ey}
              stroke="#e65100"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
          </>
        ) : null}
      </svg>
      <p className="fine">
        The arrows show only x and y. E, B and F use separate scales, each shared between the two
        frames; compare a field with itself across frames, not one arrow’s length with another.
      </p>
      <p className="fine" data-field-projection-components>
        Ey{isMoving ? "′" : ""} = {display(E_active[1])} V/m. Out of this plane: Ez
        {isMoving ? "′" : ""} = {display(E_active[2])} V/m; Bz{isMoving ? "′" : ""} ={" "}
        <Sci value={B_active[2]} digits={3} /> T; Fz{isMoving ? "′" : ""} ={" "}
        <Sci value={F_active[2]} digits={3} /> N. A positive z component points toward you and a
        negative component away.
      </p>
    </div>
  );
}
