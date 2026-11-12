"use client";

import { useEffect, useMemo, useState } from "react";
import { LocalPredictions } from "../../components/lab/LocalPredictions.tsx";
import {
  ExperimentDispatch,
  type ExperimentViewProps,
  type ViewLoaders,
} from "../../experiments/dispatch.tsx";
import { ExecutionLabel } from "../../experiments/labels/ExecutionLabel.tsx";
import { PresentationProvider, usePresentation } from "../../experiments/presentation.ts";
import { outputStatusRegistry } from "../../experiments/results/types.ts";
import type { PublishedResult } from "../../experiments/store/instanceStore.ts";
import type {
  MassEnergyTourSpec,
  TourColumn,
  TourInstrumentStep,
  TourResultRow,
} from "./massEnergyTourSpec.ts";
import "./massEnergyTour.css";

const number = new Intl.NumberFormat("en", { maximumSignificantDigits: 7 });

function scalar(result: PublishedResult | undefined): number | null {
  if (result?.status === "value" && typeof result.value === "number") return result.value;
  if (result?.status === "analytic-limit" && result.representation.kind === "coefficient")
    return result.representation.value;
  return null;
}

function resultText(result: PublishedResult | undefined, column: TourColumn): string {
  if (!result) return "No accepted result";
  const value = scalar(result);
  if (value === null) return outputStatusRegistry[result.status].message;
  if (column.format === "direction")
    return value === 0 ? "Unchanged" : value < 0 ? "Decreases" : "Increases";
  const formatted = number.format(column.format === "percent" ? value * 100 : value);
  return result.status === "analytic-limit" ? `Analytic limit: ${formatted}` : formatted;
}

/** The same accessible table renders prepared and live accepted owner outputs. */
export function TourResultsTable({
  columns,
  rows,
  rowHeading,
  caption,
}: {
  columns: readonly TourColumn[];
  rows: readonly TourResultRow[];
  rowHeading: string;
  caption: string;
}) {
  const { quantityLabel } = usePresentation();
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard readers must be able to scroll the table's columns at narrow widths.
    <section className="mass-energy-tour-table" aria-label={caption} tabIndex={0}>
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{rowHeading}</th>
            {columns.map((column) => (
              <th key={column.quantityId} scope="col">
                {quantityLabel(column.quantityId) ?? column.label}
                <span className="mass-energy-tour-unit">{column.unit}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-tour-result-row={row.id}>
              <th scope="row">{row.label}</th>
              {columns.map((column) => {
                const result = row.outputs.find(
                  (output) => output.quantityId === column.quantityId,
                );
                return (
                  <td
                    key={column.quantityId}
                    data-quantity-id={column.quantityId}
                    data-status={result?.status}
                    data-owner-id={result?.ownerId}
                    data-value={scalar(result) ?? undefined}
                  >
                    {resultText(result, column)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function MassEnergyTourInstrument({
  step,
  spec,
  instanceId,
  readingOnly,
}: {
  step: TourInstrumentStep;
  spec: MassEnergyTourSpec;
  instanceId: string;
  readingOnly?: boolean;
}) {
  // No live owner mounts during SSR. The dispatcher takes over the reader's saved reading-only
  // preference after hydration; its explicit load action remains the only override of that mode.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const viewLoaders = useMemo<ViewLoaders>(
    () => ({
      [spec.id]: async () => {
        const { MassEnergyTourView } = await import("./MassEnergyTourViews.tsx");
        return {
          default: (props: ExperimentViewProps) => (
            <MassEnergyTourView {...props} spec={spec} step={step} />
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
        <details data-tour-worked-example={spec.id}>
          <summary>Compare the worked results</summary>
          <ExecutionLabel state="static-example" />
          <TourResultsTable
            columns={spec.columns}
            rows={spec.workedRows}
            rowHeading={spec.rowHeading}
            caption="Worked comparison, available without interactive controls"
          />
          <p>{spec.reading}</p>
        </details>
        <ExperimentDispatch
          id={spec.id}
          instanceId={instanceId}
          presentation="tour"
          sourceHref={`/lab/${spec.id}/`}
          viewLoaders={viewLoaders}
          readingOnly={!hydrated ? true : readingOnly}
        />
        <div className="guided-tour-actions">
          <a href={`/lab/${spec.id}/`}>
            Open {spec.id.toUpperCase()} in full (this shows equations)
          </a>
        </div>
      </div>
    </PresentationProvider>
  );
}
