import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadProvenanceReceipts } from "../../content/provenance/loadReceipts.ts";
import ReceiptPage from "./[paper]/page";
import Sources from "./page";
import { receiptPageSlug } from "./receiptPages.ts";

/**
 * Every record on /sources/ and its receipt pages says what role it plays (dispatch 150, item 2),
 * in AGENTS.md's Citation roles: the scan is the primary source, and a receipt's witnesses are
 * comparison witnesses. Counted against the receipts, so a record that lost its label fails.
 */
const receipts = loadProvenanceReceipts().receipts.flatMap(({ receipt }) =>
  receipt ? [receipt.frontMatter] : [],
);

describe("records labelled by role", () => {
  test("every scan on /sources/ is labelled as the primary source", () => {
    expect(receipts.length).toBeGreaterThan(0);
    const entries = renderToStaticMarkup(<Sources />)
      .split('<li class="sources-entry">')
      .slice(1);
    expect(entries.length).toBe(receipts.length);
    for (const entry of entries) {
      expect(entry).toContain("<dt>Role</dt><dd>Primary source:");
    }
  });

  test("every witness on a receipt page is labelled as a comparison witness", async () => {
    const pages = new Map<string, string>();
    let witnesses = 0;
    for (const fm of receipts) {
      const slug = receiptPageSlug(fm.slug);
      if (!pages.has(slug)) {
        pages.set(
          slug,
          renderToStaticMarkup(await ReceiptPage({ params: Promise.resolve({ paper: slug }) })),
        );
      }
      witnesses += fm.witnesses.length;
    }
    // Guard: receipts with no witnesses would make the comparison below vacuous.
    expect(witnesses).toBeGreaterThan(0);
    const labelled = [...pages.values()].reduce(
      (n, html) => n + (html.match(/<\/strong>, a comparison witness\./g) ?? []).length,
      0,
    );
    expect(labelled).toBe(witnesses);
    for (const html of pages.values()) {
      expect(html).toContain("The scan is the primary source.");
    }
  });
});
