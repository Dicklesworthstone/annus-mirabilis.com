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
    // KEEP the tabIndex. This is a scroll container by construction - overflowX: "auto"
    // below, wrapping a historical dataset whose column count comes from the record - and
    // it cannot be measured against the built site, because DatasetOverlay is mounted by
    // no route today and its showTable prop defaults to false, so nothing renders it
    // there. a11y/noNoninteractiveTabindex flags it and its FIXABLE fix deletes the
    // attribute; the element carries no className, so no class-keyed gate, including the
    // scrollable-regions ratchet, can see it at all (am-6iz4, am-uj6w).
    <section
      className={className ? className.trim() : undefined}
      data-testid="dataset-table"
      aria-label="Historical dataset table"
      tabIndex={0}
      style={{
        overflowX: "auto",
        fontSize: "0.75rem",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          border: "1px solid var(--line)",
        }}
      >
        <caption
          style={{
            textAlign: "left",
            fontFamily: "var(--font-serif, serif)",
            padding: "0.5rem",
            background: "var(--wash)",
            color: "var(--ink)",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <span style={{ fontWeight: 600 }}>{dataset.title}</span>: {citationText}
        </caption>
        <thead>
          <tr
            style={{
              background: "var(--wash)",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <th
              scope="col"
              style={{
                padding: "0.5rem",
                textAlign: "left",
                fontWeight: 600,
                borderRight: "1px solid var(--line)",
                width: "3rem",
                color: "var(--ink)",
              }}
            >
              #
            </th>
            {dataset.columns.map((col, cIdx) => (
              <th
                key={`th-col-${col.quantityId || `col-${cIdx}`}`}
                scope="col"
                data-quantity-id={col.quantityId}
                data-column-role={col.role}
                style={{
                  padding: "0.5rem",
                  textAlign: "left",
                  fontWeight: 600,
                  borderRight:
                    cIdx === dataset.columns.length - 1 ? undefined : "1px solid var(--line)",
                  color: "var(--ink)",
                }}
              >
                <div>{col.name}</div>
                <div
                  className="fine"
                  style={{
                    fontWeight: "normal",
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "0.625rem",
                  }}
                >
                  [{col.unit}] • <span style={{ fontStyle: "italic" }}>{col.role}</span>
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
                style={{
                  borderBottom: "1px solid var(--line)",
                  cursor: "pointer",
                  background: isSelected ? "rgba(245, 158, 11, 0.15)" : undefined,
                  fontWeight: isSelected ? 600 : undefined,
                }}
              >
                <td
                  style={{
                    padding: "0.5rem",
                    fontFamily: "var(--font-mono, monospace)",
                    color: "var(--muted)",
                    borderRight: "1px solid var(--line)",
                  }}
                >
                  {rIdx}
                </td>
                {row.cells.map((cell: DataCell, cIdx: number) => {
                  const col = dataset.columns[cIdx];
                  let cellContent: ReactElement | string;
                  if (cell.kind === "number") {
                    cellContent = (
                      <span
                        style={{
                          fontFamily: "var(--font-mono, monospace)",
                          color: "var(--ink)",
                        }}
                      >
                        {cell.value}
                      </span>
                    );
                  } else if (cell.kind === "bound") {
                    cellContent = (
                      <span
                        style={{
                          fontFamily: "var(--font-mono, monospace)",
                          color: "var(--accent)",
                        }}
                        title={`Apparatus bound: ${cell.direction}`}
                      >
                        {cell.direction === "upper" ? "≤ " : "≥ "}
                        {cell.value}
                      </span>
                    );
                  } else {
                    cellContent = (
                      <span
                        className="fine"
                        style={{
                          fontStyle: "italic",
                          fontFamily: "var(--font-sans, sans-serif)",
                        }}
                        title="Missing observation"
                      >
                        {cell.reason}
                      </span>
                    );
                  }

                  return (
                    <td
                      key={`td-${col?.quantityId ?? `cell-${cIdx}`}`}
                      style={{
                        padding: "0.5rem",
                        borderRight:
                          cIdx === row.cells.length - 1 ? undefined : "1px solid var(--line)",
                      }}
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
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem",
            background: "var(--wash)",
            border: "1px solid var(--line)",
            borderRadius: "0.25rem",
          }}
        >
          <h4
            style={{
              fontWeight: 600,
              fontSize: "0.75rem",
              color: "var(--ink)",
              margin: "0 0 0.5rem",
            }}
          >
            Historical fits and parameters
          </h4>
          {relevantFits.map((fit) => (
            <div
              key={`fit-${fit.id}`}
              style={{
                marginBottom: "0.75rem",
                paddingBottom: "0.5rem",
                borderBottom: "1px solid var(--line)",
                fontSize: "0.75rem",
              }}
              data-fit-id={fit.id}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.25rem",
                  flexWrap: "wrap",
                  gap: "0.25rem",
                }}
              >
                <span style={{ fontWeight: 500, color: "var(--ink)" }}>{fit.label}</span>
                <span className="fine" style={{ fontSize: "0.6875rem" }}>
                  Objective: {fit.fitObjective} • Used: {fit.rowsUsed.length} / Excluded:{" "}
                  {fit.rowsExcluded.length}
                </span>
              </div>
              {fit.fitDescription && (
                <p className="fine" style={{ margin: "0 0 0.25rem", fontSize: "0.6875rem" }}>
                  {fit.fitDescription}
                </p>
              )}

              {/* Excluded rows reasons */}
              {fit.rowsExcluded.length > 0 && (
                <div
                  style={{
                    fontSize: "0.6875rem",
                    color: "var(--accent)",
                    margin: "0.25rem 0",
                  }}
                >
                  <strong>Excluded rows:</strong>
                  <ul
                    style={{
                      listStyleType: "disc",
                      paddingLeft: "1rem",
                      margin: "0.125rem 0 0",
                    }}
                  >
                    {fit.rowsExcluded.map((ex) => (
                      <li key={`ex-${ex.rowIndex}`}>
                        Row {ex.rowIndex}: {ex.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Parameter table */}
              <div style={{ fontSize: "0.6875rem", marginTop: "0.25rem" }}>
                <span style={{ fontWeight: 600, color: "var(--ink)" }}>Parameters:</span>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    marginTop: "0.25rem",
                  }}
                >
                  {fit.parameters.map((p) => (
                    <span
                      key={`p-${p.name}`}
                      style={{
                        padding: "0.25rem",
                        background: "var(--panel)",
                        border: "1px solid var(--line)",
                        borderRadius: "0.25rem",
                        fontFamily: "var(--font-mono, monospace)",
                        color: "var(--ink)",
                      }}
                    >
                      {p.name} = {p.value} {p.unit} (
                      <em style={{ fontStyle: "italic" }}>
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
    </section>
  );
}
