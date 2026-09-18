/**
 * Inspectable Data Table for Layer 3 accessible graph descriptions (am-a11y-graph-descriptions-vxe1).
 *
 * Rules:
 * 1. Semantic HTML: table, caption, thead, tbody, th, td with correct scope attributes.
 * 2. Bounded and paginated: configurable pageSize, accessible pagination controls, keyboard navigable.
 * 3. Physical units are rendered accurately for all columns and cells.
 * 4. Carries data-snapshot-version and data-layer="3" matching the view's accepted snapshot.
 * 5. Includes accessible RepresentationScale facts table when scale is provided.
 */

import { type ReactElement, useState } from "react";
import { getScaleFactRows } from "../../visuals/kit/scale.ts";
import type { RepresentationScale } from "../../visuals/kit/types.ts";
import "./descriptions.css";

export interface DataTableRow {
  readonly id: string | number;
  readonly label: string;
  readonly values: readonly (string | number)[];
}

export interface DataTableColumn {
  readonly id: string;
  readonly header: string;
  readonly unit?: string | undefined;
}

export interface DataTableProps {
  readonly caption: string;
  readonly columns: readonly DataTableColumn[];
  readonly rows: readonly DataTableRow[];
  readonly snapshotVersion: string | number;
  readonly pageSize?: number | undefined;
  readonly scale?: RepresentationScale | undefined;
  readonly className?: string | undefined;
}

export function DataTable({
  caption,
  columns,
  rows,
  snapshotVersion,
  pageSize = 20,
  scale,
  className = "inspectable-data-table-container",
}: DataTableProps): ReactElement {
  const [currentPage, setCurrentPage] = useState<number>(0);

  const boundedPageSize = Math.min(100, Math.max(1, pageSize));
  const totalPages = Math.max(1, Math.ceil(rows.length / boundedPageSize));
  const safePage = Math.min(currentPage, totalPages - 1);
  const startIdx = safePage * boundedPageSize;
  const pageRows = rows.slice(startIdx, startIdx + boundedPageSize);

  const scaleRows = scale ? getScaleFactRows(scale) : [];

  return (
    <div
      className={className}
      data-layer="3"
      data-table="inspectable"
      data-snapshot-version={String(snapshotVersion)}
    >
      <div className="table-scroll-container">
        <table className="inspectable-table inspectable-data-table" aria-label={caption}>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Row</th>
              {columns.map((col) => (
                <th key={col.id} scope="col">
                  {col.header}
                  {col.unit && col.unit !== "dimensionless" && col.unit !== "1" ? (
                    <span className="table-col-unit"> ({col.unit})</span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.label}</th>
                {row.values.map((val, idx) => {
                  const colId = columns[idx]?.id ?? `col-${idx}`;
                  return <td key={`${row.id}-${colId}`}>{val}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav
          className="table-pagination"
          aria-label={`Pagination for ${caption}`}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              setCurrentPage((p) => Math.max(0, p - 1));
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
            }
          }}
        >
          <button
            type="button"
            className="pagination-btn prev-btn"
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            aria-label="Previous table page"
          >
            Previous
          </button>
          <span className="pagination-info" aria-live="polite">
            Page {safePage + 1} of {totalPages} ({rows.length} total entries)
          </span>
          <button
            type="button"
            className="pagination-btn next-btn"
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            aria-label="Next table page"
          >
            Next
          </button>
        </nav>
      )}

      {scaleRows.length > 0 && (
        <details className="scale-facts-disclosure scale-facts-details" open={false}>
          <summary>Representation scale facts (5 independent parameters)</summary>
          <table className="scale-facts-table">
            <caption>Declared representational scales for this visualization</caption>
            <thead>
              <tr>
                <th scope="col">Dimension</th>
                <th scope="col">Declared Fact</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {scaleRows.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.label}</th>
                  <td>{row.value}</td>
                  <td>{row.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
