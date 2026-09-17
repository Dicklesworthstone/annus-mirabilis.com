import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { checkReceipt } from "./checkReceipt.ts";
import { parseReceipt } from "./parseReceipt.ts";
import { resolveEquationPage } from "./receiptSchema.ts";
import { receiptToSourceAsset } from "./receiptToSourceAsset.ts";
import { validateSurveyRecord } from "./surveySchema.ts";
import {
  GeneratedSectionError,
  replaceGeneratedContent,
  writeGeneratedSectionSync,
} from "./writeGeneratedSection.ts";

const FIXTURES_DIR = path.resolve("src/testing/fixtures/provenance");
const CONFIG_DIR = path.join(FIXTURES_DIR, "facsimile-sources");
const LOCAL_FILES_ROOT = path.join(FIXTURES_DIR, "local-files");

test("ap-99-001.md valid receipt passes checker and matches SourceAsset golden", () => {
  const filePath = path.join(FIXTURES_DIR, "ap-99-001.md");
  const content = fs.readFileSync(filePath, "utf8");
  const result = checkReceipt(content, filePath, { configDir: CONFIG_DIR });

  assert.equal(result.ok, true, `Expected ok=true, got errors: ${JSON.stringify(result.errors)}`);
  assert.equal(result.errors.length, 0);

  const asset = receiptToSourceAsset(result.receipt!);
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

test("ap-99-001-refined.md refined page map passes and resolves equation ID to page", () => {
  const filePath = path.join(FIXTURES_DIR, "ap-99-001-refined.md");
  const content = fs.readFileSync(filePath, "utf8");
  const result = checkReceipt(content, filePath, { configDir: CONFIG_DIR });

  assert.equal(result.ok, true, `Expected ok=true, got errors: ${JSON.stringify(result.errors)}`);
  const pageMap = result.receipt!.frontMatter.pageMap;

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
  const stAsset = receiptToSourceAsset(stResult.receipt!);
  assert.equal(stAsset.rights.reuseTerms, "source-terms");
  assert.match(stAsset.rights.statement, /Quoted third-party source repository terms/);

  const pdPath = path.join(FIXTURES_DIR, "valid-pd-image.md");
  const pdContent = fs.readFileSync(pdPath, "utf8");
  const pdResult = checkReceipt(pdContent, pdPath);
  assert.equal(pdResult.ok, true);
  const pdAsset = receiptToSourceAsset(pdResult.receipt!);
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
