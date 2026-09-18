import { describe, expect, test } from "bun:test";
import { classifyAlignableUnit, isPermanentGermanId } from "../../content/editions/alignableIds.ts";
import { reconcileManifest } from "../../content/editions/reconciliation.ts";
import {
  germanAlignableIds,
  segmentLedger,
  validateSegmentation,
} from "../../content/editions/segmentLedger.ts";
import {
  extractSentenceInlineMathIds,
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

const MULTI_BLOCK_LEDGER = `--- REVIEWED TRANSCRIPTION PAGE 1 OF 2 ---
[[ARTICLE-NUMBER 3.]]
[[TITLE]]
Zur Elektrodynamik bewegter Körper
[[AUTHOR]]
von A. Einstein
[[PART-HEADING part-1]] I. KINEMATISCHER TEIL
[[HEADING s1]] § 1. Definition der Gleichzeitigkeit.
$$
c = \\lambda \\nu
$$
[[EQ-LABEL (0)]]
Hierbei gilt die fundamentale Beziehung zwischen $E$ und $m$.
$$
E = mc^2.
$$
[[EQ-LABEL (1)]]
Es folgt hieraus die Trägheit der Energie.
[[CONTINUES]]
--- REVIEWED TRANSCRIPTION PAGE 2 OF 2 ---
[[ANNALEN-PAGE 892]]
Dieser Satz setzt den Paragraphen auf Seite 2 fort.
[[FN 1)]] Erste Zeile der Fußnote.
[[FN-CONTINUES]]
--- REVIEWED TRANSCRIPTION PAGE 3 OF 3 ---
[[ANNALEN-PAGE 893]]
[[FN-CONT 1)]] Zweite Zeile der Fußnote auf Folgeseite.
[[DATELINE]] Bern, Juni 1905.
[[ACK]] Am Schlusse danke ich meinem Freunde M. Besso.
[[RECEIVED]] (Eingegangen 30. Juni 1905.)
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
      comparisonKind: "bitwise",
      message: "every proposed unit has a permanent id from src/content/ids.ts",
    });
  });

  test("every block kind is parsed: masthead, part-heading, heading, equation, footnote with continuation, paragraph across page break, and closings", () => {
    const result = segmentLedger({ ledgerText: MULTI_BLOCK_LEDGER });
    expect(result.status).toBe("proposed");
    if (result.status !== "proposed") return;

    const kinds = new Set(result.blocks.map((b) => b.kind));
    expect(kinds.has("masthead-title")).toBe(true);
    expect(kinds.has("masthead-author")).toBe(true);
    expect(kinds.has("part-heading")).toBe(true);
    expect(kinds.has("heading")).toBe(true);
    expect(kinds.has("equation")).toBe(true);
    expect(kinds.has("paragraph")).toBe(true);
    expect(kinds.has("footnote")).toBe(true);
    expect(kinds.has("closing-dateline")).toBe(true);
    expect(kinds.has("closing-ack")).toBe(true);
    expect(kinds.has("closing-received")).toBe(true);

    // Standalone equation before first paragraph
    const eq0 = result.blocks.find((b) => b.id === "s1-eq1");
    expect(eq0).toBeDefined();
    expect(eq0?.kind).toBe("equation");
    expect(eq0?.label).toBe("(0)");
    expect(eq0?.text).toContain("c = \\lambda \\nu");

    // Display equation inside paragraph
    const eq1 = result.blocks.find((b) => b.id === "s1-eq2");
    expect(eq1).toBeDefined();
    expect(eq1?.kind).toBe("equation");
    expect(eq1?.label).toBe("(1)");
    expect(eq1?.text).toContain("E = mc^2.");

    // Paragraph references the display equation
    const p1 = result.blocks.find((b) => b.id === "s1-p1");
    expect(p1).toBeDefined();
    expect(p1?.displayEquationIds).toContain("s1-eq2");

    // Paragraph continued across page break
    expect(p1?.text).toContain("Dieser Satz setzt den Paragraphen auf Seite 2 fort.");

    // Footnote joined across continuation
    const fn1 = result.blocks.find((b) => b.id === "s1-fn1");
    expect(fn1).toBeDefined();
    expect(fn1?.kind).toBe("footnote");
    expect(fn1?.footnoteLabel).toBe("1)");
    expect(fn1?.text).toBe(
      "Erste Zeile der Fußnote. Zweite Zeile der Fußnote auf Folgeseite.",
    );

    // German alignable IDs exclude equations and include all other alignable blocks/sentences
    const alignableIds = germanAlignableIds(result.blocks);
    expect(alignableIds).toContain("masthead-title");
    expect(alignableIds).toContain("masthead-author");
    expect(alignableIds).toContain("part-1");
    expect(alignableIds).toContain("s1");
    expect(alignableIds).toContain("s1-p1-s1");
    expect(alignableIds).toContain("s1-fn1");
    expect(alignableIds).toContain("closing-dateline");
    expect(alignableIds).toContain("closing-ack");
    expect(alignableIds).toContain("closing-received");
    expect(alignableIds).not.toContain("s1-eq1");
    expect(alignableIds).not.toContain("s1-eq2");
  });
});

describe("sentence-boundary rules and display reference behavior", () => {
  test("abbreviations, initials, ordinals, section signs, and citations are not sentence boundaries", () => {
    // Listed abbreviations and initials
    const abbrevText = "Vgl. A. Einstein, Ann. d. Phys. 17. Die Folge ist klar.";
    const abbrevSentences = proposeSentences(abbrevText);
    expect(SENTENCE_ABBREVIATIONS).toContain("z. B.");
    expect(SENTENCE_ABBREVIATIONS).toContain("d. h.");
    expect(SENTENCE_ABBREVIATIONS).toContain("vgl.");
    expect(abbrevSentences.length).toBeGreaterThanOrEqual(1);
    expect(abbrevSentences.some((s) => s.text.includes("Die Folge ist klar."))).toBe(true);

    // a. a. O. § 8 is never split
    const sectionText = "Siehe a. a. O. § 8 für die Herleitung. Dies beweist den Satz.";
    const sectionSentences = proposeSentences(sectionText);
    expect(sectionSentences).toHaveLength(2);
    expect(sectionSentences[0]?.text).toBe("Siehe a. a. O. § 8 für die Herleitung.");
    expect(sectionSentences[1]?.text).toBe("Dies beweist den Satz.");

    // Ordinal before month
    const dateText = "Am 17. März 1905 erschien die Abhandlung. Sie war bahnbrechend.";
    const dateSentences = proposeSentences(dateText);
    expect(dateSentences).toHaveLength(2);
    expect(dateSentences[0]?.text).toBe("Am 17. März 1905 erschien die Abhandlung.");

    // Decimal comma: 0,001 mm is never split
    const decimalText = "Der Durchmesser beträgt 0,001 mm im Mittel. Die Messung ist genau.";
    const decimalSentences = proposeSentences(decimalText);
    expect(decimalSentences).toHaveLength(2);
    expect(decimalSentences[0]?.text).toBe("Der Durchmesser beträgt 0,001 mm im Mittel.");

    // Full bibliographic citation string remains one sentence
    const citationText = "Vgl. Ann. d. Phys. 17. p. 891. 1905. Hieraus folgt das Ergebnis.";
    const citationSentences = proposeSentences(citationText);
    expect(citationSentences).toHaveLength(2);
    expect(citationSentences[0]?.text).toBe("Vgl. Ann. d. Phys. 17. p. 891. 1905.");
    expect(citationSentences[1]?.text).toBe("Hieraus folgt das Ergebnis.");

    // Colons and semicolons are never boundaries
    const semiText = "Die Bewegung ist unregelmäßig; sie hört nicht auf.";
    expect(proposeSentences(semiText)).toHaveLength(1);

    const colonText = "Es gilt folgendes: Die Energie bleibt stets erhalten.";
    expect(proposeSentences(colonText)).toHaveLength(1);
  });

  test("display reference ending in '.' followed by uppercase splits sentence", () => {
    const text = "Hierbei gilt die Beziehung: $$ E = mc^2. $$ [[EQ-LABEL (1)]] Es folgt hieraus die Trägheit.";
    const sentences = proposeSentences(text);
    expect(sentences).toHaveLength(2);
    expect(sentences[0]?.text).toContain("$$ E = mc^2. $$");
    expect(sentences[1]?.text).toBe("Es folgt hieraus die Trägheit.");
  });

  test("PLANTED: display reference ending in ',' followed by lowercase 'wobei' stays inside single sentence", () => {
    const text = "Hierbei gilt: $$ K = \\frac{1}{2}mv^2, $$ wobei $v$ die Geschwindigkeit bedeutet.";
    const sentences = proposeSentences(text);
    expect(sentences).toHaveLength(1);
    expect(sentences[0]?.text).toContain("wobei $v$ die Geschwindigkeit bedeutet.");
  });

  test("two-sentence heading stays one block-level unit", () => {
    const headingLedger = `--- REVIEWED TRANSCRIPTION PAGE 1 OF 1 ---
[[HEADING s1]] § 1. Erste Annahme. Zweite Annahme.
Erster Absatz des Paragraphen.
`;
    const result = segmentLedger({ ledgerText: headingLedger });
    expect(result.status).toBe("proposed");
    if (result.status !== "proposed") return;
    const headingBlock = result.blocks.find((b) => b.id === "s1");
    expect(headingBlock).toBeDefined();
    expect(headingBlock?.kind).toBe("heading");
    expect(headingBlock?.text).toBe("§ 1. Erste Annahme. Zweite Annahme.");
    expect(headingBlock?.sentences).toEqual([]);
  });
});

describe("inline math indexing (am-edn-alignment-tooling-do1 Scope B.3)", () => {
  test("inline math regions are numbered 1-based sequentially across sentence", () => {
    const sentenceId = "s1-p1-s1";
    const sentenceText = "Hierbei ist $v$ die Geschwindigkeit, $m$ die Masse und $E$ die Gesamtenergie.";
    const mathIds = extractSentenceInlineMathIds(sentenceText, sentenceId);
    expect(mathIds).toEqual(["s1-p1-s1-m1", "s1-p1-s1-m2", "s1-p1-s1-m3"]);
  });

  test("the third inline math region is m3 even when the first two are not substantive", () => {
    const sentenceId = "s2-p3-s1";
    const sentenceText = "Für $x$ und $y$ ergibt sich $E_0 = mc^2$.";
    const mathIds = extractSentenceInlineMathIds(sentenceText, sentenceId);
    expect(mathIds[2]).toBe("s2-p3-s1-m3");
    expect(mathIds).toHaveLength(3);
  });
});

describe("German word tokenization regression suite", () => {
  test("tokenizes documented regression sentence with 0-based word indices, composite tokens, and atom exclusions", () => {
    const regression =
      "Vgl. z. B. die Maxwell-Hertzschen Gleichungen und die Doppler'schen Prinzipien am 17. März 1905 (§ 8) bei 0,001 Sek. Er stellt fest: [[SPERR]]Bewegung[[/SPERR]] erfordert Energie $E = mc^2$[[FN-MARK 1)]].";

    const mathRegions = [{ start: regression.indexOf("$"), end: regression.indexOf("$", regression.indexOf("$") + 1) + 1 }];
    const footnoteMarks = [{ start: regression.indexOf("[[FN-MARK"), end: regression.indexOf("]]", regression.indexOf("[[FN-MARK")) + 2 }];

    const tokens = tokenizeGerman(regression, { mathRegions, footnoteMarks });
    const words = wordTokens(tokens);

    // Verify composite tokens
    expect(words.some((w) => w.text === "z. B.")).toBe(true);
    expect(words.some((w) => w.text === "Maxwell-Hertzschen")).toBe(true);
    expect(words.some((w) => w.text === "Doppler'schen")).toBe(true);
    expect(words.some((w) => w.text === "17.")).toBe(true);
    expect(words.some((w) => w.text === "§ 8")).toBe(true);
    expect(words.some((w) => w.text === "0,001")).toBe(true);
    expect(words.some((w) => w.text === "Sek.")).toBe(true);

    // Verify emphasis tags did not split word token
    expect(words.some((w) => w.text === "Bewegung")).toBe(true);

    // Verify separable-verb tokens
    expect(words.some((w) => w.text === "stellt")).toBe(true);
    expect(words.some((w) => w.text === "fest")).toBe(true);

    // Verify atom tokens are present in tokens but excluded from wordTokens
    const mathToken = tokens.find((t) => t.kind === "math");
    expect(mathToken).toBeDefined();
    expect(mathToken?.text).toBe("$E = mc^2$");
    expect(mathToken?.tokenIndex).toBeUndefined();

    const fnMarkToken = tokens.find((t) => t.kind === "footnote-mark");
    expect(fnMarkToken).toBeDefined();
    expect(fnMarkToken?.tokenIndex).toBeUndefined();

    // Word tokens have strictly consecutive 0-based token indices
    words.forEach((w, idx) => {
      expect(w.tokenIndex).toBe(idx);
    });
  });

  test("headings, footnotes, and closings tokenize under identical rules with 0-based indices", () => {
    const headingTokens = wordTokens(tokenizeGerman("§ 1. KINEMATISCHER TEIL"));
    headingTokens.forEach((w, idx) => expect(w.tokenIndex).toBe(idx));

    const fnTokens = wordTokens(tokenizeGerman("Vgl. A. Einstein, a. a. O."));
    fnTokens.forEach((w, idx) => expect(w.tokenIndex).toBe(idx));

    const closingTokens = wordTokens(tokenizeGerman("Bern, Mai 1905."));
    closingTokens.forEach((w, idx) => expect(w.tokenIndex).toBe(idx));
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

  test("PLANTED: a manifest references[] entry with no authored inline in ledger is reported as unit-missing-in-ledger", () => {
    const proposed = segmentLedger({ ledgerText: FIXTURE_LEDGER });
    expect(proposed.status).toBe("proposed");
    if (proposed.status !== "proposed") return;

    const manifestUnits = [
      { id: "masthead-title" },
      { id: "masthead-author" },
      { id: "s1" },
      { id: "s1-p1-s1", references: ["s1-p1-s1-r1"] },
      { id: "s1-p1-s2" },
      { id: "closing-dateline" },
    ];

    const diffs = reconcileManifest({ blocks: proposed.blocks, manifestUnits });
    const refDiff = diffs.find((d) => d.differenceId === "unit-missing-in-ledger:s1-p1-s1-r1");
    expect(refDiff).toBeDefined();
    expect(refDiff?.kind).toBe("unit-missing-in-ledger");
    expect(refDiff?.unitId).toBe("s1-p1-s1-r1");
    expect(refDiff?.message).toContain('Frozen reference "s1-p1-s1-r1" has no authored inline in ledger');
  });

  test("determinism: two runs on identical inputs produce byte-identical results", () => {
    const run1 = segmentLedger({ ledgerText: MULTI_BLOCK_LEDGER });
    const run2 = segmentLedger({ ledgerText: MULTI_BLOCK_LEDGER });
    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
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
    const dropLeading = [{ start: 8, end: 38, text: "Die Bewegung ist unregelmäßig." }];
    const leadingIssues = validateSegmentation(paragraph, dropLeading);
    expect(
      leadingIssues.some(
        (i) => i.code === "non-contiguous-segmentation" && i.message.includes("Anfang."),
      ),
    ).toBe(true);

    const dropTrailing = [{ start: 0, end: 38, text: "Anfang. Die Bewegung ist unregelmäßig." }];
    const trailingIssues = validateSegmentation(paragraph, dropTrailing);
    expect(
      trailingIssues.some(
        (i) => i.code === "non-contiguous-segmentation" && i.message.includes("Ende."),
      ),
    ).toBe(true);
  });
});
