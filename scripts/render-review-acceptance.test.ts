import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";
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

    expect(rendered).toContain("### Verified Review Records");
    expect(rendered).toContain("Dr. Hans Schmidt (`rev-de-1`)");
    expect(rendered).toContain("`german-source`");
    expect(rendered).toContain("`accepted`");
    expect(rendered).toContain("### Translation & Editorial Credits");
    expect(rendered).toContain("- **translator**: Dr. Sarah Jenkins (`trans-1`)");
    expect(rendered).toContain("- **checking-editor**: Prof. Robert Meyer (`check-1`)");
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
    expect(result.prefixSha256).toBeDefined();
    expect(result.suffixSha256).toBeDefined();

    // Verify written receipt passes checkReceipt
    const updatedContent = fs.readFileSync(targetReceiptCopy, "utf8");
    expect(updatedContent).toContain("### Verified Review Records");
    expect(updatedContent).toContain("Dr. Hans Schmidt");

    const checkRes = checkReceipt(updatedContent, targetReceiptCopy);
    expect(checkRes.errors.length).toBe(0);
  });

  it("refuses to write and throws GeneratedSectionError if markers are missing", () => {
    const logRunId = `test-err-${Date.now()}`;
    const logDir = path.join("artifacts", "test-logs", "review-records", logRunId);
    fs.mkdirSync(logDir, { recursive: true });

    const noMarkersFile = path.join(logDir, "no-markers.md");
    fs.writeFileSync(noMarkersFile, "# Title\n\nNo markers here\n", "utf8");

    expect(() => updateReceiptEditorialAcceptanceSync(noMarkersFile, [], registry)).toThrow(
      GeneratedSectionError,
    );
  });
});
