import { describe, expect, test } from "bun:test";
import { classifyAlignableUnit, isPermanentGermanId } from "../../content/editions/alignableIds.ts";
import {
  germanAlignableIds,
  segmentLedger,
  validateSegmentation,
} from "../../content/editions/segmentLedger.ts";
import {
  proposeSentences,
  SENTENCE_ABBREVIATIONS,
} from "../../content/editions/segmentSentences.ts";
import { tokenizeGerman, wordTokens } from "../../content/editions/tokenizeGerman.ts";
import { parseAlignableUnitId, parseSentenceId } from "../../content/ids.ts";
import { getLogger } from "../log/logger.ts";

const logger = getLogger("editions");
const BEAD = "am-edn-alignment-tooling-do1";

const FIXTURE_LEDGER = `--- REVIEWED TRANSCRIPTION PAGE 1 OF 1 ---
[[TITLE]]
Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung
[[AUTHOR]]
von A. Einstein
[[HEADING s1]] § 1.
Die Bewegung ist unregelmäßig. Sie hört nicht auf.
[[DATELINE]] Bern, Mai 1905.
`;

describe("segmentation and permanent ids", () => {
  test("an empty ledger is ledger-absent, not a complete edition", () => {
    const result = segmentLedger({ ledgerText: "" });
    expect(result.status).toBe("absent");
    if (result.status === "absent") expect(result.code).toBe("ledger-absent");
  });

  test("a fixture ledger proposes masthead, heading, paragraph sentences, and closing with permanent ids", () => {
    const result = segmentLedger({ ledgerText: FIXTURE_LEDGER });
    expect(result.status).toBe("proposed");
    if (result.status !== "proposed") return;
    const ids = germanAlignableIds(result.blocks);
    expect(ids).toContain("masthead-title");
    expect(ids).toContain("masthead-author");
    expect(ids).toContain("s1");
    expect(ids).toContain("s1-p1-s1");
    expect(ids).toContain("s1-p1-s2");
    expect(ids).toContain("closing-dateline");
    for (const id of ids) {
      expect(isPermanentGermanId(id)).toBe(true);
      expect(parseAlignableUnitId(id).ok).toBe(true);
    }
    expect(parseSentenceId("s1-p1-s1").ok).toBe(true);
    expect(classifyAlignableUnit("s1-p1-s1")?.alignsAt).toBe("sentence");
    expect(classifyAlignableUnit("s1")?.alignsAt).toBe("block");
    expect(classifyAlignableUnit("closing-dateline")?.alignsAt).toBe("block");
    logger.log({
      testId: "segment-permanent-ids",
      beadId: BEAD,
      extra: { check: "id-stability" },
      outcome: "passed",
      message: "every proposed unit has a permanent id from src/content/ids.ts",
    });
  });

  test("abbreviations and initials are not sentence boundaries", () => {
    const text = "Vgl. A. Einstein, Ann. d. Phys. 17. Die Folge ist klar.";
    const sentences = proposeSentences(text);
    expect(SENTENCE_ABBREVIATIONS).toContain("z. B.");
    expect(sentences.length).toBeGreaterThanOrEqual(1);
    expect(sentences.some((s) => s.text.includes("Die Folge ist klar."))).toBe(true);
  });

  test("German word tokens skip punctuation and treat z. B. as one token", () => {
    const tokens = tokenizeGerman("z. B. die Maxwell-Hertzschen Gleichungen.");
    const words = wordTokens(tokens);
    expect(words[0]?.text).toBe("z. B.");
    expect(words.some((w) => w.text === "Maxwell-Hertzschen")).toBe(true);
    expect(words.every((w) => w.tokenIndex !== undefined)).toBe(true);
  });
});

describe("reconciliation against frozen manifest", () => {
  test("a ledger matching the frozen manifest reconciles with zero differences", () => {
    const frozen = ["masthead-title", "masthead-author", "s1", "s1-p1", "closing-dateline"];
    const result = segmentLedger({ ledgerText: FIXTURE_LEDGER, frozenIds: frozen });
    expect(result.status).toBe("proposed");
    if (result.status === "proposed") {
      expect(result.differences).toEqual([]);
    }
  });

  test("PLANTED: an extra block in the ledger not in frozenIds produces unit-extra-in-ledger", () => {
    const frozen = ["masthead-title", "masthead-author", "s1", "s1-p1"];
    const result = segmentLedger({ ledgerText: FIXTURE_LEDGER, frozenIds: frozen });
    expect(result.status).toBe("proposed");
    if (result.status === "proposed") {
      const extra = result.differences.find((d) => d.kind === "unit-extra-in-ledger");
      expect(extra).toBeDefined();
      expect(extra?.differenceId).toBe("unit-extra-in-ledger:closing-dateline");
      expect(extra?.unitId).toBe("closing-dateline");
      expect(extra?.message).toContain(
        'Proposed block "closing-dateline" is not in the frozen manifest',
      );
    }
  });

  test("PLANTED: a frozen id absent from proposed ledger produces unit-missing-in-ledger", () => {
    const frozen = [
      "masthead-title",
      "masthead-author",
      "s1",
      "s1-p1",
      "closing-dateline",
      "s1-p2",
    ];
    const result = segmentLedger({ ledgerText: FIXTURE_LEDGER, frozenIds: frozen });
    expect(result.status).toBe("proposed");
    if (result.status === "proposed") {
      const missing = result.differences.find((d) => d.kind === "unit-missing-in-ledger");
      expect(missing).toBeDefined();
      expect(missing?.differenceId).toBe("unit-missing-in-ledger:s1-p2");
      expect(missing?.unitId).toBe("s1-p2");
      expect(missing?.message).toContain('Frozen id "s1-p2" has no proposed ledger unit');
    }
  });
});

describe("segmentation validation: contiguity and non-overlap", () => {
  test("proposed sentences form contiguous non-overlapping segments", () => {
    const paragraph = "Die Bewegung ist unregelmäßig. Sie hört nicht auf.";
    const proposals = proposeSentences(paragraph);
    const issues = validateSegmentation(paragraph, proposals);
    expect(issues).toEqual([]);
  });

  test("PLANTED: overlapping segments are refused with code overlapping-segments", () => {
    const paragraph = "Die Bewegung ist unregelmäßig. Sie hört nicht auf.";
    // Segment 1 ends at index 30, segment 2 starts at index 25 (overlaps by 5 chars)
    const overlapping = [
      { start: 0, end: 30, text: "Die Bewegung ist unregelmäßig." },
      { start: 25, end: paragraph.length, text: "mäßig. Sie hört nicht auf." },
    ];
    const issues = validateSegmentation(paragraph, overlapping);
    const issue = issues.find((i) => i.code === "overlapping-segments");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("Segments overlap");
    expect(issue?.start).toBe(25);
    expect(issue?.end).toBe(30);
  });

  test("PLANTED: non-contiguous segmentation dropping intermediate text is refused", () => {
    const paragraph = "Die Bewegung ist unregelmäßig. Sie hört nicht auf.";
    // Dropping "ist unregelmäßig." between index 12 and 31
    const gapped = [
      { start: 0, end: 12, text: "Die Bewegung" },
      { start: 31, end: paragraph.length, text: "Sie hört nicht auf." },
    ];
    const issues = validateSegmentation(paragraph, gapped);
    const issue = issues.find((i) => i.code === "non-contiguous-segmentation");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("Non-contiguous segmentation");
    expect(issue?.message).toContain("ist unregelmäßig.");
  });

  test("PLANTED: segmentation dropping leading or trailing text is refused", () => {
    const paragraph = "Anfang. Die Bewegung ist unregelmäßig. Ende.";
    // Drop "Anfang."
    const dropLeading = [{ start: 8, end: 38, text: "Die Bewegung ist unregelmäßig." }];
    const leadingIssues = validateSegmentation(paragraph, dropLeading);
    expect(
      leadingIssues.some(
        (i) => i.code === "non-contiguous-segmentation" && i.message.includes("Anfang."),
      ),
    ).toBe(true);

    // Drop "Ende."
    const dropTrailing = [{ start: 0, end: 38, text: "Anfang. Die Bewegung ist unregelmäßig." }];
    const trailingIssues = validateSegmentation(paragraph, dropTrailing);
    expect(
      trailingIssues.some(
        (i) => i.code === "non-contiguous-segmentation" && i.message.includes("Ende."),
      ),
    ).toBe(true);
  });
});
