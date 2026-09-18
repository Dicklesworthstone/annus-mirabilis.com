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
      : (publication?.citation?.title ?? dataset.title);

  const shelfStatus = getDatasetShelfStatus(dataset, seriesId);

  return (
    <div
      className={className ? className.trim() : undefined}
      data-testid="dataset-overlay"
      data-dataset-id={dataset.id}
    >
      {/* Top Citation & Metadata Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          marginBottom: "0.5rem",
          fontSize: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              fontFamily: "var(--font-serif, serif)",
              fontWeight: 600,
              color: "var(--ink)",
            }}
            data-testid="dataset-citation"
          >
            {citationText} ({shelfStatus.publicationYear})
          </span>

          {/* Post-1904 non-shelf warning badge */}
          {shelfStatus.badgeLabel && (
            <span
              className="badge"
              style={{
                padding: "0.125rem 0.5rem",
                borderRadius: "0.25rem",
                background: "var(--wash)",
                color: "var(--accent)",
                border: "1px solid var(--accent)",
                fontSize: "0.6875rem",
              }}
              data-testid="shelf-badge"
            >
              {shelfStatus.badgeLabel}
            </span>
          )}

          {/* Normalization factor note */}
          {normalizationFactor !== undefined && (
            <span
              className="badge"
              style={{
                padding: "0.125rem 0.5rem",
                borderRadius: "0.25rem",
                background: "var(--panel)",
                color: "var(--muted)",
                border: "1px solid var(--line)",
                fontSize: "0.6875rem",
              }}
            >
              Norm: ×{normalizationFactor} {normalizationMethod ? `(${normalizationMethod})` : ""}
            </span>
          )}
        </div>

        {/* Action Button: Show where this came from */}
        {showRevealAction && (
          <button
            type="button"
            className="button"
            style={{
              padding: "0.25rem 0.625rem",
              borderRadius: "0.25rem",
              background: "var(--accent)",
              color: "var(--panel)",
              fontSize: "0.75rem",
              fontWeight: 500,
              border: "1px solid var(--accent)",
              cursor: "pointer",
            }}
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
        style={{ overflow: "visible" }}
        role="img"
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
            <a
              key={`dp-${dataset.id}-${row.seriesId ?? "s"}-${rawX}-${rawY}`}
              href={`#row-${rIdx}`}
              data-testid="dataset-point"
              data-row-index={rIdx}
              data-role={yCol?.role ?? "observed"}
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.preventDefault();
                handleRowSelect(rIdx);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleRowSelect(rIdx);
                }
              }}
            >
              {/* 1. Bounded Cell: Draw bounded directional arrow / bracket */}
              {(isYBound || isXBound) && (
                <g
                  data-testid="bound-marker"
                  data-bound-direction={
                    isYBound
                      ? yCell.direction
                      : xCell.kind === "bound"
                        ? xCell.direction
                        : undefined
                  }
                  aria-label={`Bound: ${isYBound ? yCell.direction : xCell.kind === "bound" ? xCell.direction : ""} ${isYBound ? yCell.value : xCell.kind === "bound" ? xCell.value : ""}`}
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
                  stroke="var(--panel)"
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
                  stroke="var(--panel)"
                  strokeWidth={1.2}
                  data-testid="empirical-point"
                />
              )}
            </a>
          );
        })}
      </svg>

      {/* 4-Step Disclosure Panel */}
      {isRevealOpen && (
        <div style={{ marginTop: "1rem" }}>
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
        <div style={{ marginTop: "1rem" }}>
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
