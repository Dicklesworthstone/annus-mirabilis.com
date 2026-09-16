import { describe, it, expect } from "bun:test";
import {
  computeFlagFingerprint,
  parseFlagReviews,
  buildReviewQueue,
  type ReviewFlagItem,
} from "../content/compiler/reviewQueue.ts";
import { getLogger } from "./log/logger.ts";

describe("Content Review Queue & Flag Lifecycle (am-cm-compiler-core-oa7)", () => {
  const logger = getLogger("content-compiler-tests");

  function logTest(testId: string, outcome: "passed" | "failed", message: string) {
    logger.log({
      testId,
      beadId: "am-cm-compiler-core-oa7",
      outcome,
      message,
    });
  }

  it("produces stable fingerprints across identical runs", () => {
    const input1 = {
      rule: "pedagogical-simplification",
      recordId: "arg-bm-01",
      fieldPath: "readings.full[0]",
      flaggedText: "We assume constant friction coefficient.",
    };
    const input2 = { ...input1 };

    const fp1 = computeFlagFingerprint(input1);
    const fp2 = computeFlagFingerprint(input2);

    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[a-f0-9]{64}$/);
    logTest("fingerprint-stability", "passed", "Computed deterministic SHA-256 flag fingerprints");
  });

  it("marks a flag reviewed when matching flag-reviews.yaml entry is present", () => {
    const flag: ReviewFlagItem = {
      code: "pedagogical-simplification",
      rule: "pedagogical-simplification",
      recordId: "arg-bm-01",
      path: "readings.full[0]",
      message: "Check approximation bounds.",
      flaggedText: "We assume constant friction coefficient.",
      paper: "brownian-motion",
    };

    const fingerprint = computeFlagFingerprint({
      rule: flag.rule,
      recordId: flag.recordId,
      fieldPath: flag.path,
      flaggedText: flag.flaggedText,
    });

    const reviewsYaml = `
- fingerprint: "${fingerprint}"
  rule: "pedagogical-simplification"
  recordId: "arg-bm-01"
  decision: "accepted-as-is"
  reviewer: "jemanuel"
  date: "2026-09-15"
  note: "Verified against Section 3 derivation."
`;

    const reviewMap = parseFlagReviews(reviewsYaml);
    const queue = buildReviewQueue([flag], reviewMap);

    expect(queue.openFlags.length).toBe(0);
    expect(queue.reviewedFlags.length).toBe(1);
    expect(queue.reviewedFlags[0]?.status).toBe("reviewed");
    expect(queue.reviewedFlags[0]?.review?.decision).toBe("accepted-as-is");
    expect(queue.reviewedFlags[0]?.review?.reviewer).toBe("jemanuel");
    expect(queue.summary.openCount).toBe(0);
    expect(queue.summary.reviewedCount).toBe(1);
    expect(queue.summary.staleCount).toBe(0);

    logTest("flag-review-match", "passed", "Matched recorded review and marked flag reviewed");
  });

  it("automatically reopens a flag when flagged text is edited", () => {
    const originalFlag: ReviewFlagItem = {
      code: "pedagogical-simplification",
      rule: "pedagogical-simplification",
      recordId: "arg-bm-01",
      path: "readings.full[0]",
      message: "Check approximation bounds.",
      flaggedText: "We assume constant friction coefficient.",
      paper: "brownian-motion",
    };

    const originalFp = computeFlagFingerprint({
      rule: originalFlag.rule,
      recordId: originalFlag.recordId,
      fieldPath: originalFlag.path,
      flaggedText: originalFlag.flaggedText,
    });

    const reviewsYaml = `
- fingerprint: "${originalFp}"
  rule: "pedagogical-simplification"
  recordId: "arg-bm-01"
  decision: "accepted-as-is"
  reviewer: "jemanuel"
  date: "2026-09-15"
  note: "Reviewed original text."
`;
    const reviewMap = parseFlagReviews(reviewsYaml);

    // Edited flag text: one word changed
    const editedFlag: ReviewFlagItem = {
      ...originalFlag,
      flaggedText: "We assume variable friction coefficient.",
    };

    const queue = buildReviewQueue([editedFlag], reviewMap);

    expect(queue.openFlags.length).toBe(1);
    expect(queue.reviewedFlags.length).toBe(0);
    expect(queue.openFlags[0]?.status).toBe("open");
    expect(queue.staleReviews.length).toBe(1);
    expect(queue.staleReviews[0]?.fingerprint).toBe(originalFp);
    expect(queue.summary.openCount).toBe(1);
    expect(queue.summary.staleCount).toBe(1);

    logTest("flag-text-edit-reopen", "passed", "Reopened flag upon text modification and flagged review as stale");
  });

  it("identifies orphaned reviews as stale-review and formats Markdown grouped by paper and rule", () => {
    const flag1: ReviewFlagItem = {
      code: "rule-a",
      rule: "rule-a",
      recordId: "arg-01",
      path: "arg-01",
      message: "Open issue in paper A.",
      paper: "light-quanta",
    };

    const flag2: ReviewFlagItem = {
      code: "rule-b",
      rule: "rule-b",
      recordId: "arg-02",
      path: "arg-02",
      message: "Open issue in paper B.",
      paper: "special-relativity",
    };

    const orphanReviewsYaml = `
- fingerprint: "stale111111111111111111111111111111111111111111111111111111111111"
  rule: "deleted-rule"
  recordId: "deleted-record"
  decision: "accepted-as-is"
  reviewer: "reviewer1"
  date: "2026-09-01"
  note: "Old review."
`;

    const reviewMap = parseFlagReviews(orphanReviewsYaml);
    const queue = buildReviewQueue([flag1, flag2], reviewMap);

    expect(queue.openFlags.length).toBe(2);
    expect(queue.staleReviews.length).toBe(1);
    expect(queue.staleReviews[0]?.reason).toBe("unmatched-flag");

    // Markdown grouping assertions
    expect(queue.markdownContent).toContain("# Content Review Queue");
    expect(queue.markdownContent).toContain("## Paper: light-quanta");
    expect(queue.markdownContent).toContain("## Paper: special-relativity");
    expect(queue.markdownContent).toContain("### Rule: `rule-a`");
    expect(queue.markdownContent).toContain("### Rule: `rule-b`");
    expect(queue.markdownContent).toContain("## Stale Reviews");
    expect(queue.markdownContent).toContain("stale111111111111111111111111111111111111111111111111111111111111");

    logTest("review-queue-markdown-format", "passed", "Generated grouped Markdown and captured stale reviews");
  });
});
