"use client";
import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { createBm04BrowserChannel } from "../../experiments/bm04/browser.ts";
import { BM04_FIELDS, fromBm04Draft, toBm04Draft } from "../../experiments/bm04/controls.ts";
import {
  BM04_MODEL,
  BM04_PRESETS,
  BM04_PROMPT,
  type Bm04Parameters,
} from "../../experiments/bm04/definition.ts";
import { decodeBm04Settings, encodeBm04Settings } from "../../experiments/bm04/permalink.ts";
import { createBm04Session, type PreparedBm04Example } from "../../experiments/bm04/session.ts";
import {
  DensityProfilePlot,
  FluxBalancePlot,
  ForceCancellationPanel,
} from "./DriftDiffusionPlots.tsx";
import { array, display, identity, result, scalar } from "./presentation.ts";
import { ShowTheCode } from "./ShowTheCode.tsx";

export function DriftDiffusionLab({
  example,
  title = "The drift-diffusion balance laboratory",
}: {
  example: PreparedBm04Example;
  title?: string;
}) {
  const id = useId();
  const [session] = useState(() =>
    createBm04Session(`bm04-${id}`, example, createBm04BrowserChannel),
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
  const p = snapshot.parameters as unknown as Bm04Parameters;

  const [draft, setDraft] = useState(() => toBm04Draft(example.parameters));
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [linkNote, setLinkNote] = useState("");
  const [sharedUrl, setSharedUrl] = useState("");
  const [prediction, setPrediction] = useState("");

  useEffect(() => {
    setReady(true);
    const shared = decodeBm04Settings(window.location.search);
    if (shared.kind === "settings") {
      setDraft(toBm04Draft(shared.parameters));
      setDirty(true);
      setLinkNote(
        "Shared settings are loaded. Choose Apply settings to calculate them; the worked example is still displayed.",
      );
    } else if (shared.kind === "invalid") {
      setLinkNote(shared.message);
    }
    return () => session.disconnect();
  }, [session]);

  function apply(parameters: Bm04Parameters) {
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
    setDirty(false);
    setLinkNote("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      apply(fromBm04Draft(draft));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check the entered settings.");
    }
  }

  function preset(parameters: Bm04Parameters) {
    setDraft(toBm04Draft(parameters));
    setDirty(true);
    setError("");
  }

  async function share() {
    const url = new URL(window.location.pathname, window.location.origin);
    url.search = encodeBm04Settings(session.acceptedParameters());
    setSharedUrl(url.href);
    try {
      await navigator.clipboard.writeText(url.href);
      setLinkNote("Link to the accepted settings copied.");
    } catch {
      setLinkNote("Copy the accepted-settings link from the field below.");
    }
  }

  const primaryResult = result(snapshot, "densityProfile");
  const diffCoeff = scalar(snapshot, "diffusionCoefficient");
  const steadyState = scalar(snapshot, "steadyState");

  const announcement = view.pending
    ? "Calculating the requested drift-diffusion balance. The last accepted result remains below."
    : view.status === "refused"
      ? `${view.refusal?.message ?? "Calculation refused."} The last accepted result is unchanged.`
      : view.status === "unavailable"
        ? `${view.outcome?.message ?? "Calculation unavailable."} The worked result remains readable.`
        : `Accepted result: Drift-diffusion balance steady state ${steadyState === 1 ? "reached" : "transient"}; diffusivity ${display(diffCoeff, 1e12)} μm²/s.`;

  const densityArray = array(snapshot, "densityProfile");
  const osmoticArray = array(snapshot, "osmoticProfile");
  const cells = p.cells;
  const dx = (p.W * 1e6) / cells;

  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="bm-04"
      {...identity(snapshot)}
      data-input-revision={view.requested?.revisions.input ?? 1}
      data-accepted-input-revision={snapshot.revisions.input}
      data-pending={String(view.pending)}
      data-execution-label="host"
      data-source-digest={example.sourceDigest}
      data-result-status={primaryResult.status}
      {...(view.refusal ? { "data-refusal-code": view.refusal.code } : {})}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">BM-04 · An executable model</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <span className="badge">{BM04_MODEL.label}</span>
      </header>

      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built.
          Its graph, values, model assumptions and explanations remain available; changing the
          settings requires JavaScript.
        </p>
      </noscript>

      <p>
        In §3 of the Brownian paper, Einstein calculates how fast particles diffuse by pitting a
        directional drag force against Brownian random spreading. Explore the flux balance, test
        whether force drops out of the quotient, or turn kicks off to inspect Nägeli’s hypothesis.
      </p>

      {/* Predict Mode Prompt */}
      <section className="predict-mode-box" aria-label="Predict before calculating">
        <h3>Predict before calculating</h3>
        <p className="predict-question">{BM04_PROMPT.question}</p>
        <div className="predict-options">
          {BM04_PROMPT.candidates.map((c) => (
            <label key={c.id} className="predict-option">
              <input
                type="radio"
                name={`${id}-predict`}
                value={c.id}
                checked={prediction === c.id}
                onChange={() => setPrediction(c.id)}
              />
              <span className="predict-label">
                <strong>{c.label}</strong>: {c.description}
              </span>
            </label>
          ))}
        </div>
      </section>

      <div className="lab-columns">
        <form
          onSubmit={submit}
          aria-label="Drift-diffusion laboratory settings"
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <fieldset disabled={!ready}>
            <legend>Set up the experiment</legend>

            <div className="preset-list">
              {Object.entries(BM04_PRESETS).map(([key, item]) => (
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

            <div className="input-grid">
              {BM04_FIELDS.map((field) => (
                <label key={field.key} htmlFor={`${id}-${field.key}`}>
                  {field.label} {field.unit ? <span>({field.unit})</span> : null}
                  <input
                    id={`${id}-${field.key}`}
                    name={field.key}
                    type="text"
                    inputMode="decimal"
                    value={draft[field.key]}
                    onChange={(event) => {
                      setDraft({ ...draft, [field.key]: event.target.value });
                      setDirty(true);
                    }}
                  />
                </label>
              ))}

              <label htmlFor={`${id}-profile`}>
                Initial profile
                <select
                  id={`${id}-profile`}
                  name="profile"
                  value={draft.profile}
                  onChange={(event) => {
                    setDraft({
                      ...draft,
                      profile: event.target.value as Bm04Parameters["profile"],
                    });
                    setDirty(true);
                  }}
                >
                  <option value="uniform">Uniform distribution</option>
                  <option value="step">Step concentration</option>
                  <option value="equilibrium">Osmotic equilibrium</option>
                  <option value="spike">Delta spike at center</option>
                </select>
              </label>
            </div>

            <div className="button-row">
              <button type="submit" disabled={!dirty && !error}>
                Apply settings
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setDraft(toBm04Draft(example.parameters));
                  setDirty(true);
                  setError("");
                }}
              >
                Reset to defaults
              </button>
              <button type="button" className="secondary" onClick={share}>
                Share settings
              </button>
            </div>

            {error && (
              <p id={`${id}-error`} className="form-error" role="alert">
                {error}
              </p>
            )}
            {linkNote && <p className="form-note">{linkNote}</p>}
            {sharedUrl && (
              <input
                type="text"
                readOnly
                value={sharedUrl}
                aria-label="Shareable settings link"
                onFocus={(e) => e.target.select()}
              />
            )}
          </fieldset>
        </form>

        <div className="lab-results">
          <div aria-live="polite" className="sr-only">
            {announcement}
          </div>

          <DensityProfilePlot snapshot={snapshot} widthMicrons={p.W * 1e6} />
          <FluxBalancePlot snapshot={snapshot} />
          <ForceCancellationPanel
            snapshot={snapshot}
            forceFemtonewtons={p.F * 1e15}
            kickMultiplier={p.m}
          />
        </div>
      </div>

      {/* Accessible Data Table */}
      <section className="lab-table-section" aria-label="Tabular concentration and flux data">
        <h3>Discretized Channel Profile Table</h3>
        <p>
          Discrete cell averages across the {p.cells} spatial cells (cell width Δx ={" "}
          {display(dx, 1)} μm).
        </p>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Cell #</th>
                <th scope="col">Position x (μm)</th>
                <th scope="col">Numerical Density n (m⁻¹)</th>
                <th scope="col">Osmotic Density n_osm (m⁻¹)</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.min(10, cells) }, (_, i) => {
                const x = (i + 0.5) * dx;
                const cellKey = `pos-${(x * 100).toFixed(0)}`;
                return (
                  <tr key={cellKey}>
                    <td>{i + 1}</td>
                    <td>{display(x, 1)}</td>
                    <td>{display(densityArray.at(i), 1)}</td>
                    <td>{display(osmoticArray.at(i), 1)}</td>
                  </tr>
                );
              })}
              {cells > 10 && (
                <tr>
                  <td colSpan={4} className="table-ellipsis">
                    ... ({cells - 10} additional interior cells evaluated in worker) ...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ShowTheCode listings={[]} />
    </section>
  );
}
