"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { ComparisonPanel } from "../../../experiments/compare/ComparisonPanel.tsx";
import { comparisonStatement } from "../../../experiments/compare/comparisonStatement.ts";
import { ME03_COMPARISON, me03ComparisonParameters } from "../../../experiments/me03/comparison.ts";
import { createMe03ComparisonSession } from "../../../experiments/me03/comparisonSession.ts";
import type { Me03Boundary } from "../../../experiments/me03/definition.ts";
import type { createMe03Session } from "../../../experiments/me03/session.ts";
import { comparisonReplayAdapter } from "../../../reader/notebook/comparisonAdapters.ts";
import {
  type ComparisonPredictionIntent,
  predictionForAccepted,
  predictionIntent,
} from "../../../reader/notebook/predictionIntent.ts";
import type { ReplayPrediction } from "../../../reader/notebook/replayEntry.ts";
import { SaveComparisonReplay } from "../../../reader/notebook/SaveComparisonReplay.tsx";
import { numberText } from "../presentation.ts";
import "../../../experiments/compare/comparison.css";

const BOUNDARIES: Readonly<Record<Me03Boundary, string>> = Object.freeze({
  "body-alone": "The emitting body alone",
  radiation: "The emitted radiation alone",
  "combined-isolated-system": "The body and all emitted radiation",
});
type Controller = ReturnType<typeof createMe03ComparisonSession>;

function Comparison({ controller, onClose }: { controller: Controller; onClose(): void }) {
  const uid = useId();
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
  );
  const [ready, setReady] = useState(false);
  const [boundary, setBoundary] = useState<Me03Boundary>(
    state.variant.parameters.boundary as Me03Boundary,
  );
  const [error, setError] = useState("");
  const [nextPrediction, setNextPrediction] = useState<ReplayPrediction | null>(null);
  const [issuedPrediction, setIssuedPrediction] = useState<ComparisonPredictionIntent | null>(null);
  const adapter = comparisonReplayAdapter("me-03");
  const prediction = predictionForAccepted(issuedPrediction, state);
  const changed = state.result.kind === "accepted" && state.result.variation.changedInput !== null;
  const enabled = ready && state.phase === "live" && !state.pending;
  const hasDraft = boundary !== state.variant.parameters.boundary;
  const canSave = enabled && !hasDraft && !error && !state.error;

  useEffect(() => {
    controller.connect();
    controller.start();
    setReady(true);
    return () => controller.disconnect();
  }, [controller]);

  useEffect(() => {
    setBoundary(state.variant.parameters.boundary as Me03Boundary);
  }, [state.variant]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled) return;
    const requested = { ...state.baseline.parameters, boundary };
    const intent = predictionIntent(nextPrediction, state, requested);
    setError("");
    if (controller.apply(requested)) setIssuedPrediction(intent);
  }

  return (
    <section
      className="controlled-comparison"
      aria-labelledby={`${uid}-title`}
      data-boundary-comparison
      data-comparison-phase={state.phase}
      data-comparison-pending={state.pending}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">One emission · Change only the system boundary</p>
          <h3 id={`${uid}-title`}>Controlled system-boundary comparison</h3>
        </div>
        <p className="badge">Ideal model, host calculation</p>
      </header>
      <p>
        The pinned body emits {numberText(Number(state.baseline.parameters.emittedEnergy))} J, with
        no external energy input. The variant chooses which parts to include in the account. The
        emitted energy, radiation disposition and physical run stay fixed. Exploring the main ledger
        does not replace this pinned emission.
      </p>
      <p role="status" aria-live="polite" aria-atomic="true">
        {state.pending
          ? state.message
          : changed
            ? "Completed comparison: only the system boundary changed. Both columns describe the same emission."
            : "Both columns still use the pinned boundary. Choose another boundary, then compare."}
      </p>
      {(error || state.error) && (
        <p id={`${uid}-error`} role="alert" className="notice error">
          {error || state.error}
        </p>
      )}
      <form onSubmit={submit} aria-label="Controlled system-boundary settings">
        <fieldset disabled={!enabled}>
          <legend>Redraw only the boundary</legend>
          <label htmlFor={`${uid}-boundary`}>Variant system boundary</label>
          <select
            id={`${uid}-boundary`}
            name="comparison-boundary"
            value={boundary}
            aria-invalid={Boolean(error || state.error)}
            aria-describedby={error || state.error ? `${uid}-error` : undefined}
            onChange={(event) => {
              const value = event.target.value;
              if (Object.hasOwn(BOUNDARIES, value)) {
                setBoundary(value as Me03Boundary);
                setError("");
              } else {
                setError("Choose the body, the emitted radiation, or their complete system.");
              }
            }}
          >
            {Object.entries(BOUNDARIES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="fine">
            The complete system includes the body and all the light it emitted, including light that
            has left the body. Read this at the emission stage, before any later absorption. A
            container after light crosses its outer boundary is a different system.
          </p>
          <label htmlFor={`${uid}-prediction`}>
            Before comparing: how will the selected system’s energy change compare? (Optional)
          </label>
          <select
            id={`${uid}-prediction`}
            name="comparison-prediction"
            value={nextPrediction ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              setNextPrediction(
                Object.hasOwn(adapter.predictions, value) ? (value as ReplayPrediction) : null,
              );
            }}
          >
            <option value="">No prediction recorded</option>
            {Object.entries(adapter.predictions).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="fine">
            Compare signed changes: zero is larger than a negative change. A prediction is attached
            to the next accepted comparison; choosing another answer afterward does not rewrite it.
          </p>
          <div className="actions">
            <button type="submit">Compare this boundary</button>
            <button
              type="button"
              disabled={!changed || hasDraft}
              onClick={() => {
                if (controller.apply(state.baseline.parameters)) {
                  setIssuedPrediction(null);
                  setError("");
                }
              }}
            >
              Return variant to pinned boundary
            </button>
            <button
              type="button"
              disabled={!changed || hasDraft || Boolean(error || state.error)}
              onClick={() => {
                if (controller.pinCurrent()) {
                  setIssuedPrediction(null);
                  setError("");
                }
              }}
            >
              Pin current variant as new baseline
            </button>
          </div>
        </fieldset>
      </form>
      {hasDraft && (
        <p className="notice">
          This boundary choice has not been calculated. The table still shows the completed
          comparison. Compare it before saving an explanation.
        </p>
      )}
      <p data-accepted-boundaries>
        Accepted baseline: {BOUNDARIES[state.baseline.parameters.boundary as Me03Boundary]}.
        Accepted variant: {BOUNDARIES[state.variant.parameters.boundary as Me03Boundary]}.
      </p>
      <ComparisonPanel
        baseline={state.baseline}
        variant={state.variant}
        contract={ME03_COMPARISON}
        result={state.result}
      />
      <details>
        <summary>Read the comparison as a statement</summary>
        <p>{comparisonStatement(state.baseline, state.variant, ME03_COMPARISON, state.result)}</p>
      </details>
      <p className="fine">
        The body loses mass when it gives off energy. Including all the emitted radiation keeps the
        total isolated system’s energy and mass unchanged. The 1905 ledger does not assign a
        rest-mass change to free radiation: that reading stays “not applicable,” with its reason.
        The mass values are changes, so a zero change does not say that the system has zero mass.
      </p>
      <SaveComparisonReplay state={state} prediction={prediction} ready={Boolean(canSave)} />
      <div className="actions">
        <button type="button" className="secondary" onClick={onClose}>
          Close controlled comparison
        </button>
      </div>
      <p className="fine">
        Save any explanation you want to keep before closing. To pin a different emission, close
        this comparison, calculate the new energy in the main ledger, then pin its accepted result.
      </p>
    </section>
  );
}

/** An independently owned comparison starts only when the reader explicitly pins a result. */
export function BoundaryControlledComparison({
  session,
  sourceDigest,
  enabled,
}: {
  session: ReturnType<typeof createMe03Session>;
  sourceDigest: string;
  enabled: boolean;
}) {
  const uid = useId();
  const [ready, setReady] = useState(false);
  const [controller, setController] = useState<Controller | null>(null);
  const [error, setError] = useState("");
  useEffect(() => setReady(true), []);

  function pin() {
    if (!ready || !enabled) return;
    const accepted = session.getSnapshot().accepted;
    if (!accepted?.final) return;
    try {
      const parameters = me03ComparisonParameters(accepted.parameters);
      setController(
        createMe03ComparisonSession(`me03-comparison-${uid}`, parameters, { sourceDigest }),
      );
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The comparison could not be opened.");
    }
  }

  if (controller) return <Comparison controller={controller} onClose={() => setController(null)} />;
  return (
    <section aria-labelledby={`${uid}-offer`} data-boundary-comparison-offer>
      <h3 id={`${uid}-offer`}>Keep the emission fixed, change the boundary</h3>
      <p>
        Pin the accepted emission from the 1905 ledger, then compare the body alone with the body
        and its radiation together. Both results remain visible, with an optional prediction and a
        private explanation you can keep in your notebook.
      </p>
      <p className="fine">
        Use the 1905 energy ledger with external energy input set to zero. The baseline uses the
        last accepted calculation; unapplied or refused settings are not included.
      </p>
      <button type="button" disabled={!ready || !enabled} onClick={pin}>
        Pin accepted emission for comparison
      </button>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
    </section>
  );
}
