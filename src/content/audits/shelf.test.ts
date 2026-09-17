import { describe, expect, test } from "bun:test";
import { getLogger } from "../../testing/log/logger.ts";
import { auditShelf, type ShelfAuditInput, type ShelfCard } from "./shelf.ts";
import { errorCheckCodes } from "./types.ts";

const logger = getLogger("verify-content-tests");
const BEAD = "am-cm-audit-scripts-d34";

describe("auditShelf (am-cm-audit-scripts-d34)", () => {
  const goodCard: ShelfCard = {
    id: "perrin-1908",
    source: "Perrin (1908) Brownian motion experiments",
    date: "1908",
    latestYear: 1908,
    status: "available",
    verification: { checked: true, recordId: "ver-perrin-1908" },
    usedInDiscoveryStep: false,
  };

  const good1904Card: ShelfCard = {
    id: "van-t-hoff-1887",
    source: "van 't Hoff (1887) Osmotic pressure",
    date: "1887",
    latestYear: 1887,
    status: "available",
    usedInDiscoveryStep: true,
  };

  test("GOOD RECORD: dated, sourced cards with matching queue state pass", () => {
    const input: ShelfAuditInput = {
      cards: [goodCard, good1904Card],
      queue: [
        {
          cardId: "van-t-hoff-1887",
          open: false,
          queueFile: "content/verification/queue.yaml",
        },
      ],
    };
    const report = auditShelf(input);
    expect(report.ok).toBe(true);
    expect(errorCheckCodes(report)).toEqual([]);
    logger.log({
      testId: "shelf-good-record",
      beadId: BEAD,
      extra: { family: "audit", check: "shelf-complete" },
      outcome: "passed",
      message: "valid shelf cards pass audit",
    });
  });

  test("PLANTED: undated card fails with shelf-undated", () => {
    const input: ShelfAuditInput = {
      cards: [
        {
          id: "undated-card",
          source: "Some physics paper",
          status: "available",
        },
      ],
    };
    const report = auditShelf(input);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("shelf-undated");
  });

  test("PLANTED: unsourced card fails with shelf-unsourced", () => {
    const input: ShelfAuditInput = {
      cards: [
        {
          id: "unsourced-card",
          date: "1902",
          latestYear: 1902,
          status: "available",
        },
      ],
    };
    const report = auditShelf(input);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("shelf-unsourced");
  });

  test("PLANTED: post-1904 card used in discovery step without flag fails", () => {
    const input: ShelfAuditInput = {
      cards: [
        {
          id: "millikan-1916",
          source: "Millikan (1916) Photoelectric effect",
          date: "1916",
          latestYear: 1916,
          status: "available",
          usedInDiscoveryStep: true,
          admittedImport: false,
          worldCheckEvidence: false,
        },
      ],
    };
    const report = auditShelf(input);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("shelf-post-1904-unflagged");
  });

  test("GOOD RECORD: post-1904 card with parallel-work status or admittedImport flag passes", () => {
    const input: ShelfAuditInput = {
      cards: [
        {
          id: "smoluchowski-1906",
          source: "Smoluchowski (1906)",
          date: "1906",
          latestYear: 1906,
          status: "parallel-work",
          usedInDiscoveryStep: true,
        },
        {
          id: "poincare-1905",
          source: "Poincaré (1905)",
          date: "1905",
          latestYear: 1905,
          status: "available",
          admittedImport: true,
          usedInDiscoveryStep: true,
        },
      ],
    };
    const report = auditShelf(input);
    expect(report.ok).toBe(true);
  });

  test("GOOD RECORD: Millikan 1916 dataset cited as worldCheckEvidence is listed as evidence and passes", () => {
    const input: ShelfAuditInput = {
      cards: [
        {
          id: "millikan-1916-data",
          source: "Millikan (1916) Physical Review",
          date: "1916",
          latestYear: 1916,
          status: "later",
          usedInDiscoveryStep: true,
          worldCheckEvidence: true,
        },
      ],
    };
    const report = auditShelf(input);
    expect(report.ok).toBe(true);
    expect(
      report.findings.some(
        (f) => f.check === "shelf-world-check-evidence" && f.severity === "flag",
      ),
    ).toBe(true);
  });

  test("PLANTED: open queue item for a verified card fails with shelf-queue-card-disagreement", () => {
    const input: ShelfAuditInput = {
      cards: [goodCard],
      queue: [
        {
          cardId: "perrin-1908",
          open: true, // disagrees with card.verification.checked = true
          queueFile: "content/verification/queue.yaml",
        },
      ],
    };
    const report = auditShelf(input);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("shelf-queue-card-disagreement");
  });

  test("PLANTED: queue item naming nonexistent card fails with shelf-queue-missing-card", () => {
    const input: ShelfAuditInput = {
      cards: [goodCard],
      queue: [
        {
          cardId: "nonexistent-card",
          open: true,
          queueFile: "content/verification/queue.yaml",
        },
      ],
    };
    const report = auditShelf(input);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("shelf-queue-missing-card");
  });

  test("GOOD RECORD: queue whose open items name unverified cards passes", () => {
    const unverifiedCard: ShelfCard = {
      id: "unverified-card",
      source: "Some period note",
      date: "1904",
      latestYear: 1904,
      status: "available",
      verification: { checked: false },
    };
    const input: ShelfAuditInput = {
      cards: [unverifiedCard],
      queue: [
        {
          cardId: "unverified-card",
          open: true,
          queueFile: "content/verification/queue.yaml",
        },
      ],
    };
    const report = auditShelf(input);
    expect(report.ok).toBe(true);
  });
});
