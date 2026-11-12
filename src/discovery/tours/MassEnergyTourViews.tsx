"use client";

import { useMemo, useState } from "react";
import { usePredictGate } from "../../components/lab/PredictGate.tsx";
import type { ExperimentViewProps } from "../../experiments/dispatch.tsx";
import { ExecutionChrome } from "../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../experiments/labels/executionLabelFor.ts";
import { ME01_OUTPUTS } from "../../experiments/me01/definition.ts";
import { createMe01Session } from "../../experiments/me01/session.ts";
import { ME02_OUTPUTS } from "../../experiments/me02/definition.ts";
import { createMe02Session } from "../../experiments/me02/session.ts";
import { ME03_OUTPUTS } from "../../experiments/me03/definition.ts";
import { createMe03Session } from "../../experiments/me03/session.ts";
import { usePresentation } from "../../experiments/presentation.ts";
import { deriveHostExecution } from "../../experiments/provenance/executionState.ts";
import type { RequestRefusal } from "../../experiments/results/refusals.ts";
import { instrumentRootAttributes } from "../../experiments/store/identityAttributes.ts";
import { useInstrumentView } from "../../experiments/store/useExperimentSnapshot.ts";
import { PREDICT_PROMPTS } from "../../generated/predict-prompts.ts";
import { TourResultsTable } from "./MassEnergyTourInstrument.tsx";
import type { MassEnergyTourSpec, TourInstrumentStep } from "./massEnergyTourSpec.ts";

function createOwner(spec: MassEnergyTourSpec, instanceId: string) {
  if (spec.id === "me-01") return createMe01Session(instanceId, spec.initial);
  if (spec.id === "me-03") return createMe03Session(instanceId, spec.initial);
  const owner = createMe02Session(instanceId, spec.example);
  owner.apply(spec.initial);
  return owner;
}

function Prediction({ step }: { step: TourInstrumentStep }) {
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
  const choiceText = step.choices.find((choice) => choice.candidateId === chosen)?.text;
  const canPredict = record?.state === "hidden";
  return (
    <fieldset className="mass-energy-tour-prediction" data-tour-prediction={step.promptId}>
      <legend>Keep an optional prediction before changing the settings</legend>
      <p className="fine">
        Choices stay on this device when browser storage is available. You can also keep your answer
        to yourself or explore directly.
      </p>
      <div className="mass-energy-tour-controls">
        {step.choices.map((choice) => (
          <button
            key={choice.candidateId}
            type="button"
            data-predict-candidate={choice.candidateId}
            aria-pressed={chosen === choice.candidateId}
            disabled={!canPredict}
            onClick={() =>
              gate.record(step.promptId, { form: "candidate", candidateId: choice.candidateId })
            }
          >
            {choice.text}
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
        {choiceText
          ? `You chose: ${choiceText}`
          : record?.state === "predicted-unrecorded"
            ? "Your prediction stays with you. The controls are ready."
            : record?.state === "skipped"
              ? "Explore freely. No prediction was recorded."
              : "The controls are available whenever you are ready."}
      </p>
    </fieldset>
  );
}

/** Compact tour faces subscribe to the same owners as the full laboratories; no second evaluator. */
export function MassEnergyTourView({
  spec,
  step,
  instanceId,
}: ExperimentViewProps & { spec: MassEnergyTourSpec; step: TourInstrumentStep }) {
  const [owner] = useState(() => createOwner(spec, instanceId));
  const [initialAccepted] = useState(() => owner.getSnapshot().accepted);
  const view = useInstrumentView(owner);
  const { presentation } = usePresentation();
  const [selected, setSelected] = useState(0);
  const [refusal, setRefusal] = useState<RequestRefusal | null>(null);
  const contracts =
    spec.id === "me-01" ? ME01_OUTPUTS : spec.id === "me-02" ? ME02_OUTPUTS : ME03_OUTPUTS;
  const provenance = deriveHostExecution(
    view,
    contracts,
    spec.sourceDigest,
    view.accepted === initialAccepted,
  );
  const action = spec.actions[selected];
  const apply = (index: number) => {
    const next = spec.actions[index];
    if (!next) return;
    const result = owner.apply(next.parameters);
    if (result.kind !== "accepted") {
      setRefusal(result.refusal);
      return;
    }
    setRefusal(null);
    setSelected(index);
  };
  return (
    <section
      className="mass-energy-tour-live"
      data-tour-owner={spec.id}
      data-presentation={presentation}
      data-source-digest={spec.sourceDigest}
      data-tour-action={action?.id}
      data-tape-action-index={action?.tapeActionIndex}
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
            aria-pressed={index === selected}
            onClick={() => apply(index)}
          >
            {option.label}
          </button>
        ))}
      </fieldset>
      {spec.id === "me-02" && selected < spec.actions.length - 1 ? (
        <p>
          <button type="button" data-tour-next onClick={() => apply(selected + 1)}>
            Continue to the next recorded speed
          </button>
        </p>
      ) : null}
      <ExecutionChrome
        state={executionStateKindFromHostLabel(provenance.label)}
        view={view}
        validationRefusal={refusal}
      />
      {refusal ? (
        <p role="alert" data-refusal-code={refusal.code}>
          Those settings were not accepted. The table still shows the last accepted result.
        </p>
      ) : null}
      <div aria-live="polite" aria-atomic="true">
        <TourResultsTable
          columns={spec.columns}
          rowHeading={spec.rowHeading}
          caption="Current accepted comparison"
          rows={
            view.accepted && action
              ? [{ id: action.id, label: action.label, outputs: view.accepted.outputs }]
              : []
          }
        />
      </div>
      <p>{spec.reading}</p>
    </section>
  );
}
