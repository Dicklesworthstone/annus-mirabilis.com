export interface DopplerAberrationPlotProps {
  beta: number;
  gamma?: number | undefined;
  thetaStationaryDeg: number;
  thetaMovingDeg: number;
  frequencyStationaryTHz: number;
  frequencyMovingTHz: number;
  dopplerFactor: number;
  cosThetaMoving: number;
  sinThetaMoving?: number | undefined;
  detectorCrossings?: number | undefined;
  earthOrbitAberrationFormatted: string;
  secondOrderShift: number;
  recedingFactor?: number | undefined;
  approachingFactor?: number | undefined;
}

export function DopplerAberrationPlot({
  beta,
  thetaStationaryDeg,
  thetaMovingDeg,
  frequencyStationaryTHz,
  frequencyMovingTHz,
  dopplerFactor,
  cosThetaMoving,
  earthOrbitAberrationFormatted,
  secondOrderShift,
}: DopplerAberrationPlotProps) {
  const thetaRadK = (thetaStationaryDeg * Math.PI) / 180;
  const thetaRad_k = (thetaMovingDeg * Math.PI) / 180;

  // Visual layout
  const width = 800;
  const height = 400;
  const cx1 = 200;
  const cy = 200;
  const cx2 = 600;
  const radius = 120;

  // Ray vectors
  const rayLen = 100;
  const ray1X = cx1 + rayLen * Math.cos(thetaRadK);
  const ray1Y = cy - rayLen * Math.sin(thetaRadK);
  const ray2X = cx2 + rayLen * Math.cos(thetaRad_k);
  const ray2Y = cy - rayLen * Math.sin(thetaRad_k);

  // Wavefront lines in K (perpendicular to ray)
  const numWavefronts = 5;
  const spacingK = 18;
  const spacing_k = Math.max(6, Math.min(36, spacingK / (dopplerFactor || 1)));

  const waveLinesK = Array.from({ length: numWavefronts }, (_, i) => {
    const offset = (i - 2) * spacingK;
    const px = cx1 + offset * Math.cos(thetaRadK);
    const py = cy - offset * Math.sin(thetaRadK);
    const perpLen = 60;
    const x1 = px - perpLen * Math.sin(thetaRadK);
    const y1 = py - perpLen * Math.cos(thetaRadK);
    const x2 = px + perpLen * Math.sin(thetaRadK);
    const y2 = py + perpLen * Math.cos(thetaRadK);
    return { x1, y1, x2, y2 };
  });

  const waveLines_k = Array.from({ length: numWavefronts }, (_, i) => {
    const offset = (i - 2) * spacing_k;
    const px = cx2 + offset * Math.cos(thetaRad_k);
    const py = cy - offset * Math.sin(thetaRad_k);
    const perpLen = 60;
    const x1 = px - perpLen * Math.sin(thetaRad_k);
    const y1 = py - perpLen * Math.cos(thetaRad_k);
    const x2 = px + perpLen * Math.sin(thetaRad_k);
    const y2 = py + perpLen * Math.cos(thetaRad_k);
    return { x1, y1, x2, y2 };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border/50 bg-background/80 p-4 shadow-sm">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none"
          role="img"
          aria-label={`Wavefront and aberration diagram: stationary frame K with theta = ${thetaStationaryDeg.toFixed(1)} degrees, moving frame k with theta' = ${thetaMovingDeg.toFixed(1)} degrees`}
        >
          <title>Relativistic Doppler and Aberration Vector Diagram</title>

          {/* Dividing line */}
          <line
            x1={width / 2}
            y1={20}
            x2={width / 2}
            y2={height - 20}
            stroke="currentColor"
            strokeDasharray="4 4"
            className="text-border/60"
          />

          {/* Frame K Left Pane */}
          <g>
            <text x={40} y={40} className="fill-foreground font-semibold text-sm">
              Stationary Frame K
            </text>
            <text x={40} y={60} className="fill-muted-foreground text-xs">
              Source frame · ν = {frequencyStationaryTHz.toFixed(1)} THz · θ ={" "}
              {thetaStationaryDeg.toFixed(1)}°
            </text>

            {/* Coordinate axes */}
            <line
              x1={cx1 - radius}
              y1={cy}
              x2={cx1 + radius}
              y2={cy}
              stroke="currentColor"
              className="text-border/80"
              strokeWidth={1}
            />
            <line
              x1={cx1}
              y1={cy - radius}
              x2={cx1}
              y2={cy + radius}
              stroke="currentColor"
              className="text-border/80"
              strokeWidth={1}
            />
            <text x={cx1 + radius + 8} y={cy + 4} className="fill-muted-foreground text-[10px]">
              x
            </text>
            <text
              x={cx1}
              y={cy - radius - 8}
              className="fill-muted-foreground text-[10px]"
              textAnchor="middle"
            >
              y
            </text>

            {/* Wavefronts */}
            {waveLinesK.map((line) => (
              <line
                key={`k-wave-${line.x1.toFixed(1)}-${line.y1.toFixed(1)}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="#3b82f6"
                strokeWidth={1.5}
                strokeOpacity={0.6}
              />
            ))}

            {/* Propagation ray */}
            <line
              x1={cx1}
              y1={cy}
              x2={ray1X}
              y2={ray1Y}
              stroke="#2563eb"
              strokeWidth={2.5}
              markerEnd="url(#arrow-k)"
            />
            <circle cx={cx1} cy={cy} r={3} fill="#2563eb" />

            {/* Angle arc */}
            <path
              d={`M ${cx1 + 30} ${cy} A 30 30 0 ${thetaRadK > Math.PI ? 1 : 0} 0 ${cx1 + 30 * Math.cos(thetaRadK)} ${cy - 30 * Math.sin(thetaRadK)}`}
              fill="none"
              stroke="#2563eb"
              strokeWidth={1.2}
              strokeDasharray="2 2"
            />
            <text x={cx1 + 42} y={cy - 12} className="fill-primary text-xs font-mono font-medium">
              θ = {thetaStationaryDeg.toFixed(1)}°
            </text>
          </g>

          {/* Frame k Right Pane */}
          <g>
            <text x={cx2 - 140} y={40} className="fill-foreground font-semibold text-sm">
              Moving Frame k (β = {beta.toFixed(3)}c)
            </text>
            <text x={cx2 - 140} y={60} className="fill-muted-foreground text-xs">
              Observer frame · ν&apos; = {frequencyMovingTHz.toFixed(1)} THz · θ&apos; ={" "}
              {thetaMovingDeg.toFixed(1)}°
            </text>

            {/* Coordinate axes */}
            <line
              x1={cx2 - radius}
              y1={cy}
              x2={cx2 + radius}
              y2={cy}
              stroke="currentColor"
              className="text-border/80"
              strokeWidth={1}
            />
            <line
              x1={cx2}
              y1={cy - radius}
              x2={cx2}
              y2={cy + radius}
              stroke="currentColor"
              className="text-border/80"
              strokeWidth={1}
            />
            <text x={cx2 + radius + 8} y={cy + 4} className="fill-muted-foreground text-[10px]">
              x&apos;
            </text>
            <text
              x={cx2}
              y={cy - radius - 8}
              className="fill-muted-foreground text-[10px]"
              textAnchor="middle"
            >
              y&apos;
            </text>

            {/* Boost vector arrow */}
            <g transform={`translate(${cx2 - 60}, ${cy + radius - 20})`}>
              <line
                x1={0}
                y1={0}
                x2={50}
                y2={0}
                stroke="#f59e0b"
                strokeWidth={2}
                markerEnd="url(#arrow-boost)"
              />
              <text
                x={25}
                y={-6}
                className="fill-amber-500 text-[10px] font-mono"
                textAnchor="middle"
              >
                v = {beta.toFixed(2)}c
              </text>
            </g>

            {/* Transformed Wavefronts */}
            {waveLines_k.map((line) => (
              <line
                key={`k-prime-wave-${line.x1.toFixed(1)}-${line.y1.toFixed(1)}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={dopplerFactor > 1 ? "#ef4444" : "#10b981"}
                strokeWidth={1.5}
                strokeOpacity={0.7}
              />
            ))}

            {/* Transformed Propagation ray */}
            <line
              x1={cx2}
              y1={cy}
              x2={ray2X}
              y2={ray2Y}
              stroke="#dc2626"
              strokeWidth={2.5}
              markerEnd="url(#arrow-prime)"
            />
            <circle cx={cx2} cy={cy} r={3} fill="#dc2626" />

            {/* Transformed Angle arc */}
            <path
              d={`M ${cx2 + 30} ${cy} A 30 30 0 ${thetaRad_k > Math.PI ? 1 : 0} 0 ${cx2 + 30 * Math.cos(thetaRad_k)} ${cy - 30 * Math.sin(thetaRad_k)}`}
              fill="none"
              stroke="#dc2626"
              strokeWidth={1.2}
              strokeDasharray="2 2"
            />
            <text
              x={cx2 + 42}
              y={cy - 12}
              className="fill-destructive text-xs font-mono font-medium"
            >
              θ&apos; = {thetaMovingDeg.toFixed(1)}°
            </text>
          </g>

          {/* Markers */}
          <defs>
            <marker
              id="arrow-k"
              viewBox="0 0 10 10"
              refX={5}
              refY={5}
              markerWidth={6}
              markerHeight={6}
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb" />
            </marker>
            <marker
              id="arrow-prime"
              viewBox="0 0 10 10"
              refX={5}
              refY={5}
              markerWidth={6}
              markerHeight={6}
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
            </marker>
            <marker
              id="arrow-boost"
              viewBox="0 0 10 10"
              refX={5}
              refY={5}
              markerWidth={6}
              markerHeight={6}
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
            </marker>
          </defs>
        </svg>
      </div>

      {/* Numerical Invariants and Diagnostics Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-2.5 rounded-md border border-border/40 bg-muted/20">
          <div className="text-muted-foreground">Doppler factor ν&apos;/ν</div>
          <div className="text-sm font-mono font-semibold mt-0.5 text-primary">
            {dopplerFactor.toFixed(6)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">γ(1 - β cos θ)</div>
        </div>

        <div className="p-2.5 rounded-md border border-border/40 bg-muted/20">
          <div className="text-muted-foreground">Aberration cos θ&apos;</div>
          <div className="text-sm font-mono font-semibold mt-0.5">{cosThetaMoving.toFixed(6)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">(cos θ - β)/(1 - β cos θ)</div>
        </div>

        {earthOrbitAberrationFormatted ? (
          <div className="p-2.5 rounded-md border border-border/40 bg-muted/20">
            <div className="text-muted-foreground">Earth orbit aberration</div>
            <div className="text-sm font-mono font-semibold mt-0.5 text-amber-600 dark:text-amber-400">
              {earthOrbitAberrationFormatted}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Modern calculation at 29.8 km/s
            </div>
          </div>
        ) : null}

        {Number.isFinite(secondOrderShift) ? (
          <div className="p-2.5 rounded-md border border-border/40 bg-muted/20">
            <div className="text-muted-foreground">2nd-order shift γ - 1</div>
            <div className="text-sm font-mono font-semibold mt-0.5 text-blue-600 dark:text-blue-400">
              {secondOrderShift.toExponential(4)}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Ives–Stilwell 1938 overlay
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
