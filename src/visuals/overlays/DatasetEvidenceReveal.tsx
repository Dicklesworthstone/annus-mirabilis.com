import { type ReactElement, useState } from "react";
import {
  type DataCell,
  datasetValuesMayBeShown,
  type HistoricalDataset,
} from "../../content/schemas/experiment.ts";
import { DatasetWithheld } from "./DatasetWithheld.tsx";

export interface DatasetEvidenceRevealProps {
  readonly dataset: HistoricalDataset;
  readonly seriesId?: string | undefined;
  readonly selectedRowIndex?: number | undefined;
  readonly onSelectRow?: ((rowIndex: number) => void) | undefined;
  readonly normalizationFactor?: number | undefined;
  readonly className?: string | undefined;
}

/** A record whose values may not be shown is replaced by a note saying why (am-data-millikan-1916-zh2q). */
export function DatasetEvidenceReveal(props: DatasetEvidenceRevealProps): ReactElement {
  if (!datasetValuesMayBeShown(props.dataset)) {
    return <DatasetWithheld dataset={props.dataset} className={props.className} />;
  }
  return <ShownDatasetEvidenceReveal {...props} />;
}

/**
 * 4-step disclosure component:
 * 1. Source region locator & scan crop (honoring rights)
 * 2. Original printed tokens vs canonical values
 * 3. Applied transformations & normalization
 * 4. Durable citation & digitizer revision attribution
 */
function ShownDatasetEvidenceReveal({
  dataset,
  seriesId,
  selectedRowIndex = 0,
  normalizationFactor,
  className = "",
}: DatasetEvidenceRevealProps): ReactElement {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);

  const publication =
    dataset.publications.find((p) => p.id === dataset.primaryPublicationId) ??
    dataset.publications[0];
  const locator = publication?.locator;
  const rights = dataset.rights;

  // Rights publication decision: only render crop if rights allow publication
  const canPublishCrop =
    rights?.status === "public-domain-image" ||
    rights?.status === "public-domain-text" ||
    rights?.status === "cleared-image" ||
    rights?.status === "site-original-code" ||
    rights?.status === "site-original-prose";

  const rows = seriesId ? dataset.rows.filter((r) => r.seriesId === seriesId) : dataset.rows;
  const activeRow = rows[selectedRowIndex] ?? rows[0];

  const citationText =
    typeof publication?.citation === "string"
      ? publication.citation
      : (publication?.citation?.title ?? dataset.title);

  return (
    <div
      className={className || undefined}
      style={{
        border: "1px solid var(--line)",
        borderRadius: "0.5rem",
        padding: "1rem",
        background: "var(--panel)",
        fontSize: "0.875rem",
        color: "var(--ink)",
      }}
      data-testid="dataset-evidence-reveal"
      data-active-step={activeStep}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--line)",
          paddingBottom: "0.5rem",
          marginBottom: "0.75rem",
        }}
      >
        <h3 style={{ margin: 0, fontWeight: 600, fontSize: "1rem" }}>
          Source and provenance: {dataset.title}
        </h3>
        <span className="fine" style={{ fontSize: "0.75rem" }}>
          Revision {dataset.digitizer.digitizationRevision}
        </span>
      </div>

      {/* 4-Step Navigation Tabs */}
      <nav
        aria-label="Evidence Steps"
        style={{
          display: "flex",
          borderBottom: "1px solid var(--line)",
          marginBottom: "1rem",
          gap: "0.25rem",
        }}
      >
        <button
          type="button"
          className={activeStep === 1 ? "button" : "button secondary"}
          aria-pressed={activeStep === 1}
          style={{
            padding: "0.375rem 0.75rem",
            fontSize: "0.75rem",
            borderBottom: activeStep === 1 ? "2px solid var(--accent)" : "2px solid transparent",
            borderRadius: "0.25rem 0.25rem 0 0",
            minHeight: "auto",
          }}
          onClick={() => setActiveStep(1)}
          data-step-btn="1"
        >
          1. Source Region
        </button>
        <button
          type="button"
          className={activeStep === 2 ? "button" : "button secondary"}
          aria-pressed={activeStep === 2}
          style={{
            padding: "0.375rem 0.75rem",
            fontSize: "0.75rem",
            borderBottom: activeStep === 2 ? "2px solid var(--accent)" : "2px solid transparent",
            borderRadius: "0.25rem 0.25rem 0 0",
            minHeight: "auto",
          }}
          onClick={() => setActiveStep(2)}
          data-step-btn="2"
        >
          2. Printed Tokens
        </button>
        <button
          type="button"
          className={activeStep === 3 ? "button" : "button secondary"}
          aria-pressed={activeStep === 3}
          style={{
            padding: "0.375rem 0.75rem",
            fontSize: "0.75rem",
            borderBottom: activeStep === 3 ? "2px solid var(--accent)" : "2px solid transparent",
            borderRadius: "0.25rem 0.25rem 0 0",
            minHeight: "auto",
          }}
          onClick={() => setActiveStep(3)}
          data-step-btn="3"
        >
          3. Transformations
        </button>
        <button
          type="button"
          className={activeStep === 4 ? "button" : "button secondary"}
          aria-pressed={activeStep === 4}
          style={{
            padding: "0.375rem 0.75rem",
            fontSize: "0.75rem",
            borderBottom: activeStep === 4 ? "2px solid var(--accent)" : "2px solid transparent",
            borderRadius: "0.25rem 0.25rem 0 0",
            minHeight: "auto",
          }}
          onClick={() => setActiveStep(4)}
          data-step-btn="4"
        >
          4. Citation & Attribution
        </button>
      </nav>

      {/* Step 1: Source Region */}
      {activeStep === 1 && (
        <section aria-labelledby="step-1-title">
          <h4
            id="step-1-title"
            className="eyebrow"
            style={{ fontSize: "0.75rem", marginBottom: "0.5rem" }}
          >
            Step 1: document locator and scan region
          </h4>
          <div
            style={{
              background: "var(--wash)",
              padding: "0.75rem",
              borderRadius: "0.25rem",
              marginBottom: "0.75rem",
              fontSize: "0.75rem",
              lineHeight: 1.5,
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            <p style={{ margin: 0 }}>
              <strong>Publication:</strong> {citationText}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Locator:</strong>{" "}
              {locator?.kind === "table" || locator?.kind === "figure"
                ? `${locator.kind.toUpperCase()} ${locator.number}`
                : locator?.kind === "unnumbered-table"
                  ? `Unnumbered table on page ${locator.page}`
                  : `Text on page ${locator?.page ?? "unknown"}`}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Scan Asset:</strong> {dataset.digitizer.sourcePageImage}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Rights Status:</strong> {rights?.statement || "Rights statement verified."}
            </p>
          </div>

          {/* Crop display or locator-only fallback per rights policy */}
          {canPublishCrop ? (
            <div
              style={{
                border: "1px solid var(--line)",
                borderRadius: "0.25rem",
                padding: "0.5rem",
                background: "var(--wash)",
                textAlign: "center",
              }}
            >
              <span
                className="fine"
                style={{ fontSize: "0.7rem", display: "block", marginBottom: "0.25rem" }}
              >
                Reviewed Figure / Table Crop ({dataset.digitizer.sourcePageImage})
              </span>
              <div
                style={{
                  height: "6rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  fontStyle: "italic",
                  color: "var(--muted)",
                  background: "var(--panel)",
                  borderRadius: "0.25rem",
                }}
                data-testid="crop-rendered"
              >
                [High-resolution scan crop: Table {locator?.kind === "table" ? locator.number : "1"}
                ]
              </div>
            </div>
          ) : (
            <div
              className="notice"
              style={{ fontSize: "0.75rem" }}
              data-testid="locator-only-notice"
            >
              <strong>Scan image withheld per rights terms:</strong> Access to original scan is
              reference-only. Please consult the published volume: {citationText}.
            </div>
          )}
        </section>
      )}

      {/* Step 2: Printed Tokens vs Canonical Values */}
      {activeStep === 2 && (
        <section aria-labelledby="step-2-title">
          <h4
            id="step-2-title"
            className="eyebrow"
            style={{ fontSize: "0.75rem", marginBottom: "0.5rem" }}
          >
            Step 2: printed tokens beside canonical values
          </h4>
          <p className="fine" style={{ margin: "0 0 0.5rem" }}>
            Selected row index: {selectedRowIndex} (showing exact printed tokens from historical
            source)
          </p>
          {activeRow && (
            <table
              style={{
                width: "100%",
                fontSize: "0.75rem",
                border: "1px solid var(--line)",
                borderCollapse: "collapse",
                marginBottom: "0.75rem",
              }}
              data-testid="tokens-table"
            >
              <thead>
                <tr style={{ background: "var(--wash)", borderBottom: "1px solid var(--line)" }}>
                  <th style={{ padding: "0.5rem", textAlign: "left" }}>Column</th>
                  <th style={{ padding: "0.5rem", textAlign: "left" }}>Role</th>
                  <th style={{ padding: "0.5rem", textAlign: "left" }}>Printed Token</th>
                  <th style={{ padding: "0.5rem", textAlign: "left" }}>Canonical Value</th>
                  <th style={{ padding: "0.5rem", textAlign: "left" }}>Unit</th>
                </tr>
              </thead>
              <tbody>
                {activeRow.cells.map((cell: DataCell, cIdx: number) => {
                  const col = dataset.columns[cIdx];
                  const rawToken = "originalToken" in cell ? cell.originalToken : undefined;
                  const displayValue =
                    cell.kind === "number"
                      ? String(cell.value)
                      : cell.kind === "bound"
                        ? `${cell.direction === "upper" ? "≤" : "≥"} ${cell.value}`
                        : `missing (${cell.reason})`;

                  return (
                    <tr
                      key={`token-${col?.quantityId ?? `col-${cIdx}`}`}
                      style={{ borderTop: "1px solid var(--line)" }}
                    >
                      <td style={{ padding: "0.5rem", fontWeight: 500 }}>
                        {col?.name ?? `Col ${cIdx}`}
                      </td>
                      <td
                        style={{
                          padding: "0.5rem",
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.7rem",
                          color: "var(--muted)",
                        }}
                      >
                        {col?.role}
                      </td>
                      <td
                        style={{
                          padding: "0.5rem",
                          fontFamily: "var(--font-mono)",
                          color: "var(--accent)",
                          background: "var(--wash)",
                        }}
                      >
                        {rawToken || "—"}
                      </td>
                      <td
                        style={{
                          padding: "0.5rem",
                          fontFamily: "var(--font-mono)",
                          fontWeight: 600,
                        }}
                      >
                        {displayValue}
                      </td>
                      <td style={{ padding: "0.5rem", color: "var(--muted)" }}>{col?.unit}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Step 3: Transformations */}
      {activeStep === 3 && (
        <section aria-labelledby="step-3-title">
          <h4
            id="step-3-title"
            className="eyebrow"
            style={{ fontSize: "0.75rem", marginBottom: "0.5rem" }}
          >
            Step 3: reductions and normalizations applied
          </h4>
          <ul
            className="fine"
            style={{
              paddingLeft: "1.25rem",
              listStyleType: "disc",
              display: "flex",
              flexDirection: "column",
              gap: "0.375rem",
              marginBottom: "0.75rem",
            }}
          >
            <li>
              <strong>Units conversion:</strong> All numerical columns mapped from historical CGS /
              printed units to SI standards.
            </li>
            {normalizationFactor !== undefined && (
              <li>
                <strong>Normalization Scale Factor:</strong> Multiplied by factor{" "}
                {normalizationFactor} for comparative display.
              </li>
            )}
            <li>
              <strong>Uncertainty model:</strong> {dataset.uncertainty.description} (
              {dataset.uncertainty.type}).
            </li>
            <li>
              <strong>Editorial notes:</strong> {dataset.notes}
            </li>
          </ul>
        </section>
      )}

      {/* Step 4: Durable Citation & Digitizer Attribution */}
      {activeStep === 4 && (
        <section aria-labelledby="step-4-title">
          <h4
            id="step-4-title"
            className="eyebrow"
            style={{ fontSize: "0.75rem", marginBottom: "0.5rem" }}
          >
            Step 4: full citation and digitization record
          </h4>
          <div
            style={{
              padding: "0.75rem",
              background: "var(--wash)",
              borderRadius: "0.25rem",
              border: "1px solid var(--line)",
              fontSize: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div>
              <span style={{ fontWeight: 600, display: "block" }}>Citation:</span>
              <p style={{ margin: 0, fontFamily: "var(--font-serif)" }}>{citationText}</p>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.5rem",
                fontSize: "0.7rem",
                paddingTop: "0.5rem",
                borderTop: "1px solid var(--line)",
              }}
            >
              <div>
                <strong>Digitizer:</strong> {dataset.digitizer.name}
              </div>
              <div>
                <strong>Method:</strong> {dataset.digitizer.method}
              </div>
              <div>
                <strong>Digitization Date:</strong>{" "}
                {typeof dataset.digitizer.date === "string"
                  ? dataset.digitizer.date
                  : dataset.digitizer.date.text}
              </div>
              <div>
                <strong>Digitization Revision:</strong> {dataset.digitizer.digitizationRevision}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Static <details> fallback representation */}
      <details
        className="fine"
        style={{
          marginTop: "1rem",
          paddingTop: "0.75rem",
          borderTop: "1px solid var(--line)",
        }}
        data-testid="static-details-fallback"
      >
        <summary style={{ cursor: "pointer", fontWeight: 500 }}>
          Static Provenance Summary (Accessible / Print View)
        </summary>
        <div
          style={{
            marginTop: "0.5rem",
            paddingLeft: "0.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <p style={{ margin: 0 }}>
            <strong>Citation:</strong> {citationText}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Digitizer:</strong> {dataset.digitizer.name} (Rev.{" "}
            {dataset.digitizer.digitizationRevision},{" "}
            {typeof dataset.digitizer.date === "string"
              ? dataset.digitizer.date
              : dataset.digitizer.date.text}
            )
          </p>
          <p style={{ margin: 0 }}>
            <strong>Rights:</strong> {rights?.statement || "Rights statement verified."}
          </p>
        </div>
      </details>
    </div>
  );
}
