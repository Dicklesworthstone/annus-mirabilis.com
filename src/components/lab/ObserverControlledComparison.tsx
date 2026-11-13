"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { ComparisonPanel } from "../../experiments/compare/ComparisonPanel.tsx";
import {
  comparisonDisplay,
  comparisonStatement,
} from "../../experiments/compare/comparisonStatement.ts";
import { useLaboratoryVisibility } from "../../experiments/lifecycle/useLaboratoryVisibility.ts";
import { createSr03BrowserChannel } from "../../experiments/sr03/browser.ts";
import { SR03_COMPARISON, sr03ComparisonReadings } from "../../experiments/sr03/comparison.ts";
import {
  createSr03ComparisonSession,
  type PreparedSr03Comparison,
} from "../../experiments/sr03/comparisonSession.ts";
import type { FrameId } from "../../experiments/sr03/definition.ts";
import type { Sr03ReadingsView } from "../../experiments/sr03/readings.ts";
import type { WorkerChannel } from "../../workers/scheduler/sr03Scheduler.ts";

const displayed = (value: number | null) =>
  value === null ? "Not available" : comparisonDisplay(value);

/** Coordinate scaling is presentation only; every point is an accepted pair of owner readouts. */
function ObserverComparisonPlot({
  baseline,
  variant,
  baselineFrame,
  variantFrame,
  uid,
}: {
  baseline: Sr03ReadingsView;
  variant: Sr03ReadingsView;
  baselineFrame: string;
  variantFrame: string;
  uid: string;
}) {
  if (baseline.dx === null || baseline.cdt === null || variant.dx === null || variant.cdt === null)
    return null;
  const scale = Math.max(
    1,
    Math.abs(baseline.dx),
    Math.abs(baseline.cdt),
    Math.abs(variant.dx),
    Math.abs(variant.cdt),
  );
  const x = (value: number) => 350 + 245 * (value / scale);
  const y = (value: number) => 220 - 145 * (value / scale);
  return (
    <figure className="comparison-plot">
      <svg viewBox="0 0 700 460" role="img" aria-labelledby={`${uid}-plot-title ${uid}-plot-desc`}>
        <title id={`${uid}-plot-title`}>One event pair in two coordinate descriptions</title>
        <desc id={`${uid}-plot-desc`}>
          Baseline in {baselineFrame}: spatial separation {displayed(baseline.dx)} light-seconds and
          time separation {displayed(baseline.cdt)} seconds. Variant in {variantFrame}: spatial
          separation {displayed(variant.dx)} light-seconds and time separation{" "}
          {displayed(variant.cdt)} seconds. Solid line and round marker identify the baseline;
          dashed line and square marker identify the variant.
        </desc>
        <g stroke="currentColor" fill="none" strokeWidth="1">
          <line x1="70" y1="220" x2="630" y2="220" />
          <line x1="350" y1="45" x2="350" y2="395" />
          <line x1="350" y1="220" x2={x(baseline.dx)} y2={y(baseline.cdt)} strokeWidth="3" />
          <line
            x1="350"
            y1="220"
            x2={x(variant.dx)}
            y2={y(variant.cdt)}
            strokeWidth="3"
            strokeDasharray="8 5"
          />
          <circle cx={x(baseline.dx)} cy={y(baseline.cdt)} r="8" strokeWidth="3" />
          <rect
            x={x(variant.dx) - 6}
            y={y(variant.cdt) - 6}
            width="12"
            height="12"
            strokeWidth="3"
          />
        </g>
        <g fill="currentColor" fontSize="var(--comparison-label, 18px)">
          <text x="350" y="430" textAnchor="middle">
            Spatial separation (light-seconds)
          </text>
          <text x="350" y="26" textAnchor="middle">
            Time separation (seconds)
          </text>
          <text x="358" y="242">
            0
          </text>
          <text x="105" y="246" textAnchor="middle">
            {displayed(-scale)}
          </text>
          <text x="595" y="246" textAnchor="middle">
            {displayed(scale)}
          </text>
          <text x="336" y="81" textAnchor="end">
            {displayed(scale)}
          </text>
          <text x="336" y="371" textAnchor="end">
            {displayed(-scale)}
          </text>
        </g>
      </svg>
      <figcaption>
        Baseline: solid line and round marker. Variant: dashed line and square marker. These are two
        coordinate descriptions of one event separation, not two trajectories. The table gives the
        same values without the drawing.
      </figcaption>
    </figure>
  );
}

function Comparison({
  example,
  workerFactory,
}: {
  example: PreparedSr03Comparison;
  workerFactory: () => WorkerChannel;
}) {
  const uid = useId();
  const [controller] = useState(() =>
    createSr03ComparisonSession(`observer-compare-${uid}`, example, workerFactory),
  );
  const region = useLaboratoryVisibility(controller);
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
  );
  const [ready, setReady] = useState(false);
  const [frame, setFrame] = useState<FrameId>(example.variant.parameters.measuringFrame);
  useEffect(() => {
    controller.connect();
    setReady(true);
    return () => controller.disconnect();
  }, [controller]);
  useEffect(() => {
    const acceptedFrame = state.variant.parameters.measuringFrame;
    if (acceptedFrame === "K" || acceptedFrame === "k") setFrame(acceptedFrame);
  }, [state.variant]);
  const a = sr03ComparisonReadings(state.baselineSnapshot);
  const b = sr03ComparisonReadings(state.variantSnapshot);
  const baselineFrame = String(state.baseline.parameters.measuringFrame);
  const variantFrame = String(state.variant.parameters.measuringFrame);
  const enabled = ready && state.phase === "live" && !state.pending;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    controller.apply({ ...state.baseline.parameters, measuringFrame: frame });
  }
  return (
    <section
      ref={region}
      className="lab controlled-comparison"
      aria-labelledby={`${uid}-title`}
      data-observer-comparison
      data-comparison-phase={state.phase}
      data-comparison-pending={state.pending}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">One event pair · Change only the observer</p>
          <h2 id={`${uid}-title`}>{example.title}</h2>
        </div>
        <p className="badge">
          {state.phase === "example" ? "Static worked comparison" : "Ideal model, host calculation"}
        </p>
      </header>
      <p>{example.description}</p>
      <noscript>
        <p className="notice">
          JavaScript is off. Both completed coordinate descriptions, the event comparison and their
          explanations remain readable. Interactive comparisons need JavaScript.
        </p>
      </noscript>
      <p role="status" aria-live="polite" aria-atomic="true" className="comparison-status">
        {state.pending
          ? state.message
          : state.phase === "example"
            ? "Static worked comparison, calculated with the same scientific owner as the live laboratory."
            : `Completed comparison: baseline observer ${baselineFrame}, variant observer ${variantFrame}. The physical setup and selected events are held fixed.`}
      </p>
      {state.error && (
        <p role="alert" className="notice">
          {state.error}
        </p>
      )}
      <div className="actions">
        <button type="button" disabled={!ready || state.pending} onClick={() => controller.start()}>
          {state.phase === "example" ? "Start live observer comparison" : "Rebuild pinned baseline"}
        </button>
        <button type="button" disabled={!enabled} onClick={() => controller.pinCurrent()}>
          Pin current observer as baseline
        </button>
        <button type="button" disabled={!state.pending} onClick={() => controller.stop()}>
          Stop calculation
        </button>
      </div>
      <p>
        Start calculates the pinned baseline in one worker. Changing observer keeps the rod,
        relative speed and event selection fixed. No calculation starts on arrival, including in
        reading-only mode.
      </p>
      <form onSubmit={submit} aria-label="Observer comparison settings">
        <fieldset disabled={!enabled}>
          <legend>Describe the same events</legend>
          <label htmlFor={`${uid}-frame`}>Observer for the requested comparison</label>
          <select
            id={`${uid}-frame`}
            value={frame}
            onChange={(event) => {
              if (event.target.value === "K" || event.target.value === "k")
                setFrame(event.target.value);
            }}
          >
            <option value="K">K, the platform frame</option>
            <option value="k">k, the frame moving relative to K</option>
          </select>
          <div className="actions">
            <button type="submit">Compare this observer</button>
            <button type="button" onClick={() => controller.apply(state.baseline.parameters)}>
              Return to pinned observer
            </button>
          </div>
        </fieldset>
      </form>
      <ObserverComparisonPlot
        baseline={a}
        variant={b}
        baselineFrame={baselineFrame}
        variantFrame={variantFrame}
        uid={uid}
      />
      <section
        className="comparison-scroll"
        aria-label="Same events, accepted observer readings"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the readout table remains scrollable by keyboard on narrow screens.
        tabIndex={0}
      >
        <table>
          <caption>Same event pair · values from completed results</caption>
          <thead>
            <tr>
              <th scope="col">Readout</th>
              <th scope="col">Baseline in {baselineFrame}</th>
              <th scope="col">Variant in {variantFrame}</th>
            </tr>
          </thead>
          <tbody>
            <tr data-observer-readout="space">
              <th scope="row">Spatial separation (light-seconds)</th>
              <td>{displayed(a.dx)}</td>
              <td>{displayed(b.dx)}</td>
            </tr>
            <tr data-observer-readout="time">
              <th scope="row">Time separation (seconds)</th>
              <td>{displayed(a.cdt)}</td>
              <td>{displayed(b.cdt)}</td>
            </tr>
            <tr data-observer-readout="simultaneous">
              <th scope="row">Read at one time in this frame?</th>
              <td>{a.simultaneous ? "Yes" : "No"}</td>
              <td>{b.simultaneous ? "Yes" : "No"}</td>
            </tr>
            <tr data-observer-readout="distance">
              <th scope="row">Distance from these readings at one time (light-seconds)</th>
              <td>
                {a.simultaneous
                  ? displayed(a.separation)
                  : "Not applicable: the readings are not simultaneous."}
              </td>
              <td>
                {b.simultaneous
                  ? displayed(b.separation)
                  : "Not applicable: the readings are not simultaneous."}
              </td>
            </tr>
            <tr data-observer-readout="rod">
              <th scope="row">Rod's length from its own simultaneous readings (light-seconds)</th>
              <td>{displayed(a.rodLength)}</td>
              <td>{displayed(b.rodLength)}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <h3>Does the separation measure a rod?</h3>
      <p>
        <strong>Baseline in {baselineFrame}.</strong> {a.verdict}
      </p>
      <p>
        <strong>Variant in {variantFrame}.</strong> {b.verdict}
      </p>
      <p>
        The rod lengths in the last row use a separate pair of simultaneous end readings in each
        frame. Changing only the observer does not replace the two events you pinned.
      </p>
      <details>
        <summary>What changed, what stayed fixed, and the comparison record</summary>
        <p>{comparisonStatement(state.baseline, state.variant, SR03_COMPARISON, state.result)}</p>
        <ComparisonPanel
          baseline={state.baseline}
          variant={state.variant}
          contract={SR03_COMPARISON}
          result={state.result}
        />
      </details>
    </section>
  );
}

/** Selecting another worked pair is explicit and ends the preceding comparison's worker. */
export function ObserverControlledComparison({
  examples,
  workerFactory = createSr03BrowserChannel,
}: {
  examples: readonly PreparedSr03Comparison[];
  workerFactory?: () => WorkerChannel;
}) {
  const uid = useId();
  const [selected, setSelected] = useState(examples[0]?.id ?? "");
  const [draft, setDraft] = useState(selected);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  const example = examples.find((entry) => entry.id === selected);
  if (!example) return <p className="notice">No worked observer comparison is available.</p>;
  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSelected(draft);
        }}
        aria-label="Choose a fixed event pair"
      >
        <label htmlFor={`${uid}-case`}>Choose a worked event pair</label>
        <select
          id={`${uid}-case`}
          value={draft}
          disabled={!ready}
          onChange={(event) => setDraft(event.target.value)}
        >
          {examples.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        <button type="submit" disabled={!ready}>
          Open worked pair
        </button>
        <p>
          Opening another pair ends the live comparison and shows its static worked results. It
          starts no worker.
        </p>
      </form>
      <Comparison key={selected} example={example} workerFactory={workerFactory} />
    </>
  );
}
