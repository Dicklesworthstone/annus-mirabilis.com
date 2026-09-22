import { useId } from "react";
import {
  type FacsimileDocument,
  facsimilePageAnchor,
  facsimilePdfHref,
  facsimileSectionPages,
  resolveFacsimileTarget,
} from "./document.ts";
import { FacsimileEnhancer } from "./FacsimileEnhancer.tsx";
import "./facsimileReader.css";

/** No PDF.js, worker, WASM, canvas, or external resource is needed for this source face.
 * A native same-origin PDF frame is optional; all source-page links are server-rendered.
 */
export function FacsimilePanel({
  document,
  title,
  faceHref,
  explanationHref,
  section,
  inline = false,
}: {
  document: FacsimileDocument;
  title: string;
  faceHref: string;
  explanationHref: string;
  section?: string | undefined;
  inline?: boolean | undefined;
}) {
  const id = useId();
  const anchorId = (anchor: string) => (inline ? `${id}-${anchor}` : anchor);
  const targetHref = (anchor: string) => `${inline ? faceHref : ""}#${anchor}`;
  const scope = facsimileSectionPages(document, section);
  const initial = scope[0] ?? document.pages[0];
  if (!initial) return null;
  const sourceIds = new Set(document.units.map((unit) => unit.id));
  const aliases = [...new Set(document.units.flatMap((unit) => [...unit.aliases]))].filter(
    (alias) => !sourceIds.has(alias),
  );
  const sections = [...new Set(document.units.map((unit) => unit.section))].filter(
    (value): value is string => value !== null && !sourceIds.has(value),
  );
  const extraAnchors = [...new Set([...aliases, ...sections])];

  return (
    <section
      id={id}
      className="facsimile-reader"
      data-face-source
      data-facsimile-reader
      data-source-digest={document.sha256}
      data-facsimile-pdf-page={initial.pdfPage}
      aria-label={`${title}: original scanned pages`}
    >
      <FacsimileEnhancer
        rootId={id}
        document={document}
        initialPdfPage={initial.pdfPage}
        faceHref={faceHref}
        inline={inline}
      />
      <h2>Read the original scanned pages</h2>
      <p>
        These are the pinned journal scans, not a newly typeset transcription or a translation.
        Printed journal page numbers and PDF page numbers are shown separately. The scan’s
        machine-readable text may contain errors.
      </p>
      {section && (
        <p className="notice" data-facsimile-section={section}>
          {scope.length > 0
            ? `Opening at the first recorded source page for ${section}. The page directory marks every page with a recorded source unit in this section; the complete paper remains available.`
            : "No source-page map is recorded for this section yet. The complete paper opens at its first page; no paragraph location is implied."}
        </p>
      )}
      <noscript>
        <p className="notice">
          JavaScript is off. Every original-page link and the source directory below still works.
          The embedded viewer opens at the initial page; use the PDF’s own controls or a page link.
        </p>
      </noscript>
      <form data-facsimile-form className="facsimile-reader-toolbar">
        <fieldset data-facsimile-controls disabled>
          <legend>Choose a page from the original paper</legend>
          <div className="facsimile-reader-buttons">
            <button type="button" data-facsimile-previous disabled={initial.pdfPage === 1}>
              Previous page
            </button>
            <label htmlFor={`${id}-page`}>Printed journal page</label>
            <input
              id={`${id}-page`}
              data-facsimile-page-input
              type="text"
              inputMode="numeric"
              defaultValue={initial.printedPage}
              aria-describedby={`${id}-status`}
              size={6}
            />
            <button type="submit">Show page</button>
            <button
              type="button"
              data-facsimile-next
              disabled={initial.pdfPage === document.pages.length}
            >
              Next page
            </button>
          </div>
          <button type="button" data-facsimile-share>
            Copy source-page link
          </button>
          <label htmlFor={`${id}-share`}>Shareable source-page link</label>
          <input
            id={`${id}-share`}
            data-facsimile-share-url
            type="text"
            readOnly
            defaultValue={`${faceHref}#${facsimilePageAnchor(initial)}`}
          />
        </fieldset>
      </form>
      <p
        id={`${id}-status`}
        data-facsimile-status
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        Initial selection: printed page {initial.printedPage}, PDF page {initial.pdfPage} of{" "}
        {document.pages.length}.
      </p>
      <p className="facsimile-reader-recovery">
        <a data-facsimile-direct href={facsimilePdfHref(document, initial.pdfPage)}>
          Open printed page {initial.printedPage} in the original PDF
        </a>
        {" · "}
        <a href={document.pdfUrl} download>
          Download the complete pinned PDF
        </a>
        {" · "}
        <a href={explanationHref} data-view-link={inline ? "reading" : undefined}>
          Return to the explanation
        </a>
      </p>
      <p className="fine">
        A blank embedded display does not mean the source is missing. The direct PDF links work
        independently of this frame. Some browsers may ignore PDF page fragments; use the PDF page
        number shown in the directory in that case.
      </p>
      <iframe
        data-facsimile-frame
        src={facsimilePdfHref(document, initial.pdfPage)}
        title={`Original scan: printed page ${initial.printedPage}, PDF page ${initial.pdfPage} of ${document.pages.length}`}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <details className="facsimile-reader-provenance">
        <summary>Source identity and limits of verification</summary>
        <dl>
          <dt>Source record</dt>
          <dd>{document.key}</dd>
          <dt>Acquired</dt>
          <dd>{document.acquisitionDate}</dd>
          {/*
            The institution first, in words. This read only `rightsStatus` - "scan-open-terms" -
            which is a machine identifier: a reader could not tell whose terms they were. The
            token stays, because it is the recorded code and someone auditing the receipt needs
            it, but it is no longer the only thing said about the rights on a scan this project
            does not own. Omitted entirely when the receipt records no institution, rather than
            printed as "unknown", which would read as a claim about the source.
          */}
          {document.scanInstitution === null ? null : (
            <>
              <dt>Scan held by</dt>
              <dd>{document.scanInstitution}</dd>
            </>
          )}
          <dt>Recorded scan rights</dt>
          <dd>
            {document.rightsStatus}
            {document.termsUrl === null ? null : (
              <>
                {" · "}
                <a href={document.termsUrl} rel="noreferrer">
                  Terms statement
                </a>
              </>
            )}
          </dd>
          <dt>Origin</dt>
          <dd>
            <a href={document.originUrl} rel="noreferrer">
              Open the recorded archival source
            </a>
          </dd>
          <dt>Pinned SHA-256</dt>
          <dd>
            <code>{document.sha256}</code>
          </dd>
        </dl>
        <p>
          This build checked the served file against this digest and checked the recorded page-map
          arithmetic. Matching bytes are not a review of a transcription, translation, or historical
          claim. The source inventory is navigation metadata, not the original text.
        </p>
      </details>
      <h2>Original-page directory</h2>
      <p>
        The “Open original printed page” links open the scan directly, including without JavaScript.
        Source identifiers select their first recorded page in the embedded viewer when JavaScript
        is available. A passage that spans pages retains a link to each page.
      </p>
      <nav aria-label="Original scan pages" className="facsimile-reader-page-links">
        {document.pages.map((page) => (
          <a
            key={page.pdfPage}
            href={targetHref(facsimilePageAnchor(page))}
            data-facsimile-target={facsimilePageAnchor(page)}
            data-facsimile-page-link={page.pdfPage}
            aria-current={page.pdfPage === initial.pdfPage ? "page" : undefined}
          >
            {page.printedPage}
          </a>
        ))}
      </nav>
      <div data-facsimile-directory>
        {document.pages.map((page) => (
          <section
            key={page.pdfPage}
            id={anchorId(facsimilePageAnchor(page))}
            className="facsimile-reader-page"
          >
            {extraAnchors
              .filter((anchor) => resolveFacsimileTarget(document, anchor) === page.pdfPage)
              .map((anchor) => (
                <span key={anchor} id={anchorId(anchor)} className="facsimile-reader-anchor" />
              ))}
            <h3>
              Printed page {page.printedPage}{" "}
              <span className="fine">· PDF page {page.pdfPage}</span>
              {section && scope.some((item) => item.pdfPage === page.pdfPage) && (
                <span className="badge">Section source page</span>
              )}
            </h3>
            <p>
              <a href={facsimilePdfHref(document, page.pdfPage)}>
                Open original printed page {page.printedPage}
              </a>
            </p>
            <ul className="facsimile-reader-units">
              {document.units
                .filter((unit) => unit.pdfPages[0] === page.pdfPage)
                .map((unit) => (
                  <li key={unit.id} id={anchorId(unit.id)} tabIndex={-1}>
                    <a href={targetHref(unit.id)} data-facsimile-target={unit.id}>
                      {unit.id}
                    </a>{" "}
                    <span className="fine">({unit.kind.replaceAll("-", " ")})</span>
                    {unit.pdfPages.length > 1 && (
                      <span>
                        {" "}
                        · spans{" "}
                        {unit.pdfPages.map((number, index) => (
                          <span key={number}>
                            {index > 0 ? ", " : ""}
                            <a href={facsimilePdfHref(document, number)}>PDF page {number}</a>
                          </span>
                        ))}
                      </span>
                    )}
                  </li>
                ))}
            </ul>
            {document.units.length === 0 && (
              <p>
                No source-unit locators are recorded yet; the original page itself is available.
              </p>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
