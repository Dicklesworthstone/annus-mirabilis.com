"use client";
import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { getKernelListingsForInstrument } from "../../content/kernel/listings.ts";
import { EquationScope } from "../../equations/EquationScope.tsx";
import { SemanticEquation } from "../../equations/SemanticEquation.tsx";
import type { CompiledEquation } from "../../equations/viewTypes.ts";
import { createBm01BrowserChannel } from "../../experiments/bm01/browser.ts";
import { BM01_FIELDS, fromTracerDraft, toTracerDraft } from "../../experiments/bm01/controls.ts";
import { BM01_OUTPUTS, type Bm01Parameters } from "../../experiments/bm01/definition.ts";
import { decodeBm01Settings, encodeBm01Settings } from "../../experiments/bm01/permalink.ts";
import { createBm01Session, type PreparedBm01Example } from "../../experiments/bm01/session.ts";
import { ExecutionChrome } from "../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../experiments/labels/executionLabelFor.ts";
import { modelNoteFromView } from "../../experiments/labels/modelNoteData.ts";
import { labelRootAttributes } from "../../experiments/labels/resultAttributes.ts";
import { deriveHostExecution } from "../../experiments/provenance/executionState.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import equationPayload from "../../generated/brownian-equations.json";
import { TimeLegend } from "../../visuals/kit/TimeLegend.tsx";
import { array, display, identity, result, scalar } from "./presentation.ts";
import { ShowTheCode } from "./ShowTheCode.tsx";
import { PLOT_KINDS, TracerHistogram, TracerPaths, TracerScaling } from "./TracerPlots.tsx";

function SamplingBand({
  snapshot,
  id,
  factor,
}: {
  snapshot: AcceptedSnapshot;
  id: string;
  factor: number;
}) {
  const band = result(snapshot, id);
  if (band.status === "value") {
    const limits = array(snapshot, id);
    return (
      <>
        {display(limits.at(0), factor)} to {display(limits.at(1), factor)}
      </>
    );
  }
  return (
    <>
      {band.status === "underdetermined"
        ? "Use more than one tracer for a sampling comparison."
        : band.status === "analytic-limit"
          ? "At the starting point, the spread is zero."
          : "No sampling band is available."}
    </>
  );
}
export function TracerLab({
  example,
  title = "The tracer ensemble",
}: {
  example: PreparedBm01Example;
  title?: string;
}) {
  const id = useId();
  const [session] = useState(() =>
    createBm01Session(`bm01-${id}`, example, createBm01BrowserChannel),
  );
  const serverAccepted = session.getServerSnapshot().accepted;
  if (!serverAccepted) {
    throw new Error("Missing accepted tracer snapshot");
  }
  const view = useSyncExternalStore(
      session.subscribe,
      session.getSnapshot,
      session.getServerSnapshot,
    ),
    snapshot = view.accepted ?? serverAccepted,
    p = snapshot.parameters as Bm01Parameters;
  const [draft, setDraft] = useState(() => toTracerDraft(example.parameters)),
    [ready, setReady] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [url, setUrl] = useState(""),
    [zoom, setZoom] = useState(1),
    [prediction, setPrediction] = useState("");
  useEffect(() => {
    setReady(true);
    const shared = decodeBm01Settings(window.location.search);
    if (shared.kind === "settings") {
      setDraft(toTracerDraft(shared.parameters));
      setDirty(true);
      setNote(
        "Shared settings are loaded as a draft. The worked example remains displayed until you apply them.",
      );
    } else if (shared.kind === "invalid") setNote(shared.message);
    return () => session.disconnect();
  }, [session]);
  function apply(settings: Bm01Parameters) {
    const r = session.apply(settings);
    if (r.kind !== "accepted") {
      setError(
        r.kind === "refused"
          ? typeof r.refusal.details?.requirements === "string"
            ? r.refusal.details.requirements
            : r.refusal.message
          : r.outcome.message,
      );
      return;
    }
    setDraft(toTracerDraft(settings));
    setDirty(false);
    setError("");
    setNote("");
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      apply(fromTracerDraft(draft));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check the settings.");
    }
  }
  function newTrial() {
    try {
      const words = crypto.getRandomValues(new Uint32Array(2));
      const w0 = words[0];
      const w1 = words[1];
      if (w0 !== undefined && w1 !== undefined) {
        apply({ ...p, seed: ((BigInt(w0) << 32n) | BigInt(w1)).toString() });
      }
    } catch {
      setError(
        "A new random seed is unavailable on this device. Enter a different seed explicitly.",
      );
    }
  }
  async function share() {
    const link = new URL("/lab/bm-01/", window.location.origin);
    link.search = encodeBm01Settings(session.acceptedParameters());
    setUrl(link.href);
    try {
      await navigator.clipboard.writeText(link.href);
      setNote("The accepted trial settings were copied.");
    } catch {
      setNote("Copy the accepted trial link from the field below.");
    }
  }
  const announcement = view.pending
    ? "Recording or remeasuring the requested trial. The accepted result remains below."
    : view.status === "refused"
      ? `${view.refusal?.message ?? "Trial refused."} The accepted trial is unchanged.`
      : view.status === "unavailable"
        ? `${view.outcome?.message ?? "Calculation unavailable."} The accepted example remains readable.`
        : view.status === "paused"
          ? "Calculation stopped. The accepted trial is unchanged."
          : `Accepted synthetic trial: ${p.M} tracers, ${display(p.interval)} seconds, coordinate mean ${display(scalar(snapshot, "sampleMean"), 1e6)} micrometres and coordinate RMS ${display(scalar(snapshot, "sampleRms"), 1e6)} micrometres.`;
  const edges = array(snapshot, "histogramEdges"),
    counts = array(snapshot, "histogramCounts");
  const execution = deriveHostExecution(
    view,
    BM01_OUTPUTS,
    example.sourceDigest,
    snapshot === session.getServerSnapshot().accepted,
  );
  const executionKind = executionStateKindFromHostLabel(execution.label);
  const editQuantity = (quantityId: string) => {
    const name = (
      {
        temperature: "T",
        viscosity: "eta",
        particleRadius: "a",
        observationInterval: "interval",
      } as Record<string, string>
    )[quantityId];
    if (name) document.getElementById(`${id}-${name}`)?.focus();
  };
  return (
    <EquationScope
      slots={[{ slot: "primary", experimentId: "bm-01", view, execution }]}
      editQuantity={editQuantity}
    >
      <section
        className="laboratory"
        aria-labelledby={`${id}-title`}
        data-instrument-id="bm-01"
        {...identity(snapshot)}
        data-input-revision={view.requested?.revisions.input ?? snapshot.revisions.input}
        data-accepted-input-revision={snapshot.revisions.input}
        data-pending={String(view.pending)}
        {...labelRootAttributes(executionKind, view, "tracerPositions")}
        data-recording-draws={scalar(snapshot, "recordingDraws")}
        data-recording-reused={scalar(snapshot, "reusedRecording")}
      >
        <header className="lab-heading">
          <div>
            <p className="eyebrow">BM-01 · A reproducible trial</p>
            <h2 id={`${id}-title`}>{title}</h2>
          </div>
          <ExecutionChrome
            state={executionKind}
            view={view}
            modelNote={modelNoteFromView(view, {
              notModeled: "Molecular collisions (no collision bath owns the displacement).",
              showTheCodeHref: `#stc-${id}`,
            })}
          />
        </header>
        <noscript>
          <p className="notice">
            JavaScript is off. The traces, histogram, tables and explanations below are a seeded
            worked example computed when this edition was built. Changing the settings requires
            JavaScript.
          </p>
        </noscript>
        <p>
          Compare the movement of individual tracers with the statistics of the whole ensemble.
          Changing when or how you observe the trial does not generate different paths.
        </p>
        <div className="lab-columns">
          <div>
            <form onSubmit={submit} noValidate>
              <fieldset disabled={!ready}>
                <legend>Record and observe</legend>
                <div className="input-grid">
                  {BM01_FIELDS.map(([key, label, unit]) => (
                    <div className="input-field" key={key}>
                      <label htmlFor={`${id}-${key}`}>
                        {label} <span>({unit})</span>
                      </label>
                      <input
                        id={`${id}-${key}`}
                        name={key}
                        inputMode="decimal"
                        type="text"
                        value={draft[key]}
                        onChange={(e) => {
                          setDraft({ ...draft, [key]: e.target.value });
                          setDirty(true);
                        }}
                      />
                    </div>
                  ))}
                  <div className="input-field">
                    <label htmlFor={`${id}-seed`}>Trial seed (unsigned 64-bit integer)</label>
                    <input
                      id={`${id}-seed`}
                      name="seed"
                      type="text"
                      inputMode="numeric"
                      value={draft.seed}
                      onChange={(e) => {
                        setDraft({ ...draft, seed: e.target.value });
                        setDirty(true);
                      }}
                    />
                  </div>
                  <div className="input-field">
                    <label htmlFor={`${id}-axis`}>Signed coordinate</label>
                    <select
                      id={`${id}-axis`}
                      name="axis"
                      value={draft.axis}
                      onChange={(e) => {
                        setDraft({ ...draft, axis: e.target.value });
                        setDirty(true);
                      }}
                    >
                      <option value="0">x</option>
                      <option value="1">y</option>
                      <option value="2">z</option>
                    </select>
                  </div>
                  <div className="input-field">
                    <label htmlFor={`${id}-d`}>Coordinates in the total distance</label>
                    <select
                      id={`${id}-d`}
                      name="d"
                      value={draft.d}
                      onChange={(e) => {
                        setDraft({ ...draft, d: e.target.value });
                        setDirty(true);
                      }}
                    >
                      <option value="1">One: x</option>
                      <option value="2">Two: x and y</option>
                      <option value="3">Three: x, y and z</option>
                    </select>
                  </div>
                  <div className="input-field">
                    <label htmlFor={`${id}-statistic`}>Statistic to compare over time</label>
                    <select
                      id={`${id}-statistic`}
                      name="statistic"
                      value={draft.statistic}
                      onChange={(e) => {
                        setDraft({ ...draft, statistic: e.target.value });
                        setDirty(true);
                      }}
                    >
                      {Object.entries(PLOT_KINDS).map(([key, kind]) => (
                        <option key={key} value={key}>
                          {kind.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="fine">
                  The preview records at most 8 MiB of latent paths. Its default is 400 tracers for
                  10 seconds at 0.02-second resolution. Larger requests are refused, never silently
                  reduced.
                </p>
                <div className="actions">
                  <button type="submit">Apply trial settings</button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => session.stop()}
                    disabled={!view.pending}
                  >
                    Stop calculation
                  </button>
                </div>
              </fieldset>
            </form>
            {dirty && (
              <p className="draft-note">
                These edits are a draft. Graphs and numbers still describe the accepted trial below.
              </p>
            )}
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <div className="actions">
              <button type="button" className="secondary" disabled={!ready} onClick={newTrial}>
                New independent trial
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!ready}
                onClick={() => apply({ ...p, eta: p.eta * 2 })}
              >
                Double viscosity, same seed
              </button>
            </div>
            <p className="fine">
              Same-seed viscosity comparisons use common random numbers, not independent trials.
            </p>
            <details>
              <summary>Predict before comparing observation times</summary>
              <div className="input-field">
                <label className="fine" htmlFor={`${id}-predict`}>
                  Watching four times as long: how does the typical distance change?
                </label>
                <select
                  id={`${id}-predict`}
                  value={prediction}
                  onChange={(e) => setPrediction(e.target.value)}
                >
                  <option value="">Choose a prediction</option>
                  <option value="four">Four times as large</option>
                  <option value="twice">Twice as large</option>
                  <option value="same">Unchanged</option>
                </select>
              </div>
              <p>
                The independent-step model predicts four times the mean square, hence twice its
                square root. Your prediction never locks the explanation or controls.
              </p>
            </details>
            <div className="actions">
              <button
                type="button"
                className="secondary"
                disabled={!ready || p.H < 1}
                onClick={() => apply({ ...p, interval: 1 })}
              >
                Observe at 1 second
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!ready || p.H < 4}
                onClick={() => apply({ ...p, interval: 4 })}
              >
                Observe at 4 seconds
              </button>
            </div>
            <p className="fine">
              These buttons use the accepted trial, not unsaved draft edits. The requested time must
              lie on its recording grid.
            </p>
          </div>
          <div className="lab-results">
            <p className="status-line" role="status" aria-live="polite" aria-atomic="true">
              {announcement}
            </p>
            {view.refusal && (
              <div className="notice error" data-refusal-code={view.refusal.code}>
                <p>{view.refusal.message}</p>
                {view.refusal.rankedRepairs.map((repair) => {
                  const action = repair.action;
                  if (!action) return null;
                  return (
                    <button
                      key={`${repair.label}-${action.parameterId}`}
                      type="button"
                      className="secondary"
                      onClick={() => {
                        const baseParams = (view.requested?.parameters ?? p) as Bm01Parameters;
                        apply({
                          ...baseParams,
                          [action.parameterId]: action.value,
                        });
                      }}
                    >
                      {repair.label}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="accepted-caption">
              Accepted trial: seed {p.seed}; {p.M} tracers; {display(p.T)} K; viscosity{" "}
              {display(p.eta, 1e3)} mPa·s; radius {display(p.a, 1e6)} μm. Observe at{" "}
              {display(p.interval)} s in a {display(p.H)}-second recording. Constants: modern SI
              2019.
            </p>
            <TracerPaths snapshot={snapshot} zoom={zoom} />
            <div className="real-rate-card" data-real-rate-card="true">
              <div className="rate-indicators">
                <TimeLegend
                  scale={{
                    spatialMagnification: { appliesTo: "scene", factor: zoom },
                    simulatedElapsedTime: { quantityId: "interval", value: p.interval, unit: "s" },
                    playbackMultiplier: 1,
                    glyphSize: { drawnPx: 3, represents: "none" },
                    quantityNormalization: { kind: "none" },
                  }}
                />
                <span className="rate-annotation" data-rate-mode="natural">
                  Natural rate: ~0.8 μm per second Brownian walk (scale bar: 1 μm)
                </span>
                <span className="rate-comparison fine" data-rate-mode="sped-up">
                  Simulation view: accelerated snapshot across {p.H} s
                </span>
              </div>
            </div>
            <div className="actions">
              <button
                type="button"
                className="secondary"
                disabled={!ready}
                onClick={() => setZoom(zoom === 1 ? 2 : 1)}
              >
                Toggle view magnification
              </button>
              <span className="fine">View only: no calculation or new draws.</span>
            </div>
            <TracerHistogram snapshot={snapshot} />
            <table {...identity(snapshot)}>
              <caption>
                Whole-ensemble statistics: signed coordinate {["x", "y", "z"][p.axis]}, total over{" "}
                {p.d} coordinate{p.d > 1 ? "s" : ""}
              </caption>
              <tbody>
                <tr>
                  <th scope="row">Diffusion coefficient (model)</th>
                  <td data-output="diffusionCoefficient" data-quantity-id="diffusionCoefficient">
                    {display(scalar(snapshot, "diffusionCoefficient"), 1e12)} μm²/s
                  </td>
                </tr>
                <tr>
                  <th scope="row">Signed mean (sample)</th>
                  <td data-output="sampleMean">
                    {display(scalar(snapshot, "sampleMean"), 1e6)} μm
                  </td>
                </tr>
                <tr>
                  <th scope="row">Mean absolute coordinate displacement</th>
                  <td>{display(scalar(snapshot, "sampleMeanAbsolute"), 1e6)} μm</td>
                </tr>
                <tr>
                  <th scope="row">Mean-square coordinate displacement</th>
                  <td>{display(scalar(snapshot, "sampleMeanSquare"), 1e12)} μm²</td>
                </tr>
                <tr>
                  <th scope="row">Coordinate RMS (sample / model)</th>
                  <td data-output="sampleRms">
                    {display(scalar(snapshot, "sampleRms"), 1e6)} /{" "}
                    <span data-quantity-id="rmsDisplacement1d">
                      {display(scalar(snapshot, "rmsDisplacement1d"), 1e6)} μm
                    </span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Mean distance (sample / model)</th>
                  <td>
                    {display(scalar(snapshot, "sampleMeanNorm"), 1e6)} /{" "}
                    {display(scalar(snapshot, "modelMeanNorm"), 1e6)} μm
                  </td>
                </tr>
                <tr>
                  <th scope="row">Total mean square (sample / model)</th>
                  <td data-output="sampleMeanSquareNorm">
                    {display(scalar(snapshot, "sampleMeanSquareNorm"), 1e12)} /{" "}
                    {display(scalar(snapshot, "modelSecondMoment"), 1e12)} μm²
                  </td>
                </tr>
                <tr>
                  <th scope="row">Apparent coordinate speed (sample / model)</th>
                  <td data-output="apparentSpeed">
                    {p.interval === 0
                      ? "Needs a positive interval"
                      : `${display(scalar(snapshot, "sampledApparentSpeed"), 1e6)} / ${display(scalar(snapshot, "modelApparentSpeed"), 1e6)} μm/s`}
                  </td>
                </tr>
              </tbody>
            </table>
            <details>
              <summary>Sampling bands under the model</summary>
              <p className="fine">
                99.9% per comparison, not a simultaneous guarantee across the table or repeated
                observations. These ranges are calculated from the model variance, not estimated
                from the observed sample, and are not uncertainties of the model itself.
              </p>
              <p>
                Signed coordinate mean (μm):{" "}
                <SamplingBand snapshot={snapshot} id="meanBand" factor={1e6} />
              </p>
              <p>
                Total mean square (μm²):{" "}
                <SamplingBand snapshot={snapshot} id="secondMomentBand" factor={1e12} />
              </p>
            </details>
          </div>
        </div>
        <section className="live-equation-group" aria-label="Equations for this accepted trial">
          <h3>Inspect the model behind this trial</h3>
          <p>
            These equations describe the same accepted trial as the plots and table. Select a symbol
            or an operation to see what it means; model predictions are not sample estimates.
          </p>
          {(equationPayload.equations as readonly CompiledEquation[]).map((e) => (
            <SemanticEquation key={e.id} equation={e} />
          ))}
        </section>
        <div className="lab-bottom">
          <TracerScaling snapshot={snapshot} />
          <section>
            <h3>What is, and is not, being simulated</h3>
            <p>
              These synthetic paths are Gaussian independent increments for dilute spherical tracers
              in a homogeneous Newtonian liquid. They do not simulate individual molecular
              collisions, inertia, interactions, sedimentation, walls, localization error or motion
              blur.
            </p>
            <p>
              Low Reynolds number and observation times long compared with momentum relaxation are
              assumed, not verified from fluid and particle data. Lines between samples are a
              drawing convention; they do not define an instantaneous Brownian speed.
            </p>
            <p>
              The three latent coordinates are recorded together. Axis, dimension, observation and
              statistic changes reuse those coordinates. The histogram and statistics use every
              tracer, including those outside the view.
            </p>
            <p>
              No FrankenSim WASM artifact is used. Integer random draws follow the pinned Philox
              mapping; Gaussian conversion uses this host’s math functions and is not claimed
              bitwise identical across browser engines.
            </p>
            <p className="fine">
              Logical recording draws: {scalar(snapshot, "recordingDraws")}.{" "}
              {scalar(snapshot, "reusedRecording") === 1
                ? "This measurement reused the existing recording with no new draws."
                : "This result was assembled from a newly generated deterministic recording."}
            </p>
            <p className="fine digest">Evaluator source digest: {example.sourceDigest}</p>
            <ShowTheCode
              listings={getKernelListingsForInstrument("bm-01")}
              snapshotSourceDigest={example.sourceDigest}
              producedCurrentSnapshot={true}
              snapshotFunctionName="stokesEinsteinD"
              uid={`stc-${id}`}
            />
          </section>
        </div>
        <details>
          <summary>Every histogram count, including tails</summary>
          <table>
            <caption>
              Coordinate intervals in μm; half-open bins, with the final endpoint included
            </caption>
            <thead>
              <tr>
                <th>Interval</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Below the plotted range</th>
                <td>{scalar(snapshot, "underflow")}</td>
              </tr>
              {Array.from({ length: counts.length }, (_, i) => {
                const low = edges.at(i);
                const high = edges.at(i + 1);
                return (
                  <tr key={`bin-${low}-${high}`}>
                    <th scope="row">
                      {display(low, 1e6)} to {display(high, 1e6)}
                    </th>
                    <td>{counts.at(i)}</td>
                  </tr>
                );
              })}
              <tr>
                <th scope="row">Above the plotted range</th>
                <td>{scalar(snapshot, "overflow")}</td>
              </tr>
              <tr>
                <th scope="row">Total, including both tails</th>
                <td>{p.M}</td>
              </tr>
            </tbody>
          </table>
        </details>
        <button type="button" className="secondary" disabled={!ready} onClick={() => void share()}>
          Share accepted trial
        </button>
        {note && <p className="notice">{note}</p>}
        {url && (
          <label className="share-field">
            Accepted trial link
            <input readOnly value={url} onFocus={(e) => e.target.select()} />
          </label>
        )}
      </section>
    </EquationScope>
  );
}
export function TracerComparison({ example }: { example: PreparedBm01Example }) {
  const [second, setSecond] = useState(false);
  return (
    <>
      <TracerLab example={example} />
      <div className="comparison-toggle">
        <p className="fine">
          Separate controls and workers; both start with the same worked-example seed. Choose a new
          trial to compare independently seeded realizations.
        </p>
        <button type="button" className="secondary" onClick={() => setSecond(!second)}>
          {second ? "Close the second tracer ensemble" : "Open a second separate ensemble"}
        </button>
      </div>
      {second && <TracerLab example={example} title="A separate tracer ensemble" />}
    </>
  );
}
