import { describe, expect, test } from "bun:test";
import { loadProvenanceReceipts } from "../../content/provenance/loadReceipts.ts";
import type { ReceiptFrontMatter } from "../../content/provenance/receiptSchema.ts";
import { reuseOf, textLayerWords } from "./reuse.ts";

/*
 * What a scan may be reused under comes from its own record, never from the site's license
 * (am-design-sources-about-zumd). The fixtures are a real receipt with its rights fields changed, so
 * everything else in them is a shape the parser has accepted.
 */
const base = loadProvenanceReceipts().receipts.find((r) => r.receipt)?.receipt?.frontMatter;

function withScan(changes: Partial<ReceiptFrontMatter["scan"]>): ReceiptFrontMatter {
  if (!base) throw new Error("No parsed receipt to build fixtures from.");
  return { ...base, scan: { ...base.scan, ...changes } };
}

describe("reuseOf", () => {
  test("a parsed receipt exists to build the fixtures from", () => {
    expect(base).toBeDefined();
  });

  test("a published scan under its host's terms is offered for reuse on those terms, quoted", () => {
    const reuse = reuseOf(withScan({ publicationDecision: "publish", reuseTerms: "source-terms" }));
    expect(reuse.offered).toBe(true);
    expect(reuse.words).toContain("host's own terms");
    expect(reuse.statements).toEqual(base?.scan.termsStatements ?? []);
    expect(reuse.statements.length).toBeGreaterThan(0);
  });

  test("a pending decision is named as pending, and no terms are offered", () => {
    const reuse = reuseOf(
      withScan({ publicationDecision: "publish", reuseTerms: "pending-decision" }),
    );
    expect(reuse.offered).toBe(false);
    expect(reuse.words).toContain("Pending");
    expect(reuse.words).toContain("no reuse terms are offered");
  });

  test("an unpublished scan is offered no reuse, whatever its reuse field says", () => {
    // The second case is the one a naive reading of reuseTerms alone gets wrong.
    for (const reuseTerms of ["no-reuse-offered", "source-terms"] as const) {
      const reuse = reuseOf(
        withScan({
          publicationDecision: "pin-local-only",
          publicationReason: "The host's terms restrict redistribution.",
          reuseTerms,
        }),
      );
      expect({ reuseTerms, offered: reuse.offered }).toEqual({ reuseTerms, offered: false });
      expect(reuse.words).toContain("Held by the editors and not published.");
      expect(reuse.words).toContain("The host's terms restrict redistribution.");
      expect(reuse.words).toContain("Not offered for reuse.");
      expect(reuse.words).not.toContain("host's own terms, as recorded");
    }
  });

  test("a scan consulted only is described as that, and offered nothing", () => {
    const reuse = reuseOf(
      withScan({
        publicationDecision: "reference-only",
        publicationReason: "Cited, not copied.",
        reuseTerms: "no-reuse-offered",
      }),
    );
    expect(reuse.offered).toBe(false);
    expect(reuse.words).toContain("Consulted and cited only");
  });
});

describe("textLayerWords", () => {
  test("says the scan carries its host's machine-read text only when the receipt records it", () => {
    expect(textLayerWords(withScan({ embeddedTextLayer: "present" }))).toContain(
      "machine-read text layer",
    );
    expect(textLayerWords(withScan({ embeddedTextLayer: "unknown" }))).toContain(
      "the receipt does not say",
    );
    expect(textLayerWords(withScan({ embeddedTextLayer: "absent" }))).toBeNull();
  });
});
