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
