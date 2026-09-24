import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkedReceipts, receiptsByPage } from "./receiptPages.ts";
import {
  assertServedDigest,
  requireReceipt,
  requireServedFile,
  rightsWordsFor,
  SourcesError,
  servedScan,
} from "./refusals.ts";

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

  test('a scan its receipt publishes but no file serves refuses with "served-file-missing"', () => {
    expect(codeOf(() => requireServedFile(true, "public/papers/pdfs/x.pdf", "ap-17-549"))).toBe(
      undefined,
    );
    expect(codeOf(() => requireServedFile(false, "public/papers/pdfs/x.pdf", "ap-17-549"))).toBe(
      "served-file-missing",
    );
  });

  test("the page's own served-scan check refuses a missing file and a changed one, under their codes", () => {
    const receipt = checkedReceipts().find((r) => r.receipt?.frontMatter.scan.path)?.receipt;
    expect(receipt).toBeDefined();
    const fm = receipt?.frontMatter as NonNullable<typeof receipt>["frontMatter"];
    const asset = { publicationDecision: "publish" as const, sha256: fm.scan.sha256 };
    // The real file, at the real root, is served with the receipt's digest.
    expect(servedScan(fm, asset, fm.key, process.cwd())?.href).toBe(
      `/${fm.scan.path.replace(/^public\//, "")}`,
    );
    // An empty root serves nothing: a published scan with no file stops the build.
    const empty = mkdtempSync(join(tmpdir(), "am-served-missing-"));
    expect(codeOf(() => servedScan(fm, asset, fm.key, empty))).toBe("served-file-missing");
    // A root whose file has other bytes: the digest no longer matches.
    const changed = mkdtempSync(join(tmpdir(), "am-served-changed-"));
    mkdirSync(join(changed, dirname(fm.scan.path)), { recursive: true });
    writeFileSync(join(changed, fm.scan.path), "not the pinned scan");
    expect(codeOf(() => servedScan(fm, asset, fm.key, changed))).toBe("served-digest-mismatch");
    // A scan the receipt does not publish offers no download and needs no file.
    expect(
      servedScan(fm, { ...asset, publicationDecision: "pin-local-only" }, fm.key, empty),
    ).toBeUndefined();
  });

  test("a receipt the checker rejects stops the pages, under the checker's rule code", () => {
    // The real receipts pass, so the gate is not refusing everything.
    expect(checkedReceipts().length).toBeGreaterThan(0);
    // One real receipt, its scan digest made malformed: it still parses, and the checker says why.
    const dir = mkdtempSync(join(tmpdir(), "am-receipt-gate-"));
    const receipt = join(dir, "ap-18-639.md");
    copyFileSync(join("docs", "provenance", "ap-18-639.md"), receipt);
    const text = readFileSync(receipt, "utf8");
    const seeded = text.replace(
      /(\n {2}sha256: ")[0-9a-f]{64}("\n {2}mimeType)/,
      "$1not-a-digest$2",
    );
    expect(seeded).not.toBe(text);
    writeFileSync(receipt, seeded);
    for (const build of [
      () => checkedReceipts({ provenanceDir: dir }),
      () => receiptsByPage({ provenanceDir: dir }),
    ]) {
      let caught: unknown;
      try {
        build();
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(SourcesError);
      expect((caught as SourcesError).code).toBe("receipt-check-failed");
      expect((caught as SourcesError).message).toContain("receipt-scan-sha256-invalid");
    }
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
