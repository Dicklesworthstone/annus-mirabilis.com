import type { FrameId } from "../../experiments/sr03/definition.ts";
import type { Sr03ReadingsView } from "../../experiments/sr03/readings.ts";

export type { FrameId };

/**
 * SR-03's three drawings. Each was a 480-unit SVG carrying its own sentences, so on a 390px phone
 * every label rendered at 8.9px; the sentences are HTML now. The rod strips and the ellipsoid draw
 * no text at all, and the spacetime diagram keeps only short axis and event names, sized from
 * --sr03-label, which rodSimultaneityLab.css raises on a phone.
 */
const FRAME_NAME: Readonly<Record<FrameId, string>> = {
  K: "frame K, the platform",
  k: "frame k, the moving frame",
};

const diagramLabel = {
  fontSize: "var(--sr03-label, 13px)",
  fontFamily: "var(--font-sans)",
} as const;

export interface RodStripPlotProps {
  /** What the readings are and what the rod measures, from the owner (experiments/sr03/readings.ts). */
  readings: Sr03ReadingsView;
  rodRestFrame: FrameId;
  measuringFrame: FrameId;
  v: number;
  L0: number;
}

/**
 * The rod in K and in k, and the verdict on the two readings. Every length and every word about
 * what a distance is comes from the view model, which reads only the owner's outputs, so the
 * number set beside the drawn rod is the rod's and a platform distance is never offered as it
 * (am-sr03-default-readings-not-rod-ends-bf7w). Only the scale of the drawing is computed here.
 */
export function RodStripPlot({ readings, rodRestFrame, measuringFrame, v, L0 }: RodStripPlotProps) {
  const width = 300;
  const padding = { left: 12, right: 12 };
  const plotW = width - padding.left - padding.right;

  const maxSpan = Math.max(20, L0 * 1.5);
  const scaleX = (x: number) => padding.left + (x / maxSpan) * plotW;
  const lsText = (value: number | null) =>
    value === null ? "not computed" : `${value.toFixed(2)} ls`;

  const strips = readings.strips.map((strip) => ({
    ...strip,
    drawn: strip.length ?? 0,
    words: (
      <>
        <strong>{lsText(strip.length)}</strong>
        {strip.atRest ? ", the proper length L₀" : ", L₀/γ"}
      </>
    ),
  }));

  return (
    <div data-view-id="sr-03-strip-view" className="sr03-figure">
      <h3 className="sr03-figure-title">The rod&apos;s length in the two frames</h3>
      <p className="fine sr03-figure-note">
        The rod is at rest in {FRAME_NAME[rodRestFrame]}, and {FRAME_NAME[measuringFrame]}, measures
        it, at v = {v.toFixed(2)}c. A length is the distance between the two ends read at{" "}
        <strong>one time of the measuring frame</strong>: coordinate geometry, not what a camera
        sees.
      </p>
      <p className="fine sr03-figure-note">
        The two readings are Δx = {lsText(readings.dx)} and cΔt = {lsText(readings.cdt)} apart in
        frame {measuringFrame}.{" "}
        <strong
          className={readings.simultaneous ? "sr03-verdict" : "sr03-verdict sr03-verdict-refused"}
          data-rod-ends={String(readings.rodEnds)}
          data-readings-kind={readings.kind}
        >
          {readings.verdict}
        </strong>
      </p>
      {strips.map((strip) => (
        <div
          key={strip.frame}
          className="sr03-strip"
          data-rod-frame={strip.frame}
          data-rod-length={strip.length ?? undefined}
        >
          <p className="sr03-strip-label">
            {strip.frame === "K"
              ? "Frame K, the platform: "
              : `Frame k, moving at ${v.toFixed(2)}c: `}
            {strip.words}
          </p>
          <svg
            viewBox={`0 0 ${width} 30`}
            role="img"
            aria-label={`The rod in frame ${strip.frame}: ${strip.length === null ? "not computed" : `${strip.length.toFixed(2)} light-seconds`}`}
            className="sr03-strip-svg"
          >
            <line
              x1={padding.left}
              y1="15"
              x2={width - padding.right}
              y2="15"
              stroke="var(--line)"
              strokeWidth="1.5"
            />
            <rect
              x={scaleX(0)}
              y="5"
              width={scaleX(strip.drawn) - scaleX(0)}
              height="20"
              rx="3"
              fill={strip.atRest ? "#38bdf8" : "#f59e0b"}
              fillOpacity="0.85"
              stroke={strip.frame === "K" ? "#0284c7" : "#d97706"}
              strokeWidth="1.5"
            />
            <circle cx={scaleX(0)} cy="15" r="3.5" fill="#ef4444" />
            <circle cx={scaleX(strip.drawn)} cy="15" r="3.5" fill="#ef4444" />
          </svg>
        </div>
      ))}
    </div>
  );
}

export interface MinkowskiDiagramPlotProps {
  v: number;
  L0: number;
  endpointPairId: string;
  measuringFrame: FrameId;
  rodRestFrame: FrameId;
  dxK: number;
  dtK: number;
  dxk: number;
  dtk: number;
  /**
   * A predict gate's attribute (PredictGate.tsx). E₂'s coordinates in k give dt′, the first
   * prompt's answer, so that half of the note waits; the axes, events and K coordinates stay.
   */
  response?: Readonly<{ "data-predict-response": "shown" | "awaiting" }>;
}

export function MinkowskiDiagramPlot({
  v,
  L0,
  endpointPairId: _endpointPairId,
  measuringFrame: _measuringFrame,
  rodRestFrame: _rodRestFrame,
  dxK,
  dtK,
  dxk,
  dtk,
  response,
}: MinkowskiDiagramPlotProps) {
  const width = 480;
  const height = 280;
  const originX = 140;
  const originY = 220;
  const scale = 14; // pixels per light-second

  const g = 1 / Math.sqrt(1 - v * v);

  const e1K = { t: 0, x: 0 };
  const e2K = { t: dtK, x: dxK };

  // Light lines at 45 degrees
  const lcLen = 180;

  return (
    <div data-view-id="sr-03-minkowski-diagram" className="sr03-figure">
      <h3 className="sr03-figure-title">Spacetime event diagram of the two end readings</h3>
      <p className="fine sr03-figure-note">
        Light lines run at 45°. The moving frame&apos;s axes x′ and ct′ tilt toward them by
        arctan(v/c). Here γ = {g.toFixed(2)} and L₀ = {L0.toFixed(1)} ls.
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Spacetime diagram: E₁ at the origin, E₂ at x = ${e2K.x.toFixed(1)}, ct = ${e2K.t.toFixed(1)} light-seconds in frame K`}
        className="sr03-diagram-svg"
      >
        {/* Light lines */}
        <line
          x1={originX - lcLen}
          y1={originY + lcLen}
          x2={originX + lcLen}
          y2={originY - lcLen}
          stroke="#0284c7"
          strokeWidth="1"
          strokeDasharray="4 3"
          strokeOpacity="0.6"
        />
        <line
          x1={originX - lcLen}
          y1={originY - lcLen}
          x2={originX + lcLen}
          y2={originY + lcLen}
          stroke="#0284c7"
          strokeWidth="1"
          strokeDasharray="4 3"
          strokeOpacity="0.6"
        />

        {/* Frame K axes. They are one of the two frames being compared, so they take --muted
            (5.98:1 on the light paper) rather than the rule colour, --line, in which they stood at
            1.45:1: a guide's colour for half of the diagram's argument. */}
        <line
          x1={originX - 40}
          y1={originY}
          x2={originX + 280}
          y2={originY}
          stroke="var(--muted)"
          strokeWidth="1.5"
        />
        <text x={originX + 285} y={originY + 5} fill="var(--ink)" style={diagramLabel}>
          x
        </text>
        <line
          x1={originX}
          y1={originY + 40}
          x2={originX}
          y2={originY - 200}
          stroke="var(--muted)"
          strokeWidth="1.5"
        />
        <text x={originX + 8} y={originY - 190} fill="var(--ink)" style={diagramLabel}>
          ct
        </text>

        {/* Frame k axes, tilted */}
        <line
          x1={originX - 40}
          y1={originY + 40 * v}
          x2={originX + 260}
          y2={originY - 260 * v}
          stroke="#d97706"
          strokeWidth="1.5"
          strokeDasharray="5 3"
        />
        <text x={originX + 265} y={originY - 260 * v} fill="var(--ink)" style={diagramLabel}>
          x′
        </text>
        <line
          x1={originX - 40 * v}
          y1={originY + 40}
          x2={originX + 180 * v}
          y2={originY - 180}
          stroke="#d97706"
          strokeWidth="1.5"
          strokeDasharray="5 3"
        />
        <text x={originX + 180 * v + 8} y={originY - 176} fill="var(--ink)" style={diagramLabel}>
          ct′
        </text>

        {/* The two events */}
        <line
          x1={originX + e1K.x * scale}
          y1={originY - e1K.t * scale}
          x2={originX + e2K.x * scale}
          y2={originY - e2K.t * scale}
          stroke="var(--muted)"
          strokeWidth="1.5"
          strokeDasharray="2 2"
        />
        <circle
          cx={originX + e1K.x * scale}
          cy={originY - e1K.t * scale}
          r="5"
          fill="var(--sr03-event-1)"
        />
        <text
          x={originX + e1K.x * scale - 10}
          y={originY - e1K.t * scale + 24}
          textAnchor="end"
          fontWeight="bold"
          fill="var(--ink)"
          style={diagramLabel}
        >
          E₁
        </text>
        <circle cx={originX + e2K.x * scale} cy={originY - e2K.t * scale} r="5" fill="#f43f5e" />
        <text
          x={originX + e2K.x * scale + 10}
          y={originY - e2K.t * scale - 10}
          fontWeight="bold"
          fill="var(--ink)"
          style={diagramLabel}
        >
          E₂
        </text>
      </svg>
      <p className="fine sr03-figure-note">
        Axes in light-seconds. E₁ is at the origin in both frames. E₂ is at (x, ct) = (
        {e2K.x.toFixed(1)}, {e2K.t.toFixed(1)}) in frame K
        <span {...response}>
          {" "}
          and (x′, ct′) = ({dxk.toFixed(1)}, {dtk.toFixed(1)}) in frame k
        </span>
        .
      </p>
    </div>
  );
}

export interface SphereEllipsoidPlotProps {
  radius: number;
  v: number;
  longitudinal: number;
  transverseY: number;
  transverseZ: number;
}

export function SphereEllipsoidPlot({
  radius,
  v,
  longitudinal,
  transverseY,
  transverseZ,
}: SphereEllipsoidPlotProps) {
  const width = 300;
  const height = 140;
  const centerX = width / 2;
  const centerY = height / 2;
  const scale = 55 / Math.max(1, radius);

  const rx = longitudinal * scale;
  const ry = transverseY * scale;

  return (
    <div data-view-id="sr-03-ellipsoid-view" className="sr03-figure">
      <h3 className="sr03-figure-title">A moving sphere measured as an ellipsoid (§4)</h3>
      <p className="fine sr03-figure-note">
        A sphere of radius R at rest in k, measured from K at one instant of K, has axes R/γ, R and
        R, that is R√(1 − v²/c²), R and R.
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`The sphere measured from K at ${v.toFixed(2)}c: longitudinal axis ${longitudinal.toFixed(2)} light-seconds, transverse ${transverseY.toFixed(2)}`}
        className="sr03-ellipsoid-svg"
      >
        {/* The sphere at rest, dashed */}
        <ellipse
          cx={centerX}
          cy={centerY}
          rx={radius * scale}
          ry={radius * scale}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        {/* The measured ellipsoid */}
        <ellipse
          cx={centerX}
          cy={centerY}
          rx={rx}
          ry={ry}
          fill="#38bdf8"
          fillOpacity="0.35"
          stroke="#0284c7"
          strokeWidth="2"
        />
        <line
          x1={centerX - rx}
          y1={centerY}
          x2={centerX + rx}
          y2={centerY}
          stroke="#0284c7"
          strokeWidth="1.5"
        />
        <line
          x1={centerX}
          y1={centerY - ry}
          x2={centerX}
          y2={centerY + ry}
          stroke="#0284c7"
          strokeWidth="1.5"
        />
      </svg>
      <p className="fine sr03-figure-note">
        At v = {v.toFixed(2)}c the measured axes are {longitudinal.toFixed(2)} ls along the motion
        (the horizontal line), and {transverseY.toFixed(2)} ls and {transverseZ.toFixed(2)} ls
        across it. The dashed circle is the sphere at rest.
      </p>
    </div>
  );
}
