"use client";
import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { createBm04BrowserChannel } from "../../experiments/bm04/browser.ts";
import { BM04_FIELDS, fromBm04Draft, toBm04Draft } from "../../experiments/bm04/controls.ts";
import { bm04DataCsv } from "../../experiments/bm04/dataExport.ts";
import {
  BM04_CAPTION,
  BM04_OUTPUTS,
  BM04_PRESETS,
  BM04_PROMPT,
  type Bm04Parameters,
} from "../../experiments/bm04/definition.ts";
import { decodeBm04Settings, encodeBm04Settings } from "../../experiments/bm04/permalink.ts";
import { createBm04Session, type PreparedBm04Example } from "../../experiments/bm04/session.ts";
import { ExecutionChrome } from "../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../experiments/labels/executionLabelFor.ts";
import { labelRootAttributes } from "../../experiments/labels/resultAttributes.ts";
import { deriveHostExecution } from "../../experiments/provenance/executionState.ts";
import {
  DensityProfilePlot,
  FluxBalancePlot,
  ForceCancellationPanel,
} from "./DriftDiffusionPlots.tsx";
import { ExperimentSettings } from "./ExperimentSettings.tsx";
import { array, display, identity, result, scalar } from "./presentation.ts";
import { ShowTheCode } from "./ShowTheCode.tsx";
import { withScripts } from "./subscripts.tsx";

type ForceComparison = Readonly<{
  parameters: Bm04Parameters;
  diffusion: number;
  drift: number;
  identity: ReturnType<typeof identity>;
}>;

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
  const [comparison, setComparison] = useState<ForceComparison | null>(null);
  const [exportNote, setExportNote] = useState("");

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
    setExportNote("");
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

  function compareForce() {
    setComparison({
      parameters: { ...p },
      diffusion: scalar(snapshot, "diffusionCoefficient"),
      drift: scalar(snapshot, "driftVelocity"),
      identity: identity(snapshot),
    });
    const next = { ...p, F: p.F * 2 };
    setDraft(toBm04Draft(next));
    setDirty(true);
    // Submit the accepted SI parameters directly: a display-unit round trip must
    // not change temperature, radius or viscosity in a one-variable comparison.
    apply(next);
  }

  function downloadData() {
    let url: string | undefined;
    try {
      const csv = bm04DataCsv(snapshot, example.sourceDigest);
      url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "bm-04-accepted-data.csv";
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
      }
      setExportNote(
        "CSV prepared from the displayed accepted run, including every cell, its parameters and provenance.",
      );
    } catch (e) {
      setExportNote(e instanceof Error ? e.message : "The accepted data could not be exported.");
    } finally {
      if (url) {
        const objectUrl = url;
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
    }
  }

  const primaryResult = result(snapshot, "densityProfile");
  const diffCoeff = scalar(snapshot, "diffusionCoefficient");
  const steadyState = scalar(snapshot, "steadyState");
  const drift = scalar(snapshot, "driftVelocity");
  const selectedPrediction = BM04_PROMPT.candidates.find(
    (candidate) => candidate.id === prediction,
  );
  const isComparison =
    comparison !== null &&
    (Object.keys(comparison.parameters) as (keyof Bm04Parameters)[]).every((key) =>
      key === "F" ? p.F === comparison.parameters.F * 2 : p[key] === comparison.parameters[key],
    );

  const problem = view.status === "refused" || view.status === "unavailable";
  const announcement = view.pending
    ? "Calculating the requested drift-diffusion balance. The last accepted result stays on screen until it is done."
    : view.status === "refused"
      ? `${view.refusal?.message ?? "Calculation refused."} The last accepted result is unchanged.`
      : view.status === "unavailable"
        ? `${view.outcome?.message ?? "Calculation unavailable."} The worked result remains readable.`
        : `Accepted result: Drift-diffusion balance steady state ${steadyState === 1 ? "reached" : "transient"}; diffusivity ${display(diffCoeff, 1e12)} μm²/s.`;

  const densityArray = array(snapshot, "densityProfile");
  const osmoticArray = array(snapshot, "osmoticProfile");
  const cells = p.cells;
  const dx = (p.W * 1e6) / cells;

  // Earned per snapshot (am-inst-execution-labels-5ywv): the build-time example is a static worked
  // example, an accepted recalculation a host calculation.
  const executionKind = executionStateKindFromHostLabel(
    deriveHostExecution(
      view,
      BM04_OUTPUTS,
      example.sourceDigest,
      snapshot === session.getServerSnapshot().accepted,
    ).label,
  );
  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="bm-04"
      {...identity(snapshot)}
      data-input-revision={view.requested?.revisions.input ?? 1}
      data-accepted-input-revision={snapshot.revisions.input}
      data-pending={String(view.pending)}
      {...labelRootAttributes(executionKind, view, "densityProfile")}
      data-source-digest={example.sourceDigest}
      data-result-status={primaryResult.status}
      {...(view.refusal ? { "data-refusal-code": view.refusal.code } : {})}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">An executable model</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
      </header>
      <div className="lab-status-row">
        <ExecutionChrome state={executionKind} view={view} />
      </div>

      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built.
          Its graph, values, model assumptions and explanations remain available; changing the
          settings requires JavaScript.
        </p>
      </noscript>

      <details className="lab-predict bm04-predict">
        <summary>Predict before calculating</summary>
        <section className="predict-mode-box" aria-label="Predict before calculating">
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
          <details>
            <summary>Show the explanation and test the prediction</summary>
            {selectedPrediction && (
              <p>
                Your prediction: <strong>{selectedPrediction.label}</strong>.
              </p>
            )}
            <p>
              At fixed temperature, viscosity and particle radius, the thermal diffusion coefficient
              stays unchanged. A stronger force changes directed drift, not the thermal diffusivity.
              The equilibrium length becomes shorter, but that is not a smaller diffusion
              coefficient.
            </p>
            <p>
              The accepted run has thermal D = {display(diffCoeff, 1e12)} μm²/s and drift velocity{" "}
              {display(drift, 1e6)} μm/s. With mismatched kicks, the chosen kick strength is a
              separate model assumption; a transient profile is not an equilibrium measurement.
            </p>
            <button
              type="button"
              className="secondary"
              onClick={compareForce}
              disabled={!ready || view.pending || p.F === 0 || !Number.isFinite(p.F * 2)}
            >
              Calculate with twice the accepted force
            </button>
            {p.F === 0 && (
              <p>First apply a nonzero force: doubling zero does not create a comparison.</p>
            )}
            {comparison && (
              <div
                {...identity(snapshot)}
                data-baseline-run-id={comparison.identity["data-run-id"]}
              >
                {isComparison ? (
                  <div className="table-wrapper">
                    <table className="data-table">
                      <caption>Two accepted runs; only the applied force changed</caption>
                      <thead>
                        <tr>
                          <th scope="col">Quantity</th>
                          <th scope="col">Baseline</th>
                          <th scope="col">Double force</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <th scope="row">Force (fN)</th>
                          <td>{display(comparison.parameters.F, 1e15)}</td>
                          <td>{display(p.F, 1e15)}</td>
                        </tr>
                        <tr>
                          <th scope="row">Thermal D (μm²/s)</th>
                          <td>{display(comparison.diffusion, 1e12)}</td>
                          <td>{display(diffCoeff, 1e12)}</td>
                        </tr>
                        <tr>
                          <th scope="row">Drift velocity (μm/s)</th>
                          <td>{display(comparison.drift, 1e6)}</td>
                          <td>{display(drift, 1e6)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>
                    The comparison appears when the doubled-force run is accepted. A refusal keeps
                    the baseline unchanged; changing another parameter invalidates this comparison.
                  </p>
                )}
              </div>
            )}
            <p>
              The explanation is available with or without a prediction. These are model
              consequences, not experimental proof.
            </p>
          </details>
        </section>
      </details>

      <div className="lab-columns">
        <form
          onSubmit={submit}
          aria-label="Drift-diffusion laboratory settings"
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <fieldset disabled={!ready}>
            <legend>Set up the experiment</legend>
            <p className="fine">
              In §3 Einstein calculates how fast particles diffuse by setting a directional drag
              force against their random spreading. Compare the fluxes, change the force, or turn
              the kicks off to test Nägeli’s hypothesis.
            </p>
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
            <ExperimentSettings contents="force, kick strength, temperature, viscosity, radius, box, grid, time step, initial profile">
              <div className="input-grid">
                {BM04_FIELDS.map((field) => (
                  <div className="input-field" key={field.key}>
                    <label htmlFor={`${id}-${field.key}`}>
                      {field.label} {field.unit ? <span>({field.unit})</span> : null}
                    </label>
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
                  </div>
                ))}
                <div className="input-field">
                  <label htmlFor={`${id}-profile`}>Initial profile</label>
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
                    <option value="spike">Point source at the centre</option>
                  </select>
                </div>
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
            </ExperimentSettings>
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
          {/* A refusal is read before the plots it leaves unchanged; an accepted result is
              summarised after the plots it describes. */}
          {problem ? (
            <p role="status" className="notice">
              {announcement}
            </p>
          ) : null}
          <DensityProfilePlot snapshot={snapshot} widthMicrons={p.W * 1e6} />
          <FluxBalancePlot snapshot={snapshot} />
          {problem ? null : (
            <p role="status" className="notice">
              {announcement}
            </p>
          )}
          <ForceCancellationPanel
            snapshot={snapshot}
            forceFemtonewtons={p.F * 1e15}
            kickMultiplier={p.m}
          />
        </div>
      </div>

      <section
        className="lab-table-section"
        aria-label="Accepted concentration data"
        {...identity(snapshot)}
      >
        <h3>Inspect and export the accepted dataset</h3>
        <p>
          All {cells} cells are available below (cell width Δx = {display(dx, 1)} μm). The numerical
          profile is a normalized coordinate probability density; its cell masses sum to one. The
          osmotic reference is evaluated at cell centers.
        </p>
        {(dirty || view.pending) && (
          <p className="notice">
            The table and export use the displayed accepted result, not unapplied or pending
            settings.
          </p>
        )}
        <button type="button" className="secondary" disabled={!ready} onClick={downloadData}>
          Download accepted data (CSV)
        </button>
        {exportNote && (
          <p role="status" className="form-note">
            {exportNote}
          </p>
        )}
        <details>
          <summary>Full cell dataset ({cells} rows)</summary>
          <div className="table-wrapper">
            <table className="data-table">
              <caption>
                Accepted numerical density and thermodynamic reference, including every spatial cell
              </caption>
              <thead>
                <tr>
                  <th scope="col">Cell</th>
                  <th scope="col">Position x (μm)</th>
                  <th scope="col">Numerical density (m⁻¹)</th>
                  <th scope="col">Osmotic density (m⁻¹)</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: cells }, (_, i) => {
                  const x = (i + 0.5) * dx;
                  return (
                    <tr key={x}>
                      <td>{i + 1}</td>
                      <td>{display(x, 1)}</td>
                      <td>{display(densityArray.at(i), 1)}</td>
                      <td>{display(osmoticArray.at(i), 1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <ShowTheCode listings={[]} />
      {/* The four readings follow the reader's detail setting, as on every other laboratory: direct
          children of the lab root, which labShell.css's detail rules select. */}
      <p data-detail="0">{withScripts(BM04_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(BM04_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(BM04_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(BM04_CAPTION.r3)}
      </p>
    </section>
  );
}
