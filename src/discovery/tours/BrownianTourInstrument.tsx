"use client";

import { useEffect, useMemo, useState } from "react";
import { LocalPredictions } from "../../components/lab/LocalPredictions.tsx";
import {
  ExperimentDispatch,
  type ExperimentViewProps,
  type ViewLoaders,
} from "../../experiments/dispatch.tsx";
import { ExecutionLabel } from "../../experiments/labels/ExecutionLabel.tsx";
import { PresentationProvider } from "../../experiments/presentation.ts";
import { BrownianTourHistogram } from "./BrownianTourHistogram.tsx";
import type { BrownianTourSpec, BrownianTourStep } from "./brownianTourSpec.ts";
import { TourResultsTable } from "./MassEnergyTourInstrument.tsx";

/** Full worked comparisons stay in the HTML; interactive owners are a lazy enhancement. */
export function BrownianTourInstrument({
  step,
  spec,
  instanceId,
  readingOnly,
}: {
  step: BrownianTourStep;
  spec: BrownianTourSpec;
  instanceId: string;
  readingOnly?: boolean;
}) {
  const histogramExtent = spec.histogramExtent;
  const histogramMaximum = spec.histogramMaximum;
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const viewLoaders = useMemo<ViewLoaders>(
    () => ({
      [spec.id]: async () => {
        const { BrownianTourView } = await import("./BrownianTourViews.tsx");
        return {
          default: (props: ExperimentViewProps) => (
            <BrownianTourView {...props} spec={spec} step={step} />
          ),
        };
      },
    }),
    [spec, step],
  );
  return (
    <PresentationProvider presentation="tour">
      <div
        className="mass-energy-tour-instrument"
        data-instrument-step={spec.id}
        data-prompt-id={step.promptId}
      >
        <LocalPredictions />
        <p>
          <strong>{step.question}</strong>
        </p>
        <p className="fine">
          Open the answer you expect, or try the controls below. Nothing is scored.
        </p>
        {step.choices.map((choice) => (
          <details key={choice.candidateId} data-candidate-id={choice.candidateId}>
            <summary>{choice.text}</summary>
            <p>{choice.response}</p>
          </details>
        ))}
        <p>{spec.description}</p>
        <p>{spec.limitation}</p>
        <ExperimentDispatch
          id={spec.id}
          instanceId={instanceId}
          presentation="tour"
          question={step.question}
          sourceHref={"/lab/" + spec.id + "/"}
          viewLoaders={viewLoaders}
          readingOnly={!hydrated ? true : readingOnly}
          workedCase={
            <details data-tour-worked-example={spec.id}>
              <summary>Compare the worked results</summary>
              <ExecutionLabel state="static-example" />
              <TourResultsTable
                columns={spec.columns}
                rows={spec.workedRows}
                rowHeading={spec.rowHeading}
                caption="Worked comparison, available without interactive controls"
              />
              {spec.histograms && histogramExtent && histogramMaximum
                ? spec.histograms.map((item) => (
                    <BrownianTourHistogram
                      key={item.id}
                      histogram={item.data}
                      label={item.label}
                      extent={histogramExtent}
                      maximum={histogramMaximum}
                    />
                  ))
                : null}
              <p>{spec.reading}</p>
            </details>
          }
        />
        <div className="guided-tour-actions">
          <a href={spec.sourceHref}>Read the source passage beside its English translation</a>
          <a href={"/lab/" + spec.id + "/"}>
            Open {spec.id.toUpperCase()} in full (this shows equations)
          </a>
          {spec.walkthroughHref ? (
            <a href={spec.walkthroughHref}>Open the recorded coin-to-bell walkthrough</a>
          ) : null}
          <a href="#tour-finish">Continue to what the paper claims</a>
        </div>
      </div>
    </PresentationProvider>
  );
}
