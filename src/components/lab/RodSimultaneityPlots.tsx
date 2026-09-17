export type FrameId = "K" | "k";

export interface RodStripPlotProps {
  rodRestFrame: FrameId;
  measuringFrame: FrameId;
  v: number;
  L0: number;
  measuredLength: number | null;
  isSimultaneous: boolean;
  dxK: number;
  dtK: number;
  dxk: number;
  dtk: number;
}

export function RodStripPlot({
  rodRestFrame,
  measuringFrame,
  v,
  L0,
  measuredLength,
  isSimultaneous,
  dxK,
  dtK,
  dxk,
  dtk,
}: RodStripPlotProps) {
  const width = 480;
  const height = 220;
  const padding = { left: 40, right: 40, top: 30, bottom: 30 };
  const plotW = width - padding.left - padding.right;

  const maxSpan = Math.max(20, L0 * 1.5);
  const scaleX = (x: number) => padding.left + (x / maxSpan) * plotW;

  const g = 1 / Math.sqrt(1 - v * v);
  const contractedL = L0 / g;

  return (
    <div className="plot-container" data-view-id="sr-03-strip-view">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Spatial Rod Strip Projection
        </h3>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300">
          Rest: frame {rodRestFrame} | Measuring: frame {measuringFrame} | v = {v.toFixed(2)}c
        </span>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
        Coordinate measurement: positions of both ends taken at{" "}
        <strong>one single time of the measuring frame</strong>. (Coordinate geometry, not what an
        optical camera sees).
      </p>
      <div className="text-[11px] font-mono text-slate-400 mb-2">
        Interval: Δx={(measuringFrame === "K" ? dxK : dxk).toFixed(2)} ls, cΔt=
        {(measuringFrame === "K" ? dtK : dtk).toFixed(2)} s{" "}
        {isSimultaneous ? (
          <span className="text-emerald-400">
            [Simultaneous: L ={" "}
            {measuredLength !== null ? `${measuredLength.toFixed(2)} ls` : "refused"}]
          </span>
        ) : (
          <span className="text-amber-400">[Non-simultaneous: length measurement refused]</span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto bg-slate-900 border border-slate-800 rounded overflow-hidden"
        role="img"
        aria-label="Spatial rod strip showing length in platform and moving frames"
      >
        {/* Strip 1: Frame K (Platform) */}
        <g transform="translate(0, 50)">
          <text
            x={padding.left}
            y="-12"
            className="text-[11px] fill-slate-300 font-semibold font-mono"
          >
            Frame K (Platform at rest):
          </text>
          {/* Axis line */}
          <line
            x1={padding.left}
            y1="10"
            x2={width - padding.right}
            y2="10"
            stroke="#475569"
            strokeWidth="1.5"
          />
          {/* Rod representation in K */}
          <rect
            x={scaleX(0)}
            y="0"
            width={scaleX(rodRestFrame === "K" ? L0 : contractedL) - scaleX(0)}
            height="20"
            rx="3"
            fill={rodRestFrame === "K" ? "#38bdf8" : "#f59e0b"}
            fillOpacity="0.85"
            stroke="#0284c7"
            strokeWidth="1.5"
          />
          {/* Rod length label */}
          <text
            x={scaleX((rodRestFrame === "K" ? L0 : contractedL) / 2)}
            y="14"
            textAnchor="middle"
            className="text-[10px] fill-slate-950 font-mono font-bold"
          >
            {rodRestFrame === "K"
              ? `${L0.toFixed(1)} ls (Proper L₀)`
              : `${contractedL.toFixed(2)} ls (L₀/γ)`}
          </text>
          {/* Endpoint markers */}
          <circle cx={scaleX(0)} cy="10" r="3.5" fill="#ef4444" />
          <circle
            cx={scaleX(rodRestFrame === "K" ? L0 : contractedL)}
            cy="10"
            r="3.5"
            fill="#ef4444"
          />
        </g>

        {/* Strip 2: Frame k (Moving frame) */}
        <g transform="translate(0, 140)">
          <div className="flex justify-between">
            <text
              x={padding.left}
              y="-12"
              className="text-[11px] fill-slate-300 font-semibold font-mono"
            >
              Frame k (Moving at v = {v.toFixed(2)}c):
            </text>
          </div>
          {/* Axis line */}
          <line
            x1={padding.left}
            y1="10"
            x2={width - padding.right}
            y2="10"
            stroke="#475569"
            strokeWidth="1.5"
          />
          {/* Rod representation in k */}
          <rect
            x={scaleX(0)}
            y="0"
            width={scaleX(rodRestFrame === "k" ? L0 : contractedL) - scaleX(0)}
            height="20"
            rx="3"
            fill={rodRestFrame === "k" ? "#38bdf8" : "#f59e0b"}
            fillOpacity="0.85"
            stroke="#d97706"
            strokeWidth="1.5"
          />
          {/* Rod length label */}
          <text
            x={scaleX((rodRestFrame === "k" ? L0 : contractedL) / 2)}
            y="14"
            textAnchor="middle"
            className="text-[10px] fill-slate-950 font-mono font-bold"
          >
            {rodRestFrame === "k"
              ? `${L0.toFixed(1)} ls (Proper L₀)`
              : `${contractedL.toFixed(2)} ls (L₀/γ)`}
          </text>
          {/* Endpoint markers */}
          <circle cx={scaleX(0)} cy="10" r="3.5" fill="#ef4444" />
          <circle
            cx={scaleX(rodRestFrame === "k" ? L0 : contractedL)}
            cy="10"
            r="3.5"
            fill="#ef4444"
          />
        </g>
      </svg>
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
}

export function MinkowskiDiagramPlot({
  v,
  L0,
  endpointPairId,
  measuringFrame,
  rodRestFrame,
  dxK,
  dtK,
  dxk,
  dtk,
}: MinkowskiDiagramPlotProps) {
  const width = 480;
  const height = 280;
  const originX = 140;
  const originY = 220;
  const scale = 14; // pixels per light-second / second

  const g = 1 / Math.sqrt(1 - v * v);

  // Compute endpoint events E1 and E2 in K
  const e1K = { t: 0, x: 0 };
  const e2K = { t: dtK, x: dxK };

  // Light cones (at 45 degrees)
  const lcLen = 180;

  return (
    <div className="plot-container" data-view-id="sr-03-minkowski-diagram">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Spacetime Event Diagram
        </h3>
        <span className="text-[10px] text-slate-500 font-mono">
          Pair: {endpointPairId} | Rest: {rodRestFrame} | Measuring: {measuringFrame} | γ ={" "}
          {g.toFixed(2)} | L₀ = {L0.toFixed(1)} ls
        </span>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
        Spacetime coordinates: light lines at 45°. Boosted axes $x'$ and $ct'$ tilt toward the light
        cone by angle $\theta = \arctan(v/c)$.
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto bg-slate-900 border border-slate-800 rounded overflow-hidden"
        role="img"
        aria-label="Minkowski spacetime diagram with light cones and events"
      >
        {/* Light Cone (45 degrees) */}
        <line
          x1={originX - lcLen}
          y1={originY + lcLen}
          x2={originX + lcLen}
          y2={originY - lcLen}
          stroke="#38bdf8"
          strokeWidth="1"
          strokeDasharray="4 3"
          strokeOpacity="0.4"
        />
        <line
          x1={originX - lcLen}
          y1={originY - lcLen}
          x2={originX + lcLen}
          y2={originY + lcLen}
          stroke="#38bdf8"
          strokeWidth="1"
          strokeDasharray="4 3"
          strokeOpacity="0.4"
        />

        {/* Frame K Axes (Unprimed) */}
        {/* x axis */}
        <line
          x1={originX - 40}
          y1={originY}
          x2={originX + 280}
          y2={originY}
          stroke="#94a3b8"
          strokeWidth="1.5"
        />
        <text
          x={originX + 285}
          y={originY + 4}
          className="text-[10px] fill-slate-300 font-mono font-bold"
        >
          x (ls)
        </text>

        {/* ct axis */}
        <line
          x1={originX}
          y1={originY + 40}
          x2={originX}
          y2={originY - 200}
          stroke="#94a3b8"
          strokeWidth="1.5"
        />
        <text
          x={originX - 4}
          y={originY - 205}
          className="text-[10px] fill-slate-300 font-mono font-bold"
        >
          ct (s)
        </text>

        {/* Frame k Axes (Boosted, Primed) */}
        {/* x' axis: t = v*x/c^2 => Y = originY - scale * (v * (X - originX)/scale) */}
        <line
          x1={originX - 40}
          y1={originY + 40 * v}
          x2={originX + 260}
          y2={originY - 260 * v}
          stroke="#f59e0b"
          strokeWidth="1.5"
          strokeDasharray="5 3"
        />
        <text
          x={originX + 265}
          y={originY - 260 * v}
          className="text-[10px] fill-amber-400 font-mono font-bold"
        >
          x'
        </text>

        {/* ct' axis: x = v*t => X = originX + scale * (v * (originY - Y)/scale) */}
        <line
          x1={originX - 40 * v}
          y1={originY + 40}
          x2={originX + 180 * v}
          y2={originY - 180}
          stroke="#f59e0b"
          strokeWidth="1.5"
          strokeDasharray="5 3"
        />
        <text
          x={originX + 180 * v + 4}
          y={originY - 185}
          className="text-[10px] fill-amber-400 font-mono font-bold"
        >
          ct'
        </text>

        {/* Event E1 */}
        <circle cx={originX + e1K.x * scale} cy={originY - e1K.t * scale} r="5" fill="#10b981" />
        <text
          x={originX + e1K.x * scale - 18}
          y={originY - e1K.t * scale - 8}
          className="text-[11px] fill-emerald-400 font-mono font-bold"
        >
          E₁ (0,0)
        </text>

        {/* Event E2 */}
        <circle cx={originX + e2K.x * scale} cy={originY - e2K.t * scale} r="5" fill="#f43f5e" />
        <text
          x={originX + e2K.x * scale + 8}
          y={originY - e2K.t * scale - 8}
          className="text-[11px] fill-rose-400 font-mono font-bold"
        >
          E₂ ({e2K.x.toFixed(1)}, {e2K.t.toFixed(1)}) | k: ({dxk.toFixed(1)}, {dtk.toFixed(1)})
        </text>

        {/* Connecting vector between E1 and E2 */}
        <line
          x1={originX + e1K.x * scale}
          y1={originY - e1K.t * scale}
          x2={originX + e2K.x * scale}
          y2={originY - e2K.t * scale}
          stroke="#e2e8f0"
          strokeWidth="1.5"
          strokeDasharray="2 2"
        />
      </svg>
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
  const width = 480;
  const height = 180;
  const centerX = width / 2;
  const centerY = height / 2;
  const scale = 50 / Math.max(1, radius);

  const rx = longitudinal * scale;
  const ry = transverseY * scale;

  return (
    <div className="plot-container" data-view-id="sr-03-ellipsoid-view">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Moving Sphere Measured as an Ellipsoid (§4)
        </h3>
        <span className="text-[11px] font-mono text-slate-500">
          v = {v.toFixed(2)}c | Axes: ({longitudinal.toFixed(2)}, {transverseY.toFixed(2)},{" "}
          {transverseZ.toFixed(2)}) ls
        </span>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
        A sphere of radius R at rest in k, when measured from K at one instant of K, has axes{" "}
        <span className="font-mono">R/γ, R, R</span> ={" "}
        <span className="font-mono">R√(1 - v²/c²), R, R</span>.
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto bg-slate-900 border border-slate-800 rounded overflow-hidden"
        role="img"
        aria-label="Moving sphere measured as an ellipsoid"
      >
        {/* Rest sphere outline (dashed) */}
        <ellipse
          cx={centerX}
          cy={centerY}
          rx={radius * scale}
          ry={radius * scale}
          fill="none"
          stroke="#64748b"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />

        {/* Measured contracted ellipsoid */}
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

        {/* Axes markers */}
        <line
          x1={centerX - rx}
          y1={centerY}
          x2={centerX + rx}
          y2={centerY}
          stroke="#38bdf8"
          strokeWidth="1.5"
        />
        <line
          x1={centerX}
          y1={centerY - ry}
          x2={centerX}
          y2={centerY + ry}
          stroke="#38bdf8"
          strokeWidth="1.5"
        />

        {/* Axis labels */}
        <text
          x={centerX}
          y={centerY + ry + 16}
          textAnchor="middle"
          className="text-[10px] fill-slate-300 font-mono"
        >
          Transverse: {transverseY.toFixed(2)} ls
        </text>
        <text
          x={centerX + rx + 8}
          y={centerY + 4}
          className="text-[10px] fill-sky-400 font-mono font-bold"
        >
          Longitudinal: {longitudinal.toFixed(2)} ls
        </text>
      </svg>
    </div>
  );
}
