"use client";
import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { createBm01BrowserChannel } from "../../experiments/bm01/browser.ts";
import {
  BM01_COMPARABLE_INPUTS,
  BM01_COMPARISON,
  type PreparedBm01Comparison,
} from "../../experiments/bm01/comparison.ts";
import { createBm01ComparisonSession } from "../../experiments/bm01/comparisonSession.ts";
import type { Bm01Parameters } from "../../experiments/bm01/definition.ts";
import { encodeBm01Settings } from "../../experiments/bm01/permalink.ts";
import { ComparisonPanel } from "../../experiments/compare/ComparisonPanel.tsx";
import { ComparisonPlot } from "../../experiments/compare/ComparisonPlot.tsx";
import {
  COMMON_RANDOM_NUMBERS_NOTE,
  comparisonDisplay,
  comparisonStatement,
} from "../../experiments/compare/comparisonStatement.ts";
import "../../experiments/compare/comparison.css";

export function BrownianComparisonLab({ example }: { example: PreparedBm01Comparison }) {
  const uid = useId();
  const [controller] = useState(() =>
    createBm01ComparisonSession(`comparison-${uid}`, example, createBm01BrowserChannel),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
  );
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<(typeof BM01_COMPARABLE_INPUTS)[number]>("a");
  const [draft, setDraft] = useState(String(example.doubledRadius.parameters.a * 1e6));
  const [dirty, setDirty] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    controller.connect();
    setReady(true);
    return () => controller.disconnect();
  }, [controller]);
  useEffect(() => {
    const value = state.variant.parameters[selected],
      input = BM01_COMPARISON.inputs[selected];
    if (typeof value === "number" && input) setDraft(String(value * input.displayFactor));
    setDirty(false);
  }, [state.variant, selected]);
  const input = BM01_COMPARISON.inputs[selected];
  if (!input) throw new Error("The comparison input has no declared role.");
  const enabled = ready && state.phase === "live" && !state.pending;
  function applyNumber(value: number) {
    setError("");
    if (!Number.isFinite(value)) {
      setError("Enter a finite number in the displayed unit.");
      return;
    }
    if (controller.apply({ ...state.variant.parameters, [selected]: value })) setDirty(false);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(draft.trim())) {
      setError("Enter a number, not a formula, in the displayed unit.");
      return;
    }
    applyNumber(Number(draft) / (BM01_COMPARISON.inputs[selected]?.displayFactor ?? 1));
  }
  const statement = comparisonStatement(
    state.baseline,
    state.variant,
    BM01_COMPARISON,
    state.result,
  );
  return (
    <section
      className="laboratory controlled-comparison"
      aria-labelledby={`${uid}-title`}
      data-controlled-comparison
      data-comparison-phase={state.phase}
      data-pending={String(state.pending)}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">BM-01 · One controlled variation</p>
          <h2 id={`${uid}-title`}>Change one thing. Keep the question clear.</h2>
        </div>
        <p className="badge">
          {state.phase === "example" ? "Static worked comparison" : "Live host calculation"}
        </p>
      </header>
      <p>
        {COMMON_RANDOM_NUMBERS_NOTE} The same recording grid, tracer count, selected coordinate and
        model are retained. A physical setup change creates a new run; a measurement change reads
        the existing recording.
      </p>
      <noscript>
        <p className="notice">
          JavaScript is off. The worked comparison, shared-axis plot, input locks, result tables and
          explanation remain available.
        </p>
      </noscript>
      <div className="actions">
        <button
          type="button"
          disabled={!ready || state.pending}
          onClick={() => {
            setError("");
            controller.start();
          }}
        >
          {state.phase === "example" ? "Start live comparison" : "Rebuild pinned baseline"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!enabled}
          onClick={() => {
            setError("");
            controller.pinCurrent();
          }}
        >
          Pin current result as new baseline
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!state.pending}
          onClick={() => controller.stop()}
        >
          Stop calculation
        </button>
      </div>
      <p className="fine">
        Starting is explicit. It reconstructs the pinned baseline in a worker before enabling
        changes. Pinning a new baseline accepts the current completed setup as the starting point
        for your next question.
      </p>
      <form onSubmit={submit} noValidate aria-label="Controlled comparison settings">
        <fieldset disabled={!enabled}>
          <legend>Vary one independent input</legend>
          <div className="comparison-controls">
            <div>
              <label htmlFor={`${uid}-input`}>Input to vary</label>
              <select
                id={`${uid}-input`}
                value={selected}
                onChange={(event) => {
                  const value = event.target.value;
                  if (BM01_COMPARABLE_INPUTS.some((key) => key === value)) {
                    setSelected(value as (typeof BM01_COMPARABLE_INPUTS)[number]);
                    setError("");
                  }
                }}
              >
                {BM01_COMPARABLE_INPUTS.map((key) => (
                  <option key={key} value={key}>
                    {BM01_COMPARISON.inputs[key]?.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-value`}>
                Requested {input.label.toLowerCase()} ({input.unit})
              </label>
              <input
                id={`${uid}-value`}
                type="text"
                inputMode="decimal"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setDirty(true);
                }}
              />
            </div>
          </div>
          <div className="actions">
            <button type="submit">Apply one change</button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                const value = state.baseline.parameters[selected];
                if (typeof value === "number") applyNumber(value * 2);
              }}
            >
              Use twice the baseline value
            </button>
            {selected === "interval" && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  const value = state.baseline.parameters.interval;
                  if (typeof value === "number") applyNumber(value * 4);
                }}
              >
                Observe at four times the baseline interval
              </button>
            )}
          </div>
        </fieldset>
        <p className="fine">
          A second changed input is refused before calculation. Pin the current result to start a
          different comparison. Temperature does not silently change viscosity. Off-grid observation
          times are refused rather than rounded.
        </p>
      </form>
      {dirty && (
        <p className="notice">
          Unapplied request. Every displayed number still belongs to the completed comparison.
        </p>
      )}
      {(error || state.error) && (
        <p role="alert" className="notice">
          {error || state.error}
        </p>
      )}
      <p role="status" aria-live="polite" aria-atomic="true" className="comparison-status">
        {state.message}
      </p>
      {state.requestedParameters && (
        <details>
          <summary>
            {state.pending
              ? "Requested settings (not yet accepted)"
              : "Last request (not displayed as an accepted comparison)"}
          </summary>
          <dl>
            {Object.entries(state.requestedParameters).map(([key, value]) => (
              <div key={key}>
                <dt>{BM01_COMPARISON.inputs[key]?.label ?? key}</dt>
                <dd>
                  {comparisonDisplay(value, BM01_COMPARISON.inputs[key]?.displayFactor ?? 1)}{" "}
                  {BM01_COMPARISON.inputs[key]?.unit}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      <ComparisonPlot baseline={state.baselineSnapshot} variant={state.variantSnapshot} uid={uid} />
      <ComparisonPanel
        baseline={state.baseline}
        variant={state.variant}
        contract={BM01_COMPARISON}
        result={state.result}
      />
      <details>
        <summary>Read the generated comparison statement</summary>
        <p data-comparison-statement>{statement}</p>
      </details>
      {state.result.kind === "accepted" &&
        state.result.variation.command === "measurement-change" && (
          <p className="notice" data-recording-reuse>
            The worker confirmed reuse of the pinned recording. The observation interval changed,
            not the recorded trial.
          </p>
        )}
      <details>
        <summary>Why halving diffusivity does not halve displacement</summary>
        <p>
          Within this diffusion model, doubling radius or viscosity halves the diffusion
          coefficient. The coordinate RMS displacement scales with the square root of that
          coefficient, so its ratio is about 0.70711, not 0.5, at the same elapsed time.
        </p>
        <p>
          Using common random numbers makes the corresponding sampled paths scale together. This
          isolates the setup change; it does not provide two independent experiments. This
          comparison does not offer independent-seed confidence intervals.
        </p>
        <p>
          Changing the observation interval asks a different question of the same recording. Four
          times the time gives twice the model coordinate RMS; the finite sample can differ. The
          apparent speed depends on the chosen interval and is undefined at zero time.
        </p>
        <a href="/papers/brownian-motion/#arg-bm-observable">Return to the displacement argument</a>
      </details>
      <p>
        <a href={`/lab/bm-01/${encodeBm01Settings(state.variant.parameters as Bm01Parameters)}`}>
          Open the completed variant settings in the full tracer lab
        </a>
      </p>
    </section>
  );
}
