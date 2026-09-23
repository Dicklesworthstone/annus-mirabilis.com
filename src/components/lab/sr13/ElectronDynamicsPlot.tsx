import { SciSvg } from "../Sci.tsx";

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
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* SVG Canvas */}
      <div
        style={{
          borderRadius: "0.5rem",
          border: "1px solid var(--line)",
          background: "var(--panel)",
          padding: "1rem",
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", height: "auto", display: "block", userSelect: "none" }}
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
                stroke="var(--line)"
                strokeWidth="0.5"
                strokeOpacity={0.4}
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
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--plot)" />
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
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
            </marker>
          </defs>

          <rect width={width} height={height} fill="url(#grid-pattern)" />

          {/* Field Region Indicator */}
          <rect
            x={originX - 20}
            y={20}
            width={width - originX}
            height={height - 40}
            fill="var(--wash)"
            rx={6}
            strokeDasharray="4 4"
            stroke="var(--line)"
          />

          <text
            x={originX}
            y={45}
            style={{
              fill: "var(--ink)",
              fontWeight: 600,
              fontSize: "14px",
              fontFamily: "var(--font-sans)",
            }}
          >
            Uniform Field Chamber (E = <SciSvg value={eMag} digits={1} /> V/m, B = {bMag.toFixed(3)}{" "}
            T)
          </text>
          <text
            x={originX}
            y={65}
            style={{
              fill: "var(--muted)",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
            }}
          >
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
                stroke="var(--accent)"
                strokeWidth={2}
                markerEnd="url(#arrow-field-e)"
              />
              <text
                x={10}
                y={25}
                style={{
                  fill: "var(--accent)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                }}
              >
                E_y
              </text>
            </g>
          ) : null}

          {bMag > 0 ? (
            <g transform="translate(740, 70)">
              <circle cx={0} cy={20} r={10} fill="none" stroke="var(--plot)" strokeWidth={1.5} />
              <circle cx={0} cy={20} r={3} fill="var(--plot)" />
              <text
                x={15}
                y={25}
                style={{
                  fill: "var(--plot)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                }}
              >
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
            stroke="var(--line)"
            strokeWidth={1}
          />
          <line
            x1={originX}
            y1={30}
            x2={originX}
            y2={height - 30}
            stroke="var(--line)"
            strokeWidth={1}
          />
          <text
            x={width - 30}
            y={originY + 4}
            style={{ fill: "var(--muted)", fontSize: "10px", fontFamily: "var(--font-sans)" }}
          >
            x
          </text>
          <text
            x={originX}
            y={25}
            style={{ fill: "var(--muted)", fontSize: "10px", fontFamily: "var(--font-sans)" }}
            textAnchor="middle"
          >
            y
          </text>

          {/* Trajectory Curve */}
          <path d={pathD} fill="none" stroke="var(--plot)" strokeWidth={3} />

          {/* Initial Entry Point */}
          <circle cx={originX} cy={originY} r={5} fill="var(--ink)" />
          <text
            x={originX - 60}
            y={originY + 4}
            style={{
              fill: "var(--ink)",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
            }}
          >
            e⁻ entry
          </text>

          {/* End Particle Marker */}
          {(() => {
            const lastPt = points.length > 0 ? points[points.length - 1] : undefined;
            if (!lastPt) return null;
            return (
              <g transform={`translate(${lastPt.x}, ${lastPt.y})`}>
                <circle cx={0} cy={0} r={6} fill="var(--plot)" />
                <circle
                  cx={0}
                  cy={0}
                  r={10}
                  fill="none"
                  stroke="var(--plot)"
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
                    style={{
                      fill: "var(--accent)",
                      fontSize: "11px",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 500,
                    }}
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
                    style={{
                      fill: "var(--plot)",
                      fontSize: "11px",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 500,
                    }}
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
          gap: "0.75rem",
          fontSize: "0.8rem",
        }}
      >
        <div
          style={{
            padding: "0.75rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--line)",
            background: "var(--wash)",
          }}
        >
          <div style={{ color: "var(--muted)", fontWeight: 500 }}>Longitudinal Mass (m · γ³)</div>
          <div
            style={{
              fontSize: "1rem",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              marginTop: "0.25rem",
              color: "var(--ink)",
            }}
          >
            {(longitudinalMassKg / (particle === "electron" ? 9.1093837e-31 : 1)).toFixed(6)} m
          </div>
          <div className="fine" style={{ marginTop: "0.25rem", fontSize: "0.75rem" }}>
            Section 10 formula: μ / (1 - v²/V²)^(3/2) = γ³m
          </div>
        </div>

        <div
          style={{
            padding: "0.75rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--line)",
            background: "var(--wash)",
          }}
        >
          <div style={{ color: "var(--muted)", fontWeight: 500 }}>
            Transverse Mass: Comoving (Einstein 1905)
          </div>
          <div
            style={{
              fontSize: "1rem",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              marginTop: "0.25rem",
              color: "var(--accent)",
            }}
          >
            {(transverseMassComovingKg / (particle === "electron" ? 9.1093837e-31 : 1)).toFixed(6)}{" "}
            m
          </div>
          <div className="fine" style={{ marginTop: "0.25rem", fontSize: "0.75rem" }}>
            Comoving force / Stationary acceleration: F′_y / a_y = γ²m
          </div>
        </div>

        <div
          style={{
            padding: "0.75rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--line)",
            background: "var(--wash)",
          }}
        >
          <div style={{ color: "var(--muted)", fontWeight: 500 }}>
            Transverse Mass: Laboratory (Planck 1906)
          </div>
          <div
            style={{
              fontSize: "1rem",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              marginTop: "0.25rem",
              color: "var(--plot)",
            }}
          >
            {(transverseMassLaboratoryKg / (particle === "electron" ? 9.1093837e-31 : 1)).toFixed(
              6,
            )}{" "}
            m
          </div>
          <div className="fine" style={{ marginTop: "0.25rem", fontSize: "0.75rem" }}>
            Laboratory force / Stationary acceleration: F_y / a_y = γm
          </div>
        </div>
      </div>

      {/* Kinetic Energy & Potential Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))",
          gap: "0.75rem",
          fontSize: "0.8rem",
        }}
      >
        <div
          style={{
            padding: "0.625rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--line)",
            background: "var(--wash)",
          }}
        >
          <div style={{ color: "var(--muted)" }}>Relativistic Kinetic Energy W</div>
          <div
            style={{
              fontSize: "0.875rem",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              marginTop: "0.125rem",
              color: "var(--ink)",
            }}
          >
            {(kineticEnergyJ / 1.602176634e-19 / 1e3).toFixed(2)} keV
          </div>
          <div className="fine" style={{ marginTop: "0.125rem", fontSize: "0.7rem" }}>
            mc²(γ − 1)
          </div>
        </div>

        <div
          style={{
            padding: "0.625rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--line)",
            background: "var(--wash)",
          }}
        >
          <div style={{ color: "var(--muted)" }}>Newtonian Kinetic Energy</div>
          <div
            style={{
              fontSize: "0.875rem",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              marginTop: "0.125rem",
            }}
          >
            {(kineticEnergyNewtonianJ / 1.602176634e-19 / 1e3).toFixed(2)} keV
          </div>
          <div className="fine" style={{ marginTop: "0.125rem", fontSize: "0.7rem" }}>
            ½mv²
          </div>
        </div>

        <div
          style={{
            padding: "0.625rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--line)",
            background: "var(--wash)",
          }}
        >
          <div style={{ color: "var(--muted)" }}>Accelerating Potential P</div>
          <div
            style={{
              fontSize: "0.875rem",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              marginTop: "0.125rem",
              color: "var(--plot)",
            }}
          >
            {(acceleratingPotentialV / 1e3).toFixed(2)} kV
          </div>
          <div className="fine" style={{ marginTop: "0.125rem", fontSize: "0.7rem" }}>
            W / e (exact)
          </div>
        </div>

        <div
          style={{
            padding: "0.625rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--line)",
            background: "var(--wash)",
          }}
        >
          <div style={{ color: "var(--muted)" }}>Newtonian Potential</div>
          <div
            style={{
              fontSize: "0.875rem",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              marginTop: "0.125rem",
            }}
          >
            {(acceleratingPotentialNewtonianV / 1e3).toFixed(2)} kV
          </div>
          <div className="fine" style={{ marginTop: "0.125rem", fontSize: "0.7rem" }}>
            ½mv² / e
          </div>
        </div>
      </div>

      {/* Radii & Deflection Diagnostics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
          gap: "0.75rem",
          fontSize: "0.8rem",
        }}
      >
        <div
          style={{
            padding: "0.625rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--line)",
            background: "var(--wash)",
          }}
        >
          <div style={{ color: "var(--muted)" }}>Magnetic Curvature Radius (R_m)</div>
          <div
            style={{
              fontSize: "0.875rem",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              marginTop: "0.125rem",
            }}
          >
            {Number.isFinite(radiusCurvatureMagneticM)
              ? `${radiusCurvatureMagneticM.toFixed(4)} m`
              : "Straight path (B = 0)"}
          </div>
          <div className="fine" style={{ marginTop: "0.125rem", fontSize: "0.7rem" }}>
            γmv / (|q|B)
          </div>
        </div>

        <div
          style={{
            padding: "0.625rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--line)",
            background: "var(--wash)",
          }}
        >
          <div style={{ color: "var(--muted)" }}>Electric Curvature Radius (R_e)</div>
          <div
            style={{
              fontSize: "0.875rem",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              marginTop: "0.125rem",
            }}
          >
            {Number.isFinite(radiusCurvatureElectricM)
              ? `${radiusCurvatureElectricM.toFixed(4)} m`
              : "Straight path (E = 0)"}
          </div>
          <div className="fine" style={{ marginTop: "0.125rem", fontSize: "0.7rem" }}>
            γmv² / (|q|E)
          </div>
        </div>
      </div>

      {/* Convention Insight Note */}
      <div className="notice" style={{ fontSize: "0.8rem" }}>
        <div style={{ fontWeight: 600 }}>Force Definition Convention Independence</div>
        <p style={{ margin: "0.25rem 0 0" }}>
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
