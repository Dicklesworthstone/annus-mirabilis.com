/** The app's download list is a projection of the same checked receipts and PDF pins as /sources/. */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkedReceipts,
  receiptHref,
  receiptPageSlug,
} from "../../src/app/sources/receiptPages.ts";
import type { ReceiptFrontMatter } from "../../src/content/provenance/receiptSchema.ts";
import { parseYaml } from "../../src/content/provenance/yaml.ts";
import { projectFacsimileDocument } from "../../src/reader/facsimile/document.ts";

export const FACSIMILE_MAX_BYTES = 64 * 1024 * 1024;

export type NativeFacsimileAsset = Readonly<{
  key: string;
  paper: string;
  title: string;
  receiptHref: string;
  redistributable: boolean;
  path?: string;
  sha256?: string;
  bytes?: number;
}>;

export class NativeFacsimileExportError extends Error {
  readonly code = "facsimile-source-invalid";
  constructor(message: string) {
    super(message);
    this.name = "NativeFacsimileExportError";
  }
}

/** Only published source pins get a download path. Private scans are never opened or sized. */
export function projectNativeFacsimile(
  receipt: ReceiptFrontMatter,
  config: unknown,
  outDir: string,
): NativeFacsimileAsset {
  const entry = {
    key: receipt.key,
    paper: receiptPageSlug(receipt.slug),
    title: receipt.paper.titleGerman,
    receiptHref: receiptHref(receipt.slug),
  };
  if (receipt.scan.publicationDecision !== "publish") return { ...entry, redistributable: false };
  const pin = projectFacsimileDocument(receipt.slug, receipt.key, config);
  if (!pin || pin.sha256 !== receipt.scan.sha256)
    throw new NativeFacsimileExportError(
      `${receipt.key}: the receipt and public source pin disagree.`,
    );
  const canonical = `/papers/pdfs/${receipt.key}.pdf`;
  if (pin.pdfUrl !== canonical || receipt.scan.path !== `public${canonical}`)
    throw new NativeFacsimileExportError(
      `${receipt.key}: only the canonical PDF path can be downloaded.`,
    );
  const file = join(outDir, canonical.slice(1));
  const info = lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size < 5 || info.size > FACSIMILE_MAX_BYTES)
    throw new NativeFacsimileExportError(
      `${receipt.key}: the exported PDF is outside its file budget.`,
    );
  const bytes = readFileSync(file);
  if (
    bytes.length !== info.size ||
    !bytes.subarray(0, 5).equals(Buffer.from("%PDF-")) ||
    createHash("sha256").update(bytes).digest("hex") !== pin.sha256
  )
    throw new NativeFacsimileExportError(
      `${receipt.key}: the exported PDF does not match its source pin.`,
    );
  return {
    ...entry,
    redistributable: true,
    path: canonical,
    sha256: pin.sha256,
    bytes: bytes.length,
  };
}

/** The immutable app manifest carries these pins; the PDF bytes remain excluded from its bundle. */
export function buildNativeFacsimiles(
  repo: string,
  outDir: string,
): readonly NativeFacsimileAsset[] {
  const provenanceDir = join(repo, "docs/provenance");
  // Older/fixture exports without the source owner have no download capability or invented pins.
  if (!existsSync(provenanceDir)) return [];
  const configDir = join(repo, "scripts/sources/facsimile-sources");
  const receipts = checkedReceipts({
    provenanceDir,
    configDir,
    rootDir: repo,
    requireLocal: false,
  });
  return receipts.map(({ receipt, key }) => {
    if (!receipt) throw new NativeFacsimileExportError(`${key}: the source receipt is unreadable.`);
    const fm = receipt.frontMatter;
    const config =
      fm.scan.publicationDecision === "publish"
        ? parseYaml(readFileSync(join(configDir, `${key}.yaml`), "utf8"))
        : null;
    return projectNativeFacsimile(fm, config, outDir);
  });
}
