import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { load as parseYaml } from "js-yaml";
import {
  assertEditionContract,
  CONTRACT_CHECKS_SPEC,
  validateSpanRevisionCurrency,
} from "../../content/editions/editionContract.ts";
import { validateEditionDeclaration } from "../../content/editions/editionDeclaration.ts";
import {
  getReviewStateCheck,
  resetReviewStateCheck,
  strictNoReviewedCheck,
} from "../../content/editions/reviewState.ts";
import { spanTextDigest } from "../../content/schemas/spans.ts";
import { getLogger } from "../log/logger.ts";

const logger = getLogger("editions");
const BEAD = "am-edn-alignment-tooling-do1";

const LEDGER = `--- REVIEWED TRANSCRIPTION PAGE 1 OF 1 ---
Die Bewegung ist unregelmäßig. Sie hört nicht auf.
`;

describe("assertEditionContract", () => {
  test("a present ledger with matching reconstruction and id-edges passes", () => {
    const ledgerDigest = createHash("sha256").update(LEDGER, "utf8").digest("hex");
    const result = assertEditionContract("brownian-motion", {
      ledgerText: LEDGER,
      editionText: "Die Bewegung ist unregelmäßig. Sie hört nicht auf.",
      declaredLedgerDigest: ledgerDigest,
      germanIds: ["s0-p1-s1", "s0-p1-s2"],
      englishIds: ["s0-p1-s1", "s0-p1-s2"],
      edges: [
        { sourceId: "s0-p1-s1", targetId: "s0-p1-s1" },
        { sourceId: "s0-p1-s2", targetId: "s0-p1-s2" },
      ],
    });
    expect(result.ledger).toBe("present");
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
      editionText: "Die Bewegung ist unregelmäßig. Sie hört nicht auf.",
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
    const notAvailable = new Map<number, string>([
      [2, "ledger-not-on-disk"],
      [9, "english-face-absent"],
      [12, "hero-quote-not-declared"],
    ]);
    for (const [checkNumber, code] of notAvailable) {
      expect(outcomeOf(checkNumber)).toBe("not-available");
      expect(codeOf(checkNumber)).toBe(code);
    }
    for (const spec of CONTRACT_CHECKS_SPEC) {
      if (notAvailable.has(spec.checkNumber)) continue;
      expect(outcomeOf(spec.checkNumber)).toBe("passed");
    }
  });

  test("when ledger is absent, all 15 checks are reported as not-available with owner attribution", () => {
    const result = assertEditionContract("light-quanta", { root: "/nonexistent" });
    expect(result.ledger).toBe("absent");
    expect(result.outcome).toBe("not-available");

    for (const spec of CONTRACT_CHECKS_SPEC) {
      const match = result.checks.find((c) => c.checkNumber === spec.checkNumber);
      expect(match).toBeDefined();
      expect(match?.owner).toBe(spec.owner);
      expect(match?.role).toBe(spec.role);
      expect(match?.outcome).toBe("not-available");
      expect(match?.code).toBe("ledger-absent");
    }
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
      editionText: "Die Bewegung ist unregelmäßig. Sie hört nicht auf.",
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
      editionText: "Die Bewegung ist unregelmäßig. Sie hört nicht auf.",
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
