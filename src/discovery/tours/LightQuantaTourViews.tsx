"use client";

import { useEffect, useMemo, useState } from "react";
import { usePredictGate } from "../../components/lab/PredictGate.tsx";
import type { ExperimentViewProps } from "../../experiments/dispatch.tsx";
import { ExecutionChrome } from "../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../experiments/labels/executionLabelFor.ts";
import { useLaboratoryVisibility } from "../../experiments/lifecycle/useLaboratoryVisibility.ts";
import { createLq01BrowserChannel } from "../../experiments/lq01/browser.ts";
import { LQ01_OUTPUTS } from "../../experiments/lq01/definition.ts";
import { LQ05_OUTPUTS } from "../../experiments/lq05/definition.ts";
import { LQ08_OUTPUTS } from "../../experiments/lq08/definition.ts";
import { usePresentation } from "../../experiments/presentation.ts";
import { deriveHostExecution } from "../../experiments/provenance/executionState.ts";
import {
  type ApplyFailure,
  applyFailure,
  failureCode,
  failureFromThrown,
} from "../../experiments/results/applyFailure.ts";
import { instrumentRootAttributes } from "../../experiments/store/identityAttributes.ts";
import { useInstrumentView } from "../../experiments/store/useExperimentSnapshot.ts";
import { PREDICT_PROMPTS } from "../../generated/predict-prompts.ts";
import type { WorkerChannel } from "../../workers/scheduler/lq01Scheduler.ts";
import { createLightQuantaTourOwner, lightQuantaAcceptedAction } from "./lightQuantaTourOwners.ts";
import type { LightQuantaTourSpec, LightQuantaTourStep } from "./lightQuantaTourSpec.ts";
import { TourResultsTable } from "./MassEnergyTourInstrument.tsx";

function Prediction({ step }: { step: LightQuantaTourStep }) {
  const prompts = useMemo(
    () =>
      (PREDICT_PROMPTS[step.instrumentId] ?? []).filter(
        (prompt) => prompt.promptId === step.promptId,
      ),
    [step.instrumentId, step.promptId],
  );
  const gate = usePredictGate(step.instrumentId, prompts);
  const record = gate.records.get(step.promptId);
  const chosen = record?.choice?.form === "candidate" ? record.choice.candidateId : null;
  const choice = step.choices.find((candidate) => candidate.candidateId === chosen);
  const canPredict = record?.state === "hidden";
  return (
    <fieldset className="mass-energy-tour-prediction" data-tour-prediction={step.promptId}>
      <legend>Keep an optional prediction before changing the settings</legend>
      <p className="fine">
        A recorded choice stays on this device when storage is available. You can also keep your
        prediction to yourself or explore immediately.
      </p>
      <div className="mass-energy-tour-controls">
        {step.choices.map((candidate) => (
          <button
            key={candidate.candidateId}
            type="button"
            data-predict-candidate={candidate.candidateId}
            aria-pressed={chosen === candidate.candidateId}
            disabled={!canPredict}
            onClick={() =>
              gate.record(step.promptId, { form: "candidate", candidateId: candidate.candidateId })
            }
          >
            {candidate.text}
          </button>
        ))}
        <button type="button" disabled={!canPredict} onClick={() => gate.keep(step.promptId)}>
          I have a prediction in mind
        </button>
        <button type="button" disabled={!canPredict} onClick={() => gate.skip(step.promptId)}>
          Explore without recording a prediction
        </button>
      </div>
      <p role="status">
        {choice
          ? "You chose: " + choice.text
          : record?.state === "predicted-unrecorded"
            ? "Your prediction stays with you. The controls are ready."
            : record?.state === "skipped"
              ? "Explore freely. No prediction was recorded."
              : "The controls are available whenever you are ready."}
      </p>
    </fieldset>
  );
}

export function LightQuantaTourView({
  spec,
  step,
  instanceId,
  workerFactory = createLq01BrowserChannel,
}: ExperimentViewProps & {
  spec: LightQuantaTourSpec;
  step: LightQuantaTourStep;
  workerFactory?: () => WorkerChannel;
}) {
  const [owner] = useState(() => createLightQuantaTourOwner(spec, instanceId, workerFactory));
  const [initialAccepted] = useState(() => owner.getSnapshot().accepted);
  const view = useInstrumentView(owner);
  const { presentation } = usePresentation();
  const [failure, setFailure] = useState<ApplyFailure | null>(null);
  const visibility = useMemo(
    () => ({
      setSchedulingPaused(paused: boolean) {
        if ("setSchedulingPaused" in owner) owner.setSchedulingPaused(paused);
      },
    }),
    [owner],
  );
  const region = useLaboratoryVisibility(visibility);
  useEffect(
    () => () => {
      if ("disconnect" in owner) owner.disconnect();
    },
    [owner],
  );
  const contracts =
    spec.id === "lq-01" ? LQ01_OUTPUTS : spec.id === "lq-05" ? LQ05_OUTPUTS : LQ08_OUTPUTS;
  const provenance = deriveHostExecution(
    view,
    contracts,
    spec.sourceDigest,
    view.accepted === initialAccepted,
  );
  const action = lightQuantaAcceptedAction(spec, view);
  function apply(index: number) {
    const next = spec.actions[index];
    if (!next) return;
    try {
      setFailure(applyFailure(owner.apply(next.parameters)));
    } catch (error) {
      setFailure(failureFromThrown(error, "The calculation could not finish."));
    }
  }
  return (
    <section
      ref={region}
      className="mass-energy-tour-live"
      data-tour-owner={spec.id}
      data-presentation={presentation}
      data-source-digest={spec.sourceDigest}
      data-tour-action={action?.id}
      aria-busy={view.pending}
      {...instrumentRootAttributes(view)}
    >
      <h3>Try the comparison</h3>
      <Prediction step={step} />
      <fieldset className="mass-energy-tour-controls">
        <legend>{spec.rowHeading}</legend>
        {spec.actions.map((option, index) => (
          <button
            key={option.id}
            type="button"
            data-tour-control={option.id}
            data-reveal-action={option.id === spec.revealId ? spec.revealId : undefined}
            aria-pressed={option.id === action?.id}
            onClick={() => apply(index)}
          >
            {option.label}
          </button>
        ))}
      </fieldset>
      <ExecutionChrome
        state={executionStateKindFromHostLabel(provenance.label)}
        view={view}
        validationRefusal={failure?.kind === "refused" ? failure.refusal : null}
      />
      {failure ? (
        <p role="alert" data-refusal-code={failureCode(failure)}>
          {failure.text} The table keeps the last accepted result.
        </p>
      ) : null}
      {view.pending ? (
        <p role="status">Calculating the new setting. The table still shows the accepted setting.</p>
      ) : null}
      <div aria-live="polite" aria-atomic="true">
        <TourResultsTable
          columns={spec.columns}
          rowHeading={spec.rowHeading}
          caption="Current accepted comparison"
          rows={
            view.accepted
              ? [
                  {
                    id: action?.id ?? "accepted",
                    label: action?.label ?? "Last accepted setting",
                    outputs: view.accepted.outputs,
                  },
                ]
              : []
          }
        />
      </div>
      <p>{spec.reading}</p>
    </section>
  );
}
