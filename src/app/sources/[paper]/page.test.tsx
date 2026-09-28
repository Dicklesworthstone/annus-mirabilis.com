import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ROUTE_SLUGS } from "../../../content/ids.ts";
import { loadProvenanceReceipts } from "../../../content/provenance/loadReceipts.ts";
import type { ReceiptFrontMatter } from "../../../content/provenance/receiptSchema.ts";
import Sources from "../page";
import { receiptPageSlug } from "../receiptPages.ts";
import ReceiptPage, { generateStaticParams } from "./page";

/** /sources/[paper]/ against the real receipts: every value comes from the receipt it names. */
const receipts = loadProvenanceReceipts().receipts.flatMap(({ receipt }) =>
  receipt ? [receipt.frontMatter] : [],
);

async function render(slug: string): Promise<string> {
  return renderToStaticMarkup(await ReceiptPage({ params: Promise.resolve({ paper: slug }) }));
}

/**
 * The part of its page that is this receipt's: the whole page for a paper's only receipt, or the
 * section a companion receipt has, from its heading to the next receipt's.
 */
async function receiptPart(fm: ReceiptFrontMatter): Promise<string> {
  const html = await render(receiptPageSlug(fm.slug));
  const start = html.indexOf(`<section id="${fm.slug}"`);
  if (start === -1) return html;
  const next = html.indexOf("<section id=", start + 1);
  return html.slice(start, next === -1 ? html.length : next);
}

describe("/sources/[paper]/", () => {
  test("one page per paper, every receipt on one, and every receipt link on /sources/ lands on its own", async () => {
    expect(receipts.length).toBeGreaterThan(0);
    const slugs: readonly string[] = generateStaticParams().map((p) => p.paper);
    // Pages are paper route slugs, each once; a companion receipt is not a page of its own.
    for (const slug of slugs) expect(ROUTE_SLUGS as readonly string[]).toContain(slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const companions = receipts.filter((fm) => !slugs.includes(fm.slug));
    // Guard: the dissertation's correction is the companion this test exists for.
    expect(companions.length).toBeGreaterThan(0);
    for (const fm of receipts) {
      const page = receiptPageSlug(fm.slug);
      expect(slugs).toContain(page);
      expect(await render(page)).toContain(fm.paper.titleGerman.replace(/&/g, "&amp;"));
    }
    const links = [
      ...renderToStaticMarkup(<Sources />).matchAll(
        /href="\/sources\/([^"/]+)\/(?:#([^"]+))?">The full receipt/g,
      ),
    ];
    expect(links.length).toBe(receipts.length);
    for (const [, page, anchor] of links) {
      expect(slugs).toContain(page as string);
      if (anchor) expect(await render(page as string)).toContain(`<section id="${anchor}"`);
    }
  });

  test("each receipt's part lists every scan page and every witness it records", async () => {
    for (const fm of receipts) {
      const part = await receiptPart(fm);
      const rows = part.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
      expect({ slug: fm.slug, rows: rows.match(/<tr>/g)?.length ?? 0 }).toEqual({
        slug: fm.slug,
        rows: fm.pageMap.length,
      });
      const witnesses = part.split('class="receipt-witnesses"')[1]?.split("</ul>")[0] ?? "";
      expect(witnesses.match(/<li>/g)?.length ?? 0).toBe(fm.witnesses.length);
    }
  });

  test("the printing-error sentence counts the records, and names withdrawn ones as kept", async () => {
    const withErrors = receipts.filter((fm) => fm.typographicalErrors.length > 0);
    const withWithdrawn = withErrors.filter((fm) =>
      fm.typographicalErrors.some((e) => e.status === "retracted"),
    );
    // Guards: both kinds must exist, or the assertions below would check nothing.
    expect(withErrors.length).toBeGreaterThan(0);
    expect(withWithdrawn.length).toBeGreaterThan(0);
    for (const fm of receipts) {
      const text = (await receiptPart(fm)).replace(/<[^>]+>/g, "");
      if (fm.typographicalErrors.length === 0) {
        expect(text).toContain("No printing error has been recorded against these pages.");
        continue;
      }
      for (const page of new Set(fm.typographicalErrors.map((e) => e.locator.printedPage))) {
        expect(text).toContain(String(page));
      }
      const withdrawn = fm.typographicalErrors.filter((e) => e.status === "retracted").length;
      if (withdrawn > 0) expect(text).toContain("later withdrawn, and");
      expect(text).toContain("The correction log lists each one.");
    }
  });

  test("no link carries a bibliographic key, and no em dash", async () => {
    for (const slug of generateStaticParams().map((p) => p.paper)) {
      const html = await render(slug);
      for (const m of html.matchAll(/(?:href|id)="([^"]+)"/g)) {
        if (!(m[1] as string).startsWith("http")) expect(m[1]).not.toMatch(/ap-\d+-\d+/);
      }
      expect(html.replace(/<[^>]+>/g, "")).not.toContain("—");
    }
  });
});

/** Markup with its HTML entities resolved, so a value holding & or an apostrophe is comparable. */
function decoded(html: string): string {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&rsquo;|&#39;/g, "’")
    .replace(/&quot;/g, '"')
    .replace(/&middot;/g, "·")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

describe("/sources/[paper]/ surfaces the receipt rather than a fraction of it", () => {
  test("every figure on a receipt's part of the page is that receipt's own", async () => {
    // The staleness guard, and the reason it is written this way: a digest typed into a page is
    // worse than no digest, because a reader cannot tell a stale one from a current one. Each value
    // is read from the receipt here and asserted to appear in the markup that receipt produced, so
    // a page that stopped reading the record would go red rather than quietly drift.
    expect(receipts.length).toBeGreaterThanOrEqual(5);
    for (const fm of receipts) {
      // Compared against DECODED text: React escapes & to &amp;, and an institution named
      // "Bell & Howell" would otherwise read as absent from a page that shows it plainly.
      const part = decoded(await receiptPart(fm));
      const where = `${fm.slug}`;
      // The scan that is served, by its digest in full.
      expect(part, `${where}: the scan digest is absent`).toContain(fm.scan.sha256);
      expect(part, `${where}: the scanning institution is absent`).toContain(fm.scan.institution);
      expect(part, `${where}: the scan rights status is absent`).toContain(fm.scan.rightsStatus);
      // Where it sits in the record.
      expect(part, `${where}: the journal volume is absent`).toContain(
        String(fm.paper.journal.volume),
      );
      expect(part, `${where}: the whole-series volume is absent`).toContain(
        String(fm.paper.journal.wholeSeriesVolume),
      );
      expect(part, `${where}: the first page is absent`).toContain(
        String(fm.paper.journal.pages.first),
      );
      // Every date the receipt records, by type.
      for (const d of fm.paper.dates)
        expect(part, `${where}: the ${d.type} date is absent`).toContain(d.text ?? d.iso);
      // Every witness's rights status, which the page omitted entirely before.
      for (const w of fm.witnesses ?? [])
        expect(part, `${where}: witness ${w.identity} carries no rights status`).toContain(
          w.rightsStatus,
        );
    }
  });

  test("a witness consulted but never reproduced is marked as such, and there is at least one", async () => {
    // Not a hypothetical category: every receipt carries witnesses of both kinds, and the
    // in-copyright ones are the more interesting fact because they explain what is NOT reproduced.
    const inCopyright = receipts.flatMap((fm) =>
      (fm.witnesses ?? []).filter((w) => w.rightsStatus === "in-copyright-witness-only"),
    );
    expect(inCopyright.length).toBeGreaterThan(0);
    for (const fm of receipts) {
      if (!(fm.witnesses ?? []).some((w) => w.rightsStatus === "in-copyright-witness-only"))
        continue;
      const part = decoded(await receiptPart(fm));
      expect(part).toContain("in-copyright-witness-only");
      expect(part).toContain("consulted as a witness and never reproduced");
    }
  });

  test("each receipt says what has NOT been established, beside what has", async () => {
    // The clause /accessibility/ now carries, and it applies harder here: a page that lists a
    // digest and omits that nobody has reviewed the transcription tells a reader the verifiable
    // half. Measured across the receipts: every ledger is in-progress or not-started, none records
    // a ledger digest, and none names an editor.
    for (const fm of receipts) {
      const part = decoded(await receiptPart(fm));
      const where = `${fm.slug}`;
      expect(part, `${where}: no limits section`).toContain("What has not been established");
      expect(part, `${where}: the ledger status is not stated`).toContain(
        fm.transcription.ledgerStatus,
      );
      expect(part, `${where}: the review gap is not stated`).toContain(
        "No person has reviewed the transcription",
      );
      expect(part, `${where}: the record is presented as a result`).toContain(
        "it is not a claim that the result is correct",
      );
      if ((fm.transcription.editors ?? []).length === 0)
        expect(part, `${where}: an unnamed editor is not said to be unnamed`).toContain(
          "no editor is named against it",
        );
    }
  });

  test("the pages read without JavaScript, and print", async () => {
    for (const slug of generateStaticParams().map((p) => p.paper)) {
      const html = await render(slug);
      expect(html).not.toContain("use client");
      // Substance, in the unit this page was measured in: before this change the thinnest was 1,799
      // visible characters and the index that led to it was 19,914.
      const text = html
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      expect(text.length, `${slug} is thin`).toBeGreaterThan(4000);
    }
  });
});
