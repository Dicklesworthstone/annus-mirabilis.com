import type { PaperDate } from "../../content/provenance/receiptSchema.ts";

/**
 * The four ways /about/ refuses to build, each with a code (as FirstPagesError does for the home
 * page). Every date and the attribution line come from records, so a missing record stops the
 * export instead of the page printing a guess.
 */
export type AboutErrorCode =
  | "attribution-block-missing"
  | "receipt-missing"
  | "receipt-day-date-missing"
  | "receipt-publication-date-missing";

export class AboutError extends Error {
  readonly code: AboutErrorCode;
  constructor(code: AboutErrorCode, message: string) {
    super(message);
    this.name = "AboutError";
    this.code = code;
  }
}

/** The one text block under "## Attribution" in NOTICE.md. */
export function attributionFrom(notice: string): string {
  const match = /## Attribution[\s\S]*?```text\n([^\n]+)\n```/.exec(notice);
  if (!match?.[1]) {
    throw new AboutError(
      "attribution-block-missing",
      "NOTICE.md has no attribution block under ## Attribution.",
    );
  }
  return match[1].trim();
}

export function requireFound<T>(found: T | undefined, key: string): T {
  if (!found) throw new AboutError("receipt-missing", `No provenance receipt for ${key}.`);
  return found;
}

/** The ISO date of the given type, at day precision. */
export function dayDate(dates: readonly PaperDate[], type: PaperDate["type"], key: string): string {
  const found = dates.find((d) => d.type === type && d.precision === "day");
  if (!found) {
    throw new AboutError(
      "receipt-day-date-missing",
      `The receipt for ${key} has no day-precision "${type}" date.`,
    );
  }
  return found.iso;
}

/** The ISO date the journal published it, at any precision. */
export function publicationDate(dates: readonly PaperDate[], key: string): string {
  const found = dates.find((d) => d.type === "issue-publication");
  if (!found) {
    throw new AboutError(
      "receipt-publication-date-missing",
      `The receipt for ${key} has no publication date.`,
    );
  }
  return found.iso;
}
