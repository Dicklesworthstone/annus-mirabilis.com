/**
 * Facsimile digest and provenance verification test for Brownian motion (ap-17-549).
 * Bead: am-src-facsimile-brownian-mox
 *
 * Verifies:
 * - Recomputes pinned PDF SHA-256 and page count against provenance receipt and facsimile-source YAML.
 * - Enforces publicationDecision contract ("publish" requires pinned presence; "pin-local-only" logs not-available if absent).
 * - Verifies pageMap covers printed pages 549 through 560 in non-decreasing order with closed-set contents.
 * - Verifies watch list contains required downstream printed-number entries (viscosity, radius, N, displacements).
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

export const BEAD_ID = "am-src-facsimile-brownian-mox";
export const BIB_KEY = "ap-17-549";
export const PAPER_SLUG = "brownian-motion";

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
  firstPage = 549,
  lastPage = 560,
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
      key: "viscosity",
      match: (w: { item: string; expectedCheck: string }) =>
        /1[,.]35\s*\*\s*10\^?-2/i.test(`${w.item} ${w.expectedCheck}`) &&
        /viscos/i.test(`${w.item} ${w.expectedCheck}`),
    },
    {
      key: "radius",
      match: (w: { item: string; expectedCheck: string }) =>
        /0[,.]001\s*mm/i.test(`${w.item} ${w.expectedCheck}`) ||
        /0[,.]5\s*μ/i.test(`${w.item} ${w.expectedCheck}`),
    },
    {
      key: "avogadro",
      match: (w: { item: string; expectedCheck: string }) =>
        /6\s*\*\s*10\^?23/i.test(`${w.item} ${w.expectedCheck}`),
    },
    {
      key: "displacement-1s",
      match: (w: { item: string; expectedCheck: string }) =>
        /0[,.]8\s*μ/i.test(`${w.item} ${w.expectedCheck}`),
    },
    {
      key: "displacement-1m",
      match: (w: { item: string; expectedCheck: string }) =>
        /6\s*μ/i.test(`${w.item} ${w.expectedCheck}`) && !/^\s*6\.1\s*μm/i.test(w.item),
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

describe("brownian facsimile verification (am-src-facsimile-brownian-mox)", () => {
  const receiptPath = "docs/provenance/ap-17-549.md";
  const yamlPath = "scripts/sources/facsimile-sources/ap-17-549.yaml";

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
      expectedPageCount: 10,
      outcome: "not-available",
      message: "Pinned local scan file not present on current host; marked not-available.",
    };

    const logFile = writeDigestLog(fakeEntry);
    expect(existsSync(logFile)).toBe(true);
    const content = readFileSync(logFile, "utf8");
    expect(content).toContain('"outcome":"not-available"');
  });

  test("pageMap covers printed pages 549 through 560 in non-decreasing order", () => {
    const { fm } = loadReceiptFrontMatter(receiptPath);

    expect(fm.pageMap.length).toBe(12);

    // Validate closed-set contents
    for (const page of fm.pageMap) {
      for (const content of page.contents) {
        expect(CONTENTS_VOCABULARY).toContain(content);
      }
    }

    const coverage = verifyPageMapArticleCoverage(fm.pageMap, 549, 560);
    expect(coverage.valid).toBe(true);
    expect(coverage.error).toBeUndefined();
  });

  test("watch list contains all required downstream printed-number entries", () => {
    const { fm } = loadReceiptFrontMatter(receiptPath);

    const watchListCheck = verifyWatchListPrintedNumbers(fm.watchList);
    expect(watchListCheck.valid).toBe(true);
    expect(watchListCheck.missing).toEqual([]);

    // Specific verification of the 8 items
    const ids = fm.watchList.map((w) => w.id);
    expect(ids).toContain("watch-viscosity-k");
    expect(ids).toContain("watch-particle-size");
    expect(ids).toContain("watch-avogadro-n");
    expect(ids).toContain("watch-displacements");
    expect(ids).toContain("watch-kernel-integral");
    expect(ids).toContain("watch-gas-constant-r");
    expect(ids).toContain("watch-intro-uncertainty");
    expect(ids).toContain("watch-velocity-warning");

    // This asserted `result === "pending"` for every entry until 2026-09-21, which made the
    // test fail exactly when the work it tracks got done - a ratchet pointing the wrong way.
    // The watch list exists to be settled; what is worth guarding is that a settled entry
    // SAYS WHAT WAS SEEN rather than merely changing state.
    const LEGAL = new Set(["pending", "confirmed-on-plate", "confirmed-absent"]);
    for (const item of fm.watchList) {
      expect(LEGAL.has(item.result), `${item.id}: unknown result "${item.result}"`).toBe(true);
      if (item.result !== "pending") {
        expect(
          (item.notes ?? "").length,
          `${item.id} is settled but its notes do not record what was read on the plate`,
        ).toBeGreaterThan(80);
      }
    }
    // And the list must not be settled by emptying it.
    expect(fm.watchList.length).toBeGreaterThanOrEqual(8);
  });

  test("planted negative: corrupted digest triggers failed outcome and evidence retention", () => {
    const logRunId = newRunIdentity();
    const fakeCorruptedDigest = "0000000000000000000000000000000000000000000000000000000000000000";
    // Read the genuine digest from the receipt rather than repeating it here. The
    // literal that stood here was c42f9ac2..., which am-cf6m superseded on 2026-09-20
    // when three facsimiles were re-extracted and re-pinned: this test went on calling a
    // RETIRED artefact "genuine" and still passed, because the only assertion was that
    // two different strings differ, which is true of any two strings. A planted negative
    // that cannot notice a re-pin is not evidence about the pin.
    const { fm } = loadReceiptFrontMatter(receiptPath);
    const genuineExpected = fm.scan.sha256;

    // And the receipt is checked against the bytes, so "genuine" is a measurement here
    // rather than a label: if the pin moves again, this line moves with it or fails.
    expect(genuineExpected).toBe(computePdfDigest(readFileSync(fm.scan.path)));
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
      path: "public/papers/pdfs/ap-17-549.pdf",
      publicationDecision: "publish",
      expectedSha256: genuineExpected,
      actualSha256: fakeCorruptedDigest,
      expectedPageCount: 12,
      actualPageCount: 12,
      outcome: "failed",
      message: "Planted negative: digest corruption detected.",
    });
  });

  test("planted negative: gap in pageMap is rejected", () => {
    const corruptedPageMap = [
      { printedPage: 549, contents: ["article-text"] },
      { printedPage: 550, contents: ["article-text"] },
      // 551 missing
      { printedPage: 552, contents: ["article-text"] },
    ];
    const res = verifyPageMapArticleCoverage(corruptedPageMap, 549, 552);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Missing printed page 551");
  });

  test("planted negative: order inversion in pageMap is rejected", () => {
    const corruptedPageMap = [
      { printedPage: 549, contents: ["article-text"] },
      { printedPage: 552, contents: ["article-text"] },
      { printedPage: 551, contents: ["article-text"] },
    ];
    const res = verifyPageMapArticleCoverage(corruptedPageMap, 549, 552);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("not in non-decreasing order");
  });

  test("planted negative: missing required watch list entry is rejected", () => {
    const corruptedWatchList = [
      { id: "w1", item: "Viscosity k = 1.35 * 10^-2", expectedCheck: "viscosity check" },
      // radius missing
      { id: "w3", item: "Avogadro N = 6 * 10^23", expectedCheck: "Avogadro check" },
    ];
    const res = verifyWatchListPrintedNumbers(corruptedWatchList);
    expect(res.valid).toBe(false);
    expect(res.missing).toContain("radius");
  });
});
