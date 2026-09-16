/**
 * Pure measurement and comparison helpers behind the harness's browser
 * checks (am-test-e2e-harness-bqmh requirement 6). Each function takes
 * already-captured values (a page's measured widths, extracted text, a
 * view's dataset attributes) so it can be exercised with fixed fixtures;
 * the Playwright calls that capture those values live beside the harness's
 * page checks, never here.
 */

export interface OverflowCheck {
  ok: boolean;
  scrollWidth: number;
  clientWidth: number;
  overflowPx: number;
}

/**
 * "No page-level horizontal overflow" (AGENTS.md, requirement 6) is
 * `scrollWidth <= clientWidth`, with no fudge factor. Some product pages
 * elsewhere in this repository currently compare against `innerWidth + 1`;
 * this harness check is deliberately stricter because the bead's acceptance
 * criteria are frozen as written, and loosening a check to match today's
 * pages would hide the very regression this check exists to catch.
 */
export function checkNoHorizontalOverflow(scrollWidth: number, clientWidth: number): OverflowCheck {
  const overflowPx = Math.max(0, scrollWidth - clientWidth);
  return { ok: scrollWidth <= clientWidth, scrollWidth, clientWidth, overflowPx };
}

/**
 * Normalizes extracted text (from a rendered HTML page or a PDF text layer)
 * for comparison: collapses runs of whitespace (including newlines) into a
 * single space and trims the ends. Both sides of a print-fidelity
 * comparison go through the same normalizer so pagination whitespace or a
 * PDF extractor's line breaks never register as a content difference.
 */
export function normalizePrintText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export interface PrintTextComparison {
  ok: boolean;
  normalizedHtml: string;
  normalizedPdf: string;
}

/**
 * Compares the essential text of the rendered HTML against the text layer
 * of the site's own generated PDF for the same content, after normalizing
 * both. This proves the PDF was not clipped or truncated relative to the
 * page; it says nothing about layout or pagination.
 */
export function compareEssentialPrintText(htmlText: string, pdfText: string): PrintTextComparison {
  const normalizedHtml = normalizePrintText(htmlText);
  const normalizedPdf = normalizePrintText(pdfText);
  return { ok: normalizedHtml === normalizedPdf, normalizedHtml, normalizedPdf };
}

export interface SnapshotIdentityAttrs {
  view: string;
  instanceId: string;
  runId: string;
  snapshotVersion: string;
}

export interface SnapshotIdentityCheck {
  ok: boolean;
  mismatches: string[];
}

/**
 * Every view of one instrument instance (trace, distribution, equation live
 * values, table, accessible description) must publish the same
 * `data-instance-id`, `data-run-id`, and `data-snapshot-version`. Fails
 * naming every disagreeing view rather than only the first.
 */
export function checkSameSnapshotIdentity(views: readonly SnapshotIdentityAttrs[]): SnapshotIdentityCheck {
  const first = views[0];
  if (!first) {
    return { ok: false, mismatches: ["no views supplied; a snapshot-identity check requires at least one view"] };
  }
  const mismatches: string[] = [];
  for (const view of views.slice(1)) {
    if (view.instanceId !== first.instanceId) {
      mismatches.push(`view "${view.view}" has instanceId ${view.instanceId}, expected ${first.instanceId} (from view "${first.view}")`);
    }
    if (view.runId !== first.runId) {
      mismatches.push(`view "${view.view}" has runId ${view.runId}, expected ${first.runId} (from view "${first.view}")`);
    }
    if (view.snapshotVersion !== first.snapshotVersion) {
      mismatches.push(
        `view "${view.view}" has snapshotVersion ${view.snapshotVersion}, expected ${first.snapshotVersion} (from view "${first.view}")`,
      );
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}
