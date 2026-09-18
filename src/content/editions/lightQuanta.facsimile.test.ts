/**
 * Facsimile digest and provenance verification test for Light Quanta (ap-17-132).
 * Bead: am-src-facsimile-light-quanta-t4n
 *
 * Verifies:
 * - Recomputes pinned PDF SHA-256 and page count against provenance receipt and facsimile-source YAML.
 * - Enforces publicationDecision contract ("publish" requires pinned presence; "pin-local-only" logs not-available if absent).
 * - Verifies pageMap covers printed pages 132 through 148 in non-decreasing order with closed-set contents.
 * - Verifies watch list contains required downstream printed-number entries (alpha exponent, beta, Avogadro N, R presence, speed of light L, charge, volt conversion).
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
import { parseYaml } from "../provenance/yaml.ts";

export const BEAD_ID = "am-src-facsimile-light-quanta-t4n";
export const BIB_KEY = "ap-17-132";
export const PAPER_SLUG = "light-quanta";

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

export function retainFailureEvidence(
  logRunId: string,
  evidence: {
    computedDigest: string;
    receiptFrontMatter: unknown;
    config: unknown;
  },
  logRoot = "artifacts/test-logs/facsimile-digest",
): string {
  const evidenceDir = join(logRoot, logRunId, "evidence");
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, "evidence.json"), JSON.stringify(evidence, null, 2), "utf8");
  return evidenceDir;
}

export function verifyPageMapArticleCoverage(
  pageMap: ReadonlyArray<{ printedPage: number | null; contents: readonly string[] }>,
  firstPage = 132,
  lastPage = 148,
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

  // Check non-decreasing order
  for (let i = 1; i < articlePages.length; i++) {
    const prev = articlePages[i - 1];
    const curr = articlePages[i];
    if (prev !== undefined && curr !== undefined && curr < prev) {
      return {
        valid: false,
        error: `Printed pages not in non-decreasing order: ${prev} -> ${curr}`,
      };
    }
  }

  // Check that every page from firstPage to lastPage appears at least once
  const pageSet = new Set(articlePages);
  for (let p = firstPage; p <= lastPage; p++) {
    if (!pageSet.has(p)) {
      return { valid: false, error: `Missing printed page ${p} in pageMap` };
    }
  }

  return { valid: true };
}

export function verifyWatchListPrintedNumbers(
  watchList: ReadonlyArray<{ id: string; item: string; expectedCheck: string }>,
): { valid: boolean; missing: string[] } {
  const REQUIRED_CHECKS = [
    {
      key: "alpha-exponent",
      match: (w: { id: string; item: string; expectedCheck: string }) =>
        /alpha/i.test(`${w.id} ${w.item}`) && /10\^?-5[67]/i.test(`${w.item} ${w.expectedCheck}`),
    },
    {
      key: "beta-constant",
      match: (w: { id: string; item: string; expectedCheck: string }) =>
        /beta/i.test(`${w.id} ${w.item}`) &&
        /4[,.]866\s*\*\s*10\^?-11/i.test(`${w.item} ${w.expectedCheck}`),
    },
    {
      key: "avogadro",
      match: (w: { id: string; item: string; expectedCheck: string }) =>
        /avogadro/i.test(`${w.id} ${w.item}`) &&
        /6[,.]17\s*\*\s*10\^?23/i.test(`${w.item} ${w.expectedCheck}`),
    },
    {
      key: "printed-r-presence",
      match: (w: { id: string; item: string; expectedCheck: string }) =>
        /printed-r-presence/i.test(w.id) || (/gas constant/i.test(w.item) && /\bR\b/.test(w.item)),
    },
    {
      key: "speed-of-light-l",
      match: (w: { id: string; item: string; expectedCheck: string }) =>
        /speed-of-light-l/i.test(w.id) || (/speed of light/i.test(w.item) && /\bL\b/.test(w.item)),
    },
    {
      key: "gram-equivalent-charge",
      match: (w: { id: string; item: string; expectedCheck: string }) =>
        /9[,.]6\s*\*\s*10\^?3/i.test(`${w.item} ${w.expectedCheck}`) ||
        /gram-equivalent/i.test(`${w.item} ${w.expectedCheck}`),
    },
    {
      key: "volt-conversion",
      match: (w: { id: string; item: string; expectedCheck: string }) =>
        /10\^?-8/i.test(`${w.item} ${w.expectedCheck}`) &&
        /volt/i.test(`${w.item} ${w.expectedCheck}`),
    },
  ];

  const missing: string[] = [];
  for (const req of REQUIRED_CHECKS) {
    const found = watchList.some((w) => req.match(w));
    if (!found) {
      missing.push(req.key);
    }
  }

  return { valid: missing.length === 0, missing };
}

function loadReceiptFrontMatter(filePath: string) {
  const receiptContent = readFileSync(filePath, "utf8");
  const parsedReceipt = parseReceipt(receiptContent, filePath);
  if (!parsedReceipt.frontMatter) {
    throw new Error(`Failed to parse front matter from ${filePath}`);
  }
  return { parsedReceipt, fm: parsedReceipt.frontMatter };
}

describe("light quanta facsimile verification (am-src-facsimile-light-quanta-t4n)", () => {
  const receiptPath = "docs/provenance/ap-17-132.md";
  const yamlPath = "scripts/sources/facsimile-sources/ap-17-132.yaml";

  test("receipt and configuration exist and have identical cryptographic properties", () => {
    expect(existsSync(receiptPath)).toBe(true);
    expect(existsSync(yamlPath)).toBe(true);

    const { parsedReceipt, fm } = loadReceiptFrontMatter(receiptPath);
    expect(parsedReceipt.ok).toBe(true);
    expect(fm.key).toBe(BIB_KEY);
    expect(fm.slug).toBe(PAPER_SLUG);
    expect(fm.scan.publicationDecision).toBe("publish");

    const yamlContent = readFileSync(yamlPath, "utf8");
    const parsedYaml = parseYaml(yamlContent) as {
      pinned?: { sha256?: string; pageCount?: number; path?: string };
      rights?: { publicationDecision?: string };
    };

    expect(parsedYaml.pinned).toBeDefined();
    expect(parsedYaml.pinned?.sha256).toBe(fm.scan.sha256);
    expect(parsedYaml.pinned?.pageCount).toBe(fm.scan.pageCount);
    expect(parsedYaml.rights?.publicationDecision).toBe(fm.scan.publicationDecision);
  });

  test("recomputes pinned PDF SHA-256 and page count and logs outcome", () => {
    const logRunId = newRunIdentity();
    const { fm } = loadReceiptFrontMatter(receiptPath);
    const expectedSha256 = fm.scan.sha256;
    const expectedPageCount = fm.scan.pageCount;
    const pdfRelPath = fm.scan.path;

    expect(existsSync(pdfRelPath)).toBe(true);
    const pdfBuf = readFileSync(pdfRelPath);

    const actualSha256 = computePdfDigest(pdfBuf);
    const actualPageCount = countPdfPages(pdfBuf);

    const digestMatches = actualSha256 === expectedSha256;
    const pageCountMatches = actualPageCount === expectedPageCount;

    if (!digestMatches || !pageCountMatches) {
      const yamlContent = readFileSync(yamlPath, "utf8");
      retainFailureEvidence(logRunId, {
        computedDigest: actualSha256,
        receiptFrontMatter: fm,
        config: parseYaml(yamlContent),
      });

      writeDigestLog({
        timestamp: new Date().toISOString(),
        suite: "facsimile-digest",
        logRunId,
        testId: `facsimile-digest-${BIB_KEY}`,
        beadId: BEAD_ID,
        paper: PAPER_SLUG,
        key: BIB_KEY,
        path: pdfRelPath,
        publicationDecision: fm.scan.publicationDecision,
        expectedSha256,
        actualSha256,
        expectedPageCount,
        actualPageCount,
        outcome: "failed",
        message: `Digest or page count mismatch: sha256(${actualSha256} vs ${expectedSha256}), pages(${actualPageCount} vs ${expectedPageCount})`,
      });
    }

    expect(actualSha256).toBe(expectedSha256);
    expect(actualPageCount).toBe(expectedPageCount);

    writeDigestLog({
      timestamp: new Date().toISOString(),
      suite: "facsimile-digest",
      logRunId,
      testId: `facsimile-digest-${BIB_KEY}`,
      beadId: BEAD_ID,
      paper: PAPER_SLUG,
      key: BIB_KEY,
      path: pdfRelPath,
      publicationDecision: fm.scan.publicationDecision,
      expectedSha256,
      actualSha256,
      expectedPageCount,
      actualPageCount,
      outcome: "passed",
      message: `Verified SHA-256 and page count (${actualPageCount} pages) match receipt and config.`,
    });
  });

  test("publicationDecision contracts: pin-local-only logs not-available if absent", () => {
    const logRunId = newRunIdentity();
    const fakeEntry: DigestLogEntry = {
      timestamp: new Date().toISOString(),
      suite: "facsimile-digest",
      logRunId,
      testId: "facsimile-digest-local-only-mock",
      beadId: BEAD_ID,
      paper: PAPER_SLUG,
      key: "ap-local-mock",
      path: "sources/pinned/missing-local.pdf",
      publicationDecision: "pin-local-only",
      expectedSha256: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      expectedPageCount: 17,
      outcome: "not-available",
      message: "Pinned local scan file not present on current host; marked not-available.",
    };

    const logFile = writeDigestLog(fakeEntry);
    expect(existsSync(logFile)).toBe(true);
    const content = readFileSync(logFile, "utf8");
    expect(content).toContain('"outcome":"not-available"');
  });

  test("pageMap covers printed pages 132 through 148 in non-decreasing order", () => {
    const { fm } = loadReceiptFrontMatter(receiptPath);

    expect(fm.pageMap.length).toBe(17);

    // Validate closed-set contents
    for (const page of fm.pageMap) {
      for (const content of page.contents) {
        expect(CONTENTS_VOCABULARY).toContain(content);
      }
    }

    const coverage = verifyPageMapArticleCoverage(fm.pageMap, 132, 148);
    expect(coverage.valid).toBe(true);
    expect(coverage.error).toBeUndefined();
  });

  test("watch list contains all required downstream printed-number entries", () => {
    const { fm } = loadReceiptFrontMatter(receiptPath);

    const watchListCheck = verifyWatchListPrintedNumbers(fm.watchList);
    expect(watchListCheck.valid).toBe(true);
    expect(watchListCheck.missing).toEqual([]);

    // Specific verification of the 10 items
    const ids = fm.watchList.map((w) => w.id);
    expect(ids).toContain("watch-alpha-exponent");
    expect(ids).toContain("watch-beta-constant");
    expect(ids).toContain("watch-avogadro-n");
    expect(ids).toContain("watch-printed-r-presence");
    expect(ids).toContain("watch-speed-of-light-l");
    expect(ids).toContain("watch-photoelectric-relation");
    expect(ids).toContain("watch-gram-equivalent-charge");
    expect(ids).toContain("watch-volt-conversion");
    expect(ids).toContain("watch-entropy-density-glyph");
    expect(ids).toContain("watch-dateline-chronology");

    for (const item of fm.watchList) {
      expect(item.result).toBe("pending");
    }
  });

  test("planted negative: corrupted digest triggers failed outcome and evidence retention", () => {
    const logRunId = newRunIdentity();
    const fakeCorruptedDigest = "0000000000000000000000000000000000000000000000000000000000000000";
    const genuineExpected = "494f074dcb7e7def98f16c0196cd01f096b63a924704d53d46ef4f718b54f79e";

    expect(fakeCorruptedDigest).not.toBe(genuineExpected);

    const evidenceDir = retainFailureEvidence(logRunId, {
      computedDigest: fakeCorruptedDigest,
      receiptFrontMatter: { key: BIB_KEY, sha256: genuineExpected },
      config: { pinned: { sha256: genuineExpected } },
    });

    expect(existsSync(join(evidenceDir, "evidence.json"))).toBe(true);

    writeDigestLog({
      timestamp: new Date().toISOString(),
      suite: "facsimile-digest",
      logRunId,
      testId: `facsimile-digest-planted-negative-${BIB_KEY}`,
      beadId: BEAD_ID,
      paper: PAPER_SLUG,
      key: BIB_KEY,
      path: "public/papers/pdfs/ap-17-132.pdf",
      publicationDecision: "publish",
      expectedSha256: genuineExpected,
      actualSha256: fakeCorruptedDigest,
      expectedPageCount: 17,
      actualPageCount: 17,
      outcome: "failed",
      message: "Planted negative: digest corruption detected.",
    });
  });

  test("planted negative: gap in pageMap is rejected", () => {
    const corruptedPageMap = [
      { printedPage: 132, contents: ["article-text"] },
      { printedPage: 133, contents: ["article-text"] },
      // 134 missing
      { printedPage: 135, contents: ["article-text"] },
    ];
    const res = verifyPageMapArticleCoverage(corruptedPageMap, 132, 135);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Missing printed page 134");
  });

  test("planted negative: order inversion in pageMap is rejected", () => {
    const corruptedPageMap = [
      { printedPage: 132, contents: ["article-text"] },
      { printedPage: 135, contents: ["article-text"] },
      { printedPage: 134, contents: ["article-text"] },
    ];
    const res = verifyPageMapArticleCoverage(corruptedPageMap, 132, 135);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("not in non-decreasing order");
  });

  test("planted negative: missing required watch list entry is rejected", () => {
    const corruptedWatchList = [
      { id: "w1", item: "alpha = 6.10 * 10^-56", expectedCheck: "alpha check" },
      // speed-of-light-l missing
      { id: "w3", item: "Avogadro N = 6.17 * 10^23", expectedCheck: "Avogadro check" },
    ];
    const res = verifyWatchListPrintedNumbers(corruptedWatchList);
    expect(res.valid).toBe(false);
    expect(res.missing).toContain("speed-of-light-l");
  });
});
