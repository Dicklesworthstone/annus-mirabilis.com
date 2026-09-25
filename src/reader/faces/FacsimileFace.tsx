import Link from "next/link";
import React from "react";
import type {
  PageMapEntry,
  PublicationDecision,
  ReuseTerms,
  RightsStatus,
} from "../../content/provenance/receiptSchema.ts";
import { FacsimileViewer } from "./FacsimileViewer.tsx";
import { buildPageMapIndex } from "./pageMap.ts";

export interface FacsimileSourceAsset {
  readonly originUrl?: string | undefined;
  readonly acquisitionDate?: string | undefined;
  readonly sha256: string;
  readonly mimeType?: string | undefined;
  readonly pageCount: number;
  readonly pageMapping: readonly PageMapEntry[];
  readonly rights?:
    | {
        readonly status: RightsStatus;
        readonly statement?: string | undefined;
        readonly source?: string | undefined;
        readonly recordedAt?: string | undefined;
        readonly reuseTerms: ReuseTerms;
        readonly credit?: string | undefined;
      }
    | undefined;
  readonly publicationDecision: PublicationDecision;
  readonly publicationReason?: string | undefined;
  readonly embeddedTextLayer?: string | undefined;
  readonly path?: string | undefined;
  readonly institution?: string | undefined;
}

export interface FacsimileFaceProps {
  readonly paper: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly citation?: string | undefined;
    readonly germanTitle?: string | undefined;
  };
  readonly sourceAsset: FacsimileSourceAsset;
  readonly initialPage?: number | undefined;
  readonly initialAnchor?: string | undefined;
  readonly onPageChange?: ((page: number) => void) | undefined;
}

const DECISION_STATUS_CLASS: Readonly<Record<PublicationDecision, string>> = {
  publish: "status-publish",
  "pin-local-only": "status-pin-local-only",
  "reference-only": "status-reference-only",
};

export function FacsimileFace({
  paper,
  sourceAsset,
  initialPage = 1,
  initialAnchor,
  onPageChange,
}: FacsimileFaceProps) {
  const pageMapIndex = buildPageMapIndex(sourceAsset.pageMapping);
  const [activePage, setActivePage] = React.useState<number>(() => {
    if (initialAnchor) {
      const eqPage = pageMapIndex.getEquationPage(initialAnchor);
      if (eqPage !== null) return eqPage;
      const secPages = pageMapIndex.getSectionPages(initialAnchor);
      if (secPages.length > 0 && secPages[0] !== undefined) return secPages[0];
    }
    return pageMapIndex.clampPage(initialPage);
  });

  const handlePageSelect = (page: number) => {
    const clamped = pageMapIndex.clampPage(page);
    setActivePage(clamped);
    if (onPageChange) onPageChange(clamped);
  };

  const decision = sourceAsset.publicationDecision;
  const isPublished = decision === "publish";
  const isPinLocal = decision === "pin-local-only";
  const isReferenceOnly = decision === "reference-only";

  const hasEmbeddedTextLayer =
    sourceAsset.embeddedTextLayer === "present" ||
    sourceAsset.embeddedTextLayer === "true" ||
    sourceAsset.embeddedTextLayer === "present-ocr";

  const pdfUrl = sourceAsset.path
    ? `/${sourceAsset.path.replace(/^public\//, "")}`
    : `/papers/pdfs/${paper.slug}.pdf`;

  const activeEntry = pageMapIndex.getPage(activePage);

  return (
    <article className="facsimile-face" aria-label={`Facsimile edition of ${paper.title}`}>
      <header className="facsimile-face-header">
        <div className="facsimile-title-group">
          <h1 className="facsimile-paper-title">{paper.title}</h1>
          {paper.germanTitle && <p className="facsimile-german-title">{paper.germanTitle}</p>}
          {paper.citation && <p className="facsimile-citation">{paper.citation}</p>}
        </div>

        <div className="facsimile-metadata-badge-group">
          <div className="facsimile-meta-item">
            <span className="meta-label">SHA-256</span>
            <code className="meta-digest" title={sourceAsset.sha256}>
              {sourceAsset.sha256.slice(0, 12)}…{sourceAsset.sha256.slice(-8)}
            </code>
          </div>

          <div className="facsimile-meta-item">
            <span className="meta-label">Status</span>
            <span className={`meta-badge ${DECISION_STATUS_CLASS[decision] ?? "status-publish"}`}>
              {decision}
            </span>
          </div>

          {sourceAsset.institution && (
            <div className="facsimile-meta-item">
              <span className="meta-label">Source Institution</span>
              <span className="meta-institution">{sourceAsset.institution}</span>
            </div>
          )}
        </div>
      </header>

      {/* Decision-specific presentation notices */}
      {isPublished && hasEmbeddedTextLayer && (
        <div className="facsimile-notice text-layer-notice" role="note">
          <p>
            <strong>Third-Party Text Layer Notice:</strong> The library scan contains a machine-read
            text layer. That text layer is third-party OCR output, not the text of this edition. The
            edition is rendered from diplomatic transcription.
          </p>
        </div>
      )}

      {isPinLocal && (
        <div className="facsimile-notice local-only-notice" role="note">
          <h3>Local verification scan</h3>
          <p>
            This scan is pinned locally for verification only and is not distributed publicly under
            its source terms.
          </p>
          {sourceAsset.rights?.statement && (
            <blockquote className="verbatim-rights-statement">
              {sourceAsset.rights.statement}
            </blockquote>
          )}
          {sourceAsset.originUrl && (
            <p className="institution-link">
              Source:{" "}
              <a href={sourceAsset.originUrl} rel="noopener noreferrer" target="_blank">
                {sourceAsset.originUrl}
              </a>
            </p>
          )}
        </div>
      )}

      {isReferenceOnly && (
        <div className="facsimile-notice reference-only-notice" role="note">
          <h3>Reference only document</h3>
          <p>Reference only; scan not hosted.</p>
          {sourceAsset.rights?.statement && (
            <blockquote className="verbatim-rights-statement">
              {sourceAsset.rights.statement}
            </blockquote>
          )}
          {sourceAsset.originUrl && (
            <p className="institution-link">
              Source:{" "}
              <a href={sourceAsset.originUrl} rel="noopener noreferrer" target="_blank">
                {sourceAsset.originUrl}
              </a>
            </p>
          )}
        </div>
      )}

      {/* Main viewer (for published assets) */}
      {isPublished && (
        <section className="facsimile-viewer-section" aria-label="Interactive facsimile viewer">
          <FacsimileViewer
            pdfUrl={pdfUrl}
            currentPage={activePage}
            totalPages={pageMapIndex.totalPages}
            pageEntry={activeEntry}
            paperTitle={paper.title}
            onPageChange={handlePageSelect}
          />

          <noscript>
            <div className="facsimile-noscript-fallback">
              <p>
                <a
                  href={pdfUrl}
                  className="direct-pdf-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Opens the scan in your browser's PDF viewer, which may show the library's
                  machine-read text layer; that text is not the edition.
                </a>
              </p>
            </div>
          </noscript>
        </section>
      )}

      {/* Page Map Table */}
      <section className="facsimile-pagemap-section" aria-label="Facsimile page map and jumps">
        <h2 className="pagemap-heading">Page map and content concordance</h2>
        <section
          className="pagemap-table-container"
          aria-label="Facsimile page map concordance"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable
          tabIndex={0}
        >
          <table className="facsimile-pagemap-table">
            <thead>
              <tr>
                <th scope="col">PDF Page</th>
                <th scope="col">Printed Page</th>
                <th scope="col">Contents</th>
                <th scope="col">Sections</th>
                <th scope="col">Equations</th>
                <th scope="col">Footnotes</th>
              </tr>
            </thead>
            <tbody>
              {pageMapIndex.getAllPages().map((entry) => {
                const isSelected = entry.pdfPageIndex === activePage;
                return (
                  <tr
                    key={entry.pdfPageIndex}
                    className={`pagemap-row ${isSelected ? "is-selected" : ""} ${entry.isOtherArticle ? "other-article-row" : ""}`}
                  >
                    <td className="col-pdf-page">
                      {isPublished ? (
                        <button
                          type="button"
                          className="page-jump-btn"
                          onClick={() => handlePageSelect(entry.pdfPageIndex)}
                          aria-label={`Jump to PDF page ${entry.pdfPageIndex}`}
                        >
                          {`Page ${entry.pdfPageIndex}`}
                        </button>
                      ) : (
                        <span>{`Page ${entry.pdfPageIndex}`}</span>
                      )}
                    </td>
                    <td className="col-printed-page">
                      {entry.printedPage !== null
                        ? `p. ${entry.printedPage}`
                        : entry.printedPageLabel}
                    </td>
                    <td className="col-contents">{entry.contents.join(", ")}</td>
                    <td className="col-sections">
                      {entry.sectionIds.length > 0 ? (
                        <ul className="inline-link-list">
                          {entry.sectionIds.map((secId) => (
                            <li key={secId}>
                              <Link
                                href={`/paper/${paper.slug}?view=german#${secId}`}
                                className="section-jump-link"
                              >
                                {`§${secId.replace(/^s/, "")}`}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="pagemap-empty">–</span>
                      )}
                    </td>
                    <td className="col-equations">
                      {entry.displayEquations.numbered.length > 0 ||
                      (entry.displayEquations.unnumberedIds?.length ?? 0) > 0 ? (
                        <ul className="inline-link-list">
                          {entry.displayEquations.numbered.map((eqNum) => (
                            <li key={eqNum}>
                              <Link
                                href={`/paper/${paper.slug}?view=reading#eq-${eqNum.replace(/[()]/g, "")}`}
                                className="equation-jump-link"
                              >
                                {`Eq. ${eqNum}`}
                              </Link>
                            </li>
                          ))}
                          {entry.displayEquations.unnumberedIds?.map((eqId) => (
                            <li key={eqId}>
                              <Link
                                href={`/paper/${paper.slug}?view=reading#${eqId}`}
                                className="equation-jump-link"
                              >
                                {`Display (${eqId})`}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="pagemap-empty">–</span>
                      )}
                    </td>
                    <td className="col-footnotes">
                      {entry.footnoteMarks.length > 0 ? (
                        entry.footnoteMarks.join(", ")
                      ) : (
                        <span className="pagemap-empty">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </section>
    </article>
  );
}
