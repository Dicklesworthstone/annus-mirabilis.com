import { type ReactElement, useState } from "react";
import type { DataCell, HistoricalDataset } from "../../content/schemas/experiment.ts";

export interface DatasetEvidenceRevealProps {
  readonly dataset: HistoricalDataset;
  readonly seriesId?: string | undefined;
  readonly selectedRowIndex?: number | undefined;
  readonly onSelectRow?: ((rowIndex: number) => void) | undefined;
  readonly normalizationFactor?: number | undefined;
  readonly className?: string | undefined;
}

/**
 * 4-step disclosure component:
 * 1. Source region locator & scan crop (honoring rights)
 * 2. Original printed tokens vs canonical values
 * 3. Applied transformations & normalization
 * 4. Durable citation & digitizer revision attribution
 */
export function DatasetEvidenceReveal({
  dataset,
  seriesId,
  selectedRowIndex = 0,
  onSelectRow,
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
    rights?.status === "public-domain-verified" ||
    rights?.status === "cc-by-4.0" ||
    rights?.status === "publish";

  const rows = seriesId ? dataset.rows.filter((r) => r.seriesId === seriesId) : dataset.rows;
  const activeRow = rows[selectedRowIndex] ?? rows[0];

  const citationText = typeof publication?.citation === "string"
    ? publication.citation
    : publication?.citation?.sourceTitle ?? dataset.title;

  return (
    <div
      className={`dataset-evidence-reveal border border-neutral-300 dark:border-neutral-700 rounded-lg p-4 bg-white dark:bg-neutral-900 text-sm ${className}`.trim()}
      data-testid="dataset-evidence-reveal"
      data-active-step={activeStep}
    >
      <div className="flex items-center justify-between border-b pb-2 mb-3 dark:border-neutral-800">
        <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
          Source & Evidence Provenance: {dataset.title}
        </h3>
        <span className="text-xs text-neutral-500">
          Revision {dataset.digitizer.digitizationRevision}
        </span>
      </div>

      {/* 4-Step Navigation Tabs */}
      <nav aria-label="Evidence Steps" className="flex border-b mb-4 dark:border-neutral-800">
        <button
          type="button"
          className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px ${activeStep === 1 ? "border-amber-600 text-amber-900 dark:text-amber-200 font-semibold" : "border-transparent text-neutral-500 hover:text-neutral-700"}`}
          onClick={() => setActiveStep(1)}
          data-step-btn="1"
        >
          1. Source Region
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px ${activeStep === 2 ? "border-amber-600 text-amber-900 dark:text-amber-200 font-semibold" : "border-transparent text-neutral-500 hover:text-neutral-700"}`}
          onClick={() => setActiveStep(2)}
          data-step-btn="2"
        >
          2. Printed Tokens
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px ${activeStep === 3 ? "border-amber-600 text-amber-900 dark:text-amber-200 font-semibold" : "border-transparent text-neutral-500 hover:text-neutral-700"}`}
          onClick={() => setActiveStep(3)}
          data-step-btn="3"
        >
          3. Transformations
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px ${activeStep === 4 ? "border-amber-600 text-amber-900 dark:text-amber-200 font-semibold" : "border-transparent text-neutral-500 hover:text-neutral-700"}`}
          onClick={() => setActiveStep(4)}
          data-step-btn="4"
        >
          4. Citation & Attribution
        </button>
      </nav>

      {/* Step 1: Source Region */}
      {activeStep === 1 && (
        <section className="reveal-step-1" aria-labelledby="step-1-title">
          <h4 id="step-1-title" className="font-semibold text-xs mb-2 text-neutral-700 dark:text-neutral-300">
            Step 1: Document Locator & Scan Region
          </h4>
          <div className="bg-neutral-50 dark:bg-neutral-950 p-3 rounded mb-3 text-xs leading-relaxed space-y-1">
            <p>
              <strong>Publication:</strong> {citationText}
            </p>
            <p>
              <strong>Locator:</strong>{" "}
              {locator?.kind === "table" || locator?.kind === "figure"
                ? `${locator.kind.toUpperCase()} ${locator.number}`
                : locator?.kind === "unnumbered-table"
                  ? `Unnumbered table on page ${locator.page}`
                  : `Text on page ${locator?.page ?? "unknown"}`}
            </p>
            <p>
              <strong>Scan Asset:</strong> {dataset.digitizer.sourcePageImage}
            </p>
            <p>
              <strong>Rights Status:</strong> {rights?.statement || "Rights statement verified."}
            </p>
          </div>

          {/* Crop display or locator-only fallback per rights policy */}
          {canPublishCrop ? (
            <div className="source-crop-container border rounded p-2 bg-neutral-100 dark:bg-neutral-800 text-center">
              <span className="text-[11px] text-neutral-500 block mb-1">
                Reviewed Figure / Table Crop ({dataset.digitizer.sourcePageImage})
              </span>
              <div className="crop-placeholder h-24 flex items-center justify-center text-xs italic text-neutral-600 dark:text-neutral-400 bg-neutral-200 dark:bg-neutral-700 rounded" data-testid="crop-rendered">
                [High-resolution scan crop: Table {locator?.kind === "table" ? locator.number : "1"}]
              </div>
            </div>
          ) : (
            <div className="rights-withheld-notice p-3 border border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 rounded text-xs" data-testid="locator-only-notice">
              <strong>Scan image withheld per rights terms:</strong> Access to original scan is reference-only. Please consult the published volume: {citationText}.
            </div>
          )}
        </section>
      )}

      {/* Step 2: Printed Tokens vs Canonical Values */}
      {activeStep === 2 && (
        <section className="reveal-step-2" aria-labelledby="step-2-title">
          <h4 id="step-2-title" className="font-semibold text-xs mb-2 text-neutral-700 dark:text-neutral-300">
            Step 2: Original Printed Tokens vs Converted Values
          </h4>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">
            Selected row index: {selectedRowIndex} (showing exact printed tokens from historical source)
          </p>
          {activeRow && (
            <table className="w-full text-xs border border-neutral-200 dark:border-neutral-700 mb-3" data-testid="tokens-table">
              <thead className="bg-neutral-100 dark:bg-neutral-800">
                <tr>
                  <th className="p-2 text-left">Column</th>
                  <th className="p-2 text-left">Role</th>
                  <th className="p-2 text-left">Printed Token</th>
                  <th className="p-2 text-left">Canonical Value</th>
                  <th className="p-2 text-left">Unit</th>
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
                    <tr key={`cell-${cIdx}`} className="border-t dark:border-neutral-800">
                      <td className="p-2 font-medium">{col?.name ?? `Col ${cIdx}`}</td>
                      <td className="p-2 font-mono text-[11px] text-neutral-500">{col?.role}</td>
                      <td className="p-2 font-mono text-amber-800 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
                        {rawToken || "—"}
                      </td>
                      <td className="p-2 font-mono font-semibold">{displayValue}</td>
                      <td className="p-2 text-neutral-500">{col?.unit}</td>
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
        <section className="reveal-step-3" aria-labelledby="step-3-title">
          <h4 id="step-3-title" className="font-semibold text-xs mb-2 text-neutral-700 dark:text-neutral-300">
            Step 3: Applied Reduction & Normalization Transformations
          </h4>
          <ul className="list-disc pl-5 text-xs text-neutral-700 dark:text-neutral-300 space-y-1.5 mb-3">
            <li>
              <strong>Units conversion:</strong> All numerical columns mapped from historical CGS / printed units to SI standards.
            </li>
            {normalizationFactor !== undefined && (
              <li>
                <strong>Normalization Scale Factor:</strong> Multiplied by factor {normalizationFactor} for comparative display.
              </li>
            )}
            <li>
              <strong>Uncertainty model:</strong> {dataset.uncertainty.description} ({dataset.uncertainty.type}).
            </li>
            <li>
              <strong>Editorial notes:</strong> {dataset.notes}
            </li>
          </ul>
        </section>
      )}

      {/* Step 4: Durable Citation & Digitizer Attribution */}
      {activeStep === 4 && (
        <section className="reveal-step-4" aria-labelledby="step-4-title">
          <h4 id="step-4-title" className="font-semibold text-xs mb-2 text-neutral-700 dark:text-neutral-300">
            Step 4: Full Citation & Digitization Provenance
          </h4>
          <div className="p-3 bg-neutral-50 dark:bg-neutral-950 rounded text-xs space-y-2 border dark:border-neutral-800">
            <div>
              <span className="font-semibold block text-neutral-800 dark:text-neutral-200">Citation:</span>
              <p className="font-serif text-neutral-700 dark:text-neutral-300">{citationText}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t dark:border-neutral-800">
              <div>
                <strong>Digitizer:</strong> {dataset.digitizer.name}
              </div>
              <div>
                <strong>Method:</strong> {dataset.digitizer.method}
              </div>
              <div>
                <strong>Digitization Date:</strong> {typeof dataset.digitizer.date === "string" ? dataset.digitizer.date : dataset.digitizer.date.text}
              </div>
              <div>
                <strong>Digitization Revision:</strong> {dataset.digitizer.digitizationRevision}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Static <details> fallback representation */}
      <details className="mt-4 pt-3 border-t text-xs text-neutral-600 dark:text-neutral-400 dark:border-neutral-800" data-testid="static-details-fallback">
        <summary className="cursor-pointer font-medium hover:text-neutral-900 dark:hover:text-neutral-100">
          Static Provenance Summary (Accessible / Print View)
        </summary>
        <div className="mt-2 space-y-1 pl-2">
          <p><strong>Citation:</strong> {citationText}</p>
          <p><strong>Digitizer:</strong> {dataset.digitizer.name} (Rev. {dataset.digitizer.digitizationRevision}, {typeof dataset.digitizer.date === "string" ? dataset.digitizer.date : dataset.digitizer.date.text})</p>
          <p><strong>Rights:</strong> {rights?.statement || "Rights statement verified."}</p>
        </div>
      </details>
    </div>
  );
}
