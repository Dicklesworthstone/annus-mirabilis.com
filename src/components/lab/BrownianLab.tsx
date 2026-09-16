"use client";
import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { createBm06BrowserChannel } from "../../experiments/bm06/browser.ts";
import {
  BM06_FIELDS as fields,
  fromBm06Draft as fromDraft,
  toBm06Draft as toDraft,
} from "../../experiments/bm06/controls.ts";
import {
  BM06_MODEL,
  BM06_PRESETS,
  BM06_RADIAL_EXPLANATIONS,
  type Bm06Parameters,
} from "../../experiments/bm06/definition.ts";
import { decodeBm06Settings, encodeBm06Settings } from "../../experiments/bm06/permalink.ts";
import { createBm06Session, type PreparedBm06Example } from "../../experiments/bm06/session.ts";
import { DistributionPlot, GridComparison } from "./DistributionPlot.tsx";
import { array, display, identity, scalar } from "./presentation.ts";

export type ExternalDiffusivitySource = Readonly<{
  instanceId: string;
  runId: string;
  snapshotVersion: number;
  value: number;
}>;
export function BrownianLab({
  example,
  title = "The spreading laboratory",
  externalDiffusivitySource,
}: {
  example: PreparedBm06Example;
  title?: string;
  /** A named BM-01 instance's accepted snapshot, offered by whichever page renders both
   * instruments together (am-bm-slice-discovery-route-tias, not yet built) -- BrownianLab never
   * reaches out for this itself. Undefined here means no source is available on this page today. */
  externalDiffusivitySource?: ExternalDiffusivitySource;
}) {
  const id = useId();
  const [session] = useState(() =>
    createBm06Session(`bm06-${id}`, example, createBm06BrowserChannel),
  );
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  const snapshot = view.accepted!;
  const p = snapshot.parameters as Bm06Parameters;
  const [draft, setDraft] = useState(() => toDraft(example.parameters));
  const [ready, setReady] = useState(false),
    [dirty, setDirty] = useState(false);
  const [error, setError] = useState(""),
    [linkNote, setLinkNote] = useState("");
  const [sharedUrl, setSharedUrl] = useState("");
  useEffect(() => {
    setReady(true);
    const shared = decodeBm06Settings(window.location.search);
    if (shared.kind === "settings") {
      setDraft(toDraft(shared.parameters));
      setDirty(true);
      setLinkNote(
        "Shared settings are loaded. Choose Apply settings to calculate them; the worked example is still displayed.",
      );
    } else if (shared.kind === "invalid") setLinkNote(shared.message);
    return () => session.disconnect();
  }, [session]);
  function apply(parameters: Bm06Parameters) {
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
      apply(fromDraft(draft));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check the entered settings.");
    }
  }
  function preset(parameters: Bm06Parameters) {
    setDraft(toDraft(parameters));
    setDirty(true);
    setError("");
  }
  function copyDiffusivity() {
    if (!externalDiffusivitySource) return;
    const outcome = session.copyDiffusivityFrom(externalDiffusivitySource);
    if (outcome.kind === "refused") {
      setError(
        typeof outcome.refusal.details?.requirements === "string"
          ? outcome.refusal.details.requirements
          : outcome.refusal.message,
      );
      return;
    }
    setDraft(toDraft(session.acceptedParameters()));
    setError("");
  }
  async function share() {
    const url = new URL(window.location.pathname, window.location.origin);
    url.search = encodeBm06Settings(session.acceptedParameters());
    setSharedUrl(url.href);
    try {
      await navigator.clipboard.writeText(url.href);
      setLinkNote("Link to the accepted settings copied.");
    } catch {
      setLinkNote("Copy the accepted-settings link from the field below.");
    }
  }
  const probability = scalar(snapshot, "intervalProbability");
  const rms = scalar(snapshot, "rmsDisplacement1d");
  const announcement = view.pending
    ? "Calculating the requested settings. The last accepted result remains below."
    : view.status === "refused"
      ? `${view.refusal!.message} The last accepted result is unchanged.`
      : view.status === "unavailable"
        ? `${view.outcome!.message} The worked result remains readable.`
        : view.status === "paused"
          ? "Calculation stopped. The last accepted result is unchanged."
          : `Accepted result: RMS displacement ${display(rms, 1e6)} micrometres; selected interval probability ${display(probability, 100)} percent.`;
  const times = array(snapshot, "comparisonTimes"),
    spreads = array(snapshot, "comparisonRms");
  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="bm-06"
      {...identity(snapshot)}
      data-input-revision={view.requested!.revisions.input}
      data-accepted-input-revision={snapshot.revisions.input}
      data-pending={String(view.pending)}
      data-execution-label="host"
      data-source-digest={example.sourceDigest}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">BM-06 · An executable model</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <span className="badge">{BM06_MODEL.label}</span>
      </header>
      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built.
          Its graph, values, model assumptions and explanations remain available; changing the
          settings requires JavaScript.
        </p>
      </noscript>
      <p>
        Choose an interval and ask how likely a tracer is to finish inside it. Changing a field only
        edits a request. The plot and table change together after you apply valid settings.
      </p>
      <div className="lab-columns">
        <form
          onSubmit={submit}
          aria-label="Brownian laboratory settings"
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <fieldset disabled={!ready}>
            <legend>Set up the question</legend>
            <div className="preset-list">
              {Object.entries(BM06_PRESETS).map(([key, item]) => (
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
              {fields.slice(0, 6).map((field) => (
                <label key={field.key} htmlFor={`${id}-${field.key}`}>
                  {field.label} <span>({field.unit})</span>
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
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={draft.gridEnabled}
                onChange={(event) => {
                  setDraft({ ...draft, gridEnabled: event.target.checked });
                  setDirty(true);
                }}
              />{" "}
              Compare with a numerical grid
            </label>
            {draft.gridEnabled && (
              <div className="input-grid">
                {fields.slice(6).map((field) => (
                  <label key={field.key} htmlFor={`${id}-${field.key}`}>
                    {field.label} <span>({field.unit})</span>
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
              </div>
            )}
            <p className="fine">
              Positive temperature, viscosity and radius; nonnegative time. Interval endpoints are
              closed. Grid: 3–4097 cells and a separate work budget. Values outside a calculation’s
              domain are refused, never clamped.
            </p>
            <div className="actions">
              <button type="submit">Apply settings</button>
              <button
                type="button"
                className="secondary"
                disabled={!view.pending}
                onClick={() => session.stop()}
              >
                Stop calculation
              </button>
              {externalDiffusivitySource && (
                <button type="button" className="secondary" onClick={copyDiffusivity}>
                  Copy D from {externalDiffusivitySource.instanceId}
                </button>
              )}
            </div>
            {p.copiedDiffusivityValue > 0 && (
              <p className="fine">
                Diffusivity copied from instance {p.copiedDiffusivityInstanceId}, run{" "}
                {p.copiedDiffusivityRunId}, snapshot version {p.copiedDiffusivitySnapshotVersion}: a
                one-time value, not a live link. A later change in that instance will not change
                this one.
              </p>
            )}
          </fieldset>
          {dirty && (
            <p className="draft-note">
              Unapplied settings. Results still describe the accepted settings shown beside them.
            </p>
          )}
          {error && (
            <p id={`${id}-error`} role="alert" className="notice error">
              {error}
            </p>
          )}
        </form>
        <div className="lab-results" {...identity(snapshot)}>
          <p role="status" aria-live="polite" aria-atomic="true" className="status-line">
            {announcement}
          </p>
          {view.refusal && (
            <div className="notice error" data-refusal-code={view.refusal.code}>
              <h3>Requested calculation not accepted</h3>
              <p>{view.refusal.message}</p>
              <p>
                Requested: {String(view.requested!.parameters.steps)} time steps,{" "}
                {display(view.requested!.parameters.t as number)} seconds. The values below retain
                their accepted settings.
              </p>
              {view.refusal.rankedRepairs.map((repair, i) => (
                <button
                  type="button"
                  className="secondary"
                  key={i}
                  onClick={() => {
                    if (!repair.action) return;
                    const corrected = {
                      ...view.requested!.parameters,
                      [repair.action.parameterId]: repair.action.value,
                    } as Bm06Parameters;
                    setDraft(toDraft(corrected));
                    apply(corrected);
                  }}
                  disabled={!ready || !repair.action}
                >
                  {repair.label}
                </button>
              ))}
            </div>
          )}
          <div className="accepted-caption">
            <strong>Accepted settings</strong>
            <br />
            {display(p.T)} K · {display(p.eta, 1000)} mPa·s · radius {display(p.a, 1e6)} μm ·
            elapsed {display(p.t)} s<br />
            Constants: modern SI (2019). Viscosity is a declared input, not inferred from
            temperature.
          </div>
          <DistributionPlot
            snapshot={snapshot}
            clipId={`plot-${id.replace(/[^a-zA-Z0-9]/g, "")}`}
          />
          <div className="table-scroll">
            <table {...identity(snapshot)}>
              <caption>One accepted calculation, in explicit units</caption>
              <tbody>
                <tr>
                  <th scope="row">Diffusion coefficient</th>
                  <td data-output="diffusionCoefficient">
                    {display(scalar(snapshot, "diffusionCoefficient"), 1e12)} μm²/s
                  </td>
                </tr>
                <tr>
                  <th scope="row">RMS displacement</th>
                  <td data-output="rmsDisplacement1d">{display(rms, 1e6)} μm</td>
                </tr>
                <tr>
                  <th scope="row">Mean square displacement</th>
                  <td>{display(scalar(snapshot, "meanSquareDisplacement1d"), 1e12)} μm²</td>
                </tr>
                <tr>
                  <th scope="row">Selected closed interval</th>
                  <td>
                    [{display(p.lower, 1e6)}, {display(p.upper, 1e6)}] μm
                  </td>
                </tr>
                <tr>
                  <th scope="row">Probability inside that interval</th>
                  <td data-output="intervalProbability">{display(probability, 100)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="fine">
            Density is measured per unit length; probability is a dimensionless area. A taller curve
            is not a larger total probability.
          </p>
        </div>
      </div>
      {p.gridEnabled && (
        <div className="grid-result" {...identity(snapshot)}>
          <p>
            Accepted grid: {String(p.n)} cells of width {display(p.dx, 1e6)} μm;{" "}
            {snapshot.stepIndex} steps. Time step: {display(scalar(snapshot, "gridTimeStep"))} s.
            Diffusion number: {display(scalar(snapshot, "stabilityRatio"))}.
          </p>
          <p className="notice">
            {scalar(snapshot, "wallContact") === 1
              ? "The spread has reached the reflecting walls. Differences from the unbounded curve now include different boundary models; they are not solely numerical error."
              : "No wall contact is detected at the declared threshold. The grid and analytic calculation still have different boundary models."}{" "}
            Maximum cell-probability difference:{" "}
            {display(scalar(snapshot, "maxCellMassDifference"))}.
          </p>
          <GridComparison snapshot={snapshot} />
        </div>
      )}
      <div className="lab-bottom">
        <section {...identity(snapshot)}>
          <h3>One setup, three observation times</h3>
          <table>
            <caption>Calculated from the same accepted diffusivity</caption>
            <thead>
              <tr>
                <th scope="col">Elapsed time</th>
                <th scope="col">RMS displacement</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: times.length }, (_, i) => (
                <tr key={i}>
                  <th scope="row">{display(times.at(i))} s</th>
                  <td>{display(spreads.at(i), 1e6)} μm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section {...identity(snapshot)}>
          <h3>The same spread, as a 2D or 3D radius</h3>
          <p>
            A radius is not a signed coordinate: it is never negative, and the growing circumference
            (2D) or surface area (3D) of positions at a given distance changes which average is
            largest.
          </p>
          <div className="table-scroll">
            <table>
              <caption>Radial moments at the accepted diffusivity and elapsed time</caption>
              <thead>
                <tr>
                  <th scope="col">Quantity</th>
                  <th scope="col">2D radius</th>
                  <th scope="col">3D radius</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Mean radius ⟨r⟩</th>
                  <td data-output="meanRadius2d">
                    {display(scalar(snapshot, "meanRadius2d"), 1e6)} μm
                  </td>
                  <td data-output="meanRadius3d">
                    {display(scalar(snapshot, "meanRadius3d"), 1e6)} μm
                  </td>
                </tr>
                <tr>
                  <th scope="row">RMS radius √⟨r²⟩</th>
                  <td data-output="rmsRadius2d">
                    {display(scalar(snapshot, "rmsRadius2d"), 1e6)} μm
                  </td>
                  <td data-output="rmsRadius3d">
                    {display(scalar(snapshot, "rmsRadius3d"), 1e6)} μm
                  </td>
                </tr>
                <tr>
                  <th scope="row">Most likely radius</th>
                  <td data-output="mostLikelyRadius2d">
                    {display(scalar(snapshot, "mostLikelyRadius2d"), 1e6)} μm
                  </td>
                  <td>not modeled</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>{BM06_RADIAL_EXPLANATIONS.meanRadius2d}</p>
          <p>{BM06_RADIAL_EXPLANATIONS.rmsRadius2d}</p>
          <p>{BM06_RADIAL_EXPLANATIONS.mostLikelyRadius2d}</p>
          <p>{BM06_RADIAL_EXPLANATIONS.meanRadius3d}</p>
          <p>{BM06_RADIAL_EXPLANATIONS.rmsRadius3d}</p>
        </section>
        <section>
          <h3>What this model leaves out</h3>
          {BM06_MODEL.assumptions.map((note) => (
            <p key={note}>{note}</p>
          ))}
          <p>
            No FrankenSim artifact is used here. A verified historical transcription and the full
            critical edition are still in preparation.
          </p>
        </section>
      </div>
      <details>
        <summary>Show the calculation owner and source identity</summary>
        <p>
          Density, interval probability and displacement come from{" "}
          <code>src/physics/reference/diffusion/distributions.ts</code>. The grid comes from{" "}
          <code>src/physics/reference/diffusion/ftcs.ts</code>. One worker operation assembles all
          views.
        </p>
        <p className="digest">
          <code>{example.sourceDigest}</code>
        </p>
        <a href="https://github.com/Dicklesworthstone/annus-mirabilis.com/tree/main/src/physics/reference">
          Read the calculation source
        </a>
        <p className="fine">
          The source link opens current main, which may differ from this build. The digest above
          identifies the evaluator sources used by this page.
        </p>
      </details>
      <div className="actions">
        <button
          type="button"
          className="secondary"
          disabled={!ready}
          onClick={() => {
            void share();
          }}
        >
          Copy accepted-settings link
        </button>
      </div>
      {sharedUrl && (
        <label className="share-field">
          Accepted-settings link
          <input
            type="text"
            readOnly
            value={sharedUrl}
            onFocus={(event) => event.target.select()}
          />
        </label>
      )}
      {linkNote && <p className="notice">{linkNote}</p>}
    </section>
  );
}
export function BrownianComparison({ example }: { example: PreparedBm06Example }) {
  const [second, setSecond] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <>
      <BrownianLab example={example} />
      <div className="comparison-toggle">
        <button
          type="button"
          className="secondary"
          disabled={!ready}
          onClick={() => setSecond(!second)}
        >
          {second ? "Close the second laboratory" : "Open an independent second laboratory"}
        </button>
        <p className="fine">
          Compare two setups side by side in your reading. Each laboratory has its own settings,
          worker and accepted results.
        </p>
      </div>
      {second && <BrownianLab example={example} title="An independent comparison" />}
    </>
  );
}
