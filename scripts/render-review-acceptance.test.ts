import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { parseOwners } from "../src/content/owners/parseOwners.ts";
import { checkReceipt } from "../src/content/provenance/checkReceipt.ts";
import { GeneratedSectionError } from "../src/content/provenance/writeGeneratedSection.ts";
import { validateReviewRecord } from "../src/content/schemas/review.ts";
import {
  DEFAULT_PENDING_OWNER,
  renderEditorialAcceptanceContent,
  updateReceiptEditorialAcceptanceSync,
} from "./render-review-acceptance.ts";

const FIXTURE_OWNERS = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| jemanuel | Jeffrey Emanuel | editorial-owner,implementation-owner | light-quanta | assigned | yes | agent:BoldHarbor | 2026-09-16 |
| rev-de-1 | Dr. Hans Schmidt | german-source-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| trans-1 | Dr. Sarah Jenkins | translator | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| check-1 | Prof. Robert Meyer | checking-editor | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
`;

const registry = parseOwners(FIXTURE_OWNERS);

describe("render-review-acceptance", () => {
  it("pure renderer produces golden editorial acceptance content with display names and translation credits", () => {
    const record = validateReviewRecord(
      {
        id: "rev-ap-17-549-01",
        reviewType: "german-source",
        reviewer: "rev-de-1",
        date: "2026-09-16",
        result: "accepted",
        scope: [{ recordId: "s1-p1", translationRevision: 1 }],
        notes: "Diplomatic transcript verified against high-resolution facsimile.",
      },
      { ownersRegistry: registry },
    );

    const rendered = renderEditorialAcceptanceContent([record], registry, {
      credits: [
        { role: "translator", contributorId: "trans-1" },
        { role: "checking-editor", contributorId: "check-1" },
      ],
    });

    assert.equal(rendered.includes("### Verified Review Records"), true);
    assert.equal(
      rendered.includes("German source review: accepted by Dr. Hans Schmidt on 2026-09-16."),
      true,
    );
    assert.equal(rendered.includes("Dr. Hans Schmidt (`rev-de-1`)"), true);
    assert.equal(rendered.includes("`german-source`"), true);
    assert.equal(rendered.includes("`accepted`"), true);
    assert.equal(rendered.includes("### Translation & Editorial Credits"), true);
    assert.equal(rendered.includes("- **translator**: Dr. Sarah Jenkins (`trans-1`)"), true);
    assert.equal(rendered.includes("- **checking-editor**: Prof. Robert Meyer (`check-1`)"), true);
  });

  it("updates receipt in artifacts log directory, preserves prefix/suffix hashes, and passes checkReceipt", () => {
    const logRunId = `test-run-${Date.now()}`;
    const logDir = path.join("artifacts", "test-logs", "review-records", logRunId);
    fs.mkdirSync(logDir, { recursive: true });

    const fixtureReceiptSource = path.join(
      process.cwd(),
      "src",
      "testing",
      "fixtures",
      "provenance",
      "ap-99-001.md",
    );
    const targetReceiptCopy = path.join(logDir, "ap-99-001.md");
    fs.copyFileSync(fixtureReceiptSource, targetReceiptCopy);

    const record = validateReviewRecord(
      {
        id: "rev-ap-99-001-de",
        reviewType: "german-source",
        reviewer: "rev-de-1",
        date: "2026-09-16",
        result: "accepted",
        scope: [{ recordId: "s1", contentRevision: 1 }],
      },
      { ownersRegistry: registry },
    );

    const result = updateReceiptEditorialAcceptanceSync(targetReceiptCopy, [record], registry);
    assert.ok(result.prefixSha256);
    assert.ok(result.suffixSha256);

    // Verify written receipt passes checkReceipt
    const updatedContent = fs.readFileSync(targetReceiptCopy, "utf8");
    assert.equal(updatedContent.includes("### Verified Review Records"), true);
    assert.equal(
      updatedContent.includes("German source review: accepted by Dr. Hans Schmidt on 2026-09-16."),
      true,
    );
    assert.equal(updatedContent.includes("Dr. Hans Schmidt"), true);

    const checkRes = checkReceipt(updatedContent, targetReceiptCopy);
    assert.equal(checkRes.errors.length, 0);

    // Also verify when ledgerStatus is 'reviewed', checkReceipt passes with signed acceptance
    const reviewedReceiptCopy = path.join(logDir, "ap-99-001-reviewed.md");
    const reviewedContentRaw = fs
      .readFileSync(fixtureReceiptSource, "utf8")
      .replace("ledgerStatus: in-progress", "ledgerStatus: reviewed");
    fs.writeFileSync(reviewedReceiptCopy, reviewedContentRaw, "utf8");

    // Before acceptance is rendered, checkReceipt fails with receipt-reviewed-no-acceptance
    const checkBefore = checkReceipt(reviewedContentRaw, reviewedReceiptCopy);
    assert.equal(
      checkBefore.errors.some((e) => e.rule === "receipt-reviewed-no-acceptance"),
      true,
    );

    // After updating acceptance section with signed German review record, checkReceipt passes
    updateReceiptEditorialAcceptanceSync(reviewedReceiptCopy, [record], registry);
    const updatedReviewedContent = fs.readFileSync(reviewedReceiptCopy, "utf8");
    const checkAfter = checkReceipt(updatedReviewedContent, reviewedReceiptCopy);
    assert.equal(checkAfter.errors.length, 0);
  });

  it("refuses to write and throws GeneratedSectionError if markers are missing", () => {
    const logRunId = `test-err-${Date.now()}`;
    const logDir = path.join("artifacts", "test-logs", "review-records", logRunId);
    fs.mkdirSync(logDir, { recursive: true });

    const noMarkersFile = path.join(logDir, "no-markers.md");
    fs.writeFileSync(noMarkersFile, "# Title\n\nNo markers here\n", "utf8");

    assert.throws(
      () => updateReceiptEditorialAcceptanceSync(noMarkersFile, [], registry),
      GeneratedSectionError,
    );
  });
  /**
   * THE EMPTY-RECORD LINE MUST SATISFY THE RECEIPT'S OWN PENDING GRAMMAR (am-edit-review-records-hofz).
   *
   * This is the test whose absence let the renderer ship a line no receipt would accept. It emitted
   * "Status: pending (no review records recorded)." while `parseReceipt.ts` refuses any section
   * containing the text "Status: pending" that does not match
   * `/^Status: pending \(owner: ([a-z0-9-]+)\)$/m` -- so the ONLY output reachable with zero records
   * was one the checker rejects with `receipt-pending-malformed`. Nothing went red because the
   * command had never been run on a real receipt; all six held the markers with nothing between.
   *
   * THE REGEX IS READ OUT OF THE PARSER'S SOURCE, not copied here. A copy is what drifts: the two
   * halves of this defect were a string in one file and a pattern in another, and a third copy in a
   * test would have been one more thing to keep in step rather than a guard against it. If the
   * parser's grammar changes, this test either follows it or fails to find it and says so.
   */
  it("with no records, the rendered line matches parseReceipt's pending grammar", () => {
    const parserSource = fs.readFileSync(
      path.join(import.meta.dirname, "../src/content/provenance/parseReceipt.ts"),
      "utf8",
    );
    const declared = parserSource.match(/sec\.content\.match\(\s*\/(\^Status: pending[^/]*?)\/m\)/);
    assert.ok(
      declared?.[1],
      "could not find the pending grammar in parseReceipt.ts; if it moved, this test must follow it rather than assume a copy",
    );
    const grammar = new RegExp(declared[1], "m");
    // The positive control: the grammar recovered from source must reject the WRONG line, or a
    // pattern that matched anything would make the assertion below meaningless.
    assert.equal(
      grammar.test("Status: pending (no review records recorded)."),
      false,
      "the recovered grammar accepts the malformed line, so it is not the real grammar",
    );

    const rendered = renderEditorialAcceptanceContent([], registry);
    assert.equal(grammar.test(rendered), true, `rendered line does not parse: ${rendered}`);
    assert.match(rendered, /^Status: pending \(owner: am-[a-z0-9-]+\)$/);
  });

  it("the pending owner is overridable, and the default names the bead that owns the absence", () => {
    assert.match(DEFAULT_PENDING_OWNER, /^am-[a-z0-9-]+$/);
    assert.equal(
      renderEditorialAcceptanceContent([], registry),
      `Status: pending (owner: ${DEFAULT_PENDING_OWNER})`,
    );
    assert.equal(
      renderEditorialAcceptanceContent([], registry, { ownerBead: "am-some-other-bead" }),
      "Status: pending (owner: am-some-other-bead)",
    );
  });

  /**
   * EVERY REAL RECEIPT'S ACCEPTANCE BLOCK PARSES, which is the half a unit test on the renderer
   * cannot reach: the renderer can be correct and the files on disk still carry an older line.
   */
  it("all six real receipts carry an acceptance block that parses", () => {
    const dir = path.join(import.meta.dirname, "../docs/provenance");
    const receipts = fs.readdirSync(dir).filter((f) => /^ap-[\d-]+\.md$/.test(f));
    assert.ok(receipts.length >= 6, `expected at least 6 receipts, found ${receipts.length}`);
    const unparsed: string[] = [];
    for (const file of receipts) {
      const text = fs.readFileSync(path.join(dir, file), "utf8");
      const block = text
        .slice(
          text.indexOf("<!-- generated:editorial-acceptance:start -->") +
            "<!-- generated:editorial-acceptance:start -->".length,
          text.indexOf("<!-- generated:editorial-acceptance:end -->"),
        )
        .trim();
      if (!block.includes("Status: pending")) continue;
      if (!/^Status: pending \(owner: [a-z0-9-]+\)$/m.test(block))
        unparsed.push(`${file}: ${block}`);
    }
    console.log(
      `[receipt acceptance] ${receipts.length} receipts examined, ${unparsed.length} with an unparsable pending line`,
    );
    assert.deepEqual(unparsed, []);
  });
});
