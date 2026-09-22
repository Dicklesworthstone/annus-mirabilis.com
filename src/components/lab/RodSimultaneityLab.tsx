"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { createSr03BrowserChannel } from "../../experiments/sr03/browser.ts";
import { fromSr03Draft, type Sr03Draft, toSr03Draft } from "../../experiments/sr03/controls.ts";
import {
  SR03_MODEL,
  SR03_PRESETS,
  SR03_PROMPTS,
  type Sr03Parameters,
} from "../../experiments/sr03/definition.ts";
import { decodeSr03Settings, encodeSr03Settings } from "../../experiments/sr03/permalink.ts";
import { createSr03Session, type PreparedSr03Example } from "../../experiments/sr03/session.ts";
import { ExperimentSettings } from "./ExperimentSettings.tsx";
import "./rodSimultaneityLab.css";
import { identity } from "./presentation.ts";
import {
  MinkowskiDiagramPlot,
  RodStripPlot,
  SphereEllipsoidPlot,
} from "./RodSimultaneityPlots.tsx";
import { Sci } from "./Sci.tsx";
import { ShowTheCode } from "./ShowTheCode.tsx";

export type RodSimultaneityLabProps = Readonly<{
  example: PreparedSr03Example;
  title?: string;
}>;

export function RodSimultaneityLab({
  example,
  title = "Rod measurement, simultaneity, and causal order laboratory",
}: RodSimultaneityLabProps) {
  const id = useId();
  const [session] = useState(() =>
    createSr03Session(`sr03-${id}`, example, createSr03BrowserChannel),
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
  const p = (snapshot.parameters ?? example.parameters) as unknown as Sr03Parameters;

  const [draft, setDraft] = useState<Sr03Draft>(() => toSr03Draft(example.parameters));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [linkNote, setLinkNote] = useState("");

  // Predict mode state
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, string>>({});

  useEffect(() => {
    setReady(true);
    const shared = decodeSr03Settings(window.location.search);
    if (shared.kind === "settings") {
      setDraft(toSr03Draft(shared.parameters));
      setLinkNote(
        "Shared settings are loaded. Choose Apply settings to calculate them; the worked example is still displayed.",
      );
    } else if (shared.kind === "invalid") {
      setLinkNote(shared.message);
    }
    return () => session.disconnect();
  }, [session]);

  function apply(parameters: Sr03Parameters) {
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
      apply(fromSr03Draft(draft));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check the entered settings.");
    }
  }

  function preset(parameters: Sr03Parameters) {
    setDraft(toSr03Draft(parameters));
    setError("");
    apply(parameters);
  }

  function repairToSimultaneous() {
    const updated: Sr03Parameters = {
      ...p,
      endpointPairId: "frame-simultaneous",
    };
    setDraft(toSr03Draft(updated));
    setError("");
    apply(updated);
  }

  async function share() {
    const url = new URL(window.location.pathname, window.location.origin);
    url.search = encodeSr03Settings(session.acceptedParameters());
    try {
      await navigator.clipboard.writeText(url.href);
      setLinkNote("Link to the accepted settings copied.");
    } catch {
      setLinkNote("Copy the accepted-settings link from the field below.");
    }
  }

  // Extract snapshot outputs
  const dxKOut = snapshot.outputs.find((o) => o.quantityId === "spatialSeparationK");
  const dtKOut = snapshot.outputs.find((o) => o.quantityId === "temporalSeparationK");
  const dxkOut = snapshot.outputs.find((o) => o.quantityId === "spatialSeparationKPrime");
  const dtkOut = snapshot.outputs.find((o) => o.quantityId === "temporalSeparationKPrime");
  const measOut = snapshot.outputs.find((o) => o.quantityId === "measuredLength");
  const s2Out = snapshot.outputs.find((o) => o.quantityId === "spacetimeIntervalSquared");
  const gammaOut = snapshot.outputs.find((o) => o.quantityId === "gammaFactor");
  const longAxisOut = snapshot.outputs.find((o) => o.quantityId === "ellipsoidAxisLongitudinal");
  const transYOut = snapshot.outputs.find((o) => o.quantityId === "ellipsoidAxisTransverseY");
  const transZOut = snapshot.outputs.find((o) => o.quantityId === "ellipsoidAxisTransverseZ");

  const dxK = dxKOut?.status === "value" && typeof dxKOut.value === "number" ? dxKOut.value : 0;
  const dtK = dtKOut?.status === "value" && typeof dtKOut.value === "number" ? dtKOut.value : 0;
  const dxk = dxkOut?.status === "value" && typeof dxkOut.value === "number" ? dxkOut.value : 0;
  const dtk = dtkOut?.status === "value" && typeof dtkOut.value === "number" ? dtkOut.value : 0;
  const g = gammaOut?.status === "value" && typeof gammaOut.value === "number" ? gammaOut.value : 1;
  const measuredL =
    measOut?.status === "value" && typeof measOut.value === "number" ? measOut.value : null;
  const s2 = s2Out?.status === "value" && typeof s2Out.value === "number" ? s2Out.value : 0;
  const longAxis =
    longAxisOut?.status === "value" && typeof longAxisOut.value === "number"
      ? longAxisOut.value
      : p.R / g;
  const transY =
    transYOut?.status === "value" && typeof transYOut.value === "number" ? transYOut.value : p.R;
  const transZ =
    transZOut?.status === "value" && typeof transZOut.value === "number" ? transZOut.value : p.R;

  const isNonSimultaneousRefusal =
    measOut?.status === "not-applicable" && measOut.reason.includes("simultaneous");

  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="sr-03"
      data-testid="rod-simultaneity-lab"
      data-view-id="sr-03-lab"
      {...identity(snapshot)}
      data-input-revision={view.requested?.revisions.input ?? 1}
      data-accepted-input-revision={snapshot.revisions.input}
      data-pending={String(view.pending)}
      data-execution-label="host"
      data-source-digest={example.sourceDigest}
      data-result-status={measOut?.status ?? "value"}
      {...(view.refusal ? { "data-refusal-code": view.refusal.code } : {})}
    >
      <header
        className="lab-heading"
        style={{
          borderBottom: "1px solid var(--line)",
          paddingBottom: "0.75rem",
          marginBottom: "1rem",
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
            <p className="eyebrow">SR-03 · An executable laboratory</p>
            <h2 id={`${id}-title`}>{title}</h2>
          </div>
          <span className="badge">{SR03_MODEL.label}</span>
        </div>
      </header>

      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built.
          Its plots, event tables, model assumptions and explanations remain available; changing the
          settings requires JavaScript.
        </p>
      </noscript>

      {/* Visualizations Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))",
          gap: "1.5rem",
          margin: "1.5rem 0",
        }}
      >
        <RodStripPlot
          rodRestFrame={p.rodRestFrame}
          measuringFrame={p.measuringFrame}
          v={p.v}
          L0={p.L0}
          measuredLength={measuredL}
          isSimultaneous={!isNonSimultaneousRefusal}
          dxK={dxK}
          dtK={dtK}
          dxk={dxk}
          dtk={dtk}
        />
        <MinkowskiDiagramPlot
          v={p.v}
          L0={p.L0}
          endpointPairId={p.endpointPairId}
          measuringFrame={p.measuringFrame}
          rodRestFrame={p.rodRestFrame}
          dxK={dxK}
          dtK={dtK}
          dxk={dxk}
          dtk={dtk}
        />
      </div>

      <SphereEllipsoidPlot
        radius={p.R}
        v={p.v}
        longitudinal={longAxis}
        transverseY={transY}
        transverseZ={transZ}
      />

      {/* Non-simultaneous refusal banner & repair */}
      {isNonSimultaneousRefusal && (
        <div
          className="notice error"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            margin: "1rem 0",
          }}
        >
          <div>
            <p style={{ fontWeight: "bold", margin: 0 }}>
              Refusal: Non-simultaneous Endpoint Measurement
            </p>
            <p className="fine" style={{ margin: "0.25rem 0 0" }}>
              {measOut?.reason ??
                "These endpoint events are not simultaneous in the measuring frame; choose endpoints at one time of that frame."}
            </p>
          </div>
          <button type="button" onClick={repairToSimultaneous} className="button">
            Repair to frame-simultaneous endpoints
          </button>
        </div>
      )}

      <div className="sr03-controls">
        <details className="lab-predict">
          <summary>Predict before calculating</summary>
          {(["endpoint-pair", "causal-order"] as const).map((key) => {
            const prompt = SR03_PROMPTS[key];
            if (!prompt) return null;
            const chosen = selectedCandidates[prompt.id];
            return (
              <fieldset key={prompt.id}>
                <legend>{prompt.question}</legend>
                {prompt.candidates.map((c) => (
                  <label key={c.id} className="lab-predict-candidate">
                    <input
                      type="radio"
                      name={`${id}-predict-${prompt.id}`}
                      value={c.id}
                      checked={chosen === c.id}
                      onChange={() =>
                        setSelectedCandidates((prev) => ({ ...prev, [prompt.id]: c.id }))
                      }
                    />
                    <span>
                      <strong>{c.label}.</strong> {c.description}
                    </span>
                  </label>
                ))}
                {chosen && (
                  <div className="lab-predict-reveal">
                    <p>{prompt.modelReveal}</p>
                    {/* The assumption behind each option is shown only for the one the reader
                        chose: listed under every option before a choice, it named the right one
                        ("= -6.0 s") and the wrong ones ("Wrong sign..."). */}
                    <p>
                      Your choice rests on:{" "}
                      {prompt.candidates.find((c) => c.id === chosen)?.separatingAssumption}
                    </p>
                  </div>
                )}
              </fieldset>
            );
          })}
        </details>

        <fieldset className="lab-choice">
          <legend>Try</legend>
          <div className="actions">
            {Object.entries(SR03_PRESETS).map(([key, item]) => (
              <button
                key={key}
                type="button"
                className="secondary"
                onClick={() => preset(item.parameters)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>
        <ExperimentSettings contents="speed, frames, rod length, sphere radius, event pair">
          {/* Controls Form */}
          <form
            onSubmit={submit}
            aria-label="Rod measurement and simultaneity settings"
            aria-describedby={error ? `${id}-error` : undefined}
            style={{ margin: "1.5rem 0" }}
          >
            <fieldset disabled={!ready}>
              <legend>Interactive Kinematic Controls</legend>

              <div className="input-grid">
                {/* Rod Rest Frame */}
                <div className="input-field">
                  <label htmlFor={`${id}-rest-frame`}>Rod Rest Frame</label>
                  <select
                    id={`${id}-rest-frame`}
                    value={draft.rodRestFrame}
                    onChange={(e) => {
                      const next = { ...draft, rodRestFrame: e.target.value };
                      setDraft(next);
                      try {
                        apply(fromSr03Draft(next));
                      } catch {}
                    }}
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    <option value="k">Frame k (Moving at velocity v)</option>
                    <option value="K">Frame K (Platform at rest)</option>
                  </select>
                </div>

                {/* Measuring Frame */}
                <div className="input-field">
                  <label htmlFor={`${id}-meas-frame`}>Measuring Observer Frame</label>
                  <select
                    id={`${id}-meas-frame`}
                    value={draft.measuringFrame}
                    onChange={(e) => {
                      const next = { ...draft, measuringFrame: e.target.value };
                      setDraft(next);
                      try {
                        apply(fromSr03Draft(next));
                      } catch {}
                    }}
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    <option value="K">Frame K (Platform observer)</option>
                    <option value="k">Frame k (Moving observer)</option>
                  </select>
                </div>

                {/* Frame Velocity v */}
                <div className="input-field">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <label htmlFor={`${id}-v`}>Relative Speed v (fraction of c)</label>
                    <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                      {p.v.toFixed(2)} c
                    </span>
                  </div>
                  <input
                    id={`${id}-v-range`}
                    type="range"
                    min="-0.95"
                    max="0.95"
                    step="0.05"
                    value={draft.v}
                    onChange={(e) => {
                      const next = { ...draft, v: e.target.value };
                      setDraft(next);
                      try {
                        apply(fromSr03Draft(next));
                      } catch {}
                    }}
                  />
                  <input
                    id={`${id}-v`}
                    type="number"
                    min="-0.95"
                    max="0.95"
                    step="0.01"
                    value={draft.v}
                    onChange={(e) => {
                      const next = { ...draft, v: e.target.value };
                      setDraft(next);
                      try {
                        apply(fromSr03Draft(next));
                      } catch {}
                    }}
                    style={{ fontFamily: "var(--font-mono)", width: "6rem", marginTop: "0.25rem" }}
                  />
                </div>

                {/* Proper Length L0 */}
                <div className="input-field">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <label htmlFor={`${id}-l0`}>Proper Length L₀ (light-seconds)</label>
                    <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                      {p.L0.toFixed(1)} ls
                    </span>
                  </div>
                  <input
                    id={`${id}-l0-range`}
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={draft.L0}
                    onChange={(e) => {
                      const next = { ...draft, L0: e.target.value };
                      setDraft(next);
                      try {
                        apply(fromSr03Draft(next));
                      } catch {}
                    }}
                  />
                  <input
                    id={`${id}-l0`}
                    type="number"
                    min="0.1"
                    max="1000"
                    step="0.5"
                    value={draft.L0}
                    onChange={(e) => {
                      const next = { ...draft, L0: e.target.value };
                      setDraft(next);
                      try {
                        apply(fromSr03Draft(next));
                      } catch {}
                    }}
                    style={{ fontFamily: "var(--font-mono)", width: "6rem", marginTop: "0.25rem" }}
                  />
                </div>

                {/* Sphere Radius R */}
                <div className="input-field">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <label htmlFor={`${id}-r`}>Sphere Radius R (ls)</label>
                    <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                      {p.R.toFixed(1)} ls
                    </span>
                  </div>
                  <input
                    id={`${id}-r-range`}
                    type="range"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={draft.R}
                    onChange={(e) => {
                      const next = { ...draft, R: e.target.value };
                      setDraft(next);
                      try {
                        apply(fromSr03Draft(next));
                      } catch {}
                    }}
                  />
                  <input
                    id={`${id}-r`}
                    type="number"
                    min="0.1"
                    max="100"
                    step="0.1"
                    value={draft.R}
                    onChange={(e) => {
                      const next = { ...draft, R: e.target.value };
                      setDraft(next);
                      try {
                        apply(fromSr03Draft(next));
                      } catch {}
                    }}
                    style={{ fontFamily: "var(--font-mono)", width: "6rem", marginTop: "0.25rem" }}
                  />
                </div>

                {/* Endpoint Pair Selection */}
                <div className="input-field">
                  <label htmlFor={`${id}-endpoint-pair`}>Endpoint Event Selection</label>
                  <select
                    id={`${id}-endpoint-pair`}
                    value={draft.endpointPairId}
                    onChange={(e) => {
                      const next = { ...draft, endpointPairId: e.target.value };
                      setDraft(next);
                      try {
                        apply(fromSr03Draft(next));
                      } catch {}
                    }}
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    <option value="platform-simultaneous">
                      Platform-Simultaneous (dt = 0 in K)
                    </option>
                    <option value="frame-simultaneous">
                      Frame-Simultaneous (dt = 0 in Measuring Frame)
                    </option>
                    <option value="causal-timelike">Causal Timelike (dt = 10s, dx = 5ls)</option>
                    <option value="causal-lightlike">Causal Lightlike (dt = 10s, dx = 10ls)</option>
                    <option value="causal-threshold">Causal Threshold (dt = 2s, dx = 10ls)</option>
                    <option value="custom">Custom Coordinates</option>
                  </select>
                </div>
              </div>

              {/* Custom coordinate inputs if custom */}
              {draft.endpointPairId === "custom" && (
                <div className="input-grid" style={{ marginTop: "1rem" }}>
                  <div className="input-field">
                    <label
                      htmlFor={`${id}-t1`}
                      className="fine"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      E₁ t (s)
                    </label>
                    <input
                      id={`${id}-t1`}
                      type="number"
                      value={draft.customT1 ?? "0"}
                      onChange={(e) => setDraft({ ...draft, customT1: e.target.value })}
                      style={{ fontFamily: "var(--font-mono)" }}
                    />
                  </div>
                  <div className="input-field">
                    <label
                      htmlFor={`${id}-x1`}
                      className="fine"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      E₁ x (ls)
                    </label>
                    <input
                      id={`${id}-x1`}
                      type="number"
                      value={draft.customX1 ?? "0"}
                      onChange={(e) => setDraft({ ...draft, customX1: e.target.value })}
                      style={{ fontFamily: "var(--font-mono)" }}
                    />
                  </div>
                  <div className="input-field">
                    <label
                      htmlFor={`${id}-t2`}
                      className="fine"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      E₂ t (s)
                    </label>
                    <input
                      id={`${id}-t2`}
                      type="number"
                      value={draft.customT2 ?? "0"}
                      onChange={(e) => setDraft({ ...draft, customT2: e.target.value })}
                      style={{ fontFamily: "var(--font-mono)" }}
                    />
                  </div>
                  <div className="input-field">
                    <label
                      htmlFor={`${id}-x2`}
                      className="fine"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      E₂ x (ls)
                    </label>
                    <input
                      id={`${id}-x2`}
                      type="number"
                      value={draft.customX2 ?? "10"}
                      onChange={(e) => setDraft({ ...draft, customX2: e.target.value })}
                      style={{ fontFamily: "var(--font-mono)" }}
                    />
                  </div>
                </div>
              )}

              {error && (
                <p id={`${id}-error`} className="notice error">
                  {error}
                </p>
              )}

              <div className="button-group" style={{ marginTop: "1rem" }}>
                <button type="submit" className="button">
                  Apply settings
                </button>
                <button type="button" onClick={share} className="button secondary">
                  Copy settings link
                </button>
              </div>
              {linkNote && (
                <p className="notice" style={{ marginTop: "0.5rem" }}>
                  {linkNote}
                </p>
              )}
            </fieldset>
          </form>
        </ExperimentSettings>
      </div>

      <p className="sr03-context">
        In §2 of <em>Zur Elektrodynamik bewegter Körper</em> (1905) Einstein shows that two events
        simultaneous for one frame are not simultaneous for another in relative motion. In §4 he
        gives the physical meaning of a moving rod&apos;s length: the positions of its two ends,
        taken at <strong>one instant of the measuring frame</strong>. A sphere of radius R is
        measured the same way, along the motion and across it.
      </p>

      {/* Spacetime event interval ledger */}
      <div className="notice" style={{ margin: "1.5rem 0" }}>
        <h3 style={{ marginTop: 0 }}>Spacetime event coordinates and invariant interval</h3>
        <section
          className="table-scroll"
          tabIndex={0}
          aria-label="Spacetime event coordinates and invariant interval table"
        >
          <table style={{ width: "100%", textAlign: "left", fontFamily: "var(--font-mono)" }}>
            <thead>
              <tr>
                <th scope="col">Frame</th>
                <th scope="col">Δt (s)</th>
                <th scope="col">Δx (ls)</th>
                <th scope="col">Simultaneity</th>
                <th scope="col">s² = Δx² - c²Δt² (ls²)</th>
                <th scope="col">Causal Order</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">K (Platform)</th>
                <td>{dtK.toFixed(3)}</td>
                <td>{dxK.toFixed(3)}</td>
                <td>
                  <span className="badge">
                    {dtK === 0 ? "Simultaneous" : dtK > 0 ? "Ordered (+)" : "Ordered (-)"}
                  </span>
                </td>
                <td style={{ fontWeight: "bold" }}>{s2.toFixed(3)}</td>
                <td>
                  <span className="badge">
                    {s2 > 0 ? "Spacelike" : s2 === 0 ? "Lightlike" : "Timelike"}
                  </span>
                </td>
              </tr>
              <tr>
                <th scope="row">k (Moving)</th>
                <td>{dtk.toFixed(3)}</td>
                <td>{dxk.toFixed(3)}</td>
                <td>
                  <span className="badge">
                    {Math.abs(dtk) < 1e-10
                      ? "Simultaneous"
                      : dtk > 0
                        ? "Ordered (+)"
                        : "Ordered (-)"}
                  </span>
                </td>
                <td style={{ fontWeight: "bold" }}>{s2.toFixed(3)}</td>
                <td>
                  <span className="badge">
                    {s2 > 0 ? "Spacelike" : s2 === 0 ? "Lightlike" : "Timelike"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      {/* Accepted results telemetry table */}
      <div className="notice" data-view-id="sr-03-data-table" style={{ margin: "1.5rem 0" }}>
        <h3 style={{ marginTop: 0 }}>Accepted laboratory telemetry snapshot</h3>
        <section
          className="table-scroll"
          tabIndex={0}
          aria-label="Accepted laboratory telemetry snapshot table"
        >
          <table style={{ width: "100%", textAlign: "left", fontFamily: "var(--font-mono)" }}>
            <thead>
              <tr>
                <th scope="col">Quantity ID</th>
                <th scope="col">Status</th>
                <th scope="col">Value / Result</th>
                <th scope="col">Unit</th>
                <th scope="col">Owner ID</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.outputs.map((out) => (
                <tr key={out.quantityId} data-quantity-id={out.quantityId}>
                  <th scope="row" style={{ fontFamily: "var(--font-mono)" }}>
                    {out.quantityId}
                  </th>
                  <td>
                    <span className="badge">{out.status}</span>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>
                    {out.status === "value" ? (
                      typeof out.value === "number" ? (
                        Math.abs(out.value) > 1e4 ||
                        (Math.abs(out.value) < 1e-3 && out.value !== 0) ? (
                          <Sci value={out.value} digits={4} />
                        ) : (
                          out.value.toFixed(4)
                        )
                      ) : (
                        String(out.value)
                      )
                    ) : "reason" in out ? (
                      String(out.reason)
                    ) : (
                      "Out of domain"
                    )}
                  </td>
                  <td className="fine">{out.unit}</td>
                  <td className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                    {out.ownerId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {/* Epistemic limits (not modeled) */}
      <div className="notice" style={{ margin: "1.5rem 0" }}>
        <h3 style={{ marginTop: 0 }}>Limits of this kinematic reference model (not modeled)</h3>
        <p className="fine" style={{ marginBottom: "0.5rem" }}>
          This reference owner implements exact special-relativistic coordinate transformations,
          coordinate length measurements, and invariant spacetime intervals between inertial
          reference frames. The following physical regimes require general relativity, dynamical
          stress mechanics, or optical ray tracing and are explicitly <strong>not modeled</strong>:
        </p>
        <ul className="fine">
          <li>
            Optical camera image appearance (Terrell-Penrose rotation and light-travel-time
            distortion), which differs from coordinate measurement at a single instant.
          </li>
          <li>Accelerating reference frames, Rindler horizons, or Thomas precession.</li>
          <li>
            Internal stress, elasticity, Born rigidity breakdown, or relativistic wave propagation
            during rod acceleration.
          </li>
          <li>Gravitational time dilation or spacetime curvature (General Relativity).</li>
          <li>Quantum uncertainty or field fluctuations at Planck-scale event intervals.</li>
          <li>Superluminal observers (|v| &ge; c) or tachyonic coordinate frames.</li>
        </ul>
      </div>

      <ShowTheCode listings={[]} />
    </section>
  );
}
