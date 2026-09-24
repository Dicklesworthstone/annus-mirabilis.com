import { describe, expect, test } from "bun:test";
import type { PaperDate } from "../../content/provenance/receiptSchema.ts";
import {
  AboutError,
  attributionFrom,
  dayDate,
  publicationDate,
  requireExampleAnchor,
  requireFound,
  requireRevision,
} from "./refusals.ts";

/** Each of /about/'s refusals, driven with the input that should trigger it and one that should not. */
function codeOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof AboutError ? error.code : `not an AboutError: ${String(error)}`;
  }
  return undefined;
}

const date = (
  type: PaperDate["type"],
  iso: string,
  precision: PaperDate["precision"],
): PaperDate => ({
  type,
  iso,
  precision,
  source: "fixture",
  verifiedAt: "2026-09-23",
});

describe("/about/ refusals", () => {
  test('a notice without the attribution block refuses with "attribution-block-missing"', () => {
    expect(codeOf(() => attributionFrom("# NOTICE\n\nNo attribution here.\n"))).toBe(
      "attribution-block-missing",
    );
    expect(attributionFrom("## Attribution\n\nText:\n\n```text\nThe line.\n```\n")).toBe(
      "The line.",
    );
  });

  test('a paper the content index has no compiled revision for refuses with "content-revision-missing"', () => {
    const digest = "a".repeat(64);
    expect(requireRevision(digest, "brownian-motion")).toBe(digest);
    expect(codeOf(() => requireRevision(undefined, "brownian-motion"))).toBe(
      "content-revision-missing",
    );
    // A truncated or non-hex value is not a revision either.
    expect(codeOf(() => requireRevision("7533612eb73d", "brownian-motion"))).toBe(
      "content-revision-missing",
    );
  });

  test('a citation example with no section and argument to name refuses with "example-anchor-missing"', () => {
    expect(requireExampleAnchor("s4", "arg-bm-observable", "brownian-motion")).toEqual({
      section: "s4",
      argument: "arg-bm-observable",
    });
    expect(codeOf(() => requireExampleAnchor(undefined, undefined, "brownian-motion"))).toBe(
      "example-anchor-missing",
    );
    expect(codeOf(() => requireExampleAnchor("s4", undefined, "brownian-motion"))).toBe(
      "example-anchor-missing",
    );
  });

  test('a receipt that is not there refuses with "receipt-missing"', () => {
    expect(codeOf(() => requireFound(undefined, "ap-19-289"))).toBe("receipt-missing");
    expect(requireFound("found", "ap-19-289")).toBe("found");
  });

  test('a date recorded only to the month refuses with "receipt-day-date-missing"', () => {
    const dates = [date("date-line", "1905-04", "month")];
    expect(codeOf(() => dayDate(dates, "date-line", "ap-19-289"))).toBe("receipt-day-date-missing");
    expect(dayDate([date("date-line", "1905-04-30", "day")], "date-line", "ap-19-289")).toBe(
      "1905-04-30",
    );
  });

  test('a receipt with no publication date refuses with "receipt-publication-date-missing"', () => {
    expect(
      codeOf(() => publicationDate([date("received", "1911-01-21", "day")], "ap-34-591")),
    ).toBe("receipt-publication-date-missing");
    expect(publicationDate([date("issue-publication", "1911", "year")], "ap-34-591")).toBe("1911");
  });
});
