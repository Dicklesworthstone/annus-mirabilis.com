import assert from "node:assert/strict";
import test from "node:test";
import {
  checkNoHorizontalOverflow,
  checkSameSnapshotIdentity,
  compareEssentialPrintText,
  normalizePrintText,
} from "./measure.ts";

test("the overflow predicate from fixed measurements", () => {
  assert.equal(checkNoHorizontalOverflow(320, 320).ok, true);
  assert.equal(checkNoHorizontalOverflow(319, 320).ok, true);
  const overflow = checkNoHorizontalOverflow(321, 320);
  assert.equal(overflow.ok, false);
  assert.equal(overflow.overflowPx, 1);
  // Deliberately no +1 fudge factor: the harness's own acceptance criteria
  // are frozen at `scrollWidth <= clientWidth`, stricter than some existing
  // product-page checks elsewhere in the repository.
  assert.equal(checkNoHorizontalOverflow(321, 320).ok, false);
});

test("normalizePrintText collapses whitespace and trims", () => {
  assert.equal(normalizePrintText("  a\n\nb\t c  "), "a b c");
  assert.equal(normalizePrintText("single"), "single");
});

test("the print-text normalizer and comparison against fixed HTML and PDF text", () => {
  const htmlText = "The molecular-kinetic theory of heat requires\nthis motion.";
  const pdfMatching = "The molecular-kinetic theory of heat requires this motion.";
  const pdfClipped = "The molecular-kinetic theory of heat requires";
  assert.equal(compareEssentialPrintText(htmlText, pdfMatching).ok, true);
  const clippedResult = compareEssentialPrintText(htmlText, pdfClipped);
  assert.equal(clippedResult.ok, false);
  assert.equal(clippedResult.normalizedHtml, "The molecular-kinetic theory of heat requires this motion.");
  assert.equal(clippedResult.normalizedPdf, "The molecular-kinetic theory of heat requires");
});

test("the snapshot-identity comparison across views from fixed attribute sets", () => {
  const consistent = [
    { view: "trace", instanceId: "inst-1", runId: "run-1", snapshotVersion: "3" },
    { view: "table", instanceId: "inst-1", runId: "run-1", snapshotVersion: "3" },
    { view: "accessible-description", instanceId: "inst-1", runId: "run-1", snapshotVersion: "3" },
  ];
  assert.deepEqual(checkSameSnapshotIdentity(consistent), { ok: true, mismatches: [] });

  const mismatched = [
    { view: "trace", instanceId: "inst-1", runId: "run-1", snapshotVersion: "3" },
    { view: "table", instanceId: "inst-1", runId: "run-1", snapshotVersion: "4" },
  ];
  const result = checkSameSnapshotIdentity(mismatched);
  assert.equal(result.ok, false);
  assert.equal(result.mismatches.length, 1);
  assert.match(result.mismatches[0] ?? "", /view "table" has snapshotVersion 4, expected 3/);

  assert.equal(checkSameSnapshotIdentity([]).ok, false);
});
