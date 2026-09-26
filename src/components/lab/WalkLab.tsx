"use client";
import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { getKernelListingsForInstrument } from "../../content/kernel/listings.ts";
import { createBm05BrowserChannel } from "../../experiments/bm05/browser.ts";
import { BM05_FIELDS, fromWalkDraft, toWalkDraft } from "../../experiments/bm05/controls.ts";
import {
  BM05_CAPTION,
  BM05_OUTPUTS,
  type Bm05Parameters,
} from "../../experiments/bm05/definition.ts";
import { BM05_DRAFT_TAPE } from "../../experiments/bm05/draftTape.ts";
import { decodeBm05Settings } from "../../experiments/bm05/permalink.ts";
import { createBm05Session, type PreparedBm05Example } from "../../experiments/bm05/session.ts";
import { walkExecutionKind } from "../../experiments/bm05/walkExecution.ts";
import { ExecutionChrome } from "../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../experiments/labels/executionLabelFor.ts";
import { modelNoteFromView } from "../../experiments/labels/modelNoteData.ts";
import { labelRootAttributes } from "../../experiments/labels/resultAttributes.ts";
import { LabTapeLink, useDraftTapeLink } from "../../experiments/permalink/LabTapeLink.tsx";
import { deriveHostExecution } from "../../experiments/provenance/executionState.ts";
import { FRANKENSIM_NORMALS_ENGINE_SENTENCE } from "../../experiments/provenance/pinnedFrankenSim.ts";
import { instrumentRootAttributes } from "../../experiments/store/identityAttributes.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { PREDICT_PROMPTS } from "../../generated/predict-prompts.ts";
import { ExperimentSettings } from "./ExperimentSettings.tsx";
import { KEPT_RESULT } from "./keptResult.ts";
import { PredictGatePanels, usePredictGate, withPredictions } from "./PredictGate.tsx";
import { array, display, identity, result, scalar } from "./presentation.ts";
import { SeedHelp } from "./SeedHelp.tsx";
import { ShowTheCode } from "./ShowTheCode.tsx";
import { withScripts } from "./subscripts.tsx";
import { WalkConvergence, WalkHistogram, WalkPaths } from "./WalkPlots.tsx";

const names = {
  coin: "Equal left/right jumps",
  uniform: "Uniform steps",
  gaussian: "Gaussian steps",
};
function Reading({
  snapshot,
  id,
  factor = 1,
}: {
  snapshot: AcceptedSnapshot;
  id: string;
  factor?: number;
}) {
  const r = result(snapshot, id);
  if (r.status === "value" && typeof r.value === "number")
    return (
      <span data-quantity-id={id} data-value={r.value}>
        {display(r.value, factor)}
      </span>
    );
  return (
    <span data-quantity-id={id}>
      {r.status === "not-applicable" || r.status === "outside-domain"
        ? r.reason
        : "This quantity has no numerical value for this question."}
    </span>
  );
}
// The manifest's prompt (scripts/generate-predict-prompts.mjs), one stable array for the gate. It
// replaces the lab's use of BM05_PROMPT, which bm05Manifest.test still compares with the manifest.
const BM05_PROMPTS = PREDICT_PROMPTS["bm-05"] ?? [];

export function WalkLab({
  example,
  title = "From random steps to diffusion",
  readings = true,
}: {
  example: PreparedBm05Example;
  title?: string;
  /** False for the optional second laboratory, so the page carries the caption readings once. */
  readings?: boolean;
}) {
  const id = useId(),
    [session] = useState(() => createBm05Session(`bm05-${id}`, example, createBm05BrowserChannel));
  const serverAccepted = session.getServerSnapshot().accepted;
  if (!serverAccepted) {
    throw new Error("Missing accepted walk snapshot");
  }
  const view = useSyncExternalStore(
      session.subscribe,
      session.getSnapshot,
      session.getServerSnapshot,
    ),
    snapshot = view.accepted ?? serverAccepted,
    p = snapshot.parameters as Bm05Parameters;
  // Earned per snapshot (am-inst-execution-labels-5ywv): the build-time worked example every reader
  // first sees is a static worked example; only an accepted recalculation is a host calculation.
  const hostKind = executionStateKindFromHostLabel(
    deriveHostExecution(view, BM05_OUTPUTS, example.sourceDigest, snapshot === serverAccepted)
      .label,
  );
  // FrankenSim only when this snapshot's walk was drawn by it (walkExecution.ts): the module being
  // loaded earns nothing, and a coin or uniform walk draws no normals.
  const drawnByFrankenSim =
    hostKind === "host-accepted" &&
    walkExecutionKind(snapshot.outputs, false) === "frankensim-accepted";
  const executionKind = drawnByFrankenSim ? "frankensim-accepted" : hostKind;
  const [draft, setDraft] = useState(() => toWalkDraft(example.parameters)),
    [ready, setReady] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState("");
  // Predict mode (am-inst-predict-mode-ti7m): the result waits for the reader's answer.
  const gate = usePredictGate("bm-05", BM05_PROMPTS);
  // A shared ?tape= link puts its settings in the form and starts no worker; Apply runs them.
  const tapeLink = useDraftTapeLink(BM05_DRAFT_TAPE, p, true, (settings) => {
    setDraft(toWalkDraft(settings as unknown as Bm05Parameters));
    setDirty(true);
  });
  useEffect(() => {
    setReady(true);
    const shared = decodeBm05Settings(window.location.search);
    if (shared.kind === "settings") {
      setDraft(toWalkDraft(shared.parameters));
      setDirty(true);
      setNote(
        "Shared settings are loaded as a draft. The worked example remains displayed until you apply them.",
      );
    } else if (shared.kind === "invalid") setNote(shared.message);
    return () => session.disconnect();
  }, [session]);
  function apply(settings: Bm05Parameters) {
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
    setDraft(toWalkDraft(settings));
    setDirty(false);
    setError("");
    setNote("");
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      apply(fromWalkDraft(draft));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check the settings.");
    }
  }
  function newTrial() {
    try {
      const words = crypto.getRandomValues(new Uint32Array(2));
      const high = words[0] ?? 0;
      const low = words[1] ?? 0;
      apply({ ...p, seed: ((BigInt(high) << 32n) | BigInt(low)).toString() });
    } catch {
      setError(
        "A new random seed is unavailable on this device. Enter a different seed explicitly.",
      );
    }
  }
  const announcement = view.pending
    ? "Recording or re-observing the requested trial. Accepted results stay on screen until it is done."
    : view.status === "refused"
      ? `${view.refusal?.message ?? "The calculation was refused."} The accepted trial is unchanged.`
      : view.status === "unavailable"
        ? `${view.outcome?.message ?? "The calculation is unavailable."} The accepted example remains readable.`
        : view.status === "paused"
          ? "Calculation stopped. The accepted trial is unchanged."
          : `Accepted ${names[p.kernel]}: ${p.walkers} walkers after ${p.n} steps, model mean square ${display(scalar(snapshot, "modelMeanSquare"), 1e12)} square micrometres.`;
  const bins = array(snapshot, "histogramCounts"),
    edges = array(snapshot, "histogramEdges"),
    exact = array(snapshot, "histogramExact"),
    gaussian = array(snapshot, "histogramGaussian");
  const intervals = array(snapshot, "continuumIntervals"),
    fixed = array(snapshot, "fixedStepCoefficients"),
    scales = array(snapshot, "fixedRatioSteps"),
    ratios = array(snapshot, "fixedRatioCoefficients");
  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="bm-05"
      {...identity(snapshot)}
      data-input-revision={view.requested?.revisions.input ?? snapshot.revisions.input}
      data-accepted-input-revision={snapshot.revisions.input}
      data-pending={String(view.pending)}
      {...instrumentRootAttributes(view)}
      {...labelRootAttributes(executionKind, view, "sampleRms")}
      data-selected-step={p.n}
      data-kernel={p.kernel}
      data-recording-draws={scalar(snapshot, "recordingDraws")}
      data-request-draws={scalar(snapshot, "requestDraws")}
      data-replayed-draws={scalar(snapshot, "replayedDraws")}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">The independent-step argument</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
      </header>
      <noscript>
        <p className="notice">
          JavaScript is off. This seeded worked example includes the traces, exact four-step
          probabilities and comparison tables. Changing the settings requires JavaScript.
        </p>
      </noscript>
      <p>
        A coin gives only two possible next steps; a uniform law fills an interval; a Gaussian law
        has tails. Keep their step variance equal, and ask what survives after many independent
        steps.
      </p>
      <PredictGatePanels gate={gate} />
      <div className="lab-columns">
        <div>
          <form onSubmit={submit} noValidate>
            <fieldset disabled={!ready}>
              <legend>Choose a step law and observe</legend>
              <div className="input-grid">
                <div className="input-field">
                  <label htmlFor={`${id}-kernel`}>Step law</label>
                  <select
                    id={`${id}-kernel`}
                    name="kernel"
                    value={draft.kernel}
                    onChange={(e) => {
                      setDraft({ ...draft, kernel: e.target.value });
                      setDirty(true);
                    }}
                  >
                    {Object.entries(names).map(([key, name]) => (
                      <option key={key} value={key}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-field">
                  <label htmlFor={`${id}-n`}>Observe after (whole steps)</label>
                  <input
                    id={`${id}-n`}
                    name="n"
                    type="text"
                    inputMode="numeric"
                    value={draft.n}
                    onChange={(e) => {
                      setDraft({ ...draft, n: e.target.value });
                      setDirty(true);
                    }}
                  />
                </div>
              </div>
              <ExperimentSettings contents="step size, timing, walkers, recorded steps, seed, bias example">
                <div className="input-grid">
                  {BM05_FIELDS.map(([key, label, unit]) => (
                    <div className="input-field" key={key}>
                      <label htmlFor={`${id}-${key}`}>
                        {label} <span>({unit})</span>
                      </label>
                      <input
                        id={`${id}-${key}`}
                        name={key}
                        type="text"
                        inputMode="decimal"
                        value={draft[key]}
                        onChange={(e) => {
                          setDraft({ ...draft, [key]: e.target.value });
                          setDirty(true);
                        }}
                      />
                    </div>
                  ))}
                  <div className="input-field">
                    <label htmlFor={`${id}-seed`}>Trial seed</label>
                    <input
                      id={`${id}-seed`}
                      name="seed"
                      aria-describedby={`${id}-seed-help`}
                      type="text"
                      inputMode="numeric"
                      value={draft.seed}
                      onChange={(e) => {
                        setDraft({ ...draft, seed: e.target.value });
                        setDirty(true);
                      }}
                    />
                    <SeedHelp id={`${id}-seed-help`} />
                  </div>
                  <div className="input-field">
                    <label htmlFor={`${id}-bias`}>
                      Right-step probability in the separate bias example
                    </label>
                    <input
                      id={`${id}-bias`}
                      name="bias"
                      type="text"
                      inputMode="decimal"
                      value={draft.bias}
                      onChange={(e) => {
                        setDraft({ ...draft, bias: e.target.value });
                        setDirty(true);
                      }}
                    />
                  </div>
                </div>
                <p className="fine">
                  All three sampled laws have the stated step RMS. The bias example below is
                  analytical only and does not change the recorded walk. The uniform finite-step
                  comparison admits at most 400 observed steps.
                </p>
              </ExperimentSettings>
              <div className="actions">
                <button type="submit">Apply walk settings</button>
                <button
                  type="button"
                  className="secondary"
                  disabled={!view.pending}
                  onClick={() => session.stop()}
                >
                  Stop calculation
                </button>
              </div>
            </fieldset>
          </form>
          {dirty && (
            <p className="draft-note">
              These edits are a draft. The graph and numbers still describe the accepted trial.
            </p>
          )}
          {error && (
            <p className="notice error" role="alert">
              {error} {KEPT_RESULT}
            </p>
          )}
          <div className="actions">
            {[4, 16, 64, 400].map((n) => (
              <button
                key={n}
                type="button"
                className="secondary"
                disabled={!ready || n > p.runSteps}
                onClick={() => apply({ ...p, n })}
              >
                Observe {n} steps
              </button>
            ))}
          </div>
          <p className="fine">
            Observation buttons use the accepted setup, not unsubmitted draft edits. They return to
            the same trial, not a fresh sample.
          </p>
          <div className="actions">
            <button type="button" className="secondary" disabled={!ready} onClick={newTrial}>
              New independent trial
            </button>
          </div>
          {note && <p className="notice">{note}</p>}
          <LabTapeLink link={withPredictions(tapeLink, gate)} />
          <p className="fine">
            Keeping a seed across step-law changes is a reproducible comparison, not a claim of
            independent trials. Shared links load settings only; they never start a calculation.
          </p>
        </div>
        <div className="lab-results" {...gate.response}>
          {view.outcome?.outcome === "budget-exhausted" && (
            <div className="notice error">
              <p>
                {typeof view.outcome.details?.reason === "string"
                  ? view.outcome.details.reason
                  : "Reduce the walker count or recorded steps. This preview never silently reduces a trial."}
              </p>
              <button type="button" className="secondary" onClick={() => apply(p)}>
                Restore accepted settings
              </button>
            </div>
          )}
          {view.refusal && (
            <div className="notice error">
              <p>{view.refusal.message}</p>
              <button type="button" className="secondary" onClick={() => apply(p)}>
                Restore accepted settings
              </button>
            </div>
          )}
          <WalkHistogram snapshot={snapshot} />
          <table {...identity(snapshot)}>
            <caption>Step law and whole-ensemble spread</caption>
            <thead>
              <tr>
                <th scope="col">Quantity</th>
                <th scope="col">Accepted value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Step variance (μm²)</th>
                <td>
                  <Reading snapshot={snapshot} id="stepSecondMoment" factor={1e12} />
                </td>
              </tr>
              <tr>
                <th scope="row">Step fourth moment (μm⁴)</th>
                <td>
                  <Reading snapshot={snapshot} id="stepFourthMoment" factor={1e24} />
                </td>
              </tr>
              <tr>
                <th scope="row">Diffusion coefficient (μm²/s)</th>
                <td>
                  <Reading snapshot={snapshot} id="diffusionCoefficient" factor={1e12} />
                </td>
              </tr>
              <tr>
                <th scope="row">Sample signed mean (μm)</th>
                <td>
                  <Reading snapshot={snapshot} id="sampleMean" factor={1e6} />
                </td>
              </tr>
              <tr>
                <th scope="row">Sample mean square (μm²)</th>
                <td>
                  <Reading snapshot={snapshot} id="sampleMeanSquare" factor={1e12} />
                </td>
              </tr>
              <tr>
                <th scope="row">Model mean square (μm²)</th>
                <td>
                  <Reading snapshot={snapshot} id="modelMeanSquare" factor={1e12} />
                </td>
              </tr>
              <tr>
                <th scope="row">Model RMS displacement (μm)</th>
                <td>
                  <Reading snapshot={snapshot} id="modelRms" factor={1e6} />
                </td>
              </tr>
            </tbody>
          </table>
          <div className="lab-status-row">
            <ExecutionChrome
              state={executionKind}
              view={view}
              modelNote={modelNoteFromView(view, {
                notModeled: "A continuous Langevin path; only independent steps of a chosen law.",
                showTheCodeHref: `#stc-${id}`,
              })}
            />
          </div>
          <p className="status-line" role="status" aria-live="polite" aria-atomic="true">
            {announcement}
          </p>
          <p className="accepted-caption">
            Accepted trial: {names[p.kernel]}; seed {p.seed}; {p.walkers} walkers; step RMS{" "}
            {display(p.stepRms, 1e6)} μm; interval {display(p.tau)} s. Observed after {p.n} of{" "}
            {p.runSteps} recorded steps. Elapsed time:{" "}
            <Reading snapshot={snapshot} id="elapsedTime" /> s.
          </p>
          <h3>Two reasons the histogram is not a perfect bell</h3>
          {p.n === 0 ? (
            <p className="notice">
              Before any steps, all walkers are at zero. There is no finite-width Gaussian or
              standardized shape comparison.
            </p>
          ) : (
            <>
              <p>
                For coin and uniform steps, a finite number of steps leaves a{" "}
                <strong>shape gap</strong>, even with infinitely many walkers. Gaussian steps are
                the exception: their sums are Gaussian already. A finite number of walkers adds{" "}
                <strong>sampling variation</strong>. Neither is hidden by renormalizing the
                histogram.
              </p>
              <table {...identity(snapshot)}>
                <caption>Largest cumulative-probability gap, not a visual fit score</caption>
                <tbody>
                  <tr>
                    <th scope="row">Sample-to-Gaussian gap</th>
                    <td>
                      <Reading snapshot={snapshot} id="kolmogorovDistance" />
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Finite-step shape gap</th>
                    <td>
                      <Reading snapshot={snapshot} id="shapeTerm" />
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Sampling allowance</th>
                    <td>
                      <Reading snapshot={snapshot} id="samplingTerm" />
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Shape plus sampling allowance</th>
                    <td>
                      <Reading snapshot={snapshot} id="agreementBound" />
                    </td>
                  </tr>
                </tbody>
              </table>
              <p>
                {scalar(snapshot, "withinBound") === 1
                  ? "This sample is within the declared shape-plus-sampling allowance."
                  : "This sample lies outside the declared shape-plus-sampling allowance; the result is retained, not redrawn."}{" "}
                The sampling allowance has 99.9% coverage for one prespecified comparison under the
                model, not simultaneous coverage over every trial or observation.
              </p>
            </>
          )}
          {p.kernel === "coin" && p.n <= 16 && (
            <details open>
              <summary>Exact coin probabilities after {p.n} steps</summary>
              <table>
                <caption>
                  Binomial counts out of {scalar(snapshot, "coinDenominator")} equally likely paths
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Displacement (μm)</th>
                    <th scope="col">Exact fraction</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: array(snapshot, "coinPositions").length }, (_, i) => {
                    const pos = array(snapshot, "coinPositions").at(i);
                    return (
                      <tr key={`coin-pos-${pos}`}>
                        <th scope="row">{display(pos, 1e6)}</th>
                        <td>
                          {array(snapshot, "coinNumerators").at(i)} /{" "}
                          {scalar(snapshot, "coinDenominator")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </details>
          )}
          <details>
            <summary>Read the histogram as counts and probabilities</summary>
            <div className="table-scroll">
              <table>
                <caption>
                  Every bin has the same boundaries for all three columns; the last right endpoint
                  is included
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Interval (μm)</th>
                    <th scope="col">Count</th>
                    <th scope="col">Finite-step probability</th>
                    <th scope="col">
                      {p.n === 0 ? "Point-mass probability" : "Gaussian probability"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: bins.length }, (_, i) => (
                    <tr key={`bin-${edges.at(i)}-${edges.at(i + 1)}`}>
                      <th scope="row">
                        {display(edges.at(i), 1e6)} to {display(edges.at(i + 1), 1e6)}
                      </th>
                      <td>{bins.at(i)}</td>
                      <td>{display(exact.at(i))}</td>
                      <td>{display(gaussian.at(i))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <WalkPaths snapshot={snapshot} />
          <WalkConvergence snapshot={snapshot} />
        </div>
      </div>
      {/* The four readings follow the reader's detail setting, as on every other laboratory: direct
          children of the lab root, which labShell.css's detail rules select. */}
      {readings && (
        <>
          <p data-detail="0">{withScripts(BM05_CAPTION.r0)}</p>
          <p data-detail="1">{withScripts(BM05_CAPTION.r1)}</p>
          <p data-detail="2" hidden>
            {withScripts(BM05_CAPTION.r2)}
          </p>
          <p data-detail="3" hidden>
            {withScripts(BM05_CAPTION.r3)}
          </p>
        </>
      )}
      <section className="reading walk-assumptions" {...identity(snapshot)}>
        <h3>Change an assumption, not just a slider</h3>
        <p>
          The next three comparisons are analytical. No biased-coin or Cauchy trajectory is drawn by
          this instrument.
        </p>
        <details open>
          <summary>Remove symmetry: biased left/right jumps</summary>
          <p>
            With right-step probability {display(p.bias)}, the mean step is{" "}
            <Reading snapshot={snapshot} id="biasedMean" factor={1e6} /> μm. Drift speed is{" "}
            <Reading snapshot={snapshot} id="biasedDrift" factor={1e6} /> μm/s. The
            centered-variance coefficient is{" "}
            <Reading snapshot={snapshot} id="biasedCenteredDiffusion" factor={1e12} /> μm²/s.
          </p>
          <p>
            <Reading snapshot={snapshot} id="biasedDiffusion" factor={1e12} />
            {p.bias === 0.5
              ? " μm²/s: at equal left/right probabilities the symmetry condition is restored."
              : ""}
          </p>
          <button
            type="button"
            className="secondary"
            disabled={!ready}
            onClick={() => apply({ ...p, bias: p.bias === 0.5 ? 0.6 : 0.5 })}
          >
            {p.bias === 0.5 ? "Compare a biased coin" : "Restore equal left/right probability"}
          </button>
        </details>
        <details>
          <summary>Remove finite variance: Cauchy steps</summary>
          <p>
            <Reading snapshot={snapshot} id="cauchyDiffusion" />
          </p>
          <p>
            That failure belongs to the pure-diffusion argument, not to the existence of a
            mathematical Cauchy walk. This preview does not simulate that different transport law.
          </p>
        </details>
        <details>
          <summary>Shrink the interval: what must stay fixed?</summary>
          <p>
            <Reading snapshot={snapshot} id="continuumLimit" />
          </p>
          <div className="table-scroll">
            <table>
              <caption>Two limiting procedures, calculated from the accepted step scale</caption>
              <thead>
                <tr>
                  <th scope="col">Interval (s)</th>
                  <th scope="col">Keep step fixed: coefficient (μm²/s)</th>
                  <th scope="col">Reduce step RMS to (μm)</th>
                  <th scope="col">Keep ratio fixed: coefficient (μm²/s)</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: intervals.length }, (_, i) => (
                  <tr key={`interval-${intervals.at(i)}`}>
                    <th scope="row">{display(intervals.at(i))}</th>
                    <td>{display(fixed.at(i), 1e12)}</td>
                    <td>{display(scales.at(i), 1e6)}</td>
                    <td>{display(ratios.at(i), 1e12)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <details>
          <summary>Model, trial identity, and numerical limits</summary>
          <p>
            Independent symmetric steps with finite variance are assumed. The fixed jumps are a
            mathematical bridge, not a microscopic theory of tracer collisions. Real tracers need a
            justified coarse-graining time before independence can be assumed. The three step laws
            are matched by variance, not fourth moment.
          </p>
          <p>
            Twenty traces and a bounded set of all-walker checkpoints are retained. A cached
            observation reads its checkpoint; another observation replays identical counter-indexed
            draws. Neither creates a different realization. This accepted calculation used{" "}
            <Reading snapshot={snapshot} id="requestDraws" /> random draws, including{" "}
            <Reading snapshot={snapshot} id="replayedDraws" /> replayed draws. The full trial
            identifies <Reading snapshot={snapshot} id="recordingDraws" /> draws and currently
            retains <Reading snapshot={snapshot} id="retainedBytes" /> bytes.
          </p>
          <p>
            The work ceiling is five million walker-steps and the private-recording ceiling is eight
            MiB. The uniform finite-step shape calculation is bounded to 400 observed steps. Its
            numerical result is not an interval-arithmetic enclosure.{" "}
            {drawnByFrankenSim
              ? `${FRANKENSIM_NORMALS_ENGINE_SENTENCE} The site's code sums the steps and computes every statistic; its normals agree with the host's within 64 ulps, not bitwise.`
              : "Gaussian draws use the host calculation; cross-engine bitwise parity and FrankenSim WASM conformance are not claimed."}
          </p>
          <p>
            These are model calculations, not experimental evidence. Historical constants and the
            full control-tape format remain in preparation.
          </p>
          <ShowTheCode
            instrumentId="bm-05"
            listings={getKernelListingsForInstrument("bm-05")}
            snapshotSourceDigest={example.snapshotFunctionHash}
            producedCurrentSnapshot={true}
            snapshotFunctionName={example.snapshotFunctionName}
            uid={`stc-${id}`}
          />
        </details>
      </section>
    </section>
  );
}
export function WalkComparison({ example }: { example: PreparedBm05Example }) {
  const [second, setSecond] = useState(false);
  return (
    <>
      <WalkLab example={example} />
      <div className="actions">
        <button type="button" className="secondary" onClick={() => setSecond(!second)}>
          {second ? "Close second walk laboratory" : "Open an independent walk laboratory"}
        </button>
      </div>
      {second && <WalkLab example={example} title="A separate walk trial" readings={false} />}
    </>
  );
}
