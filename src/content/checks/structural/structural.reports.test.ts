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

/**
 * KEYS A FIXTURE THE WAY THE COMPILER KEYS THE REAL CORPUS (am-rc1001-bridge-plan-pcjk.10).
 *
 * A source block is identified by its KEY, `source-block:<paper>:<id>` (recordKey.ts), never by a
 * `kind` field: a block's own kind is `paragraph`, `equation`, `heading` and so on, and none of
 * the 453 committed blocks carries the string "source-block". These fixtures wrote that string as
 * `kind` and keyed by bare id, so every assertion here was made against a key shape production
 * never produces -- which is how seven branches in structural.ts could test for a record that
 * cannot exist while their tests stayed green.
 */
function keyFor(id: string, record: unknown): string {
  // A key the fixture already wrote in production form is left alone. Rewriting it would collapse
  // two DISTINCT keys that declare the same id -- which is the one within-paper duplicate that is
  // actually reachable, since `path-identity` makes two files with one id unconstructible.
  if (id.includes(":")) return id;
  if (!record || typeof record !== "object") return id;
  const rec = record as Record<string, unknown>;
  // ONLY `source-block`, deliberately. Keying translation units here too is more faithful still,
  // and it reddens two further sites that read a unit by BARE id -- `checkDuplicateId`'s unit arm
  // and `checkSpanDigestMismatch`'s target lookup at structural.ts:1684. Both are the same defect
  // one layer along and both are recorded on am-rc1001-bridge-plan-pcjk.10; widening this helper
  // to reach them belongs in the commit that repairs them, not in this one.
  if (rec.kind !== "source-block") return id;
  const paper = typeof rec.paper === "string" ? rec.paper : (rec.paperSlug as string) || "";
  const recordId = typeof rec.id === "string" ? rec.id : id;
  return `source-block:${paper}:${recordId}`;
}

/** The fixture map, with source blocks under their production keys. */
function fixtureRecords(records: Record<string, unknown>): Map<string, unknown> {
  return new Map<string, unknown>(
    Object.entries(records).map(([id, record]) => [keyFor(id, record), record]),
  );
}

function run(
  check: { run: (ctx: CheckContext) => void },
  records: Record<string, unknown>,
  indexes: unknown = {},
): CheckReportItem[] {
  const reports: CheckReportItem[] = [];
  const ctx: CheckContext = {
    records: fixtureRecords(records),
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
  test("(structural.ts:167) two source blocks share an id inside one paper", () => {
    // TWO DISTINCT KEYS, ONE DECLARED ID, which is the only shape this site can actually meet.
    // The fixture used to key them `a` and `b` as stand-ins for two files; under production keying
    // (`source-block:<paper>:<id>`, recordKey.ts) two files in one paper declaring one id share a
    // key and the records map holds one, so that shape is unreachable here. It is also
    // unconstructible upstream: `path-identity` binds a block's id to its filename stem, so the
    // compiler refuses the two files before any check sees them, which is the stronger guarantee
    // and is recorded at structural.ts:352. What remains reachable, and what this asserts, is a
    // caller that keys blocks by something other than the declared id
    // (am-rc1001-bridge-plan-pcjk.10).
    const records = {
      "source-block:brownian-motion:a": {
        kind: "source-block",
        id: "s1-p1",
        paper: "brownian-motion",
        file: "a.json",
      },
      "source-block:brownian-motion:b": {
        kind: "source-block",
        id: "s1-p1",
        paper: "brownian-motion",
        file: "b.json",
      },
    };
    expectSite(run(checkDuplicateId, records), "s1-p1", "Duplicate source block id");

    // The same id in a DIFFERENT paper is legal, and this is the discrimination the site makes:
    // ids are unique within a paper, never across the corpus. The paper now comes from the KEY, so
    // this also pins that the scoping does not fall back to a `paper` field a record may omit.
    const crossPaper = {
      "source-block:brownian-motion:a": {
        kind: "source-block",
        id: "s1-p1",
        paper: "brownian-motion",
        file: "a.json",
      },
      "source-block:light-quanta:b": {
        kind: "source-block",
        id: "s1-p1",
        paper: "light-quanta",
        file: "b.json",
      },
    };
    expect(run(checkDuplicateId, crossPaper)).toHaveLength(0);

    // And with the paper absent from the records entirely, which is how the key-scoping earns its
    // keep: before it, both fell into the "" bucket and the legal cross-paper reuse was refused.
    const noPaperField = {
      "source-block:brownian-motion:a": { kind: "source-block", id: "s1-p1", file: "a.json" },
      "source-block:light-quanta:b": { kind: "source-block", id: "s1-p1", file: "b.json" },
    };
    expect(run(checkDuplicateId, noPaperField)).toHaveLength(0);
  });
});

describe("missing-source-block: the two sites that were not driven", () => {
  test("(structural.ts:481) a paper's orderedBlockIds names a block that does not exist", () => {
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

  test("(structural.ts:547) an alignment edge points at a source block that does not exist", () => {
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

  test("(structural.ts:762) an edge names a sentence that is not a span of its own block", () => {
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

  test("(structural.ts:795) an edge targets a translation unit that is missing in its paper", () => {
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

  test("(structural.ts:810) an edge's target range runs past the end of the translation text", () => {
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

  test("(structural.ts:1126) received is strictly after issue publication", () => {
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

  test("(structural.ts:1143) issue publication is strictly after a later edition", () => {
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
  test("(structural.ts:1239) equation-not-identical: germanLatex and englishLatex differ byte for byte", () => {
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

  test("(structural.ts:1333) complete-while-missing: a paper is complete while one of its blocks is still a draft", () => {
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

  test("(structural.ts:1418) hero-quote-unresolved: a hero quote's anchor resolves to no edition record at all", () => {
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

  test("(structural.ts:1596) span-digest-mismatch: an edge's SOURCE span digest disagrees with the block text", () => {
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

/**
 * The last two sites in this file, and the reason they are here rather than cited elsewhere.
 *
 * Planting each of the 45 sites in turn and running only the bun-lane tests left exactly these two
 * green. They are driven today only by structural.e2e.test.ts, which reaches the checks through a
 * spawned CLI and lives in the node lane - so until this week they were covered by a test that could
 * not run at all, and a citation pointing at that file would have credited a gate nobody was
 * executing. These drive them directly.
 */
describe("the two sites only the node-lane e2e reached", () => {
  test("(structural.ts:189) two source blocks in one paper declare the same sentence span id", () => {
    const records = {
      a: {
        kind: "source-block",
        id: "s1-p1",
        paper: "brownian-motion",
        file: "a.json",
        sentenceSpans: [{ id: "s1-p1-s1" }],
      },
      b: {
        kind: "source-block",
        id: "s1-p2",
        paper: "brownian-motion",
        file: "b.json",
        sentenceSpans: [{ id: "s1-p1-s1" }],
      },
    };
    expectSite(
      run(checkDuplicateId, records),
      "s1-p2.sentenceSpans.s1-p1-s1",
      'Duplicate sentence span id "s1-p1-s1"',
    );

    // The block ids differ, so this is NOT the block-id site at :156. Sentence ids are a separate
    // namespace inside the paper and this site is what keeps them one.
    expect(
      run(checkDuplicateId, records).filter((r) => r.message.includes("Duplicate source block id")),
    ).toHaveLength(0);

    // Distinct span ids in the same paper are silent, and the SAME span id in a different paper is
    // legal, which is the per-paper scoping this site shares with its block-id sibling.
    const distinct = {
      a: { ...records.a },
      b: { ...records.b, sentenceSpans: [{ id: "s1-p2-s1" }] },
    };
    expect(run(checkDuplicateId, distinct)).toHaveLength(0);
    const otherPaper = {
      a: { ...records.a },
      b: { ...records.b, paper: "light-quanta" },
    };
    expect(run(checkDuplicateId, otherPaper)).toHaveLength(0);
  });

  test("(structural.ts:1276) equation-not-identical: an aligned English equation differs by bytes from its German block", () => {
    const records = {
      g: {
        kind: "source-block",
        id: "eq-1",
        paper: "brownian-motion",
        latex: "\\lambda_x = \\sqrt{2Dt}",
      },
      // Keyed the production way, because the equation-identity check resolves BOTH ends of an
      // edge through `<paper>#<id>` maps: a unit under a bare key lands at `#eq-1-en` and the
      // edge's lookup for `brownian-motion#eq-1-en` misses it.
      "translation-unit:brownian-motion:eq-1-en": {
        kind: "translation-unit",
        id: "eq-1-en",
        paper: "brownian-motion",
        latex: "\\lambda_x = \\sqrt{2 D t}",
      },
      al: {
        kind: "alignment",
        id: "al-1",
        paper: "brownian-motion",
        edges: [{ source: { blockId: "eq-1" }, target: { translationUnitId: "eq-1-en" } }],
      },
    };
    expectSite(
      run(checkEquationNotIdentical, records),
      "alignments.al-1.edges[0]",
      'English translation equation block "eq-1-en" differs by bytes from aligned German block "eq-1"',
    );

    // NOT the site at :1142. That one compares germanLatex and englishLatex carried on ONE record;
    // this one compares two records joined by an alignment edge. Neither record here has both
    // fields, so only this site can be speaking.
    expect(
      run(checkEquationNotIdentical, records).filter((r) => r.path === "equations.eq-1"),
    ).toHaveLength(0);

    // Byte-identical across the edge is silent. Notation is not translated, so the English face
    // carries the German bytes and the two spaces above are a real difference, not a formatting one.
    const UNIT_KEY = "translation-unit:brownian-motion:eq-1-en";
    const identical = {
      ...records,
      [UNIT_KEY]: { ...records[UNIT_KEY], latex: "\\lambda_x = \\sqrt{2Dt}" },
    };
    expect(run(checkEquationNotIdentical, identical)).toHaveLength(0);
  });
});
