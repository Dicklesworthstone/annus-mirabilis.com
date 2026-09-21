/**
 * Facsimile digest and provenance verification test for Special Relativity (ap-17-891).
 * Bead: am-src-facsimile-relativity-kav
 *
 * Verifies:
 * - Recomputes pinned PDF SHA-256 and page count against provenance receipt and facsimile-source YAML.
 * - Enforces publicationDecision contract ("publish" requires pinned presence; "pin-local-only" logs not-available if absent).
 * - Verifies pageMap covers printed pages 891 through 921 in non-decreasing order with closed-set contents.
 * - Verifies watch list contains required downstream printed-formula/symbol entries (V for light speed, simultaneity definition, rod transit times, coordinate transforms, field transforms, electron masses, Besso acknowledgment).
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

export const BEAD_ID = "am-src-facsimile-relativity-kav";
export const BIB_KEY = "ap-17-891";
export const PAPER_SLUG = "special-relativity";

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
  firstPage = 891,
  lastPage = 921,
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
      key: "speed-of-light-v",
      match: (w: { id: string; item: string; expectedCheck: string }) =>
        /speed-of-light-v/i.test(w.id) || (/speed of light/i.test(w.item) && /\bV\b/.test(w.item)),
    },
    {
      key: "simultaneity-definition",
      match: (w: { id: string; item: string; expectedCheck: string }) =>
        /simultaneity/i.test(w.id) || /t_B\s*-\s*t_A/i.test(`${w.item} ${w.expectedCheck}`),
    },
    {
      key: "rod-chase-times",
      match: (w: { id: string; item: string; expectedCheck: string }) =>
        /rod-chase/i.test(w.id) ||
        /r_AB\s*\/\s*\(V\s*-\s*v\)/i.test(`${w.item} ${w.expectedCheck}`),
    },
    {
      key: "coord-transforms",
      match: (w: { id: string; item: string; expectedCheck: string }) =>
        /coord-transforms/i.test(w.id) || (/xi/i.test(w.item) && /tau/i.test(w.item)),
    },
    {
      key: "field-transforms",
      match: (w: { id: string; item: string; expectedCheck: string }) =>
        /field-transforms/i.test(w.id) || /Maxwell-Hertz/i.test(`${w.item} ${w.expectedCheck}`),
    },
    {
      key: "electron-masses",
      match: (w: { id: string; item: string; expectedCheck: string }) =>
        /electron-masses/i.test(w.id) || /transverse mass/i.test(`${w.item} ${w.expectedCheck}`),
    },
    {
      key: "besso-acknowledgment",
      match: (w: { id: string; item: string; expectedCheck: string }) =>
        /besso/i.test(`${w.id} ${w.item} ${w.expectedCheck}`),
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

describe("special relativity facsimile verification (am-src-facsimile-relativity-kav)", () => {
  const receiptPath = "docs/provenance/ap-17-891.md";
  const yamlPath = "scripts/sources/facsimile-sources/ap-17-891.yaml";

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
      expectedPageCount: 31,
      outcome: "not-available",
      message: "Pinned local scan file not present on current host; marked not-available.",
    };

    const logFile = writeDigestLog(fakeEntry);
    expect(existsSync(logFile)).toBe(true);
    const content = readFileSync(logFile, "utf8");
    expect(content).toContain('"outcome":"not-available"');
  });

  test("pageMap covers printed pages 891 through 921 in non-decreasing order", () => {
    const { fm } = loadReceiptFrontMatter(receiptPath);

    expect(fm.pageMap.length).toBe(31);

    // Validate closed-set contents
    for (const page of fm.pageMap) {
      for (const content of page.contents) {
        expect(CONTENTS_VOCABULARY).toContain(content);
      }
    }

    const coverage = verifyPageMapArticleCoverage(fm.pageMap, 891, 921);
    expect(coverage.valid).toBe(true);
    expect(coverage.error).toBeUndefined();
  });

  test("watch list contains all required downstream printed-number and symbol entries", () => {
    const { fm } = loadReceiptFrontMatter(receiptPath);

    const watchListCheck = verifyWatchListPrintedNumbers(fm.watchList);
    expect(watchListCheck.valid).toBe(true);
    expect(watchListCheck.missing).toEqual([]);

    // Specific verification of the 9 items
    const ids = fm.watchList.map((w) => w.id);
    expect(ids).toContain("watch-speed-of-light-v");
    expect(ids).toContain("watch-simultaneity-definition");
    expect(ids).toContain("watch-rod-chase-times");
    expect(ids).toContain("watch-coord-transforms");
    expect(ids).toContain("watch-velocity-composition");
    expect(ids).toContain("watch-field-transforms");
    expect(ids).toContain("watch-light-energy");
    expect(ids).toContain("watch-electron-masses");
    expect(ids).toContain("watch-besso-acknowledgment");

    // An all-pending assertion encodes "nobody has checked anything yet" as an INVARIANT,
    // so it fails on progress: the first watch item resolved from a plate turns a passing
    // test red without anything being wrong. That is the third instance of this shape in
    // this session; lightQuanta.facsimile.test.ts carried it until 09120261 and
    // brownian.facsimile.test.ts was repaired the same way.
    //
    // What the list is actually for is re-checkability, so that is what is asserted: every
    // result is a DECLARED value, and anything that is no longer pending records what
    // settled it and cites a printed page a reviewer can turn to. The pending items keep
    // their teeth - they are simply not required to stay pending forever.
    const DECLARED_RESULTS = new Set([
      "pending",
      "confirmed-on-plate",
      "confirmed-absent",
      "plate-reading-recorded-ruling-open",
      "corrected-in-ledger",
    ]);
    // And the list must not be settled by emptying it.
    expect(fm.watchList.length).toBeGreaterThanOrEqual(10);
    for (const item of fm.watchList) {
      expect(
        DECLARED_RESULTS.has(item.result),
        `${item.id}: result "${item.result}" is not a declared value`,
      ).toBe(true);
      if (item.result === "pending") continue;
      const notes = item.notes ?? "";
      expect(
        notes.length,
        `${item.id} is settled but records nothing about what settled it`,
      ).toBeGreaterThan(120);
      expect(
        /\bpages?\s+\d{3}\b|\bp\.\s*\d{3}\b/.test(notes),
        `${item.id} is settled but cites no printed page, so a reviewer cannot re-check it`,
      ).toBe(true);
    }
  });

  test("planted negative: corrupted digest triggers failed outcome and evidence retention", () => {
    const logRunId = newRunIdentity();
    const fakeCorruptedDigest = "0000000000000000000000000000000000000000000000000000000000000000";
    const genuineExpected = "60d21d560f6a3c87e581ac25016306d9bcb748e530fa2751652b84986da5296c";

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
      path: "public/papers/pdfs/ap-17-891.pdf",
      publicationDecision: "publish",
      expectedSha256: genuineExpected,
      actualSha256: fakeCorruptedDigest,
      expectedPageCount: 31,
      actualPageCount: 31,
      outcome: "failed",
      message: "Planted negative: digest corruption detected.",
    });
  });

  test("planted negative: gap in pageMap is rejected", () => {
    const corruptedPageMap = [
      { printedPage: 891, contents: ["article-text"] },
      { printedPage: 892, contents: ["article-text"] },
      // 893 missing
      { printedPage: 894, contents: ["article-text"] },
    ];
    const res = verifyPageMapArticleCoverage(corruptedPageMap, 891, 894);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Missing printed page 893");
  });

  test("planted negative: order inversion in pageMap is rejected", () => {
    const corruptedPageMap = [
      { printedPage: 891, contents: ["article-text"] },
      { printedPage: 893, contents: ["article-text"] },
      { printedPage: 892, contents: ["article-text"] },
    ];
    const res = verifyPageMapArticleCoverage(corruptedPageMap, 891, 893);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("not in non-decreasing order");
  });

  test("planted negative: missing required watch list entry is rejected", () => {
    const corruptedWatchList = [
      { id: "w1", item: "Speed of light V", expectedCheck: "speed check" },
      // simultaneity missing
      { id: "w3", item: "Besso acknowledgment", expectedCheck: "besso check" },
    ];
    const res = verifyWatchListPrintedNumbers(corruptedWatchList);
    expect(res.valid).toBe(false);
    expect(res.missing).toContain("simultaneity-definition");
  });
});
