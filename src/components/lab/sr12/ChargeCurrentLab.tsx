"use client";

import { type FormEvent, useId, useState, useSyncExternalStore } from "react";
import {
  SR12_CAPTION,
  SR12_DEFAULTS,
  SR12_MODEL,
  SR12_NOT_MODELED,
  type Sr12Parameters,
} from "../../../experiments/sr12/definition.ts";
import { validateSr12Parameters } from "../../../experiments/sr12/parameters.ts";
import { createSr12Session, type PreparedSr12Example } from "../../../experiments/sr12/session.ts";
import type { PublishedResult } from "../../../experiments/store/instanceStore.ts";
import { display, identity, result } from "../presentation.ts";
import { ChargeCurrentPlot } from "./ChargeCurrentPlot.tsx";

const C_SI = 299792458;

function OutputReading({ item }: { item: PublishedResult | undefined }) {
  if (!item) return <span>missing</span>;
  if (item.status === "value") {
    if (typeof item.value === "number") {
      return <span data-quantity-id={item.quantityId}>{display(item.value)}</span>;
    }
    if (item.value instanceof Float64Array) {
      const formatted = Array.from(item.value)
        .map((v) => display(v))
        .join(", ");
      return <span data-quantity-id={item.quantityId}>({formatted})</span>;
    }
  }
  if (item.status === "not-applicable" || item.status === "outside-domain") {
    return <span data-quantity-id={item.quantityId}>{item.reason}</span>;
  }
  return <span data-quantity-id={item.quantityId}>{item.status}</span>;
}

export function ChargeCurrentLab({
  example,
  title = "Charge and current density in moving frames",
}: {
  example: PreparedSr12Example;
  title?: string;
}) {
  const id = useId();
  const [session] = useState(() => createSr12Session(`sr12-${id}`, example));
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  const [draft, setDraft] = useState<Sr12Parameters>(() => ({ ...example.parameters }));
  const [error, setError] = useState("");
  const [prediction, setPrediction] = useState<string | null>(null);

  const snapshot = view.accepted ?? session.getServerSnapshot().accepted;
  if (!snapshot) return null;
  const p = snapshot.parameters as unknown as Sr12Parameters;

  function apply(parameters: Sr12Parameters) {
    const outcome = session.apply(parameters);
    if (outcome.kind === "refused") {
      setError(outcome.refusal.message);
      return;
    }
    setDraft(parameters);
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = validateSr12Parameters(draft);
    if (checked.kind !== "accepted") {
      setError(checked.refusal.message);
      return;
    }
    apply(checked.data);
  }

  const rhoStat = result(snapshot, "chargeDensityStationary");
  const rhoMov = result(snapshot, "chargeDensityMoving");
  const jStat = result(snapshot, "currentDensityStationary");
  const jMov = result(snapshot, "currentDensityMoving");
  const invSI = result(snapshot, "fourCurrentInvariant");
  const gRes = result(snapshot, "lorentzFactor");
  const contStat = result(snapshot, "continuityResidualStationary");
  const contMov = result(snapshot, "continuityResidualMoving");
  const legPos = result(snapshot, "loopLegChargePositive");
  const legNeg = result(snapshot, "loopLegChargeNegative");
  const loopTot = result(snapshot, "loopTotalCharge");
  const sphereStat = result(snapshot, "sphereTotalChargeStationary");
  const sphereMov = result(snapshot, "sphereTotalChargeMoving");

  const presets = [
    {
      id: "sr-12-neutral-conductor-0.6",
      label: "Neutral conductor (0.6c)",
      params: {
        mode: "neutral-conductor" as const,
        chargeDensity: 0,
        currentDensityX: 1,
        boost: 0.6 * C_SI,
      },
    },
    {
      id: "sr-12-convection-0.5c",
      label: "Convection current (0.5c to 0.6c)",
      params: {
        mode: "convection" as const,
        chargeDensity: 1,
        carrierVelocityX: 0.5 * C_SI,
        boost: 0.6 * C_SI,
      },
    },
    {
      id: "sr-12-moving-sphere-0.6c",
      label: "Moving sphere (0.6c)",
      params: {
        mode: "moving-sphere" as const,
        chargeDensity: 1,
        sphereRadius: 1,
        boost: 0.6 * C_SI,
      },
    },
    {
      id: "sr-12-gaussian-pulse-0.5c",
      label: "Gaussian pulse continuity (0.5c)",
      params: {
        mode: "gaussian-pulse" as const,
        pulseAmplitude: 1,
        carrierVelocityX: 0.5 * C_SI,
        pulseWidth: 1,
        boost: 0.6 * C_SI,
      },
    },
    {
      id: "sr-12-current-loop-0.6c",
      label: "Current loop (0.6c)",
      params: {
        mode: "current-loop" as const,
        loopCurrent: 1,
        loopLengthX: 1,
        loopLengthY: 0.5,
        boost: 0.6 * C_SI,
      },
    },
  ];

  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="sr-12"
      {...identity(snapshot)}
      data-execution-label="host"
      data-source-digest={example.sourceDigest}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">SR-12 · Special relativity §9</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <span className="badge">{SR12_MODEL.label}</span>
      </header>

      {/* Presets */}
      <nav aria-label="Presets" className="preset-list" style={{ marginBottom: "1rem" }}>
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={p.mode === preset.params.mode ? "button" : "button secondary"}
            onClick={() => apply({ ...p, ...preset.params })}
          >
            {preset.label}
          </button>
        ))}
      </nav>

      {/* Main interactive visualization */}
      <ChargeCurrentPlot
        rhoStationary={rhoStat}
        rhoMoving={rhoMov}
        jStationary={jStat}
        jMoving={jMov}
        lorentzFactor={gRes}
        boostFraction={p.boost / C_SI}
        mode={p.mode}
        loopLegChargePos={legPos}
        loopLegChargeNeg={legNeg}
        loopTotal={loopTot}
        sphereTotalStationary={sphereStat}
        sphereTotalMoving={sphereMov}
      />

      {/* Unit System Explanatory Note */}
      <aside
        className="notice"
        style={{
          margin: "1rem 0",
          fontSize: "0.8rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <span style={{ fontWeight: 600 }}>Unit System Modernization</span>
          <div className="button-group">
            <button
              type="button"
              className={p.unitLayer === "si" ? "button" : "button secondary"}
              style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", minHeight: "auto" }}
              onClick={() => apply({ ...p, unitLayer: "si" })}
            >
              SI (modern)
            </button>
            <button
              type="button"
              className={p.unitLayer === "gaussian" ? "button" : "button secondary"}
              style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", minHeight: "auto" }}
              onClick={() => apply({ ...p, unitLayer: "gaussian" })}
            >
              Gaussian 1905 (§9)
            </button>
          </div>
        </div>
        <p style={{ margin: 0 }}>
          Einstein’s 1905 paper employs Gaussian (CGS) units where Coulomb’s constant is 1 and
          Maxwell’s divergence equation contains a 4π factor (∇·E = 4πρ). In modern SI, ∇·E = ρ/ε₀
          where ε₀ = 1/(μ₀c²). Charge and current ratios remain identical across unit systems.
        </p>
      </aside>

      {/* Controls Form */}
      <form
        onSubmit={submit}
        className="lab-controls"
        style={{ display: "flex", flexDirection: "column", gap: "1rem", paddingTop: "0.5rem" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
            gap: "1rem",
          }}
        >
          <div
            className="input-field"
            style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.8rem" }}
          >
            <label htmlFor={`${id}-boost-range`} style={{ fontWeight: 500 }}>
              Observer Boost Speed (v/c): {(draft.boost / C_SI).toFixed(3)}
            </label>
            <input
              id={`${id}-boost-range`}
              type="range"
              min="-0.95"
              max="0.95"
              step="0.01"
              value={draft.boost / C_SI}
              onChange={(e) => setDraft({ ...draft, boost: parseFloat(e.target.value) * C_SI })}
              style={{ width: "100%" }}
            />
            <label
              htmlFor={`${id}-boost-number`}
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: "hidden",
                clip: "rect(0, 0, 0, 0)",
                whiteSpace: "nowrap",
                border: 0,
              }}
            >
              Observer Boost Speed (m/s)
            </label>
            <input
              id={`${id}-boost-number`}
              type="number"
              min="-284802835"
              max="284802835"
              value={draft.boost}
              onChange={(e) => setDraft({ ...draft, boost: parseFloat(e.target.value) || 0 })}
              style={{ fontSize: "0.8rem" }}
            />
          </div>

          <div
            className="input-field"
            style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.8rem" }}
          >
            <label htmlFor={`${id}-charge-density`} style={{ fontWeight: 500 }}>
              Charge Density ρ (C/m³)
            </label>
            <input
              id={`${id}-charge-density`}
              type="number"
              step="0.1"
              value={draft.chargeDensity}
              onChange={(e) =>
                setDraft({ ...draft, chargeDensity: parseFloat(e.target.value) || 0 })
              }
              aria-describedby={`${id}-charge-density-hint`}
              style={{ fontSize: "0.8rem" }}
            />
            <span id={`${id}-charge-density-hint`} className="fine" style={{ fontSize: "0.75rem" }}>
              Set 0 for neutral conductor
            </span>
          </div>

          <div
            className="input-field"
            style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.8rem" }}
          >
            <label htmlFor={`${id}-current-density-x`} style={{ fontWeight: 500 }}>
              Current Density Jx (A/m²)
            </label>
            <input
              id={`${id}-current-density-x`}
              type="number"
              step="0.1"
              value={draft.currentDensityX}
              onChange={(e) =>
                setDraft({ ...draft, currentDensityX: parseFloat(e.target.value) || 0 })
              }
              aria-describedby={`${id}-current-density-x-hint`}
              style={{ fontSize: "0.8rem" }}
            />
            <span
              id={`${id}-current-density-x-hint`}
              className="fine"
              style={{ fontSize: "0.75rem" }}
            >
              Conduction current along x
            </span>
          </div>
        </div>

        {error && (
          <div
            className="notice"
            style={{
              padding: "0.5rem 0.75rem",
              borderLeftColor: "var(--accent)",
              color: "var(--accent)",
              fontSize: "0.8rem",
            }}
          >
            {error}
          </div>
        )}

        <div className="button-group">
          <button type="submit" className="button">
            Apply parameters
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setDraft({ ...SR12_DEFAULTS });
              apply({ ...SR12_DEFAULTS });
            }}
          >
            Reset defaults
          </button>
        </div>
      </form>

      {/* Telemetry Output Table */}
      <section
        className="table-scroll"
        aria-label="Charge and current density telemetry across frames"
        style={{
          overflowX: "auto",
          border: "1px solid var(--line)",
          borderRadius: "0.25rem",
          margin: "1rem 0",
        }}
      >
        <table
          style={{
            width: "100%",
            fontSize: "0.8rem",
            textAlign: "left",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr style={{ background: "var(--wash)", borderBottom: "1px solid var(--line)" }}>
              <th style={{ padding: "0.5rem var(--table-cell-x)" }}>Quantity</th>
              <th style={{ padding: "0.5rem var(--table-cell-x)" }}>Stationary Frame (K)</th>
              <th style={{ padding: "0.5rem var(--table-cell-x)" }}>Moving Frame (k)</th>
              <th style={{ padding: "0.5rem var(--table-cell-x)" }}>Unit</th>
              <th style={{ padding: "0.5rem var(--table-cell-x)" }}>Lorentz Transformation Law</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: 500 }}>
                Charge Density ρ
              </td>
              <td style={{ padding: "0.5rem var(--table-cell-x)" }}>
                <OutputReading item={rhoStat} />
              </td>
              <td
                style={{
                  padding: "0.5rem var(--table-cell-x)",
                  fontFamily: "var(--font-mono)",
                  color: "var(--accent)",
                }}
              >
                <OutputReading item={rhoMov} />
              </td>
              <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>C/m³</td>
              <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>
                ρ&apos; = γ (ρ - vJx/c²)
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: 500 }}>
                Current Density Jx
              </td>
              <td style={{ padding: "0.5rem var(--table-cell-x)" }}>
                <OutputReading item={jStat} />
              </td>
              <td style={{ padding: "0.5rem var(--table-cell-x)", fontFamily: "var(--font-mono)" }}>
                <OutputReading item={jMov} />
              </td>
              <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>A/m²</td>
              <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>
                J&apos;x = γ (Jx - vρ)
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: 500 }}>
                Lorentz Factor γ
              </td>
              <td style={{ padding: "0.5rem var(--table-cell-x)" }} colSpan={2}>
                <OutputReading item={gRes} />
              </td>
              <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>1</td>
              <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>
                1 / √(1 - v²/c²)
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: 500 }}>
                Four-Current Invariant (cρ)² - |J|²
              </td>
              <td style={{ padding: "0.5rem var(--table-cell-x)" }} colSpan={2}>
                <OutputReading item={invSI} />
              </td>
              <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>
                A²/m⁴
              </td>
              <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>
                Exact scalar invariant across all frames
              </td>
            </tr>
            {p.mode === "current-loop" && (
              <>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: 500 }}>
                    Loop Top Leg Charge (+x)
                  </td>
                  <td style={{ padding: "0.5rem var(--table-cell-x)" }}>0 C</td>
                  <td
                    style={{
                      padding: "0.5rem var(--table-cell-x)",
                      fontFamily: "var(--font-mono)",
                      color: "var(--accent)",
                    }}
                  >
                    <OutputReading item={legPos} />
                  </td>
                  <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>
                    C
                  </td>
                  <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>
                    q&apos;+ = -v I lx / c²
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: 500 }}>
                    Loop Bottom Leg Charge (-x)
                  </td>
                  <td style={{ padding: "0.5rem var(--table-cell-x)" }}>0 C</td>
                  <td
                    style={{
                      padding: "0.5rem var(--table-cell-x)",
                      fontFamily: "var(--font-mono)",
                      color: "var(--plot)",
                    }}
                  >
                    <OutputReading item={legNeg} />
                  </td>
                  <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>
                    C
                  </td>
                  <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>
                    q&apos;- = +v I lx / c²
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: 500 }}>
                    Loop Total Charge
                  </td>
                  <td style={{ padding: "0.5rem var(--table-cell-x)" }}>0 C</td>
                  <td
                    style={{
                      padding: "0.5rem var(--table-cell-x)",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                    }}
                  >
                    <OutputReading item={loopTot} />
                  </td>
                  <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>
                    C
                  </td>
                  <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>
                    Q&apos; = q&apos;+ + q&apos;- = 0 (charge conservation)
                  </td>
                </tr>
              </>
            )}
            {p.mode === "moving-sphere" && (
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: 500 }}>
                  Sphere Total Charge Q
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)" }}>
                  <OutputReading item={sphereStat} />
                </td>
                <td
                  style={{
                    padding: "0.5rem var(--table-cell-x)",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                  }}
                >
                  <OutputReading item={sphereMov} />
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>C</td>
                <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>
                  Q&apos; = Q (exact invariance of total charge)
                </td>
              </tr>
            )}
            {p.mode === "gaussian-pulse" && (
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: 500 }}>
                  Continuity Residual ∂ρ/∂t + ∇·J
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)" }}>
                  <OutputReading item={contStat} />
                </td>
                <td
                  style={{ padding: "0.5rem var(--table-cell-x)", fontFamily: "var(--font-mono)" }}
                >
                  <OutputReading item={contMov} />
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>
                  A/m³
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>
                  0 in all inertial frames
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Predict Mode */}
      <section
        style={{
          padding: "1rem",
          background: "var(--wash)",
          border: "1px solid var(--line)",
          borderRadius: "0.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          margin: "1rem 0",
        }}
      >
        <h4 className="eyebrow" style={{ margin: 0, fontSize: "0.75rem" }}>
          Predict: is a neutral wire still neutral in a moving frame?
        </h4>
        <p style={{ margin: 0, fontSize: "0.85rem" }}>
          A neutral wire in the laboratory carries a current in the +x direction. Described from a
          frame moving in the +x direction at 0.6c, is the wire still electrically neutral?
        </p>

        <div className="button-group">
          {[
            { id: "still-neutral", label: "Still neutral (ρ' = 0)" },
            { id: "negatively-charged", label: "Negatively charged (ρ' < 0)" },
            { id: "positively-charged", label: "Positively charged (ρ' > 0)" },
          ].map((cand) => (
            <button
              key={cand.id}
              type="button"
              className={prediction === cand.id ? "button" : "button secondary"}
              style={{ fontSize: "0.75rem" }}
              onClick={() => setPrediction(cand.id)}
            >
              {cand.label}
            </button>
          ))}
        </div>

        {prediction && (
          <div
            className="notice"
            style={{
              padding: "0.75rem",
              borderRadius: "0.25rem",
              fontSize: "0.8rem",
            }}
          >
            <p style={{ margin: "0 0 0.25rem", fontWeight: 600 }}>
              {prediction === "negatively-charged" ? "✓ Correct!" : "Explanation:"}
            </p>
            <p style={{ margin: 0 }}>
              Because charge density and current density transform together like a four-vector,
              ρ&apos; = γ(ρ - vJx/c²). When ρ = 0 and Jx &gt; 0 with v &gt; 0, ρ&apos; = -γ v Jx /
              c² &lt; 0. The moving observer describes the wire as carrying a net negative charge
              density. Conversely, an observer moving in the -x direction (v &lt; 0) observes a net
              positive charge density.
            </p>
          </div>
        )}
      </section>

      {/* Editorial Explanations (R0-R3) */}
      <footer
        className="fine"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          paddingTop: "1rem",
          borderTop: "1px solid var(--line)",
          marginTop: "1rem",
        }}
      >
        <p style={{ margin: 0 }}>
          <strong>Overview:</strong> {SR12_CAPTION.r0}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Four-Current Invariant:</strong> {SR12_CAPTION.r1}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Current Loops & Total Charge:</strong> {SR12_CAPTION.r2}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Continuity Invariance (§9):</strong> {SR12_CAPTION.r3}
        </p>
        <div style={{ paddingTop: "0.5rem", fontSize: "0.75rem" }}>
          <strong>Not modeled:</strong> {SR12_NOT_MODELED.join(", ")}.
        </div>
      </footer>
    </section>
  );
}
