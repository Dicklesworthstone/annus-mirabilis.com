import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadProvenanceReceipts } from "../../../content/provenance/loadReceipts.ts";
import Sources from "../page";
import ReceiptPage, { generateStaticParams } from "./page";

/** /sources/[paper]/ against the real receipts: every value comes from the receipt it names. */
const receipts = loadProvenanceReceipts().receipts.flatMap(({ receipt }) =>
  receipt ? [receipt.frontMatter] : [],
);

async function render(slug: string): Promise<string> {
  return renderToStaticMarkup(await ReceiptPage({ params: Promise.resolve({ paper: slug }) }));
}

describe("/sources/[paper]/", () => {
  test("one page per receipt, and every receipt link on /sources/ lands on one", () => {
    expect(receipts.length).toBeGreaterThan(0);
    const slugs = generateStaticParams().map((p) => p.paper);
    expect(slugs.sort()).toEqual(receipts.map((fm) => fm.slug).sort());
    const linked = [
      ...renderToStaticMarkup(<Sources />).matchAll(/href="\/sources\/([^"/]+)\/"/g),
    ].map((m) => m[1] as string);
    expect(linked.length).toBe(receipts.length);
    for (const slug of linked) expect(slugs).toContain(slug);
  });

  test("each page lists every scan page and every witness its receipt records", async () => {
    for (const fm of receipts) {
      const html = await render(fm.slug);
      const rows = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
      expect(rows.match(/<tr>/g)?.length ?? 0).toBe(fm.pageMap.length);
      const witnesses = html.split('class="receipt-witnesses"')[1]?.split("</ul>")[0] ?? "";
      expect(witnesses.match(/<li>/g)?.length ?? 0).toBe(fm.witnesses.length);
      expect(html).toContain(fm.paper.titleGerman.replace(/&/g, "&amp;"));
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
      const text = (await render(fm.slug)).replace(/<[^>]+>/g, "");
      if (fm.typographicalErrors.length === 0) {
        expect(text).toContain("No printing error has been recorded against these pages.");
        continue;
      }
      for (const page of new Set(fm.typographicalErrors.map((e) => e.locator.printedPage))) {
        expect(text).toContain(String(page));
      }
      const withdrawn = fm.typographicalErrors.filter((e) => e.status === "retracted").length;
      if (withdrawn > 0) expect(text).toContain("later withdrawn, and");
    }
  });

  test("no link carries a bibliographic key, and no em dash", async () => {
    for (const fm of receipts) {
      const html = await render(fm.slug);
      for (const m of html.matchAll(/href="([^"]+)"/g)) {
        if ((m[1] as string).startsWith("/")) expect(m[1]).not.toMatch(/ap-\d+-\d+/);
      }
      expect(html.replace(/<[^>]+>/g, "")).not.toContain("—");
    }
  });
});
