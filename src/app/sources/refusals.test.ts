import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { assertServedDigest, requireReceipt, rightsWordsFor, SourcesError } from "./refusals.ts";

/** Each of /sources/'s refusals, driven with the input that should trigger it and one that should not. */
function codeOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof SourcesError ? error.code : `not a SourcesError: ${String(error)}`;
  }
  return undefined;
}

describe("/sources/ refusals", () => {
  test('a receipt that did not parse refuses with "receipt-unparsed"', () => {
    expect(codeOf(() => requireReceipt(undefined, "ap-17-549"))).toBe("receipt-unparsed");
    expect(requireReceipt({ frontMatter: {} }, "ap-17-549")).toEqual({ frontMatter: {} });
  });

  test('a rights status with no wording refuses with "rights-wording-missing"', () => {
    const words = { "scan-open-terms": "Offered under its host's open terms." };
    expect(codeOf(() => rightsWordsFor(words, "scan-terms-unknown", "ap-17-549"))).toBe(
      "rights-wording-missing",
    );
    expect(rightsWordsFor(words, "scan-open-terms", "ap-17-549")).toBe(words["scan-open-terms"]);
  });

  test('a served file that no longer matches its receipt refuses with "served-digest-mismatch"', () => {
    const bytes = new TextEncoder().encode("the pinned scan");
    const digest = createHash("sha256").update(bytes).digest("hex");
    expect(codeOf(() => assertServedDigest(bytes, digest, "public/x.pdf", "ap-17-549"))).toBe(
      undefined,
    );
    const changed = new TextEncoder().encode("the pinned scan, altered");
    expect(codeOf(() => assertServedDigest(changed, digest, "public/x.pdf", "ap-17-549"))).toBe(
      "served-digest-mismatch",
    );
  });
});
