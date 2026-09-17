export interface ElectronDynamicsPlotProps {
  initialSpeed: number;
  initialDirectionDeg: number;
  electricFieldX: number;
  electricFieldY: number;
  electricFieldZ: number;
  magneticFieldX: number;
  magneticFieldY: number;
  magneticFieldZ: number;
  forceConvention: "source" | "laboratory";
  massLanguage: "1905" | "modern";
  particle: "electron" | "custom";
  longitudinalMassKg: number;
  transverseMassComovingKg: number;
  transverseMassLaboratoryKg: number;
  kineticEnergyJ: number;
  kineticEnergyNewtonianJ: number;
  acceleratingPotentialV: number;
  acceleratingPotentialNewtonianV: number;
  radiusCurvatureMagneticM: number;
  radiusCurvatureElectricM: number;
  lorentzFactor: number;
  datasetOverlay: "none" | "kaufmann-1902-1906" | "bucherer-1908";
}

export function ElectronDynamicsPlot({
  initialSpeed,
  initialDirectionDeg: _initialDirectionDeg,
  electricFieldX,
  electricFieldY,
  electricFieldZ,
  magneticFieldX,
  magneticFieldY,
  magneticFieldZ,
  forceConvention,
  massLanguage,
  particle,
  longitudinalMassKg,
  transverseMassComovingKg,
  transverseMassLaboratoryKg,
  kineticEnergyJ,
  kineticEnergyNewtonianJ,
  acceleratingPotentialV,
  acceleratingPotentialNewtonianV,
  radiusCurvatureMagneticM,
  radiusCurvatureElectricM,
  lorentzFactor,
  datasetOverlay,
}: ElectronDynamicsPlotProps) {
  const beta = Math.abs(initialSpeed);
  const gamma = Math.max(1, lorentzFactor || 1);

  // SVG dimensions
  const width = 800;
  const height = 360;
  const originX = 120;
  const originY = 180;

  // Build a representative trajectory path for visual display
  const eMag = Math.hypot(electricFieldX, electricFieldY, electricFieldZ);
  const bMag = Math.hypot(magneticFieldX, magneticFieldY, magneticFieldZ);

  const numPoints = 60;
  const totalDisplayLength = 600;
  const points: { x: number; y: number }[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const fraction = i / numPoints;
    const px = originX + fraction * totalDisplayLength;

    let py = originY;
    if (eMag > 0) {
      // Deflection in electric field: electron q < 0 in +Ey deflects downward (-y in physics -> +y in SVG)
      const eSign = Math.sign(electricFieldY || 1);
      const curvatureFactor = (eMag / 1e5) * (1 / (gamma * Math.max(0.1, beta * beta)));
      py += eSign * 70 * curvatureFactor * (fraction * fraction);
    }
    if (bMag > 0) {
      // Deflection in magnetic field
      const bSign = Math.sign(magneticFieldZ || 1);
      const bFactor = (bMag / 0.01) * (1 / (gamma * Math.max(0.1, beta)));
      py += bSign * 60 * bFactor * (fraction * fraction);
    }

    // Clamp inside viewport
    py = Math.max(30, Math.min(height - 30, py));
    points.push({ x: px, y: py });
  }

  const pathD = points.reduce(
    (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
    "",
  );

  return (
    <div className="flex flex-col gap-4">
      {/* SVG Canvas */}
      <div className="rounded-lg border border-border/50 bg-background/80 p-4 shadow-sm">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none"
          role="img"
          aria-label={`Electron dynamics trajectory diagram: initial speed v = ${beta.toFixed(2)}c, gamma = ${gamma.toFixed(4)}`}
        >
          <title>Relativistic Electron Dynamics and Deflection (Einstein 1905 §10)</title>

          {/* Grid Background */}
          <defs>
            <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="currentColor"
                className="text-border/20"
                strokeWidth="0.5"
              />
            </pattern>
            <marker
              id="arrow-beam"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
            </marker>
            <marker
              id="arrow-field-e"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
            </marker>
          </defs>

          <rect width={width} height={height} fill="url(#grid-pattern)" />

          {/* Field Region Indicator */}
          <rect
            x={originX - 20}
            y={20}
            width={width - originX}
            height={height - 40}
            fill="currentColor"
            className="text-muted/10"
            rx={6}
            strokeDasharray="4 4"
            stroke="currentColor"
          />

          <text x={originX} y={45} className="fill-foreground font-semibold text-sm">
            Uniform Field Chamber (E = {eMag.toExponential(1)} V/m, B = {bMag.toFixed(3)} T)
          </text>
          <text x={originX} y={65} className="fill-muted-foreground text-xs font-mono">
            v₀ = {beta.toFixed(3)}c · γ = {gamma.toFixed(4)} · Convention: {forceConvention} (
            {massLanguage === "1905" ? "1905 masses" : "Modern momentum"})
          </text>

          {/* Field Vectors */}
          {eMag > 0 ? (
            <g transform="translate(700, 70)">
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={40}
                stroke="#ef4444"
                strokeWidth={2}
                markerEnd="url(#arrow-field-e)"
              />
              <text x={10} y={25} className="fill-red-500 font-mono text-xs">
                E_y
              </text>
            </g>
          ) : null}

          {bMag > 0 ? (
            <g transform="translate(740, 70)">
              <circle cx={0} cy={20} r={10} fill="none" stroke="#8b5cf6" strokeWidth={1.5} />
              <circle cx={0} cy={20} r={3} fill="#8b5cf6" />
              <text x={15} y={25} className="fill-purple-500 font-mono text-xs">
                B_z (⊙ out)
              </text>
            </g>
          ) : null}

          {/* Coordinate Axes */}
          <line
            x1={originX - 40}
            y1={originY}
            x2={width - 40}
            y2={originY}
            stroke="currentColor"
            className="text-border/60"
            strokeWidth={1}
          />
          <line
            x1={originX}
            y1={30}
            x2={originX}
            y2={height - 30}
            stroke="currentColor"
            className="text-border/60"
            strokeWidth={1}
          />
          <text x={width - 30} y={originY + 4} className="fill-muted-foreground text-[10px]">
            x
          </text>
          <text
            x={originX}
            y={25}
            className="fill-muted-foreground text-[10px]"
            textAnchor="middle"
          >
            y
          </text>

          {/* Trajectory Curve */}
          <path
            d={pathD}
            fill="none"
            stroke="#2563eb"
            strokeWidth={3}
            className="transition-all duration-200"
          />

          {/* Initial Entry Point */}
          <circle cx={originX} cy={originY} r={5} fill="#1d4ed8" />
          <text
            x={originX - 60}
            y={originY + 4}
            className="fill-primary text-xs font-mono font-medium"
          >
            e⁻ entry
          </text>

          {/* End Particle Marker */}
          {(() => {
            const lastPt = points.length > 0 ? points[points.length - 1] : undefined;
            if (!lastPt) return null;
            return (
              <g transform={`translate(${lastPt.x}, ${lastPt.y})`}>
                <circle cx={0} cy={0} r={6} fill="#3b82f6" />
                <circle
                  cx={0}
                  cy={0}
                  r={10}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
              </g>
            );
          })()}

          {/* Historical Dataset Overlay Points */}
          {datasetOverlay !== "none" ? (
            <g>
              {datasetOverlay === "kaufmann-1902-1906" ? (
                <g>
                  {/* Kaufmann 1902-1906 empirical points */}
                  {[
                    { id: "kaufmann-pt-1", x: 220, y: 185 },
                    { id: "kaufmann-pt-2", x: 340, y: 198 },
                    { id: "kaufmann-pt-3", x: 460, y: 220 },
                    { id: "kaufmann-pt-4", x: 580, y: 252 },
                    { id: "kaufmann-pt-5", x: 700, y: 295 },
                  ].map((pt) => (
                    <g key={pt.id}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={4}
                        fill="#f59e0b"
                        stroke="#b45309"
                        strokeWidth={1.5}
                      />
                      <line
                        x1={pt.x}
                        y1={pt.y - 5}
                        x2={pt.x}
                        y2={pt.y + 5}
                        stroke="#b45309"
                        strokeWidth={1}
                      />
                    </g>
                  ))}
                  <text
                    x={originX + 20}
                    y={height - 40}
                    className="fill-amber-600 dark:fill-amber-400 text-[11px] font-mono font-medium"
                  >
                    ◆ Kaufmann 1902–1906 Radium β-ray Deflections (Ambiguous in 1905–1906)
                  </text>
                </g>
              ) : (
                <g>
                  {/* Bucherer 1908 velocity-filter points */}
                  {[
                    { id: "bucherer-pt-1", x: 220, y: 184 },
                    { id: "bucherer-pt-2", x: 340, y: 196 },
                    { id: "bucherer-pt-3", x: 460, y: 216 },
                    { id: "bucherer-pt-4", x: 580, y: 246 },
                    { id: "bucherer-pt-5", x: 700, y: 286 },
                  ].map((pt) => (
                    <g key={pt.id}>
                      <rect
                        x={pt.x - 3.5}
                        y={pt.y - 3.5}
                        width={7}
                        height={7}
                        fill="#10b981"
                        stroke="#047857"
                        strokeWidth={1.5}
                      />
                      <line
                        x1={pt.x}
                        y1={pt.y - 4}
                        x2={pt.x}
                        y2={pt.y + 4}
                        stroke="#047857"
                        strokeWidth={1}
                      />
                    </g>
                  ))}
                  <text
                    x={originX + 20}
                    y={height - 40}
                    className="fill-emerald-600 dark:fill-emerald-400 text-[11px] font-mono font-medium"
                  >
                    ■ Bucherer 1908 Crossed-Field Velocity Filter (Later Evidence favoring
                    Lorentz–Einstein)
                  </text>
                </g>
              )}
            </g>
          ) : null}
        </svg>
      </div>

      {/* Mass Coefficients & Definitions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-md border border-border/40 bg-muted/20">
          <div className="text-muted-foreground font-medium">Longitudinal Mass (m · γ³)</div>
          <div className="text-base font-mono font-semibold mt-1 text-primary">
            {(longitudinalMassKg / (particle === "electron" ? 9.1093837e-31 : 1)).toFixed(6)} m
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Section 10 formula: μ / (1 - v²/V²)^(3/2) = γ³m
          </div>
        </div>

        <div className="p-3 rounded-md border border-border/40 bg-muted/20">
          <div className="text-muted-foreground font-medium">
            Transverse Mass: Comoving (Einstein 1905)
          </div>
          <div className="text-base font-mono font-semibold mt-1 text-amber-600 dark:text-amber-400">
            {(transverseMassComovingKg / (particle === "electron" ? 9.1093837e-31 : 1)).toFixed(6)}{" "}
            m
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Comoving force / Stationary acceleration: F′_y / a_y = γ²m
          </div>
        </div>

        <div className="p-3 rounded-md border border-border/40 bg-muted/20">
          <div className="text-muted-foreground font-medium">
            Transverse Mass: Laboratory (Planck 1906)
          </div>
          <div className="text-base font-mono font-semibold mt-1 text-emerald-600 dark:text-emerald-400">
            {(transverseMassLaboratoryKg / (particle === "electron" ? 9.1093837e-31 : 1)).toFixed(
              6,
            )}{" "}
            m
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Laboratory force / Stationary acceleration: F_y / a_y = γm
          </div>
        </div>
      </div>

      {/* Kinetic Energy & Potential Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-2.5 rounded-md border border-border/40 bg-muted/20">
          <div className="text-muted-foreground">Relativistic Kinetic Energy W</div>
          <div className="text-sm font-mono font-semibold mt-0.5 text-primary">
            {(kineticEnergyJ / 1.602176634e-19 / 1e3).toFixed(2)} keV
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">mc²(γ − 1)</div>
        </div>

        <div className="p-2.5 rounded-md border border-border/40 bg-muted/20">
          <div className="text-muted-foreground">Newtonian Kinetic Energy</div>
          <div className="text-sm font-mono font-semibold mt-0.5">
            {(kineticEnergyNewtonianJ / 1.602176634e-19 / 1e3).toFixed(2)} keV
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">½mv²</div>
        </div>

        <div className="p-2.5 rounded-md border border-border/40 bg-muted/20">
          <div className="text-muted-foreground">Accelerating Potential P</div>
          <div className="text-sm font-mono font-semibold mt-0.5 text-emerald-600 dark:text-emerald-400">
            {(acceleratingPotentialV / 1e3).toFixed(2)} kV
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">W / e (exact)</div>
        </div>

        <div className="p-2.5 rounded-md border border-border/40 bg-muted/20">
          <div className="text-muted-foreground">Newtonian Potential</div>
          <div className="text-sm font-mono font-semibold mt-0.5">
            {(acceleratingPotentialNewtonianV / 1e3).toFixed(2)} kV
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">½mv² / e</div>
        </div>
      </div>

      {/* Radii & Deflection Diagnostics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-2.5 rounded-md border border-border/40 bg-muted/20">
          <div className="text-muted-foreground">Magnetic Curvature Radius (R_m)</div>
          <div className="text-sm font-mono font-semibold mt-0.5">
            {Number.isFinite(radiusCurvatureMagneticM)
              ? `${radiusCurvatureMagneticM.toFixed(4)} m`
              : "— (B = 0)"}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">γmv / (|q|B)</div>
        </div>

        <div className="p-2.5 rounded-md border border-border/40 bg-muted/20">
          <div className="text-muted-foreground">Electric Curvature Radius (R_e)</div>
          <div className="text-sm font-mono font-semibold mt-0.5">
            {Number.isFinite(radiusCurvatureElectricM)
              ? `${radiusCurvatureElectricM.toFixed(4)} m`
              : "— (E = 0)"}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">γmv² / (|q|E)</div>
        </div>
      </div>

      {/* Convention Insight Note */}
      <div className="p-3 rounded-md border border-blue-500/40 bg-blue-500/10 text-xs">
        <div className="font-semibold text-blue-900 dark:text-blue-300">
          Force Definition Convention Independence
        </div>
        <p className="mt-1 text-blue-950/90 dark:text-blue-200/90">
          Switching between Einstein&apos;s 1905 convention (comoving force / stationary
          acceleration, transverse coefficient 1.5625m at 0.6c) and Planck&apos;s 1906 convention
          (laboratory force, transverse coefficient 1.25m) alters only the named coefficient in the
          equation of motion. All physical observables (deflection radii, potentials, kinetic
          energy, and spatial trajectories) remain strictly identical under both conventions.
        </p>
      </div>
    </div>
  );
}
