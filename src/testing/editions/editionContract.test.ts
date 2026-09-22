import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { load as parseYaml } from "js-yaml";
import {
  assertEditionContract,
  CONTRACT_CHECKS_SPEC,
  EditionContractError,
  validateSpanRevisionCurrency,
} from "../../content/editions/editionContract.ts";
import { validateEditionDeclaration } from "../../content/editions/editionDeclaration.ts";
import {
  getReviewStateCheck,
  registerReviewStateCheck,
  resetReviewStateCheck,
  strictNoReviewedCheck,
} from "../../content/editions/reviewState.ts";
import { parseReceipt } from "../../content/provenance/parseReceipt.ts";
import { spanTextDigest } from "../../content/schemas/spans.ts";
import { getLogger } from "../log/logger.ts";

const logger = getLogger("editions");
const BEAD = "am-edn-alignment-tooling-do1";

/**
 * The fixture ledger, built to the SHAPE the pinned artifact declares rather than to a
 * number typed here.
 *
 * It read `PAGE 1 OF 1` until 2026-09-21 while `assertEditionContract("brownian-motion")`
 * validates it against docs/provenance/ap-17-549.md, which declares twelve. The fixture
 * and the receipt had contradicted each other since the fixture was written; nothing
 * reported it because check 2 declined `ledger-absent` for a paper with no ledger on disk
 * and therefore never ran. The first real ap-17-549 ledger made the check run and the
 * contradiction surfaced immediately as `page-count-mismatch`.
 *
 * GROUND TRUTH IS THE PINNED PDF, and twelve is what six independent readings of it give:
 *   public/papers/pdfs/ap-17-549.pdf, sha256 0192ff57013a2adc...415dd3507
 *     poppler `pdfinfo` .................................. Pages: 12
 *     the repo's own countPdfPages (/Type /Page on those bytes) ...... 12
 *     receipt scan.pageCount ......................................... 12
 *     receipt pageMap entries ........................................ 12
 *     receipt printed range 549-560 .................................. 12
 *     the real ledger's marker sequence .............................. 12
 * So the receipt was the correct side of the disagreement and the fixture was the wrong
 * one. The count below is now READ OFF the receipt's page map at test time, so a fixture
 * can never again quietly disagree with the artifact it claims to transcribe.
 */
function receiptPrintedPages(bibKey: string): readonly number[] {
  // Read from the PARSED page map, not from the receipt text.
  //
  // This used to scan `printedPage:` out of the raw file, scoped to the pageMap block by
  // slicing from "\npageMap:" to "\nwitnesses:". That was written after the helper counted
  // thirteen pages for a twelve-page paper: typographicalErrors records carry their own
  // printedPage, so whole-file scanning over-counts. The slice fixed ap-17-549 and nothing
  // else - ap-17-891 has the identical shape and six typo records, and whole-file scanning
  // there yields 37 printed pages for 31 real ones.
  //
  // A slice between two named keys also depends on the front matter's key ORDER, which no
  // schema fixes. Reading the parsed map removes the whole class instead of patching the
  // instance: pageMap entries are the only thing that can appear in fm.pageMap, for every
  // receipt, whatever else the front matter grows.
  const receiptPath = join(process.cwd(), `docs/provenance/${bibKey}.md`);
  const parsed = parseReceipt(readFileSync(receiptPath, "utf8"), receiptPath);
  const pageMap = parsed.frontMatter?.pageMap;
  const pages = Array.isArray(pageMap)
    ? pageMap.map((entry) => Number((entry as { printedPage: number }).printedPage))
    : [];
  if (pages.length === 0 || pages.some((n) => !Number.isFinite(n))) {
    throw new Error(
      `docs/provenance/${bibKey}.md yielded no usable pageMap printedPage entries; the fixture ` +
        `below would otherwise be built from an empty page map and assert nothing.`,
    );
  }
  return pages;
}

const BROWNIAN_PRINTED_PAGES = receiptPrintedPages("ap-17-549");

// The hazard this helper exists to avoid is not specific to ap-17-549, and the previous fix
// was. typographicalErrors records carry their own printedPage, so a whole-file scan of
// docs/provenance/ap-17-891.md yields 37 printed pages where the page map declares 31 - six
// typo records, one line each. Asserting BOTH receipts here is what makes the helper's
// coverage a fact rather than an intention: if someone reverts it to a raw-text scan, the
// relativity number moves and this fails.
const RELATIVITY_PRINTED_PAGES = receiptPrintedPages("ap-17-891");

/**
 * Page 1 carries the sentence the reconstruction checks read. EVERY OTHER PAGE CARRIES A
 * LINE TOO, and that is deliberate: this fixture is the contract's happy path, and from
 * 2026-09-21 a ledger whose pages are bare markers classifies as `partial` and licenses no
 * completeness verdict at all. A fixture left as one page of text and eleven of markers
 * would have been testing the partial path under a name that promises a covering one.
 */
const LEDGER = `${BROWNIAN_PRINTED_PAGES.map(
  (printed, i) =>
    // MACHINE DRAFT, because this synthetic ledger has no reviewer: its receipt carries no named
    // editor, and under am-wisq the REVIEWED header is refused without one. The header now matches
    // what the fixture actually is.
    `--- MACHINE DRAFT TRANSCRIPTION PAGE ${i + 1} OF ${BROWNIAN_PRINTED_PAGES.length} ---\n` +
    `[[ANNALEN-PAGE ${printed}]]\n\n` +
    (i === 0
      ? "Die Bewegung ist unregelmäßig. Sie hört nicht auf.\n"
      : `Fortsetzung auf Seite ${printed}.\n`),
).join("\n")}`;

/**
 * The edition text this ledger reconstructs: every content line, in page order.
 *
 * It was the single page-1 sentence until 2026-09-21, which was consistent only while the
 * other eleven pages were bare markers. Now that the fixture covers every page - because a
 * bare-marker ledger classifies as `partial` and licenses no completeness verdict - the
 * edition has to reconstruct all of it, and both are derived from the same array so they
 * cannot drift apart.
 */
const LEDGER_EDITION_TEXT = BROWNIAN_PRINTED_PAGES.map((printed, i) =>
  i === 0
    ? "Die Bewegung ist unregelmäßig. Sie hört nicht auf."
    : `Fortsetzung auf Seite ${printed}.`,
).join("\n");

describe("assertEditionContract", () => {
  test("a present ledger with matching reconstruction and id-edges passes", () => {
    const ledgerDigest = createHash("sha256").update(LEDGER, "utf8").digest("hex");
    const result = assertEditionContract("brownian-motion", {
      ledgerText: LEDGER,
      editionText: LEDGER_EDITION_TEXT,
      declaredLedgerDigest: ledgerDigest,
      germanIds: ["s0-p1-s1", "s0-p1-s2"],
      englishIds: ["s0-p1-s1", "s0-p1-s2"],
      edges: [
        { sourceId: "s0-p1-s1", targetId: "s0-p1-s1" },
        { sourceId: "s0-p1-s2", targetId: "s0-p1-s2" },
      ],
    });
    expect(result.ledger).toBe("complete");
    expect(result.outcome).toBe("passed");
    expect(result.translationCompleteness).toBe("complete");
    logger.log({
      testId: "contract-happy",
      beadId: BEAD,
      extra: { check: "reconstruction" },
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "fixture ledger reconstructs and aligns by id",
    });
  });

  test("PLANTED: a one-character ledger edit without updating the digest fails digest-chain", () => {
    const oldDigest = createHash("sha256").update(LEDGER, "utf8").digest("hex");
    const result = assertEditionContract("brownian-motion", {
      ledgerText: LEDGER.replace("unregelmäßig", "unregelmaessig"),
      declaredLedgerDigest: oldDigest,
    });
    expect(result.outcome).toBe("failed");
    expect(result.checks.some((c) => c.code === "digest-mismatch")).toBe(true);
  });

  test("PLANTED: truncated edition text fails reconstruction even if it remains a substring", () => {
    const result = assertEditionContract("brownian-motion", {
      ledgerText: LEDGER,
      editionText: "Die Bewegung ist unregelmäßig.",
      germanIds: ["s0-p1-s1"],
      englishIds: ["s0-p1-s1"],
      edges: [{ sourceId: "s0-p1-s1", targetId: "s0-p1-s1" }],
    });
    expect(result.checks.some((c) => c.check === "reconstruction" && c.outcome === "failed")).toBe(
      true,
    );
  });

  test("facsimile bytes matching declaredFacsimileDigest pass digest-chain", () => {
    const fakeBytes = new Uint8Array([1, 2, 3, 4]);
    const fakeDigest = createHash("sha256").update(fakeBytes).digest("hex");
    const result = assertEditionContract("brownian-motion", {
      ledgerText: LEDGER,
      declaredFacsimileDigest: fakeDigest,
      facsimileBytes: fakeBytes,
    });
    const digestCheck = result.checks.find(
      (c) => c.check === "digest-chain" && c.message === "Facsimile digest matches.",
    );
    expect(digestCheck).toBeDefined();
    expect(digestCheck?.outcome).toBe("passed");
  });

  test("PLANTED: facsimile bytes with wrong digest fail digest-chain with digest-mismatch", () => {
    const fakeBytes = new Uint8Array([1, 2, 3, 4]);
    const wrongDigest = "0000000000000000000000000000000000000000000000000000000000000000";
    const result = assertEditionContract("brownian-motion", {
      ledgerText: LEDGER,
      declaredFacsimileDigest: wrongDigest,
      facsimileBytes: fakeBytes,
    });
    expect(result.outcome).toBe("failed");
    const digestCheck = result.checks.find(
      (c) => c.check === "digest-chain" && c.code === "digest-mismatch",
    );
    expect(digestCheck).toBeDefined();
    expect(digestCheck?.outcome).toBe("failed");
  });

  test("PLANTED: declared facsimile digest without bytes in checkout reports not-available with code facsimile-not-available", () => {
    const result = assertEditionContract("brownian-motion", {
      ledgerText: LEDGER,
      root: "/nonexistent/checkout/root",
      declaredFacsimileDigest: "abcdef1234567890",
    });
    const check = result.checks.find((c) => c.code === "facsimile-not-available");
    expect(check).toBeDefined();
    expect(check?.outcome).toBe("not-available");
    expect(check?.message).toContain("Facsimile bytes are not in this checkout");
  });
});

describe("edition.yaml declaration", () => {
  test("a valid declaration with a human editor passes", () => {
    const result = validateEditionDeclaration({
      paper: "brownian-motion",
      bibliographicKey: "ap-17-549",
      facsimileDigest: "abc",
      ledgerDigest: "def",
      editors: ["jemanuel"],
    });
    expect(result.ok).toBe(true);
  });

  test("PLANTED: model-only editors fail; missing digest fails; unknown paper fails", () => {
    expect(
      validateEditionDeclaration({
        paper: "brownian-motion",
        bibliographicKey: "ap-17-549",
        facsimileDigest: "abc",
        ledgerDigest: "def",
        editors: ["gpt-5"],
      }).issues.some((i) => i.code === "model-only-editors"),
    ).toBe(true);
    expect(
      validateEditionDeclaration({
        paper: "brownian-motion",
        bibliographicKey: "ap-17-549",
        editors: ["jemanuel"],
      }).issues.some((i) => i.code === "missing-digest"),
    ).toBe(true);
    expect(
      validateEditionDeclaration({
        paper: "not-a-paper",
        bibliographicKey: "x",
        editors: ["jemanuel"],
      }).issues.some((i) => i.code === "unknown-paper"),
    ).toBe(true);
  });
});

describe("review-state seam", () => {
  test("the strict default refuses reviewed status; a test registration can accept one unit", () => {
    resetReviewStateCheck();
    expect(getReviewStateCheck()).toBe(strictNoReviewedCheck);
    const denied = strictNoReviewedCheck({
      unitId: "s0-p1-s1",
      paper: "brownian-motion",
      layer: "translation",
    });
    expect(denied.ok).toBe(false);
    expect(denied.code).toBe("review-records-not-available");
  });
});

describe("15-check composition with owner attribution (AC 5)", () => {
  test("assertEditionContract composes all 15 checks with check numbers, owners, and roles", () => {
    const ledgerDigest = createHash("sha256").update(LEDGER, "utf8").digest("hex");
    const result = assertEditionContract("brownian-motion", {
      ledgerText: LEDGER,
      editionText: LEDGER_EDITION_TEXT,
      declaredLedgerDigest: ledgerDigest,
      germanIds: ["s0-p1-s1", "s0-p1-s2"],
      englishIds: ["s0-p1-s1", "s0-p1-s2"],
      edges: [
        { sourceId: "s0-p1-s1", targetId: "s0-p1-s1" },
        { sourceId: "s0-p1-s2", targetId: "s0-p1-s2" },
      ],
    });

    for (const spec of CONTRACT_CHECKS_SPEC) {
      const match = result.checks.find((c) => c.checkNumber === spec.checkNumber);
      expect(match).toBeDefined();
      expect(match?.check).toBe(spec.check);
      expect(match?.owner).toBe(spec.owner);
      expect(match?.role).toBe(spec.role);
    }

    // Outcomes are named per check rather than asserted uniformly "passed" (am-06x1).
    // The blanket assertion held only because seven checks could not fail: they read
    // `options.X !== false` from options no production caller sets. Check 2 now invokes
    // validateLedger, which needs a reviewed ledger on disk with a receipt to reconcile
    // page counts against; this fixture supplies a ledger string, so the honest outcome
    // is not-available. Asserting it by name means a future change that silently turns it
    // back into an unconditional pass fails here.
    const outcomeOf = (n: number) => result.checks.find((c) => c.checkNumber === n)?.outcome;
    const codeOf = (n: number) => result.checks.find((c) => c.checkNumber === n)?.code;
    // The three checks whose subject matter does not exist in this tree, each named with
    // the reason it cannot look. Check 2 needs a reviewed ledger on disk with a receipt to
    // reconcile page counts against, and this fixture supplies a ledger string. Checks 9
    // and 12 need an English edition face and a declared hero quote, and measured on
    // 2026-09-19 no paper has either: no translation unit record exists anywhere under
    // content/, and no paper record declares a quote. Naming them keeps the count of
    // fifteen truthful about what is being asserted, and a future change that turns one
    // back into an unconditional pass fails here rather than reading as progress.
    //
    // EXTENDED 2026-09-20 (am-edn-alignment-tooling-do1 Unit 1). The comment above turned
    // out to understate the problem: five more checks were passing on an empty set for the
    // same reason check 8 was, and this fixture supplies none of their inputs. It passes a
    // ledger, an edition text, ids and edges - and no alignment components, no term
    // occurrences, no gloss input, no declaration or review units, and no spans. So checks
    // 10, 11, 13, 14 and 15 had nothing to examine and said "match", "valid", "valid and
    // current", "valid" and "are current" anyway. They now decline, and are named here with
    // their codes for the same reason the first three were: so a change that turns one back
    // into an unconditional pass fails here rather than reading as progress.
    // Check 2 LEFT this map on 2026-09-21 and that is not a relaxation. It declined
    // `ledger-not-on-disk` while brownian-motion had no transcript; ap-17-549 now has one,
    // so check 2 validates the ledger this fixture supplies and reports a real verdict.
    // It is asserted below with the substance of that verdict rather than dropped.
    const notAvailable = new Map<number, string>([
      [9, "english-face-absent"],
      [12, "hero-quote-not-declared"],
      [10, "inline-math-atoms-population-empty"],
      [11, "term-definitions-population-empty"],
      [13, "gloss-units-population-empty"],
      [14, "review-states-population-empty"],
      [15, "span-revision-currency-population-empty"],
    ]);
    for (const [checkNumber, code] of notAvailable) {
      expect(outcomeOf(checkNumber)).toBe("not-available");
      expect(codeOf(checkNumber)).toBe(code);
    }

    // Check 2's real verdict, pinned so it cannot decay into an unconditional pass: it
    // must have examined a ledger of the page count the receipt declares.
    expect(outcomeOf(2)).toBe("passed");
    expect(BROWNIAN_PRINTED_PAGES.length).toBeGreaterThan(1);
    expect(LEDGER).toContain(`PAGE 1 OF ${BROWNIAN_PRINTED_PAGES.length} ---`);
    for (const spec of CONTRACT_CHECKS_SPEC) {
      if (notAvailable.has(spec.checkNumber)) continue;
      expect(outcomeOf(spec.checkNumber)).toBe("passed");
    }
  });

  test("an absent ledger silences the thirteen that read it, and not the two that do not", () => {
    // REVISED 2026-09-20 (am-edn-alignment-tooling-do1). This asserted that ALL fifteen
    // report `ledger-absent`, which was asserting the defect: checks 5 and 6 never read the
    // ledger, and blanket-declining them left four real manifests, four real id snapshots
    // and four real alias files unexamined behind an unrelated missing input. Measured
    // against the real repository: supplying any ledger string at all made both PASS over
    // 25 real units for mass-energy and 87 for brownian-motion. They now run regardless,
    // and decline for their OWN reason when their own inputs are missing - which is what
    // this root, with no manifest at all, produces.
    const result = assertEditionContract("light-quanta", { root: "/nonexistent" });
    expect(result.ledger).toBe("absent");
    expect(result.outcome).toBe("not-available");

    // Check 1 joined these on 2026-09-20: only its LEDGER-digest half needs the ledger, and
    // its facsimile half needs a declaration and a PDF. It now declines for the input it is
    // actually missing rather than for somebody else's.
    const LEDGER_INDEPENDENT = new Set([1, 5, 6]);
    for (const spec of CONTRACT_CHECKS_SPEC) {
      const match = result.checks.find((c) => c.checkNumber === spec.checkNumber);
      expect(match).toBeDefined();
      expect(match?.owner).toBe(spec.owner);
      expect(match?.role).toBe(spec.role);
      expect(match?.outcome).toBe("not-available");
      if (LEDGER_INDEPENDENT.has(spec.checkNumber)) {
        // Its own reason, not somebody else's missing input - and each gives a DIFFERENT
        // one, which is the point: check 5 cannot load a manifest, check 6 cannot find an
        // id snapshot. A shared code would have told the reader less than two do.
        expect(match?.code).not.toBe("ledger-absent");
        expect(match?.code).toBe(
          spec.checkNumber === 1
            ? "edition-declaration-absent"
            : spec.checkNumber === 5
              ? "manifest-not-loadable"
              : "id-snapshot-absent",
        );
      } else {
        expect(match?.code).toBe("ledger-absent");
      }
    }
  });

  test("checks 5 and 6 judge real manifests WHETHER OR NOT a ledger is present", () => {
    // Asserted against the REAL repository rather than a fixture: these two read the
    // manifest and the id snapshot, not the ledger, so they must judge either way.
    //
    // This test wrote `expect(r.ledger).toBe("absent")` until 2026-09-20, which pinned the
    // absence as well as the property. Ledger state is now asserted PER PAPER so the pair
    // SPANS both states: a regression that re-gated these checks behind the ledger fails on
    // the ledgerless paper while passing on the other, and is therefore visible rather than
    // uniform.
    //
    // THE REAL-CORPUS SPECIMEN RAN OUT, exactly as the previous re-point said it would, and
    // within the hour. brownian-motion held this role until it was transcribed; then
    // light-quanta, until ap-17-132 was finished; then special-relativity, which acquired a
    // skeleton in 30ab1df0 minutes later and is now partial and still moving.
    // molecular-dimensions is the only paper left with no ledger and it has NO MANIFEST, so
    // checks 5 and 6 report not-available there and cannot show they judge a real manifest.
    //
    // So this stops chasing a specimen. The pair is now a real paper, to prove the checks judge
    // real authored bytes, and one CONSTRUCTED root evaluated twice - with and without its
    // transcripts directory - to prove the verdict does not depend on the ledger.
    //
    // The constructed half is the stronger demonstration and would have been the better test
    // all along: same manifest, same unit count, the ledger as the ONLY variable. Two different
    // papers differ in a hundred ways, so a pair drawn from the corpus could never say which
    // difference the checks were responding to. Nothing is deleted to build it: the copy is
    // taken with a filter that never copies the transcripts directory in the first place.
    for (const [slug, units, ledger] of [["mass-energy", 25, "complete"]] as const) {
      const r = assertEditionContract(slug, {});
      expect(r.ledger, `${slug}'s ledger state changed; this pair must span both`).toBe(ledger);
      const five = r.checks.find((c) => c.checkNumber === 5);
      const six = r.checks.find((c) => c.checkNumber === 6);
      expect(five?.outcome, `check 5 must judge ${slug}'s real manifest`).toBe("passed");
      expect(five?.message).toContain(`${units} unit(s) validated`);
      expect(six?.outcome, `check 6 must judge ${slug}'s real id snapshot`).toBe("passed");
    }

    // The same root twice. Only the ledger differs.
    const withLedger = "src/testing/fixtures/editions/mini-paper";
    const withoutLedger = mkdtempSync(join(tmpdir(), "am-06x1-noledger-"));
    cpSync(withLedger, withoutLedger, {
      recursive: true,
      filter: (src) => !src.includes(`${sep}transcripts`),
    });

    const unitCounts = new Set<string | undefined>();
    for (const [label, root, ledger] of [
      ["with its ledger", withLedger, "complete"],
      ["with no transcripts directory", withoutLedger, "absent"],
    ] as const) {
      const r = assertEditionContract("mass-energy", { root });
      expect(r.ledger, `${label}: the pair must span both ledger states`).toBe(ledger);
      const five = r.checks.find((c) => c.checkNumber === 5);
      const six = r.checks.find((c) => c.checkNumber === 6);
      expect(five?.outcome, `check 5 must judge the manifest ${label}`).toBe("passed");
      expect(six?.outcome, `check 6 must judge the id snapshot ${label}`).toBe("passed");
      unitCounts.add(/(\d+) unit\(s\) validated/.exec(String(five?.message))?.[1]);
    }
    // The controlled variable, asserted. Both runs validated the SAME number of units, so the
    // ledger changed and the manifest verdict did not. Without this the pair could pass while
    // the two roots disagreed about what they were judging.
    expect(unitCounts.size, `both runs must judge one manifest, got ${[...unitCounts]}`).toBe(1);
    expect([...unitCounts][0]).toBe("6");
  });
});

describe("mutation fixtures for implemented contract checks (AC 5)", () => {
  test("PLANTED check 4 mutation: count reconciliation mismatch fails with count-reconciliation-mismatch", () => {
    const result = assertEditionContract("brownian-motion", {
      ledgerText: LEDGER,
      perPageCountsMatch: false,
    });
    const check4 = result.checks.find((c) => c.checkNumber === 4);
    expect(check4).toBeDefined();
    expect(check4?.outcome).toBe("failed");
    expect(check4?.code).toBe("count-reconciliation-mismatch");
  });

  test("PLANTED check 6 mutation: uncovered id removal fails with id-snapshot-uncovered", () => {
    const result = assertEditionContract("brownian-motion", {
      ledgerText: LEDGER,
      idSnapshotClean: false,
    });
    const check6 = result.checks.find((c) => c.checkNumber === 6);
    expect(check6).toBeDefined();
    expect(check6?.outcome).toBe("failed");
    expect(check6?.code).toBe("id-snapshot-uncovered");
  });

  test("PLANTED check 10 mutation: inline math atom mismatch fails with math-atoms-differ", () => {
    const result = assertEditionContract("brownian-motion", {
      ledgerText: LEDGER,
      components: [
        {
          germanUnits: [{ id: "s1-p1-s1", mathAtoms: ["V"] }],
          englishUnits: [{ id: "s1-p1-s1", mathAtoms: ["c"] }],
        },
      ],
    });
    const check10 = result.checks.find((c) => c.checkNumber === 10);
    expect(check10).toBeDefined();
    expect(check10?.outcome).toBe("failed");
    expect(check10?.code).toBe("math-atoms-differ");
  });

  test("PLANTED check 13 mutation: gloss unit addressing an unknown unit fails with gloss-unit-unknown", () => {
    const result = assertEditionContract("brownian-motion", {
      ledgerText: LEDGER,
      glossInput: {
        glossUnits: [
          {
            sentenceId: "s1-p1-s99", // Unknown alignable unit
            attribution: { id: "alice", kind: "human" },
            editor: { id: "bob", kind: "human" },
            glosses: [{ tokenIndex: 0, text: "word" }],
          },
        ],
        alignableUnits: [{ id: "s1-p1-s1", text: "word" }],
      },
    });
    const check13 = result.checks.find((c) => c.checkNumber === 13);
    expect(check13).toBeDefined();
    expect(check13?.outcome).toBe("failed");
    expect(check13?.code).toBe("gloss-unit-unknown");
  });

  test("PLANTED check 14 mutation: unreviewed unit under requireReviewed fails with unit-not-reviewed", () => {
    const result = assertEditionContract("brownian-motion", {
      ledgerText: LEDGER,
      requireReviewed: true,
      reviewUnits: [
        {
          id: "s1-p1-s1",
          reviewState: "drafted",
          translator: { id: "alice", kind: "human" },
        },
      ],
    });
    const check14 = result.checks.find((c) => c.checkNumber === 14);
    expect(check14).toBeDefined();
    expect(check14?.outcome).toBe("failed");
    expect(check14?.code).toBe("unit-not-reviewed");
  });
});

describe("Check 15: span revision currency and separate failure reporting (AC 6)", () => {
  const plainText = "Die Brownsche Bewegung";
  const slice = plainText.slice(0, 13); // "Die Brownsche"
  const validDigest = spanTextDigest(slice);

  test("PLANTED: block revision bumped with no text change reports span-revision-stale and NOT span-digest-mismatch", () => {
    // Current block revision is 2, span recorded at revision 1, digest matches slice
    const result = assertEditionContract("brownian-motion", {
      ledgerText: LEDGER,
      spans: [
        {
          spanId: "span-1",
          span: { start: 0, end: 13, blockRevision: 1, textDigest: validDigest },
          currentBlockRevision: 2,
          plainText,
        },
      ],
    });

    const check15 = result.checks.find((c) => c.checkNumber === 15);
    expect(check15).toBeDefined();
    expect(check15?.outcome).toBe("failed");
    expect(check15?.code).toBe("span-revision-stale");
    expect(check15?.message).toContain("span-revision-stale");
    expect(check15?.message).not.toContain("span-digest-mismatch");
  });

  test("PLANTED: text edited without re-measuring spans reports span-digest-mismatch and NOT span-revision-stale", () => {
    // Current block revision is 1, span revision is 1 (current), but digest does not match
    const result = assertEditionContract("brownian-motion", {
      ledgerText: LEDGER,
      spans: [
        {
          spanId: "span-2",
          span: {
            start: 0,
            end: 13,
            blockRevision: 1,
            textDigest: "0000000000000000000000000000000000000000000000000000000000000000",
          },
          currentBlockRevision: 1,
          plainText,
        },
      ],
    });

    const check15 = result.checks.find((c) => c.checkNumber === 15);
    expect(check15).toBeDefined();
    expect(check15?.outcome).toBe("failed");
    expect(check15?.code).toBe("span-digest-mismatch");
    expect(check15?.message).toContain("span-digest-mismatch");
    expect(check15?.message).not.toContain("span-revision-stale");
  });

  test("PLANTED: span failing both stale revision and mismatched digest reports BOTH separately", () => {
    const issues = validateSpanRevisionCurrency([
      {
        spanId: "span-both",
        span: {
          start: 0,
          end: 13,
          blockRevision: 1,
          textDigest: "0000000000000000000000000000000000000000000000000000000000000000",
        },
        currentBlockRevision: 2,
        plainText,
      },
    ]);

    expect(issues).toHaveLength(2);
    expect(issues.some((i) => i.code === "span-revision-stale")).toBe(true);
    expect(issues.some((i) => i.code === "span-digest-mismatch")).toBe(true);
  });

  test("spans with current revision and matching digest pass check 15 cleanly", () => {
    const result = assertEditionContract("brownian-motion", {
      ledgerText: LEDGER,
      spans: [
        {
          spanId: "span-valid",
          span: { start: 0, end: 13, blockRevision: 1, textDigest: validDigest },
          currentBlockRevision: 1,
          plainText,
        },
      ],
    });

    const check15 = result.checks.find((c) => c.checkNumber === 15);
    expect(check15).toBeDefined();
    expect(check15?.outcome).toBe("passed");
    expect(check15?.code).toBeUndefined();
  });
});

/**
 * The contract's half of "both entry points call the REGISTERED check".
 *
 * The bead requires that align-editions.ts and assertEditionContract both consult the
 * registration rather than implementing a review rule of their own, and the align side
 * already has that pair. The contract side had none, so nothing in the tree showed that
 * check 14 goes through the registry at all.
 *
 * The discriminating case is an ACCEPTING registration, not a rejecting one. The
 * shipped default rejects every `reviewed` state, so a hardcoded "reviewed is never
 * allowed" rule inside the contract would pass a rejecting-registration test while
 * consulting nothing. Only a registration that accepts one unit can tell the two apart.
 */
describe("check 14 consults the registered review-state check (am-edn-alignment-tooling-do1)", () => {
  const reviewedUnit = {
    id: "s1-p1-s1",
    reviewState: "reviewed" as const,
    translator: { id: "alice", kind: "human" as const },
    editor: { id: "bob", kind: "human" as const },
  };
  const check14Of = () =>
    assertEditionContract("brownian-motion", {
      ledgerText: LEDGER,
      reviewUnits: [reviewedUnit],
    }).checks.find((c) => c.checkNumber === 14);

  test("the shipped default refuses a reviewed unit with review-records-not-available", () => {
    resetReviewStateCheck();
    const check14 = check14Of();
    expect(check14?.outcome).toBe("failed");
    expect(check14?.code).toBe("review-records-not-available");
  });

  test("a registration accepting that unit makes the same input pass, and resetting refuses it again", () => {
    resetReviewStateCheck();
    expect(check14Of()?.outcome).toBe("failed");

    registerReviewStateCheck((request) =>
      request.unitId === "s1-p1-s1"
        ? { ok: true }
        : { ok: false, code: "review-records-not-available", message: "denied" },
    );
    try {
      expect(check14Of()?.outcome).toBe("passed");
    } finally {
      // Restored whatever the assertion did: a leaked registration would silently
      // accept reviewed units for every test that runs after this one.
      resetReviewStateCheck();
    }
    expect(check14Of()?.outcome).toBe("failed");
    expect(getReviewStateCheck()).toBe(strictNoReviewedCheck);
  });
});

describe("PLANT (am-06x1): check 7 corrupts the DATA, not the flag", () => {
  test("a page marker left in the edition text fails check 7", () => {
    const corrupted = "--- REVIEWED TRANSCRIPTION PAGE 3 OF 12 --- Die Bewegung ist unregelmäßig.";
    const result = assertEditionContract("brownian-motion", {
      ledgerText: LEDGER,
      editionText: corrupted,
    });
    const check7 = result.checks.find((c) => c.checkNumber === 7);
    expect(check7?.outcome).toBe("failed");
    expect(check7?.code).toBe("ledger-marker-in-edition");
  });
});

/**
 * Planted negatives for the three checks that read their answer from disk (am-06x1).
 *
 * Checks 4, 5 and 6 each used to be `options.X !== false`, which no production caller
 * sets, so each announced a positive result for every edition having opened no file.
 * The negative a pass-through fails is not "the real corpus is clean" - a pass-through
 * says that too - it is "a corrupted corpus goes red and an unreachable one says so".
 * Each plant copies the real production files and perturbs the copy, so the plant tracks
 * the corpus instead of freezing a fixture beside it, and the real files are never
 * written to. The perturbations are read out of the data (the first locator page, the
 * first retired id) rather than spelled out here, so renumbering the paper cannot quietly
 * turn a plant into a no-op.
 */
describe("PLANT (am-06x1): checks 4, 5 and 6 corrupt the DATA, not the flag", () => {
  const SLUG = "brownian-motion";
  const BIB_KEY = "ap-17-549";
  const MANIFEST_REL = `content/source-blocks/${SLUG}/manifest.yaml`;
  const SNAPSHOT_REL = `content/source-blocks/${SLUG}/manifest.ids.snapshot.txt`;
  const ALIAS_REL = `content/aliases/${SLUG}.yaml`;
  const RECEIPT_REL = `docs/provenance/${BIB_KEY}.md`;

  /** A temp root holding byte copies of the four production files the checks read. */
  const copyCorpus = (): string => {
    const root = mkdtempSync(join(tmpdir(), "am-06x1-contract-"));
    for (const rel of [MANIFEST_REL, SNAPSHOT_REL, ALIAS_REL, RECEIPT_REL]) {
      mkdirSync(join(root, dirname(rel)), { recursive: true });
      copyFileSync(join(process.cwd(), rel), join(root, rel));
    }
    return root;
  };

  const checkAt = (root: string, checkNumber: number) =>
    assertEditionContract(SLUG, { root, ledgerText: LEDGER }).checks.find(
      (c) => c.checkNumber === checkNumber,
    );

  test("the copied corpus is green before anything is perturbed", () => {
    const root = copyCorpus();
    for (const n of [4, 5, 6]) {
      expect(checkAt(root, n)?.outcome).toBe("passed");
    }
  });

  test("check 4 fails when a display equation moves to the next printed page", () => {
    const root = copyCorpus();
    const manifestPath = join(root, MANIFEST_REL);
    const text = readFileSync(manifestPath, "utf8");
    // Move the last display equation of section 2 one printed page on. The receipt still
    // lists it on the page it was printed on, so the page map and the manifest disagree.
    const match = text.match(/( {2}- id: eq-s2-d10\n(?: {4}.*\n)*? {6}- page: )(\d+)/);
    expect(match).not.toBeNull();
    const page = Number.parseInt(match?.[2] ?? "0", 10);
    expect(page).toBeGreaterThan(0);
    writeFileSync(
      manifestPath,
      text.replace(match?.[0] ?? "", `${match?.[1] ?? ""}${page + 1}`),
      "utf8",
    );
    const check4 = checkAt(root, 4);
    expect(check4?.outcome).toBe("failed");
    expect(check4?.code).toBe("count-reconciliation-mismatch");
    expect(check4?.message).toContain("unnumberedIds");
    // The perturbation is a page map disagreement, not an id one: check 6 stays green,
    // so a single red check cannot be read as every check firing at once.
    expect(checkAt(root, 6)?.outcome).toBe("passed");
  });

  test("check 4 fails when a refined page loses its refinedBy stamp", () => {
    const root = copyCorpus();
    const receiptPath = join(root, RECEIPT_REL);
    const lines = readFileSync(receiptPath, "utf8").split("\n");
    const index = lines.findIndex((line) => line.trim().startsWith("refinedBy:"));
    expect(index).toBeGreaterThan(-1);
    lines.splice(index, 1);
    writeFileSync(receiptPath, lines.join("\n"), "utf8");
    const check4 = checkAt(root, 4);
    expect(check4?.outcome).toBe("failed");
    expect(check4?.message).toContain("refinedBy");
  });

  test("check 5 fails when a locator leaves the paper's printed range", () => {
    const root = copyCorpus();
    const manifestPath = join(root, MANIFEST_REL);
    const text = readFileSync(manifestPath, "utf8");
    const first = text.indexOf("      - page: ");
    expect(first).toBeGreaterThan(-1);
    const end = text.indexOf("\n", first);
    writeFileSync(
      manifestPath,
      `${text.slice(0, first)}      - page: 9999${text.slice(end)}`,
      "utf8",
    );
    const check5 = checkAt(root, 5);
    expect(check5?.outcome).toBe("failed");
    expect(check5?.code).toBe("manifest-coverage-mismatch");
    expect(check5?.message).toContain("page-out-of-range");
  });

  test("check 6 fails when a retired id comes back as a live unit", () => {
    const root = copyCorpus();
    const manifestPath = join(root, MANIFEST_REL);
    const text = readFileSync(manifestPath, "utf8");
    const aliases = parseYaml(readFileSync(join(root, ALIAS_REL), "utf8")) as {
      aliases?: { retiredId?: string; replacementIds?: string[] }[];
    };
    const retired = aliases.aliases?.[0]?.retiredId;
    const successor = aliases.aliases?.[0]?.replacementIds?.[0];
    expect(typeof retired).toBe("string");
    expect(typeof successor).toBe("string");
    // Revive the retired id beside the unit that absorbed it, on the same printed page, so
    // the manifest stays internally ordered and only the id snapshot has been broken.
    const anchor = text.match(
      new RegExp(`( {2}- id: ${successor}\\n(?: {4}.*\\n)*?) {6}- page: (\\d+)`),
    );
    expect(anchor).not.toBeNull();
    const page = anchor?.[2];
    const revived = [
      `  - id: ${retired}`,
      "    kind: paragraph",
      `    section: ${String(retired).split("-")[0]}`,
      "    locators:",
      `      - page: ${page}`,
      "    destination:",
      `      editionBlockId: de-${SLUG}-${retired}`,
      "      translationUnits:",
      "        - planned",
      "",
      "",
    ].join("\n");
    writeFileSync(manifestPath, text.replace(anchor?.[0] ?? "", `${revived}${anchor?.[0] ?? ""}`));
    const check6 = checkAt(root, 6);
    expect(check6?.outcome).toBe("failed");
    expect(check6?.code).toBe("id-snapshot-uncovered");
    expect(check6?.message).toContain("retired-id-reused");
    // The manifest validator is content with the revived unit - it is well formed, in
    // order, and it closes the gap the alias explained - so check 5 passes. Check 6 is
    // not a second reading of check 5's diagnostics.
    expect(checkAt(root, 5)?.outcome).toBe("passed");
  });

  test("check 6 fails when a frozen id leaves the manifest without an alias", () => {
    const root = copyCorpus();
    const manifestPath = join(root, MANIFEST_REL);
    const text = readFileSync(manifestPath, "utf8");
    const block = text.match(/ {2}- id: eq-s2-d10\n(?: {4}.*\n)*/);
    expect(block).not.toBeNull();
    writeFileSync(manifestPath, text.replace(block?.[0] ?? "", ""), "utf8");
    const check6 = checkAt(root, 6);
    expect(check6?.outcome).toBe("failed");
    expect(check6?.message).toContain("frozen-id-missing");
  });

  test("check 12 fails on a declared hero quote that is not in the edition text", () => {
    const root = copyCorpus();
    mkdirSync(join(root, "content/papers"), { recursive: true });
    const record = JSON.parse(
      readFileSync(join(process.cwd(), `content/papers/${SLUG}.json`), "utf8"),
    ) as Record<string, unknown>;
    // The owner's checkHeroQuoteUnresolved reads heroQuote, heroQuotes and pullQuotes; this
    // is the first of those three shapes, declaring a sentence the edition does not contain.
    record.heroQuote = {
      anchor: "s0-p1-s1",
      text: "Diesen Satz hat Einstein nie geschrieben.",
    };
    writeFileSync(join(root, `content/papers/${SLUG}.json`), JSON.stringify(record), "utf8");
    const failing = assertEditionContract(SLUG, {
      root,
      ledgerText: LEDGER,
      editionText: LEDGER_EDITION_TEXT,
    }).checks.find((c) => c.checkNumber === 12);
    expect(failing?.outcome).toBe("failed");
    expect(failing?.code).toBe("hero-quote-unresolved");

    // The same check passes on a quote the edition does contain, so the failure above is
    // the quote and not the plumbing: a check that always fails proves as little as one
    // that always passes. Whitespace is collapsed and case and punctuation are preserved,
    // which is the rule the owner applies.
    record.heroQuote = { anchor: "s0-p1-s1", text: "Die   Bewegung ist\n unregelmäßig." };
    writeFileSync(join(root, `content/papers/${SLUG}.json`), JSON.stringify(record), "utf8");
    const resolving = assertEditionContract(SLUG, {
      root,
      ledgerText: LEDGER,
      editionText: LEDGER_EDITION_TEXT,
    }).checks.find((c) => c.checkNumber === 12);
    expect(resolving?.outcome).toBe("passed");
    expect(resolving?.message).toContain("1 quote(s) checked");
  });

  test("checks 9 and 12 report what is missing by name, never a pass", () => {
    const root = copyCorpus();
    mkdirSync(join(root, "content/papers"), { recursive: true });
    copyFileSync(
      join(process.cwd(), `content/papers/${SLUG}.json`),
      join(root, `content/papers/${SLUG}.json`),
    );
    const checks = assertEditionContract(SLUG, { root, ledgerText: LEDGER }).checks;
    const check9 = checks.find((c) => c.checkNumber === 9);
    const check12 = checks.find((c) => c.checkNumber === 12);
    expect(check9?.outcome).toBe("not-available");
    expect(check9?.code).toBe("english-face-absent");
    // The count is read out of the manifest, so a check that stopped looking would stop
    // being able to say how many display equations are waiting.
    expect(check9?.message).toMatch(/\d+ display equation\(s\) are declared/);
    expect(check12?.outcome).toBe("not-available");
    expect(check12?.code).toBe("hero-quote-not-declared");
    for (const check of [check9, check12]) {
      expect(check?.outcome).not.toBe("passed");
    }
  });

  test("an unreachable corpus reports not-available, which a pass-through never does", () => {
    const root = mkdtempSync(join(tmpdir(), "am-06x1-empty-"));
    const check4 = checkAt(root, 4);
    const check5 = checkAt(root, 5);
    const check6 = checkAt(root, 6);
    expect(check4?.outcome).toBe("not-available");
    expect(check4?.code).toBe("reconciliation-inputs-absent");
    expect(check5?.outcome).toBe("not-available");
    expect(check5?.code).toBe("manifest-not-loadable");
    expect(check6?.outcome).toBe("not-available");
    expect(check6?.code).toBe("id-snapshot-absent");
    for (const check of [check4, check5, check6]) {
      expect(check?.outcome).not.toBe("passed");
    }
  });
});

/**
 * (editionContract.ts:815) invalid-route-slug.
 *
 * The line was established by planting, not by adding the drift: renaming that site's code turns
 * exactly the two tests below red and nothing else in the file. My first draft cited 802, from a
 * scan taken before I reworded a comment four lines above it - which is the drift this whole class
 * of citation keeps producing, committed by me an hour after I reported it.
 *
 * This refusal was `throw new Error(parsed.error)` until 2026-09-21: invisible to the bare-throw
 * ratchet as an uncoded refusal, and invisible to the untested-refusal scanner entirely, because a
 * built-in Error carries no code to attribute a test to. A caller handed a bad slug received a
 * string and had nothing to branch on.
 */
describe("assertEditionContract refuses a slug that is not a route", () => {
  test("(editionContract.ts:815) a non-route slug is refused with a code, naming the legal slugs", () => {
    let caught: unknown;
    try {
      assertEditionContract("brownian");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(EditionContractError);
    const error = caught as EditionContractError;
    expect(error.code).toBe("invalid-route-slug");
    expect(error.name).toBe("EditionContractError");
    // The message carries the parser's own detail, so the code did not cost the reader the reason.
    expect(error.message).toContain("brownian");
    expect(error.message).toContain("brownian-motion");

    // Still an Error, so any caller catching Error keeps working.
    expect(caught).toBeInstanceOf(Error);
  });

  test("the code is a LITERAL, so it cannot vary with the input that produced it", () => {
    // Three different bad slugs, one code. Written because the obvious repair here was
    // `parsed.rule ?? "..."`, which a scanner reading the first argument cannot see through and
    // which no targeted test can pin (am-utmv).
    for (const slug of ["brownian", "", "../etc/passwd"]) {
      let code: unknown;
      try {
        assertEditionContract(slug);
      } catch (err) {
        code = (err as EditionContractError).code;
      }
      expect(code).toBe("invalid-route-slug");
    }
  });

  test("a real route slug does NOT reach this refusal", () => {
    // Without this the test above would pass over a function that refused everything.
    expect(() => assertEditionContract("brownian-motion", {})).not.toThrow();
  });
});

test("receiptPrintedPages reads the page map, not every printedPage in the receipt", () => {
  // Denominators named. ap-17-549: 12 map entries, 1 typo record carrying printedPage, so a
  // whole-file scan gives 13. ap-17-891: 31 map entries, 6 typo records, whole-file 37.
  expect(BROWNIAN_PRINTED_PAGES.length).toBe(12);
  expect(RELATIVITY_PRINTED_PAGES.length).toBe(31);

  // Contiguous printed ranges, which a contaminated count cannot produce: a typo record's
  // printedPage repeats a page already in the map, so the set would be smaller than the list.
  expect(new Set(BROWNIAN_PRINTED_PAGES).size).toBe(BROWNIAN_PRINTED_PAGES.length);
  expect(new Set(RELATIVITY_PRINTED_PAGES).size).toBe(RELATIVITY_PRINTED_PAGES.length);
  expect(BROWNIAN_PRINTED_PAGES[0]).toBe(549);
  expect(BROWNIAN_PRINTED_PAGES[BROWNIAN_PRINTED_PAGES.length - 1]).toBe(560);
  expect(RELATIVITY_PRINTED_PAGES[0]).toBe(891);
  expect(RELATIVITY_PRINTED_PAGES[RELATIVITY_PRINTED_PAGES.length - 1]).toBe(921);
});

/**
 * The five refusal sites in editionContract.ts that nothing drove (am-r3qt).
 *
 * MEASURED BEFORE WRITING, not assumed. Each of the five was planted - its code string
 * replaced - and run against the eight test files that import editionContract.ts. None of
 * them reddened anything, so none was "driven but uncited" and no repoint was available.
 * They are genuinely undriven, which is why these are new cases rather than citations added
 * to existing ones.
 *
 * WHY NOT ONE PARAMETERISED RECIPE. Each check needs a DIFFERENT precondition before it will
 * judge rather than decline: 776 needs the ledger ABSENT, 1016 needs it PRESENT, 1097 and
 * 1429 take booleans, and 1751 needs germanIds/englishIds asymmetry. A shared fixture would
 * have produced five tests that all fail on `ledger-absent` - one guard wearing five names,
 * and the count is what would make it look like coverage.
 *
 * THE DENOMINATOR THAT MAKES THAT REAL: run against the bare brownian fixture with no ledger,
 * this contract reports checksSpecified 15, checksJudged 2, checksDeclined 13. Thirteen of
 * fifteen decline. A negative case that does not supply its check's precondition is not a
 * weak test, it is a test of nothing.
 *
 * Each case therefore asserts TWO things: its own code is present, and the other four are
 * absent. The second is what makes the first mean anything - without it, a fixture that
 * broke everything would satisfy all five.
 */
describe("am-r3qt: the five undriven refusal sites in editionContract.ts", () => {
  const THE_FIVE = [
    "digest-mismatch",
    "ledger-not-clean",
    "display-math-bytes-differ",
    "translation-incomplete",
  ] as const;

  function codesIn(result: { checks: readonly { code?: string | undefined }[] }): Set<string> {
    return new Set(result.checks.map((c) => c.code).filter((c): c is string => Boolean(c)));
  }

  /** Asserts the target code fired and no OTHER member of the five did. */
  function onlyThisOne(
    result: { checks: readonly { code?: string | undefined }[] },
    target: (typeof THE_FIVE)[number],
  ): void {
    const codes = codesIn(result);
    expect(codes.has(target), `${target} must fire; got [${[...codes].join(", ")}]`).toBe(true);
    for (const other of THE_FIVE) {
      if (other === target) continue;
      expect(codes.has(other), `${other} must NOT fire in the ${target} case`).toBe(false);
    }
  }

  /** mini-paper carries edition.yaml, a placeholder PDF and a transcripts ledger. */
  function miniPaperRoot(withLedger: boolean): string {
    const root = mkdtempSync(join(tmpdir(), "am-r3qt-"));
    cpSync("src/testing/fixtures/editions/mini-paper", root, {
      recursive: true,
      filter: (src) => withLedger || !src.includes(`${sep}transcripts`),
    });
    return root;
  }

  function corruptTheFacsimile(root: string): void {
    const pdf = join(root, "public/papers/pdfs/ap-18-639.pdf");
    writeFileSync(pdf, `${readFileSync(pdf, "utf8")}\n% one byte the declaration does not know\n`);
  }

  test("(editionContract.ts:776) facsimile digest, ledger ABSENT, fires digest-mismatch", () => {
    const root = miniPaperRoot(false);
    corruptTheFacsimile(root);
    const result = assertEditionContract("mass-energy", { root });
    expect(result.ledger, "776 is the ledger-absent path; with a ledger it is 1016").toBe("absent");
    onlyThisOne(result, "digest-mismatch");
  });

  test("(editionContract.ts:1016) facsimile digest, ledger PRESENT, fires digest-mismatch", () => {
    const root = miniPaperRoot(true);
    corruptTheFacsimile(root);
    // Equal id counts so translation-completeness PASSES: without them the root-based
    // fixture supplies none, completeness is not "complete", and translation-incomplete
    // co-fires. The isolation assertion caught that, which is what it is for.
    const result = assertEditionContract("mass-energy", {
      root,
      germanIds: ["s0-p1-s1"],
      englishIds: ["s0-p1-s1"],
      edges: [{ sourceId: "s0-p1-s1", targetId: "s0-p1-s1" }],
    });
    expect(result.ledger, "1016 is the ledger-present path; without one it is 776").not.toBe(
      "absent",
    );
    onlyThisOne(result, "digest-mismatch");
  });

  test("(editionContract.ts:1097) an unclean ledger fires ledger-not-clean", () => {
    const result = assertEditionContract("brownian-motion", {
      ledgerText: LEDGER,
      editionText: LEDGER_EDITION_TEXT,
      declaredLedgerDigest: createHash("sha256").update(LEDGER, "utf8").digest("hex"),
      germanIds: ["s0-p1-s1", "s0-p1-s2"],
      englishIds: ["s0-p1-s1", "s0-p1-s2"],
      edges: [
        { sourceId: "s0-p1-s1", targetId: "s0-p1-s1" },
        { sourceId: "s0-p1-s2", targetId: "s0-p1-s2" },
      ],
      displayMathMatches: true,
      ledgerClean: false,
    });
    onlyThisOne(result, "ledger-not-clean");
  });

  test("(editionContract.ts:1429) differing display math fires display-math-bytes-differ", () => {
    const result = assertEditionContract("brownian-motion", {
      ledgerText: LEDGER,
      editionText: LEDGER_EDITION_TEXT,
      declaredLedgerDigest: createHash("sha256").update(LEDGER, "utf8").digest("hex"),
      germanIds: ["s0-p1-s1", "s0-p1-s2"],
      englishIds: ["s0-p1-s1", "s0-p1-s2"],
      edges: [
        { sourceId: "s0-p1-s1", targetId: "s0-p1-s1" },
        { sourceId: "s0-p1-s2", targetId: "s0-p1-s2" },
      ],
      ledgerClean: true,
      displayMathMatches: false,
    });
    onlyThisOne(result, "display-math-bytes-differ");
  });

  test("(editionContract.ts:1751) an unaligned German id fires translation-incomplete", () => {
    const result = assertEditionContract("brownian-motion", {
      ledgerText: LEDGER,
      editionText: LEDGER_EDITION_TEXT,
      declaredLedgerDigest: createHash("sha256").update(LEDGER, "utf8").digest("hex"),
      // One German alignable with no English unit: the asymmetry IS the refusal.
      germanIds: ["s0-p1-s1", "s0-p1-s2"],
      englishIds: ["s0-p1-s1"],
      edges: [{ sourceId: "s0-p1-s1", targetId: "s0-p1-s1" }],
      ledgerClean: true,
      displayMathMatches: true,
    });
    onlyThisOne(result, "translation-incomplete");
  });
});
