import { createHash } from "node:crypto";
import type { RightsStatus } from "../../content/provenance/receiptSchema.ts";

/**
 * The ways /sources/ refuses to build, each with a code (as FirstPagesError does for the home
 * page). Each one stops the export rather than publishing a page that says something false.
 */
export type SourcesErrorCode =
  | "receipt-unparsed"
  | "rights-wording-missing"
  | "served-digest-mismatch"
  | "receipt-page-unknown";

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
