/**
 * The German source face's notice is derived from the receipt (am-dl4n criterion 2).
 *
 * The owner ruled "Show it, labelled a draft", declining "Not until reviewed" and "Behind
 * an explicit opt-in". Requirement 2 of that ruling is the one these tests exist for: the
 * wording comes from the receipt and not from a literal in a component, so that a paper
 * becoming genuinely reviewed stops the page calling it a draft WITHOUT anyone editing a
 * component and without anyone remembering to.
 *
 * Every fixture below is a Transcription, which is what the receipt parses to. Nothing
 * here reads a filename or a header line: am-wisq is changing both this tick, and a page
 * that decided what to tell a reader from either would be saying something different by
 * this evening for no editorial reason.
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { Transcription } from "./receiptSchema.ts";
import {
  requiresDraftNotice,
  SourceFaceNoticeError,
  sourceFaceNotice,
} from "./sourceFaceNotice.ts";

/** The shape ap-18-639's receipt actually records, reduced to the fields that decide. */
function draftTranscription(overrides: Partial<Transcription> = {}): Transcription {
  return {
    ocrRuns: [],
    ledgerPath: "public/papers/transcripts/ap-18-639-reviewed.txt",
    ledgerStatus: "in-progress",
    editors: [],
    ...overrides,
    // draftedBy is recorded in the receipts and is not yet on the Transcription type.
    ...({
      draftedBy: [
        {
          id: "agent:LilacValley",
          kind: "model",
          role: "machine-draft-with-hand-correction",
          basis: "Embedded text layer of the pinned scan, corrected against the pinned page images",
        },
      ],
    } as unknown as Partial<Transcription>),
  } as Transcription;
}

test("a machine draft is labelled, and the label names what the receipt says it is", () => {
  const notice = sourceFaceNotice(draftTranscription());
  assert.equal(notice.state, "machine-draft");
  assert.equal(notice.label, "Machine draft, not reviewed");
  // The role is the receipt's, humanised, not a sentence written in this file.
  assert.match(notice.body, /machine draft with hand correction/);
  // The basis the receipt records travels with it, so the notice says HOW it was made.
  assert.match(notice.body, /corrected against the pinned page images/);
  // And it says plainly that nobody has checked it.
  assert.match(notice.body, /No reviewer has checked it/);
  assert.match(notice.body, /in-progress/);
  assert.equal(requiresDraftNotice(draftTranscription()), true);
});

test("THE POINT OF THE WHOLE MODULE: a reviewed receipt stops the draft label by itself", () => {
  // No component is edited, no constant is changed, nobody has to remember. The receipt
  // advancing is the only input. If this ever fails, requirement 2 is not satisfied
  // however good the wording is.
  const reviewed = draftTranscription({
    ledgerStatus: "reviewed",
    editors: [
      { name: "A. Reviewer", role: "german-source-review", pages: "639-641", dates: "2026-10-01" },
    ],
  });
  const notice = sourceFaceNotice(reviewed);
  assert.equal(notice.state, "reviewed");
  assert.equal(notice.label, "");
  assert.equal(notice.body, "");
  assert.deepEqual(notice.reviewers, ["A. Reviewer"]);
  assert.equal(requiresDraftNotice(reviewed), false);
});

test("a contradictory receipt REFUSES rather than letting either field win", () => {
  // Ratified by the orchestrator: ledgerStatus "reviewed" with editors [] is
  // self-contradictory and must fail. Picking a side would mean either a draft rendering
  // as reviewed or a reviewed edition labelled a draft, and both are worse than a loud
  // refusal naming the contradiction. It is also the exact shape of the bug that started
  // am-wisq: a file asserting a review nobody performed.
  const contradictory = draftTranscription({ ledgerStatus: "reviewed", editors: [] });
  assert.throws(
    () => sourceFaceNotice(contradictory),
    (error: unknown) => {
      assert.ok(error instanceof SourceFaceNoticeError, String(error));
      assert.equal(error.code, "receipt-review-state-inconsistent");
      // The message must name BOTH fields, or a reader cannot tell which to correct.
      assert.match(error.message, /ledgerStatus/);
      assert.match(error.message, /editors/);
      return true;
    },
  );
});

test("an editor recorded while the work is unfinished is still a draft, and says so", () => {
  // The other half of the pair above, and not a contradiction: a reviewer can be assigned
  // and partway through. The page must keep the label and must not claim the review is
  // done, so the wording changes rather than disappearing.
  const partway = draftTranscription({
    ledgerStatus: "corrected",
    editors: [
      { name: "A. Reviewer", role: "german-source-review", pages: "639", dates: "2026-10-01" },
    ],
  });
  const notice = sourceFaceNotice(partway);
  assert.equal(notice.state, "machine-draft");
  assert.match(notice.body, /A\. Reviewer/);
  assert.match(notice.body, /Review is not complete/);
  assert.match(notice.body, /corrected/);
});

test("a receipt with no drafter entry still refuses to imply review", () => {
  // draftedBy is absent on some receipts. Its absence must not soften the notice into
  // silence: ledgerStatus and editors alone are enough to say the honest thing, and a
  // missing field is not evidence of review.
  const noDrafter = {
    ocrRuns: [],
    ledgerStatus: "in-progress",
    editors: [],
  } as unknown as Transcription;
  const notice = sourceFaceNotice(noDrafter);
  assert.equal(notice.state, "machine-draft");
  assert.match(notice.body, /has not been reviewed by a human/);
  assert.equal(notice.role, undefined);
});

test("REQUIREMENT 2, DISCRIMINATING: an unforeseeable role still reaches the reader", () => {
  // Every other arm in this file passes against a HARDCODED sentence, and I found that by
  // planting one: replacing `${humanise(role)}` with the literal "machine draft with hand
  // correction" left all seven green, because the fixture's role is exactly what a person
  // hardcoding it would write. A suite that cannot tell derivation from a literal does not
  // hold requirement 2 however carefully it is worded.
  //
  // So this fixture invents a role and a basis nobody would guess. If the wording is ever
  // written into the module instead of read from the receipt, this is the arm that fails.
  const unusual = {
    ocrRuns: [],
    ledgerStatus: "corrected-second-read",
    editors: [],
    draftedBy: [
      {
        id: "agent:Nobody",
        kind: "model",
        role: "plate-scan-retyped-against-microfilm",
        basis: "Retyped from a 1953 microfilm reel held at the Augsburg reading room",
      },
    ],
  } as unknown as Transcription;

  const notice = sourceFaceNotice(unusual);
  assert.equal(notice.state, "machine-draft");
  assert.match(notice.body, /plate scan retyped against microfilm/);
  assert.match(notice.body, /1953 microfilm reel/);
  assert.match(notice.body, /corrected-second-read/);
  assert.equal(notice.role, "plate-scan-retyped-against-microfilm");
  // And the hyphens are gone, so the reader gets a sentence rather than an identifier.
  assert.ok(!notice.body.includes("plate-scan-retyped"), notice.body);
});

test("the notice carries the receipt fields it rests on, so a page cites rather than paraphrases", () => {
  const notice = sourceFaceNotice(draftTranscription());
  assert.equal(notice.ledgerStatus, "in-progress");
  assert.equal(notice.role, "machine-draft-with-hand-correction");
  assert.deepEqual(notice.reviewers, []);
});

test("the real ap-18-639 receipt on disk yields a draft notice", () => {
  // Not a fixture. The fixtures above pin the rules; this pins that the rules apply to
  // the receipt the repository actually ships, so a change to the receipt format cannot
  // leave the rules correct and the corpus unreadable.
  //
  // Imported lazily so the fixture tests above still run if the receipt layout moves.
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  const { parseReceipt } = require("./parseReceipt.ts") as typeof import("./parseReceipt.ts");

  const path = join(process.cwd(), "docs", "provenance", "ap-18-639.md");
  const parsed = parseReceipt(readFileSync(path, "utf8"), path);
  assert.ok(parsed.frontMatter, "the shipped receipt must parse");
  const notice = sourceFaceNotice(parsed.frontMatter.transcription);
  assert.equal(notice.state, "machine-draft");
  assert.equal(notice.role, "machine-draft-with-hand-correction");
  assert.equal(notice.ledgerStatus, "in-progress");
});
