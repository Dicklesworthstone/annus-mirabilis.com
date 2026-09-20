#!/usr/bin/env bun
/**
 * Five-question release checklist generator.
 * Specification: am-edit-review-records-hofz (§17.1, §17.2, §17.7)
 *
 * Emits five independent qualitative sections. No aggregate score or percentage is calculated.
 */

import fs from "node:fs";
import path from "node:path";
import type { CrossProjectionReviewRecord, ReviewRecord } from "../src/content/schemas/review.ts";

export type Question1Evidence = Readonly<{
  sourceManifestVerified: boolean;
  germanSourceReviews: readonly ReviewRecord[];
  missing: readonly string[];
}>;

export type Question2Evidence = Readonly<{
  physicsMathReviews: readonly ReviewRecord[];
  r2ReadabilityReviews: readonly ReviewRecord[];
  missing: readonly string[];
}>;

export type Question3Evidence = Readonly<{
  scenarioResults: readonly { scenarioId: string; pass: boolean }[];
  instrumentContracts: readonly { testFile: string; pass: boolean }[];
  missing: readonly string[];
}>;

export type Question4Evidence = Readonly<{
  browserLanes: readonly { lane: string; pass: boolean }[];
  a11yRounds: readonly ReviewRecord[];
  realDeviceChecks: readonly { device: string; pass: boolean }[];
  missing: readonly string[];
}>;

export type Question5Evidence = Readonly<{
  comprehensionRounds: readonly ReviewRecord[];
  crossProjectionRecords: readonly CrossProjectionReviewRecord[];
  missing: readonly string[];
}>;

export type ReleaseCandidateEvidence = Readonly<{
  candidateId: string;
  paper?: string | undefined;
  generatedAt?: string | undefined;
  q1: Question1Evidence;
  q2: Question2Evidence;
  q3: Question3Evidence;
  q4: Question4Evidence;
  q5: Question5Evidence;
}>;

export type ChecklistOutput = Readonly<{
  markdown: string;
  passes: boolean;
  openBlockers: readonly string[];
}>;

/**
 * Every collection of evidence the checklist counts, and the blocker raised when one is empty.
 *
 * am-wdqy. Q1, Q2 and Q5 used to raise these inline and Q3 and Q4 did not: their sections pushed
 * blockers from INSIDE their loops, so an empty collection contributed nothing and the checklist
 * printed "READY FOR RELEASE. All five questions have sufficient verified evidence" two lines below
 * "Scenario Results (0)" and "Automated Browser Lanes (0)". A release gate declaring readiness
 * having run nothing is the same shape as a licence inventory passing over zero items.
 *
 * Declaring the collections once means a new one cannot be added to the evidence type and left out
 * of the emptiness rule, which is how the asymmetry arose: each section was written separately and
 * each was internally consistent.
 *
 * `r2ReadabilityReviews` and `a11yRounds` are in this list although the bead named only Q3 and Q4.
 * Both were empty-blind in exactly the same way, and both were EMPTY in the repository's own
 * "complete" sample fixture, which asserted passes === true. A fix that left them out would have
 * kept a hole open in the file it was closing.
 */
export const EVIDENCE_COLLECTIONS: readonly Readonly<{
  question: 1 | 2 | 3 | 4 | 5;
  label: string;
  emptyBlocker: string;
  count: (evidence: ReleaseCandidateEvidence) => number;
}>[] = Object.freeze([
  {
    question: 1,
    label: "German source reviews",
    emptyBlocker: "Q1: German source review records missing.",
    count: (e) => e.q1.germanSourceReviews.length,
  },
  {
    question: 2,
    label: "Physics and mathematics reviews",
    emptyBlocker: "Q2: Physics/math review records missing.",
    count: (e) => e.q2.physicsMathReviews.length,
  },
  {
    question: 2,
    label: "R2 readability reviews",
    emptyBlocker: "Q2: R2 readability review records missing.",
    count: (e) => e.q2.r2ReadabilityReviews.length,
  },
  {
    question: 3,
    label: "Scenario results",
    emptyBlocker: "Q3: Scenario results missing.",
    count: (e) => e.q3.scenarioResults.length,
  },
  {
    question: 3,
    label: "Instrument contract tests",
    emptyBlocker: "Q3: Instrument contract test results missing.",
    count: (e) => e.q3.instrumentContracts.length,
  },
  {
    question: 4,
    label: "Automated browser lanes",
    emptyBlocker: "Q4: Automated browser lane results missing.",
    count: (e) => e.q4.browserLanes.length,
  },
  {
    question: 4,
    label: "Accessibility co-design rounds",
    emptyBlocker: "Q4: Accessibility co-design round records missing.",
    count: (e) => e.q4.a11yRounds.length,
  },
  {
    question: 4,
    label: "Real-device verification checks",
    emptyBlocker: "Q4: Real-device verification checks missing.",
    count: (e) => e.q4.realDeviceChecks.length,
  },
  {
    question: 5,
    label: "Comprehension study rounds",
    emptyBlocker: "Q5: Comprehension study rounds missing.",
    count: (e) => e.q5.comprehensionRounds.length,
  },
  {
    question: 5,
    label: "Cross-projection invariance reviews",
    emptyBlocker: "Q5: Cross-projection review records missing.",
    count: (e) => e.q5.crossProjectionRecords.length,
  },
]);

export type EvidenceCensus = Readonly<{
  collections: number;
  nonEmpty: number;
  records: number;
  empty: readonly string[];
}>;

/** What the checklist actually counted, so the status line can report it instead of asserting it. */
export function censusOfEvidence(evidence: ReleaseCandidateEvidence): EvidenceCensus {
  const counts = EVIDENCE_COLLECTIONS.map((c) => ({ label: c.label, n: c.count(evidence) }));
  return Object.freeze({
    collections: counts.length,
    nonEmpty: counts.filter((c) => c.n > 0).length,
    records: counts.reduce((sum, c) => sum + c.n, 0),
    empty: Object.freeze(counts.filter((c) => c.n === 0).map((c) => c.label)),
  });
}

/**
 * Generates the release checklist markdown from structured evidence.
 */
export function generateChecklistMarkdown(evidence: ReleaseCandidateEvidence): ChecklistOutput {
  const lines: string[] = [];
  const openBlockers: string[] = [];
  const timestamp = evidence.generatedAt ?? new Date().toISOString();

  lines.push(`# Release Candidate Checklist: ${evidence.candidateId}`);
  if (evidence.paper) {
    lines.push(`**Paper**: \`${evidence.paper}\``);
  }
  lines.push(`**Generated**: ${timestamp}`);
  lines.push("");
  lines.push(
    "> **Governance Rule**: Each question is evaluated independently on verified evidence.",
  );
  lines.push("> No single aggregate score, weighted index, or percentage is used.");
  lines.push("");

  // Question 1
  lines.push("## 1. Historical Text Complete and Accurate");
  lines.push("");
  lines.push(
    `- **Source Manifest Verified**: ${evidence.q1.sourceManifestVerified ? "YES" : "NO"}`,
  );
  if (!evidence.q1.sourceManifestVerified) {
    openBlockers.push("Q1: Source manifest verification failed or missing.");
  }

  lines.push(`- **German Source Reviews (${evidence.q1.germanSourceReviews.length})**:`);
  if (evidence.q1.germanSourceReviews.length === 0) {
    lines.push("  - *None recorded.*");
  } else {
    for (const r of evidence.q1.germanSourceReviews) {
      lines.push(`  - \`${r.id}\` by \`${r.reviewer}\` (${r.date}): outcome \`${r.result}\``);
      if (r.result !== "accepted" && r.result !== "accepted-with-changes") {
        openBlockers.push(`Q1: Review record ${r.id} not accepted (${r.result}).`);
      }
    }
  }

  lines.push("- **Missing Evidence**:");
  if (evidence.q1.missing.length === 0) {
    lines.push("  - None.");
  } else {
    for (const m of evidence.q1.missing) {
      lines.push(`  - ${m}`);
      openBlockers.push(`Q1: ${m}`);
    }
  }
  lines.push("");

  // Question 2
  lines.push("## 2. Explanation Sound and Accessible");
  lines.push("");
  lines.push(`- **Physics & Math Derivation Reviews (${evidence.q2.physicsMathReviews.length})**:`);
  if (evidence.q2.physicsMathReviews.length === 0) {
    lines.push("  - *None recorded.*");
  } else {
    for (const r of evidence.q2.physicsMathReviews) {
      lines.push(`  - \`${r.id}\` by \`${r.reviewer}\` (${r.date}): outcome \`${r.result}\``);
      if (r.result !== "accepted" && r.result !== "accepted-with-changes") {
        openBlockers.push(`Q2: Review record ${r.id} not accepted (${r.result}).`);
      }
    }
  }

  lines.push(`- **R2 Readability Reviews (${evidence.q2.r2ReadabilityReviews.length})**:`);
  if (evidence.q2.r2ReadabilityReviews.length === 0) {
    lines.push("  - *None recorded.*");
  } else {
    for (const r of evidence.q2.r2ReadabilityReviews) {
      lines.push(`  - \`${r.id}\` by \`${r.reviewer}\` (${r.date}): outcome \`${r.result}\``);
    }
  }

  lines.push("- **Missing Evidence**:");
  if (evidence.q2.missing.length === 0) {
    lines.push("  - None.");
  } else {
    for (const m of evidence.q2.missing) {
      lines.push(`  - ${m}`);
      openBlockers.push(`Q2: ${m}`);
    }
  }
  lines.push("");

  // Question 3
  lines.push("## 3. Instruments Calculate and Display Stated Model Correctly");
  lines.push("");
  lines.push(`- **Scenario Results (${evidence.q3.scenarioResults.length})**:`);
  for (const s of evidence.q3.scenarioResults) {
    lines.push(`  - Scenario \`${s.scenarioId}\`: ${s.pass ? "PASS" : "FAIL"}`);
    if (!s.pass) openBlockers.push(`Q3: Scenario ${s.scenarioId} failed.`);
  }

  lines.push(`- **Instrument Contract Tests (${evidence.q3.instrumentContracts.length})**:`);
  for (const c of evidence.q3.instrumentContracts) {
    lines.push(`  - Contract \`${c.testFile}\`: ${c.pass ? "PASS" : "FAIL"}`);
    if (!c.pass) openBlockers.push(`Q3: Contract test ${c.testFile} failed.`);
  }

  lines.push("- **Missing Evidence**:");
  if (evidence.q3.missing.length === 0) {
    lines.push("  - None.");
  } else {
    for (const m of evidence.q3.missing) {
      lines.push(`  - ${m}`);
      openBlockers.push(`Q3: ${m}`);
    }
  }
  lines.push("");

  // Question 4
  lines.push("## 4. Visitors Can Operate and Understand the Page");
  lines.push("");
  lines.push(`- **Automated Browser Lanes (${evidence.q4.browserLanes.length})**:`);
  for (const b of evidence.q4.browserLanes) {
    lines.push(`  - Lane \`${b.lane}\`: ${b.pass ? "PASS" : "FAIL"}`);
    if (!b.pass) openBlockers.push(`Q4: Browser lane ${b.lane} failed.`);
  }

  lines.push(`- **Accessibility Co-Design Rounds (${evidence.q4.a11yRounds.length})**:`);
  for (const a of evidence.q4.a11yRounds) {
    lines.push(`  - Round \`${a.id}\` by \`${a.reviewer}\`: outcome \`${a.result}\``);
  }

  lines.push(`- **Real-Device Verification Checks (${evidence.q4.realDeviceChecks.length})**:`);
  for (const d of evidence.q4.realDeviceChecks) {
    lines.push(`  - Device \`${d.device}\`: ${d.pass ? "PASS" : "FAIL"}`);
    if (!d.pass) openBlockers.push(`Q4: Real-device check ${d.device} failed.`);
  }

  lines.push("- **Missing Evidence**:");
  if (evidence.q4.missing.length === 0) {
    lines.push("  - None.");
  } else {
    for (const m of evidence.q4.missing) {
      lines.push(`  - ${m}`);
      openBlockers.push(`Q4: ${m}`);
    }
  }
  lines.push("");

  // Question 5
  lines.push("## 5. Explanation Helps Readers Overcome Intended Obstacle");
  lines.push("");
  lines.push(`### Comprehension Study Rounds (${evidence.q5.comprehensionRounds.length})`);
  if (evidence.q5.comprehensionRounds.length === 0) {
    lines.push("- *None recorded.*");
  } else {
    for (const c of evidence.q5.comprehensionRounds) {
      lines.push(
        `- Round \`${c.id}\` by facilitator \`${c.reviewer}\` (${c.date}): outcome \`${c.result}\``,
      );
    }
  }
  lines.push("");

  lines.push(
    `### Cross-Projection Invariance Reviews (${evidence.q5.crossProjectionRecords.length})`,
  );
  if (evidence.q5.crossProjectionRecords.length === 0) {
    lines.push("- *None recorded.*");
  } else {
    for (const xp of evidence.q5.crossProjectionRecords) {
      lines.push(
        `- Claim \`${xp.claimId}\` on \`${xp.paper}\`: outcome \`${xp.outcome}\` by \`${xp.reviewer}\``,
      );
      if (xp.findings.length > 0) {
        lines.push(`  - Open Findings (${xp.findings.length}):`);
        for (const f of xp.findings) {
          lines.push(
            `    - [${f.kind}] at projection \`${f.projection}\` (${f.anchor}): "${f.description}" (owning bead: \`${f.owningBeadId}\`)`,
          );
          openBlockers.push(
            `Q5: Open finding in ${xp.claimId} at ${f.projection} (bead ${f.owningBeadId})`,
          );
        }
      }
    }
  }
  lines.push("");

  lines.push("- **Missing Evidence**:");
  if (evidence.q5.missing.length === 0) {
    lines.push("  - None.");
  } else {
    for (const m of evidence.q5.missing) {
      lines.push(`  - ${m}`);
      openBlockers.push(`Q5: ${m}`);
    }
  }
  lines.push("");

  // Every evidence collection is checked for emptiness in one place, in question order, so a
  // question whose section pushes blockers only from inside its loops cannot contribute nothing.
  const census = censusOfEvidence(evidence);
  for (const collection of EVIDENCE_COLLECTIONS) {
    if (collection.count(evidence) === 0) openBlockers.push(collection.emptyBlocker);
  }

  // Summary of blockers
  lines.push("## Evaluation Summary");
  lines.push("");
  // The status line reports what was counted. It used to assert that "All five questions have
  // sufficient verified evidence", which is a claim about sufficiency that no count can support and
  // which was printed with two of the five holding no evidence at all.
  const counted = `${census.nonEmpty} of ${census.collections} evidence collections non-empty, ${census.records} records counted`;
  if (openBlockers.length === 0) {
    lines.push(`**STATUS**: READY FOR RELEASE - 0 open blockers. ${counted}.`);
  } else {
    lines.push(`**STATUS**: BLOCKED (${openBlockers.length} issues open). ${counted}.`);
    if (census.empty.length > 0) {
      lines.push("");
      lines.push(
        `Empty evidence collections (${census.empty.length}): ${census.empty.join(", ")}.`,
      );
    }
    lines.push("");
    lines.push("### Open Blockers");
    for (const b of openBlockers) {
      lines.push(`- ${b}`);
    }
  }
  lines.push("");

  return {
    markdown: lines.join("\n"),
    passes: openBlockers.length === 0,
    openBlockers: Object.freeze(openBlockers),
  };
}

/**
 * Generates and writes the checklist file.
 */
export function writeReleaseChecklist(
  evidence: ReleaseCandidateEvidence,
  baseDir = "docs/release",
): ChecklistOutput {
  const outDir = path.join(baseDir, evidence.candidateId);
  fs.mkdirSync(outDir, { recursive: true });

  const result = generateChecklistMarkdown(evidence);
  const targetFile = path.join(outDir, "checklist.md");
  fs.writeFileSync(targetFile, result.markdown, "utf8");

  return result;
}
