import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { auditPinnedAssets } from "../audits/pinnedAssets.ts";
import { checkReceipt } from "./checkReceipt.ts";
import { loadProvenanceReceipts } from "./loadReceipts.ts";
import { liveTypographicalErrors, resolveEquationPage } from "./receiptSchema.ts";
import { receiptToSourceAsset } from "./receiptToSourceAsset.ts";
import { validateSurveyRecord } from "./surveySchema.ts";
import { GeneratedSectionError, replaceGeneratedContent } from "./writeGeneratedSection.ts";

const FIXTURES_DIR = path.resolve("src/testing/fixtures/provenance");
const CONFIG_DIR = path.join(FIXTURES_DIR, "facsimile-sources");
const LOCAL_FILES_ROOT = path.join(FIXTURES_DIR, "local-files");

test("ap-99-001.md valid receipt passes checker and matches SourceAsset golden", () => {
  const filePath = path.join(FIXTURES_DIR, "ap-99-001.md");
  const content = fs.readFileSync(filePath, "utf8");
  const result = checkReceipt(content, filePath, { configDir: CONFIG_DIR });

  assert.equal(result.ok, true, `Expected ok=true, got errors: ${JSON.stringify(result.errors)}`);
  assert.equal(result.errors.length, 0);
  assert.ok(result.receipt, "Expected receipt to be present");

  const asset = receiptToSourceAsset(result.receipt);
  const goldenPath = path.join(FIXTURES_DIR, "ap-99-001.source-asset.golden.json");
  const golden = JSON.parse(fs.readFileSync(goldenPath, "utf8"));
  assert.deepEqual(asset, golden);
});

test("ap-17-549.md valid Brownian motion receipt with month-precision date-line passes", () => {
  const filePath = path.join(FIXTURES_DIR, "ap-17-549.md");
  const content = fs.readFileSync(filePath, "utf8");
  const result = checkReceipt(content, filePath);

  assert.equal(result.ok, true, `Expected ok=true, got errors: ${JSON.stringify(result.errors)}`);
  assert.equal(result.errors.length, 0);
  assert.equal(result.receipt?.frontMatter.paper.journal.pages.first, 549);
  assert.equal(result.receipt?.frontMatter.paper.journal.pages.last, 560);
});

/**
 * The acceptance arm of the declared-heading set (am-p465).
 *
 * A fix that only demonstrated the new refusals would be satisfied by a rule that rejected every
 * receipt. This fixture is the valid receipt plus the reviewer-handoff section, and it must PASS:
 * the section is admitted because it is declared, which is the whole point of replacing the count
 * rather than relaxing it. The three receipts in the repository that carry no handoff still pass
 * too, because the heading is declared as permitted rather than required.
 */
test("valid-reviewer-questions.md passes: a declared handoff section is admitted", () => {
  const filePath = path.join(FIXTURES_DIR, "valid-reviewer-questions.md");
  const content = fs.readFileSync(filePath, "utf8");
  const result = checkReceipt(content, filePath, { configDir: CONFIG_DIR });

  assert.equal(result.ok, true, `Expected ok=true, got errors: ${JSON.stringify(result.errors)}`);
  assert.equal(
    result.errors.filter((e) => e.rule.startsWith("receipt-headings")).length,
    0,
    "the declared handoff heading must not raise a headings diagnostic",
  );
});

test("ap-99-001-refined.md refined page map passes and resolves equation ID to page", () => {
  const filePath = path.join(FIXTURES_DIR, "ap-99-001-refined.md");
  const content = fs.readFileSync(filePath, "utf8");
  const result = checkReceipt(content, filePath, { configDir: CONFIG_DIR });

  assert.equal(result.ok, true, `Expected ok=true, got errors: ${JSON.stringify(result.errors)}`);
  assert.ok(result.receipt, "Expected receipt to be present");
  const pageMap = result.receipt.frontMatter.pageMap;

  // Resolve eq-s4-d2 to its PDF page index (page 2)
  const resolvedPage = resolveEquationPage(pageMap, "eq-s4-d2");
  assert.equal(resolvedPage, 2);

  const resolvedNumbered = resolveEquationPage(pageMap, "(1)");
  assert.equal(resolvedNumbered, 1);

  const notFound = resolveEquationPage(pageMap, "eq-s99-d99");
  assert.equal(notFound, null);
});

test("Rights vocabulary mapping: source-terms and public-domain-image credit", () => {
  const stPath = path.join(FIXTURES_DIR, "valid-source-terms.md");
  const stContent = fs.readFileSync(stPath, "utf8");
  const stResult = checkReceipt(stContent, stPath);
  assert.equal(stResult.ok, true);
  assert.ok(stResult.receipt, "Expected receipt to be present");
  const stAsset = receiptToSourceAsset(stResult.receipt);
  assert.equal(stAsset.rights.reuseTerms, "source-terms");
  assert.match(stAsset.rights.statement, /Quoted third-party source repository terms/);

  const pdPath = path.join(FIXTURES_DIR, "valid-pd-image.md");
  const pdContent = fs.readFileSync(pdPath, "utf8");
  const pdResult = checkReceipt(pdContent, pdPath);
  assert.equal(pdResult.ok, true);
  assert.ok(pdResult.receipt, "Expected receipt to be present");
  const pdAsset = receiptToSourceAsset(pdResult.receipt);
  assert.equal(pdAsset.rights.credit, "State Library Archive / Photographed by J. Doe (1905)");
});

// Error tests
const errorTestCases = [
  { file: "err-uppercase-digest.md", rule: "receipt-scan-sha256-invalid" },
  { file: "err-short-digest.md", rule: "receipt-scan-sha256-invalid" },
  { file: "err-untyped-date.md", rule: "receipt-date-iso" },
  {
    file: "err-chronology-pub-before-rec.md",
    rule: "receipt-chronology-published-before-received",
  },
  {
    file: "err-chronology-rec-before-dateline.md",
    rule: "receipt-chronology-received-before-dateline",
  },
  { file: "err-invalid-doi.md", rule: "receipt-journal-doi-invalid" },
  { file: "err-invalid-rights-status.md", rule: "receipt-rights-status-invalid" },
  { file: "err-scan-restrict-publish.md", rule: "receipt-rights-restrict-publish" },
  { file: "err-publish-path-invalid.md", rule: "receipt-publish-path" },
  {
    file: "err-scan-digest-mismatch.md",
    rule: "receipt-config-digest-mismatch",
    options: { configDir: CONFIG_DIR },
  },
  {
    file: "err-no-config-record.md",
    rule: "receipt-config-missing",
    options: { configDir: CONFIG_DIR },
  },
  { file: "err-page-map-missing-page.md", rule: "receipt-pagemap-missing-page" },
  { file: "err-page-map-duplicate-page.md", rule: "receipt-pagemap-duplicate-index" },
  { file: "err-page-map-decreasing-pages.md", rule: "receipt-pagemap-decreasing-pages" },
  { file: "err-page-map-contents-invalid.md", rule: "receipt-pagemap-contents-invalid" },
  { file: "err-other-article-with-sections.md", rule: "receipt-pagemap-other-article-sections" },
  { file: "err-refined-still-has-unnumbered.md", rule: "receipt-pagemap-refined-has-unnumbered" },
  {
    file: "err-refined-shorter-unnumbered-ids.md",
    rule: "receipt-pagemap-refined-no-unnumbered-ids",
  },
  { file: "err-witness-no-wikisource.md", rule: "receipt-witness-missing-wikisource" },
  { file: "err-witness-no-cpae.md", rule: "receipt-witness-missing-cpae" },
  { file: "err-headings-out-of-order.md", rule: "receipt-headings-order" },
  { file: "err-malformed-pending.md", rule: "receipt-pending-malformed" },
  { file: "err-unbalanced-markers.md", rule: "receipt-generated-markers" },
  { file: "err-reviewed-no-acceptance.md", rule: "receipt-reviewed-no-acceptance" },
  { file: "err-reviewed-pending-watchlist.md", rule: "receipt-reviewed-pending-watchlist" },
  { file: "err-reviewed-acceptance-unsigned.md", rule: "receipt-reviewed-acceptance-unsigned" },
  { file: "err-scan-sha256-missing.md", rule: "receipt-scan-sha256-invalid" },
  { file: "err-ledger-pdf-sha-mismatch.md", rule: "receipt-ledger-source-pdf-sha256-mismatch" },
  { file: "err-typo-no-evidence.md", rule: "receipt-typo-no-evidence" },
  { file: "err-tool-run-id-invalid.md", rule: "receipt-tool-run-id-invalid" },
  { file: "err-tool-run-id-duplicate.md", rule: "receipt-tool-run-id-duplicate" },
  { file: "err-fifth-reuse-terms.md", rule: "receipt-reuse-terms-invalid" },
  { file: "err-local-only-named-license.md", rule: "receipt-nonpublish-no-reuse" },
  { file: "err-pd-image-no-credit.md", rule: "receipt-image-credit-required" },
  { file: "err-pin-local-path-invalid.md", rule: "receipt-pin-local-path" },
  { file: "err-named-license-no-source.md", rule: "receipt-named-license-source-required" },
  {
    file: "err-config-pagecount-mismatch.md",
    rule: "receipt-config-pagecount-mismatch",
    options: { configDir: CONFIG_DIR },
  },
  {
    file: "err-config-origin-url-mismatch.md",
    rule: "receipt-config-origin-url-mismatch",
    options: { configDir: CONFIG_DIR },
  },
  {
    file: "err-config-acquisition-date-mismatch.md",
    rule: "receipt-config-acquisition-date-mismatch",
    options: { configDir: CONFIG_DIR },
  },
  {
    file: "err-config-rights-mismatch.md",
    rule: "receipt-config-rights-mismatch",
    options: { configDir: CONFIG_DIR },
  },
  { file: "err-unknown-top-level-key.md", rule: "receipt-unknown-top-level-key" },
  { file: "err-journal-first-page-mismatch.md", rule: "receipt-journal-first-page" },
  { file: "err-parent-sha256-invalid.md", rule: "receipt-parent-sha256-invalid" },
  {
    file: "err-ledger-source-pdf-sha256-invalid.md",
    rule: "receipt-ledger-source-pdf-sha256-invalid",
  },
  { file: "err-date-verified-missing.md", rule: "receipt-date-verified" },
  { file: "err-journal-doi-verified-missing.md", rule: "receipt-journal-doi-verified" },
  { file: "err-pagemap-count-mismatch.md", rule: "receipt-pagemap-count" },
  { file: "err-pagemap-index-invalid.md", rule: "receipt-pagemap-index" },
  { file: "err-pagemap-printed-page-range.md", rule: "receipt-pagemap-printed-page-range" },
  { file: "err-pagemap-printed-page-missing.md", rule: "receipt-pagemap-printed-page" },
  // The declared-heading set, both refusals. The rule this replaced was "exactly N level-2
  // headings", which could not say WHICH heading was wrong: dropping one required section and
  // adding anything in its place passed at the same count. These two fixtures are that pair.
  { file: "err-headings-missing-declared.md", rule: "receipt-headings-mismatch" },
  { file: "err-headings-undeclared.md", rule: "receipt-headings-mismatch" },
  // THE ONE THAT PROVES THE REPLACEMENT. This receipt drops a required section and puts an
  // arbitrary one in its place, so the heading COUNT is unchanged and the old rule passed it
  // outright. Only a named set can see it. Restoring the count turns exactly this case and the
  // acceptance test green-to-red in opposite directions.
  { file: "err-headings-swapped-same-count.md", rule: "receipt-headings-mismatch" },
];

for (const tc of errorTestCases) {
  test(`Checker fails on ${tc.file} with rule ${tc.rule}`, () => {
    const filePath = path.join(FIXTURES_DIR, tc.file);
    const content = fs.readFileSync(filePath, "utf8");
    const result = checkReceipt(content, filePath, tc.options);

    assert.equal(result.ok, false, `Expected check failure for ${tc.file}`);
    const foundRule = result.errors.some((e) => e.rule === tc.rule);
    assert.equal(
      foundRule,
      true,
      `Expected error rule "${tc.rule}", found: ${result.errors.map((e) => e.rule).join(", ")}`,
    );
  });
}

test("Checker fails when key does not match filename basename", () => {
  const content = fs.readFileSync(path.join(FIXTURES_DIR, "ap-99-001.md"), "utf8");
  const result = checkReceipt(content, "docs/provenance/ap-99-002.md");
  assert.equal(result.ok, false);
  assert.equal(
    result.errors.some((e) => e.rule === "receipt-key-filename-mismatch"),
    true,
  );
});

// Flag tests
test("Flags: pending section is reported as flag, not fatal error", () => {
  const filePath = path.join(FIXTURES_DIR, "flag-pending-section.md");
  const content = fs.readFileSync(filePath, "utf8");
  const result = checkReceipt(content, filePath, { configDir: CONFIG_DIR });

  assert.equal(result.ok, true);
  assert.equal(
    result.flags.some((f) => f.rule === "receipt-section-pending"),
    true,
  );
});

test("Flags: pending watch list item under in-progress status is reported as flag", () => {
  const filePath = path.join(FIXTURES_DIR, "flag-pending-watchlist-in-progress.md");
  const content = fs.readFileSync(filePath, "utf8");
  const result = checkReceipt(content, filePath, { configDir: CONFIG_DIR });

  assert.equal(result.ok, true);
  assert.equal(
    result.flags.some((f) => f.rule === "receipt-watchlist-pending"),
    true,
  );
});

test("Flags: absent local-only file is reported as flag, but escalates to error under requireLocal", () => {
  const filePath = path.join(FIXTURES_DIR, "flag-absent-local-only.md");
  const content = fs.readFileSync(filePath, "utf8");

  // Default: flag
  const resFlag = checkReceipt(content, filePath);
  assert.equal(resFlag.ok, true);
  assert.equal(
    resFlag.flags.some((f) => f.rule === "receipt-local-file-not-available"),
    true,
  );

  // With requireLocal: error
  const resErr = checkReceipt(content, filePath, { requireLocal: true });
  assert.equal(resErr.ok, false);
  assert.equal(
    resErr.errors.some((e) => e.rule === "receipt-local-file-missing"),
    true,
  );
});

// A receipt cannot be produced for a source that was never pinned: a missing or mismatched
// SHA-256 against the ACTUAL bytes on disk refuses, paired with the matching digest passing, so
// the assertion discriminates rather than merely rejecting (am-src-receipt-format-npo5).
test("A pin-local-only receipt whose actual local file digest disagrees with scan.sha256 refuses", () => {
  const filePath = path.join(FIXTURES_DIR, "err-local-file-digest-mismatch.md");
  const content = fs.readFileSync(filePath, "utf8");
  const result = checkReceipt(content, filePath, { rootDir: LOCAL_FILES_ROOT });

  assert.equal(result.ok, false, "expected the digest disagreement to refuse the receipt");
  assert.equal(
    result.errors.some((e) => e.rule === "receipt-local-file-digest-mismatch"),
    true,
    `expected rule "receipt-local-file-digest-mismatch", found: ${result.errors.map((e) => e.rule).join(", ")}`,
  );
});

test("The SAME local file, with scan.sha256 set to its real digest, passes -- proving the check discriminates", () => {
  const filePath = path.join(FIXTURES_DIR, "valid-local-file-digest-match.md");
  const content = fs.readFileSync(filePath, "utf8");
  const result = checkReceipt(content, filePath, { rootDir: LOCAL_FILES_ROOT });

  assert.equal(result.ok, true, `Expected ok=true, got errors: ${JSON.stringify(result.errors)}`);
  assert.equal(
    result.errors.some((e) => e.rule === "receipt-local-file-digest-mismatch"),
    false,
  );
});

// AGENTS.md treats reviewer identity as a human gate: acceptance is recorded with reviewer names,
// never signed by the machinery itself. "accepted." alone satisfies the old trigger-word check but
// names no human and no when; naming a reviewer and an ISO date is what makes it a human signature
// rather than a confident-looking record (am-src-receipt-format-npo5).
test("A reviewed receipt whose acceptance section names no reviewer and no date refuses (paired with err-reviewed-acceptance-unsigned.md above)", () => {
  const filePath = path.join(FIXTURES_DIR, "err-reviewed-acceptance-unsigned.md");
  const content = fs.readFileSync(filePath, "utf8");
  const result = checkReceipt(content, filePath);
  assert.equal(result.ok, false);
  assert.equal(
    result.errors.some((e) => e.rule === "receipt-reviewed-acceptance-unsigned"),
    true,
  );
});

test("The SAME reviewed receipt, with the acceptance section naming a reviewer and an ISO date, passes cleanly", () => {
  const filePath = path.join(FIXTURES_DIR, "valid-reviewed-with-acceptance.md");
  const content = fs.readFileSync(filePath, "utf8");
  const result = checkReceipt(content, filePath);
  assert.equal(result.ok, true, `Expected ok=true, got errors: ${JSON.stringify(result.errors)}`);
  assert.equal(
    result.errors.some((e) => e.rule === "receipt-reviewed-acceptance-unsigned"),
    false,
  );
  assert.equal(
    result.errors.some((e) => e.rule === "receipt-reviewed-no-acceptance"),
    false,
  );
});

// writeGeneratedSection tests
test("writeGeneratedSection replaces content and preserves prefix/suffix bytes unchanged", () => {
  const sample = `# Header\n\n<!-- generated:editorial-acceptance:start -->\nOld text\n<!-- generated:editorial-acceptance:end -->\n\n# Footer\n`;
  const newContent = "German source review: accepted by Reviewer on 2026-09-15.";

  const { updatedText, prefixSha256, suffixSha256 } = replaceGeneratedContent(
    sample,
    "editorial-acceptance",
    newContent,
  );

  assert.match(updatedText, /German source review: accepted/);
  assert.doesNotMatch(updatedText, /Old text/);

  // Check prefix and suffix hash
  const origPrefix = sample.slice(
    0,
    sample.indexOf("<!-- generated:editorial-acceptance:start -->") +
      "<!-- generated:editorial-acceptance:start -->".length,
  );
  const origSuffix = sample.slice(sample.indexOf("<!-- generated:editorial-acceptance:end -->"));
  assert.equal(crypto.createHash("sha256").update(origPrefix).digest("hex"), prefixSha256);
  assert.equal(crypto.createHash("sha256").update(origSuffix).digest("hex"), suffixSha256);
});

test("writeGeneratedSection refuses missing or duplicated markers", () => {
  assert.throws(
    () => replaceGeneratedContent("# No markers", "editorial-acceptance", "test"),
    GeneratedSectionError,
  );

  const duplicateStart = `<!-- generated:test:start -->\n<!-- generated:test:start -->\n<!-- generated:test:end -->`;
  assert.throws(
    () => replaceGeneratedContent(duplicateStart, "test", "content"),
    GeneratedSectionError,
  );
});

// Survey validation tests
test("Survey schema validates survey-valid.md", () => {
  const content = fs.readFileSync(path.join(FIXTURES_DIR, "survey-valid.md"), "utf8");
  const result = validateSurveyRecord(content, "docs/provenance/survey/ap-17-549.md");
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics.length, 0);
});

test("Survey schema catches candidate without terms or termsNotFound", () => {
  const content = fs.readFileSync(path.join(FIXTURES_DIR, "err-survey-no-terms.md"), "utf8");
  const result = validateSurveyRecord(content, "err-survey-no-terms.md");
  assert.equal(result.ok, false);
  assert.equal(
    result.diagnostics.some((d) => d.rule === "survey-candidate-terms"),
    true,
  );
});

test("Survey schema catches invalid proposed status", () => {
  const content = fs.readFileSync(path.join(FIXTURES_DIR, "err-survey-invalid-status.md"), "utf8");
  const result = validateSurveyRecord(content, "err-survey-invalid-status.md");
  assert.equal(result.ok, false);
  assert.equal(
    result.diagnostics.some((d) => d.rule === "survey-rights-status"),
    true,
  );
});

test("Survey schema catches recommendation naming missing candidate", () => {
  const content = fs.readFileSync(
    path.join(FIXTURES_DIR, "err-survey-missing-candidate-rec.md"),
    "utf8",
  );
  const result = validateSurveyRecord(content, "err-survey-missing-candidate-rec.md");
  assert.equal(result.ok, false);
  assert.equal(
    result.diagnostics.some((d) => d.rule === "survey-recommendation-candidate"),
    true,
  );
});

test("Survey schema catches unknown classification absent from openQuestionsForUser", () => {
  const content = fs.readFileSync(
    path.join(FIXTURES_DIR, "err-survey-unknown-not-in-questions.md"),
    "utf8",
  );
  const result = validateSurveyRecord(content, "err-survey-unknown-not-in-questions.md");
  assert.equal(result.ok, false);
  assert.equal(
    result.diagnostics.some((d) => d.rule === "survey-unknown-in-questions"),
    true,
  );
});

test("Real provenance receipt docs/provenance/ap-17-549.md passes checkReceipt against configuration and local pinned file", () => {
  const realReceiptPath = path.resolve("docs/provenance/ap-17-549.md");
  assert.ok(fs.existsSync(realReceiptPath), "docs/provenance/ap-17-549.md must exist");

  const configDir = path.resolve("scripts/sources/facsimile-sources");
  const content = fs.readFileSync(realReceiptPath, "utf8");
  const result = checkReceipt(content, realReceiptPath, { configDir });

  assert.equal(result.ok, true, `Expected ok=true, got errors: ${JSON.stringify(result.errors)}`);
  assert.equal(result.errors.length, 0);
  assert.equal(result.key, "ap-17-549");

  const scan = result.receipt?.frontMatter.scan;
  assert.ok(scan);
  assert.equal(scan.publicationDecision, "publish");
  assert.equal(scan.sha256, "0192ff57013a2adc564d98f9e4256e65d1595634c1e0b30ae38313c415dd3507");
  assert.equal(scan.pageCount, 12);
  assert.equal(scan.path, "public/papers/pdfs/ap-17-549.pdf");

  // Verify the pinned file actually exists at the published path and its SHA-256 matches
  const pdfPath = path.resolve(scan.path);
  assert.ok(fs.existsSync(pdfPath), "Pinned PDF must exist at published path");
  const actualDigest = crypto.createHash("sha256").update(fs.readFileSync(pdfPath)).digest("hex");
  assert.equal(actualDigest, scan.sha256);
});

test("Real provenance receipt docs/provenance/ap-17-891.md passes checkReceipt against configuration and local pinned file", () => {
  const realReceiptPath = path.resolve("docs/provenance/ap-17-891.md");
  assert.ok(fs.existsSync(realReceiptPath), "docs/provenance/ap-17-891.md must exist");

  const configDir = path.resolve("scripts/sources/facsimile-sources");
  const content = fs.readFileSync(realReceiptPath, "utf8");
  const result = checkReceipt(content, realReceiptPath, { configDir });

  assert.equal(result.ok, true, `Expected ok=true, got errors: ${JSON.stringify(result.errors)}`);
  assert.equal(result.errors.length, 0);
  assert.equal(result.key, "ap-17-891");

  const scan = result.receipt?.frontMatter.scan;
  assert.ok(scan);
  assert.equal(scan.publicationDecision, "publish");
  assert.equal(scan.sha256, "60d21d560f6a3c87e581ac25016306d9bcb748e530fa2751652b84986da5296c");
  assert.equal(scan.pageCount, 31);
  assert.equal(scan.path, "public/papers/pdfs/ap-17-891.pdf");

  // Verify the pinned file actually exists at the published path and its SHA-256 matches
  const pdfPath = path.resolve(scan.path);
  assert.ok(fs.existsSync(pdfPath), "Pinned PDF must exist at published path");
  const actualDigest = crypto.createHash("sha256").update(fs.readFileSync(pdfPath)).digest("hex");
  assert.equal(actualDigest, scan.sha256);
});

test("loadProvenanceReceipts loads docs/provenance and emits SourceAsset and PinnedAsset records", () => {
  const provenanceDir = path.resolve("docs/provenance");
  const configDir = path.resolve("scripts/sources/facsimile-sources");
  const loaded = loadProvenanceReceipts({ provenanceDir, configDir });

  assert.equal(loaded.ok, true);
  assert.ok(loaded.receipts.length >= 1, "Must load at least one receipt");

  const bmReceipt = loaded.receipts.find((r) => r.key === "ap-17-549");
  assert.ok(bmReceipt, "ap-17-549 receipt must be loaded");
  assert.ok(bmReceipt.sourceAsset, "sourceAsset must be emitted");
  assert.equal(
    bmReceipt.sourceAsset.sha256,
    "0192ff57013a2adc564d98f9e4256e65d1595634c1e0b30ae38313c415dd3507",
  );
  assert.equal(bmReceipt.sourceAsset.publicationDecision, "publish");
  assert.equal(bmReceipt.sourceAsset.rights.reuseTerms, "source-terms");

  assert.ok(bmReceipt.pinnedAsset, "pinnedAsset must be emitted");
  assert.equal(bmReceipt.pinnedAsset.id, "ap-17-549");
  assert.equal(bmReceipt.pinnedAsset.path, "public/papers/pdfs/ap-17-549.pdf");
  assert.equal(bmReceipt.pinnedAsset.publicationDecision, "publish");

  assert.ok(loaded.sourceAssets.has("ap-17-549"));
});

test("Validator branches on PinnedAsset loaded from provenance receipts (pass, missing publish error, pin-local flag, require-local error)", () => {
  const provenanceDir = path.resolve("docs/provenance");
  const configDir = path.resolve("scripts/sources/facsimile-sources");
  const loaded = loadProvenanceReceipts({ provenanceDir, configDir });

  // 1. Live pass: auditPinnedAssets succeeds on real pinned assets because public/papers/pdfs/ap-17-549.pdf exists
  const liveAudit = auditPinnedAssets(loaded.pinnedAssets);
  assert.equal(liveAudit.ok, true);
  assert.equal(liveAudit.errorCount, 0);

  // 2. Branching test: missing published asset produces pinned-asset-present error
  const missingPublishAsset = [
    {
      id: "ap-99-missing",
      path: "public/papers/pdfs/ap-99-missing.pdf",
      publicationDecision: "publish" as const,
    },
  ];
  const missingPublishAudit = auditPinnedAssets(missingPublishAsset, { exists: () => false });
  assert.equal(missingPublishAudit.ok, false);
  assert.equal(missingPublishAudit.errorCount, 1);
  assert.equal(missingPublishAudit.findings[0]?.check, "pinned-asset-present");

  // 3. Branching test: missing pin-local-only asset produces pinned-asset-not-available flag (ok=true)
  const pinLocalAsset = [
    {
      id: "ap-99-local",
      path: "sources/pinned/ap-99-local.pdf",
      publicationDecision: "pin-local-only" as const,
    },
  ];
  const pinLocalAudit = auditPinnedAssets(pinLocalAsset, { exists: () => false });
  assert.equal(pinLocalAudit.ok, true);
  assert.equal(pinLocalAudit.flagCount, 1);
  assert.equal(pinLocalAudit.findings[0]?.check, "pinned-asset-not-available");

  // 4. Branching test: missing pin-local-only asset under requireLocal escalates to pinned-asset-present error
  const requireLocalAudit = auditPinnedAssets(pinLocalAsset, {
    exists: () => false,
    requireLocal: true,
  });
  assert.equal(requireLocalAudit.ok, false);
  assert.equal(requireLocalAudit.errorCount, 1);
  assert.equal(requireLocalAudit.findings[0]?.check, "pinned-asset-present");
});

test("loadProvenanceReceipts surfaces receipt errors in findings and report", () => {
  // Test with fixtures dir containing error files
  const errorLoaded = loadProvenanceReceipts({
    provenanceDir: path.join(FIXTURES_DIR, "facsimile-sources"), // No receipts here
  });
  assert.equal(errorLoaded.ok, true);
  assert.equal(errorLoaded.receipts.length, 0);

  // Test with invalid receipt in temporary check
  const fakeDir = path.join(FIXTURES_DIR, "non-existent-dir");
  const notFoundLoaded = loadProvenanceReceipts({ provenanceDir: fakeDir });
  assert.equal(notFoundLoaded.ok, true);
  assert.equal(notFoundLoaded.receipts.length, 0);
});

// A correction can turn out to be wrong. Before this, the record had nowhere to say so: the
// type declared nine fields and none was a status, the validator checked only that evidence
// was non-empty, and a retraction written as prose in an invented field was invisible to
// every mechanical reader. Three records on ap-17-891 proposing to change a printed H to Y
// sat in exactly the same state as the corrections that are still right.
//
// The plant below reaches BOTH states on the SAME record. A fixture pinned to one state
// passes forever and proves nothing: it cannot show that the filter is reading the status
// rather than returning whatever it was handed.
test("A retracted typographical correction is excluded from live corrections, and reappears when it is not retracted", () => {
  const base = {
    id: "typo-fixture-1",
    locator: { pdfPageIndex: 9, printedPage: 899 },
    originalReading: "auf die H- und Z-Achse angewandt",
    proposedReading: "auf die Y- und Z-Achse angewandt",
    reasoning: "fixture",
    evidence: "fixture",
    layer: "source",
    recordedBy: "agent:fixture",
    recordedAt: "2026-09-19",
  } as const;

  const live = { ...base };
  const retracted = {
    ...base,
    status: "retracted",
    retraction: {
      reason: "H is capital eta, the axis of the moving system's eta.",
      retractedBy: "agent:fixture",
      retractedAt: "2026-09-21",
    },
  } as const;

  // RED ARM: retracted is excluded.
  const withRetracted = liveTypographicalErrors([retracted]);
  assert.equal(withRetracted.length, 0, "a retracted correction must not be served as live");

  // GREEN ARM: the same record, not retracted, IS returned. Without this the assertion above
  // is satisfied by a filter that returns nothing at all.
  const withLive = liveTypographicalErrors([live]);
  assert.equal(withLive.length, 1, "a live correction must be served");
  assert.equal(withLive[0]?.id, "typo-fixture-1");

  // And both together: exactly one survives, so the filter discriminates rather than
  // emptying or passing through.
  const mixed = liveTypographicalErrors([retracted, { ...live, id: "typo-fixture-2" }]);
  assert.equal(mixed.length, 1);
  assert.equal(mixed[0]?.id, "typo-fixture-2");

  // Absent status means active. That is the default the corpus relies on: nine of the twelve
  // real records carry no status at all.
  assert.equal(liveTypographicalErrors([base]).length, 1);
});

test("The real ap-17-891 receipt distinguishes its retracted corrections from its live ones", () => {
  const filePath = path.join("docs/provenance", "ap-17-891.md");
  const content = fs.readFileSync(filePath, "utf8");
  const result = checkReceipt(content, filePath);
  const errors = result.diagnostics.filter((d) => d.severity === "error");
  assert.deepEqual(errors, [], "the receipt must validate under the enforced record shape");

  const typos = result.receipt?.frontMatter?.typographicalErrors ?? [];
  const live = liveTypographicalErrors(typos);
  // Denominator named: six records on this receipt, three of them retracted - the H-for-Y
  // proposals on pages 899 and 902, which the plates on 899, 902 and 903 refute.
  assert.equal(typos.length, 6, "ap-17-891 carries six typographical records");
  assert.equal(live.length, 3, "three of them are live");
  for (const retracted of typos.filter((e) => e.status === "retracted")) {
    assert.ok(retracted.retraction?.reason, `${retracted.id} is retracted but gives no reason`);
    assert.ok(
      retracted.retraction?.retractedBy,
      `${retracted.id} is retracted but names nobody: a verdict without an author cannot be questioned`,
    );
  }
});
