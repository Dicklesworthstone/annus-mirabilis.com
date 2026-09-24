import type { ReactElement } from "react";
import { datasetWithheldReason } from "../../content/datasets/plotVerdict.ts";
import type { HistoricalDataset } from "../../content/schemas/experiment.ts";

/**
 * What a dataset view shows in place of a record whose values may not be shown
 * (datasetValuesMayBeShown): the record's title and the reason, and none of its rows.
 */
export function DatasetWithheld({
  dataset,
  className = "",
}: {
  readonly dataset: HistoricalDataset;
  readonly className?: string | undefined;
}): ReactElement {
  return (
    <div
      className={className ? className.trim() : undefined}
      data-testid="dataset-withheld"
      data-dataset-id={dataset.id}
    >
      <p>
        <strong>{dataset.title}</strong>: not shown.
      </p>
      <p className="fine">{datasetWithheldReason(dataset)}</p>
    </div>
  );
}
