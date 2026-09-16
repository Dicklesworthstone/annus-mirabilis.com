/**
 * Content Review Queue Manager.
 * Computes deterministic fingerprints for review flags, matches them against human
 * review decisions in `content/editorial/flag-reviews.yaml`, and generates
 * `artifacts/content-review-queue.json` and `artifacts/content-review-queue.md`.
 *
 * Spec: AGENTS.md and am-cm-compiler-core-oa7
 */

import { createHash } from "node:crypto";
import { parseYaml } from "../provenance/yaml.ts";

export interface FlagFingerprintInput {
  rule: string;
  recordId: string;
  fieldPath?: string | undefined;
  flaggedText?: string | undefined;
  contentHash?: string | undefined;
}

export type ReviewDecision = "accepted-as-is" | "changed" | "deferred";

export interface FlagReviewRecord {
  fingerprint: string;
  rule: string;
  recordId: string;
  decision: ReviewDecision;
  reviewer: string;
  date: string;
  note: string;
}

export interface ReviewFlagItem {
  code: string;
  rule: string;
  recordId: string;
  file?: string | undefined;
  path?: string | undefined;
  message: string;
  repair?: string | undefined;
  flaggedText?: string | undefined;
  contentHash?: string | undefined;
  paper?: string | undefined;
  family?: string | undefined;
}

export interface ProcessedReviewFlag extends ReviewFlagItem {
  fingerprint: string;
  status: "open" | "reviewed";
  review?: FlagReviewRecord | undefined;
}

export interface StaleReviewRecord extends FlagReviewRecord {
  reason: "unmatched-flag";
}

export interface ReviewQueueResult {
  readonly openFlags: readonly ProcessedReviewFlag[];
  readonly reviewedFlags: readonly ProcessedReviewFlag[];
  readonly staleReviews: readonly StaleReviewRecord[];
  readonly summary: {
    readonly totalFlags: number;
    readonly openCount: number;
    readonly reviewedCount: number;
    readonly staleCount: number;
  };
  readonly jsonContent: string;
  readonly markdownContent: string;
}

/**
 * Computes a deterministic SHA-256 fingerprint for a review flag.
 */
export function computeFlagFingerprint(input: FlagFingerprintInput): string {
  const parts = [
    input.rule.trim(),
    input.recordId.trim(),
    (input.fieldPath ?? "").trim(),
    (input.flaggedText ?? input.contentHash ?? "").trim(),
  ];
  return createHash("sha256").update(parts.join("\0")).digest("hex");
}

/**
 * Parses a flag reviews YAML or JSON string into a map of FlagReviewRecord keyed by fingerprint.
 */
export function parseFlagReviews(text: string): Map<string, FlagReviewRecord> {
  const map = new Map<string, FlagReviewRecord>();
  if (!text || !text.trim()) return map;

  const parsed = parseYaml(text);
  if (!parsed || typeof parsed !== "object") return map;

  // Handle both array of reviews or object with `reviews: [...]`
  const list = Array.isArray(parsed)
    ? parsed
    : "reviews" in parsed && Array.isArray((parsed as Record<string, unknown>).reviews)
      ? ((parsed as Record<string, unknown>).reviews as unknown[])
      : [];

  for (const item of list) {
    if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const fingerprint = typeof rec.fingerprint === "string" ? rec.fingerprint.trim() : "";
      const rule = typeof rec.rule === "string" ? rec.rule.trim() : "";
      const recordId = typeof rec.recordId === "string" ? rec.recordId.trim() : "";
      const decision = (
        typeof rec.decision === "string" ? rec.decision.trim() : "accepted-as-is"
      ) as ReviewDecision;
      const reviewer = typeof rec.reviewer === "string" ? rec.reviewer.trim() : "";
      const date = typeof rec.date === "string" ? rec.date.trim() : "";
      const note = typeof rec.note === "string" ? rec.note.trim() : "";

      if (fingerprint) {
        map.set(fingerprint, {
          fingerprint,
          rule,
          recordId,
          decision,
          reviewer,
          date,
          note,
        });
      }
    }
  }

  return map;
}

/**
 * Processes review flags against recorded human reviews and generates queue results.
 */
export function buildReviewQueue(
  rawFlags: readonly ReviewFlagItem[],
  reviewsMap: Map<string, FlagReviewRecord>,
  options?: { paperLookup?: (recordId: string) => string | undefined },
): ReviewQueueResult {
  const openFlags: ProcessedReviewFlag[] = [];
  const reviewedFlags: ProcessedReviewFlag[] = [];
  const matchedFingerprints = new Set<string>();

  for (const flag of rawFlags) {
    const fingerprint = computeFlagFingerprint({
      rule: flag.rule,
      recordId: flag.recordId,
      fieldPath: flag.path,
      flaggedText: flag.flaggedText,
      contentHash: flag.contentHash,
    });

    const paper =
      flag.paper ?? (options?.paperLookup ? options.paperLookup(flag.recordId) : undefined);
    const existingReview = reviewsMap.get(fingerprint);

    if (existingReview) {
      matchedFingerprints.add(fingerprint);
      reviewedFlags.push({
        ...flag,
        paper,
        fingerprint,
        status: "reviewed",
        review: existingReview,
      });
    } else {
      openFlags.push({
        ...flag,
        paper,
        fingerprint,
        status: "open",
      });
    }
  }

  // Find stale reviews in review records that matched no current flags
  const staleReviews: StaleReviewRecord[] = [];
  for (const [fingerprint, rec] of reviewsMap.entries()) {
    if (!matchedFingerprints.has(fingerprint)) {
      staleReviews.push({
        ...rec,
        reason: "unmatched-flag",
      });
    }
  }

  const summary = {
    totalFlags: rawFlags.length,
    openCount: openFlags.length,
    reviewedCount: reviewedFlags.length,
    staleCount: staleReviews.length,
  };

  const queueData = {
    schemaVersion: 1,
    summary,
    openFlags,
    reviewedFlags,
    staleReviews,
  };

  const jsonContent = JSON.stringify(queueData, null, 2) + "\n";
  const markdownContent = formatReviewQueueMarkdown(queueData);

  return {
    openFlags,
    reviewedFlags,
    staleReviews,
    summary,
    jsonContent,
    markdownContent,
  };
}

/**
 * Formats the review queue as human-readable Markdown grouped by paper and rule.
 */
function formatReviewQueueMarkdown(data: {
  summary: { totalFlags: number; openCount: number; reviewedCount: number; staleCount: number };
  openFlags: readonly ProcessedReviewFlag[];
  reviewedFlags: readonly ProcessedReviewFlag[];
  staleReviews: readonly StaleReviewRecord[];
}): string {
  const lines: string[] = [];
  lines.push("# Content Review Queue\n");
  lines.push(
    `**Summary:** ${data.summary.openCount} open, ${data.summary.reviewedCount} reviewed, ${data.summary.staleCount} stale reviews.\n`,
  );

  // Group all flags by Paper -> Rule
  const allFlags = [...data.openFlags, ...data.reviewedFlags];
  const byPaper = new Map<string, Map<string, ProcessedReviewFlag[]>>();

  for (const f of allFlags) {
    const paperKey = f.paper || "global";
    let ruleMap = byPaper.get(paperKey);
    if (!ruleMap) {
      ruleMap = new Map<string, ProcessedReviewFlag[]>();
      byPaper.set(paperKey, ruleMap);
    }
    let flagList = ruleMap.get(f.rule);
    if (!flagList) {
      flagList = [];
      ruleMap.set(f.rule, flagList);
    }
    flagList.push(f);
  }

  // Render per paper
  const sortedPapers = Array.from(byPaper.keys()).sort();
  for (const paper of sortedPapers) {
    const paperTitle = paper === "global" ? "Global / Unassigned" : `Paper: ${paper}`;
    lines.push(`## ${paperTitle}\n`);

    const ruleMap = byPaper.get(paper)!;
    const sortedRules = Array.from(ruleMap.keys()).sort();

    for (const rule of sortedRules) {
      lines.push(`### Rule: \`${rule}\`\n`);
      const flags = ruleMap.get(rule)!;

      for (const flag of flags) {
        if (flag.status === "reviewed" && flag.review) {
          lines.push(
            `- **[REVIEWED: ${flag.review.decision}]** \`${flag.recordId}\` (${flag.path || flag.file || "record"}) by @${flag.review.reviewer} on ${flag.review.date}`,
          );
          if (flag.review.note) lines.push(`  - *Note:* ${flag.review.note}`);
          lines.push(`  - *Fingerprint:* \`${flag.fingerprint}\``);
        } else {
          lines.push(`- **[OPEN]** \`${flag.recordId}\` (${flag.path || flag.file || "record"})`);
          lines.push(`  - *Message:* ${flag.message}`);
          if (flag.repair) lines.push(`  - *Repair:* ${flag.repair}`);
          if (flag.flaggedText) lines.push(`  - *Flagged text:* \`${flag.flaggedText}\``);
          lines.push(`  - *Fingerprint:* \`${flag.fingerprint}\``);
        }
        lines.push("");
      }
    }
  }

  // Render stale reviews if any
  if (data.staleReviews.length > 0) {
    lines.push("## Stale Reviews\n");
    for (const stale of data.staleReviews) {
      lines.push(
        `- **[STALE]** Fingerprint \`${stale.fingerprint}\` (rule: \`${stale.rule}\`, record: \`${stale.recordId}\`) was reviewed by @${stale.reviewer} but no longer matches any active flag.`,
      );
    }
    lines.push("");
  }

  return lines.join("\n") + "\n";
}
