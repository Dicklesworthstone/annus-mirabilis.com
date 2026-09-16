import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type StandardReviewRecord,
  validateCrossProjectionRecord,
  validateReviewRecord,
} from "../src/content/schemas/review.ts";
import { generateChecklistMarkdown, type ReleaseCandidateEvidence } from "./checklist.ts";

function getSampleEvidence(): ReleaseCandidateEvidence {
  const deReview = validateReviewRecord(
    {
      id: "rev-de-01",
      reviewType: "german-source",
      reviewer: "rev-de-valid",
      date: "2026-09-16",
      result: "accepted",
      scope: [{ recordId: "unit-01", translationRevision: 1 }],
    },
    { skipOwnerRoleCheck: true },
  ) as StandardReviewRecord;

  const physReview = validateReviewRecord(
    {
      id: "rev-phys-01",
      reviewType: "physics-math",
      reviewer: "rev-phys-valid",
      date: "2026-09-16",
      result: "accepted",
      scope: [{ recordId: "arg-01", contentRevision: 1 }],
    },
    { skipOwnerRoleCheck: true },
  ) as StandardReviewRecord;

  const compRound = validateReviewRecord(
    {
      id: "round-comp-01",
      reviewType: "comprehension-round",
      reviewer: "facilitator-1",
      date: "2026-09-16",
      result: "accepted",
      scope: [{ recordId: "paper-01" }],
      sessionRef: "docs/comprehension/rounds/round-01.md",
    },
    { skipOwnerRoleCheck: true },
  ) as StandardReviewRecord;

  const xproj = validateCrossProjectionRecord(
    {
      id: "xproj-01",
      reviewType: "cross-projection",
      reviewer: "xproj-rev-1",
      date: "2026-09-16",
      result: "accepted",
      claimId: "claim-01",
      paper: "brownian-motion",
      claimStatement: "Statement 1.",
      resultCardId: "card-01",
      contentRevision: 1,
      translationRevision: 1,
      projections: [
        { projection: "source-german", anchor: "s1", verdict: "unchanged" },
        { projection: "translation-english", anchor: "s1-tr", verdict: "unchanged" },
        { projection: "reading-r0", anchor: "r0", verdict: "unchanged" },
        { projection: "reading-r2", anchor: "r2", verdict: "unchanged" },
        { projection: "reading-r3", anchor: "r3", verdict: "absent" },
        { projection: "equation", anchor: "eq1", verdict: "unchanged" },
        { projection: "instrument", anchor: "lab1", verdict: "unchanged" },
        { projection: "results-card", anchor: "card1", verdict: "unchanged" },
        { projection: "print", anchor: "p1", verdict: "unchanged" },
        { projection: "accessible", anchor: "a1", verdict: "unchanged" },
        { projection: "tour", anchor: "t1", verdict: "absent" },
      ],
      findings: [],
      outcome: "accepted",
    },
    { skipOwnerRoleCheck: true },
  );

  return {
    candidateId: "rc-20260916-01",
    paper: "brownian-motion",
    q1: {
      sourceManifestVerified: true,
      germanSourceReviews: [deReview],
      missing: [],
    },
    q2: {
      physicsMathReviews: [physReview],
      r2ReadabilityReviews: [],
      missing: [],
    },
    q3: {
      scenarioResults: [{ scenarioId: "sc-bm-01", pass: true }],
      instrumentContracts: [{ testFile: "src/testing/bm01Controls.test.mjs", pass: true }],
      missing: [],
    },
    q4: {
      browserLanes: [{ lane: "webkit-mobile", pass: true }],
      a11yRounds: [],
      realDeviceChecks: [{ device: "iphone-15", pass: true }],
      missing: [],
    },
    q5: {
      comprehensionRounds: [compRound],
      crossProjectionRecords: [xproj],
      missing: [],
    },
  };
}

describe("checklist generator", () => {
  it("generates markdown with 5 sections, evidence links, and no numeric aggregate score", () => {
    const evidence = getSampleEvidence();
    const result = generateChecklistMarkdown(evidence);

    assert.equal(result.markdown.includes("## 1. Historical Text Complete and Accurate"), true);
    assert.equal(result.markdown.includes("## 2. Explanation Sound and Accessible"), true);
    assert.equal(
      result.markdown.includes("## 3. Instruments Calculate and Display Stated Model Correctly"),
      true,
    );
    assert.equal(
      result.markdown.includes("## 4. Visitors Can Operate and Understand the Page"),
      true,
    );
    assert.equal(
      result.markdown.includes("## 5. Explanation Helps Readers Overcome Intended Obstacle"),
      true,
    );

    assert.equal(result.markdown.includes("### Comprehension Study Rounds"), true);
    assert.equal(result.markdown.includes("### Cross-Projection Invariance Reviews"), true);

    // Assert NO percentage or numeric aggregate score is present
    assert.equal(/\d+%/.test(result.markdown), false);
    assert.equal(/score:\s*\d+/i.test(result.markdown), false);
    assert.equal(/aggregate\s+score:\s*\d+/i.test(result.markdown), false);
    assert.equal(/total:\s*\d+/i.test(result.markdown), false);

    assert.equal(result.passes, true);
    assert.equal(result.openBlockers.length, 0);
  });

  it("fails checklist when Question 5 has comprehension rounds but missing cross-projection records", () => {
    const evidence = getSampleEvidence();
    // Empty cross projection records
    evidence.q5 = {
      ...evidence.q5,
      crossProjectionRecords: [],
    };

    const result = generateChecklistMarkdown(evidence);
    assert.equal(result.passes, false);
    assert.equal(
      result.openBlockers.some((b) => b.includes("Cross-projection review records missing")),
      true,
    );
  });

  it("blocks checklist when cross-projection record has open findings and lists owning bead ids", () => {
    const evidence = getSampleEvidence();
    const openXproj = validateCrossProjectionRecord(
      {
        id: "xproj-02",
        reviewType: "cross-projection",
        reviewer: "xproj-rev-1",
        date: "2026-09-16",
        result: "accepted",
        claimId: "claim-02-energy",
        paper: "mass-energy",
        claimStatement: "Energy statement.",
        resultCardId: "card-02",
        contentRevision: 1,
        translationRevision: 1,
        projections: [
          { projection: "source-german", anchor: "s1", verdict: "unchanged" },
          { projection: "translation-english", anchor: "s1-tr", verdict: "unchanged" },
          { projection: "reading-r0", anchor: "r0", verdict: "weakened" },
          { projection: "reading-r2", anchor: "r2", verdict: "unchanged" },
          { projection: "reading-r3", anchor: "r3", verdict: "absent" },
          { projection: "equation", anchor: "eq1", verdict: "unchanged" },
          { projection: "instrument", anchor: "lab1", verdict: "unchanged" },
          { projection: "results-card", anchor: "card1", verdict: "unchanged" },
          { projection: "print", anchor: "p1", verdict: "unchanged" },
          { projection: "accessible", anchor: "a1", verdict: "unchanged" },
          { projection: "tour", anchor: "t1", verdict: "absent" },
        ],
        findings: [
          {
            projection: "reading-r0",
            anchor: "r0",
            kind: "qualification-dropped",
            description: "Dropped proxy qualification in R0 reading",
            owningBeadId: "am-me-readings-01",
          },
        ],
        outcome: "findings-open",
      },
      { skipOwnerRoleCheck: true },
    );

    evidence.q5 = {
      ...evidence.q5,
      crossProjectionRecords: [openXproj],
    };

    const result = generateChecklistMarkdown(evidence);
    assert.equal(result.passes, false);
    assert.equal(result.markdown.includes("qualification-dropped"), true);
    assert.equal(result.markdown.includes("am-me-readings-01"), true);
    assert.equal(
      result.openBlockers.some((b) => b.includes("am-me-readings-01")),
      true,
    );
  });
});
