import type { ReactNode } from "react";
import {
  highlightKernelSource,
  quantityHue,
  selectionCss,
  tokenizeKernelSource,
} from "../../content/kernel/highlight.ts";
import type { WorkedTrace } from "../../content/kernel/types.ts";
import { KERNEL_DISPLAY_ROLE_LABELS, type KernelListing } from "../../content/kernel/types.ts";
import "./showTheCode.css";

function TraceTable({ trace }: { trace: WorkedTrace }) {
  return (
    <section
      className="kernel-trace-wrap"
      aria-label={`Worked example table, constant set ${trace.constantSetLabel}`}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable
      tabIndex={0}
    >
      <table
        className="kernel-trace"
        data-constant-set={trace.constantSetLabel}
        data-scenario={trace.scenarioId}
      >
        <caption>
          One worked example of this calculation. Constant set: {trace.constantSetLabel}.
        </caption>
        <thead>
          <tr>
            <th>Step</th>
            <th>Expression</th>
            <th>Value</th>
            <th>Unit</th>
          </tr>
        </thead>
        <tbody>
          {trace.rows.map((row) => (
            <tr key={row.label} data-quantity-id={row.quantityId} data-op-id={row.opId}>
              <th scope="row">{row.label}</th>
              <td>{row.expression}</td>
              <td>{String(row.value)}</td>
              <td>{row.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {trace.terminatedAtRow !== undefined ? (
        <p>{trace.refusalMessage ?? "The calculation stopped at this row."}</p>
      ) : null}
    </section>
  );
}

export type ShowTheCodeProps = Readonly<{
  listings: readonly KernelListing[];
  producedCurrentSnapshot?: boolean | undefined;
  snapshotFunctionName?: string | undefined;
  snapshotSourceDigest?: string | undefined;
  equationCard?: ReactNode;
  uid?: string | undefined;
}>;

function slug(text: string): string {
  return text.replace(/[^A-Za-z0-9_-]+/g, "-");
}

export function ShowTheCode({
  listings,
  producedCurrentSnapshot = false,
  snapshotFunctionName,
  snapshotSourceDigest,
  equationCard,
  uid = "stc",
}: ShowTheCodeProps) {
  const quantityIds = [
    ...new Set(listings.flatMap((l) => l.identifierBindings.map((b) => b.quantityId))),
  ];
  return (
    <details className="show-the-code" open>
      <summary>Show the code</summary>
      <style>{selectionCss(quantityIds)}</style>
      {listings.map((listing) => {
        const id = `${uid}-${slug(listing.exportName)}`;
        const roleLabel = KERNEL_DISPLAY_ROLE_LABELS[listing.displayRole];
        const tokens = listing.source
          ? tokenizeKernelSource(listing.source, listing.identifierBindings)
          : [];
        const claimsSnapshot =
          producedCurrentSnapshot && snapshotFunctionName === listing.exportName;
        const digestMismatch =
          claimsSnapshot &&
          Boolean(snapshotSourceDigest) &&
          Boolean(listing.sourceHash) &&
          listing.sourceHash !== snapshotSourceDigest;
        return (
          <article
            key={listing.exportName}
            className="show-the-code-listing"
            data-display-role={listing.displayRole}
            data-export-name={listing.exportName}
          >
            <p className="kernel-role">{roleLabel}</p>
            <p className="kernel-header">
              {listing.exportName}
              {listing.filePath ? ` · ${listing.filePath}` : ""}
              {listing.revision ? ` · revision ${listing.revision}` : ""}
              {listing.sourceHash ? ` · ${listing.sourceHash}` : ""}
            </p>
            <p className="kernel-header">
              {digestMismatch
                ? "Listing refused: Source hash does not match current snapshot."
                : claimsSnapshot
                  ? "This is the function that produced the current snapshot."
                  : "This function computes the listed outputs when it runs."}
            </p>
            <nav className="show-the-code-tabs" aria-label="Show the code">
              <a href={`#${id}-words`}>In words</a>
              <a href={`#${id}-mathematics`}>Mathematics</a>
              <a href={`#${id}-implementation`}>Implementation</a>
            </nav>
            <section id={`${id}-words`} className="show-the-code-panel" data-tab="words">
              <h3>In words</h3>
              <p>{listing.words}</p>
            </section>
            <section
              id={`${id}-mathematics`}
              className="show-the-code-panel"
              data-tab="mathematics"
            >
              <h3>Mathematics</h3>
              {equationCard ??
                (listing.equationId ? (
                  <div data-equation-card="" data-equation-ref={listing.equationId} />
                ) : null)}
            </section>
            <section
              id={`${id}-implementation`}
              className="show-the-code-panel"
              data-tab="implementation"
            >
              <h3>Implementation</h3>
              {digestMismatch ? (
                <div
                  className="kernel-refusal kernel-digest-mismatch"
                  data-refusal-code="stale-kernel-listing"
                  role="alert"
                >
                  <p>
                    <strong>Source listing refused:</strong> The displayed kernel source hash (
                    <code>{listing.sourceHash}</code>) does not match the digest of the source that
                    produced the current snapshot (<code>{snapshotSourceDigest}</code>). A stale or
                    mismatched listing is refused to prevent displaying inaccurate code.
                  </p>
                </div>
              ) : (
                <>
                  {/* The code scrolls horizontally, so a keyboard-only reader must be able to
                      focus the scrolling box (WCAG 2.1 SC 2.1.1); axe reported
                      scrollable-region-focusable on all five listings once they began
                      rendering. A named section is the shape .comparison-scroll already uses:
                      a pre has no role that accepts a name, and a role attribute here only
                      trades one lint rule for another. */}
                  {tokens.length > 0 ? (
                    <section
                      className="show-the-code-scroll"
                      aria-label={`${listing.exportName} source`}
                      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable
                      tabIndex={0}
                    >
                      <pre>
                        <code data-language={listing.language ?? "ts"}>
                          {tokens.map((token) => {
                            if (token.kind === "ident" && token.quantityId) {
                              return (
                                <span
                                  key={token.start}
                                  className="kernel-ident"
                                  data-quantity-id={token.quantityId}
                                  style={{
                                    color: quantityHue(token.quantityId),
                                    textDecoration: "underline",
                                    textDecorationStyle: "dotted",
                                    textUnderlineOffset: "0.18em",
                                  }}
                                >
                                  {token.text}
                                </span>
                              );
                            }
                            if (token.kind === "comment") {
                              return (
                                <span key={token.start} className="kernel-comment">
                                  {token.text}
                                </span>
                              );
                            }
                            if (token.kind === "string") {
                              return (
                                <span key={token.start} className="kernel-string">
                                  {token.text}
                                </span>
                              );
                            }
                            return <span key={token.start}>{token.text}</span>;
                          })}
                        </code>
                      </pre>
                    </section>
                  ) : null}
                  {listing.trace ? <TraceTable trace={listing.trace} /> : null}
                  {listing.independentReferences.length > 0 ? (
                    <ul>
                      {listing.independentReferences.map((ref) => (
                        <li key={`${ref.experimentId}/${ref.quantityId}`}>
                          <a href={`/verification/${ref.experimentId}/${ref.quantityId}`}>
                            how this number is checked
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </section>
          </article>
        );
      })}
    </details>
  );
}

export function listingFromExtraction(listing: KernelListing): KernelListing {
  if (!listing.source || listing.highlightedHtml) return listing;
  return {
    ...listing,
    highlightedHtml: highlightKernelSource(
      listing.source,
      listing.language ?? "ts",
      listing.identifierBindings,
    ),
  };
}
