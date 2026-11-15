"use client";

import { useEffect, useMemo, useState } from "react";
import { usePredictGate } from "../../components/lab/PredictGate.tsx";
import type { ExperimentViewProps } from "../../experiments/dispatch.tsx";
import { ExecutionChrome } from "../../experiments/labels/ExecutionChrome.tsx";
import { useLaboratoryVisibility } from "../../experiments/lifecycle/useLaboratoryVisibility.ts";
import { usePresentation } from "../../experiments/presentation.ts";
import { type ApplyFailure, applyFailure, failureCode, failureFromThrown } from "../../experiments/results/applyFailure.ts";
import { instrumentRootAttributes } from "../../experiments/store/identityAttributes.ts";
import { useInstrumentView } from "../../experiments/store/useExperimentSnapshot.ts";
import { PREDICT_PROMPTS } from "../../generated/predict-prompts.ts";
import type { WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import { BrownianTourHistogram } from "./BrownianTourHistogram.tsx";
import { brownianAcceptedAction, brownianTourExecution, createBrownianTourOwner } from "./brownianTourOwners.ts";
import { brownianHistogram } from "./brownianTourPresentation.ts";
import type { BrownianTourSpec, BrownianTourStep } from "./brownianTourSpec.ts";
import { TourResultsTable } from "./MassEnergyTourInstrument.tsx";

function Prediction({ step, revealed }: { step: BrownianTourStep; revealed: boolean }) {
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
      {revealed && choice ? <p data-tour-prediction-feedback>{choice.response}</p> : null}
    </fieldset>
  );
}


export function BrownianTourView({
  spec,
  step,
  instanceId,
  workerFactory,
}: ExperimentViewProps & {
  spec: BrownianTourSpec;
  step: BrownianTourStep;
  workerFactory?: () => WorkerChannel;
}) {
  const [owner] = useState(() => createBrownianTourOwner(spec, instanceId, workerFactory));
  const [initialAccepted] = useState(() => owner.getSnapshot().accepted);
  const view = useInstrumentView(owner);
  const { presentation } = usePresentation();
  const [failure, setFailure] = useState<ApplyFailure | null>(null);
  const region = useLaboratoryVisibility(owner);
  useEffect(() => () => owner.disconnect(), [owner]);
  const action = brownianAcceptedAction(spec, view);
  const execution = brownianTourExecution(spec, view, view.accepted === initialAccepted);
  const histogram = useMemo(() => spec.id === "bm-05" && view.accepted
    ? brownianHistogram(view.accepted.outputs) : null, [spec.id, view.accepted]);
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
      <Prediction step={step} revealed={Boolean(view.accepted?.final && view.accepted !== initialAccepted)} />
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
        state={execution}
        view={view}
        validationRefusal={failure?.kind === "refused" ? failure.refusal : null}
      />
      {failure ? (
        <p role="alert" data-refusal-code={failureCode(failure)}>
          {failure.text} The table and plot keep the last accepted result.
        </p>
      ) : null}
      {view.pending ? (
        <p role="status">Calculating the new setting. The table and plot still show the accepted setting.</p>
      ) : null}
      <div aria-live="polite" aria-atomic="true">
        <TourResultsTable
          columns={spec.columns}
          rowHeading={spec.rowHeading}
          caption="Current accepted comparison"
          rows={view.accepted ? [{
            id: action?.id ?? "accepted",
            label: action?.label ?? "Last accepted setting",
            outputs: view.accepted.outputs,
          }] : []}
        />
      </div>
      {histogram && spec.histogramExtent && spec.histogramMaximum ? (
        <BrownianTourHistogram
          histogram={histogram}
          label={action?.label ?? "Last accepted setting"}
          extent={spec.histogramExtent}
          maximum={spec.histogramMaximum}
        />
      ) : null}
      {execution === "frankensim-accepted" ? (
        <p className="fine">
          FrankenSim supplies the random draws for these paths. The host calculates the
          displayed statistics and model comparisons from them.
        </p>
      ) : null}
      <p>{spec.reading}</p>
    </section>
  );
}
