"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { createLq01BrowserChannel } from "../../experiments/lq01/browser.ts";
import { fromLq01Draft, toLq01Draft } from "../../experiments/lq01/controls.ts";
import {
  LQ01_MODEL,
  LQ01_PRESETS,
  LQ01_PROMPTS,
  type Lq01Parameters,
} from "../../experiments/lq01/definition.ts";
import { decodeLq01Settings, encodeLq01Settings } from "../../experiments/lq01/permalink.ts";
import { createLq01Session, type PreparedLq01Example } from "../../experiments/lq01/session.ts";
import { array, identity, result, scalar } from "./presentation.ts";
import { ShowTheCode } from "./ShowTheCode.tsx";
import { InterferencePlot, SpreadingPlot, WavefrontPlot } from "./WaveDescriptionPlots.tsx";

export type WaveDescriptionLabProps = Readonly<{
  example: PreparedLq01Example;
  title?: string;
}>;

export function WaveDescriptionLab({
  example,
  title = "Wave description and energy spreading laboratory",
}: WaveDescriptionLabProps) {
  const id = useId();
  const [session] = useState(() =>
    createLq01Session(`lq01-${id}`, example, createLq01BrowserChannel),
  );
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  const snapshot =
    view.accepted ??
    session.getServerSnapshot().accepted ??
    (session.getSnapshot().accepted as NonNullable<typeof view.accepted>);
  const p = snapshot.parameters as unknown as Lq01Parameters;

  const [draft, setDraft] = useState(() => toLq01Draft(example.parameters));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [linkNote, setLinkNote] = useState("");

  // Predict mode state
  const [activePromptKey, setActivePromptKey] = useState<"phase-shift" | "inverse-square">(
    "phase-shift",
  );
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, string>>({});

  useEffect(() => {
    setReady(true);
    const shared = decodeLq01Settings(window.location.search);
    if (shared.kind === "settings") {
      setDraft(toLq01Draft(shared.parameters));
      setLinkNote(
        "Shared settings are loaded. Choose Apply settings to calculate them; the worked example is still displayed.",
      );
    } else if (shared.kind === "invalid") {
      setLinkNote(shared.message);
    }
    return () => session.disconnect();
  }, [session]);

  function apply(parameters: Lq01Parameters) {
    const outcome = session.apply(parameters);
    if (outcome.kind === "refused") {
      setError(
        typeof outcome.refusal.details?.requirements === "string"
          ? outcome.refusal.details.requirements
          : outcome.refusal.message,
      );
      return;
    }
    setError("");
    setLinkNote("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      apply(fromLq01Draft(draft));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check the entered settings.");
    }
  }

  function preset(parameters: Lq01Parameters) {
    setDraft(toLq01Draft(parameters));
    setError("");
    apply(parameters);
  }

  async function share() {
    const url = new URL(window.location.pathname, window.location.origin);
    url.search = encodeLq01Settings(session.acceptedParameters());
    try {
      await navigator.clipboard.writeText(url.href);
      setLinkNote("Link to the accepted settings copied.");
    } catch {
      setLinkNote("Copy the accepted-settings link from the field below.");
    }
  }

  const primaryResult = result(snapshot, "centerIntensity");
  const centerIntensity = scalar(snapshot, "centerIntensity");
  const fringeVisibility = scalar(snapshot, "fringeVisibility");
  const fringeSpacing = scalar(snapshot, "fringeSpacing");
  const pointSourceIntensity = scalar(snapshot, "pointSourceIntensity");
  const shellPower = scalar(snapshot, "shellPower");
  const smallAperturePower = scalar(snapshot, "smallAperturePower");
  const exactDiskPower = scalar(snapshot, "exactDiskPower");
  const pathDifference = scalar(snapshot, "pathDifference");
  const selectedIntensity = scalar(snapshot, "selectedPositionIntensity");
  const screenProfile = array(snapshot, "screenIntensity").copy();

  const currentPrompt = LQ01_PROMPTS[activePromptKey];

  return (
    <section
      className="laboratory"
      style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
      aria-labelledby={`${id}-title`}
      data-instrument-id="lq-01"
      data-testid="wave-description-lab"
      {...identity(snapshot)}
      data-input-revision={view.requested?.revisions.input ?? 1}
      data-accepted-input-revision={snapshot.revisions.input}
      data-pending={String(view.pending)}
      data-execution-label="host"
      data-source-digest={example.sourceDigest}
      data-result-status={primaryResult.status}
      {...(view.refusal ? { "data-refusal-code": view.refusal.code } : {})}
    >
      <header
        className="lab-heading"
        style={{
          borderBottom: "1px solid var(--line)",
          paddingBottom: "1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
            width: "100%",
          }}
        >
          <div>
            <p className="eyebrow">LQ-01 · An executable model</p>
            <h2 id={`${id}-title`} style={{ margin: "0.25rem 0" }}>
              {title}
            </h2>
          </div>
          <span className="badge">{LQ01_MODEL.label}</span>
        </div>
      </header>

      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built.
          Its graph, values, model assumptions and explanations remain available; changing the
          settings requires JavaScript.
        </p>
      </noscript>

      <p className="fine" style={{ margin: 0 }}>
        In the introduction of his 1905 light paper, Einstein affirms that the wave theory has
        proven excellent for purely optical phenomena and will presumably never be replaced. Explore
        two-source wave interference, time-averaged versus instantaneous readouts, and spherical
        inverse-square energy spreading.
      </p>

      {/* Discovery Predict Mode */}
      <section className="notice" aria-label="Predict before calculating">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
            marginBottom: "0.5rem",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "0.95rem" }}>
            Discovery mode: predict before calculating
          </h3>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => setActivePromptKey("phase-shift")}
              className={`button ${activePromptKey === "phase-shift" ? "" : "secondary"}`}
              style={{ padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}
            >
              Phase Shift Interference
            </button>
            <button
              type="button"
              onClick={() => setActivePromptKey("inverse-square")}
              className={`button ${activePromptKey === "inverse-square" ? "" : "secondary"}`}
              style={{ padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}
            >
              Inverse-Square Spreading
            </button>
          </div>
        </div>

        <p style={{ fontWeight: 600, margin: "0 0 0.75rem", fontSize: "0.875rem" }}>
          {currentPrompt.question}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
            gap: "0.5rem",
            marginBottom: "0.75rem",
          }}
        >
          {currentPrompt.candidates.map((c) => (
            <label
              key={c.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                padding: "0.625rem",
                borderRadius: "4px",
                border:
                  selectedCandidates[currentPrompt.id] === c.id
                    ? "1px solid var(--plot)"
                    : "1px solid var(--line)",
                background:
                  selectedCandidates[currentPrompt.id] === c.id ? "var(--wash)" : "var(--panel)",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="radio"
                  name={`${id}-predict-${currentPrompt.id}`}
                  value={c.id}
                  checked={selectedCandidates[currentPrompt.id] === c.id}
                  onChange={() =>
                    setSelectedCandidates((prev) => ({ ...prev, [currentPrompt.id]: c.id }))
                  }
                  style={{ accentColor: "var(--accent)" }}
                />
                <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>{c.label}</span>
              </div>
              <span className="fine" style={{ fontSize: "0.75rem" }}>
                {c.description}
              </span>
              <span className="fine" style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem" }}>
                {c.relation}
              </span>
            </label>
          ))}
        </div>

        {selectedCandidates[currentPrompt.id] && (
          <div
            className="notice"
            style={{
              padding: "0.75rem",
              background: "var(--panel)",
              border: "1px solid var(--line)",
            }}
          >
            <span style={{ fontWeight: 600 }}>Model reveal: </span>
            <span className="fine">
              {activePromptKey === "phase-shift" ? (
                <>
                  Equal waves shifted by half a wave (δ = π) cancel completely by destructive
                  interference, dropping center intensity to <strong>0</strong>. Equal waves in
                  phase (δ = 0) interfere constructively to yield 4 times single-wave intensity.
                </>
              ) : (
                <>
                  Because radiant power spreads evenly over spherical area 4πr², doubling distance
                  multiplies area by 4, reducing intensity to <strong>one quarter (1/4)</strong>.
                </>
              )}
            </span>
          </div>
        )}
      </section>

      {/* Presets Bar */}
      <nav
        aria-label="Presets"
        className="preset-list"
        style={{ alignItems: "center", marginBottom: 0 }}
      >
        <span className="fine" style={{ fontWeight: 600, marginRight: "0.25rem" }}>
          Presets:
        </span>
        {Object.entries(LQ01_PRESETS).map(([key, item]) => (
          <button
            key={key}
            type="button"
            className="button secondary"
            onClick={() => preset(item.parameters)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Mode Switcher */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          background: "var(--panel)",
          padding: "0.5rem 0.75rem",
          borderRadius: "4px",
          border: "1px solid var(--line)",
        }}
      >
        <span className="fine" style={{ fontWeight: 600 }}>
          Display Mode:
        </span>
        <label
          className="fine"
          style={{ display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer" }}
        >
          <input
            type="radio"
            name={`${id}-mode`}
            value="interference"
            checked={p.mode === "interference"}
            onChange={() => apply({ ...p, mode: "interference" })}
          />
          Two-Source Interference
        </label>
        <label
          className="fine"
          style={{ display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer" }}
        >
          <input
            type="radio"
            name={`${id}-mode`}
            value="spreading"
            checked={p.mode === "spreading"}
            onChange={() => apply({ ...p, mode: "spreading" })}
          />
          Spherical Energy Spreading (Inverse-Square)
        </label>
      </div>

      {/* Controls Form */}
      <form
        onSubmit={submit}
        aria-label="Wave description laboratory settings"
        aria-describedby={error ? `${id}-error` : undefined}
        style={{
          background: "var(--panel)",
          padding: "1rem",
          borderRadius: "4px",
          border: "1px solid var(--line)",
        }}
      >
        <fieldset
          disabled={!ready}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <legend style={{ paddingBottom: "0.5rem" }}>Interactive Model Controls</legend>

          {p.mode === "interference" ? (
            <div
              className="input-grid"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))" }}
            >
              {/* Amplitude 1 */}
              <div className="input-field">
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <label htmlFor={`${id}-a1`}>Amplitude A₁</label>
                  <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                    {p.A1.toFixed(2)}
                  </span>
                </div>
                <input
                  id={`${id}-a1-range`}
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={draft.A1}
                  onChange={(e) => {
                    const next = { ...draft, A1: e.target.value };
                    setDraft(next);
                    try {
                      apply(fromLq01Draft(next));
                    } catch {}
                  }}
                  style={{ width: "100%", marginTop: "0.25rem" }}
                />
              </div>

              {/* Amplitude 2 */}
              <div className="input-field">
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <label htmlFor={`${id}-a2`}>Amplitude A₂</label>
                  <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                    {p.A2.toFixed(2)}
                  </span>
                </div>
                <input
                  id={`${id}-a2-range`}
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={draft.A2}
                  onChange={(e) => {
                    const next = { ...draft, A2: e.target.value };
                    setDraft(next);
                    try {
                      apply(fromLq01Draft(next));
                    } catch {}
                  }}
                  style={{ width: "100%", marginTop: "0.25rem" }}
                />
              </div>

              {/* Relative Phase Delta */}
              <div className="input-field">
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <label htmlFor={`${id}-delta`}>Relative Phase δ</label>
                  <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                    {(p.delta / Math.PI).toFixed(2)} π rad ({(p.delta * (180 / Math.PI)).toFixed(0)}
                    °)
                  </span>
                </div>
                <input
                  id={`${id}-delta-range`}
                  type="range"
                  min="0"
                  max={Math.PI * 2}
                  step="0.05"
                  value={draft.delta}
                  onChange={(e) => {
                    const next = { ...draft, delta: e.target.value };
                    setDraft(next);
                    try {
                      apply(fromLq01Draft(next));
                    } catch {}
                  }}
                  style={{ width: "100%", marginTop: "0.25rem" }}
                />
              </div>

              {/* Source Separation d */}
              <div className="input-field">
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <label htmlFor={`${id}-sep`}>Separation d (in λ)</label>
                  <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                    {p.separation.toFixed(1)} λ
                  </span>
                </div>
                <input
                  id={`${id}-sep-range`}
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.2"
                  value={draft.separation}
                  onChange={(e) => {
                    const next = { ...draft, separation: e.target.value };
                    setDraft(next);
                    try {
                      apply(fromLq01Draft(next));
                    } catch {}
                  }}
                  style={{ width: "100%", marginTop: "0.25rem" }}
                />
              </div>

              {/* Readout Mode */}
              <div className="input-field">
                <span
                  className="fine"
                  style={{ fontWeight: 600, display: "block", marginBottom: "0.25rem" }}
                >
                  Readout Mode
                </span>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => apply({ ...p, readout: "time-average" })}
                    className={`button ${p.readout === "time-average" ? "" : "secondary"}`}
                    style={{ padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}
                  >
                    Time-Averaged
                  </button>
                  <button
                    type="button"
                    onClick={() => apply({ ...p, readout: "instantaneous" })}
                    className={`button ${p.readout === "instantaneous" ? "" : "secondary"}`}
                    style={{ padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}
                  >
                    Instantaneous Snapshot
                  </button>
                </div>
              </div>

              {/* Screen Position Selector */}
              <div className="input-field">
                <span
                  className="fine"
                  style={{ fontWeight: 600, display: "block", marginBottom: "0.25rem" }}
                >
                  Screen Probe Position
                </span>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {(["center", "first-min", "first-max"] as const).map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => apply({ ...p, screenPosition: pos })}
                      className={`button ${p.screenPosition === pos ? "" : "secondary"}`}
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                    >
                      {pos === "center" ? "Center" : pos === "first-min" ? "1st Min" : "1st Max"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="input-grid"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))" }}
            >
              {/* Source Power P */}
              <div className="input-field">
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <label htmlFor={`${id}-power`}>Source Radiant Power P (W)</label>
                  <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                    {p.P.toFixed(2)} W
                  </span>
                </div>
                <input
                  id={`${id}-power-range`}
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={draft.P}
                  onChange={(e) => {
                    const next = { ...draft, P: e.target.value };
                    setDraft(next);
                    try {
                      apply(fromLq01Draft(next));
                    } catch {}
                  }}
                  style={{ width: "100%", marginTop: "0.25rem" }}
                />
              </div>

              {/* Radius r */}
              <div className="input-field">
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <label htmlFor={`${id}-radius`}>Observation Radius r (m)</label>
                  <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                    {p.r.toFixed(2)} m
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginTop: "0.25rem",
                  }}
                >
                  <input
                    id={`${id}-radius-range`}
                    type="range"
                    min="0.2"
                    max="10"
                    step="0.1"
                    value={draft.r}
                    onChange={(e) => {
                      const next = { ...draft, r: e.target.value };
                      setDraft(next);
                      try {
                        apply(fromLq01Draft(next));
                      } catch {}
                    }}
                    style={{ flex: 1 }}
                  />
                  <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0 }}>
                    {[1, 2, 4].map((rad) => (
                      <button
                        key={rad}
                        type="button"
                        onClick={() => apply({ ...p, r: rad })}
                        className="button secondary"
                        style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                      >
                        {rad}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p id={`${id}-error`} className="notice error" style={{ margin: 0, padding: "0.5rem" }}>
              {error}
            </p>
          )}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.5rem",
              paddingTop: "0.5rem",
              borderTop: "1px solid var(--line)",
            }}
          >
            <button type="submit" className="button">
              Apply settings
            </button>
            <button type="button" onClick={share} className="button secondary">
              Copy settings link
            </button>
          </div>
          {linkNote && (
            <p className="fine" style={{ color: "var(--accent)", margin: 0 }}>
              {linkNote}
            </p>
          )}
        </fieldset>
      </form>

      {/* Visualizations Grid */}
      {p.mode === "interference" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
            gap: "1.5rem",
          }}
        >
          <InterferencePlot
            screenIntensity={screenProfile}
            centerIntensity={centerIntensity}
            fringeVisibility={fringeVisibility}
            fringeSpacing={fringeSpacing}
            pathDifference={pathDifference}
            selectedIntensity={selectedIntensity}
            screenPosition={p.screenPosition}
            readout={p.readout}
            delta={p.delta}
          />
          <WavefrontPlot
            separation={p.separation}
            wavelength={p.wavelength}
            delta={p.delta}
            centerIntensity={centerIntensity}
          />
        </div>
      ) : (
        <SpreadingPlot
          power={p.P}
          radius={p.r}
          intensity={pointSourceIntensity}
          shellPower={shellPower}
          smallAperturePower={smallAperturePower}
          exactDiskPower={exactDiskPower}
        />
      )}

      {/* Accepted Results Telemetry Table */}
      <div
        data-view-id="lq-01-data-table"
        style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "4px",
          padding: "1rem",
        }}
      >
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>
          Accepted laboratory telemetry snapshot
        </h3>
        <section className="table-scroll" aria-label="Accepted laboratory telemetry snapshot table">
          <table
            style={{
              width: "100%",
              textAlign: "left",
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)", color: "var(--muted)" }}>
                <th style={{ padding: "0.4rem var(--table-cell-x)" }}>Quantity ID</th>
                <th style={{ padding: "0.4rem var(--table-cell-x)" }}>Status</th>
                <th style={{ padding: "0.4rem var(--table-cell-x)" }}>Value / Result</th>
                <th style={{ padding: "0.4rem var(--table-cell-x)" }}>Unit</th>
                <th style={{ padding: "0.4rem var(--table-cell-x)" }}>Owner ID</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.outputs.map((out) => (
                <tr
                  key={out.quantityId}
                  style={{ borderBottom: "1px solid var(--line)" }}
                  data-quantity-id={out.quantityId}
                >
                  <td style={{ padding: "0.4rem var(--table-cell-x)", fontWeight: 500 }}>
                    {out.quantityId}
                  </td>
                  <td style={{ padding: "0.4rem var(--table-cell-x)" }}>
                    <span
                      className="badge"
                      style={out.status === "value" ? undefined : { color: "var(--accent)" }}
                    >
                      {out.status}
                    </span>
                  </td>
                  <td style={{ padding: "0.4rem var(--table-cell-x)" }}>
                    {out.status === "value"
                      ? out.value instanceof Float64Array
                        ? `[Float64Array ${out.value.length} pts]`
                        : typeof out.value === "number"
                          ? Math.abs(out.value) > 1e4 ||
                            (Math.abs(out.value) < 1e-3 && out.value !== 0)
                            ? out.value.toExponential(4)
                            : out.value.toFixed(4)
                          : String(out.value)
                      : "reason" in out
                        ? String(out.reason)
                        : "Out of domain"}
                  </td>
                  <td style={{ padding: "0.4rem var(--table-cell-x)", color: "var(--muted)" }}>
                    {out.unit}
                  </td>
                  <td
                    style={{
                      padding: "0.4rem var(--table-cell-x)",
                      color: "var(--muted)",
                      fontSize: "0.7rem",
                    }}
                  >
                    {out.ownerId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {/* Epistemic Limits (Not Modeled) */}
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "4px",
          padding: "1rem",
        }}
      >
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>
          Limits of this classical wave model (not modeled)
        </h3>
        <p className="fine" style={{ margin: "0 0 0.5rem" }}>
          This reference owner implements continuous classical wave optics and geometric energy
          spreading. The following physical regimes require vector electrodynamics, microscopic
          matter coupling, or quantum optics and are explicitly <strong>not modeled</strong>:
        </p>
        <ul
          className="fine"
          style={{
            paddingLeft: "1.25rem",
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <li>Polarization and vector electromagnetic field components.</li>
          <li>Photon statistics, photon anti-bunching, or quantum optics.</li>
          <li>Absorption, emission, or quantum detection by matter.</li>
          <li>Non-monochromatic or finite-coherence-length light sources.</li>
          <li>Diffraction effects beyond the coherent two-source idealization.</li>
          <li>
            An absolute physical intensity scale unless a radiant power and detector geometry are
            declared.
          </li>
        </ul>
      </div>

      <ShowTheCode listings={[]} />
    </section>
  );
}
