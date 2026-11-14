"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { ComparisonPanel } from "../../../experiments/compare/ComparisonPanel.tsx";
import { comparisonStatement } from "../../../experiments/compare/comparisonStatement.ts";
import { LQ08_COMPARISON, lq08ComparisonParameters } from "../../../experiments/lq08/comparison.ts";
import { createLq08ComparisonSession } from "../../../experiments/lq08/comparisonSession.ts";
import type { createLq08Session } from "../../../experiments/lq08/session.ts";
import { comparisonReplayAdapter } from "../../../reader/notebook/comparisonAdapters.ts";
import {
  type ComparisonPredictionIntent,
  predictionForAccepted,
  predictionIntent,
} from "../../../reader/notebook/predictionIntent.ts";
import type { ReplayPrediction } from "../../../reader/notebook/replayEntry.ts";
import { SaveComparisonReplay } from "../../../reader/notebook/SaveComparisonReplay.tsx";
import "../../../experiments/compare/comparison.css";

const INPUTS = ["incidentPower", "frequency", "workFunction"] as const;
type Input = (typeof INPUTS)[number];
type Controller = ReturnType<typeof createLq08ComparisonSession>;

function shown(value: unknown, input: Input): string {
  const factor = LQ08_COMPARISON.inputs[input]?.displayFactor ?? 1;
  return typeof value === "number" ? String(value * factor) : "";
}

function Comparison({ controller, onClose }: { controller: Controller; onClose(): void }) {
  const uid = useId();
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
  );
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState<Input>("incidentPower");
  const [draft, setDraft] = useState(() =>
    shown(state.variant.parameters.incidentPower, "incidentPower"),
  );
  const [error, setError] = useState("");
  const [nextPrediction, setNextPrediction] = useState<ReplayPrediction | null>(null);
  const [issuedPrediction, setIssuedPrediction] = useState<ComparisonPredictionIntent | null>(null);
  const adapter = comparisonReplayAdapter("lq-08");
  const prediction = predictionForAccepted(issuedPrediction, state);
  const changedInput =
    state.result.kind === "accepted" ? state.result.variation.changedInput : null;
  const field = LQ08_COMPARISON.inputs[input];
  const enabled = ready && state.phase === "live" && !state.pending;

  useEffect(() => {
    controller.connect();
    controller.start();
    setReady(true);
    return () => controller.disconnect();
  }, [controller]);

  useEffect(() => {
    setDraft(shown(state.variant.parameters[input], input));
  }, [input, state.variant]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || !field) return;
    const value = Number(draft.trim());
    const canonical = value / field.displayFactor;
    if (draft.trim() === "" || !Number.isFinite(value) || !Number.isFinite(canonical)) {
      setError("Enter a finite number for the variant " + field.label.toLowerCase() + ".");
      return;
    }
    const requested = { ...state.baseline.parameters, [input]: canonical };
    const intent = predictionIntent(nextPrediction, state, requested);
    setError("");
    if (controller.apply(requested)) setIssuedPrediction(intent);
  }

  return (
    <section
      className="controlled-comparison"
      aria-labelledby={uid + "-title"}
      data-photoelectric-comparison
      data-comparison-phase={state.phase}
      data-comparison-pending={state.pending}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">One input changes · All others stay fixed</p>
          <h3 id={uid + "-title"}>Controlled photoelectric comparison</h3>
        </div>
        <p className="badge">Ideal model, host calculation</p>
      </header>
      <p>
        This comparison keeps the accepted settings you pinned from the apparatus. Its controls
        below affect only the variant here. Exploring the main apparatus does not replace either
        column.
      </p>
      <p role="status" aria-live="polite" aria-atomic="true">
        {state.pending
          ? state.message
          : changedInput === null
            ? "No input has changed. Both columns show the pinned setup."
            : "Completed comparison: only " +
              (LQ08_COMPARISON.inputs[changedInput]?.label.toLowerCase() ?? changedInput) +
              " changed. Every other independent input stayed fixed."}
      </p>
      {(error || state.error) && (
        <p id={uid + "-error"} role="alert" className="notice error">
          {error || state.error}
        </p>
      )}
      <form onSubmit={submit} aria-label="Controlled photoelectric settings">
        <fieldset disabled={!enabled}>
          <legend>Choose one change</legend>
          <label htmlFor={uid + "-input"}>Input to vary</label>
          <select
            id={uid + "-input"}
            name="comparison-input"
            value={input}
            disabled={changedInput !== null}
            onChange={(event) => {
              const value = event.target.value;
              if (INPUTS.some((candidate) => candidate === value)) {
                setInput(value as Input);
                setError("");
              }
            }}
          >
            {INPUTS.map((key) => (
              <option key={key} value={key}>
                {LQ08_COMPARISON.inputs[key]?.label}
              </option>
            ))}
          </select>
          <p className="fine">
            Quantum efficiency and collector potential stay fixed. After changing an input, pin the
            accepted variant as a new baseline or return to the pinned baseline before choosing a
            different input.
          </p>
          <label htmlFor={uid + "-value"}>
            Variant {field?.label.toLowerCase()}
            {field?.unit ? " (" + field.unit + ")" : ""}
          </label>
          <input
            id={uid + "-value"}
            name="comparison-value"
            type="text"
            inputMode="decimal"
            aria-invalid={Boolean(error || state.error)}
            aria-describedby={error || state.error ? uid + "-error" : undefined}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <label htmlFor={uid + "-prediction"}>
            Before comparing: what will happen to the energy per quantum? (Optional)
          </label>
          <select
            id={uid + "-prediction"}
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
            Predict the energy of one quantum at the selected frequency, not how many arrive. Your
            choice is recorded with the next completed comparison; changing it afterward does not
            rewrite that prediction.
          </p>
          <div className="actions">
            <button type="submit">Compare this one change</button>
            <button
              type="button"
              disabled={changedInput === null}
              onClick={() => {
                if (controller.apply(state.baseline.parameters)) {
                  setIssuedPrediction(null);
                  setError("");
                }
              }}
            >
              Return variant to pinned baseline
            </button>
            <button
              type="button"
              disabled={changedInput === null}
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
      <ComparisonPanel
        baseline={state.baseline}
        variant={state.variant}
        contract={LQ08_COMPARISON}
        result={state.result}
      />
      <details>
        <summary>Read the comparison as a statement</summary>
        <p>{comparisonStatement(state.baseline, state.variant, LQ08_COMPARISON, state.result)}</p>
      </details>
      <p className="fine">
        The work function describes a hypothetical surface. With no incident power, an energy per
        quantum still describes the selected frequency but no quanta arrive. When emission is
        forbidden, an electron energy or stopping potential is not applicable; an undetermined
        collector current keeps the model’s explanation.
      </p>
      <SaveComparisonReplay state={state} prediction={prediction} ready={enabled} />
      <div className="actions">
        <button type="button" className="secondary" onClick={onClose}>
          Close controlled comparison
        </button>
      </div>
      <p className="fine">Save any explanation you want to keep before closing this comparison.</p>
    </section>
  );
}

/** No comparison is calculated or restored until the reader explicitly pins accepted settings. */
export function PhotoelectricControlledComparison({
  session,
  sourceDigest,
  enabled,
}: {
  session: ReturnType<typeof createLq08Session>;
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
      const parameters = lq08ComparisonParameters(accepted.parameters);
      setController(
        createLq08ComparisonSession("lq08-comparison-" + uid, parameters, { sourceDigest }),
      );
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The comparison could not be opened.");
    }
  }

  if (controller) return <Comparison controller={controller} onClose={() => setController(null)} />;
  return (
    <section aria-labelledby={uid + "-offer"} data-photoelectric-comparison-offer>
      <h3 id={uid + "-offer"}>Change one input, keep the rest fixed</h3>
      <p>
        Pin the apparatus’s accepted settings, then compare a change of lamp power, frequency or
        hypothetical work function. The two completed results stay beside each other, with an
        optional prediction and a private explanation you can save in your notebook.
      </p>
      <p className="fine">
        The baseline uses the last accepted calculation. Unapplied or refused typed values are not
        included.
      </p>
      <button type="button" disabled={!ready || !enabled} onClick={pin}>
        Pin accepted settings for comparison
      </button>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
    </section>
  );
}
