import type { Lq01Parameters } from "../../experiments/lq01/definition.ts";

export type InterferencePlotProps = Readonly<{
  screenIntensity: Float64Array | null;
  centerIntensity: number;
  fringeVisibility: number;
  fringeSpacing: number;
  pathDifference: number;
  selectedIntensity: number;
  screenPosition: Lq01Parameters["screenPosition"];
  readout: Lq01Parameters["readout"];
  delta: number;
}>;

export function InterferencePlot({
  screenIntensity,
  centerIntensity,
  fringeVisibility,
  fringeSpacing,
  pathDifference,
  selectedIntensity,
  screenPosition,
  readout,
  delta,
}: InterferencePlotProps) {
  const width = 480;
  const height = 260;
  const padding = { top: 30, right: 30, bottom: 40, left: 55 };

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const maxVal = Math.max(4.2, centerIntensity * 1.1, selectedIntensity * 1.1);

  const scaleX = (idx: number, total: number) => padding.left + (idx / (total - 1)) * plotW;
  const scaleY = (val: number) => height - padding.bottom - (Math.max(0, val) / maxVal) * plotH;

  // Build SVG polyline points for intensity curve
  let polylinePoints = "";
  if (screenIntensity && screenIntensity.length > 0) {
    polylinePoints = Array.from(screenIntensity)
      .map(
        (val, idx) => `${scaleX(idx, screenIntensity.length).toFixed(1)},${scaleY(val).toFixed(1)}`,
      )
      .join(" ");
  }

  // Selected position x coordinate
  // nPoints=101, span=5*spacing. center is at idx 50.
  let selectedX = padding.left + plotW / 2;
  if (screenPosition === "first-min") {
    // 0.5 * spacing => offset is +0.5 / 10 = +5% of plot width
    selectedX = padding.left + plotW / 2 + (0.5 / 10) * plotW;
  } else if (screenPosition === "first-max") {
    // 1.0 * spacing => offset is +1.0 / 10 = +10% of plot width
    selectedX = padding.left + plotW / 2 + (1.0 / 10) * plotW;
  }

  const selectedY = scaleY(selectedIntensity);

  return (
    <div className="plot-container" data-view-id="lq-01-interference-plot">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Screen Intensity Profile ⟨I(y)⟩{" "}
          {delta !== 0 && (
            <span className="text-xs font-normal text-slate-500 font-mono">
              (δ = {(delta / Math.PI).toFixed(2)}π)
            </span>
          )}
        </h3>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          {readout === "time-average" ? "Time-Averaged" : "Instantaneous Snapshot"}
        </span>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
        Classical linear superposition of two coherent point sources. Central intensity:{" "}
        <strong className="font-mono">{centerIntensity.toFixed(3)}</strong>, Fringe visibility:{" "}
        <strong className="font-mono">{fringeVisibility.toFixed(3)}</strong>
        {fringeSpacing > 0 && (
          <span>
            , Fringe spacing: <strong className="font-mono">{fringeSpacing.toFixed(4)} m</strong>
          </span>
        )}
        .
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded"
        role="img"
        aria-label={`Interference intensity profile with center intensity ${centerIntensity.toFixed(2)} and fringe visibility ${fringeVisibility.toFixed(2)}`}
      >
        {/* Grid lines and ticks */}
        <line
          x1={padding.left}
          y1={scaleY(0)}
          x2={width - padding.right}
          y2={scaleY(0)}
          stroke="#94a3b8"
          strokeWidth="1.5"
        />
        <line
          x1={padding.left}
          y1={scaleY(4)}
          x2={width - padding.right}
          y2={scaleY(4)}
          stroke="#cbd5e1"
          strokeDasharray="4 4"
          strokeWidth="1"
        />
        <text
          x={padding.left - 6}
          y={scaleY(4) + 4}
          textAnchor="end"
          className="text-[10px] fill-slate-400 font-mono"
        >
          4.0 (max)
        </text>
        <text
          x={padding.left - 6}
          y={scaleY(2) + 4}
          textAnchor="end"
          className="text-[10px] fill-slate-400 font-mono"
        >
          2.0
        </text>
        <text
          x={padding.left - 6}
          y={scaleY(0) + 4}
          textAnchor="end"
          className="text-[10px] fill-slate-400 font-mono"
        >
          0.0
        </text>

        {/* Center vertical dashed line */}
        <line
          x1={padding.left + plotW / 2}
          y1={padding.top}
          x2={padding.left + plotW / 2}
          y2={height - padding.bottom}
          stroke="#cbd5e1"
          strokeDasharray="3 3"
          strokeWidth="1"
        />
        <text
          x={padding.left + plotW / 2}
          y={height - padding.bottom + 16}
          textAnchor="middle"
          className="text-[10px] fill-slate-500 font-mono"
        >
          y = 0 (Center)
        </text>

        {/* Intensity Curve */}
        {polylinePoints && (
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="#0284c7"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Selected Screen Position Marker */}
        <line
          x1={selectedX}
          y1={padding.top}
          x2={selectedX}
          y2={height - padding.bottom}
          stroke="#e11d48"
          strokeDasharray="2 2"
          strokeWidth="1.5"
        />
        <circle
          cx={selectedX}
          cy={selectedY}
          r="4.5"
          fill="#e11d48"
          stroke="#ffffff"
          strokeWidth="1.5"
        />
        <text
          x={selectedX}
          y={Math.max(padding.top + 12, selectedY - 10)}
          textAnchor="middle"
          className="text-[10px] fill-rose-600 font-semibold font-mono"
        >
          {screenPosition}: {selectedIntensity.toFixed(2)} (Δr = {pathDifference.toFixed(2)}λ)
        </text>

        {/* X Axis Label */}
        <text
          x={width / 2}
          y={height - 6}
          textAnchor="middle"
          className="text-[11px] fill-slate-500 font-medium"
        >
          Screen Position y (Fringes)
        </text>
      </svg>
    </div>
  );
}

export type WavefrontPlotProps = Readonly<{
  separation: number;
  wavelength: number;
  delta: number;
  centerIntensity: number;
}>;

export function WavefrontPlot({
  separation,
  wavelength,
  delta,
  centerIntensity,
}: WavefrontPlotProps) {
  const width = 480;
  const height = 260;

  const srcX = 60;
  const centerY = height / 2;
  const dNorm = Math.min(80, Math.max(10, separation * 12));
  const s1Y = centerY - dNorm / 2;
  const s2Y = centerY + dNorm / 2;

  const numRings = 7;
  const ringStep = 24;

  return (
    <div className="plot-container" data-view-id="lq-01-wavefront-view">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          2D Wavefield Crest Superposition
        </h3>
        <span className="text-[11px] font-mono text-slate-500">
          λ = {(wavelength * 1e9).toFixed(0)} nm | d = {separation.toFixed(1)} λ | δ ={" "}
          {(delta / Math.PI).toFixed(2)} π
        </span>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
        Concentric circular wavefront crests radiate from coherent coherent sources{" "}
        <span className="font-mono">S₁</span> and <span className="font-mono">S₂</span>.
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto bg-slate-900 border border-slate-800 rounded overflow-hidden"
        role="img"
        aria-label={`Two-source wave superposition crest lines with separation ${separation} wavelengths and phase shift ${delta.toFixed(2)} radians`}
      >
        <defs>
          <clipPath id="field-clip">
            <rect x="0" y="0" width={width - 50} height={height} />
          </clipPath>
        </defs>

        <g clipPath="url(#field-clip)">
          {/* Source 1 Crests (Sky) */}
          {Array.from({ length: numRings }).map((_, i) => {
            const r = (i + 1) * ringStep;
            return (
              <circle
                key={`s1-ring-${r}`}
                cx={srcX}
                cy={s1Y}
                r={r}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeOpacity={0.8 - i * 0.08}
              />
            );
          })}

          {/* Source 2 Crests (Amber/Indigo shift by delta) */}
          {Array.from({ length: numRings }).map((_, i) => {
            const phaseOffset = (delta / (2 * Math.PI)) * ringStep;
            const r = (i + 1) * ringStep + phaseOffset;
            if (r <= 0) return null;
            return (
              <circle
                key={`s2-ring-${r}`}
                cx={srcX}
                cy={s2Y}
                r={r}
                fill="none"
                stroke="#fbbf24"
                strokeWidth="1.5"
                strokeOpacity={0.8 - i * 0.08}
              />
            );
          })}

          {/* Center line */}
          <line
            x1={srcX}
            y1={centerY}
            x2={width - 50}
            y2={centerY}
            stroke="#94a3b8"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        </g>

        {/* Source pinheads */}
        <circle cx={srcX} cy={s1Y} r="4" fill="#38bdf8" />
        <text
          x={srcX - 8}
          y={s1Y + 3}
          textAnchor="end"
          className="text-[10px] fill-sky-400 font-mono font-bold"
        >
          S₁
        </text>
        <circle cx={srcX} cy={s2Y} r="4" fill="#fbbf24" />
        <text
          x={srcX - 8}
          y={s2Y + 3}
          textAnchor="end"
          className="text-[10px] fill-amber-400 font-mono font-bold"
        >
          S₂
        </text>

        {/* Observation Screen on Right */}
        <line
          x1={width - 50}
          y1="10"
          x2={width - 50}
          y2={height - 10}
          stroke="#e2e8f0"
          strokeWidth="3"
        />
        <text x={width - 45} y="25" className="text-[10px] fill-slate-400 font-mono">
          Screen
        </text>
        <circle
          cx={width - 50}
          cy={centerY}
          r="5"
          fill={centerIntensity > 0.1 ? "#38bdf8" : "#475569"}
        />
        <text
          x={width - 42}
          y={centerY + 4}
          className="text-[10px] fill-sky-300 font-mono font-semibold"
        >
          I₀ = {centerIntensity.toFixed(1)}
        </text>
      </svg>
    </div>
  );
}

export type SpreadingPlotProps = Readonly<{
  power: number;
  radius: number;
  intensity: number;
  shellPower: number;
  smallAperturePower: number;
  exactDiskPower: number;
}>;

export function SpreadingPlot({
  power,
  radius,
  intensity,
  shellPower,
  smallAperturePower,
  exactDiskPower,
}: SpreadingPlotProps) {
  const width = 480;
  const height = 260;

  const originX = 110;
  const originY = height / 2;

  const r1Px = 40;
  const r2Px = 80;
  const r4Px = 140;

  // Selected radius visualization mapping
  const currentRPx = Math.min(170, Math.max(25, 40 * Math.sqrt(radius)));

  return (
    <div className="plot-container" data-view-id="lq-01-spreading-view">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Spherical Energy Spreading & Conservation
        </h3>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
          ∮ I dA = {shellPower.toFixed(4)} W (P = {power.toFixed(1)} W)
        </span>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
        <span className="font-mono">I(r) = P / (4πr²) = {intensity.toExponential(4)} W/m²</span> at
        distance <span className="font-mono">r = {radius.toFixed(2)} m</span>.
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto bg-slate-900 border border-slate-800 rounded"
        role="img"
        aria-label={`Inverse square spherical spreading from source power ${power} Watts at radius ${radius} meters`}
      >
        {/* Concentric Spherical Shells */}
        <circle
          cx={originX}
          cy={originY}
          r={r1Px}
          fill="none"
          stroke="#0ea5e9"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <circle
          cx={originX}
          cy={originY}
          r={r2Px}
          fill="none"
          stroke="#0ea5e9"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <circle
          cx={originX}
          cy={originY}
          r={r4Px}
          fill="none"
          stroke="#0ea5e9"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* Active radius shell */}
        <circle
          cx={originX}
          cy={originY}
          r={currentRPx}
          fill="none"
          stroke="#34d399"
          strokeWidth="2.5"
        />

        {/* Central Point Source */}
        <circle cx={originX} cy={originY} r="6" fill="#f59e0b" />
        <text
          x={originX}
          y={originY - 12}
          textAnchor="middle"
          className="text-[10px] fill-amber-400 font-mono font-bold"
        >
          Source (P = {power} W)
        </text>

        {/* Radius ray vector */}
        <line
          x1={originX}
          y1={originY}
          x2={originX + currentRPx}
          y2={originY}
          stroke="#34d399"
          strokeWidth="2"
        />
        <circle cx={originX + currentRPx} cy={originY} r="4" fill="#34d399" />
        <text
          x={originX + currentRPx / 2}
          y={originY - 6}
          textAnchor="middle"
          className="text-[10px] fill-emerald-400 font-mono"
        >
          r = {radius.toFixed(1)} m
        </text>

        {/* Aperture at r */}
        <rect
          x={originX + currentRPx - 2}
          y={originY - 10}
          width="4"
          height="20"
          fill="#f43f5e"
          rx="1"
        />

        {/* Data readout panel on right of SVG */}
        <g transform="translate(260, 25)">
          <rect x="0" y="0" width="200" height="200" fill="#0f172a" stroke="#334155" rx="6" />
          <text x="12" y="24" className="text-[11px] fill-slate-300 font-semibold">
            Radiant Power Accounting
          </text>

          <text x="12" y="52" className="text-[10px] fill-slate-400 font-mono">
            Source Power P:
          </text>
          <text
            x="188"
            y="52"
            textAnchor="end"
            className="text-[10px] fill-amber-300 font-mono font-bold"
          >
            {power.toFixed(2)} W
          </text>

          <text x="12" y="78" className="text-[10px] fill-slate-400 font-mono">
            Intensity I(r):
          </text>
          <text
            x="188"
            y="78"
            textAnchor="end"
            className="text-[10px] fill-emerald-300 font-mono font-bold"
          >
            {intensity.toExponential(3)} W/m²
          </text>

          <text x="12" y="104" className="text-[10px] fill-slate-400 font-mono">
            Enclosed ∮ I dA:
          </text>
          <text
            x="188"
            y="104"
            textAnchor="end"
            className="text-[10px] fill-emerald-400 font-mono font-bold"
          >
            {shellPower.toFixed(4)} W
          </text>

          <line x1="12" y1="118" x2="188" y2="118" stroke="#334155" />

          <text x="12" y="138" className="text-[10px] fill-slate-400 font-mono">
            1 cm² Aperture I·S:
          </text>
          <text x="188" y="138" textAnchor="end" className="text-[10px] fill-sky-300 font-mono">
            {smallAperturePower.toExponential(3)} W
          </text>

          <text x="12" y="162" className="text-[10px] fill-slate-400 font-mono">
            Exact Disk Power:
          </text>
          <text x="188" y="162" textAnchor="end" className="text-[10px] fill-sky-300 font-mono">
            {exactDiskPower.toExponential(3)} W
          </text>

          <text x="12" y="186" className="text-[9px] fill-slate-500 font-mono">
            Gauss–Legendre quad identity
          </text>
        </g>
      </svg>
    </div>
  );
}
