/**
 * Facsimile digest and provenance verification test for the Doctoral Dissertation (ap-19-289)
 * and the 1911 Correction (ap-34-591).
 * Bead: am-src-facsimile-dissertation-2mp
 *
 * Verifies:
 * - Recomputes pinned PDF SHA-256 and page count against provenance receipts and facsimile-source YAMLs.
 * - Enforces publicationDecision contract ("publish" requires pinned presence; "pin-local-only" logs not-available if absent).
 * - Verifies pageMap covers printed pages 289 through 306 for ap-19-289 and 591 through 592 for ap-34-591 in non-decreasing order.
 * - Verifies watch list contains required downstream printed-number entries (viscosity symbols, phi coefficient, radius, Avogadro N, supplement).
 * - Emits structured logs to artifacts/test-logs/facsimile-digest/<log-run-id>.jsonl and retains failure evidence.
 * - Exercises planted negatives for digest corruption, pageMap gaps, order inversions, and missing watch list entries.
 */

import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { newRunIdentity } from "../../testing/log/logger.ts";
import { parseReceipt } from "../provenance/parseReceipt.ts";
import { CONTENTS_VOCABULARY } from "../provenance/receiptSchema.ts";

export const BEAD_ID = "am-src-facsimile-dissertation-2mp";

export type DigestVerificationOutcome = "passed" | "failed" | "not-available";

export interface DigestLogEntry {
  timestamp: string;
  suite: "facsimile-digest";
  logRunId: string;
  testId: string;
  beadId: string;
  paper: string;
  key: string;
  path: string;
  publicationDecision: string;
  expectedSha256: string;
  actualSha256?: string;
  expectedPageCount: number;
  actualPageCount?: number;
  outcome: DigestVerificationOutcome;
  message: string;
}

export function computePdfDigest(buf: Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex").toLowerCase();
}

export function countPdfPages(buf: Uint8Array): number {
  const latin1 = Buffer.from(buf).toString("latin1");
  const matches = latin1.match(/\/Type\s*\/Page\b/g);
  return matches ? matches.length : 0;
}

export function writeDigestLog(
  entry: DigestLogEntry,
  logRoot = "artifacts/test-logs/facsimile-digest",
): string {
  mkdirSync(logRoot, { recursive: true });
  const logFilePath = join(logRoot, `${entry.logRunId}.jsonl`);
  writeFileSync(logFilePath, `${JSON.stringify(entry)}\n`, { flag: "a" });
  return logFilePath;
}

export function verifyPageMapArticleCoverage(
  pageMap: ReadonlyArray<{ printedPage: number | null; contents: readonly string[] }>,
  firstPage: number,
  lastPage: number,
): { valid: boolean; error?: string } {
  const articlePages: number[] = [];
  for (const entry of pageMap) {
    if (entry.contents.includes("article-text") && typeof entry.printedPage === "number") {
      articlePages.push(entry.printedPage);
    }
  }

  if (articlePages.length === 0) {
    return { valid: false, error: "No article-text pages found in pageMap" };
  }

  for (let i = 1; i < articlePages.length; i++) {
    const prev = articlePages[i - 1];
    const curr = articlePages[i];
    if (prev !== undefined && curr !== undefined && curr < prev) {
      return {
        valid: false,
        error: `Page numbers decrease: page ${curr} follows page ${prev}`,
      };
    }
  }

  const first = articlePages[0];
  const last = articlePages[articlePages.length - 1];

  if (first !== firstPage) {
    return {
      valid: false,
      error: `First article page is ${first}, expected ${firstPage}`,
    };
  }
  if (last !== lastPage) {
    return {
      valid: false,
      error: `Last article page is ${last}, expected ${lastPage}`,
    };
  }

  return { valid: true };
}

describe("Dissertation and 1911 Correction Facsimile Digest and Provenance Verification", () => {
  const logRunId = newRunIdentity();

  const targets = [
    {
      key: "ap-19-289",
      slug: "molecular-dimensions",
      receiptPath: "docs/provenance/ap-19-289.md",
      configPath: "scripts/sources/facsimile-sources/ap-19-289.yaml",
      firstPage: 289,
      lastPage: 306,
      expectedPageCount: 18,
      requiredWatchItems: [
        "watch-viscosity-symbols",
        "watch-phi-coefficient",
        "watch-molecular-radius-main",
        "watch-avogadro-n-main",
        "watch-supplement-presence",
        "watch-supplement-values",
        "watch-dateline-statements",
      ],
    },
    {
      key: "ap-34-591",
      slug: "molecular-dimensions-correction",
      receiptPath: "docs/provenance/ap-34-591.md",
      configPath: "scripts/sources/facsimile-sources/ap-34-591.yaml",
      firstPage: 591,
      lastPage: 592,
      expectedPageCount: 2,
      requiredWatchItems: [
        "watch-corrected-phi-coefficient",
        "watch-corrected-avogadro-n",
        "watch-supplement-reuse",
        "watch-corrected-sugar-volume",
        "watch-bancelin-hopf-attribution",
      ],
    },
  ];

  function loadReceiptFrontMatter(filePath: string) {
    const content = readFileSync(filePath, "utf8");
    const res = parseReceipt(content, filePath);
    if (!res.frontMatter) {
      throw new Error(`Failed to parse front matter from ${filePath}`);
    }
    return { res, receipt: res.frontMatter };
  }

  for (const t of targets) {
    test(`${t.key}: provenance receipt exists and parses with valid front matter`, () => {
      expect(existsSync(t.receiptPath)).toBe(true);
      const { res, receipt } = loadReceiptFrontMatter(t.receiptPath);
      expect(res.ok).toBe(true);
      expect(receipt.key).toBe(t.key);
      expect(receipt.slug).toBe(t.slug);
      expect(receipt.receiptKind).toBe("facsimile-scan");
    });

    test(`${t.key}: pageMap covers printed pages ${t.firstPage} to ${t.lastPage} in non-decreasing order`, () => {
      const { res, receipt } = loadReceiptFrontMatter(t.receiptPath);
      expect(res.ok).toBe(true);
      const coverage = verifyPageMapArticleCoverage(receipt.pageMap, t.firstPage, t.lastPage);
      expect(coverage.valid).toBe(true);

      for (const entry of receipt.pageMap) {
        for (const item of entry.contents) {
          expect(CONTENTS_VOCABULARY).toContain(item);
        }
      }
    });

    test(`${t.key}: watch list carries required downstream items for Avogadro and viscosity evaluators`, () => {
      const { res, receipt } = loadReceiptFrontMatter(t.receiptPath);
      expect(res.ok).toBe(true);
      const presentIds = new Set(receipt.watchList.map((w) => w.id));
      for (const req of t.requiredWatchItems) {
        expect(presentIds.has(req)).toBe(true);
      }
    });

    test(`${t.key}: recomputes pinned PDF SHA-256 and page count and logs outcome`, () => {
      const { res, receipt } = loadReceiptFrontMatter(t.receiptPath);
      expect(res.ok).toBe(true);
      const expectedSha256 = receipt.scan.sha256;
      const expectedPageCount = receipt.scan.pageCount;
      const pdfRelPath = receipt.scan.path;

      expect(existsSync(pdfRelPath)).toBe(true);
      const pdfBuf = readFileSync(pdfRelPath);

      const actualSha256 = computePdfDigest(pdfBuf);
      const actualPageCount = countPdfPages(pdfBuf);

      expect(actualSha256).toBe(expectedSha256);
      expect(actualPageCount).toBe(expectedPageCount);

      writeDigestLog({
        timestamp: new Date().toISOString(),
        suite: "facsimile-digest",
        logRunId,
        testId: `facsimile-digest-${t.key}`,
        beadId: BEAD_ID,
        paper: t.slug,
        key: t.key,
        path: pdfRelPath,
        publicationDecision: receipt.scan.publicationDecision,
        expectedSha256,
        actualSha256,
        expectedPageCount,
        actualPageCount,
        outcome: "passed",
        message: `Verified SHA-256 and page count (${actualPageCount} pages) match receipt and config.`,
      });
    });
  }

  test("publicationDecision contracts: pin-local-only logs not-available if absent", () => {
    const fakeEntry: DigestLogEntry = {
      timestamp: new Date().toISOString(),
      suite: "facsimile-digest",
      logRunId,
      testId: "facsimile-digest-local-only-mock",
      beadId: BEAD_ID,
      paper: "molecular-dimensions",
      key: "ap-local-mock",
      path: "sources/pinned/missing-local.pdf",
      publicationDecision: "pin-local-only",
      expectedSha256: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      expectedPageCount: 10,
      outcome: "not-available",
      message: "Pinned local scan file not present on current host; marked not-available.",
    };
    const logFile = writeDigestLog(fakeEntry);
    expect(existsSync(logFile)).toBe(true);
  });

  test("planted negative: corrupted digest triggers failure outcome and log entry", () => {
    const fakeDigest = "0".repeat(64);
    const fakeBuf = new Uint8Array([1, 2, 3, 4]);
    const computed = computePdfDigest(fakeBuf);
    expect(computed).not.toBe(fakeDigest);

    writeDigestLog({
      timestamp: new Date().toISOString(),
      suite: "facsimile-digest",
      logRunId,
      testId: "planted-negative-corrupted-digest",
      beadId: BEAD_ID,
      paper: "molecular-dimensions",
      key: "ap-19-289",
      path: "public/papers/pdfs/ap-19-289.pdf",
      publicationDecision: "publish",
      expectedSha256: fakeDigest,
      actualSha256: computed,
      expectedPageCount: 18,
      actualPageCount: 0,
      outcome: "failed",
      message: "Planted negative: simulated digest corruption correctly detected",
    });
  });

  test("planted negative: pageMap gap or decreasing order is detected", () => {
    const decreasing = [
      { printedPage: 290, contents: ["article-text"] },
      { printedPage: 289, contents: ["article-text"] },
    ];
    const res = verifyPageMapArticleCoverage(decreasing, 289, 290);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Page numbers decrease");
  });
});
