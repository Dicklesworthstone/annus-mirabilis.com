import { type ReactElement, useState } from "react";
import { getDatasetShelfStatus } from "../../content/datasets/shelf.ts";
import type { DataCell, HistoricalDataset } from "../../content/schemas/experiment.ts";
import type { Projector } from "../kit/types.ts";
import { DatasetEvidenceReveal } from "./DatasetEvidenceReveal.tsx";
import { DatasetTable } from "./DatasetTable.tsx";

export interface DatasetOverlayProps {
  readonly dataset: HistoricalDataset;
  readonly seriesId?: string | undefined;
  readonly xColumnIndex?: number | undefined;
  readonly yColumnIndex?: number | undefined;
  readonly xProjector: Projector;
  readonly yProjector: Projector;
  readonly normalizationFactor?: number | undefined;
  readonly normalizationMethod?: string | undefined;
  readonly selectedRowIndex?: number | undefined;
  readonly onSelectRow?: ((rowIndex: number | undefined) => void) | undefined;
  readonly showTable?: boolean | undefined;
  readonly showRevealAction?: boolean | undefined;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  readonly className?: string | undefined;
}

/**
 * Historical dataset visual overlay for SVG instruments.
 * Renders empirical observations, bounds, and fitted laws with non-color differentiators.
 */
export function DatasetOverlay({
  dataset,
  seriesId,
  xColumnIndex = 0,
  yColumnIndex = 1,
  xProjector,
  yProjector,
  normalizationFactor,
  normalizationMethod,
  selectedRowIndex,
  onSelectRow,
  showTable = false,
  showRevealAction = true,
  width = 500,
  height = 400,
  className = "",
}: DatasetOverlayProps): ReactElement {
  const [internalSelectedRow, setInternalSelectedRow] = useState<number | undefined>(
    selectedRowIndex,
  );
  const [isRevealOpen, setIsRevealOpen] = useState(false);

  const activeRowIdx = selectedRowIndex !== undefined ? selectedRowIndex : internalSelectedRow;

  const handleRowSelect = (idx: number | undefined) => {
    setInternalSelectedRow(idx);
    onSelectRow?.(idx);
  };

  const rows = seriesId ? dataset.rows.filter((r) => r.seriesId === seriesId) : dataset.rows;

  const xCol = dataset.columns[xColumnIndex] ?? dataset.columns[0];
  const yCol = dataset.columns[yColumnIndex] ?? dataset.columns[1];

  const publication =
    dataset.publications.find((p) => p.id === dataset.primaryPublicationId) ??
    dataset.publications[0];
  const citationText =
    typeof publication?.citation === "string"
      ? publication.citation
      : (publication?.citation?.sourceTitle ?? dataset.title);

  const shelfStatus = getDatasetShelfStatus(dataset, seriesId);

  return (
    <div
      className={`dataset-overlay-container ${className}`.trim()}
      data-testid="dataset-overlay"
      data-dataset-id={dataset.id}
    >
      {/* Top Citation & Metadata Bar */}
      <div className="dataset-header flex flex-wrap items-center justify-between gap-2 mb-2 text-xs">
        <div className="flex items-center gap-2">
          <span
            className="dataset-citation font-serif font-semibold text-neutral-800 dark:text-neutral-200"
            data-testid="dataset-citation"
          >
            {citationText} ({shelfStatus.publicationYear})
          </span>

          {/* Post-1904 non-shelf warning badge */}
          {shelfStatus.badgeLabel && (
            <span
              className="shelf-badge px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700 text-[11px]"
              data-testid="shelf-badge"
            >
              {shelfStatus.badgeLabel}
            </span>
          )}

          {/* Normalization factor note */}
          {normalizationFactor !== undefined && (
            <span className="norm-badge px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-[11px]">
              Norm: ×{normalizationFactor} {normalizationMethod ? `(${normalizationMethod})` : ""}
            </span>
          )}
        </div>

        {/* Action Button: Show where this came from */}
        {showRevealAction && (
          <button
            type="button"
            className="reveal-trigger-btn px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition-colors shadow-sm"
            onClick={() => setIsRevealOpen((prev) => !prev)}
            data-testid="reveal-trigger"
          >
            {isRevealOpen ? "Hide Source Provenance" : "Show where this came from"}
          </button>
        )}
      </div>

      {/* SVG Layer with Overlay Points and Bounds */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="dataset-overlay-svg overflow-visible"
        role="group"
        aria-label={`Historical dataset: ${dataset.title}`}
      >
        {rows.map((row, rIdx) => {
          const xCell: DataCell | undefined = row.cells[xColumnIndex];
          const yCell: DataCell | undefined = row.cells[yColumnIndex];

          if (!xCell || !yCell) return null;
          if (xCell.kind === "missing" || yCell.kind === "missing") return null;

          const rawX = xCell.value;
          const rawY = yCell.value * (normalizationFactor ?? 1);

          const px = xProjector(rawX);
          const py = yProjector(rawY);

          if (!Number.isFinite(px) || !Number.isFinite(py)) return null;

          const isSelected = activeRowIdx === rIdx;
          const isYBound = yCell.kind === "bound";
          const isXBound = xCell.kind === "bound";
          const isReportedFit = yCol?.role === "reported-fit" || xCol?.role === "reported-fit";

          return (
            <g
              key={`dp-${rIdx}`}
              className={`dataset-point cursor-pointer ${isSelected ? "is-selected" : ""}`}
              data-row-index={rIdx}
              data-role={yCol?.role ?? "observed"}
              onClick={() => handleRowSelect(rIdx)}
            >
              {/* 1. Bounded Cell: Draw bounded directional arrow / bracket */}
              {(isYBound || isXBound) && (
                <g
                  className="bound-marker"
                  data-bound-direction={isYBound ? yCell.direction : xCell.direction}
                  aria-label={`Bound: ${isYBound ? yCell.direction : xCell.direction} ${isYBound ? yCell.value : xCell.value}`}
                >
                  <line
                    x1={px}
                    y1={py - (isYBound && yCell.direction === "upper" ? 12 : -12)}
                    x2={px}
                    y2={py}
                    stroke="currentColor"
                    strokeWidth={2}
                  />
                  {/* Arrowhead / bar indicating bound cap */}
                  <line
                    x1={px - 5}
                    y1={py}
                    x2={px + 5}
                    y2={py}
                    stroke="currentColor"
                    strokeWidth={2}
                  />
                </g>
              )}

              {/* 2. Reported Fit: Draw diamond marker */}
              {isReportedFit && !isYBound && !isXBound && (
                <polygon
                  points={`${px},${py - 5} ${px + 5},${py} ${px},${py + 5} ${px - 5},${py}`}
                  fill={isSelected ? "#b45309" : "currentColor"}
                  stroke="white"
                  strokeWidth={1}
                  data-testid="reported-fit-marker"
                />
              )}

              {/* 3. Standard Empirical Measurement Point: Draw circle with uncertainty */}
              {!isReportedFit && !isYBound && !isXBound && (
                <circle
                  cx={px}
                  cy={py}
                  r={isSelected ? 5 : 3.5}
                  fill={isSelected ? "#b45309" : "currentColor"}
                  stroke="white"
                  strokeWidth={1.2}
                  data-testid="empirical-point"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* 4-Step Disclosure Panel */}
      {isRevealOpen && (
        <div className="mt-4">
          <DatasetEvidenceReveal
            dataset={dataset}
            seriesId={seriesId}
            selectedRowIndex={activeRowIdx}
            onSelectRow={handleRowSelect}
            normalizationFactor={normalizationFactor}
          />
        </div>
      )}

      {/* Embedded Table if requested */}
      {showTable && (
        <div className="mt-4">
          <DatasetTable
            dataset={dataset}
            seriesId={seriesId}
            selectedRowIndex={activeRowIdx}
            onSelectRow={handleRowSelect}
          />
        </div>
      )}
    </div>
  );
}
