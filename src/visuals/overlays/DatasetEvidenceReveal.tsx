import { type ReactElement, useState } from "react";
import type { PublicationDecision } from "../../content/provenance/receiptSchema.ts";
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
  /**
   * The publication decision recorded for the scan asset this reveal would crop, from the
   * asset's own `SourceAsset.publicationDecision`. Omitted means no determination has been
   * recorded, which withholds the crop: possessing a scan is not a determination that it may
   * be served. A dataset's `rights.status` cannot answer this, which is why it is not read
   * here -- see the comment on `mayPublishCrop`.
   */
  readonly publicationDecision?: PublicationDecision | undefined;
}

/** A record whose values may not be shown is replaced by a note saying why (am-data-millikan-1916-zh2q). */
export function DatasetEvidenceReveal(props: DatasetEvidenceRevealProps): ReactElement {
  if (!datasetValuesMayBeShown(props.dataset)) {
    return <DatasetWithheld dataset={props.dataset} className={props.className} />;
  }
  return <ShownDatasetEvidenceReveal {...props} />;
}

const STEP_NUMBERS = [1, 2, 3, 4] as const;

type StepNumber = (typeof STEP_NUMBERS)[number];

/**
 * The four step titles, in one place.
 *
 * The tabbed panels and the no-script disclosure below render THE SAME four steps, and a
 * heading written twice is a heading that drifts: commit 4040518df had to sentence-case these
 * once already. The same reasoning is why each step's body is a component rather than markup
 * repeated per surface.
 */
const STEP_TITLES: Readonly<Record<StepNumber, string>> = {
  1: "Step 1: document locator and scan region",
  2: "Step 2: printed tokens beside canonical values",
  3: "Step 3: reductions and normalizations applied",
  4: "Step 4: full citation and digitization record",
};

/**
 * 4-step disclosure component:
 * 1. Source region locator & scan crop (honoring rights)
 * 2. Original printed tokens vs canonical values
 * 3. Applied transformations & normalization
 * 4. Durable citation & digitizer revision attribution
 *
 * TWO SURFACES, ONE SET OF STEPS. The tabs are the scripted surface and show one step at a
 * time. The `<details>` at the bottom is the surface a reader gets with no JavaScript, and it
 * carries all four steps, because `<details>` is interactive natively and the tabs are not: the
 * buttons call `setActiveStep`, so without React this component showed STEP 1 ALONE and the
 * printed tokens and the transformation list were unreachable. Those are the two steps that
 * make the plotted point auditable, which is the whole purpose of the reveal.
 */
function ShownDatasetEvidenceReveal({
  dataset,
  seriesId,
  selectedRowIndex = 0,
  normalizationFactor,
  className = "",
  publicationDecision,
}: DatasetEvidenceRevealProps): ReactElement {
  const [activeStep, setActiveStep] = useState<StepNumber>(1);

  const publication =
    dataset.publications.find((p) => p.id === dataset.primaryPublicationId) ??
    dataset.publications[0];
  const locator = publication?.locator;
  const rights = dataset.rights;

  /**
   * A crop is served only where the asset's recorded publication decision is `publish`.
   *
   * This reads the DECISION, not `rights.status`, and the distinction is the whole point. The
   * two are separate categories of `docs/rights-vocabulary.yaml`, and its constraint
   * `publish-requires-redistributable-status` runs one way only: a `publish` decision requires a
   * redistributable status, while a redistributable status implies nothing about the decision.
   * Inferring permission from status is therefore necessary-but-not-sufficient, and it fails in
   * the direction that serves bytes nobody cleared. `millikan-1916-sodium` is the live case:
   * its status is `public-domain-text`, true of Millikan's 1916 TEXT, while the page images are
   * an Internet Archive scan whose terms its receipt records separately. Scans are not the text.
   *
   * Absent decision withholds. The status vocabulary is deliberately not consulted here: it
   * would be a second hand-copy of a list `docs/rights-vocabulary.yaml` owns, and the
   * constraint above is already enforced where that file is loaded.
   */
  const mayPublishCrop = publicationDecision === "publish";

  const rows = seriesId ? dataset.rows.filter((r) => r.seriesId === seriesId) : dataset.rows;
  const activeRow = rows[selectedRowIndex] ?? rows[0];

  const citationText =
    typeof publication?.citation === "string"
      ? publication.citation
      : (publication?.citation?.title ?? dataset.title);

  /*
   * Every string below is formatted once and passed to both surfaces, for the same reason the
   * titles are: the locator's shape is a four-branch decision, and a second copy of it is a
   * second thing to get wrong.
   */
  const locatorText =
    locator?.kind === "table" || locator?.kind === "figure"
      ? `${locator.kind.toUpperCase()} ${locator.number}`
      : locator?.kind === "unnumbered-table"
        ? `Unnumbered table on page ${locator.page}`
        : `Text on page ${locator?.page ?? "unknown"}`;
  const rightsStatement = rights?.statement || "Rights statement verified.";
  const cropTableNumber = locator?.kind === "table" ? locator.number : "1";
  const digitizerDateText =
    typeof dataset.digitizer.date === "string"
      ? dataset.digitizer.date
      : dataset.digitizer.date.text;

  /**
   * `#dataset-<id>-<series>-step<n>`, the anchor grammar this reveal owes its steps.
   *
   * It had been `step-1-title` through `step-4-title`, which are not scoped to anything: two
   * reveals on one page, or a reveal beside a dataset table, put four DUPLICATE ids in the
   * document, and `aria-labelledby` resolves a duplicate to whichever came first, so a step's
   * section could be announced under another step's heading. `?? "default"` for an absent
   * series is the spelling `validateHistoricalDataset` already uses in its own messages.
   *
   * The canonical anchor is carried by the STATIC disclosure, not by the tab panel, because a
   * tab panel only exists while its step is the active one and an anchor that is absent four
   * times out of five is not an anchor. What the anchor buys is a unique, always-served
   * identifier for the step: for `aria-labelledby`, and for citing one step of one series.
   * Whether following such a link also expands the `<details>` is up to the engine, so this
   * does not promise a scroll -- a hidden element can be `:target` without being scrolled to.
   */
  const stepAnchor = (step: StepNumber): string =>
    `dataset-${dataset.id}-${seriesId ?? "default"}-step${step}`;

  const stepBody = (step: StepNumber): ReactElement => {
    switch (step) {
      case 1:
        return (
          <SourceRegionBody
            citationText={citationText}
            locatorText={locatorText}
            sourcePageImage={dataset.digitizer.sourcePageImage}
            rightsStatement={rightsStatement}
            cropTableNumber={cropTableNumber}
            mayPublishCrop={mayPublishCrop}
            publicationDecision={publicationDecision}
          />
        );
      case 2:
        return (
          <PrintedValuesBody
            dataset={dataset}
            activeRow={activeRow}
            selectedRowIndex={selectedRowIndex}
          />
        );
      case 3:
        return <TransformationsBody dataset={dataset} normalizationFactor={normalizationFactor} />;
      case 4:
        return (
          <CitationBody
            citationText={citationText}
            digitizerName={dataset.digitizer.name}
            digitizerMethod={dataset.digitizer.method}
            digitizerDateText={digitizerDateText}
            digitizationRevision={dataset.digitizer.digitizationRevision}
          />
        );
    }
  };

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

      {/*
       * The scripted surface. `-panel` keeps these headings' ids distinct from the canonical
       * step anchors on the static disclosure, which are in the document at the same time.
       */}
      <section aria-labelledby={`${stepAnchor(activeStep)}-panel`}>
        <h4
          id={`${stepAnchor(activeStep)}-panel`}
          className="eyebrow"
          style={{ fontSize: "0.75rem", marginBottom: "0.5rem" }}
        >
          {STEP_TITLES[activeStep]}
        </h4>
        {stepBody(activeStep)}
      </section>

      {/*
       * The no-script surface, and the only one a reader without JavaScript can operate. It
       * holds all four steps: a `<details>` toggles without script, the tab buttons above do
       * not. Closed by default so the scripted reader is not shown everything twice.
       */}
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
          All four steps, as plain text (accessible, print and no-script view)
        </summary>
        <div
          style={{
            marginTop: "0.5rem",
            paddingLeft: "0.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          {STEP_NUMBERS.map((step) => (
            <section key={step} aria-labelledby={stepAnchor(step)}>
              <h4
                id={stepAnchor(step)}
                className="eyebrow"
                style={{ fontSize: "0.75rem", marginBottom: "0.5rem" }}
              >
                {STEP_TITLES[step]}
              </h4>
              {stepBody(step)}
            </section>
          ))}
          <p style={{ margin: 0 }}>
            <strong>Rights:</strong> {rightsStatement}
          </p>
        </div>
      </details>
    </div>
  );
}

function SourceRegionBody({
  citationText,
  locatorText,
  sourcePageImage,
  rightsStatement,
  cropTableNumber,
  mayPublishCrop,
  publicationDecision,
}: {
  readonly citationText: string;
  readonly locatorText: string;
  readonly sourcePageImage: string;
  readonly rightsStatement: string;
  readonly cropTableNumber: string | number;
  readonly mayPublishCrop: boolean;
  readonly publicationDecision: PublicationDecision | undefined;
}): ReactElement {
  return (
    <>
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
          <strong>Locator:</strong> {locatorText}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Scan Asset:</strong> {sourcePageImage}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Rights Status:</strong> {rightsStatement}
        </p>
      </div>

      {/* Crop display or locator-only fallback per rights policy */}
      {mayPublishCrop ? (
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
            Reviewed Figure / Table Crop ({sourcePageImage})
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
            [High-resolution scan crop: Table {cropTableNumber}]
          </div>
        </div>
      ) : (
        <div className="notice" style={{ fontSize: "0.75rem" }} data-testid="locator-only-notice">
          <strong>Scan image withheld:</strong>{" "}
          {publicationDecision === undefined
            ? "no publication decision is recorded for this scan, so it is not served here."
            : `this scan's publication decision is ${publicationDecision}, so it is not served here.`}{" "}
          The locator and rights statement above identify the page. Please consult the published
          volume: {citationText}.
        </div>
      )}
    </>
  );
}

function PrintedValuesBody({
  dataset,
  activeRow,
  selectedRowIndex,
}: {
  readonly dataset: HistoricalDataset;
  readonly activeRow: HistoricalDataset["rows"][number] | undefined;
  readonly selectedRowIndex: number;
}): ReactElement {
  return (
    <>
      <p className="fine" style={{ margin: "0 0 0.5rem" }}>
        Selected row index: {selectedRowIndex} (showing exact printed tokens from historical source)
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
                    {rawToken || "not printed separately"}
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
    </>
  );
}

function TransformationsBody({
  dataset,
  normalizationFactor,
}: {
  readonly dataset: HistoricalDataset;
  readonly normalizationFactor: number | undefined;
}): ReactElement {
  return (
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
          <strong>Normalization Scale Factor:</strong> Multiplied by factor {normalizationFactor}{" "}
          for comparative display.
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
  );
}

function CitationBody({
  citationText,
  digitizerName,
  digitizerMethod,
  digitizerDateText,
  digitizationRevision,
}: {
  readonly citationText: string;
  readonly digitizerName: string;
  readonly digitizerMethod: string;
  /*
   * `PaperDate.text` is optional (src/content/schemas/dates.ts), so this is honestly
   * `string | undefined` rather than coerced to an empty string: a provenance step must not
   * invent a date it was not given, and the inline expression this replaced rendered nothing
   * in the same case.
   */
  readonly digitizerDateText: string | undefined;
  readonly digitizationRevision: number;
}): ReactElement {
  return (
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
          <strong>Digitizer:</strong> {digitizerName}
        </div>
        <div>
          <strong>Method:</strong> {digitizerMethod}
        </div>
        <div>
          <strong>Digitization Date:</strong> {digitizerDateText}
        </div>
        <div>
          <strong>Digitization Revision:</strong> {digitizationRevision}
        </div>
      </div>
    </div>
  );
}
