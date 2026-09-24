import { ROUTE_SLUGS, type RouteSlug } from "../../content/ids.ts";
import { loadProvenanceReceipts } from "../../content/provenance/loadReceipts.ts";
import type { ReceiptFrontMatter } from "../../content/provenance/receiptSchema.ts";
import { SourcesError } from "./refusals.ts";

/*
 * ONE RECEIPT PAGE PER PAPER ROUTE SLUG (am-design-sources-about-zumd). A paper usually has one
 * receipt, but the dissertation has two: its own scan (molecular-dimensions) and the 1911
 * correction (molecular-dimensions-correction). The correction is not a paper and gets no page of
 * its own; it is a section of the dissertation's page.
 *
 * A receipt belongs to the route slug it equals, or extends with a hyphen. That is the rule the
 * receipts already follow, read against the one list of route slugs (src/content/ids.ts), so no map
 * of companions is typed here. A receipt that belongs to no route slug stops the build.
 */

/** The route slug whose receipt page holds this receipt. */
export function receiptPageSlug(receiptSlug: string): RouteSlug {
  const found = ROUTE_SLUGS.filter(
    (route) => receiptSlug === route || receiptSlug.startsWith(`${route}-`),
  ).sort((a, b) => b.length - a.length)[0];
  if (!found) {
    throw new SourcesError(
      "receipt-page-unknown",
      `The receipt slug "${receiptSlug}" names no paper route, so it has no receipt page.`,
    );
  }
  return found;
}

/** Where a receipt is on its page: the page itself, or the section a companion receipt has there. */
export function receiptHref(receiptSlug: string): string {
  const page = receiptPageSlug(receiptSlug);
  return page === receiptSlug ? `/sources/${page}/` : `/sources/${page}/#${receiptSlug}`;
}

/** Each receipt page's receipts, the paper's own first and then in order of publication. */
export function receiptsByPage(): ReadonlyMap<RouteSlug, readonly ReceiptFrontMatter[]> {
  const pages = new Map<RouteSlug, ReceiptFrontMatter[]>();
  for (const { receipt } of loadProvenanceReceipts().receipts) {
    if (!receipt) continue;
    const fm = receipt.frontMatter;
    const page = receiptPageSlug(fm.slug);
    pages.set(page, [...(pages.get(page) ?? []), fm]);
  }
  const published = (fm: ReceiptFrontMatter) =>
    fm.paper.dates.find((d) => d.type === "issue-publication")?.iso ?? "";
  for (const [page, list] of pages)
    list.sort(
      (a, b) =>
        Number(b.slug === page) - Number(a.slug === page) ||
        published(a).localeCompare(published(b)),
    );
  return pages;
}
