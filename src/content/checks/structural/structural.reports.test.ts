/**
 * The twelve report sites in structural.ts that nothing distinguished from their own absence
 * (am-kd9h).
 *
 * HOW THE TWELVE WERE FOUND, because "untested" is a claim that needs a method. Each of the file's
 * 45 `ctx.report({...})` calls was deleted in turn - rewritten to `void ({...})`, one site at a
 * time - and the test files that reach this module were run against the result: both bun-lane
 * importers plus structural.e2e.test.ts, which drives the checks through a spawned CLI and so reads
 * the planted file from disk. Thirty-three sites turned the suite RED. These twelve did not. A site
 * that stays green when its refusal is deleted is untested by construction, whatever a grep for its
 * rule name says.
 *
 * That distinction is not pedantic here. `duplicate-id` has 14 sites, `broken-alignment` 9,
 * `missing-source-block` 6. Searching the tests for the string "duplicate-id" finds it and credits
 * all fourteen. So every test below asserts the site's own `path` and the distinctive opening of its
 * own `message`, neither of which any sibling site emits, and each pairs the rejection with the
 * corrected input that must produce nothing.
 */

import { describe, expect, test } from "bun:test";
import type { CheckContext, CheckReportItem } from "../../compiler/checks/registry.ts";
import { spanTextDigest } from "../../schemas/spans.ts";
import {
  checkBrokenAlignment,
  checkCompleteWhileMissing,
  checkDuplicateId,
  checkEquationNotIdentical,
  checkHeroQuoteUnresolved,
  checkImpossibleDateOrder,
  checkMissingSourceBlock,
  checkSpanDigestMismatch,
} from "./structural.ts";

function run(
  check: { run: (ctx: CheckContext) => void },
  records: Record<string, unknown>,
  indexes: unknown = {},
): CheckReportItem[] {
  const reports: CheckReportItem[] = [];
  const ctx: CheckContext = {
    records: new Map<string, unknown>(Object.entries(records)),
    files: [],
    indexes,
    report: (item: CheckReportItem) => reports.push(item),
  };
  check.run(ctx);
  return reports;
}

/** The site is driven only if exactly one report carries ITS path and ITS message opening. */
function expectSite(reports: CheckReportItem[], path: string, messageOpening: string): void {
  const mine = reports.filter((r) => r.path === path);
  expect(mine).toHaveLength(1);
  expect(mine[0]?.message).toContain(messageOpening);
}

describe("duplicate-id: the source-block site, not the twelve that already had tests", () => {
  test("(structural.ts:155) two source blocks share an id inside one paper", () => {
    const records = {
      a: { kind: "source-block", id: "s1-p1", paper: "brownian-motion", file: "a.json" },
      b: { kind: "source-block", id: "s1-p1", paper: "brownian-motion", file: "b.json" },
    };
    expectSite(run(checkDuplicateId, records), "s1-p1", "Duplicate source block id");

    // The same id in a DIFFERENT paper is legal, and this is the discrimination the site makes:
    // ids are unique within a paper, never across the corpus.
    const crossPaper = {
      a: { kind: "source-block", id: "s1-p1", paper: "brownian-motion", file: "a.json" },
      b: { kind: "source-block", id: "s1-p1", paper: "light-quanta", file: "b.json" },
    };
    expect(run(checkDuplicateId, crossPaper)).toHaveLength(0);
  });
});

describe("missing-source-block: the two sites that were not driven", () => {
  test("(structural.ts:405) a paper's orderedBlockIds names a block that does not exist", () => {
    const records = {
      p: {
        kind: "paper",
        id: "brownian-motion",
        orderedBlockIds: ["s1-p1", "s1-p2"],
      },
      b: { kind: "source-block", id: "s1-p1", paper: "brownian-motion" },
    };
    expectSite(
      run(checkMissingSourceBlock, records),
      "papers.brownian-motion.orderedBlockIds.s1-p2",
      'orderedBlockIds references non-existent source block "s1-p2"',
    );

    const complete = {
      p: { kind: "paper", id: "brownian-motion", orderedBlockIds: ["s1-p1"] },
      b: { kind: "source-block", id: "s1-p1", paper: "brownian-motion" },
    };
    expect(run(checkMissingSourceBlock, complete)).toHaveLength(0);
  });

  test("(structural.ts:471) an alignment edge points at a source block that does not exist", () => {
    const records = {
      b: { kind: "source-block", id: "s1-p1", paper: "brownian-motion" },
      al: {
        kind: "alignment",
        id: "al-1",
        paper: "brownian-motion",
        edges: [{ source: { blockId: "s9-p9" }, target: { translationUnitId: "tu-1" } }],
      },
    };
    expectSite(
      run(checkMissingSourceBlock, records),
      "alignments.al-1.edges[0].source.blockId",
      'Alignment edge references missing source block "s9-p9"',
    );

    // The block exists in ANOTHER paper. The site resolves per paper, so this must still refuse,
    // and refuse for the same reason rather than pass because the id occurs somewhere.
    const wrongPaper = {
      b: { kind: "source-block", id: "s9-p9", paper: "light-quanta" },
      al: {
        kind: "alignment",
        id: "al-1",
        paper: "brownian-motion",
        edges: [{ source: { blockId: "s9-p9" }, target: { translationUnitId: "tu-1" } }],
      },
    };
    expectSite(
      run(checkMissingSourceBlock, wrongPaper),
      "alignments.al-1.edges[0].source.blockId",
      'in paper "brownian-motion"',
    );
  });
});

describe("broken-alignment: the three sites that were not driven", () => {
  const block = {
    kind: "source-block",
    id: "s1-p1",
    paper: "brownian-motion",
    text: "In dieser Arbeit soll gezeigt werden.",
    sentenceSpans: [{ id: "s1-p1-s1" }],
  };
  const tu = {
    kind: "translation-unit",
    id: "tu-1",
    paper: "brownian-motion",
    text: "In this paper it will be shown.",
  };

  test("(structural.ts:665) an edge names a sentence that is not a span of its own block", () => {
    const records = {
      b: block,
      t: tu,
      al: {
        kind: "alignment",
        id: "al-1",
        paper: "brownian-motion",
        edges: [
          {
            source: { blockId: "s1-p1", sentenceId: "s1-p1-s7" },
            target: { translationUnitId: "tu-1" },
          },
        ],
      },
    };
    expectSite(
      run(checkBrokenAlignment, records),
      "alignments.al-1.edges[0].source.sentenceId",
      'source sentence "s1-p1-s7" is not inside block "s1-p1"',
    );
  });

  test("(structural.ts:698) an edge targets a translation unit that is missing in its paper", () => {
    const records = {
      b: block,
      t: tu,
      al: {
        kind: "alignment",
        id: "al-1",
        paper: "brownian-motion",
        edges: [
          {
            source: { blockId: "s1-p1", sentenceId: "s1-p1-s1" },
            target: { translationUnitId: "tu-absent" },
          },
        ],
      },
    };
    expectSite(
      run(checkBrokenAlignment, records),
      "alignments.al-1.edges[0].target.translationUnitId",
      'target translation unit "tu-absent" is missing',
    );
  });

  test("(structural.ts:713) an edge's target range runs past the end of the translation text", () => {
    const makeRecords = (range: { start: number; end: number }) => ({
      b: block,
      t: tu,
      al: {
        kind: "alignment",
        id: "al-1",
        paper: "brownian-motion",
        edges: [
          {
            source: { blockId: "s1-p1", sentenceId: "s1-p1-s1" },
            target: { translationUnitId: "tu-1", range },
          },
        ],
      },
    });
    // "In this paper it will be shown." is 31 characters; 99 is past its end.
    expectSite(
      run(checkBrokenAlignment, makeRecords({ start: 0, end: 99 })),
      "alignments.al-1.edges[0].target.range",
      "target range [0, 99] is out of bounds",
    );
    // A range that fits produces nothing, so the site is measuring the text and not merely the
    // presence of a range object.
    expect(run(checkBrokenAlignment, makeRecords({ start: 0, end: 31 }))).toHaveLength(0);
  });
});

describe("impossible-date-order: the two later sites, distinguished by which pair they compare", () => {
  const d = (type: string, day: string) => ({ type, earliest: day, latest: day });
  const dateLine = d("date-line", "1905-05-01");
  const received = d("received", "1905-05-11");

  test("(structural.ts:1028) received is strictly after issue publication", () => {
    const records = {
      p: {
        kind: "paper",
        id: "brownian-motion",
        dates: [dateLine, received, d("issue-publication", "1905-01-18")],
      },
    };
    const reports = run(checkImpossibleDateOrder, records);
    // Both this site and the date-line site write path `papers.<id>.dates`, so the path alone
    // cannot separate them. The message can, and the ordering above is legal for the date-line.
    const mine = reports.filter((r) => r.message.includes("Paper received date"));
    expect(mine).toHaveLength(1);
    expect(mine[0]?.message).toContain("strictly after issue publication date");
    expect(reports.some((r) => r.message.includes("Paper date-line"))).toBe(false);

    const ordered = {
      p: {
        kind: "paper",
        id: "brownian-motion",
        dates: [dateLine, received, d("issue-publication", "1905-07-18")],
      },
    };
    expect(run(checkImpossibleDateOrder, ordered)).toHaveLength(0);
  });

  test("(structural.ts:1045) issue publication is strictly after a later edition", () => {
    const records = {
      p: {
        kind: "paper",
        id: "brownian-motion",
        dates: [d("issue-publication", "1905-07-18"), d("later-edition", "1905-01-01")],
      },
    };
    expectSite(
      run(checkImpossibleDateOrder, records),
      "papers.brownian-motion.dates.laterEdition[0]",
      "is strictly after later-edition date",
    );

    const ordered = {
      p: {
        kind: "paper",
        id: "brownian-motion",
        dates: [d("issue-publication", "1905-07-18"), d("later-edition", "1922-01-01")],
      },
    };
    expect(run(checkImpossibleDateOrder, ordered)).toHaveLength(0);
  });
});

describe("the four single sites", () => {
  test("(structural.ts:1141) germanLatex and englishLatex differ byte for byte", () => {
    const records = {
      e: {
        kind: "equation",
        id: "eq-1",
        paper: "brownian-motion",
        germanLatex: "\\lambda_x = \\sqrt{2Dt}",
        englishLatex: "\\lambda_x = \\sqrt{2 D t}",
      },
    };
    expectSite(
      run(checkEquationNotIdentical, records),
      "equations.eq-1",
      "differs byte-for-byte from German equation content",
    );

    // Byte-identical passes. Two spaces are not "the same equation" here on purpose: notation is
    // never translated, so the English face carries the German bytes.
    const identical = {
      e: {
        kind: "equation",
        id: "eq-1",
        paper: "brownian-motion",
        germanLatex: "\\lambda_x = \\sqrt{2Dt}",
        englishLatex: "\\lambda_x = \\sqrt{2Dt}",
      },
    };
    expect(run(checkEquationNotIdentical, identical)).toHaveLength(0);
  });

  test("(structural.ts:1235) a paper is complete while one of its blocks is still a draft", () => {
    const records = {
      p: { kind: "paper", id: "brownian-motion", status: "complete" },
      b: {
        kind: "source-block",
        id: "s1-p1",
        paper: "brownian-motion",
        status: { transcription: "draft" },
      },
    };
    expectSite(
      run(checkCompleteWhileMissing, records),
      "papers.brownian-motion",
      'transcription status is "draft"',
    );

    // "not-started" is the same site and must also refuse; the site tests two values, so a test
    // that only ever passed "draft" would leave half of it unexercised.
    const notStarted = {
      p: { kind: "paper", id: "brownian-motion", status: "complete" },
      b: {
        kind: "source-block",
        id: "s1-p1",
        paper: "brownian-motion",
        status: { transcription: "not-started" },
      },
    };
    expectSite(
      run(checkCompleteWhileMissing, notStarted),
      "papers.brownian-motion",
      'transcription status is "not-started"',
    );

    // A draft block under a paper that does NOT claim completeness is an ordinary state.
    const inProgress = {
      p: { kind: "paper", id: "brownian-motion", status: "in-progress" },
      b: {
        kind: "source-block",
        id: "s1-p1",
        paper: "brownian-motion",
        status: { transcription: "draft" },
      },
    };
    expect(run(checkCompleteWhileMissing, inProgress)).toHaveLength(0);
  });

  test("(structural.ts:1320) a hero quote's anchor resolves to no edition record at all", () => {
    const records = {
      b: {
        kind: "source-block",
        id: "s1-p1",
        paper: "brownian-motion",
        text: "In dieser Arbeit soll gezeigt werden.",
      },
      e: {
        kind: "entrance",
        id: "entrance-brownian-motion",
        heroQuote: { anchor: "s9-p9", text: "In dieser Arbeit soll gezeigt werden." },
      },
    };
    expectSite(
      run(checkHeroQuoteUnresolved, records),
      "entrance-brownian-motion.heroQuote[0].anchor",
      'anchor "s9-p9" does not resolve to any edition text record',
    );

    // Anchored at a real record, this site is silent. It is the "no such anchor" site, separate
    // from the "anchor exists but the text does not match" site that already had a test.
    const resolved = {
      b: {
        kind: "source-block",
        id: "s1-p1",
        paper: "brownian-motion",
        text: "In dieser Arbeit soll gezeigt werden.",
      },
      e: {
        kind: "entrance",
        id: "entrance-brownian-motion",
        heroQuote: { anchor: "s1-p1", text: "In dieser Arbeit soll gezeigt werden." },
      },
    };
    expect(
      run(checkHeroQuoteUnresolved, resolved).filter((r) =>
        r.message.includes("does not resolve to any edition text record"),
      ),
    ).toHaveLength(0);
  });

  test("(structural.ts:1498) an edge's SOURCE span digest disagrees with the block text", () => {
    const text = "In dieser Arbeit soll gezeigt werden.";
    const records = {
      "s1-p1": { kind: "source-block", id: "s1-p1", paper: "brownian-motion", text },
      al: {
        kind: "alignment",
        id: "al-1",
        paper: "brownian-motion",
        edges: [
          {
            source: {
              blockId: "s1-p1",
              range: { start: 0, end: text.length, textDigest: "sha256:not-the-digest" },
            },
            target: { translationUnitId: "tu-1" },
          },
        ],
      },
    };
    expectSite(
      run(checkSpanDigestMismatch, records),
      "alignments.al-1.edges[0].source.range",
      'Span digest mismatch on alignment edge source block "s1-p1"',
    );

    // The real digest of the real text passes, which is what makes the failure above a statement
    // about the text rather than about the string "sha256:".
    const good = {
      "s1-p1": { kind: "source-block", id: "s1-p1", paper: "brownian-motion", text },
      al: {
        kind: "alignment",
        id: "al-1",
        paper: "brownian-motion",
        edges: [
          {
            source: {
              blockId: "s1-p1",
              range: { start: 0, end: text.length, textDigest: spanTextDigest(text) },
            },
            target: { translationUnitId: "tu-1" },
          },
        ],
      },
    };
    expect(
      run(checkSpanDigestMismatch, good).filter((r) => r.path?.includes("edges[0].source.range")),
    ).toHaveLength(0);
  });
});
