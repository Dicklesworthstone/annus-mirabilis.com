"use client";

import { useEffect, useMemo, useState } from "react";
import { PredictGatePanels, usePredictGate } from "../../components/lab/PredictGate.tsx";
import type { ExperimentViewProps } from "../../experiments/dispatch.tsx";
import { ExecutionChrome } from "../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../experiments/labels/executionLabelFor.ts";
import { useLaboratoryVisibility } from "../../experiments/lifecycle/useLaboratoryVisibility.ts";
import { usePresentation } from "../../experiments/presentation.ts";
import { deriveHostExecution } from "../../experiments/provenance/executionState.ts";
import {
  type ApplyFailure,
  applyFailure,
  failureCode,
  failureFromThrown,
} from "../../experiments/results/applyFailure.ts";
import { SR01_OUTPUTS } from "../../experiments/sr01/definition.ts";
import { createSr03BrowserChannel } from "../../experiments/sr03/browser.ts";
import { SR03_OUTPUTS } from "../../experiments/sr03/definition.ts";
import { SR06_OUTPUTS } from "../../experiments/sr06/definition.ts";
import { SR09_OUTPUTS } from "../../experiments/sr09/definition.ts";
import { instrumentRootAttributes } from "../../experiments/store/identityAttributes.ts";
import { useInstrumentView } from "../../experiments/store/useExperimentSnapshot.ts";
import type { WorkerChannel } from "../../workers/scheduler/sr03Scheduler.ts";
import { TourResultsTable } from "./MassEnergyTourInstrument.tsx";
import { createRelativityTourOwner, relativityAcceptedAction } from "./relativityTourOwners.ts";
import type { RelativityTourSpec, RelativityTourStep } from "./relativityTourSpec.ts";

export function RelativityTourView({
  spec,
  step,
  instanceId,
  workerFactory = createSr03BrowserChannel,
}: ExperimentViewProps & {
  spec: RelativityTourSpec;
  step: RelativityTourStep;
  workerFactory?: () => WorkerChannel;
}) {
  const [owner] = useState(() => createRelativityTourOwner(spec, instanceId, workerFactory));
  const [initialAccepted] = useState(() => owner.getSnapshot().accepted);
  const view = useInstrumentView(owner);
  const { presentation } = usePresentation();
  const [failure, setFailure] = useState<ApplyFailure | null>(null);
  const prompts = useMemo(() => [spec.prompt], [spec.prompt]);
  const gate = usePredictGate(spec.id, prompts);
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
  const contracts = {
    "sr-01": SR01_OUTPUTS,
    "sr-03": SR03_OUTPUTS,
    "sr-06": SR06_OUTPUTS,
    "sr-09": SR09_OUTPUTS,
  }[spec.id];
  const provenance = deriveHostExecution(
    view,
    contracts,
    spec.sourceDigest,
    view.accepted === initialAccepted,
  );
  const action = relativityAcceptedAction(spec, view);

  function apply(index: number) {
    const next = spec.actions[index];
    if (!next) return;
    // The authored question asks about the opening state. Exploring another state is
    // an explicit skip, never a scored answer to a different physical comparison.
    if (!gate.open) gate.skip(step.promptId);
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
      <p className="fine">
        Predict the opening setting, keep a prediction to yourself, or choose a setting to
        explore immediately. The prediction above the table concerns the opening setting.
      </p>
      <PredictGatePanels gate={gate} reasoningHref={spec.sourceHref} />
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
        <p role="status">
          Calculating the new setting. The table still shows the accepted setting.
        </p>
      ) : null}
      <div {...gate.response} aria-live="polite" aria-atomic="true">
        <TourResultsTable
          columns={spec.columns}
          rowHeading={spec.rowHeading}
          caption="Current accepted comparison"
          rows={
            view.accepted
              ? [{
                  id: action?.id ?? "accepted",
                  label: action?.label ?? "Last accepted setting",
                  outputs: view.accepted.outputs,
                }]
              : []
          }
        />
        <p>{spec.reading}</p>
      </div>
    </section>
  );
}
