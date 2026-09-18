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
    <div data-view-id="lq-01-interference-plot">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.25rem",
          flexWrap: "wrap",
          gap: "0.25rem",
        }}
      >
        <h3
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--ink)",
            margin: 0,
          }}
        >
          Screen Intensity Profile ⟨I(y)⟩{" "}
          {delta !== 0 && (
            <span
              className="fine"
              style={{
                fontSize: "0.75rem",
                fontWeight: 400,
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              (δ = {(delta / Math.PI).toFixed(2)}π)
            </span>
          )}
        </h3>
        <span
          className="fine"
          style={{
            fontSize: "0.6875rem",
            fontFamily: "var(--font-mono, monospace)",
            padding: "0.125rem 0.5rem",
            borderRadius: "0.25rem",
            background: "var(--wash)",
            color: "var(--muted)",
            border: "1px solid var(--line)",
          }}
        >
          {readout === "time-average" ? "Time-Averaged" : "Instantaneous Snapshot"}
        </span>
      </div>
      <p
        className="fine"
        style={{
          fontSize: "0.75rem",
          marginBottom: "0.5rem",
        }}
      >
        Classical linear superposition of two coherent point sources. Central intensity:{" "}
        <strong style={{ fontFamily: "var(--font-mono, monospace)" }}>
          {centerIntensity.toFixed(3)}
        </strong>
        , Fringe visibility:{" "}
        <strong style={{ fontFamily: "var(--font-mono, monospace)" }}>
          {fringeVisibility.toFixed(3)}
        </strong>
        {fringeSpacing > 0 && (
          <span>
            , Fringe spacing:{" "}
            <strong style={{ fontFamily: "var(--font-mono, monospace)" }}>
              {fringeSpacing.toFixed(4)} m
            </strong>
          </span>
        )}
        .
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Interference intensity profile with center intensity ${centerIntensity.toFixed(2)} and fringe visibility ${fringeVisibility.toFixed(2)}`}
        style={{
          width: "100%",
          height: "auto",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "0.25rem",
        }}
      >
        {/* Grid lines and ticks */}
        <line
          x1={padding.left}
          y1={scaleY(0)}
          x2={width - padding.right}
          y2={scaleY(0)}
          stroke="var(--line)"
          strokeWidth="1.5"
        />
        <line
          x1={padding.left}
          y1={scaleY(4)}
          x2={width - padding.right}
          y2={scaleY(4)}
          stroke="var(--line)"
          strokeDasharray="4 4"
          strokeWidth="1"
        />
        <text
          x={padding.left - 6}
          y={scaleY(4) + 4}
          textAnchor="end"
          fontSize="10"
          fontFamily="monospace"
          fill="var(--muted)"
        >
          4.0 (max)
        </text>
        <text
          x={padding.left - 6}
          y={scaleY(2) + 4}
          textAnchor="end"
          fontSize="10"
          fontFamily="monospace"
          fill="var(--muted)"
        >
          2.0
        </text>
        <text
          x={padding.left - 6}
          y={scaleY(0) + 4}
          textAnchor="end"
          fontSize="10"
          fontFamily="monospace"
          fill="var(--muted)"
        >
          0.0
        </text>

        {/* Center vertical dashed line */}
        <line
          x1={padding.left + plotW / 2}
          y1={padding.top}
          x2={padding.left + plotW / 2}
          y2={height - padding.bottom}
          stroke="var(--line)"
          strokeDasharray="3 3"
          strokeWidth="1"
        />
        <text
          x={padding.left + plotW / 2}
          y={height - padding.bottom + 16}
          textAnchor="middle"
          fontSize="10"
          fontFamily="monospace"
          fill="var(--muted)"
        >
          y = 0 (Center)
        </text>

        {/* Intensity Curve */}
        {polylinePoints && (
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="var(--plot)"
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
          stroke="var(--accent)"
          strokeDasharray="2 2"
          strokeWidth="1.5"
        />
        <circle
          cx={selectedX}
          cy={selectedY}
          r="4.5"
          fill="var(--accent)"
          stroke="var(--paper)"
          strokeWidth="1.5"
        />
        <text
          x={selectedX}
          y={Math.max(padding.top + 12, selectedY - 10)}
          textAnchor="middle"
          fontSize="10"
          fontFamily="monospace"
          fontWeight="600"
          fill="var(--accent)"
        >
          {screenPosition}: {selectedIntensity.toFixed(2)} (Δr = {pathDifference.toFixed(2)}λ)
        </text>

        {/* X Axis Label */}
        <text
          x={width / 2}
          y={height - 6}
          textAnchor="middle"
          fontSize="11"
          fontWeight="500"
          fill="var(--muted)"
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
    <div data-view-id="lq-01-wavefront-view">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.25rem",
          flexWrap: "wrap",
          gap: "0.25rem",
        }}
      >
        <h3
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--ink)",
            margin: 0,
          }}
        >
          2D Wavefield Crest Superposition
        </h3>
        <span
          className="fine"
          style={{
            fontSize: "0.6875rem",
            fontFamily: "var(--font-mono, monospace)",
            color: "var(--muted)",
          }}
        >
          λ = {(wavelength * 1e9).toFixed(0)} nm | d = {separation.toFixed(1)} λ | δ ={" "}
          {(delta / Math.PI).toFixed(2)} π
        </span>
      </div>
      <p
        className="fine"
        style={{
          fontSize: "0.75rem",
          marginBottom: "0.5rem",
        }}
      >
        Concentric circular wavefront crests radiate from coherent sources{" "}
        <span style={{ fontFamily: "var(--font-mono, monospace)" }}>S₁</span> and{" "}
        <span style={{ fontFamily: "var(--font-mono, monospace)" }}>S₂</span>.
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Two-source wave superposition crest lines with separation ${separation} wavelengths and phase shift ${delta.toFixed(2)} radians`}
        style={{
          width: "100%",
          height: "auto",
          background: "var(--wash)",
          border: "1px solid var(--line)",
          borderRadius: "0.25rem",
          overflow: "hidden",
        }}
      >
        <defs>
          <clipPath id="field-clip">
            <rect x="0" y="0" width={width - 50} height={height} />
          </clipPath>
        </defs>

        <g clipPath="url(#field-clip)">
          {/* Source 1 Crests */}
          {Array.from({ length: numRings }).map((_, i) => {
            const r = (i + 1) * ringStep;
            return (
              <circle
                key={`s1-ring-${r}`}
                cx={srcX}
                cy={s1Y}
                r={r}
                fill="none"
                stroke="var(--plot)"
                strokeWidth="1.5"
                strokeOpacity={0.8 - i * 0.08}
              />
            );
          })}

          {/* Source 2 Crests */}
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
                stroke="var(--accent)"
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
            stroke="var(--line)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        </g>

        {/* Source pinheads */}
        <circle cx={srcX} cy={s1Y} r="4" fill="var(--plot)" />
        <text
          x={srcX - 8}
          y={s1Y + 3}
          textAnchor="end"
          fontSize="10"
          fontFamily="monospace"
          fontWeight="bold"
          fill="var(--plot)"
        >
          S₁
        </text>
        <circle cx={srcX} cy={s2Y} r="4" fill="var(--accent)" />
        <text
          x={srcX - 8}
          y={s2Y + 3}
          textAnchor="end"
          fontSize="10"
          fontFamily="monospace"
          fontWeight="bold"
          fill="var(--accent)"
        >
          S₂
        </text>

        {/* Observation Screen on Right */}
        <line
          x1={width - 50}
          y1="10"
          x2={width - 50}
          y2={height - 10}
          stroke="var(--ink)"
          strokeWidth="3"
        />
        <text x={width - 45} y="25" fontSize="10" fontFamily="monospace" fill="var(--muted)">
          Screen
        </text>
        <circle
          cx={width - 50}
          cy={centerY}
          r="5"
          fill={centerIntensity > 0.1 ? "var(--plot)" : "var(--muted)"}
        />
        <text
          x={width - 42}
          y={centerY + 4}
          fontSize="10"
          fontFamily="monospace"
          fontWeight="600"
          fill="var(--ink)"
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
    <div data-view-id="lq-01-spreading-view">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.25rem",
          flexWrap: "wrap",
          gap: "0.25rem",
        }}
      >
        <h3
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--ink)",
            margin: 0,
          }}
        >
          Spherical Energy Spreading &amp; Conservation
        </h3>
        <span
          className="fine"
          style={{
            fontSize: "0.6875rem",
            fontFamily: "var(--font-mono, monospace)",
            padding: "0.125rem 0.5rem",
            borderRadius: "0.25rem",
            background: "rgba(16, 185, 129, 0.15)",
            color: "var(--plot)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
          }}
        >
          ∮ I dA = {shellPower.toFixed(4)} W (P = {power.toFixed(1)} W)
        </span>
      </div>
      <p
        className="fine"
        style={{
          fontSize: "0.75rem",
          marginBottom: "0.5rem",
        }}
      >
        <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
          I(r) = P / (4πr²) = {intensity.toExponential(4)} W/m²
        </span>{" "}
        at distance{" "}
        <span style={{ fontFamily: "var(--font-mono, monospace)" }}>r = {radius.toFixed(2)} m</span>
        .
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Inverse square spherical spreading from source power ${power} Watts at radius ${radius} meters`}
        style={{
          width: "100%",
          height: "auto",
          background: "var(--wash)",
          border: "1px solid var(--line)",
          borderRadius: "0.25rem",
        }}
      >
        {/* Concentric Spherical Shells */}
        <circle
          cx={originX}
          cy={originY}
          r={r1Px}
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <circle
          cx={originX}
          cy={originY}
          r={r2Px}
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <circle
          cx={originX}
          cy={originY}
          r={r4Px}
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* Active radius shell */}
        <circle
          cx={originX}
          cy={originY}
          r={currentRPx}
          fill="none"
          stroke="var(--plot)"
          strokeWidth="2.5"
        />

        {/* Central Point Source */}
        <circle cx={originX} cy={originY} r="6" fill="var(--accent)" />
        <text
          x={originX}
          y={originY - 12}
          textAnchor="middle"
          fontSize="10"
          fontFamily="monospace"
          fontWeight="bold"
          fill="var(--accent)"
        >
          Source (P = {power} W)
        </text>

        {/* Radius ray vector */}
        <line
          x1={originX}
          y1={originY}
          x2={originX + currentRPx}
          y2={originY}
          stroke="var(--plot)"
          strokeWidth="2"
        />
        <circle cx={originX + currentRPx} cy={originY} r="4" fill="var(--plot)" />
        <text
          x={originX + currentRPx / 2}
          y={originY - 6}
          textAnchor="middle"
          fontSize="10"
          fontFamily="monospace"
          fill="var(--plot)"
        >
          r = {radius.toFixed(1)} m
        </text>

        {/* Aperture at r */}
        <rect
          x={originX + currentRPx - 2}
          y={originY - 10}
          width="4"
          height="20"
          fill="var(--accent)"
          rx="1"
        />

        {/* Data readout panel on right of SVG */}
        <g transform="translate(260, 25)">
          <rect x="0" y="0" width="200" height="200" fill="var(--panel)" stroke="var(--line)" rx="6" />
          <text x="12" y="24" fontSize="11" fill="var(--ink)" fontWeight="600">
            Radiant Power Accounting
          </text>

          <text x="12" y="52" fontSize="10" fontFamily="monospace" fill="var(--muted)">
            Source Power P:
          </text>
          <text
            x="188"
            y="52"
            textAnchor="end"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
            fill="var(--ink)"
          >
            {power.toFixed(2)} W
          </text>

          <text x="12" y="78" fontSize="10" fontFamily="monospace" fill="var(--muted)">
            Intensity I(r):
          </text>
          <text
            x="188"
            y="78"
            textAnchor="end"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
            fill="var(--ink)"
          >
            {intensity.toExponential(3)} W/m²
          </text>

          <text x="12" y="104" fontSize="10" fontFamily="monospace" fill="var(--muted)">
            Enclosed ∮ I dA:
          </text>
          <text
            x="188"
            y="104"
            textAnchor="end"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
            fill="var(--plot)"
          >
            {shellPower.toFixed(4)} W
          </text>

          <line x1="12" y1="118" x2="188" y2="118" stroke="var(--line)" />

          <text x="12" y="138" fontSize="10" fontFamily="monospace" fill="var(--muted)">
            1 cm² Aperture I·S:
          </text>
          <text
            x="188"
            y="138"
            textAnchor="end"
            fontSize="10"
            fontFamily="monospace"
            fill="var(--ink)"
          >
            {smallAperturePower.toExponential(3)} W
          </text>

          <text x="12" y="162" fontSize="10" fontFamily="monospace" fill="var(--muted)">
            Exact Disk Power:
          </text>
          <text
            x="188"
            y="162"
            textAnchor="end"
            fontSize="10"
            fontFamily="monospace"
            fill="var(--ink)"
          >
            {exactDiskPower.toExponential(3)} W
          </text>

          <text x="12" y="186" fontSize="9" fontFamily="monospace" fill="var(--muted)">
            Gauss–Legendre quad identity
          </text>
        </g>
      </svg>
    </div>
  );
}
