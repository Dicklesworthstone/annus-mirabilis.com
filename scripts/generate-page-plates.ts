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
 * Usage: bun scripts/generate-page-plates.ts <key>... [--work <dir>] [--width 1280]
 * Intermediate PNGs go to --work (default: a directory under the OS temp dir) and are left there.
 *
 * --width 1280 writes <printed page>-1280.webp beside the 640px plate, for the plate at the size
 * it is shown on a desktop (about 510-620 CSS px, height-bound, so 1,000-1,250 device px on a 2x
 * screen). The scan's own resolution is 400ppi, 2004px across the page, so 1280 is below what the
 * pinned PDF holds and nothing is upscaled. The 640px files are not rewritten.
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

/** Rasterizing resolution for an output width: 160 dpi gives the 640px plate. */
export function plateDpi(width: number): number {
  return Math.ceil((width / 640) * 160);
}

/** The file a plate of this width is written to: 640 keeps its original name. */
export function plateFileName(printedPage: number, width: number): string {
  return width === 640 ? `${printedPage}.webp` : `${printedPage}-${width}.webp`;
}

function run(keys: readonly string[], work: string, width: number): void {
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
      const stem = join(work, `${key}-${pdfPageIndex}-${width}`);
      execFileSync("pdftoppm", [
        "-f",
        String(pdfPageIndex),
        "-l",
        String(pdfPageIndex),
        "-r",
        String(plateDpi(width)),
        "-gray",
        "-singlefile",
        "-png",
        pdf,
        stem,
      ]);
      execFileSync("magick", [
        `${stem}.png`,
        "-resize",
        `${width}x`,
        "-quality",
        "72",
        join(out, plateFileName(printedPage, width)),
      ]);
    }
    console.log(
      JSON.stringify({ event: "page-plates-written", key, width, pages: plan.length, out }),
    );
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
  const widthAt = args.indexOf("--width");
  const width = widthAt >= 0 ? Number(args[widthAt + 1]) : 640;
  if (width !== 640 && width !== 1280) {
    console.error("--width is 640 or 1280.");
    process.exit(2);
  }
  const keys = args.filter(
    (a, i) =>
      !["--work", "--width"].includes(a) &&
      !(workAt >= 0 && i === workAt + 1) &&
      !(widthAt >= 0 && i === widthAt + 1),
  );
  run(keys, work, width);
}
