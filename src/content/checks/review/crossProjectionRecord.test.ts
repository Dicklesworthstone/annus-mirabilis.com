import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseOwners } from "../../owners/parseOwners.ts";
import { ReviewValidationError, validateCrossProjectionRecord } from "../../schemas/review.ts";

const FIXTURE_OWNERS = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| jemanuel | Jeffrey Emanuel | editorial-owner,implementation-owner | light-quanta | assigned | yes | agent:BoldHarbor | 2026-09-16 |
| xproj-rev-1 | Cross Proj Reviewer | cross-projection-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
`;

const registry = parseOwners(FIXTURE_OWNERS);

function getValidCrossProjectionRecord(): Record<string, unknown> {
  return {
    id: "xproj-bm-01",
    reviewType: "cross-projection",
    reviewer: "xproj-rev-1",
    date: "2026-09-16",
    result: "accepted",
    claimId: "bm-claim-displacement-law",
    paper: "brownian-motion",
    claimStatement:
      "The displacement law describes root-mean-square displacement and not a velocity.",
    resultCardId: "einstein-1905-brownian-printed",
    contentRevision: 1,
    translationRevision: 1,
    projections: [
      { projection: "source-german", anchor: "s4-p1", verdict: "unchanged" },
      {
        projection: "translation-english",
        anchor: "s4-p1-tr",
        verdict: "unchanged",
      },
      { projection: "reading-r0", anchor: "read-r0-s4", verdict: "unchanged" },
      { projection: "reading-r2", anchor: "read-r2-s4", verdict: "unchanged" },
      {
        projection: "reading-r3",
        anchor: "read-r3-s4",
        verdict: "absent",
        note: "R3 not authored for this unit",
      },
      { projection: "equation", anchor: "eq-bm-04", verdict: "unchanged" },
      { projection: "instrument", anchor: "lab-bm-01", verdict: "unchanged" },
      {
        projection: "results-card",
        anchor: "card-bm-01",
        verdict: "unchanged",
      },
      { projection: "print", anchor: "print-bm-ch4", verdict: "unchanged" },
      { projection: "accessible", anchor: "table-bm-01", verdict: "unchanged" },
      { projection: "tour", anchor: "tour-bm-fifteen", verdict: "absent" },
    ],
    findings: [],
    outcome: "accepted",
  };
}

describe("crossProjectionRecord", () => {
  it("validates a complete well-formed cross-projection fixture record", () => {
    const raw = getValidCrossProjectionRecord();
    const validated = validateCrossProjectionRecord(raw, {
      ownersRegistry: registry,
    });
    assert.equal(validated.id, "xproj-bm-01");
    assert.equal(validated.projections.length, 11);
    assert.equal(validated.findings.length, 0);
    assert.equal(validated.outcome, "accepted");
  });

  it("fails when missing the seventh projection (instrument)", () => {
    const raw = getValidCrossProjectionRecord();
    raw.projections = (raw.projections as Array<{ projection: string }>).filter(
      (p) => p.projection !== "instrument",
    );

    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => {
        return (
          err instanceof ReviewValidationError &&
          err.code === "missing-required-projection" &&
          err.message.includes("instrument")
        );
      },
    );
  });

  it("fails on absent verdict for equation, but passes for reading-r3", () => {
    const raw = getValidCrossProjectionRecord();
    // Put absent on equation
    raw.projections = (raw.projections as Array<{ projection: string; verdict: string }>).map(
      (p) => (p.projection === "equation" ? { ...p, verdict: "absent" } : p),
    );

    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => {
        return err instanceof ReviewValidationError && err.code === "invalid-absent-verdict";
      },
    );
  });

  it("fails when weakened or strengthened verdict has no matching finding", () => {
    const raw = getValidCrossProjectionRecord();
    raw.projections = (raw.projections as Array<{ projection: string; verdict: string }>).map(
      (p) => (p.projection === "reading-r0" ? { ...p, verdict: "weakened" } : p),
    );

    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => {
        return err instanceof ReviewValidationError && err.code === "missing-verdict-finding";
      },
    );
  });

  it("fails when finding has invalid kind not in closed set", () => {
    const raw = getValidCrossProjectionRecord();
    raw.projections = (raw.projections as Array<{ projection: string; verdict: string }>).map(
      (p) => (p.projection === "reading-r0" ? { ...p, verdict: "weakened" } : p),
    );
    raw.outcome = "findings-open";
    raw.findings = [
      {
        projection: "reading-r0",
        anchor: "read-r0-s4",
        kind: "typo", // Not in closed set!
        description: "Small typo in text",
        owningBeadId: "am-bm-readings-s4-s5-uqbb",
      },
    ];

    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => {
        return err instanceof ReviewValidationError && err.code === "invalid-finding-kind";
      },
    );
  });

  it("fails when finding has invalid owningBeadId format", () => {
    const raw = getValidCrossProjectionRecord();
    raw.projections = (raw.projections as Array<{ projection: string; verdict: string }>).map(
      (p) => (p.projection === "reading-r0" ? { ...p, verdict: "weakened" } : p),
    );
    raw.outcome = "findings-open";
    raw.findings = [
      {
        projection: "reading-r0",
        anchor: "read-r0-s4",
        kind: "qualification-dropped",
        description: "Dropped heuristic qualifier",
        owningBeadId: "INVALID_BEAD_ID", // Invalid bead ID
      },
    ];

    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => {
        return err instanceof ReviewValidationError && err.code === "invalid-owning-bead-id";
      },
    );
  });
});
