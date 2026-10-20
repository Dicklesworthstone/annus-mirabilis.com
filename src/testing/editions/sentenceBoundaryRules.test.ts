/**
 * The sentence-boundary rules, checked against their own authority and against
 * the corpus they govern (am-edn-alignment-tooling-do1, rule A "Sentence
 * boundaries").
 *
 * WHAT WAS HERE BEFORE. `segmentLedger.test.ts` covers one example per rule, and
 * for the abbreviation table it asserted that three of the thirty names were
 * present in the array. Membership is not behaviour: an entry could be in the
 * list and still fail to suppress a boundary, and twenty-seven entries were
 * never exercised at all. The table also lived in two places -- the doc that
 * calls itself the authority and the module that calls itself "executable copy
 * of docs/editorial/SEGMENTATION.md" -- with nothing joining them, so the copy
 * could drift from the original and both would stay green.
 *
 * WHAT THE CORPUS SWEEP ASKS, and why it is one-directional. For each paragraph
 * block it finds every boundary `proposeSentences` proposes that falls strictly
 * INSIDE a frozen sentence span. Those spans were authored against the plates,
 * so an invented boundary is the tool contradicting an editor. The reverse
 * direction -- a frozen boundary the tool misses -- is deliberately NOT asserted,
 * because `diplomaticText` is a projection with the display equations removed,
 * and a removed display can only MERGE two proposals, never split one. Asserting
 * the direction the projection cannot fake is the whole point; asserting both
 * would have produced sixty-two failures that say nothing about the rules.
 *
 * WHAT IT FOUND on 2026-10-19, at twenty-five invented boundaries over 188
 * blocks: four abbreviations Einstein prints that the table omitted (`Hrn.`,
 * `Hr.`, `bez.`, `etc.`, sixteen occurrences), and nine list enumerators in
 * ap-17-891 that no rule covered. Both repairs are in `segmentSentences.ts` and
 * in SEGMENTATION.md, and this file is what keeps them true.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { load as loadYaml } from "js-yaml";
import { reportPopulation } from "../../../scripts/gate-census/population.ts";
import {
  proposeSentences,
  SENTENCE_ABBREVIATIONS,
} from "../../content/editions/segmentSentences.ts";
import {
  TOKEN_ABBREVIATIONS,
  TOKENIZER_ONLY_DIVERGENCE,
} from "../../content/editions/tokenizeGerman.ts";

const SEGMENTATION_DOC = "docs/editorial/SEGMENTATION.md";
const SOURCE_BLOCKS = "content/source-blocks";
const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const;

/** The table as the doc prints it: the one line that carries the longest entry. */
function abbreviationTableFromDoc(): readonly string[] {
  const lines = readFileSync(SEGMENTATION_DOC, "utf8").split("\n");
  const tableLines = lines.filter((l) => l.includes("`Sitzungsber.`"));
  if (tableLines.length !== 1) {
    throw new Error(
      `expected exactly one abbreviation table line in ${SEGMENTATION_DOC}, found ${tableLines.length}`,
    );
  }
  return [...(tableLines[0] as string).matchAll(/`([^`]+)`/g)].map((m) => m[1] as string);
}

type FrozenSpan = Readonly<{ id: string; span: { start: number; end: number } }>;
type SourceBlockRecord = Readonly<{
  id?: string;
  kind?: string;
  diplomaticText?: string;
  sentenceSpans?: readonly FrozenSpan[];
}>;

type ParagraphBlock = Readonly<{
  paper: string;
  id: string;
  text: string;
  spans: readonly FrozenSpan[];
}>;

function paragraphBlocks(): readonly ParagraphBlock[] {
  const out: ParagraphBlock[] = [];
  for (const paper of PAPERS) {
    const dir = `${SOURCE_BLOCKS}/${paper}`;
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith(".yaml")) continue;
      const rec = loadYaml(readFileSync(`${dir}/${name}`, "utf8")) as SourceBlockRecord;
      if (rec.kind !== "paragraph") continue;
      const text = rec.diplomaticText;
      const spans = rec.sentenceSpans;
      if (typeof text !== "string" || !spans || spans.length === 0) continue;
      out.push({ paper, id: rec.id ?? name, text, spans });
    }
  }
  return out;
}

/**
 * Boundaries the tool proposes that fall strictly inside a frozen sentence.
 * Exported shape so the plant below can drive it with a synthetic block and show
 * that the detector reaches its predicate rather than returning empty forever.
 */
function inventedBoundaries(block: ParagraphBlock): readonly string[] {
  const frozenEnds = new Set(block.spans.map((s) => s.span.end - 1));
  const found: string[] = [];
  for (const proposal of proposeSentences(block.text)) {
    const last = proposal.end - 1;
    if (frozenEnds.has(last)) continue;
    const insideFrozen = block.spans.some((s) => last >= s.span.start && last < s.span.end - 1);
    if (!insideFrozen) continue;
    const context = block.text.slice(Math.max(0, last - 45), last + 30).replace(/\s+/g, " ");
    found.push(`${block.paper}/${block.id}: ...${context}...`);
  }
  return found;
}

describe("the abbreviation table in the doc and the table in the code are one table", () => {
  test("every entry, in the same order, with the doc as the authority", () => {
    const fromDoc = abbreviationTableFromDoc();
    // Named denominators, so a parser that silently matched nothing cannot pass.
    expect(fromDoc.length).toBeGreaterThanOrEqual(30);
    expect(fromDoc).toEqual([...SENTENCE_ABBREVIATIONS]);
  });

  test("the four 2026-10-19 additions are present in both", () => {
    // Identity, not census: these were added for named printed occurrences and
    // are permanent, so naming them states the fact that counting them does not.
    for (const added of ["Hrn.", "Hr.", "bez.", "etc."]) {
      expect(abbreviationTableFromDoc()).toContain(added);
      expect(SENTENCE_ABBREVIATIONS).toContain(added);
    }
  });

  test("the composite-token table is the boundary table minus a DECLARED divergence", () => {
    // These were one list by import until 2026-10-19, which made a boundary
    // repair silently rewrite the tokenizer and stale 32 gloss units. Splitting
    // them without this check would let them drift instead.
    const expected = SENTENCE_ABBREVIATIONS.filter((a) => !TOKENIZER_ONLY_DIVERGENCE.includes(a));
    expect([...TOKEN_ABBREVIATIONS]).toEqual([...expected]);
    expect(TOKENIZER_ONLY_DIVERGENCE.length).toBeGreaterThan(0);
    for (const d of TOKENIZER_ONLY_DIVERGENCE) {
      expect(SENTENCE_ABBREVIATIONS).toContain(d);
      expect(TOKEN_ABBREVIATIONS).not.toContain(d);
    }
  });
});

describe("every listed abbreviation suppresses a boundary, and an unlisted one does not", () => {
  const frame = (abbr: string) => `Man sehe ${abbr} Der weitere Text folgt hier.`;

  test("all of them, not three of them", () => {
    const splitting: string[] = [];
    for (const abbr of SENTENCE_ABBREVIATIONS) {
      if (proposeSentences(frame(abbr)).length !== 1) splitting.push(abbr);
    }
    expect(splitting).toEqual([]);
    const vacuous = reportPopulation({
      gate: "sentence-abbreviation-table",
      examined: SENTENCE_ABBREVIATIONS.length,
      noun: "listed abbreviations exercised in a sentence frame",
      minimum: 30,
    });
    expect(vacuous).toBe(false);
  });

  test("CONTROL: the same frame with an UNLISTED abbreviation splits", () => {
    // Without this the sweep above would pass on a proposeSentences that never
    // split anything at all, which is the failure mode it exists to exclude.
    for (const unlisted of ["Abb.", "Tab.", "Kap."]) {
      expect(SENTENCE_ABBREVIATIONS).not.toContain(unlisted);
      expect(proposeSentences(frame(unlisted))).toHaveLength(2);
    }
  });

  test("the guard is a word boundary, so an ordinary word ending in a listed form still splits", () => {
    // `isInsideAbbreviation` lowercases, so `S.` would otherwise match the tail of
    // "Gase." and "des.", and `Hr.` the tail of "Jahr." and "mehr.".
    for (const text of [
      "Ein Teil der Gase. Die Folge ist klar.",
      "Das Ergebnis des. Die Folge ist klar.",
      "Es dauerte ein Jahr. Die Folge ist klar.",
      "Er wusste nicht mehr. Die Folge ist klar.",
    ]) {
      expect(proposeSentences(text)).toHaveLength(2);
    }
  });
});

describe("a list enumerator is not a terminator (SEGMENTATION.md rule 8)", () => {
  test("an enumerator opening its unit, as the ledger sets it", () => {
    const item = "1. Die Gesetze, nach denen sich die Zustände ändern, sind unabhängig davon.";
    expect(proposeSentences(item)).toHaveLength(1);
    expect(proposeSentences("2. Jeder Lichtstrahl bewegt sich im ruhenden System.")).toHaveLength(
      1,
    );
    expect(proposeSentences("IV. Die vierte Annahme lautet so.")).toHaveLength(1);
  });

  test("an enumerator after the introducing sentence, as the inventory merged it", () => {
    const merged =
      "Welche beiden Prinzipien wir folgendermaßen definieren. " +
      "1. Die Gesetze, nach denen sich die Zustände ändern, sind unabhängig davon. " +
      "2. Jeder Lichtstrahl bewegt sich im ruhenden System.";
    const got = proposeSentences(merged);
    expect(got).toHaveLength(3);
    expect(got[1]?.text.startsWith("1. Die Gesetze")).toBe(true);
    expect(got[2]?.text.startsWith("2. Jeder Lichtstrahl")).toBe(true);
  });

  test("an enumerator after a colon, as ap-17-891 §1 prints it", () => {
    const merged =
      "Daß also allgemein die Beziehungen gelten: " +
      "1. Wenn die Uhr in B synchron mit der Uhr in A läuft, so läuft die Uhr in A synchron.";
    expect(proposeSentences(merged)).toHaveLength(2);
  });

  test("NEGATIVE: a citation's volume number is not an enumerator", () => {
    // The discriminator is the token in front of the numeral. Drop it and rule 7
    // loses its boundary, which is the regression this plants against.
    const citation = "Vgl. Ann. d. Phys. 17. Die Folge ist klar.";
    const got = proposeSentences(citation);
    expect(got).toHaveLength(2);
    expect(got[0]?.text).toBe("Vgl. Ann. d. Phys. 17.");

    const withYear = "Vgl. Ann. d. Phys. 17. p. 891. 1905. Hieraus folgt das Ergebnis.";
    const got2 = proposeSentences(withYear);
    expect(got2).toHaveLength(2);
    expect(got2[0]?.text).toBe("Vgl. Ann. d. Phys. 17. p. 891. 1905.");
  });

  test("NEGATIVE: an ordinary year ending a sentence is not an enumerator", () => {
    expect(proposeSentences("Die Arbeit erschien 1905. Die Folge ist klar.")).toHaveLength(2);
  });
});

describe("the rules proposed over the corpus never contradict a frozen sentence", () => {
  test("no boundary is invented inside a span the editors settled", () => {
    const blocks = paragraphBlocks();
    const found = blocks.flatMap(inventedBoundaries);
    expect(found).toEqual([]);

    const perPaper = new Map<string, number>();
    for (const b of blocks) perPaper.set(b.paper, (perPaper.get(b.paper) ?? 0) + 1);
    for (const paper of PAPERS) {
      expect(perPaper.get(paper) ?? 0).toBeGreaterThan(0);
    }
    const vacuous = reportPopulation({
      gate: "sentence-boundary-corpus",
      examined: blocks.length,
      noun: "paragraph blocks with frozen sentence spans",
      minimum: 150,
    });
    expect(vacuous).toBe(false);
  });

  test("CONTROL: the detector reaches its predicate on a planted block", () => {
    // A sweep that cannot fail and a sweep with nothing to find are both green.
    // The listed form must produce nothing and the unlisted form must produce one.
    const frozen = (text: string): ParagraphBlock => ({
      paper: "planted",
      id: "p1",
      text,
      spans: [{ id: "p1-s1", span: { start: 0, end: text.length } }],
    });
    expect(inventedBoundaries(frozen("Die von Hrn. Planck gegebene Bestimmung ist klar."))).toEqual(
      [],
    );
    const unlisted = inventedBoundaries(
      frozen("Die von Abb. Planck gegebene Bestimmung ist klar."),
    );
    expect(unlisted).toHaveLength(1);
    expect(unlisted[0]).toContain("Abb.");
  });
});
