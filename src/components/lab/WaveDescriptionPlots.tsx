import type { Lq01Parameters } from "../../experiments/lq01/definition.ts";
import { fixed } from "./presentation.ts";
import { Sci } from "./Sci.tsx";

/*
 * Label size and colour. The site rule `svg[role="img"] text` sets every label's font-size and
 * fill, and a stylesheet rule beats an SVG presentation attribute, so fontSize="10" and fill="…"
 * on these <text> elements never applied: every label was --type-fine in --ink, which on the
 * dark wave field drew S₁, S₂ and the screen reading dark on dark. The size now comes from
 * waveDescriptionLab.css, and a label that needs its own colour sets it as a style, which does
 * beat the rule.
 */
const PROBE_LABEL: Readonly<Record<Lq01Parameters["screenPosition"], string>> = {
  center: "centre",
  "first-min": "first dark fringe",
  "first-max": "first bright fringe",
};

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
  // 272 tall with a 52-unit bottom margin (it was 260 and 40): the centre's tick label and the axis
  // title stood 18 units apart at this plot's text size and overlapped. The plot area is unchanged.
  const height = 272;
  const padding = { top: 30, right: 20, bottom: 52, left: 30 };

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
          Brightness across the screen, ⟨I(y)⟩{" "}
          {delta !== 0 && (
            <span
              className="fine"
              style={{
                fontSize: "var(--type-fine)",
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
            fontSize: "var(--type-fine)",
            fontFamily: "var(--font-mono, monospace)",
            padding: "0.125rem 0.5rem",
            borderRadius: "0.25rem",
            background: "var(--wash)",
            color: "var(--muted)",
            border: "1px solid var(--line)",
          }}
        >
          {readout === "time-average" ? "Averaged over many cycles" : "One instant"}
        </span>
      </div>
      <p
        className="fine"
        style={{
          fontSize: "var(--type-fine)",
          marginBottom: "0.5rem",
        }}
      >
        Two coherent point sources, added as waves. At the centre{" "}
        <strong style={{ fontFamily: "var(--font-mono, monospace)" }}>
          {fixed(centerIntensity, 3)}
        </strong>
        ; fringe visibility{" "}
        <strong style={{ fontFamily: "var(--font-mono, monospace)" }}>
          {fixed(fringeVisibility, 3)}
        </strong>
        {fringeSpacing > 0 && (
          <span>
            ; bright fringes{" "}
            <strong style={{ fontFamily: "var(--font-mono, monospace)" }}>
              {fringeSpacing.toFixed(1)} λ
            </strong>{" "}
            apart
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
          fontFamily="monospace"
          style={{ fill: "var(--muted)" }}
        >
          4
        </text>
        <text
          x={padding.left - 6}
          y={scaleY(2) + 4}
          textAnchor="end"
          fontFamily="monospace"
          style={{ fill: "var(--muted)" }}
        >
          2
        </text>
        <text
          x={padding.left - 6}
          y={scaleY(0) + 4}
          textAnchor="end"
          fontFamily="monospace"
          style={{ fill: "var(--muted)" }}
        >
          0
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
          fontFamily="monospace"
          style={{ fill: "var(--muted)" }}
        >
          y = 0, centre
        </text>

        {/* Intensity Curve (Data trace - kept literal sky blue) */}
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

        {/* Selected Screen Position Marker (Data probe - kept literal rose) */}
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
          stroke="var(--paper)"
          strokeWidth="1.5"
        />
        <text
          x={selectedX}
          y={Math.max(padding.top + 12, selectedY - 10)}
          textAnchor="middle"
          fontFamily="monospace"
          fontWeight="600"
          style={{ fill: "#e11d48" }}
        >
          {PROBE_LABEL[screenPosition]}: {selectedIntensity.toFixed(2)} (Δr ={" "}
          {pathDifference.toFixed(2)}λ)
        </text>

        {/* X Axis Label */}
        <text
          x={width / 2}
          y={height - 6}
          textAnchor="middle"
          fontWeight="500"
          style={{ fill: "var(--muted)" }}
        >
          Position on the screen, y
        </text>
      </svg>
    </div>
  );
}

export type WavefrontPlotProps = Readonly<{
  separation: number;
  delta: number;
  centerIntensity: number;
}>;

export function WavefrontPlot({ separation, delta, centerIntensity }: WavefrontPlotProps) {
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
          Wave crests from the two sources
        </h3>
        <span
          className="fine"
          style={{
            fontSize: "var(--type-fine)",
            fontFamily: "var(--font-mono, monospace)",
            color: "var(--muted)",
          }}
        >
          d = {separation.toFixed(1)} λ · δ = {(delta / Math.PI).toFixed(2)}π
        </span>
      </div>
      <p
        className="fine"
        style={{
          fontSize: "var(--type-fine)",
          marginBottom: "0.5rem",
        }}
      >
        Circles of crests spread from the coherent sources{" "}
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
          background: "var(--plot-darkfield)",
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
          {/* Source 1 Crests (Data datum - kept literal sky blue) */}
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

          {/* Source 2 Crests (Data datum - kept literal amber) */}
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
            stroke="var(--line)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        </g>

        {/* Source pinheads (Data datums - kept literal) */}
        <circle cx={srcX} cy={s1Y} r="4" fill="#38bdf8" />
        <text
          x={srcX - 8}
          y={s1Y + 3}
          textAnchor="end"
          fontFamily="monospace"
          fontWeight="bold"
          style={{ fill: "#38bdf8" }}
        >
          S₁
        </text>
        <circle cx={srcX} cy={s2Y} r="4" fill="#fbbf24" />
        <text
          x={srcX - 8}
          y={s2Y + 3}
          textAnchor="end"
          fontFamily="monospace"
          fontWeight="bold"
          style={{ fill: "#fbbf24" }}
        >
          S₂
        </text>

        {/* Observation Screen on Right */}
        <line
          x1={width - 50}
          y1="10"
          x2={width - 50}
          y2={height - 10}
          stroke="var(--line)"
          strokeWidth="3"
        />
        <text
          x={width - 58}
          y="25"
          textAnchor="end"
          fontFamily="monospace"
          style={{ fill: "var(--muted)" }}
        >
          Screen
        </text>
        <circle
          cx={width - 50}
          cy={centerY}
          r="5"
          fill={centerIntensity > 0.1 ? "#38bdf8" : "var(--muted)"}
        />
        {/* The field is dark in both themes, so the reading takes the sky of its marker dot. */}
        <text
          x={width - 58}
          y={centerY - 10}
          textAnchor="end"
          fontFamily="monospace"
          fontWeight="600"
          style={{ fill: "#38bdf8" }}
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
}>;

export function SpreadingPlot({ power, radius, intensity, shellPower }: SpreadingPlotProps) {
  const width = 480;
  const height = 260;

  const originX = width / 2;
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
          One source, its energy spread over spheres
        </h3>
        <span
          className="fine"
          style={{
            fontSize: "var(--type-fine)",
            fontFamily: "var(--font-mono, monospace)",
            padding: "0.125rem 0.5rem",
            borderRadius: "0.25rem",
            background: "rgba(16, 185, 129, 0.15)",
            color: "var(--plot)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
          }}
        >
          ∫ I dA over the sphere = {fixed(shellPower, 4)} W (P = {power.toFixed(1)} W)
        </span>
      </div>
      <p
        className="fine"
        style={{
          fontSize: "var(--type-fine)",
          marginBottom: "0.5rem",
        }}
      >
        <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
          I(r) = P / (4πr²) = <Sci value={intensity} digits={4} /> W/m²
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
          background: "var(--plot-darkfield)",
          border: "1px solid var(--line)",
          borderRadius: "0.25rem",
        }}
      >
        {/* Concentric Spherical Shells (Data datum - kept literal sky) */}
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

        {/* Active radius shell (Data datum - kept literal emerald) */}
        <circle
          cx={originX}
          cy={originY}
          r={currentRPx}
          fill="none"
          stroke="#34d399"
          strokeWidth="2.5"
        />

        {/* Central Point Source (Data datum - kept literal amber) */}
        <circle cx={originX} cy={originY} r="6" fill="#f59e0b" />
        <text
          x={originX}
          y={originY - 12}
          textAnchor="middle"
          fontFamily="monospace"
          fontWeight="bold"
          style={{ fill: "#f59e0b" }}
        >
          Source (P = {power} W)
        </text>

        {/* Radius ray vector (Data datum - kept literal emerald) */}
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
          fontFamily="monospace"
          style={{ fill: "#34d399" }}
        >
          r = {radius.toFixed(1)} m
        </text>

        {/* Aperture at r (Data datum - kept literal rose) */}
        <rect
          x={originX + currentRPx - 2}
          y={originY - 10}
          width="4"
          height="20"
          fill="#f43f5e"
          rx="1"
        />
      </svg>
    </div>
  );
}
