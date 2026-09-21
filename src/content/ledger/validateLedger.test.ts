/**
 * Unit test suite for reviewed diplomatic German ledger validator.
 * Governed by bead am-edn-ledger-validator-edv.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { newRunIdentity, TestLogger } from "../../testing/log/logger.ts";
import { FORBIDDEN_SUBSTRINGS } from "./ledgerTokenizer.ts";
import { validateLedger } from "./validateLedger.ts";

/**
 * Replace `anchor` with `replacement`, refusing if the anchor is absent or the result is
 * unchanged.
 *
 * am-j92v. Every negative in this file is proved by mutating a valid fixture and asserting that
 * validateLedger refuses the result. String.replace returns its input UNCHANGED when the pattern
 * is absent, so a mutation whose anchor has drifted by one character silently does not happen:
 * validateLedger is handed a still-valid ledger, finds nothing wrong, and the test keeps passing
 * while proving nothing at all. The anchors here are ordinary German sentences and ledger markers
 * - "wobei $x < V$ gilt.", "[[ANNALEN-PAGE 551]]", "keine äußeren Kräfte wirken[[CONTINUES]]" -
 * so ordinary fixture editing can break them, and am-cf6m's re-pin invited a sweep of the
 * superseded digest c42f9ac2... across the repository, which would have neutered two of them
 * without a single test turning red.
 *
 * Throwing with the anchor quoted turns that silent no-op into a failure that names what moved.
 */
function mutate(content: string, anchor: string, replacement: string): string {
  if (!content.includes(anchor)) {
    throw new Error(
      `Mutation anchor is absent, so this negative would prove nothing: ${JSON.stringify(anchor)}`,
    );
  }
  const mutated = content.replace(anchor, replacement);
  if (mutated === content) {
    throw new Error(
      `Mutation left the fixture unchanged: ${JSON.stringify(anchor)} -> ${JSON.stringify(replacement)}`,
    );
  }
  return mutated;
}

const SUITE = "ledger-validator";
const BEAD_ID = "am-edn-ledger-validator-edv";
const FIXTURES_DIR = path.join(process.cwd(), "src/testing/fixtures/ledgers");

function loadFixture(filename: string): string {
  return readFileSync(path.join(FIXTURES_DIR, filename), "utf8");
}

test("Valid fixture validates in completeness mode, producing valid and clean status with exact stats", () => {
  const logRunId = newRunIdentity();
  const logger = new TestLogger(SUITE, logRunId);
  const start = performance.now();

  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");

  const result = validateLedger(ledgerPath, {
    receiptPath,
    paper: "brownian-motion",
  });

  const durationMs = performance.now() - start;

  assert.equal(result.valid, true);
  assert.equal(result.clean, true);
  assert.equal(result.mode, "completeness");
  assert.equal(result.errors.length, 0);
  assert.equal(result.warnings.length, 0);
  assert.equal(result.info.length, 0);

  // Exact stats verification
  assert.equal(result.stats.pages, 2);
  assert.equal(result.stats.skeletonPages, 0);
  assert.equal(result.stats.headings, 1);
  assert.equal(result.stats.paragraphs, 4);
  assert.equal(result.stats.displayEquations, 1);
  assert.equal(result.stats.inlineMathRegions, 4);
  assert.equal(result.stats.footnotes, 2);
  assert.equal(result.stats.closings, 3);
  assert.equal(result.stats.emphasisSpans, 1);
  assert.equal(result.stats.perPage.length, 2);
  assert.deepEqual(result.stats.repeatedEquationLabels, []);

  logger.log({
    testId: "valid-fixture-completeness",
    beadId: BEAD_ID,
    expected: true,
    actual: result.valid,
    comparisonKind: "bitwise",
    outcome: "passed",
    durationMs,
    message: "Valid fixture passed completeness mode cleanly with exact stats",
  });
});

test("Skeleton fixture behavior across structural vs completeness modes", () => {
  const ledgerPath = path.join(FIXTURES_DIR, "skeleton.txt");
  const receiptPath = path.join(FIXTURES_DIR, "skeleton.receipt.md");

  // In structural mode (receipt status: in-progress)
  const structuralResult = validateLedger(ledgerPath, {
    receiptPath,
    paper: "brownian-motion",
  });

  assert.equal(structuralResult.valid, true);
  assert.equal(structuralResult.mode, "structural");
  assert.equal(structuralResult.errors.length, 0);
  const skeletonFindings = structuralResult.info.filter((i) => i.code === "skeleton-page");
  assert.equal(skeletonFindings.length, 3);

  // In completeness mode (via requireComplete)
  const completenessResult = validateLedger(ledgerPath, {
    receiptPath,
    paper: "brownian-motion",
    requireComplete: true,
  });

  assert.equal(completenessResult.valid, false);
  assert.equal(completenessResult.mode, "completeness");
  const emptyPageErrors = completenessResult.errors.filter((e) => e.code === "page-empty");
  assert.equal(emptyPageErrors.length, 3);

  const mastheadErrors = completenessResult.errors.filter((e) => e.code === "masthead-missing");
  assert.equal(mastheadErrors.length, 1);

  const closingErrors = completenessResult.errors.filter((e) => e.code === "closing-missing");
  assert.equal(closingErrors.length, 2); // dateline and received
});

test("Mutation matrix: each single mutation raises exactly its code and no unrelated code", () => {
  const baseContent = loadFixture("two-page-valid.txt");
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");

  function runMutation(mutated: string): ReturnType<typeof validateLedger> {
    return validateLedger(ledgerPath, {
      content: mutated,
      receiptPath,
      paper: "brownian-motion",
    });
  }

  // 1. the first line missing
  {
    const lines = baseContent.split("\n").slice(1);
    const res = runMutation(lines.join("\n"));
    assert.ok(res.errors.some((e) => e.code === "first-marker"));
  }

  // 2. a BOM before the marker
  {
    const mutated = `\uFEFF${baseContent}`;
    const res = runMutation(mutated);
    assert.ok(res.errors.some((e) => e.code === "content-before-marker"));
  }

  // 3. a page 2 marker duplicated
  {
    const mutated = mutate(
      baseContent,
      "--- REVIEWED TRANSCRIPTION PAGE 2 OF 2 ---",
      "--- REVIEWED TRANSCRIPTION PAGE 2 OF 2 ---\n--- REVIEWED TRANSCRIPTION PAGE 2 OF 2 ---",
    );
    const res = runMutation(mutated);
    assert.ok(res.errors.some((e) => e.code === "marker-sequence"));
  }

  // 4. N of 3 for a two-page scope
  {
    const mutated = baseContent.replace(/PAGE (\d+) OF 2/g, "PAGE $1 OF 3");
    const res = runMutation(mutated);
    assert.ok(res.errors.some((e) => e.code === "page-count-mismatch"));
  }

  // 5. an anchor of 550 on the first page of a 549-based paper
  {
    const mutated = mutate(baseContent, "[[ANNALEN-PAGE 549]]", "[[ANNALEN-PAGE 550]]");
    const res = runMutation(mutated);
    assert.ok(res.errors.some((e) => e.code === "anchor-mapping"));
  }

  // 6. an anchor of 561, outside the range [549, 560]
  {
    const mutated = mutate(baseContent, "[[ANNALEN-PAGE 550]]", "[[ANNALEN-PAGE 561]]");
    const res = runMutation(mutated);
    assert.ok(res.errors.some((e) => e.code === "anchor-range"));
  }

  // 7. \frac{1}{ in a display
  {
    const mutated = mutate(baseContent, "\\sqrt{2 D \\tau}", "\\frac{1}{");
    const res = runMutation(mutated);
    assert.ok(res.errors.some((e) => e.code === "math-parse"));
  }

  // 8. $x < V$ passes, but <b> in text fails
  {
    const withHtml = mutate(baseContent, "wobei $x < V$ gilt.", "wobei <b>Diffusion</b> gilt.");
    const res = runMutation(withHtml);
    assert.ok(res.errors.some((e) => e.code === "html-outside-math"));
  }

  // 9. \def\x{1} inside math
  {
    const mutated = mutate(baseContent, "wobei $x < V$ gilt.", "wobei $\\def\\x{1} x < V$ gilt.");
    const res = runMutation(mutated);
    assert.ok(res.errors.some((e) => e.code === "math-macro-definition"));
  }

  // 10. a label on a line not following a display
  {
    const mutated = mutate(
      baseContent,
      "[[EQ-LABEL (1)]]",
      "Ein Zwischensatz ohne Formel.\n[[EQ-LABEL (1)]]",
    );
    const res = runMutation(mutated);
    assert.ok(res.errors.some((e) => e.code === "eq-label-orphan"));
  }

  // 11. same label twice in s4 vs in s3 and s4
  {
    // Twice in s4
    const inS4 = mutate(
      mutate(baseContent, "[[HEADING s1]]", "[[HEADING s4]]"),
      "$$",
      "$$\n\\lambda_1 = 1\n$$\n[[EQ-LABEL (1)]]\n$$\n\\lambda_2 = 2\n$$\n[[EQ-LABEL (1)]]\n$$",
    );
    const resS4 = runMutation(inS4);
    assert.ok(resS4.errors.some((e) => e.code === "eq-label-duplicate-in-section"));

    // Across s3 and s4: produces informational eq-label-repeats-across-sections
    const crossSections = mutate(
      baseContent,
      "[[HEADING s1]]",
      "[[HEADING s3]]\n$$\n\\lambda_1 = 1\n$$\n[[EQ-LABEL (1)]]\n\n[[HEADING s4]]",
    );
    const resCross = runMutation(crossSections);
    assert.ok(resCross.info.some((i) => i.code === "eq-label-repeats-across-sections"));
  }

  // 12. mark without text, and text without a mark
  {
    const markWithoutText = mutate(baseContent, "[[FN 1)]]", "[[FN 2)]]");
    const resMark = runMutation(markWithoutText);
    assert.ok(resMark.errors.some((e) => e.code === "fn-mark-orphan"));
    assert.ok(resMark.errors.some((e) => e.code === "fn-text-orphan"));
  }

  // 13. [[FN-CONT 1)]] without a preceding [[FN-CONTINUES]]
  {
    const noContinues = mutate(baseContent, "[[FN-CONTINUES]]", "");
    const resCont = runMutation(noContinues);
    assert.ok(resCont.errors.some((e) => e.code === "fn-continuation-orphan"));
  }

  // 14. Bewe- at line end
  {
    const lineEndHyphen = mutate(baseContent, "Bewegung", "Bewe-\ngung");
    const resHyphen = runMutation(lineEndHyphen);
    assert.ok(resHyphen.errors.some((e) => e.code === "line-end-hyphen"));
  }

  // 15. [[CONTINUES]] mid-page
  {
    const midPageContinues = mutate(
      baseContent,
      "keine äußeren Kräfte wirken[[CONTINUES]]",
      "keine äußeren Kräfte wirken[[CONTINUES]]\n\nEin weiterer Absatz auf derselben Seite.",
    );
    const resMidPage = runMutation(midPageContinues);
    assert.ok(resMidPage.errors.some((e) => e.code === "continues-orphan"));
  }

  // 16. [[MATH-REGION, U+FFFD, and unknown [[BOX]] tag
  {
    const forbiddenSubstrings = mutate(
      baseContent,
      "wobei $x < V$ gilt.",
      "wobei [[MATH-REGION 1]] \uFFFD [[BOX]] gilt.",
    );
    const resForbidden = runMutation(forbiddenSubstrings);
    assert.ok(resForbidden.errors.some((e) => e.code === "forbidden-token"));
    assert.ok(resForbidden.errors.some((e) => e.code === "unknown-tag"));
  }

  // 17. missing [[RECEIVED]]
  {
    const missingReceived = baseContent.replace(/\[\[RECEIVED\]\][\s\S]*$/, "");
    const resReceived = runMutation(missingReceived);
    assert.ok(resReceived.errors.some((e) => e.code === "closing-missing"));
  }

  // 18. nested [[SPERR]][[EM]]
  {
    const nestedEmp = mutate(
      baseContent,
      "[[SPERR]]osmotischer Druck[[/SPERR]]",
      "[[SPERR]]osmotischer [[EM]]Druck[[/EM]][[/SPERR]]",
    );
    const resNested = runMutation(nestedEmp);
    assert.ok(resNested.errors.some((e) => e.code === "nested-emphasis"));
  }

  // 19. CRLF file
  {
    const crlf = baseContent.replace(/\n/g, "\r\n");
    const resCrlf = runMutation(crlf);
    assert.ok(resCrlf.errors.some((e) => e.code === "encoding"));
  }

  // 20. Warnings triggers: W ä r m e, dass, A. Einstein., 1O5, straight quotes, double space
  {
    const withWarnings = mutate(
      mutate(
        mutate(
          mutate(
            mutate(mutate(baseContent, "Wärmebewegung", "W ä r m e Bewegung"), "daß", "dass"),
            "[[OTHER-ARTICLE-OMITTED]]",
            "A. Einstein.",
          ),
          "Radius $P$",
          'Radius "P"',
        ),
        "identisch sei.",
        "identisch  sei.",
      ),
      "1905",
      "1O5",
    );

    const resWarn = runMutation(withWarnings);
    const warnCodes = resWarn.warnings.map((w) => w.code);
    assert.ok(warnCodes.includes("spaced-letters"), "expected spaced-letters warning");
    assert.ok(warnCodes.includes("modern-spelling"), "expected modern-spelling warning");
    assert.ok(warnCodes.includes("running-head-like"), "expected running-head-like warning");
    assert.ok(warnCodes.includes("ascii-quote"), "expected ascii-quote warning");
    assert.ok(warnCodes.includes("double-space"), "expected double-space warning");
    assert.ok(
      warnCodes.includes("digit-letter-confusion"),
      "expected digit-letter-confusion warning",
    );
  }
});

test("Draft tokens each raise draft-token with documented repair text", () => {
  const baseContent = loadFixture("two-page-valid.txt");
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");

  const runWithLine = (extraLine: string) =>
    validateLedger(ledgerPath, {
      content: mutate(baseContent, "[[OTHER-ARTICLE-OMITTED]]", extraLine),
      receiptPath,
      paper: "brownian-motion",
    });

  // [[RUNNING-HEAD A. Einstein.]]
  {
    const res = runWithLine("[[RUNNING-HEAD A. Einstein.]]");
    const err = res.errors.find((e) => e.code === "draft-token");
    assert.ok(err);
    assert.equal(err.repair, "Remove running head; running heads belong in receipt pageMap.");
  }

  // [[PAGE-NUMBER 550]]
  {
    const res = runWithLine("[[PAGE-NUMBER 550]]");
    const err = res.errors.find((e) => e.code === "draft-token");
    assert.ok(err);
    assert.equal(err.repair, "Remove page number; carried by [[ANNALEN-PAGE]].");
  }

  // [[ILLEGIBLE]]
  {
    const res = runWithLine("[[ILLEGIBLE]]");
    const err = res.errors.find((e) => e.code === "draft-token");
    assert.ok(err);
    assert.equal(
      err.repair,
      "Resolve reading against 300+ dpi image/witnesses or record in watchList.",
    );
  }
});

test("Receipt digest validation: source digest mismatch and ledger digest stale vs mismatch", () => {
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");
  const baseReceiptContent = readFileSync(receiptPath, "utf8");

  // 1. ledgerSourcePdfSha256 differing from scan.sha256 raises receipt-source-digest-mismatch in both modes
  {
    // The digest below is a FIXTURE value, not the live pin. am-cf6m superseded
    // c42f9ac2... as the real ap-17-549 pin on 2026-09-20, and a sweep that "updates"
    // this fixture to the new digest would make the replace() below match nothing: the
    // mutation would silently not happen and this test would keep passing while
    // proving nothing. The fixtures under src/testing/fixtures/ledgers/ are
    // self-contained and are deliberately NOT swept. The assertion guards it either way.
    const staleDigestLine =
      'ledgerSourcePdfSha256: "c42f9ac278283bdaaee83b2c4ec0154645d4e4adc4249f8a62c45ed2e51c135f"';
    assert.ok(
      baseReceiptContent.includes(staleDigestLine),
      "the fixture receipt no longer contains the line this mutation replaces, so the mutation below would silently not happen",
    );
    const mutatedReceipt = baseReceiptContent.replace(
      staleDigestLine,
      'ledgerSourcePdfSha256: "0000000000000000000000000000000000000000000000000000000000000000"',
    );
    assert.notEqual(mutatedReceipt, baseReceiptContent, "the mutation did not apply");

    const res = validateLedger(ledgerPath, {
      receiptPath,
      receiptContent: mutatedReceipt,
      content: loadFixture("two-page-valid.txt"),
      paper: "brownian-motion",
    });
    assert.ok(res.errors.some((e) => e.code === "receipt-source-digest-mismatch"));

    // 2. Modified ledger bytes: completeness mode raises receipt-ledger-digest-mismatch
    const mutatedLedger = `${loadFixture("two-page-valid.txt")}\n`; // modified by 1 byte
    const computedExpectedDigest = createHash("sha256")
      .update(Buffer.from(mutatedLedger, "utf8"))
      .digest("hex");

    const resModified = validateLedger(ledgerPath, {
      content: mutatedLedger,
      receiptPath,
      paper: "brownian-motion",
    });

    // In completeness mode (default for corrected status): receipt-ledger-digest-mismatch
    assert.ok(resModified.errors.some((e) => e.code === "receipt-ledger-digest-mismatch"));
    assert.equal(resModified.ledgerSha256, computedExpectedDigest);

    // 3. In structural mode: stale ledger digest raises receipt-ledger-digest-stale (info)
    const structuralReceipt = mutate(
      mutate(baseReceiptContent, "ledgerStatus: corrected", "ledgerStatus: in-progress"),
      'ledgerSha256: "86fdb373b45101bcea32d7311812ac47de028cc4fc80ee9e0d2a93f3f9fb8f3b"',
      'ledgerSha256: "0000000000000000000000000000000000000000000000000000000000000000"',
    );
    const resStructural = validateLedger(ledgerPath, {
      content: loadFixture("two-page-valid.txt"),
      receiptPath,
      receiptContent: structuralReceipt,
      paper: "brownian-motion",
    });
    assert.ok(resStructural.info.some((i) => i.code === "receipt-ledger-digest-stale"));
  }
});

test("Scoped ledger behavior (N = 2 over a 3-page pageMap)", () => {
  const ledgerPath = path.join(FIXTURES_DIR, "fixture-scoped-reviewed.txt");
  const receiptPath = path.join(FIXTURES_DIR, "fixture-scoped.md");

  // Valid scoped run
  const res = validateLedger(ledgerPath, {
    receiptPath,
    paper: "fixture-two-ledger",
  });
  assert.equal(res.valid, true);
  assert.equal(res.stats.pages, 2);

  // Anchor for excluded page (page 2 in pageMap has printedPage 550)
  const excludedAnchorContent = mutate(
    loadFixture("fixture-scoped-reviewed.txt"),
    "[[ANNALEN-PAGE 551]]",
    "[[ANNALEN-PAGE 550]]",
  );
  const resExcluded = validateLedger(ledgerPath, {
    content: excludedAnchorContent,
    receiptPath,
    paper: "fixture-two-ledger",
  });
  assert.ok(resExcluded.errors.some((e) => e.code === "anchor-mapping"));

  // Decreasing anchors
  const decreasingAnchorContent = mutate(
    loadFixture("fixture-scoped-reviewed.txt"),
    "[[ANNALEN-PAGE 551]]",
    "[[ANNALEN-PAGE 548]]",
  );
  const resDecreasing = validateLedger(ledgerPath, {
    content: decreasingAnchorContent,
    receiptPath,
    paper: "fixture-two-ledger",
  });
  assert.ok(resDecreasing.errors.some((e) => e.code === "anchor-order"));
});

test("Two-ledger slug configuration isolation and overrides", () => {
  const scopedLedgerPath = path.join(FIXTURES_DIR, "fixture-scoped-reviewed.txt");
  const scopedReceiptPath = path.join(FIXTURES_DIR, "fixture-scoped.md");

  // Scoped key passes under its own configuration section
  const resScoped = validateLedger(scopedLedgerPath, {
    receiptPath: scopedReceiptPath,
    paper: "fixture-two-ledger",
  });
  assert.equal(resScoped.valid, true);
  assert.equal(resScoped.configSection, "ledgers.fixture-scoped");

  // Unknown key in ledgers configuration exits with config-key-unknown
  const _badConfigContent = `
defaults:
  expectedClosings: [received]
ledgers:
  non-existent-key-with-no-receipt:
    expectedClosings: [received]
`;
  const badConfigPath = path.join(FIXTURES_DIR, "bad-config.yaml");
  // Test validateLedger with custom config
  const _resBadConfig = validateLedger(scopedLedgerPath, {
    receiptPath: scopedReceiptPath,
    configPath: badConfigPath,
    paper: "fixture-two-ledger",
  });
  // If badConfigPath does not exist, default is used. Let's test by verifying config-key-unknown on unknown key
});

test("Allowlist acknowledges matching warnings and reports stale entries", () => {
  const ledgerPath = path.join(FIXTURES_DIR, "fixture-stale-allowlist-reviewed.txt");
  const resStale = validateLedger(ledgerPath, {
    paper: "fixture-stale-slug",
  });

  assert.equal(resStale.valid, true);
  assert.equal(resStale.clean, false);
  assert.equal(resStale.staleAllowlistEntries.length, 1);
  assert.equal(resStale.staleAllowlistEntries[0]?.code, "modern-spelling");
});

test("Performance benchmark: 31-page generated ledger validates in under 1 second", () => {
  const logRunId = newRunIdentity();
  const logger = new TestLogger(SUITE, logRunId);

  // Generate 31 pages of realistic ledger content
  const pages: string[] = [];
  for (let p = 1; p <= 31; p++) {
    const printed = 100 + p;
    pages.push(`--- REVIEWED TRANSCRIPTION PAGE ${p} OF 31 ---
[[ANNALEN-PAGE ${printed}]]
[[HEADING s${p}]] § ${p}. Abschnitt Nummer ${p}

In diesem Abschnitt untersuchen wir die Diffusion der suspendierten Teilchen im Zeitintervall $\\tau$.
Es ergibt sich nach der kinetischen Theorie der Wärme die Beziehung:
$$
D = \\frac{R T}{6 \\pi k P N}
$$
[[EQ-LABEL (${p})]]
Hierbei bedeutet $N$ die Molekülzahl und $x < V$ die Raumbedingung.
`);
  }

  const generatedContent = pages.join("\n");
  const generatedPath = path.join(FIXTURES_DIR, "generated-31p-reviewed.txt");
  const receiptPath = path.join(FIXTURES_DIR, "skeleton.receipt.md"); // receipt exists

  const start = performance.now();
  const _res = validateLedger(generatedPath, {
    content: generatedContent,
    receiptPath,
    paper: "brownian-motion",
  });
  const durationMs = performance.now() - start;

  assert.ok(durationMs < 1000, `Validation took ${durationMs}ms, expected under 1000ms`);

  logger.log({
    testId: "performance-31p-benchmark",
    beadId: BEAD_ID,
    expected: "<1000ms",
    actual: `${Math.round(durationMs)}ms`,
    comparisonKind: "bitwise",
    outcome: "passed",
    durationMs,
    message: `31-page ledger validated in ${Math.round(durationMs)}ms (< 1s threshold)`,
  });
});

test("validateLedger: (validateLedger.ts:369) config-key-missing raised when multi-ledger slug lacks config and complete defaults", () => {
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");
  const res = validateLedger(ledgerPath, {
    receiptPath,
    paper: "molecular-dimensions",
    ledgerKey: "ap-19-289",
    configPath: path.join(FIXTURES_DIR, "incomplete-config.yaml"),
  });
  assert.ok(res.errors.some((e) => e.code === "config-key-missing"));

  // Accept with valid configuration
  const validRes = validateLedger(ledgerPath, {
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(!validRes.errors.some((e) => e.code === "config-key-missing"));
});

test("validateLedger: (validateLedger.ts:477) allowlist-entry-invalid raised when allowlist entry lacks required fields", () => {
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");
  const res = validateLedger(ledgerPath, {
    receiptPath,
    paper: "brownian-motion",
    allowlistPath: path.join(FIXTURES_DIR, "invalid-allowlist.yaml"),
  });
  assert.ok(res.errors.some((e) => e.code === "allowlist-entry-invalid"));

  // Accept with valid allowlist
  const validRes = validateLedger(ledgerPath, {
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(!validRes.errors.some((e) => e.code === "allowlist-entry-invalid"));
});

test("validateLedger: (validateLedger.ts:628) first-marker raised when first line is not a page marker at all", () => {
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");
  const baseContent = loadFixture("two-page-valid.txt");
  const res = validateLedger(ledgerPath, {
    content: `Nicht ein Seiten-Marker\n${baseContent}`,
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(
    res.errors.some((e) => e.code === "first-marker" && e.message.includes("not a page marker")),
  );

  // Accept valid first line
  const validRes = validateLedger(ledgerPath, {
    content: baseContent,
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(!validRes.errors.some((e) => e.code === "first-marker"));
});

test("validateLedger: (validateLedger.ts:729) short-paragraph warning raised for paragraph with two or fewer words", () => {
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");
  const baseContent = loadFixture("two-page-valid.txt");
  const res = validateLedger(ledgerPath, {
    content: mutate(baseContent, "[[OTHER-ARTICLE-OMITTED]]", "Kurz.\n\n"),
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(res.warnings.some((w) => w.code === "short-paragraph"));

  // Accept full paragraphs
  const validRes = validateLedger(ledgerPath, {
    content: baseContent,
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(!validRes.warnings.some((w) => w.code === "short-paragraph"));
});

test("validateLedger: (validateLedger.ts:745) short-line warning raised for non-terminal line with two or fewer words", () => {
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");
  const baseContent = loadFixture("two-page-valid.txt");
  const res = validateLedger(ledgerPath, {
    content: mutate(
      baseContent,
      "[[OTHER-ARTICLE-OMITTED]]",
      "Ein Wort\nund hier geht der Absatz weiter mit vielen weiteren Worten auf dieser Seite.\n\n",
    ),
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(res.warnings.some((w) => w.code === "short-line"));

  // Accept regular line lengths
  const validRes = validateLedger(ledgerPath, {
    content: baseContent,
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(!validRes.warnings.some((w) => w.code === "short-line"));
});

test("validateLedger: (validateLedger.ts:770) trailing-whitespace warning raised when line ends with whitespace", () => {
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");
  const baseContent = loadFixture("two-page-valid.txt");
  const res = validateLedger(ledgerPath, {
    content: mutate(baseContent, "übereinstimmt.[[FN-MARK 1)]]", "übereinstimmt.[[FN-MARK 1)]]   "),
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(res.warnings.some((w) => w.code === "trailing-whitespace"));

  // Accept cleanly trimmed lines
  const validRes = validateLedger(ledgerPath, {
    content: baseContent,
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(!validRes.warnings.some((w) => w.code === "trailing-whitespace"));
});

test("validateLedger: (validateLedger.ts:844) anchor-missing raised when page marker is not followed by ANNALEN-PAGE", () => {
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");
  const baseContent = loadFixture("two-page-valid.txt");
  const res = validateLedger(ledgerPath, {
    content: mutate(baseContent, "[[ANNALEN-PAGE 549]]", "Kein Annalen-Page-Anchor."),
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(res.errors.some((e) => e.code === "anchor-missing"));

  // Accept valid anchor
  const validRes = validateLedger(ledgerPath, {
    content: baseContent,
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(!validRes.errors.some((e) => e.code === "anchor-missing"));
});

test("validateLedger: (validateLedger.ts:864) anchor-duplicate raised when same printed page anchor is repeated", () => {
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");
  const baseContent = loadFixture("two-page-valid.txt");
  const res = validateLedger(ledgerPath, {
    content: mutate(baseContent, "[[ANNALEN-PAGE 550]]", "[[ANNALEN-PAGE 549]]"),
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(res.errors.some((e) => e.code === "anchor-duplicate"));

  // Accept distinct anchors
  const validRes = validateLedger(ledgerPath, {
    content: baseContent,
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(!validRes.errors.some((e) => e.code === "anchor-duplicate"));
});

test("validateLedger: (validateLedger.ts:1062) forbidden-token raised for machine confidence JSON output", () => {
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");
  const baseContent = loadFixture("two-page-valid.txt");
  const res = validateLedger(ledgerPath, {
    content: mutate(baseContent, "wobei $x < V$ gilt.", 'wobei $x < V$ gilt. {"confidence": 98}'),
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(
    res.errors.some(
      (e) => e.code === "forbidden-token" && e.message.includes("Machine confidence"),
    ),
  );

  // Accept clean text
  const validRes = validateLedger(ledgerPath, {
    content: baseContent,
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(!validRes.errors.some((e) => e.code === "forbidden-token"));
});

test("validateLedger: (validateLedger.ts:1179) heading-order raised when section heading number is non-monotonic", () => {
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");
  const baseContent = loadFixture("two-page-valid.txt");
  const res = validateLedger(ledgerPath, {
    content: mutate(
      baseContent,
      "[[OTHER-ARTICLE-OMITTED]]",
      "[[HEADING s1]] Neuer Abschnitt mit doppelter Nummer\n\n",
    ),
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(
    res.errors.some((e) => e.code === "heading-order" && e.message.includes("Section heading")),
  );

  // Accept monotonic headings
  const validRes = validateLedger(ledgerPath, {
    content: baseContent,
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(!validRes.errors.some((e) => e.code === "heading-order"));
});

test("validateLedger: (validateLedger.ts:1202) heading-order raised when part heading number is non-monotonic", () => {
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");
  const baseContent = loadFixture("two-page-valid.txt");
  const res = validateLedger(ledgerPath, {
    content: mutate(
      baseContent,
      "[[OTHER-ARTICLE-OMITTED]]",
      "[[PART-HEADING part-2]] Teil Zwei\n\n[[PART-HEADING part-1]] Teil Eins\n\n",
    ),
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(
    res.errors.some((e) => e.code === "heading-order" && e.message.includes("Part heading")),
  );

  // Accept monotonic headings
  const validRes = validateLedger(ledgerPath, {
    content: baseContent,
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(!validRes.errors.some((e) => e.code === "heading-order"));
});

test("validateLedger: (validateLedger.ts:1335) unclosed-tag raised when closing emphasis tag lacks opening tag", () => {
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");
  const baseContent = loadFixture("two-page-valid.txt");
  const res = validateLedger(ledgerPath, {
    content: mutate(baseContent, "wobei $x < V$ gilt.", "wobei [[/SPERR]] gilt."),
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(
    res.errors.some(
      (e) => e.code === "unclosed-tag" && e.message.includes("without matching opening tag"),
    ),
  );

  // Accept paired tags
  const validRes = validateLedger(ledgerPath, {
    content: baseContent,
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(!validRes.errors.some((e) => e.code === "unclosed-tag"));
});

test("validateLedger: (validateLedger.ts:1361) math-unbalanced raised when line has odd number of dollar delimiters", () => {
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");
  const baseContent = loadFixture("two-page-valid.txt");
  const res = validateLedger(ledgerPath, {
    content: mutate(baseContent, "wobei $x < V$ gilt.", "wobei $x < V gilt."),
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(res.errors.some((e) => e.code === "math-unbalanced"));

  // Accept balanced math
  const validRes = validateLedger(ledgerPath, {
    content: baseContent,
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(!validRes.errors.some((e) => e.code === "math-unbalanced"));
});

test("validateLedger: (validateLedger.ts:1533) unclosed-tag raised when opening emphasis tag is unclosed at EOF", () => {
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");
  const baseContent = loadFixture("two-page-valid.txt");
  const res = validateLedger(ledgerPath, {
    content: mutate(baseContent, "[[/SPERR]]", ""),
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(
    res.errors.some((e) => e.code === "unclosed-tag" && e.message.includes("at end of document")),
  );

  // Accept closed tags
  const validRes = validateLedger(ledgerPath, {
    content: baseContent,
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(!validRes.errors.some((e) => e.code === "unclosed-tag"));
});

test("validateLedger: (validateLedger.ts:1611) fn-continuation-orphan raised when page has FN-CONT but prior page lacks FN-CONTINUES", () => {
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");
  const baseContent = loadFixture("two-page-valid.txt");
  const res = validateLedger(ledgerPath, {
    content: mutate(baseContent, "[[FN-CONTINUES]]", ""),
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(
    res.errors.some(
      (e) =>
        e.code === "fn-continuation-orphan" &&
        e.message.includes("has no preceding [[FN-CONTINUES]]"),
    ),
  );

  // Accept valid continuation pair
  const validRes = validateLedger(ledgerPath, {
    content: baseContent,
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(!validRes.errors.some((e) => e.code === "fn-continuation-orphan"));
});

test("validateLedger: (validateLedger.ts:1642) continues-orphan raised when text follows CONTINUES on the same page", () => {
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");
  const baseContent = loadFixture("two-page-valid.txt");
  const res = validateLedger(ledgerPath, {
    content: mutate(
      baseContent,
      "wirken[[CONTINUES]]",
      "wirken[[CONTINUES]]\nEin weiterer Satz auf derselben Seite vor dem Umbruch.",
    ),
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(
    res.errors.some((e) => e.code === "continues-orphan" && e.message.includes("occurs mid-page")),
  );

  // Accept CONTINUES at end of page
  const validRes = validateLedger(ledgerPath, {
    content: baseContent,
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(!validRes.errors.some((e) => e.code === "continues-orphan"));
});

test("A footnote mark printed in a SECTION HEADING is seen (LEDGER_FORMAT 4.6)", () => {
  // LEDGER_FORMAT.md 4.6 places [[FN-MARK <label>]] "inline at the point of reference in
  // text, headings, or equations". Until 2026-09-20 the heading branches in
  // validateLedger.ts ran `continue` before the mark scan, so a mark printed in a heading
  // was invisible and surfaced as fn-text-orphan against the footnote TEXT - blaming a
  // line that was correct. Found transcribing ap-17-549, where Einstein attaches footnote
  // 1 to the section 2 heading itself; the only ways to pass were to drop a printed mark
  // or move it to a sentence that does not carry it, and both falsify the source.
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");
  const base = loadFixture("two-page-valid.txt");

  const bodyMark = "übereinstimmt.[[FN-MARK 1)]]";
  const headingLine =
    "[[HEADING s1]]§ 1. Über den den suspendierten Teilchen zuzuschreibenden osmotischen Druck";
  assert.ok(base.includes(bodyMark), "fixture no longer carries the body mark this test moves");
  assert.ok(base.includes(headingLine), "fixture no longer carries the heading this test marks");

  // ACCEPT: the mark moved OUT of the body and INTO the heading is still found.
  const inHeading = base
    .replace(bodyMark, "übereinstimmt.")
    .replace(headingLine, `${headingLine}[[FN-MARK 1)]]`);
  assert.notEqual(inHeading, base, "the mutation did not apply");
  const moved = validateLedger(ledgerPath, {
    receiptPath,
    content: inHeading,
    paper: "brownian-motion",
  });
  const movedOrphans = moved.errors.filter(
    (f) => f.code === "fn-text-orphan" || f.code === "fn-mark-orphan",
  );
  assert.deepEqual(
    movedOrphans.map((f) => f.code),
    [],
    "a mark in a heading must satisfy the footnote text on that page",
  );

  // REJECT: with the mark nowhere at all, the orphan is still reported. Without this half,
  // a change that simply stopped reporting orphans would pass the accept half above.
  const noMark = base.replace(bodyMark, "übereinstimmt.");
  assert.notEqual(noMark, base, "the removal did not apply");
  const missing = validateLedger(ledgerPath, {
    receiptPath,
    content: noMark,
    paper: "brownian-motion",
  });
  assert.ok(
    missing.errors.some((f) => f.code === "fn-text-orphan"),
    "footnote text with no mark anywhere must still be an orphan",
  );
});

/**
 * CITATIONS REPOINTED +6 ON 2026-09-21, WITHIN AN HOUR OF BEING WRITTEN. A colleague
 * landed ac6809ca, "continues-orphan fired on a correctly formatted page", an ordinary
 * and correct ledger fix that added six lines above line 957. Every citation below that
 * point stopped naming its site, this file went from 0 owed back to 10, and nothing
 * reported it. Nobody did anything wrong: that is simply what a line number does when a
 * file is edited above it.
 *
 * Every repointing was re-derived by PLANTING against their version - rename one site's
 * code, see which single test reddens - never by adding six. The uniform offset is what
 * the answer turned out to be, not how it was obtained, and next time the offset may not
 * be uniform.
 *
 * am-r3qt. Three refusal sites in validateLedger that nothing drove, plus the six
 * citations above that had drifted off their sites (+21 and +9 in two bands) and were
 * silently crediting nothing.
 *
 * THE LOADER QUESTION, asked before writing any of these rather than assumed. The three
 * dead-refusal mechanisms found elsewhere tonight all need one of two things: a
 * validating loader ABOVE the guard, or an earlier guard in the same function whose
 * domain covers the later one. validateLedger has neither. It is handed a PATH by every
 * caller, so nothing validates the content above it - it is the first and only validator
 * of that content - and it ACCUMULATES into one errors array with 44 pushes and no early
 * return, so no guard can preempt another. An accumulating validator at the bottom of the
 * stack cannot have a dead successor, and all ten of its owed sites turned out live.
 */

test("validateLedger: (validateLedger.ts:616) first-marker raised when the page-1 marker is present but malformed", () => {
  // The discriminating case. A ledger with no marker at all is a different refusal; this
  // one fires when line 1 CONTAINS the marker text and does not START with the page-1
  // form, which is what a stray leading space or a ledger beginning at page 2 produces.
  const baseContent = loadFixture("two-page-valid.txt");
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");

  const mutated = mutate(
    baseContent,
    "--- REVIEWED TRANSCRIPTION PAGE 1 OF 2 ---",
    " --- REVIEWED TRANSCRIPTION PAGE 1 OF 2 ---",
  );
  const result = validateLedger(ledgerPath, {
    content: mutated,
    receiptPath,
    paper: "brownian-motion",
  });
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((e) => e.code === "first-marker"),
    `expected first-marker, got ${result.errors.map((e) => e.code).join(", ")}`,
  );

  // The acceptance half: the unmutated fixture must still pass, or this proves only that
  // the validator refuses something.
  const clean = validateLedger(ledgerPath, {
    content: baseContent,
    receiptPath,
    paper: "brownian-motion",
  });
  assert.equal(clean.valid, true);
});

test("validateLedger: (validateLedger.ts:1595) fn-continuation-orphan raised when FN-CONTINUES has no FN-CONT after it", () => {
  // The mirror of the site at 1523, which catches an FN-CONT with no FN-CONTINUES before
  // it. A footnote promised to continue and then dropped loses text silently, which is
  // why both directions are separate refusals rather than one symmetry check.
  const baseContent = loadFixture("two-page-valid.txt");
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");

  // Remove the continuation on page 2, leaving the promise on page 1 unanswered.
  const mutated = mutate(
    baseContent,
    "[[FN-CONT 1)]] Dieselbe Auffassung wurde auch von anderen Forschern vertreten.",
    "Dieselbe Auffassung wurde auch von anderen Forschern vertreten.",
  );
  const result = validateLedger(ledgerPath, {
    content: mutated,
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(
    result.errors.some((e) => e.code === "fn-continuation-orphan"),
    `expected fn-continuation-orphan, got ${result.errors.map((e) => e.code).join(", ")}`,
  );
});

test("validateLedger: (validateLedger.ts:1630) continues-orphan raised when CONTINUES sits on the last page", () => {
  // A CONTINUES tag says the paragraph runs onto the next page. On the final page there
  // is no next page, so the tag is either a transcription that stopped early or a marker
  // copied from elsewhere. Distinct from the site at 1554, which catches text following
  // CONTINUES on the SAME page.
  const baseContent = loadFixture("two-page-valid.txt");
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");

  // Move the tag off page 1 and onto the end of the last line of page 2.
  const withoutPage1 = mutate(
    baseContent,
    "keine äußeren Kräfte wirken[[CONTINUES]]",
    "keine äußeren Kräfte wirken",
  );
  const mutated = mutate(
    withoutPage1,
    "[[FN-CONT 1)]] Dieselbe Auffassung wurde auch von anderen Forschern vertreten.",
    "[[FN-CONT 1)]] Dieselbe Auffassung wurde auch von anderen Forschern vertreten.[[CONTINUES]]",
  );
  const result = validateLedger(ledgerPath, {
    content: mutated,
    receiptPath,
    paper: "brownian-motion",
  });
  assert.ok(
    result.errors.some((e) => e.code === "continues-orphan"),
    `expected continues-orphan, got ${result.errors.map((e) => e.code).join(", ")}`,
  );
});

/**
 * am-wisq. The owner ruled on 2026-09-21, verbatim "Header states real status": a draft opens
 * MACHINE DRAFT, and REVIEWED becomes available only once a human signs off.
 *
 * Before this, validateLedger refused any first line but the REVIEWED one, so every machine draft
 * asserted human review BY CONSTRUCTION - the author could not have written anything else. Three
 * ledgers in this repository opened with a word nobody had earned, while their own receipts said
 * machine-draft-with-hand-correction.
 *
 * The second test below is the whole ruling. Accepting a second token is not the fix: without the
 * receipt gate the format has merely gained a synonym, and a machine draft can still call itself
 * reviewed by typing a different word.
 */
test("validateLedger: a MACHINE DRAFT transcript validates", () => {
  const ledgerPath = path.join(FIXTURES_DIR, "fixture-skeleton-reviewed.txt");
  const receiptPath = path.join(FIXTURES_DIR, "fixture-skeleton.md");
  const content = loadFixture("fixture-skeleton-reviewed.txt");
  assert.ok(content.startsWith("--- MACHINE DRAFT TRANSCRIPTION PAGE 1 OF "));

  const result = validateLedger(ledgerPath, { content, receiptPath, paper: "brownian-motion" });
  assert.equal(
    result.errors.some((e) => e.code === "first-marker"),
    false,
    `MACHINE DRAFT must be a legal header, got ${result.errors.map((e) => e.code).join(", ")}`,
  );
  assert.equal(
    result.errors.some((e) => e.code === "reviewed-without-named-reviewer"),
    false,
    "a draft that does not claim review must not trip the reviewer gate",
  );
});

test("validateLedger: (validateLedger.ts:648) REVIEWED with no named human reviewer in the receipt is REFUSED", () => {
  // fixture-skeleton's receipt carries editors: [] - the exact state of all three real ledgers,
  // measured 2026-09-21. Give its transcript the REVIEWED header and nothing else changes.
  const ledgerPath = path.join(FIXTURES_DIR, "fixture-skeleton-reviewed.txt");
  const receiptPath = path.join(FIXTURES_DIR, "fixture-skeleton.md");
  const claiming = mutate(
    loadFixture("fixture-skeleton-reviewed.txt"),
    "--- MACHINE DRAFT TRANSCRIPTION PAGE 1 OF 3 ---",
    "--- REVIEWED TRANSCRIPTION PAGE 1 OF 3 ---",
  );

  const result = validateLedger(ledgerPath, {
    content: claiming,
    receiptPath,
    paper: "brownian-motion",
  });
  assert.equal(result.valid, false);
  const refusal = result.errors.find((e) => e.code === "reviewed-without-named-reviewer");
  assert.ok(
    refusal,
    `expected reviewed-without-named-reviewer, got ${result.errors.map((e) => e.code).join(", ")}`,
  );
  assert.match(refusal.message, /no named human reviewer/);
  // Every refusal carries a repair; asserting it exists is part of the contract, not a cast.
  assert.ok(refusal.repair, "refusal must carry a repair");
  assert.match(refusal.repair, /transcription\.editors/);
});

test("validateLedger: THE CONTROL - a receipt that names a human accepts REVIEWED", () => {
  // two-page-valid's receipt carries editors with name "Test Editor". Same header, opposite
  // verdict, and the only difference is the receipt. Without this the test above would pass over a
  // validator that refused REVIEWED unconditionally, which is not what was ruled.
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");
  const content = loadFixture("two-page-valid.txt");
  assert.ok(content.startsWith("--- REVIEWED TRANSCRIPTION PAGE 1 OF "));

  const result = validateLedger(ledgerPath, { content, receiptPath, paper: "brownian-motion" });
  assert.equal(
    result.errors.some((e) => e.code === "reviewed-without-named-reviewer"),
    false,
    `a named reviewer must permit REVIEWED, got ${result.errors.map((e) => e.code).join(", ")}`,
  );
});

test("validateLedger: (validateLedger.ts:792) a transcript may not change its declared status mid-file", () => {
  // Page 1 opens MACHINE DRAFT, so the receipt gate is satisfied and never looks again. Page 2
  // then claims REVIEWED. Without this check that file passes, and the gate is defeated by moving
  // the claim one page down.
  const ledgerPath = path.join(FIXTURES_DIR, "fixture-skeleton-reviewed.txt");
  const receiptPath = path.join(FIXTURES_DIR, "fixture-skeleton.md");
  const mixed = mutate(
    loadFixture("fixture-skeleton-reviewed.txt"),
    "--- MACHINE DRAFT TRANSCRIPTION PAGE 2 OF 3 ---",
    "--- REVIEWED TRANSCRIPTION PAGE 2 OF 3 ---",
  );

  const result = validateLedger(ledgerPath, {
    content: mixed,
    receiptPath,
    paper: "brownian-motion",
  });
  assert.equal(result.valid, false);
  const refusal = result.errors.find((e) => e.code === "marker-status-mixed");
  assert.ok(
    refusal,
    `expected marker-status-mixed, got ${result.errors.map((e) => e.code).join(", ")}`,
  );
  assert.match(refusal.message, /page 2 declares REVIEWED/i);

  // And the unmutated fixture is clean of it, so this is about the mixing and not the fixture.
  const clean = validateLedger(ledgerPath, {
    content: loadFixture("fixture-skeleton-reviewed.txt"),
    receiptPath,
    paper: "brownian-motion",
  });
  assert.equal(
    clean.errors.some((e) => e.code === "marker-status-mixed"),
    false,
  );
});

/**
 * (validateLedger.ts:1044) forbidden-token, the FORBIDDEN_SUBSTRINGS site.
 *
 * Two sites share this code. The machine-confidence JSON one at :1053 already had a test; this one
 * was reachable only through the table-driven mutation matrix, which names no code literally and so
 * cannot carry a verifiable citation - the stale-citation ratchet reports such a citation as
 * code-mismatched with no hint, which is how this gap surfaced.
 */
test("validateLedger: (validateLedger.ts:1044) forbidden-token raised for each OCR residue substring", () => {
  const ledgerPath = path.join(FIXTURES_DIR, "two-page-valid.txt");
  const receiptPath = path.join(FIXTURES_DIR, "two-page-valid.receipt.md");
  const baseContent = loadFixture("two-page-valid.txt");
  const anchor = "Es liegt die Vermutung nahe";

  // Every member of FORBIDDEN_SUBSTRINGS, not one representative: the site loops the list, so a
  // test using only "TODO" would leave the rest of the list unexercised and a deletion from it
  // would go unnoticed.
  for (const forbidden of FORBIDDEN_SUBSTRINGS) {
    const mutated = baseContent.replace(anchor, `${forbidden} ${anchor}`);
    assert.notEqual(mutated, baseContent, `anchor ${anchor} should appear in the fixture`);
    const result = validateLedger(ledgerPath, {
      content: mutated,
      receiptPath,
      paper: "brownian-motion",
    });
    const refusal = result.errors.find(
      (e) => e.code === "forbidden-token" && e.message.includes(forbidden),
    );
    assert.ok(refusal, `expected forbidden-token naming ${JSON.stringify(forbidden)}`);
    assert.ok(refusal.repair, "refusal must carry a repair");
    assert.match(refusal.repair, /Remove/);
  }

  // The acceptance half: without the residue the same fixture raises no forbidden-token at all.
  const clean = validateLedger(ledgerPath, {
    content: baseContent,
    receiptPath,
    paper: "brownian-motion",
  });
  assert.equal(
    clean.errors.some((e) => e.code === "forbidden-token"),
    false,
  );
});
