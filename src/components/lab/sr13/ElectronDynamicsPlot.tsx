import type { NumericView } from "../../../experiments/store/instanceStore.ts";
import { Sci, SubSvg } from "../Sci.tsx";
import "./sr13.css";

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
  /** The kernel's path in metres, x0, y0, x1, y1, ... (trajectoryPositions); absent before it ran. */
  trajectory?: NumericView | null;
  integrationIntervalS?: number;
}

/** A scale-bar length: 1, 2 or 5 times a power of ten, no longer than `limit` metres. */
function scaleBarMetres(limit: number): number {
  let unit = 1;
  while (unit > limit) unit /= 10;
  while (unit * 10 <= limit) unit *= 10;
  const multiple = [5, 2, 1].find((m) => m * unit <= limit) ?? 1;
  return Number((multiple * unit).toPrecision(1));
}

function lengthLabel(metres: number): string {
  if (metres >= 1) return `${metres} m`;
  if (metres >= 0.01) return `${Number((metres * 100).toPrecision(1))} cm`;
  if (metres >= 0.001) return `${Number((metres * 1000).toPrecision(1))} mm`;
  return `${Number((metres * 1e6).toPrecision(1))} μm`;
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
  trajectory = null,
  integrationIntervalS = 0,
}: ElectronDynamicsPlotProps) {
  const beta = Math.abs(initialSpeed);
  const gamma = Math.max(1, lorentzFactor || 1);

  // A mass as a multiple of the electron's rest mass m, or in kilograms for a custom particle. It
  // printed "1.953125 m" for both, which read as metres beside the radii in metres below, and a
  // custom particle's kilograms were labelled "m" too.
  const massText = (kg: number) =>
    particle === "electron" ? `${(kg / 9.1093837e-31).toFixed(6)} × m` : `${kg.toPrecision(4)} kg`;

  const width = 800;
  const height = 360;
  const frame = { left: 24, right: width - 24, top: 20, bottom: height - 20 };

  const eMag = Math.hypot(electricFieldX, electricFieldY, electricFieldZ);
  const bMag = Math.hypot(magneticFieldX, magneticFieldY, magneticFieldZ);

  // The path is the kernel's (trajectoryPositions), in metres. It is drawn to one scale in both
  // directions and fitted to the frame, so a gentle bend looks gentle and a tight one looks tight;
  // nothing here computes where the electron goes. This drawing used to invent its curve from
  // made-up factors, clamped to the frame, and bent an electron the wrong way in a magnetic field.
  const count = trajectory ? Math.floor(trajectory.length / 2) : 0;
  const px = (i: number) => (trajectory ? trajectory.at(2 * i) : 0);
  const py = (i: number) => (trajectory ? trajectory.at(2 * i + 1) : 0);
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  for (let i = 0; i < count; i++) {
    minX = Math.min(minX, px(i));
    maxX = Math.max(maxX, px(i));
    minY = Math.min(minY, py(i));
    maxY = Math.max(maxY, py(i));
  }
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const innerW = frame.right - frame.left - 120;
  const innerH = frame.bottom - frame.top - 110;
  const scale = Math.min(innerW / (spanX || spanY || 1), innerH / (spanY || spanX || 1));
  const offsetX = frame.left + 60 + (innerW - spanX * scale) / 2 - minX * scale;
  const offsetY = (frame.top + frame.bottom) / 2 + ((maxY + minY) / 2) * scale;
  const toX = (x: number) => offsetX + x * scale;
  const toY = (y: number) => offsetY - y * scale; // physics y points up, SVG y down
  const originX = toX(0);
  const originY = toY(0);
  let pathD = "";
  for (let i = 0; i < count; i++) {
    pathD += `${i === 0 ? "M" : "L"} ${toX(px(i)).toFixed(1)} ${toY(py(i)).toFixed(1)} `;
  }
  const end = count > 0 ? { x: toX(px(count - 1)), y: toY(py(count - 1)) } : null;
  const bendsUp = count > 0 && py(count - 1) > 0;
  const runsLeft = end !== null && end.x < originX;
  const bar = count > 1 ? scaleBarMetres((0.25 * innerW) / scale) : 0;

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
        {/* The chamber's title and settings are sentences, so they are HTML: inside the 800-unit
            drawing they rendered at 4-5px on a 390px phone. */}
        <p className="sr13-chamber-title">
          Uniform field chamber (E = <Sci value={eMag} digits={1} /> V/m, B = {bMag.toFixed(3)} T
          {magneticFieldZ > 0 ? ", out of the page" : magneticFieldZ < 0 ? ", into the page" : ""})
        </p>
        <p className="fine sr13-chamber-meta">
          v₀ = {beta.toFixed(3)}c · γ = {gamma.toFixed(4)} · convention: {forceConvention} (
          {massLanguage === "1905" ? "1905 masses" : "modern momentum"})
        </p>
        <svg
          className="sr13-chamber"
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

          {/* Field region */}
          <rect
            x={frame.left}
            y={frame.top}
            width={frame.right - frame.left}
            height={frame.bottom - frame.top}
            fill="var(--wash)"
            rx={6}
            strokeDasharray="4 4"
            stroke="var(--line)"
          />

          {/* Field directions, top right */}
          {eMag > 0 ? (
            <g transform={`translate(${frame.right - 150}, ${frame.top + 16})`}>
              {/* Up for +E_y, because the drawing's y points up, as the path's does. */}
              <line
                x1={0}
                y1={electricFieldY < 0 ? 0 : 40}
                x2={0}
                y2={electricFieldY < 0 ? 40 : 0}
                stroke="var(--accent)"
                strokeWidth={2}
                markerEnd="url(#arrow-field-e)"
              />
              <text
                x={10}
                y={28}
                style={{
                  fill: "var(--accent)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--sr13-label, 16px)",
                }}
              >
                E<SubSvg>y</SubSvg>
              </text>
            </g>
          ) : null}
          {bMag > 0 ? (
            <g transform={`translate(${frame.right - 60}, ${frame.top + 16})`}>
              <circle cx={0} cy={20} r={10} fill="none" stroke="var(--plot)" strokeWidth={1.5} />
              {/* A dot for +B_z, out of the page; a cross for -B_z, into it. */}
              {magneticFieldZ < 0 ? (
                <path d="M -5 15 L 5 25 M 5 15 L -5 25" stroke="var(--plot)" strokeWidth={1.5} />
              ) : (
                <circle cx={0} cy={20} r={3} fill="var(--plot)" />
              )}
              <text
                x={15}
                y={28}
                style={{
                  fill: "var(--plot)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--sr13-label, 16px)",
                }}
              >
                B<SubSvg>z</SubSvg>
              </text>
            </g>
          ) : null}

          {count > 0 ? (
            <>
              {/* Axes through the entry point */}
              <line
                x1={frame.left + 8}
                y1={originY}
                x2={frame.right - 8}
                y2={originY}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <line
                x1={originX}
                y1={frame.top + 8}
                x2={originX}
                y2={frame.bottom - 8}
                stroke="var(--line)"
                strokeWidth={1}
              />

              {/* The computed path */}
              <path d={pathD} fill="none" stroke="var(--plot)" strokeWidth={3} />

              <circle cx={originX} cy={originY} r={5} fill="var(--ink)" />
              {/* The entry label sits on the side the path does not bend or run toward. */}
              <text
                x={runsLeft ? originX - 10 : originX + 10}
                textAnchor={runsLeft ? "end" : "start"}
                y={bendsUp ? originY + 26 : originY - 12}
                style={{
                  fill: "var(--ink)",
                  fontSize: "var(--sr13-label, 16px)",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 500,
                }}
              >
                e⁻ entry
              </text>

              {end ? (
                <g transform={`translate(${end.x}, ${end.y})`}>
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
              ) : null}

              {/* Scale bar, bottom left */}
              {bar > 0 ? (
                <g transform={`translate(${frame.left + 16}, ${frame.bottom - 16})`}>
                  <line x1={0} y1={0} x2={bar * scale} y2={0} stroke="var(--ink)" strokeWidth={2} />
                  <line x1={0} y1={-5} x2={0} y2={5} stroke="var(--ink)" strokeWidth={2} />
                  <line
                    x1={bar * scale}
                    y1={-5}
                    x2={bar * scale}
                    y2={5}
                    stroke="var(--ink)"
                    strokeWidth={2}
                  />
                  <text
                    x={0}
                    y={-10}
                    style={{
                      fill: "var(--ink)",
                      fontSize: "var(--sr13-label, 16px)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {lengthLabel(bar)}
                  </text>
                </g>
              ) : null}
            </>
          ) : null}
        </svg>
        <p className="fine sr13-chamber-legend">
          {count > 0 && integrationIntervalS > 0
            ? `The path over the first ${(integrationIntervalS * 1e9).toPrecision(2)} ns, computed by the model and drawn to scale in the x–y plane.`
            : "The path appears once the model has run at these settings."}
        </p>
        {/* No Kaufmann or Bucherer measurement is drawn: neither has been digitized as a cited
            HistoricalDataset (am-data-kaufmann-1902-1906-52ya, am-data-bucherer-1908-w3mf), and the
            points this drawing used to place were hand-picked pixel positions, which is invented
            data. The overlay choice says so instead. */}
        {datasetOverlay !== "none" ? (
          <p className="fine sr13-chamber-legend" data-overlay-status="not-digitized">
            {datasetOverlay === "kaufmann-1902-1906"
              ? "Kaufmann's 1902–1906 deflection measurements are not drawn here."
              : "Bucherer's 1908 velocity-filter measurements are not drawn here."}{" "}
            They have not yet been digitized from the published paper, and points placed by eye
            would be invented data. The curve is the model alone.
          </p>
        ) : null}
      </div>

      {/* Mass Coefficients & Definitions Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
          gap: "0.75rem",
          fontSize: "var(--type-fine)",
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
          <div style={{ color: "var(--muted)", fontWeight: 500 }}>Longitudinal mass (m · γ³)</div>
          <div
            style={{
              fontSize: "1rem",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              marginTop: "0.25rem",
              color: "var(--ink)",
            }}
          >
            {massText(longitudinalMassKg)}
          </div>
          <div className="fine" style={{ marginTop: "0.25rem" }}>
            Einstein&apos;s §10: μ / (√(1 − v²/V²))³, that is, γ³m
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
            Transverse mass, comoving force (Einstein 1905)
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
            {massText(transverseMassComovingKg)}
          </div>
          <div className="fine" style={{ marginTop: "0.25rem" }}>
            Comoving force / stationary acceleration: F′<sub>y</sub> / a<sub>y</sub> = γ²m
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
            Transverse mass, laboratory force (Planck 1906)
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
            {massText(transverseMassLaboratoryKg)}
          </div>
          <div className="fine" style={{ marginTop: "0.25rem" }}>
            Laboratory force / stationary acceleration: F<sub>y</sub> / a<sub>y</sub> = γm
          </div>
        </div>
      </div>

      {/* Kinetic Energy & Potential Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))",
          gap: "0.75rem",
          fontSize: "var(--type-fine)",
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
          <div style={{ color: "var(--muted)" }}>Relativistic kinetic energy W</div>
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
          <div className="fine" style={{ marginTop: "0.125rem" }}>
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
          <div style={{ color: "var(--muted)" }}>Newtonian kinetic energy</div>
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
          <div className="fine" style={{ marginTop: "0.125rem" }}>
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
          <div style={{ color: "var(--muted)" }}>Accelerating potential P</div>
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
          <div className="fine" style={{ marginTop: "0.125rem" }}>
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
          <div style={{ color: "var(--muted)" }}>Newtonian potential</div>
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
          <div className="fine" style={{ marginTop: "0.125rem" }}>
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
          fontSize: "var(--type-fine)",
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
          <div style={{ color: "var(--muted)" }}>
            Magnetic curvature radius (R<sub>m</sub>)
          </div>
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
          <div className="fine" style={{ marginTop: "0.125rem" }}>
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
          <div style={{ color: "var(--muted)" }}>
            Electric curvature radius (R<sub>e</sub>)
          </div>
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
          <div className="fine" style={{ marginTop: "0.125rem" }}>
            γmv² / (|q|E)
          </div>
        </div>
      </div>

      {/* Convention Insight Note */}
      <div className="notice" style={{ fontSize: "var(--type-fine)" }}>
        <div style={{ fontWeight: 600 }}>The convention changes a name, not what is observed</div>
        <p style={{ margin: "0.25rem 0 0" }}>
          Switching between Einstein&apos;s 1905 convention (comoving force / stationary
          acceleration, transverse coefficient 1.5625 × m at 0.6c) and Planck&apos;s 1906 convention
          (laboratory force, transverse coefficient 1.25 × m) changes only the coefficient named in
          the equation of motion. Everything observable, the deflection radii, potentials, kinetic
          energy and paths, is the same under both.
        </p>
      </div>
    </div>
  );
}
