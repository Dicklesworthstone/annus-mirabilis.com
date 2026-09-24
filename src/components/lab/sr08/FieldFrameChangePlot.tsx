"use client";

import type { PublishedResult } from "../../../experiments/store/instanceStore.ts";
import { fixed } from "../presentation.ts";
import { SciSvg } from "../Sci.tsx";
import "./sr08.css";

export interface FieldFrameChangePlotProps {
  readonly electricStationary?: PublishedResult;
  readonly electricMoving?: PublishedResult;
  readonly magneticStationary?: PublishedResult;
  readonly magneticMoving?: PublishedResult;
  readonly invariantDot?: PublishedResult;
  readonly invariantDiff?: PublishedResult;
  readonly gamma?: PublishedResult;
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

function extractScalar(res: PublishedResult | undefined): number {
  if (res?.status !== "value" || typeof res.value !== "number") {
    return 0;
  }
  return res.value;
}

export function FieldFrameChangePlot({
  electricStationary,
  electricMoving,
  magneticStationary,
  magneticMoving,
  invariantDot,
  invariantDiff,
  gamma,
  forceLab,
  forceComoving,
  frame,
  unitLayer,
  decompose,
}: FieldFrameChangePlotProps) {
  const E_stat = extractVector(electricStationary);
  const E_mov = extractVector(electricMoving);
  const B_stat = extractVector(magneticStationary);
  const B_mov = extractVector(magneticMoving);
  const F_stat = extractVector(forceLab);
  const F_mov = extractVector(forceComoving);

  const dot = extractScalar(invariantDot);
  const diff = extractScalar(invariantDiff);
  const g = extractScalar(gamma);

  const isMoving = frame === "moving";
  const E_active = isMoving ? E_mov : E_stat;
  const B_active = isMoving ? B_mov : B_stat;
  const F_active = isMoving ? F_mov : F_stat;

  // Scale vector arrows for 2D projection on xy plane
  const cx = 160;
  const cy = 110;
  const maxField = Math.max(1, Math.hypot(E_stat[0], E_stat[1]), Math.hypot(E_mov[0], E_mov[1]));
  const scaleE = 60 / maxField;

  const ex = cx + E_active[0] * scaleE;
  const ey = cy - E_active[1] * scaleE;

  const maxForce = Math.max(
    1e-25,
    Math.hypot(F_stat[0], F_stat[1]),
    Math.hypot(F_mov[0], F_mov[1]),
  );
  const scaleF = 35 / maxForce;
  const fx = cx + F_active[0] * scaleF;
  const fy = cy - F_active[1] * scaleF;

  return (
    <div className="field-plot-container">
      {/* The frame is named in HTML: as a badge inside the drawing its words ran past the badge
          and into the y-axis label. */}
      <p className="sr08-plot-frame">
        {isMoving ? "Moving frame k" : "Laboratory frame K"},{" "}
        {unitLayer === "si" ? "SI units" : "Gaussian units"}
      </p>
      <svg
        role="img"
        aria-labelledby="sr08-plot-title sr08-plot-desc"
        viewBox="0 0 340 220"
        width="100%"
        height="220"
        className="field-svg"
      >
        <title id="sr08-plot-title">
          {isMoving ? "Fields in the moving frame k" : "Fields in the laboratory frame K"}
        </title>
        <desc id="sr08-plot-desc">
          Vector representation of electric field E, magnetic field B, and Lorentz force F under
          Lorentz transformation.
        </desc>

        {/* Background Grid */}
        <defs>
          <marker
            id="arrow-e"
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
            id="arrow-b"
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
            id="arrow-f"
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
        <line
          x1={cx}
          y1={cy}
          x2={ex}
          y2={ey}
          stroke="#e65100"
          strokeWidth="3"
          markerEnd="url(#arrow-e)"
        />
        <text x={ex + 8} y={ey} fontSize="12" fontWeight="bold" fill="#e65100">
          E {isMoving ? "′" : ""} ({E_active[1].toFixed(2)} V/m)
        </text>

        {/* Lorentz Force Vector F */}
        {Math.hypot(F_active[0], F_active[1]) > 1e-25 ? (
          <g>
            <line
              x1={cx}
              y1={cy}
              x2={fx}
              y2={fy}
              stroke="var(--sr08-force)"
              strokeWidth="2"
              markerEnd="url(#arrow-f)"
            />
            <text
              x={fx - 8}
              y={fy + 4}
              textAnchor="end"
              fontSize="10"
              fontWeight="bold"
              fill="#2e7d32"
            >
              F {isMoving ? "′" : ""}
            </text>
          </g>
        ) : null}

        {/* Magnetic Field Vector B (or Z-out-of-plane indicator) */}
        {Math.abs(B_active[2]) > 1e-15 ? (
          <g transform={`translate(${cx + 40}, ${cy - 40})`}>
            <circle cx="0" cy="0" r="10" fill="none" stroke="#0277bd" strokeWidth="2" />
            {B_active[2] > 0 ? (
              <circle cx="0" cy="0" r="3" fill="#0277bd" />
            ) : (
              <>
                <line x1="-5" y1="-5" x2="5" y2="5" stroke="#0277bd" strokeWidth="2" />
                <line x1="5" y1="-5" x2="-5" y2="5" stroke="#0277bd" strokeWidth="2" />
              </>
            )}
            <text x="14" y="4" fontSize="11" fill="#0277bd" fontWeight="bold">
              B_z {isMoving ? "′" : ""}: <SciSvg value={B_active[2]} digits={3} /> T
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

        {/* Invariant Footer */}
        <text x="20" y="195" fontSize="10" fill="var(--muted)">
          E² - c²B² = {fixed(diff, 3)} | E·B = {fixed(dot, 3)} | γ ={" "}
          {g > 0 ? fixed(g, 4) : "1.0000"}
        </text>
      </svg>
    </div>
  );
}
