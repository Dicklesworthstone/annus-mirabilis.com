import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { assertEditionContract } from "../../content/editions/editionContract.ts";
import { validateEditionDeclaration } from "../../content/editions/editionDeclaration.ts";
import {
  getReviewStateCheck,
  resetReviewStateCheck,
  strictNoReviewedCheck,
} from "../../content/editions/reviewState.ts";
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
