import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ReceiptFrontMatter, RightsStatus } from "../../content/provenance/receiptSchema.ts";
import type { SourceAsset } from "../../content/provenance/receiptToSourceAsset.ts";

/**
 * The ways /sources/ refuses to build, each with a code (as FirstPagesError does for the home
 * page). Each one stops the export rather than publishing a page that says something false.
 */
export type SourcesErrorCode =
  | "receipt-unparsed"
  | "rights-wording-missing"
  | "served-digest-mismatch"
  | "served-file-missing"
  | "receipt-page-unknown"
  | "receipt-check-failed";

export class SourcesError extends Error {
  readonly code: SourcesErrorCode;
  constructor(code: SourcesErrorCode, message: string) {
    super(message);
    this.name = "SourcesError";
    this.code = code;
  }
}

/** A receipt that did not parse stops the build rather than dropping out of the list. */
export function requireReceipt<T>(receipt: T | undefined, key: string): T {
  if (!receipt) {
    throw new SourcesError("receipt-unparsed", `The provenance receipt for ${key} did not parse.`);
  }
  return receipt;
}

/**
 * The words for a rights status. A status with no wording stops the build, so a new kind of scan is
 * described by someone who has read its terms rather than by a fallback.
 */
export function rightsWordsFor(
  words: Partial<Record<RightsStatus, string>>,
  status: RightsStatus,
  key: string,
): string {
  const found = words[status];
  if (!found) {
    throw new SourcesError(
      "rights-wording-missing",
      `No reader-facing wording for rights status "${status}" (${key}).`,
    );
  }
  return found;
}

/** The page says the served file has the receipt's digest, so a file that does not stops the build. */
export function assertServedDigest(
  bytes: Uint8Array,
  expected: string,
  path: string,
  key: string,
): void {
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== expected) {
    throw new SourcesError(
      "served-digest-mismatch",
      `${path} no longer matches the digest in its receipt (${key}).`,
    );
  }
}

/**
 * A receipt the receipt checker finds an error in stops the build, under the checker's own rule
 * codes. The pages are compiled from receipts that parse, and a receipt can parse while its digest
 * is malformed or its dates contradict each other; rendering it would publish the fault as fact.
 * The checker's flags (a section still pending, say) are not errors and do not stop anything.
 */
export function assertReceiptsChecked(
  receipts: readonly Readonly<{
    key: string;
    checkResult: Readonly<{ errors: readonly Readonly<{ rule: string; path: string }>[] }>;
  }>[],
): void {
  const failing = receipts.flatMap(({ key, checkResult }) =>
    checkResult.errors.map((error) => `${key}: ${error.rule} (${error.path})`),
  );
  if (failing.length > 0) {
    throw new SourcesError(
      "receipt-check-failed",
      `The receipt checker found ${failing.length} error(s): ${failing.join("; ")}.`,
    );
  }
}

/** A scan its receipt publishes must be served: a missing file is not a scan without a download. */
export function requireServedFile(exists: boolean, path: string, key: string): void {
  if (!exists) {
    throw new SourcesError(
      "served-file-missing",
      `The receipt for ${key} publishes ${path || "(no path)"}, and no such file is served.`,
    );
  }
}

/**
 * The download /sources/ offers for a scan, under `root`: none for a scan its receipt does not
 * publish; for one it does, the served file, which must exist and must have the receipt's digest,
 * or the build stops. The page says the served file was checked, so both refusals keep that true.
 */
export function servedScan(
  fm: ReceiptFrontMatter,
  asset: Pick<SourceAsset, "publicationDecision" | "sha256">,
  key: string,
  root: string,
): Readonly<{ href: string; bytes: number }> | undefined {
  if (asset.publicationDecision !== "publish") return undefined;
  const served = fm.scan.path ? join(root, fm.scan.path) : undefined;
  requireServedFile(served !== undefined && existsSync(served), fm.scan.path, key);
  if (!served) return undefined;
  assertServedDigest(readFileSync(served), asset.sha256, fm.scan.path, key);
  return { href: `/${fm.scan.path.replace(/^public\//, "")}`, bytes: statSync(served).size };
}
