import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
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
      expect(match?.outcome).toBe("passed");
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
