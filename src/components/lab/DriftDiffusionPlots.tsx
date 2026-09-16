import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { array, display, identity, result, scalar } from "./presentation.ts";

export function DensityProfilePlot({
  snapshot,
  widthMicrons,
}: {
  snapshot: AcceptedSnapshot;
  widthMicrons: number;
}) {
  const density = array(snapshot, "densityProfile");
  const osmotic = array(snapshot, "osmoticProfile");
  const cells = density.length;

  // Find peak for SVG scaling
  let maxDensity = 0;
  for (let i = 0; i < cells; i++) {
    const dVal = density.at(i);
    const oVal = osmotic.at(i);
    if (dVal > maxDensity) maxDensity = dVal;
    if (oVal > maxDensity) maxDensity = oVal;
  }
  const peak = maxDensity > 0 ? maxDensity * 1.15 : 1;

  const w = 500;
  const h = 220;
  const padL = 45;
  const padR = 20;
  const padT = 20;
  const padB = 35;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const toX = (i: number) => padL + ((i + 0.5) / cells) * plotW;
  const toY = (val: number) => padT + plotH - (val / peak) * plotH;

  // Build SVG path for current density
  let densityPath = `M ${toX(0)} ${toY(density.at(0))}`;
  for (let i = 1; i < cells; i++) {
    densityPath += ` L ${toX(i)} ${toY(density.at(i))}`;
  }

  // Build SVG path for osmotic equilibrium
  let osmoticPath = `M ${toX(0)} ${toY(osmotic.at(0))}`;
  for (let i = 1; i < cells; i++) {
    osmoticPath += ` L ${toX(i)} ${toY(osmotic.at(i))}`;
  }

  // Shaded area under density curve
  const areaPath = `${densityPath} L ${toX(cells - 1)} ${padT + plotH} L ${toX(0)} ${padT + plotH} Z`;

  return (
    <figure className="lab-figure" data-view-id="density-profile-view" {...identity(snapshot)}>
      <figcaption className="figure-caption">
        <strong>Concentration profile across the channel width</strong>: Current density (solid)
        compared with the thermodynamic osmotic equilibrium (dashed).
      </figcaption>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="distribution-svg"
        role="img"
        aria-label="Concentration profile across the 1D channel"
      >
        <rect
          x={padL}
          y={padT}
          width={plotW}
          height={plotH}
          fill="var(--canvas-bg, #fdfcf9)"
          stroke="var(--border, #e2ded4)"
        />
        {/* Shaded area */}
        <path d={areaPath} fill="var(--color-density-area, rgba(41, 128, 185, 0.15))" />
        {/* Osmotic equilibrium theoretical curve */}
        <path
          d={osmoticPath}
          fill="none"
          stroke="var(--color-osmotic, #d35400)"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
        {/* Current density curve */}
        <path
          d={densityPath}
          fill="none"
          stroke="var(--color-density, #2980b9)"
          strokeWidth="2.5"
        />
        {/* Axes */}
        <line
          x1={padL}
          y1={padT + plotH}
          x2={padL + plotW}
          y2={padT + plotH}
          stroke="var(--ink, #1a1a1a)"
          strokeWidth="1.5"
        />
        <line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={padT + plotH}
          stroke="var(--ink, #1a1a1a)"
          strokeWidth="1.5"
        />
        {/* X-axis labels */}
        <text x={padL} y={h - 10} fontSize="11" textAnchor="start" fill="var(--ink-muted, #555)">
          0 μm
        </text>
        <text
          x={padL + plotW / 2}
          y={h - 10}
          fontSize="11"
          textAnchor="middle"
          fill="var(--ink-muted, #555)"
        >
          {display(widthMicrons / 2, 1)} μm
        </text>
        <text
          x={padL + plotW}
          y={h - 10}
          fontSize="11"
          textAnchor="end"
          fill="var(--ink-muted, #555)"
        >
          {display(widthMicrons, 1)} μm
        </text>
        {/* Y-axis labels */}
        <text
          x={padL - 6}
          y={padT + 12}
          fontSize="10"
          textAnchor="end"
          fill="var(--ink-muted, #555)"
        >
          Peak
        </text>
        <text
          x={padL - 6}
          y={padT + plotH}
          fontSize="10"
          textAnchor="end"
          fill="var(--ink-muted, #555)"
        >
          0
        </text>
      </svg>
      <div className="legend-row">
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: "var(--color-density, #2980b9)" }} />
          Current density profile n(x)
        </span>
        <span className="legend-item">
          <span
            className="legend-swatch legend-dashed"
            style={{ borderColor: "var(--color-osmotic, #d35400)" }}
          />
          Osmotic equilibrium n_osm(x)
        </span>
      </div>
    </figure>
  );
}

export function FluxBalancePlot({ snapshot }: { snapshot: AcceptedSnapshot }) {
  const driftFlux = scalar(snapshot, "driftFlux");
  const diffFlux = scalar(snapshot, "diffusionFlux");
  const totalFlux = scalar(snapshot, "totalFlux");

  const maxFlux = Math.max(Math.abs(driftFlux), Math.abs(diffFlux), Math.abs(totalFlux), 1e-18);

  const w = 500;
  const h = 140;
  const barHeight = 24;

  const driftW = (Math.abs(driftFlux) / maxFlux) * 180;
  const diffW = (Math.abs(diffFlux) / maxFlux) * 180;

  return (
    <figure className="lab-figure" data-view-id="flux-balance-view" {...identity(snapshot)}>
      <figcaption className="figure-caption">
        <strong>Average face fluxes</strong>: Drift flux J_drift = n μ F vs Diffusive counter-flux
        J_diff = -D ∂n/∂x. In steady state, they cancel to produce net J ≈ 0.
      </figcaption>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="flux-svg"
        role="img"
        aria-label="Flux balance opposing arrows diagram"
      >
        <rect
          x={10}
          y={10}
          width={w - 20}
          height={h - 20}
          fill="var(--canvas-bg, #fdfcf9)"
          stroke="var(--border, #e2ded4)"
        />
        {/* Center zero line */}
        <line
          x1={250}
          y1={15}
          x2={250}
          y2={h - 15}
          stroke="var(--border-dark, #bbb)"
          strokeDasharray="3 3"
        />

        {/* Drift flux bar (top row) */}
        <text x={20} y={40} fontSize="12" fill="var(--color-drift, #27ae60)" fontWeight="bold">
          Drift flux (J_drift)
        </text>
        <rect
          x={driftFlux >= 0 ? 250 : 250 - driftW}
          y={28}
          width={Math.max(2, driftW)}
          height={barHeight}
          fill="var(--color-drift, #27ae60)"
          rx="3"
        />
        <text
          x={driftFlux >= 0 ? 255 + driftW : 245 - driftW}
          y={44}
          fontSize="11"
          fill="var(--ink, #333)"
          textAnchor={driftFlux >= 0 ? "start" : "end"}
        >
          {display(driftFlux, 1)} m⁻²s⁻¹
        </text>

        {/* Diffusion flux bar (bottom row) */}
        <text x={20} y={85} fontSize="12" fill="var(--color-diffusion, #c0392b)" fontWeight="bold">
          Diffusive flux (J_diff)
        </text>
        <rect
          x={diffFlux >= 0 ? 250 : 250 - diffW}
          y={73}
          width={Math.max(2, diffW)}
          height={barHeight}
          fill="var(--color-diffusion, #c0392b)"
          rx="3"
        />
        <text
          x={diffFlux >= 0 ? 255 + diffW : 245 - diffW}
          y={89}
          fontSize="11"
          fill="var(--ink, #333)"
          textAnchor={diffFlux >= 0 ? "start" : "end"}
        >
          {display(diffFlux, 1)} m⁻²s⁻¹
        </text>

        {/* Net flux summary badge */}
        <text x={20} y={120} fontSize="11" fill="var(--ink-muted, #666)">
          Net flux J = J_drift + J_diff : {display(totalFlux, 1)} m⁻²s⁻¹
        </text>
      </svg>
    </figure>
  );
}

export function ForceCancellationPanel({
  snapshot,
  forceFemtonewtons,
  kickMultiplier,
}: {
  snapshot: AcceptedSnapshot;
  forceFemtonewtons: number;
  kickMultiplier: number;
}) {
  const lambdaOsmResult = result(snapshot, "osmoticDecayLength");
  const lambdaKinResult = result(snapshot, "kineticDecayLength");
  const diffCoeffResult = result(snapshot, "diffusionCoefficient");

  const isZeroForce = forceFemtonewtons === 0;
  const isEinsteinMatch = Math.abs(kickMultiplier - 1.0) < 1e-6;

  return (
    <div className="cancellation-panel" data-view-id="balance-table-summary">
      <h3>The Force Cancellation Principle</h3>
      <p>
        In §3, Einstein equates the directional Stokes drift with the opposing Brownian diffusion.
        Notice how the magnitude of the applied force <var>F</var> drops out completely from the
        inferred diffusion coefficient:
      </p>
      <div className="equation-cancellation-box">
        <div className="cancellation-math">
          <span className="formula-part">
            D<sub>balance</sub> = μ |F| · λ<sub>kin</sub> = μ{" "}
            <span className="cancel-term">|F|</span> ·{" "}
            <span className="frac">
              <span className="num">
                k<sub>B</sub> T
              </span>
              <span className="den">
                <span className="cancel-term">|F|</span>
              </span>
            </span>{" "}
            = μ k<sub>B</sub> T = D<sub>mobility</sub>
          </span>
        </div>
      </div>

      <div className="decay-comparison-grid">
        <div className="decay-card">
          <h4>Osmotic Decay Length (Thermodynamic)</h4>
          <p className="card-eq">
            λ<sub>osm</sub> = k<sub>B</sub> T / |F|
          </p>
          <p className="card-value">
            {lambdaOsmResult.status === "value" && typeof lambdaOsmResult.value === "number" ? (
              <span data-quantity-id="osmoticDecayLength" data-value={lambdaOsmResult.value}>
                <strong>{display(lambdaOsmResult.value, 1e6)} μm</strong>
              </span>
            ) : (
              <span data-quantity-id="osmoticDecayLength" className="na-tag">
                {lambdaOsmResult.status === "not-applicable" ? lambdaOsmResult.reason : "N/A"}
              </span>
            )}
          </p>
          <p className="card-desc">
            Calculated directly from the force-balance exponential profile.
          </p>
        </div>

        <div className="decay-card">
          <h4>Kinetic Decay Length (Stepper)</h4>
          <p className="card-eq">
            λ<sub>kin</sub> = D<sub>kicks</sub> / (μ |F|)
          </p>
          <p className="card-value">
            {lambdaKinResult.status === "value" && typeof lambdaKinResult.value === "number" ? (
              <span data-quantity-id="kineticDecayLength" data-value={lambdaKinResult.value}>
                <strong>{display(lambdaKinResult.value, 1e6)} μm</strong>
              </span>
            ) : (
              <span data-quantity-id="kineticDecayLength" className="na-tag">
                {lambdaKinResult.status === "not-applicable" ? lambdaKinResult.reason : "N/A"}
              </span>
            )}
          </p>
          <p className="card-desc">Measured from the steady-state concentration slope.</p>
        </div>
      </div>

      <div className={`status-banner ${isEinsteinMatch ? "match-banner" : "mismatch-banner"}`}>
        {isZeroForce ? (
          <p>
            <strong>Zero force (F = 0):</strong> Without an external force there is no spatial
            gradient; decay lengths are not applicable and the equilibrium concentration is uniform.
          </p>
        ) : isEinsteinMatch ? (
          <p>
            <strong>Equilibrium Agreement (m = 1.0):</strong> The kinetic kicks exactly match the
            thermal expectation. The two routes to <var>D</var> agree, confirming Einstein’s
            relation{" "}
            <code>
              D = μ k_B T ={" "}
              {display(
                diffCoeffResult.status === "value" ? (diffCoeffResult.value as number) : 0,
                1e12,
              )}{" "}
              μm²/s
            </code>
            .
          </p>
        ) : kickMultiplier === 0 ? (
          <p>
            <strong>Nägeli Kicks-Off Branch (m = 0):</strong> Thermal agitation is disabled.
            Particles drift to the wall and cannot diffuse back, disproving Nägeli’s single-impact
            objection.
          </p>
        ) : (
          <p>
            <strong>Mismatched Kick Strength (m = {kickMultiplier}):</strong> The simulated kicks
            were not given the strength that equilibrium requires. <var>D</var>
            <sub>balance</sub> and <var>D</var>
            <sub>mobility</sub> disagree by a factor of {kickMultiplier}.
          </p>
        )}
      </div>
    </div>
  );
}
