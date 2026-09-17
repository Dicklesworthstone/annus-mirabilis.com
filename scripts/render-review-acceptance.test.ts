import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { parseOwners } from "../src/content/owners/parseOwners.ts";
import { checkReceipt } from "../src/content/provenance/checkReceipt.ts";
import { GeneratedSectionError } from "../src/content/provenance/writeGeneratedSection.ts";
import { validateReviewRecord } from "../src/content/schemas/review.ts";
import {
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
      updatedContent.includes(
        "German source review: accepted by Dr. Hans Schmidt on 2026-09-16.",
      ),
      true,
    );
    assert.equal(updatedContent.includes("Dr. Hans Schmidt"), true);

    const checkRes = checkReceipt(updatedContent, targetReceiptCopy);
    assert.equal(checkRes.errors.length, 0);

    // Also verify when ledgerStatus is 'reviewed', checkReceipt passes with signed acceptance
    const reviewedReceiptCopy = path.join(logDir, "ap-99-001-reviewed.md");
    const reviewedContentRaw = fs.readFileSync(fixtureReceiptSource, "utf8")
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
});
