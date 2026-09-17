import { describe, expect, test } from "bun:test";
import { classifyAlignableUnit, isPermanentGermanId } from "../../content/editions/alignableIds.ts";
import { germanAlignableIds, segmentLedger } from "../../content/editions/segmentLedger.ts";
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
