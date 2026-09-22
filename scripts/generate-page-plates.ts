/**
 * Renders every printed page of a paper's pinned facsimile as a plate for the German source face,
 * which shows the printed page the reader has reached beside the text (src/reader/faces/
 * FollowingPlate.tsx). One WebP per page, 640px wide (the plate is shown 20rem wide, so this is
 * sharp at 2x), at public/figures/plates/pages/<key>/<printed page>.webp.
 *
 * WHAT IT READS. The pinned PDF only, rasterized with pdftoppm, which draws page pixels and is not
 * an OCR engine (AGENTS.md, "Cloud OCR only"); no text layer is read. The printed page number of
 * each PDF page comes from the receipt's pageMap, never from the page image.
 *
 * RIGHTS. Only keys whose receipt says `rightsStatus: scan-open-terms` and
 * `publicationDecision: publish` are rendered. On 2026-09-22 that was ap-17-132, ap-17-549 and
 * ap-18-639: Bell & Howell / UMI microfilm scans on Internet Archive, chosen by each receipt over
 * scans whose terms restrict redistribution.
 *
 * Usage: bun scripts/generate-page-plates.ts <key>... [--work <dir>]
 * Intermediate PNGs go to --work (default: a directory under the OS temp dir) and are left there.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

export type PagePlan = Readonly<{ pdfPageIndex: number; printedPage: number }>;

export class PagePlateError extends Error {
  readonly code: "page-map-conflict";
  constructor(code: "page-map-conflict", message: string) {
    super(message);
    this.name = "PagePlateError";
    this.code = code;
  }
}

/**
 * The receipt's pageMap, one (PDF page, printed page) pair per PDF page, in PDF order. A page that
 * carries several sections is listed once per section; those entries must agree, and a
 * disagreement stops the script rather than guess which printed number is right.
 */
export function receiptPageMap(receipt: string): PagePlan[] {
  const byPdfPage = new Map<number, number>();
  for (const m of receipt.matchAll(/pdfPageIndex:\s*(\d+)\s*\n\s*printedPage:\s*(\d+)/g)) {
    const pdfPageIndex = Number(m[1]);
    const printedPage = Number(m[2]);
    const known = byPdfPage.get(pdfPageIndex);
    if (known !== undefined && known !== printedPage)
      throw new PagePlateError(
        "page-map-conflict",
        `PDF page ${pdfPageIndex} is printed page ${known} and ${printedPage}.`,
      );
    byPdfPage.set(pdfPageIndex, printedPage);
  }
  return [...byPdfPage]
    .map(([pdfPageIndex, printedPage]) => ({ pdfPageIndex, printedPage }))
    .sort((a, b) => a.pdfPageIndex - b.pdfPageIndex);
}

export function mayPublish(receipt: string): boolean {
  return (
    /rightsStatus:\s*scan-open-terms\b/.test(receipt) &&
    /publicationDecision:\s*publish\b/.test(receipt)
  );
}

function run(keys: readonly string[], work: string): void {
  for (const key of keys) {
    const receipt = readFileSync(join(ROOT, "docs/provenance", `${key}.md`), "utf8");
    if (!mayPublish(receipt)) {
      console.log(JSON.stringify({ event: "page-plates-skipped", key, reason: "rights" }));
      continue;
    }
    const pdf = join(ROOT, "public/papers/pdfs", `${key}.pdf`);
    const plan = receiptPageMap(receipt);
    const out = join(ROOT, "public/figures/plates/pages", key);
    mkdirSync(out, { recursive: true });
    for (const { pdfPageIndex, printedPage } of plan) {
      const stem = join(work, `${key}-${pdfPageIndex}`);
      execFileSync("pdftoppm", [
        "-f",
        String(pdfPageIndex),
        "-l",
        String(pdfPageIndex),
        "-r",
        "160",
        "-gray",
        "-singlefile",
        "-png",
        pdf,
        stem,
      ]);
      execFileSync("magick", [
        `${stem}.png`,
        "-resize",
        "640x",
        "-quality",
        "72",
        join(out, `${printedPage}.webp`),
      ]);
    }
    console.log(JSON.stringify({ event: "page-plates-written", key, pages: plan.length, out }));
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const workAt = args.indexOf("--work");
  const work =
    workAt >= 0 && args[workAt + 1]
      ? (args[workAt + 1] as string)
      : mkdtempSync(join(tmpdir(), "am-page-plates-"));
  if (!existsSync(work)) mkdirSync(work, { recursive: true });
  const keys = args.filter((a, i) => a !== "--work" && i !== workAt + 1);
  run(keys, work);
}
