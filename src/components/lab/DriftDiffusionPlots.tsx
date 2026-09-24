import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { array, display, identity, result, scalar } from "./presentation.ts";
import "./driftDiffusion.css";

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

  // 300 units wide, like the other lab plots: at 500 units the site's label size rendered at
  // 8.6px on a 390px phone.
  const w = 300;
  const h = 200;
  const padL = 44;
  const padR = 14;
  const padT = 14;
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
    <figure
      data-view-id="density-profile-view"
      {...identity(snapshot)}
      style={{ margin: 0, padding: 0 }}
    >
      <figcaption
        style={{
          fontSize: "0.875rem",
          color: "var(--muted)",
          marginBottom: "0.5rem",
          lineHeight: 1.4,
        }}
      >
        <strong>Concentration across the channel.</strong> The current density (solid) against the
        osmotic equilibrium (dashed).
      </figcaption>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="drift-plot-svg"
        role="img"
        aria-label="Concentration profile across the 1D channel"
      >
        <rect
          x={padL}
          y={padT}
          width={plotW}
          height={plotH}
          fill="var(--wash)"
          stroke="var(--line)"
        />
        {/* Shaded area */}
        <path d={areaPath} fill="rgba(41, 128, 185, 0.15)" />
        {/* Osmotic equilibrium theoretical curve */}
        <path
          d={osmoticPath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
        {/* Current density curve */}
        <path d={densityPath} fill="none" stroke="var(--plot)" strokeWidth="2.5" />
        {/* Axes */}
        <line
          x1={padL}
          y1={padT + plotH}
          x2={padL + plotW}
          y2={padT + plotH}
          stroke="var(--ink)"
          strokeWidth="1.5"
        />
        <line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={padT + plotH}
          stroke="var(--ink)"
          strokeWidth="1.5"
        />
        {/* X-axis labels */}
        <text x={padL} y={h - 10} fontSize="11" textAnchor="start" fill="var(--muted)">
          0 μm
        </text>
        <text x={padL + plotW / 2} y={h - 10} fontSize="11" textAnchor="middle" fill="var(--muted)">
          {display(widthMicrons / 2, 1)} μm
        </text>
        <text x={padL + plotW} y={h - 10} fontSize="11" textAnchor="end" fill="var(--muted)">
          {display(widthMicrons, 1)} μm
        </text>
        {/* Y-axis labels */}
        <text x={padL - 6} y={padT + 12} fontSize="10" textAnchor="end" fill="var(--muted)">
          Peak
        </text>
        <text x={padL - 6} y={padT + plotH} fontSize="10" textAnchor="end" fill="var(--muted)">
          0
        </text>
      </svg>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          fontSize: "var(--type-fine)",
          color: "var(--muted)",
          marginTop: "0.5rem",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem" }}>
          <span
            style={{
              width: "1rem",
              height: "0.25rem",
              background: "var(--plot)",
              display: "inline-block",
            }}
          />
          Current density profile n(x)
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem" }}>
          <span
            style={{
              width: "1rem",
              height: "0",
              borderTop: "2px dashed var(--accent)",
              display: "inline-block",
            }}
          />
          {/* One span: the flex gap would otherwise part the subscript from its letter. */}
          <span>
            Osmotic equilibrium n<sub>osm</sub>(x)
          </span>
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

  // Signed bars around a zero line, in HTML. As an SVG, a negative diffusive flux placed its value
  // by the DRIFT bar's width and drew it over its own row label, cut off at the left edge, and the
  // drift value ran off the right; every label was 8.6px on a phone.
  const rows = [
    {
      key: "drift",
      label: (
        <>
          Drift flux, J<sub>drift</sub>
        </>
      ),
      value: driftFlux,
      color: "var(--bm04-drift)",
    },
    {
      key: "diffusion",
      label: (
        <>
          Diffusive flux, J<sub>diff</sub>
        </>
      ),
      value: diffFlux,
      color: "var(--bm04-diffusion)",
    },
  ];

  return (
    <figure data-view-id="flux-balance-view" {...identity(snapshot)} className="flux-balance">
      <figcaption className="flux-balance-caption">
        <strong>Average face fluxes.</strong> Drift, J<sub>drift</sub> = nμF, against diffusion, J
        <sub>diff</sub> = −D ∂n/∂x. In a steady state they cancel, and the net flux is close to
        zero.
      </figcaption>
      {rows.map((row) => {
        const half = `${((Math.abs(row.value) / maxFlux) * 50).toFixed(1)}%`;
        return (
          <div className="flux-row" key={row.key} data-flux={row.key}>
            <span className="flux-label">{row.label}</span>
            <span className="flux-value">{display(row.value, 1)} m⁻²s⁻¹</span>
            <span className="flux-track" aria-hidden="true">
              <span className="flux-zero" />
              <span
                className="flux-bar"
                style={
                  row.value >= 0
                    ? { left: "50%", width: half, background: row.color }
                    : { right: "50%", width: half, background: row.color }
                }
              />
            </span>
          </div>
        );
      })}
      <p className="flux-net">
        Net flux J = J<sub>drift</sub> + J<sub>diff</sub> = {display(totalFlux, 1)} m⁻²s⁻¹
      </p>
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
    <div
      data-view-id="balance-table-summary"
      style={{
        padding: "1.25rem",
        borderRadius: "0.5rem",
        border: "1px solid var(--line)",
        background: "var(--panel)",
        color: "var(--ink)",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <h3 style={{ margin: 0, fontSize: "1.125rem", fontFamily: "var(--font-serif)" }}>
        The force cancellation principle
      </h3>
      <p style={{ margin: 0, fontSize: "0.9375rem", lineHeight: 1.5 }}>
        In §3, Einstein equates the directional Stokes drift with the opposing Brownian diffusion.
        Notice how the magnitude of the applied force <var>F</var> drops out completely from the
        inferred diffusion coefficient:
      </p>
      <div
        style={{
          padding: "0.75rem 1rem",
          background: "var(--wash)",
          border: "1px solid var(--line)",
          borderRadius: "0.375rem",
          overflowX: "auto",
          textAlign: "center",
          fontFamily: "var(--font-serif)",
          fontSize: "1.05rem",
        }}
      >
        <div style={{ display: "inline-block" }}>
          <span>
            D<sub>balance</sub> = μ |F| · λ<sub>kin</sub> = μ{" "}
            <span style={{ textDecoration: "line-through", color: "var(--muted)" }}>|F|</span> ·{" "}
            <span
              style={{
                display: "inline-flex",
                flexDirection: "column",
                verticalAlign: "middle",
                textAlign: "center",
                padding: "0 0.25rem",
                fontSize: "0.9em",
              }}
            >
              <span style={{ borderBottom: "1px solid var(--ink)", paddingBottom: "0.1rem" }}>
                k<sub>B</sub> T
              </span>
              <span style={{ paddingTop: "0.1rem" }}>
                <span style={{ textDecoration: "line-through", color: "var(--muted)" }}>|F|</span>
              </span>
            </span>{" "}
            = μ k<sub>B</sub> T = D<sub>mobility</sub>
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
          gap: "1rem",
        }}
      >
        <div
          style={{
            padding: "1rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--line)",
            background: "var(--wash)",
          }}
        >
          <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", fontWeight: 600 }}>
            Osmotic decay length (thermodynamic)
          </h4>
          <p
            style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", fontFamily: "var(--font-serif)" }}
          >
            λ<sub>osm</sub> = k<sub>B</sub> T / |F|
          </p>
          <p style={{ margin: "0 0 0.5rem", fontSize: "1.125rem", color: "var(--accent)" }}>
            {lambdaOsmResult.status === "value" && typeof lambdaOsmResult.value === "number" ? (
              <span data-quantity-id="osmoticDecayLength" data-value={lambdaOsmResult.value}>
                <strong>{display(lambdaOsmResult.value, 1e6)} μm</strong>
              </span>
            ) : (
              <span
                data-quantity-id="osmoticDecayLength"
                className="badge"
                style={{
                  padding: "0.125rem 0.375rem",
                  borderRadius: "0.25rem",
                  background: "var(--panel)",
                  color: "var(--muted)",
                  fontSize: "var(--type-fine)",
                  border: "1px solid var(--line)",
                }}
              >
                {lambdaOsmResult.status === "not-applicable" ? lambdaOsmResult.reason : "N/A"}
              </span>
            )}
          </p>
          <p style={{ margin: 0, fontSize: "var(--type-fine)", color: "var(--muted)" }}>
            Calculated directly from the force-balance exponential profile.
          </p>
        </div>

        <div
          style={{
            padding: "1rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--line)",
            background: "var(--wash)",
          }}
        >
          <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", fontWeight: 600 }}>
            Kinetic decay length (stepper)
          </h4>
          <p
            style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", fontFamily: "var(--font-serif)" }}
          >
            λ<sub>kin</sub> = D<sub>kicks</sub> / (μ |F|)
          </p>
          <p style={{ margin: "0 0 0.5rem", fontSize: "1.125rem", color: "var(--accent)" }}>
            {lambdaKinResult.status === "value" && typeof lambdaKinResult.value === "number" ? (
              <span data-quantity-id="kineticDecayLength" data-value={lambdaKinResult.value}>
                <strong>{display(lambdaKinResult.value, 1e6)} μm</strong>
              </span>
            ) : (
              <span
                data-quantity-id="kineticDecayLength"
                className="badge"
                style={{
                  padding: "0.125rem 0.375rem",
                  borderRadius: "0.25rem",
                  background: "var(--panel)",
                  color: "var(--muted)",
                  fontSize: "var(--type-fine)",
                  border: "1px solid var(--line)",
                }}
              >
                {lambdaKinResult.status === "not-applicable" ? lambdaKinResult.reason : "N/A"}
              </span>
            )}
          </p>
          <p style={{ margin: 0, fontSize: "var(--type-fine)", color: "var(--muted)" }}>
            Measured from the steady-state concentration slope.
          </p>
        </div>
      </div>

      <div
        style={{
          padding: "0.75rem 1rem",
          borderRadius: "0.375rem",
          border: isEinsteinMatch ? "1px solid var(--accent)" : "1px solid var(--line)",
          background: "var(--wash)",
          fontSize: "0.875rem",
          lineHeight: 1.5,
        }}
      >
        {isZeroForce ? (
          <p style={{ margin: 0 }}>
            <strong>Zero force (F = 0):</strong> Without an external force there is no spatial
            gradient; decay lengths are not applicable and the equilibrium concentration is uniform.
          </p>
        ) : isEinsteinMatch ? (
          <p style={{ margin: 0 }}>
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
          <p style={{ margin: 0 }}>
            <strong>Nägeli Kicks-Off Branch (m = 0):</strong> Thermal agitation is disabled.
            Particles drift to the wall and cannot diffuse back, disproving Nägeli’s single-impact
            objection.
          </p>
        ) : (
          <p style={{ margin: 0 }}>
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
