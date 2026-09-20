import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type StandardReviewRecord,
  validateCrossProjectionRecord,
  validateReviewRecord,
} from "../src/content/schemas/review.ts";
import {
  censusOfEvidence,
  EVIDENCE_COLLECTIONS,
  generateChecklistMarkdown,
  type ReleaseCandidateEvidence,
} from "./checklist.ts";

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

  // am-wdqy. These two were EMPTY in the fixture this file called complete, and the generator did
  // not notice, which is the defect. Built through the validators so a schema change breaks the
  // fixture at the point of construction rather than producing a plausible wrong shape.
  const r2Review = validateReviewRecord(
    {
      id: "rev-r2-01",
      reviewType: "r2-readability",
      reviewer: "rev-r2-valid",
      date: "2026-09-16",
      result: "accepted",
      scope: [{ recordId: "sec-01", contentRevision: 1 }],
    },
    { skipOwnerRoleCheck: true },
  ) as StandardReviewRecord;

  const a11yRound = validateReviewRecord(
    {
      id: "round-a11y-01",
      reviewType: "accessibility-codesign",
      reviewer: "a11y-participant-1",
      date: "2026-09-16",
      result: "accepted",
      scope: [{ recordId: "lab-bm-01" }],
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
      r2ReadabilityReviews: [r2Review],
      missing: [],
    },
    q3: {
      scenarioResults: [{ scenarioId: "sc-bm-01", pass: true }],
      instrumentContracts: [{ testFile: "src/testing/bm01Controls.test.mjs", pass: true }],
      missing: [],
    },
    q4: {
      browserLanes: [{ lane: "webkit-mobile", pass: true }],
      a11yRounds: [a11yRound],
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
    const base = getSampleEvidence();
    // Empty cross projection records
    const evidence: ReleaseCandidateEvidence = {
      ...base,
      q5: {
        ...base.q5,
        crossProjectionRecords: [],
      },
    };

    const result = generateChecklistMarkdown(evidence);
    assert.equal(result.passes, false);
    assert.equal(
      result.openBlockers.some((b) => b.includes("Cross-projection review records missing")),
      true,
    );
  });

  it("blocks checklist when cross-projection record has open findings and lists owning bead ids", () => {
    const base = getSampleEvidence();
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

    const evidence: ReleaseCandidateEvidence = {
      ...base,
      q5: {
        ...base.q5,
        crossProjectionRecords: [openXproj],
      },
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

/**
 * am-wdqy. generateChecklistMarkdown declared a release ready having run nothing.
 *
 * With Q1, Q2 and Q5 satisfied and Q3 and Q4 empty it returned passes true, zero open blockers, and
 * printed "**STATUS**: READY FOR RELEASE. All five questions have sufficient verified evidence" two
 * lines below "Scenario Results (0)" and "Automated Browser Lanes (0)". The sentence was false on its
 * face: two of the five questions held no evidence at all.
 *
 * The asymmetry was inside one file. Q1, Q2 and Q5 raised a blocker when a collection was empty;
 * Q3 and Q4 raised theirs from INSIDE their loops, so an empty collection contributed nothing.
 */
describe("checklist readiness requires evidence to exist (am-wdqy)", () => {
  const emptyQuestion: Record<
    1 | 2 | 3 | 4 | 5,
    (b: ReleaseCandidateEvidence) => ReleaseCandidateEvidence
  > = {
    1: (b) => ({ ...b, q1: { ...b.q1, germanSourceReviews: [] } }),
    2: (b) => ({ ...b, q2: { ...b.q2, physicsMathReviews: [], r2ReadabilityReviews: [] } }),
    3: (b) => ({ ...b, q3: { ...b.q3, scenarioResults: [], instrumentContracts: [] } }),
    4: (b) => ({ ...b, q4: { ...b.q4, browserLanes: [], a11yRounds: [], realDeviceChecks: [] } }),
    5: (b) => ({ ...b, q5: { ...b.q5, comprehensionRounds: [], crossProjectionRecords: [] } }),
  };

  it("THE CONTROL: a genuinely complete evidence set still reaches READY FOR RELEASE", () => {
    const result = generateChecklistMarkdown(getSampleEvidence());
    assert.equal(result.passes, true);
    assert.deepEqual([...result.openBlockers], []);
    assert.equal(result.markdown.includes("READY FOR RELEASE"), true);
    // without this the change would be a tightening rather than a fix: a gate nothing can satisfy
    assert.deepEqual([...censusOfEvidence(getSampleEvidence()).empty], []);
  });

  it("READY FOR RELEASE is unreachable with ANY of the five questions empty", () => {
    // Accumulated rather than asserted per iteration, so one run names EVERY question that wrongly
    // reaches READY. Asserting inside the loop stops at the first and reports a single question,
    // which would have made the pre-fix behaviour look like one hole instead of two.
    const wronglyReady: string[] = [];
    for (const q of [1, 2, 3, 4, 5] as const) {
      const result = generateChecklistMarkdown(emptyQuestion[q](getSampleEvidence()));
      const ready = result.passes || result.markdown.includes("READY FOR RELEASE");
      const raisedOwnBlocker = result.openBlockers.some((b) => b.startsWith(`Q${q}:`));
      if (ready || !raisedOwnBlocker) {
        wronglyReady.push(
          `Q${q} (passes=${result.passes}, blockers=${result.openBlockers.length})`,
        );
      }
    }
    assert.deepEqual(
      wronglyReady,
      [],
      `these questions reach READY FOR RELEASE while holding no evidence: ${wronglyReady.join("; ")}`,
    );
  });

  it("the exact reproduction: Q1, Q2 and Q5 satisfied with Q3 and Q4 empty is BLOCKED", () => {
    const base = getSampleEvidence();
    const evidence = emptyQuestion[4](emptyQuestion[3](base));
    const result = generateChecklistMarkdown(evidence);
    assert.equal(result.passes, false);
    assert.equal(result.markdown.includes("Scenario Results (0)"), true);
    assert.equal(result.markdown.includes("Automated Browser Lanes (0)"), true);
    assert.equal(result.markdown.includes("READY FOR RELEASE"), false);
    assert.equal(result.openBlockers.length, 5);
  });

  it("every declared evidence collection blocks when empty, so none is exempt", () => {
    for (const collection of EVIDENCE_COLLECTIONS) {
      const base = getSampleEvidence();
      assert.ok(
        collection.count(base) > 0,
        `${collection.label} is empty in the complete fixture, so emptying it proves nothing`,
      );
      const emptied = emptyQuestion[collection.question](base);
      const result = generateChecklistMarkdown(emptied);
      assert.equal(result.passes, false, `${collection.label} empty still passed`);
      assert.equal(
        result.openBlockers.includes(collection.emptyBlocker),
        true,
        `${collection.label} empty did not raise "${collection.emptyBlocker}"`,
      );
    }
  });

  it("the status line reports what was counted instead of asserting sufficiency", () => {
    const result = generateChecklistMarkdown(getSampleEvidence());
    assert.equal(result.markdown.includes("sufficient verified evidence"), false);
    assert.equal(
      result.markdown.includes("10 of 10 evidence collections non-empty, 10 records counted"),
      true,
    );
    const blocked = generateChecklistMarkdown(emptyQuestion[3](getSampleEvidence()));
    // the BLOCKED branch reports counts too, and names which collections were empty
    assert.equal(blocked.markdown.includes("8 of 10 evidence collections non-empty"), true);
    assert.equal(blocked.markdown.includes("Scenario results"), true);
  });
});
