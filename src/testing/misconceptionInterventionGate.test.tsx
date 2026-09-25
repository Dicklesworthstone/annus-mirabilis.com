import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReviewRecord } from "../content/schemas/review.ts";
import {
  fixtureHalvingDiffusivity,
  fixtureStaticTreatmentOnly,
} from "../reader/misconceptions/fixtures.ts";
import {
  checkIntervention,
  interventionBlocksBuild,
  interventionStatusForRender,
} from "../reader/misconceptions/interventionGate.ts";
import { MisconceptionCallout } from "../reader/misconceptions/MisconceptionCallout.tsx";

/**
 * am-read-misconception-callouts-a3o's publication gate, composed from the real ReviewRecord
 * types (src/content/schemas/review.ts) rather than a second review-record system.
 */
function acceptedRecord(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: "rr-misc-halving-diffusivity",
    reviewType: "physics-math",
    reviewer: "reviewer-1",
    scope: [
      { recordId: "misc-halving-diffusivity-halves-displacement" },
      { recordId: "bm-06", contentRevision: 3 },
    ],
    date: "2026-01-01",
    result: "accepted",
    ...overrides,
  } as ReviewRecord;
}

describe("checkIntervention", () => {
  test("ok:true when the named record is accepted and its scope covers the misconception", () => {
    const verdict = checkIntervention(fixtureHalvingDiffusivity, [acceptedRecord()]);
    expect(verdict.ok).toBe(true);
  });

  test("ok:true (accepted-with-changes counts as accepted)", () => {
    const verdict = checkIntervention(fixtureHalvingDiffusivity, [
      acceptedRecord({ result: "accepted-with-changes" }),
    ]);
    expect(verdict.ok).toBe(true);
  });

  test("intervention-review-record-not-found when reviewRecordId resolves to nothing", () => {
    const verdict = checkIntervention(fixtureHalvingDiffusivity, []);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.code).toBe("intervention-review-record-not-found");
      expect(verdict.message).toContain("misc-halving-diffusivity-halves-displacement");
      expect(verdict.message).toContain("rr-misc-halving-diffusivity");
    }
  });

  test("intervention-review-record-not-accepted for rejected, needs-rereview, or wrong id", () => {
    for (const result of ["rejected", "needs-rereview"] as const) {
      const verdict = checkIntervention(fixtureHalvingDiffusivity, [acceptedRecord({ result })]);
      expect(verdict.ok).toBe(false);
      if (!verdict.ok) expect(verdict.code).toBe("intervention-review-record-not-accepted");
    }
  });

  test("intervention-review-record-stale when the record's scope omits the misconception itself", () => {
    const verdict = checkIntervention(fixtureHalvingDiffusivity, [
      acceptedRecord({ scope: [{ recordId: "bm-06", contentRevision: 3 }] }),
    ]);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.code).toBe("intervention-review-record-stale");
  });

  test("intervention-review-record-stale when the record does not cover the instrument's current manifest revision", () => {
    const verdict = checkIntervention(
      fixtureHalvingDiffusivity,
      [
        acceptedRecord({
          scope: [
            { recordId: "misc-halving-diffusivity-halves-displacement" },
            { recordId: "bm-06", contentRevision: 3 },
          ],
        }),
      ],
      4, // manifest has moved to revision 4; the record only covers revision 3
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.code).toBe("intervention-review-record-stale");
      expect(verdict.instrumentId).toBe("bm-06");
    }
  });

  test("covering the instrument's current manifest revision (by contentRevision or modelVersion) passes", () => {
    const byContentRevision = checkIntervention(fixtureHalvingDiffusivity, [acceptedRecord()], 3);
    expect(byContentRevision.ok).toBe(true);

    const byModelVersion = checkIntervention(
      fixtureHalvingDiffusivity,
      [
        acceptedRecord({
          scope: [
            { recordId: "misc-halving-diffusivity-halves-displacement" },
            { recordId: "bm-06", modelVersion: "v7" },
          ],
        }),
      ],
      "v7",
    );
    expect(byModelVersion.ok).toBe(true);
  });

  test("a staticTreatment entry (no instrument) never needs a manifest revision", () => {
    const verdict = checkIntervention(fixtureStaticTreatmentOnly, [
      acceptedRecord({
        id: "rr-misc-molecular-number",
        scope: [{ recordId: "misc-molecular-number-is-a-single-molecule-count" }],
      }),
    ]);
    expect(verdict.ok).toBe(true);
  });
});

describe("interventionBlocksBuild", () => {
  const badVerdict = checkIntervention(fixtureHalvingDiffusivity, []);

  test("a failing verdict blocks production and preview builds", () => {
    expect(interventionBlocksBuild(badVerdict, "production")).toBe(true);
    expect(interventionBlocksBuild(badVerdict, "preview")).toBe(true);
  });

  test("a failing verdict never blocks a draft build -- the caller shows the marker instead", () => {
    expect(interventionBlocksBuild(badVerdict, "draft")).toBe(false);
  });

  test("a passing verdict never blocks any build profile", () => {
    const goodVerdict = checkIntervention(fixtureHalvingDiffusivity, [acceptedRecord()]);
    expect(interventionBlocksBuild(goodVerdict, "production")).toBe(false);
    expect(interventionBlocksBuild(goodVerdict, "preview")).toBe(false);
    expect(interventionBlocksBuild(goodVerdict, "draft")).toBe(false);
  });
});

describe("interventionStatusForRender: the gate verdict reaches the rendered marker", () => {
  test("a failing verdict maps to not-yet-reviewed", () => {
    const badVerdict = checkIntervention(fixtureHalvingDiffusivity, []);
    expect(interventionStatusForRender(badVerdict)).toEqual({ state: "not-yet-reviewed" });
  });

  test("a passing verdict maps to reviewed", () => {
    const goodVerdict = checkIntervention(fixtureHalvingDiffusivity, [acceptedRecord()]);
    expect(interventionStatusForRender(goodVerdict)).toEqual({ state: "reviewed" });
  });

  test("end to end: a fixture with a stale reviewRecordId renders the draft marker in MisconceptionCallout", () => {
    // Acceptance criterion: "A fixture entry whose reviewRecordId is absent, stale, or not
    // accepted fails the publication gate and renders the draft marker in a draft build." This
    // wires checkIntervention -> interventionStatusForRender -> the real component, rather than
    // asserting the two halves separately and trusting they compose.
    const verdict = checkIntervention(fixtureHalvingDiffusivity, []); // no records at all: not-found
    expect(verdict.ok).toBe(false);
    expect(interventionBlocksBuild(verdict, "draft")).toBe(false); // draft never fails the build

    const markup = renderToStaticMarkup(
      <MisconceptionCallout
        misconception={fixtureHalvingDiffusivity}
        detail={1}
        modernLens={false}
        interventionStatus={interventionStatusForRender(verdict)}
        instrumentHref="/instruments/bm-06"
      />,
    );
    // The verdict reaches the markup as data; its words are not shown
    // (D-2026-09-25-no-review-status-banners).
    expect(markup).toContain('data-intervention-status="not-yet-reviewed"');
    expect(markup).not.toContain("not yet reviewed");
  });

  test("end to end: an accepted, covering record renders no marker at all", () => {
    const verdict = checkIntervention(fixtureHalvingDiffusivity, [acceptedRecord()]);
    expect(verdict.ok).toBe(true);
    const markup = renderToStaticMarkup(
      <MisconceptionCallout
        misconception={fixtureHalvingDiffusivity}
        detail={1}
        modernLens={false}
        interventionStatus={interventionStatusForRender(verdict)}
        instrumentHref="/instruments/bm-06"
      />,
    );
    expect(markup).not.toContain("data-intervention-status");
  });
});
