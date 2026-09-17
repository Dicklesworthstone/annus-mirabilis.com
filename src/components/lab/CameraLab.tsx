"use client";
import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { createBm08BrowserChannel } from "../../experiments/bm08/browser.ts";
import {
  type CameraDraft,
  fromCameraDraft,
  toCameraDraft,
} from "../../experiments/bm08/controls.ts";
import type { Bm08Parameters } from "../../experiments/bm08/definition.ts";
import { cameraObservationCsv } from "../../experiments/bm08/export.ts";
import { decodeBm08Settings, encodeBm08Settings } from "../../experiments/bm08/permalink.ts";
import { createBm08Session, type PreparedBm08Example } from "../../experiments/bm08/session.ts";
import { CameraCoverage, CameraPath, CameraSpeed } from "./CameraPlots.tsx";
import { InferenceInterval as Interval, InferenceValue as Value } from "./InferencePlots.tsx";
import { array, display, identity, scalar } from "./presentation.ts";
export function CameraLab({
  example,
  title = "What did the camera change?",
}: {
  example: PreparedBm08Example;
  title?: string;
}) {
  const id = useId(),
    [session] = useState(() => createBm08Session(`bm08-${id}`, example, createBm08BrowserChannel));
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  const [draft, setDraft] = useState(() => toCameraDraft(example.parameters)),
    [ready, setReady] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [shareUrl, setShareUrl] = useState("");
  useEffect(() => {
    setReady(true);
    const link = decodeBm08Settings(window.location.search);
    if (link.kind === "settings") {
      setDraft(toCameraDraft(link.parameters));
      setDirty(true);
      setNote(
        "Shared camera settings are loaded as a draft. Apply them explicitly; the static example has not changed and no worker has started.",
      );
    } else if (link.kind === "invalid") setNote(link.message);
    return () => session.disconnect();
  }, [session]);
  const serverAccepted = session.getServerSnapshot().accepted;
  const snapshot = view.accepted ?? serverAccepted;
  if (!snapshot) return null;
  const p = snapshot.parameters as Bm08Parameters;
  const isStatic = snapshot === serverAccepted;
  function edit(key: keyof CameraDraft, text: string) {
    setDraft((d) => ({ ...d, [key]: text }));
    setDirty(true);
  }
  function apply(settings: Bm08Parameters) {
    const r = session.apply(settings);
    if (r.kind !== "accepted") {
      setError(
        r.kind === "refused"
          ? String(r.refusal.details?.requirements ?? r.refusal.message)
          : r.outcome.message,
      );
      return;
    }
    setDraft(toCameraDraft(settings));
    setDirty(false);
    setError("");
    setNote("");
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      apply({ ...fromCameraDraft(draft), coverageTrials: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check the camera settings.");
    }
  }
  function newTrial() {
    try {
      const seed = crypto.getRandomValues(new Uint32Array(2));
      const high = seed[0] ?? 0;
      const low = seed[1] ?? 0;
      apply({
        ...p,
        seed: ((BigInt(high) << 32n) | BigInt(low)).toString(),
        coverageTrials: 0,
      });
    } catch {
      setError("Enter another unsigned 64-bit physical seed to start a new path.");
    }
  }
  async function share() {
    const link = new URL("/lab/bm-08/", window.location.origin);
    link.search = encodeBm08Settings(session.acceptedParameters());
    setShareUrl(link.href);
    try {
      await navigator.clipboard.writeText(link.href);
      setNote("Accepted camera settings copied; hypothetical experiments are excluded.");
    } catch {
      setNote("Copy the accepted settings from the selectable field.");
    }
  }
  function exportFrames() {
    if (!snapshot) return;
    const url = URL.createObjectURL(
      new Blob([cameraObservationCsv(snapshot, example.sourceDigest)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `bm08-camera-${p.seed}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const field = (key: keyof CameraDraft, label: string) => (
    <div className="input-field">
      <label key={key} htmlFor={`${id}-${key}`}>
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        name={key}
        type="text"
        inputMode={key.endsWith("Seed") || key === "seed" ? "numeric" : "decimal"}
        value={draft[key]}
        onChange={(e) => edit(key, e.target.value)}
      />
    </div>
  );
  const status = view.pending
    ? "Calculating. Every displayed value still belongs to the accepted camera settings."
    : view.status === "refused"
      ? "Request refused. The accepted path, observations and estimates are unchanged."
      : view.status === "unavailable"
        ? `${view.outcome?.message ?? "Execution unavailable."} Accepted observations remain readable.`
        : view.status === "paused"
          ? "Calculation stopped. Accepted observations are unchanged."
          : isStatic
            ? "Static worked example. No calculation has started in this browser."
            : `Accepted ${p.M + 1} camera frames. ${scalar(snapshot, "reusedRecording") ? "The retained latent path was reused." : "A latent path was recorded."}`;
  const times = array(snapshot, "times"),
    observed = array(snapshot, "positions"),
    latent = array(snapshot, "idealPositions"),
    blurred = array(snapshot, "blurredPositions"),
    clicks = array(snapshot, "stationaryClicks"),
    speedTimes = array(snapshot, "speedTimes");
  const coordColumns = [
    { name: "x", axis: 0 },
    { name: "y", axis: 1 },
  ].slice(0, p.d);
  const clickRows = Array.from({ length: p.clicks }, (_, i) => ({
    clickNumber: i + 1,
    offset: i * p.d,
  }));
  const frameRows = Array.from({ length: times.length }, (_, i) => ({
    frameNumber: i + 1,
    time: times.at(i) ?? 0,
    offset: i * p.d,
  }));
  const speedColumns = [
    { key: "idealSpeeds", factor: 1e6 },
    { key: "cameraSpeeds", factor: 1e6 },
    { key: "speedRatios", factor: 1 },
  ] as const;
  const speedRows = Array.from({ length: 6 }, (_, i) => ({
    rowKey: `speed-row-${i + 1}`,
    time: speedTimes.at(i) ?? 0,
    offset: i,
  }));
  return (
    <section
      className="laboratory camera-lab"
      aria-labelledby={`${id}-title`}
      data-instrument-id="bm-08"
      {...identity(snapshot)}
      data-pending={String(view.pending)}
      data-recording-draws={scalar(snapshot, "recordingDraws")}
      data-request-draws={scalar(snapshot, "requestDraws")}
      data-measurement-draws={scalar(snapshot, "measurementDraws")}
      data-coverage-draws={scalar(snapshot, "coverageDraws")}
      data-latent-witness={array(snapshot, "latentWitness").copy().join(",")}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">BM-08 · Observe, then infer</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <span className="badge">
          {isStatic ? "Static worked example" : "Synthetic camera · host calculation"}
        </span>
      </header>
      <noscript>
        <p className="notice">
          JavaScript is off. The calculated observations, estimator comparison, model predictions
          and explanation remain readable. Changing the camera requires JavaScript.
        </p>
      </noscript>
      <p>
        A noisy image is not a new physical trajectory. Keep one wandering particle and change how
        it is observed. Then compare the estimates that ignore camera error with a procedure that
        accounts for it.
      </p>
      <div className="lab-columns">
        <div>
          <form onSubmit={submit} noValidate>
            <fieldset disabled={!ready}>
              <legend>1 · Re-observe the same path</legend>
              <div className="input-grid">
                {field("M", "Displacements (3–1000)")}
                <div className="input-field">
                  <label htmlFor={`${id}-dt`}>Frame spacing (s)</label>
                  <select
                    id={`${id}-dt`}
                    name="dt"
                    value={draft.dt}
                    onChange={(e) => edit("dt", e.target.value)}
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-field">
                  <label htmlFor={`${id}-d`}>Observed coordinates</label>
                  <select
                    id={`${id}-d`}
                    name="d"
                    value={draft.d}
                    onChange={(e) => edit("d", e.target.value)}
                  >
                    <option value="1">One: x</option>
                    <option value="2">Two: x and y</option>
                  </select>
                </div>
                {field("exposure", "Uniform exposure (s; multiples of 0.25)")}
                {field("sigma", "Localization standard deviation (μm)")}
                {field("stageDrift", "Stage drift in x (μm/s)")}
                {field("noiseSeed", "Camera-noise seed (unsigned 64-bit)")}
              </div>
              <p className="fine">
                Exposure starts at each frame time and cannot exceed the spacing. Noise, stage
                drift, coordinates and frame selection leave the retained physical path unchanged.
              </p>
            </fieldset>
            <fieldset disabled={!ready}>
              <legend>2 · Declare what is known about noise</legend>
              <div className="input-grid">
                <div className="input-field">
                  <label className="wide" htmlFor={`${id}-noiseMethod`}>
                    Pair-interval noise procedure
                  </label>
                  <select
                    id={`${id}-noiseMethod`}
                    name="noiseMethod"
                    value={draft.noiseMethod}
                    onChange={(e) => edit("noiseMethod", e.target.value)}
                  >
                    <option value="stationary">
                      Estimate from independent stationary-feature clicks
                    </option>
                    <option value="known">
                      Declare the synthetic noise variance exactly known
                    </option>
                  </select>
                </div>
                {field("clicks", "Stationary clicks (5–200)")}
                {field("clickSeed", "Stationary-click seed (unsigned 64-bit)")}
                {field("coverage", "Target interval coverage (%)")}
              </div>
              <p className="fine">
                Changing the statistical procedure alone reuses the same observations. Stationary
                clicks have independent errors and an unknown constant feature location; they are
                not clicks on the moving particle.
              </p>
            </fieldset>
            <details>
              <summary>3 · Change the physical setup</summary>
              <fieldset disabled={!ready}>
                <legend>These changes start a new physical run</legend>
                <div className="input-grid">
                  {field("D", "Generating diffusivity (μm²/s)")}
                  {field("flowDrift", "Fluid drift in x (μm/s)")}
                  {field("seed", "Physical seed (unsigned 64-bit)")}
                </div>
                <p className="fine">
                  Fluid drift belongs to the physical path. Stage drift belongs to the measurement.
                  Either produces apparent drift, but only the first changes this recording.
                </p>
              </fieldset>
            </details>
            <div className="actions">
              <button disabled={!ready} type="submit">
                Apply camera settings
              </button>
              <button
                disabled={!ready || !view.pending}
                type="button"
                className="secondary"
                onClick={() => session.stop()}
              >
                Stop calculation
              </button>
            </div>
            {dirty && (
              <p className="fine">
                Unapplied draft. The graphs and tables still describe the accepted settings.
              </p>
            )}
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
          </form>
          <div className="actions camera-presets">
            <button
              type="button"
              disabled={!ready}
              className="secondary"
              onClick={() =>
                apply({ ...p, sigma: 0, exposure: 0, stageDrift: 0, coverageTrials: 0 })
              }
            >
              No camera error · same path
            </button>
            <button
              type="button"
              disabled={!ready}
              className="secondary"
              onClick={() =>
                apply({ ...p, sigma: 0.4e-6, exposure: 0, stageDrift: 0, coverageTrials: 0 })
              }
            >
              Noise only · same path
            </button>
            <button
              type="button"
              disabled={!ready}
              className="secondary"
              onClick={() =>
                apply({ ...p, sigma: 0, exposure: p.dt, stageDrift: 0, coverageTrials: 0 })
              }
            >
              Exposure only · same path
            </button>
            <button
              type="button"
              disabled={!ready}
              className="secondary"
              onClick={() => apply({ ...p, stageDrift: 0.5e-6, coverageTrials: 0 })}
            >
              Add stage drift · same path
            </button>
          </div>
          <p className="fine">
            Comparisons use accepted settings, not unfinished drafts. Reset stage drift with a
            camera-error comparison; fluid drift remains an explicit physical input.
          </p>
          <div className="actions">
            <button type="button" disabled={!ready} className="secondary" onClick={newTrial}>
              New independent physical trial
            </button>
            <button type="button" disabled={!ready} className="secondary" onClick={share}>
              Copy accepted camera link
            </button>
            <button type="button" disabled={!ready} className="secondary" onClick={exportFrames}>
              Download accepted camera frames
            </button>
          </div>
          {shareUrl && (
            <div className="share-field">
              <label htmlFor={`${id}-share`}>Accepted camera link</label>
              <input
                id={`${id}-share`}
                type="text"
                readOnly
                value={shareUrl}
                onFocus={(e) => e.target.select()}
              />
            </div>
          )}
          {note && <p className="notice">{note}</p>}
        </div>
        <div className="lab-results camera-results">
          <p className="status-line" role="status" aria-live="polite" aria-atomic="true">
            {status}
          </p>
          {view.refusal && (
            <div className="notice error" data-refusal-code={view.refusal.code}>
              <p>{String(view.refusal.details?.requirements ?? view.refusal.message)}</p>
              {view.refusal.rankedRepairs.map((repair) => {
                const action = repair.action;
                if (!action) return null;
                const requestedParams =
                  (view.requested?.parameters as Bm08Parameters | undefined) ?? p;
                return (
                  <button
                    key={`${action.parameterId}-${repair.label}`}
                    type="button"
                    className="secondary"
                    onClick={() =>
                      apply({
                        ...requestedParams,
                        [action.parameterId]: action.value,
                      })
                    }
                  >
                    {repair.label}
                  </button>
                );
              })}
              <button type="button" className="secondary" onClick={() => apply(p)}>
                Restore accepted settings
              </button>
            </div>
          )}
          <p className="accepted-caption">
            Accepted physical seed {p.seed}; D = {display(p.D, 1e12)} μm²/s; {p.M + 1} frames in{" "}
            {p.d} coordinate{p.d === 1 ? "" : "s"}; spacing {display(p.dt)} s; exposure{" "}
            {display(p.exposure)} s; localization error {display(p.sigma, 1e6)} μm. Stage drift{" "}
            {display(p.stageDrift, 1e6)} μm/s; fluid drift {display(p.flowDrift, 1e6)} μm/s.
          </p>
          <CameraPath snapshot={snapshot} />
          <h3>Four estimates, different assumptions</h3>
          <table>
            <caption>Accepted diffusivity estimates (μm²/s)</caption>
            <tbody>
              {(
                [
                  ["Generating value", "modelDiffusion"],
                  ["Ignore camera error and drift", "naiveD"],
                  ["Fit drift, but ignore camera error", "centeredD"],
                  ["Covariance estimate; known synthetic drift removed", "covarianceD"],
                  ["Disjoint pairs; noise and exposure corrected", "pairD"],
                ] as const
              ).map(([label, key]) => (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  <td>
                    <Value snapshot={snapshot} id={key} factor={1e12} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="fine">
            The covariance estimate uses the explicitly known synthetic drift, not a secretly fitted
            mean. It has no general confidence interval here. The pair procedure fits drift within
            its disjoint pairs and does not use generating D. Negative unconstrained estimates
            remain visible as diagnostics.
          </p>
          <h3>Which intervals are actually valid?</h3>
          <div className="camera-intervals">
            <h4>Ignoring the camera and drift</h4>
            <p>
              <Interval snapshot={snapshot} id="naiveInterval" factor={1e12} />
            </p>
            <h4>Fitting drift only</h4>
            <p>
              <Interval snapshot={snapshot} id="centeredInterval" factor={1e12} />
            </p>
            <h4>Disjoint pairs, with a camera model</h4>
            <p className="camera-pair-result">
              <Interval snapshot={snapshot} id="pairInterval" factor={1e12} />
            </p>
            <p>
              {display(p.coverage, 100)}% target coverage; μm²/s.{" "}
              {p.noiseMethod === "known"
                ? "Exact Gaussian model procedure conditional on the declared synthetic noise variance."
                : "Conservative procedure combining stationary-click noise uncertainty with disjoint-pair variance uncertainty."}
            </p>
            <p className="fine">
              <Value snapshot={snapshot} id="pairCount" /> disjoint pairs;{" "}
              <Value snapshot={snapshot} id="pairDegrees" /> residual degrees of freedom.{" "}
              {scalar(snapshot, "pairLowerClipped")
                ? "The set was intersected with nonnegative diffusivity. A boundary value is not evidence of zero diffusion."
                : ""}
            </p>
          </div>
        </div>
      </div>
      <section className="grid-result camera-results">
        <h3>Look for the camera’s fingerprint</h3>
        <p>
          Neighboring displacements share a localization error with opposite signs. Exposure
          averaging creates a different correlation. A variance alone cannot distinguish these
          effects.
        </p>
        <table>
          <caption>Per-coordinate moments after subtracting known synthetic drift; μm²</caption>
          <thead>
            <tr>
              <th scope="col">Moment</th>
              <th scope="col">Sample</th>
              <th scope="col">Camera model</th>
              <th scope="col">Asymptotic sampling SD</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Increment variance</th>
              <td>
                <Value snapshot={snapshot} id="sampleVariance" factor={1e12} />
              </td>
              <td>
                <Value snapshot={snapshot} id="expectedVariance" factor={1e12} />
              </td>
              <td>
                <Value snapshot={snapshot} id="sdVariance" factor={1e12} />
              </td>
            </tr>
            <tr>
              <th scope="row">Adjacent-increment covariance</th>
              <td>
                <Value snapshot={snapshot} id="sampleCovariance" factor={1e12} />
              </td>
              <td>
                <Value snapshot={snapshot} id="expectedCovariance" factor={1e12} />
              </td>
              <td>
                <Value snapshot={snapshot} id="sdCovariance" factor={1e12} />
              </td>
            </tr>
          </tbody>
        </table>
        <p className="fine">
          The last column is a large-sample MA(1) approximation for the moment estimates, not a
          confidence interval for D. It is particularly unreliable for very small samples. Expected
          naive D under this camera:{" "}
          <Value snapshot={snapshot} id="naiveExpectation" factor={1e12} /> μm²/s.
        </p>
        <details>
          <summary>Inspect stationary clicks and inferred noise</summary>
          <p>
            Stationary-click variance:{" "}
            <Value snapshot={snapshot} id="stationaryNoiseVariance" factor={1e12} /> μm².
            Covariance-based noise estimate:{" "}
            <Value snapshot={snapshot} id="covarianceNoiseVariance" factor={1e12} /> μm². Noise
            bounds used by the pair procedure:{" "}
            <Interval snapshot={snapshot} id="noiseInterval" factor={1e12} /> μm². In exact-noise
            mode the two bounds are the declared value; otherwise they consume half the allowed
            error probability.
          </p>
          <div className="table-scroll">
            <table>
              <caption>Independent stationary-feature positions (μm)</caption>
              <thead>
                <tr>
                  <th scope="col">Click</th>
                  {coordColumns.map((col) => (
                    <th key={`coord-header-${col.name}`} scope="col">
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clickRows.map((row) => (
                  <tr key={`stationary-click-${row.clickNumber}`}>
                    <th scope="row">{row.clickNumber}</th>
                    {coordColumns.map((col) => (
                      <td key={`click-val-${col.name}`}>
                        {display(clicks.at(row.offset + col.axis) ?? 0, 1e6)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <details>
          <summary>Read all accepted frame positions</summary>
          <div className="table-scroll">
            <table data-camera-frames>
              <caption>
                Every selected coordinate; exposure-start time in seconds, positions in μm
              </caption>
              <thead>
                <tr>
                  <th scope="col">Start</th>
                  <th scope="col">Coordinate</th>
                  <th scope="col">Latent start</th>
                  <th scope="col">Exposure average</th>
                  <th scope="col">Camera position</th>
                </tr>
              </thead>
              <tbody>
                {frameRows.flatMap((frame) =>
                  coordColumns.map((col) => (
                    <tr key={`frame-${frame.frameNumber}-${col.name}`}>
                      <th scope="row">{display(frame.time)}</th>
                      <td>{col.name}</td>
                      <td>{display(latent.at(frame.offset + col.axis) ?? 0, 1e6)}</td>
                      <td>{display(blurred.at(frame.offset + col.axis) ?? 0, 1e6)}</td>
                      <td>{display(observed.at(frame.offset + col.axis) ?? 0, 1e6)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <section className="grid-result camera-results">
        <h3>Faster pictures need not reveal a physical speed</h3>
        <p>
          This separate analytical comparison holds the accepted diffusivity and localization error
          fixed, sets exposure to zero, and varies a hypothetical observation interval. It does not
          create extra frames on the retained quarter-second grid. Neither curve is an instantaneous
          velocity.
        </p>
        <CameraSpeed snapshot={snapshot} />
        <p>
          Noise-only crossover interval: <Value snapshot={snapshot} id="speedCrossover" /> s. At
          positive exposure, blur also changes the spread; that is not part of this zero-exposure
          comparison.
        </p>
        <table>
          <caption>Analytical zero-exposure comparison, not additional sampled data</caption>
          <thead>
            <tr>
              <th scope="col">Spacing (s)</th>
              <th scope="col">Ideal (μm/s)</th>
              <th scope="col">With noise (μm/s)</th>
              <th scope="col">Ratio</th>
            </tr>
          </thead>
          <tbody>
            {speedRows.map((row) => (
              <tr key={row.rowKey}>
                <th scope="row">{display(row.time)}</th>
                {speedColumns.map((col) => (
                  <td key={col.key}>
                    {display(array(snapshot, col.key).at(row.offset) ?? 0, col.factor)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="grid-result camera-results">
        <h3>Does the interval procedure cover the generating value?</h3>
        <p>
          Compare 100 other hypothetical paths under the same physical and camera settings. The
          dashed comparison deliberately applies the naive formula even where it is invalid; a
          pleasing interval is not evidence that its assumptions hold.
        </p>
        <div className="actions">
          <button
            type="button"
            disabled={!ready || view.pending}
            onClick={() => apply({ ...p, coverageTrials: 100 })}
          >
            Run 100 camera experiments
          </button>
          <button
            type="button"
            disabled={!ready || view.pending || p.coverageTrials === 0}
            className="secondary"
            onClick={() => apply({ ...p, coverageTrials: 0 })}
          >
            Hide repeated experiments
          </button>
        </div>
        {p.coverageTrials > 0 && (
          <p className="camera-coverage-counts">
            Naive covers: <Value snapshot={snapshot} id="coverageNaiveCount" /> / {p.coverageTrials}
            . Noise-aware pairs cover: <Value snapshot={snapshot} id="coveragePairCount" /> /{" "}
            {p.coverageTrials}. Empty pair sets:{" "}
            <Value snapshot={snapshot} id="coverageEmptyCount" />.
          </p>
        )}
        <CameraCoverage snapshot={snapshot} />
        <p className="fine">
          Every trial, including misses and empty sets, is retained. Changing the noise procedure
          reuses the same hypothetical identities. The primary path and camera observations are not
          replaced. A realized coverage fraction need not equal the target.
        </p>
      </section>
      <details className="camera-provenance">
        <summary>Accepted identity, random streams and limits</summary>
        <p>
          Run {snapshot.runId}; snapshot {snapshot.snapshotVersion}; revisions{" "}
          {JSON.stringify(snapshot.revisions)}. Owner <code>inference.bm08</code>.
        </p>
        <p>
          Retained path and bridge draws: <Value snapshot={snapshot} id="recordingDraws" />. New
          latent work for this request: <Value snapshot={snapshot} id="requestDraws" />.
          Camera/click stream evaluations: <Value snapshot={snapshot} id="measurementDraws" />.
          Hypothetical experiment draws: <Value snapshot={snapshot} id="coverageDraws" />. Retained
          latent bytes: <Value snapshot={snapshot} id="retainedBytes" />.
        </p>
        <p className="fine">
          Source identity: <code>{example.sourceDigest}</code>. Two latent coordinates and exact
          Brownian subinterval averages are retained on 4,112 quarter-second intervals. Frame errors
          have separate timestamp-indexed streams. Remeasurement may evaluate the same noise draws
          again; it does not create a new latent trajectory. No irregular timing, overlapping
          exposure, censoring, empirical import or arbitrary camera likelihood is admitted. This is
          host arithmetic, not audited WASM or historical evidence.
        </p>
      </details>
    </section>
  );
}
export function CameraComparison({ example }: { example: PreparedBm08Example }) {
  const [second, setSecond] = useState(false);
  return (
    <>
      <CameraLab example={example} />
      <div className="comparison-toggle">
        <button type="button" className="secondary" onClick={() => setSecond((v) => !v)}>
          {second ? "Close the second camera" : "Open a separate camera laboratory"}
        </button>
        <p>Each placement has its own accepted settings, worker and observations.</p>
      </div>
      {second && <CameraLab example={example} title="A separately controlled camera" />}
    </>
  );
}
