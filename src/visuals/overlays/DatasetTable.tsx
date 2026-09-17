import type { ReactElement } from "react";
import type { DataCell, HistoricalDataset } from "../../content/schemas/experiment.ts";

export interface DatasetTableProps {
  readonly dataset: HistoricalDataset;
  readonly seriesId?: string | undefined;
  readonly selectedRowIndex?: number | undefined;
  readonly onSelectRow?: ((rowIndex: number) => void) | undefined;
  readonly className?: string | undefined;
}

/**
 * Accessible tabular view of historical dataset rows, column roles, and fit summaries.
 */
export function DatasetTable({
  dataset,
  seriesId,
  selectedRowIndex,
  onSelectRow,
  className = "",
}: DatasetTableProps): ReactElement {
  const rows = seriesId ? dataset.rows.filter((r) => r.seriesId === seriesId) : dataset.rows;

  const publication =
    dataset.publications.find((p) => p.id === dataset.primaryPublicationId) ??
    dataset.publications[0];
  const citationText =
    typeof publication?.citation === "string"
      ? publication.citation
      : (publication?.citation?.title ?? dataset.title);

  const relevantFits =
    dataset.fits?.filter((f) => !seriesId || !f.seriesId || f.seriesId === seriesId) ?? [];

  return (
    <div
      className={`dataset-table-container overflow-x-auto text-xs ${className}`.trim()}
      data-testid="dataset-table"
    >
      <table className="w-full border-collapse border border-neutral-300 dark:border-neutral-700">
        <caption className="text-left font-serif p-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border-b border-neutral-300 dark:border-neutral-700">
          <span className="font-semibold">{dataset.title}</span>: {citationText}
        </caption>
        <thead>
          <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-300 dark:border-neutral-700">
            <th
              scope="col"
              className="p-2 text-left font-semibold border-r dark:border-neutral-700 w-12"
            >
              #
            </th>
            {dataset.columns.map((col, cIdx) => (
              <th
                key={`th-col-${col.quantityId || `col-${cIdx}`}`}
                scope="col"
                className="p-2 text-left font-semibold border-r dark:border-neutral-700 last:border-r-0"
                data-quantity-id={col.quantityId}
                data-column-role={col.role}
              >
                <div>{col.name}</div>
                <div className="font-normal font-mono text-[10px] text-neutral-500">
                  [{col.unit}] • <span className="italic">{col.role}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => {
            const isSelected = selectedRowIndex === rIdx;
            const rowKey = `tbl-row-${dataset.id}-${row.seriesId ?? "s"}-${row.cells.map((c) => (c.kind === "number" ? String(c.value) : c.kind)).join(":")}`;
            return (
              <tr
                key={rowKey}
                className={`border-b dark:border-neutral-800 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50 ${isSelected ? "bg-amber-100/60 dark:bg-amber-950/40 font-semibold" : ""}`.trim()}
                onClick={() => onSelectRow?.(rIdx)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectRow?.(rIdx);
                  }
                }}
                tabIndex={0}
                data-row-index={rIdx}
                data-selected={isSelected}
              >
                <td className="p-2 font-mono text-neutral-400 border-r dark:border-neutral-700">
                  {rIdx}
                </td>
                {row.cells.map((cell: DataCell, cIdx: number) => {
                  const col = dataset.columns[cIdx];
                  let cellContent: ReactElement | string;
                  if (cell.kind === "number") {
                    cellContent = <span className="font-mono">{cell.value}</span>;
                  } else if (cell.kind === "bound") {
                    cellContent = (
                      <span
                        className="font-mono text-amber-700 dark:text-amber-300"
                        title={`Apparatus bound: ${cell.direction}`}
                      >
                        {cell.direction === "upper" ? "≤ " : "≥ "}
                        {cell.value}
                      </span>
                    );
                  } else {
                    cellContent = (
                      <span
                        className="italic text-neutral-500 font-sans"
                        title="Missing observation"
                      >
                        {cell.reason}
                      </span>
                    );
                  }

                  return (
                    <td
                      key={`td-${col?.quantityId ?? `cell-${cIdx}`}`}
                      className="p-2 border-r dark:border-neutral-700 last:border-r-0"
                    >
                      {cellContent}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Fit & Reanalysis Summaries */}
      {relevantFits.length > 0 && (
        <div className="fits-summary mt-4 p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded">
          <h4 className="font-semibold text-xs text-neutral-800 dark:text-neutral-200 mb-2">
            Historical Fits & Parameters
          </h4>
          {relevantFits.map((fit) => (
            <div
              key={`fit-${fit.id}`}
              className="mb-3 last:mb-0 text-xs border-b last:border-b-0 pb-2 dark:border-neutral-800"
              data-fit-id={fit.id}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {fit.label}
                </span>
                <span className="text-neutral-500 text-[11px]">
                  Objective: {fit.fitObjective} • Used: {fit.rowsUsed.length} / Excluded:{" "}
                  {fit.rowsExcluded.length}
                </span>
              </div>
              {fit.fitDescription && (
                <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mb-1">
                  {fit.fitDescription}
                </p>
              )}

              {/* Excluded rows reasons */}
              {fit.rowsExcluded.length > 0 && (
                <div className="exclusions-list text-[11px] text-amber-800 dark:text-amber-300 my-1">
                  <strong>Excluded rows:</strong>
                  <ul className="list-disc pl-4 mt-0.5">
                    {fit.rowsExcluded.map((ex) => (
                      <li key={`ex-${ex.rowIndex}`}>
                        Row {ex.rowIndex}: {ex.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Parameter table */}
              <div className="parameters-list text-[11px] mt-1">
                <span className="font-semibold">Parameters:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {fit.parameters.map((p) => (
                    <span
                      key={`p-${p.name}`}
                      className="p-1 bg-white dark:bg-neutral-800 border rounded font-mono"
                    >
                      {p.name} = {p.value} {p.unit} (
                      <em>
                        {p.source === "fitted-here"
                          ? "fitted here"
                          : `imported: ${p.sourceCitation ?? "prior source"}`}
                      </em>
                      )
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
