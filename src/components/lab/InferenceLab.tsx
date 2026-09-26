"use client";
import { type FormEvent, useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { createBm07BrowserChannel } from "../../experiments/bm07/browser.ts";
import {
  fromInferenceDraft,
  type InferenceDraft,
  toInferenceDraft,
} from "../../experiments/bm07/controls.ts";
import {
  BM07_CAPTION,
  BM07_OUTPUTS,
  BM07_SEMANTIC_KIND_TEXT,
  type Bm07Parameters,
} from "../../experiments/bm07/definition.ts";
import { BM07_DRAFT_TAPE } from "../../experiments/bm07/draftTape.ts";
import { inferenceObservationCsv } from "../../experiments/bm07/export.ts";
import { decodeBm07Settings } from "../../experiments/bm07/permalink.ts";
import { createBm07Session, type PreparedBm07Example } from "../../experiments/bm07/session.ts";
import {
  executionLabelFor,
  executionStateKindFromHostLabel,
} from "../../experiments/labels/executionLabelFor.ts";
import { executionLabelAttributes } from "../../experiments/labels/resultAttributes.ts";
import { LabTapeLink, useDraftTapeLink } from "../../experiments/permalink/LabTapeLink.tsx";
import { deriveHostExecution } from "../../experiments/provenance/executionState.ts";
import { instrumentRootAttributes } from "../../experiments/store/identityAttributes.ts";
import { PREDICT_PROMPTS } from "../../generated/predict-prompts.ts";
import {
  InferenceCoverage,
  InferenceFamily,
  InferenceInterval,
  InferencePath,
  InferenceValue,
} from "./InferencePlots.tsx";
import { KEPT_RESULT } from "./keptResult.ts";
import { PredictGatePanels, usePredictGate, withPredictions } from "./PredictGate.tsx";
import { array, display, identity, result, scalar } from "./presentation.ts";
import { SEED_MAX_READABLE, SeedHelp } from "./SeedHelp.tsx";
import { withScripts } from "./subscripts.tsx";

const estimatorNames = {
  "independent-increment-known-zero-drift": "Known zero drift · unbiased",
  "drift-centered": "Fit drift · unbiased spread",
  "maximum-likelihood-centered": "Fit drift · maximum likelihood",
};
// The manifest's prompt (scripts/generate-predict-prompts.mjs), one stable array for the gate.
const BM07_PROMPTS = PREDICT_PROMPTS["bm-07"] ?? [];

export function InferenceLab({
  example,
  title = "What can wandering reveal?",
  readings = true,
}: {
  example: PreparedBm07Example;
  title?: string;
  /** False for the optional second laboratory, so the page carries the caption readings once. */
  readings?: boolean;
}) {
  const id = useId(),
    [session] = useState(() => createBm07Session(`bm07-${id}`, example, createBm07BrowserChannel));
  // Predict mode (am-inst-predict-mode-ti7m): the result waits for the reader's answer.
  const gate = usePredictGate("bm-07", BM07_PROMPTS);
  const serverAccepted = session.getServerSnapshot().accepted;
  if (!serverAccepted) {
    throw new Error("Missing accepted inference snapshot");
  }
  const view = useSyncExternalStore(
      session.subscribe,
      session.getSnapshot,
      session.getServerSnapshot,
    ),
    snapshot = view.accepted ?? serverAccepted,
    p = snapshot.parameters as Bm07Parameters;
  const [draft, setDraft] = useState(() => toInferenceDraft(example.parameters));
  const [ready, setReady] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [revealedRun, setRevealedRun] = useState<string | null>(null);
  const revealed = revealedRun === snapshot.runId,
    isStatic = snapshot === session.getServerSnapshot().accepted;
  // Earned per snapshot (am-inst-execution-labels-5ywv), and checked against the output contracts
  // and the example's source digest: the badge said the right words, but the lab root carried no
  // label at all.
  const executionKind = executionStateKindFromHostLabel(
    deriveHostExecution(view, BM07_OUTPUTS, example.sourceDigest, isStatic).label,
  );
  // A shared ?tape= link puts its settings in the form and starts no worker; Apply runs them. It
  // carries no coverage experiments, as the older link did not: a reader runs those deliberately.
  const shareable = useMemo(() => ({ ...p, coverageTrials: 0 }), [p]);
  const tapeLink = useDraftTapeLink(BM07_DRAFT_TAPE, shareable, true, (settings) => {
    setDraft(toInferenceDraft(settings as unknown as Bm07Parameters));
    setDirty(true);
  });
  useEffect(() => {
    setReady(true);
    const shared = decodeBm07Settings(window.location.search);
    if (shared.kind === "settings") {
      setDraft(toInferenceDraft(shared.parameters));
      setDirty(true);
      setNote(
        "Shared settings are loaded as a draft. The worked example is unchanged until you apply them. No hypothetical experiments start from a link.",
      );
    } else if (shared.kind === "invalid") setNote(shared.message);
    return () => session.disconnect();
  }, [session]);
  function edit(key: keyof InferenceDraft, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }
  function apply(settings: Bm07Parameters) {
    const response = session.apply(settings);
    if (response.kind !== "accepted") {
      setError(
        response.kind === "refused"
          ? String(response.refusal.details?.requirements ?? response.refusal.message)
          : response.outcome.message,
      );
      return;
    }
    setDraft(toInferenceDraft(settings));
    setDirty(false);
    setError("");
    setNote("");
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      apply({ ...fromInferenceDraft(draft), coverageTrials: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check the input settings.");
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
      setError(
        `A random seed is unavailable here. Type a seed of your own in the generator settings: any whole number from 0 to ${SEED_MAX_READABLE}.`,
      );
    }
  }
  function exportObservations() {
    const url = URL.createObjectURL(
      new Blob([inferenceObservationCsv(snapshot, example.sourceDigest)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `bm07-synthetic-observations-${p.seed}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const field = (key: keyof InferenceDraft, label: string) => (
    <div className="input-field">
      <label key={key} htmlFor={`${id}-${key}`}>
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        name={key}
        type="text"
        inputMode={key === "seed" || key === "M" ? "numeric" : "decimal"}
        aria-describedby={key === "seed" ? `${id}-seed-help` : undefined}
        value={draft[key]}
        onChange={(e) => edit(key, e.target.value)}
      />
      {key === "seed" ? <SeedHelp id={`${id}-seed-help`} replays="synthetic data" /> : null}
    </div>
  );
  const intervalKind =
    p.intervalKind === "conditional"
      ? "Conditional on exact input values"
      : "Combined declared input intervals · conservative";
  const announcement = view.pending
    ? "Calculating the request. All displayed observations and estimates still belong to the accepted settings."
    : view.status === "refused"
      ? `${view.refusal?.message ?? "Request was refused."} Accepted data remain unchanged.`
      : view.status === "unavailable"
        ? `${view.outcome?.message ?? "Calculation unavailable."} The accepted data remain readable.`
        : view.status === "paused"
          ? "Calculation stopped. The accepted data remain unchanged."
          : isStatic
            ? "Static worked example. No calculation has been started in this browser."
            : `Accepted ${p.M} non-overlapping displacements in ${p.d} coordinates. ${p.radiusKnown ? "An independent radius is declared." : "Molecular number is not separately identified."}`;
  const times = array(snapshot, "observationTimes"),
    positions = array(snapshot, "observationPositions"),
    increments = array(snapshot, "observationIncrements");
  return (
    <section
      className="laboratory inference-lab"
      aria-labelledby={`${id}-title`}
      data-instrument-id="bm-07"
      {...identity(snapshot)}
      {...instrumentRootAttributes(view)}
      {...executionLabelAttributes(executionKind)}
      data-radius-known={String(p.radiusKnown)}
      data-estimator={p.estimator}
      data-observation-set={p.observationSet}
      data-semantic-kind="synthetic-recovery"
      data-recording-draws={scalar(snapshot, "recordingDraws")}
      data-request-draws={scalar(snapshot, "requestDraws")}
      data-coverage-draws={scalar(snapshot, "coverageDraws")}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">The inverse problem</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <span className="badge">
          {executionKind === "host-accepted"
            ? "Synthetic recovery · host calculation"
            : executionLabelFor(executionKind).text}
        </span>
      </header>
      <noscript>
        <p className="notice">
          JavaScript is off. The calculated example, observations, compatible family and explanation
          remain readable. Changing settings or revealing the generating parameter requires
          JavaScript.
        </p>
      </noscript>
      <PredictGatePanels gate={gate} />
      {/* After the prediction, still directly above the data it describes (dispatch 268). Above the
          prediction it put the instrument 624px down at 1440. */}
      <p>
        These positions were generated with a hidden molecular number. First ask what the
        observations identify. Then declare the missing information, estimate the number, and test
        what a confidence interval does across hypothetical repeats.
      </p>
      <div className="lab-columns">
        <div>
          <form className="inference-controls" onSubmit={submit} noValidate>
            <fieldset disabled={!ready}>
              <legend>Observation set</legend>
              <div className="input-field">
                <label htmlFor={`${id}-observationSet`}>Which displacements</label>
                <select
                  id={`${id}-observationSet`}
                  name="observationSet"
                  value={draft.observationSet}
                  onChange={(e) => edit("observationSet", e.target.value)}
                >
                  <option value="synthetic">Synthetic inverse exercise (hidden N)</option>
                  <option value="perrin-1909">Perrin 1909 historical dataset</option>
                  <option value="kitchen">Kitchen classroom CSV (handed off)</option>
                </select>
              </div>
              <p className="fine">
                The synthetic set checks inference machinery on data made with a hidden number. It
                is not evidence that molecules exist. Perrin 1909 waits on the admitted
                HistoricalDataset; this instrument will not invent table numbers. Kitchen CSV is
                analyzed by the existing kitchen session; this laboratory consumes that session and
                does not re-parse video.
              </p>
            </fieldset>
            <fieldset disabled={!ready}>
              <legend>1 · Observe the same path</legend>
              <div className="input-grid">
                {field("M", "Non-overlapping displacements (1–1000)")}
                {field("dt", "Observation spacing (s; multiples of 0.25)")}
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
                <div className="input-field">
                  <label className="wide" htmlFor={`${id}-estimator`}>
                    Estimator
                  </label>
                  <select
                    id={`${id}-estimator`}
                    name="estimator"
                    value={draft.estimator}
                    onChange={(e) => edit("estimator", e.target.value)}
                  >
                    {Object.entries(estimatorNames).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="fine">
                The fixed recording lasts 1024 seconds. Spacing, coordinate count, sample count and
                estimator changes reuse it. No overlapping windows, localization noise, exposure
                blur or censoring are admitted by these intervals.
              </p>
            </fieldset>
            <fieldset disabled={!ready}>
              <legend>2 · Declare inference inputs</legend>
              <label className="check" htmlFor={`${id}-radiusKnown`}>
                <input
                  id={`${id}-radiusKnown`}
                  name="radiusKnown"
                  type="checkbox"
                  checked={draft.radiusKnown === "true"}
                  onChange={(e) => edit("radiusKnown", String(e.target.checked))}
                />
                An independent particle radius is available
              </label>
              <div className="input-grid">
                {field("a", "Assumed particle radius (μm)")}
                {field("T", "Assumed temperature (K)")}
                {field("eta", "Assumed dynamic viscosity (mPa s)")}
                {field("coverage", "Target interval coverage (%)")}
              </div>
              <p className="fine">
                These are inference assumptions, not generator controls. Changing them never moves a
                recorded position. A radius derived from these same displacements using an assumed
                molecular number would be circular, not independent information.
              </p>
              <div className="input-field">
                <label htmlFor={`${id}-intervalKind`}>Molecular-number interval</label>
                <select
                  id={`${id}-intervalKind`}
                  name="intervalKind"
                  value={draft.intervalKind}
                  onChange={(e) => edit("intervalKind", e.target.value)}
                >
                  <option value="conditional">Conditional: inputs held exact</option>
                  <option value="combined">Combined: declared input intervals</option>
                </select>
              </div>
              <details className="experiment-settings">
                <summary>Declare input uncertainty</summary>
                <p className="fine">
                  Each input interval is its stated value plus or minus the relative bound below.
                  Its declared coverage must describe a valid measurement procedure. Bounds alone
                  are not confidence intervals. Calibration, timing and the chosen gas constant
                  remain exact in this exercise.
                </p>
                <div className="input-grid">
                  {field("temperatureError", "Temperature relative bound (%)")}
                  {field("viscosityError", "Viscosity relative bound (%)")}
                  {field("radiusError", "Radius relative bound (%)")}
                  {field("inputCoverage", "Coverage of each input interval (%; 0 = undeclared)")}
                </div>
                <p className="fine">
                  The combined procedure allocates the remaining error probability to the diffusion
                  interval and uses a union bound. It requires no independence between the three
                  input intervals, but cannot create a coverage guarantee from undeclared coverage.
                </p>
              </details>
            </fieldset>
            <fieldset disabled={!ready}>
              <legend>3 · Apply the request</legend>
              <div className="actions">
                <button type="submit">Apply inference settings</button>
                <button
                  className="secondary"
                  type="button"
                  disabled={!view.pending}
                  onClick={() => session.stop()}
                >
                  Stop calculation
                </button>
              </div>
              <details className="experiment-settings">
                <summary>Change the synthetic generator</summary>
                <p className="fine">
                  Changing these fields starts a new physical run. The hidden molecular number is
                  drawn on a separate stream from 3 × 10²³ to 1.2 × 10²⁴ mol⁻¹. The generator uses
                  the explicitly chosen R = 8.314471 J/(mol K), not a modern Boltzmann constant that
                  would preselect the answer.
                </p>
                <div className="input-grid">
                  {field("seed", "Trial seed")}
                  {field("generatorT", "Generator temperature (K)")}
                  {field("generatorEta", "Generator viscosity (mPa s)")}
                  {field("generatorRadius", "Generator radius (μm)")}
                </div>
              </details>
            </fieldset>
          </form>
          {dirty && (
            <p className="draft-note">
              These edits are a draft. The displayed observations and estimates still describe the
              accepted settings.
            </p>
          )}
          {error && (
            <p className="notice error" role="alert">
              {error} {KEPT_RESULT}
            </p>
          )}
          <div className="actions">
            <button
              type="button"
              disabled={!ready}
              className="secondary"
              onClick={() =>
                apply({
                  ...p,
                  T: p.generatorT,
                  eta: p.generatorEta,
                  a: p.generatorRadius,
                  radiusKnown: true,
                  coverageTrials: 0,
                })
              }
            >
              Use declared generator conditions
            </button>
            <button
              type="button"
              disabled={!ready || !p.radiusKnown}
              className="secondary"
              onClick={() => apply({ ...p, a: p.a * 2 })}
            >
              Assume twice the radius · same data
            </button>
            <button
              type="button"
              disabled={!ready}
              className="secondary"
              onClick={() => apply({ ...p, radiusKnown: false, coverageTrials: 0 })}
            >
              Return to the unidentified family
            </button>
          </div>
          <p className="fine">
            These comparison buttons use accepted settings, not draft edits. “Use declared generator
            conditions” supplies the known setup of this synthetic exercise; it is not a real
            independent measurement.
          </p>
          <div className="actions">
            <button type="button" disabled={!ready} className="secondary" onClick={newTrial}>
              New independent trial
            </button>
            <button
              type="button"
              disabled={!ready}
              className="secondary"
              onClick={exportObservations}
            >
              Download accepted observations
            </button>
          </div>
          {note && <p className="notice">{note}</p>}
          <LabTapeLink link={withPredictions(tapeLink, gate)} />
          <p className="fine">
            The CSV contains every selected position and displacement in SI units with generator
            metadata. It contains synthetic data, not observations of a real suspension. Opening a
            shared link starts no worker.
          </p>
        </div>
        <div className="lab-results inference-results" {...gate.response}>
          {view.refusal && (
            <div className="notice error">
              <p>
                {String(view.refusal.details?.requirements ?? view.refusal.message)} {KEPT_RESULT}
              </p>
              {view.refusal.rankedRepairs.map((repair) => {
                const action = repair.action;
                if (!action) return null;
                return (
                  <button
                    key={`${repair.label}-${action.parameterId}`}
                    type="button"
                    className="secondary"
                    onClick={() => {
                      const baseParams = (view.requested?.parameters ?? p) as Bm07Parameters;
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
              <button type="button" className="secondary" onClick={() => apply(p)}>
                Restore accepted settings
              </button>
            </div>
          )}
          <InferencePath snapshot={snapshot} />
          <p
            className="status-line inference-status"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {announcement}
          </p>
          <p className="accepted-caption">
            Accepted seed {p.seed}; {p.M} non-overlapping displacements; {p.d} coordinate
            {p.d === 1 ? "" : "s"}; spacing {display(p.dt)} s. {estimatorNames[p.estimator]}.
            Assumed T = {display(p.T)} K, η = {display(p.eta, 1e3)} mPa s;{" "}
            {p.radiusKnown
              ? `declared radius ${display(p.a, 1e6)} μm`
              : "independent radius not declared"}
            .
          </p>
          <h3>What the data identify</h3>
          <table className="inference-summary">
            <caption>Accepted estimate and conditional diffusion uncertainty</caption>
            <tbody>
              <tr>
                <th scope="row">Estimated D (μm²/s)</th>
                <td>
                  <InferenceValue
                    snapshot={snapshot}
                    id="diffusionCoefficientEstimate"
                    factor={1e12}
                  />
                </td>
              </tr>
              <tr>
                <th scope="row">{display(p.coverage, 100)}% diffusion interval (μm²/s)</th>
                <td>
                  <InferenceInterval snapshot={snapshot} id="diffusionInterval" factor={1e12} />
                </td>
              </tr>
              <tr>
                <th scope="row">Degrees of freedom</th>
                <td>
                  <InferenceValue snapshot={snapshot} id="degreesOfFreedom" />
                </td>
              </tr>
              <tr>
                <th scope="row">Compatible radius × number (m/mol)</th>
                <td>
                  <InferenceValue snapshot={snapshot} id="radiusNumberProduct" />
                </td>
              </tr>
            </tbody>
          </table>
          <section className="inference-family">
            <h3>A family before a single number</h3>
            <p>
              At the assumed temperature and viscosity, the estimated diffusion scale constrains a
              product: radius times molecular number. A larger radius and a smaller number can fit
              exactly the same point estimate.
            </p>
            <InferenceFamily snapshot={snapshot} />
          </section>
          <p className="notice" data-semantic-kind="synthetic-recovery">
            {BM07_SEMANTIC_KIND_TEXT["synthetic-recovery"]}
          </p>
          <h3>Condition on the missing information</h3>
          <table className="inference-summary">
            <caption>
              {intervalKind}; target {display(p.coverage, 100)}%
            </caption>
            <tbody>
              <tr>
                <th scope="row">Recovered N (10²³ mol⁻¹)</th>
                <td>
                  <InferenceValue snapshot={snapshot} id="avogadroNumberEstimate" factor={1e-23} />
                </td>
              </tr>
              <tr>
                <th scope="row">Selected interval (10²³ mol⁻¹)</th>
                <td>
                  <InferenceInterval snapshot={snapshot} id="molecularInterval" factor={1e-23} />
                </td>
              </tr>
              {p.intervalKind === "combined" && (
                <tr>
                  <th scope="row">Conditional comparison (10²³ mol⁻¹)</th>
                  <td>
                    <InferenceInterval
                      snapshot={snapshot}
                      id="conditionalInterval"
                      factor={1e-23}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="fine">
            This is recovery of a synthetic generating parameter, not a measurement of the modern
            Avogadro constant. The inverted bounds exchange endpoints. A finite confidence interval
            is not a posterior probability assigned to this one fixed parameter.
          </p>
          <details>
            <summary>Estimator bias and small-sample limits</summary>
            <p>
              The known-zero-drift estimate uses every coordinate without subtracting a fitted mean.
              Fitting a separate drift in each coordinate consumes degrees of freedom. The centered
              maximum-likelihood estimate divides by the original sample count; the unbiased version
              uses one fewer. Both use the same correctly rescaled confidence interval.
            </p>
            <table className="inference-summary">
              <caption>Expected ratios under the ideal model with correct input values</caption>
              <tbody>
                <tr>
                  <th scope="row">Mean estimated D / true D</th>
                  <td>
                    <InferenceValue snapshot={snapshot} id="diffusionBiasFactor" />
                  </td>
                </tr>
                <tr>
                  <th scope="row">Mean recovered N / true N</th>
                  <td>
                    <InferenceValue snapshot={snapshot} id="inverseBiasFactor" />
                  </td>
                </tr>
                <tr>
                  <th scope="row">Variance of recovered N / true N</th>
                  <td>
                    <InferenceValue snapshot={snapshot} id="inverseVarianceFactor" />
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="fine">
              An unbiased diffusion estimate does not have an unbiased reciprocal. With too few
              degrees of freedom, the reciprocal’s mean or variance does not exist even though a
              particular trial can produce a finite estimate. With one displacement and fitted
              drift, spread is underdetermined.
            </p>
          </details>
          <div className="inference-reveal">
            <button
              type="button"
              disabled={!ready}
              className="secondary"
              onClick={() => setRevealedRun(revealed ? null : snapshot.runId)}
            >
              {revealed ? "Hide generating values" : "Reveal generating values"}
            </button>
            {revealed && (
              <p data-hidden-answer>
                Generating N:{" "}
                <InferenceValue snapshot={snapshot} id="generatorMolecularNumber" factor={1e-23} />{" "}
                × 10²³ mol⁻¹. Generating D:{" "}
                <InferenceValue
                  snapshot={snapshot}
                  id="generatorDiffusionCoefficient"
                  factor={1e12}
                />{" "}
                μm²/s. Revealing these values does not redraw or refit anything.
              </p>
            )}
            <p className="fine">
              The hidden answer is a learning device, not a secret: the generated browser data can
              be inspected.
            </p>
          </div>
          <details>
            <summary>Inspect the accepted observations</summary>
            <div className="table-scroll">
              <table>
                <caption>All selected synthetic positions and increments; μm and seconds</caption>
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    {Array.from({ length: p.d }, (_, c) => {
                      const coord = c === 0 ? "x" : "y";
                      return (
                        <th key={`pos-header-${coord}`} scope="col">
                          {coord} (μm)
                        </th>
                      );
                    })}
                    {Array.from({ length: p.d }, (_, c) => {
                      const coord = c === 0 ? "x" : "y";
                      return (
                        <th key={`delta-header-${coord}`} scope="col">
                          Δ{coord} (μm)
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: times.length }, (_, i) => {
                    const t = times.at(i);
                    return (
                      <tr key={`time-row-${t}`}>
                        <th scope="row">{display(t)}</th>
                        {Array.from({ length: p.d }, (_, c) => {
                          const coord = c === 0 ? "x" : "y";
                          const pos = positions.at(i * p.d + c);
                          return (
                            <td key={`pos-${coord}`}>
                              {pos !== undefined ? display(pos, 1e6) : ""}
                            </td>
                          );
                        })}
                        {Array.from({ length: p.d }, (_, c) => {
                          const coord = c === 0 ? "x" : "y";
                          const inc = i === 0 ? undefined : increments.at((i - 1) * p.d + c);
                          return (
                            <td key={`delta-${coord}`}>
                              {inc !== undefined ? display(inc, 1e6) : ""}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </div>
      <section className="grid-result inference-results">
        <h3>What does coverage mean?</h3>
        <p>
          Repeat the observation procedure on other hypothetical paths with the same generating
          parameter. Each interval moves; the parameter does not. Change an inference assumption
          while keeping those paths to see how a wrong radius can spoil molecular-number coverage
          even when diffusion intervals behave well.
        </p>
        <div className="actions">
          <button
            type="button"
            disabled={
              !ready ||
              view.pending ||
              p.intervalKind !== "conditional" ||
              result(snapshot, "diffusionCoefficientEstimate").status !== "value"
            }
            onClick={() => apply({ ...p, coverageTrials: 100 })}
          >
            Run 100 hypothetical experiments
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!ready || p.coverageTrials === 0}
            onClick={() => apply({ ...p, coverageTrials: 0 })}
          >
            Hide repeated-trial results
          </button>
        </div>
        <p className="fine">
          Uses the accepted settings. No seed search, discarded failures or redraws to reach the
          target fraction. In combined-input mode this view is unavailable: no repeated
          input-measurement procedure has been specified. After a form edit, run coverage explicitly
          again.
        </p>
        <div className="inference-coverage-grid">
          <div>
            <h3>Diffusivity procedure</h3>
            <InferenceCoverage snapshot={snapshot} />
          </div>
          <div>
            <h3>Molecular-number procedure</h3>
            <InferenceCoverage snapshot={snapshot} molecular />
          </div>
        </div>
      </section>
      <section className="action-contract">
        <h3>Same scientific action without the plot</h3>
        <p>
          Choose the observation set, estimator, and interval kind from the lists. Type the
          displacement count M and the inference temperature, viscosity, and radius. Read the table
          of estimated D and its interval, then N and its interval with the wording above, the
          inverse-bias note, and the identifiability family. The plots are a view of that same
          accepted snapshot.
        </p>
      </section>
      <p className="not-modeled">
        Not modeled: localization error, blur, correlated or irregularly timed increments, and
        censoring (see the camera laboratory and kitchen mode); non-Gaussian increments;
        time-varying drift; polydispersity within one track set; wall effects; uncertainty in C
        without declared coverages; uncertainty in the gas constant itself.
      </p>
      <details className="inference-provenance">
        <summary>Accepted calculation identity and limits</summary>
        <p className="fine">
          Computed by the host reference evaluator <code>inference.bm07</code>, for the scenario{" "}
          <code>scenario-bm07-hidden-number</code>.
        </p>
        <p className="fine">
          Primary recording draws: <InferenceValue snapshot={snapshot} id="recordingDraws" />. Work
          for this request: <InferenceValue snapshot={snapshot} id="requestDraws" /> draws,
          including <InferenceValue snapshot={snapshot} id="coverageDraws" /> for hypothetical
          experiments. Retained primary recording:{" "}
          <InferenceValue snapshot={snapshot} id="retainedBytes" /> bytes. Reused worker recording:{" "}
          {scalar(snapshot, "reusedRecording") === 1 ? "yes" : "no"}.
        </p>
        <p className="fine">
          Source identity: <code>{example.sourceDigest}</code>. This host preview has no historical
          data importer or camera-noise fit. Browser arithmetic is not a claim of strict
          cross-engine WASM replay.
        </p>
      </details>

      {/* The four readings follow the reader's detail setting, as on every other laboratory: direct
          children of the lab root, which labShell.css's detail rules select. */}
      {readings && (
        <>
          <p data-detail="0">{withScripts(BM07_CAPTION.r0)}</p>
          <p data-detail="1">{withScripts(BM07_CAPTION.r1)}</p>
          <p data-detail="2" hidden>
            {withScripts(BM07_CAPTION.r2)}
          </p>
          <p data-detail="3" hidden>
            {withScripts(BM07_CAPTION.r3)}
          </p>
        </>
      )}
    </section>
  );
}
export function InferenceComparison({ example }: { example: PreparedBm07Example }) {
  const [second, setSecond] = useState(false),
    [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <>
      <InferenceLab example={example} />
      <div className="comparison-toggle">
        <button
          type="button"
          className="secondary"
          disabled={!ready}
          onClick={() => setSecond(!second)}
        >
          {second
            ? "Close second inference laboratory"
            : "Open a second independent inference laboratory"}
        </button>
        <p className="fine">
          Each placement has separate settings and worker ownership. The same seed initially
          reproduces the same synthetic data; choose a different seed for an independent trial.
        </p>
      </div>
      {second && (
        <InferenceLab
          example={example}
          title="A separately controlled inference"
          readings={false}
        />
      )}
    </>
  );
}
