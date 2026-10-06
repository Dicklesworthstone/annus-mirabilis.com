"use client";
import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { createBm08BrowserChannel } from "../../experiments/bm08/browser.ts";
import {
  BM08_COMPARABLE_INPUTS,
  BM08_COMPARISON,
  type Bm08ComparisonInput,
} from "../../experiments/bm08/comparison.ts";
import { createBm08ComparisonSession } from "../../experiments/bm08/comparisonSession.ts";
import { fromCameraDraft, toCameraDraft } from "../../experiments/bm08/controls.ts";
import type { Bm08Parameters } from "../../experiments/bm08/definition.ts";
import { encodeBm08Settings } from "../../experiments/bm08/permalink.ts";
import type { PreparedBm08Example } from "../../experiments/bm08/session.ts";
import { ComparisonPanel } from "../../experiments/compare/ComparisonPanel.tsx";
import {
  comparisonDisplay,
  comparisonStatement,
} from "../../experiments/compare/comparisonStatement.ts";
import { CameraComparisonReadouts } from "./CameraComparisonReadouts.tsx";

const help: Readonly<Record<Bm08ComparisonInput, string>> = {
  sigma:
    "Change localization error without changing the particle's path or the camera noise seed. Zero removes localization error, not exposure blur.",
  exposure:
    "Use multiples of 0.25 seconds, no longer than the frame spacing. Zero uses frame-start positions instead of exposure averages.",
  dt: "Choose 1, 2, 3 or 4 seconds. The worker reads the same retained path at different frame times; it does not generate a new path.",
  stageDrift:
    "Change the camera stage's motion in x, not the fluid's physical drift. The particle's latent positions stay fixed.",
  M: "Choose 3 to 1000 displacements. This selects more or fewer frames from the same recording; it is not a new physical experiment.",
  d: "Choose x only or both x and y. Selecting an additional coordinate reveals retained data rather than drawing another path.",
  clicks:
    "Change the number of independent stationary-feature calibration clicks. The particle's path and the click seed remain fixed.",
  noiseMethod:
    "Compare known noise variance with noise estimated from stationary-feature clicks. Both procedures use the same camera frames and calibration clicks.",
  coverage:
    "Choose a target from 50 to 99.9 percent. Only the interval procedure changes; the observed data do not.",
};

export function CameraControlledComparison({ example }: { example: PreparedBm08Example }) {
  const uid = useId();
  const [controller] = useState(() =>
    createBm08ComparisonSession(`camera-compare-${uid}`, example, createBm08BrowserChannel),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
  );
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<Bm08ComparisonInput>("sigma");
  const [draft, setDraft] = useState(toCameraDraft(example.parameters).sigma);
  const [error, setError] = useState("");
  useEffect(() => {
    controller.connect();
    setReady(true);
    return () => controller.disconnect();
  }, [controller]);
  useEffect(() => {
    setDraft(toCameraDraft(state.variant.parameters as Bm08Parameters)[selected]);
  }, [state.variant, selected]);
  const input = BM08_COMPARISON.inputs[selected];
  const enabled = ready && state.phase === "live" && !state.pending;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const form = toCameraDraft(state.variant.parameters as Bm08Parameters);
      form[selected] = draft;
      // The existing form parser owns decimal scaling, finite checks and model admission.
      controller.apply(fromCameraDraft(form));
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Check this camera setting. The completed comparison is unchanged.",
      );
    }
  }
  const statement = comparisonStatement(
    state.baseline,
    state.variant,
    BM08_COMPARISON,
    state.result,
  );
  return (
    <section
      className="laboratory controlled-comparison camera-controlled-comparison"
      aria-labelledby={`${uid}-title`}
      data-controlled-camera-comparison
      data-comparison-phase={state.phase}
      data-pending={String(state.pending)}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">One particle · One controlled change</p>
          <h2 id={`${uid}-title`}>Did the particle change, or did the measurement?</h2>
        </div>
        <p className="badge">
          {state.phase === "example" ? "Static worked example" : "Ideal model, host calculation"}
        </p>
      </header>
      <noscript>
        <p className="notice">
          JavaScript is off. Both columns show the same prepared example, not an unexecuted
          variation. Its plots, frames, estimates and uncertainty explanations remain readable.
        </p>
      </noscript>
      <p role="status" aria-live="polite" aria-atomic="true">
        {state.message}
      </p>
      <div className="actions">
        <button
          type="button"
          disabled={!ready || state.pending}
          onClick={() => {
            setError("");
            controller.start();
          }}
        >
          {state.phase === "example"
            ? "Start controlled camera comparison"
            : "Rebuild pinned baseline"}
        </button>
        <button
          type="button"
          disabled={!enabled}
          onClick={() => {
            setError("");
            controller.pinCurrent();
          }}
        >
          Pin current camera as baseline
        </button>
        <button type="button" disabled={!state.pending} onClick={() => controller.stop()}>
          Stop calculation
        </button>
      </div>
      <p>
        Start reconstructs the pinned recording in one worker. Change one camera or estimator
        setting, then compare the two completed results below. Pin the current result before
        changing a second setting. The particle's diffusivity, fluid drift and all three random
        seeds are locked.
      </p>
      <form onSubmit={submit} noValidate aria-label="Controlled camera comparison settings">
        <fieldset disabled={!enabled}>
          <legend>What will you change?</legend>
          <div className="comparison-controls">
            <div>
              <label htmlFor={`${uid}-input`}>Camera or estimator setting</label>
              <select
                id={`${uid}-input`}
                value={selected}
                onChange={(event) => {
                  const value = event.target.value;
                  if (BM08_COMPARABLE_INPUTS.some((key) => key === value)) {
                    setSelected(value as Bm08ComparisonInput);
                    setError("");
                  }
                }}
              >
                {BM08_COMPARABLE_INPUTS.map((key) => (
                  <option key={key} value={key}>
                    {BM08_COMPARISON.inputs[key]?.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-value`}>
                {input?.label}
                {input?.unit ? ` (${input.unit})` : ""}
              </label>
              {selected === "noiseMethod" ? (
                <select
                  id={`${uid}-value`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-describedby={`${uid}-help`}
                >
                  <option value="known">Known noise variance</option>
                  <option value="stationary">Estimate from stationary clicks</option>
                </select>
              ) : selected === "d" || selected === "dt" ? (
                <select
                  id={`${uid}-value`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-describedby={`${uid}-help`}
                >
                  {(selected === "d" ? [1, 2] : [1, 2, 3, 4]).map((value) => (
                    <option key={value} value={String(value)}>
                      {selected === "d" ? (value === 1 ? "x only" : "x and y") : `${value} s`}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`${uid}-value`}
                  type="text"
                  inputMode="decimal"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-describedby={`${uid}-help`}
                />
              )}
            </div>
            <button type="submit">Apply one change</button>
          </div>
          <p id={`${uid}-help`}>{help[selected]}</p>
          <p className="fine">
            Pinned value:{" "}
            {comparisonDisplay(state.baseline.parameters[selected] ?? "", input?.displayFactor)}{" "}
            {input?.unit}. Editing the form does not change any displayed result.
          </p>
        </fieldset>
      </form>
      {(error || state.error) && (
        <p className="notice" role="alert">
          {error || state.error}
        </p>
      )}
      <p className="camera-comparison-statement" data-comparison-statement>
        {statement}
      </p>
      <CameraComparisonReadouts
        baseline={state.baselineSnapshot}
        variant={state.variantSnapshot}
        uid={uid}
      />
      <ComparisonPanel
        baseline={state.baseline}
        variant={state.variant}
        contract={BM08_COMPARISON}
        result={state.result}
      />
      <p>
        <a href={`/lab/bm-08/${encodeBm08Settings(state.baseline.parameters as Bm08Parameters)}`}>
          Open baseline settings in the full camera laboratory
        </a>
        {" · "}
        <a href={`/lab/bm-08/${encodeBm08Settings(state.variant.parameters as Bm08Parameters)}`}>
          Open variant settings in the full camera laboratory
        </a>
        . These links load a draft; starting a calculation remains explicit.
      </p>
      <p className="fine">
        The comparison download contains the selected scalar readouts and their identities.
        Confidence sets and frame positions are displayed separately above; they are not propagated
        into ratio error bars.
      </p>
      <details>
        <summary>What makes this a controlled comparison?</summary>
        <p>
          The worker must report that it reused the latent recording and made no new latent draws.
          Its retained witness and all latent coordinates at common frame times must agree. An
          estimator-only change must also preserve every camera frame, increment and stationary
          calibration click, with no new measurement draws. A mismatch keeps the previous completed
          pair.
        </p>
        <p>
          These checks establish reuse within this identified calculation, not bitwise agreement
          between different computers. Shared randomness makes the results dependent, not
          independent evidence. The camera model is a later, synthetic measurement model, not
          Einstein's 1905 measurement data.
        </p>
        <p>
          <a href="/lab/bm-08/#camera-model">Read the observation model and its assumptions</a>
        </p>
      </details>
    </section>
  );
}
