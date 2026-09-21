/**
 * Exhaustive refusal throw site test suite for src/content/checks/structural/structural.ts (am-muyh).
 *
 * Covers all 22 untested refusal throw sites across 5 refusal codes:
 * 1. duplicate-id (12 sites):
 *    - (structural.ts:198) translation-unit
 *    - (structural.ts:210) citation
 *    - (structural.ts:222) foundation
 *    - (structural.ts:234) quantity
 *    - (structural.ts:246) experiment
 *    - (structural.ts:258) scenario
 *    - (structural.ts:270) dataset
 *    - (structural.ts:282) tour
 *    - (structural.ts:294) constant-set
 *    - (structural.ts:306) misconception
 *    - (structural.ts:318) equation
 *    - (structural.ts:330) argument
 * 2. missing-source-block (3 sites):
 *    - (structural.ts:482) alignment edge missing sentenceId
 *    - (structural.ts:508) editorial note affectedIds missing source unit
 *    - (structural.ts:563) argument cross-paper reference unresolved
 * 3. broken-alignment (5 sites):
 *    - (structural.ts:737) German sentence without alignment edge
 *    - (structural.ts:764) German block-level alignable unit without alignment edge
 *    - (structural.ts:778) English translation unit without incoming alignment edge
 *    - (structural.ts:805) Suffixed translation unit without sibling split unit
 *    - (structural.ts:814) Unsuffixed translation unit exists beside suffixed units
 * 4. hero-quote-unresolved (1 site):
 *    - (structural.ts:1358) Hero quote text not matching anchor text
 * 5. span-digest-mismatch (1 site):
 *    - (structural.ts:1534) Alignment edge target translation unit digest mismatch
 *
 * Each test cites its explicit throw site (structural.ts:<line>) and provides both an accept
 * path and a reject path exercising the exact structural boundary condition.
 */

import { describe, expect, test } from "bun:test";
import type { CheckContext, CheckReportItem } from "../../compiler/checks/registry.ts";
import { spanTextDigest } from "../../schemas/spans.ts";
import {
  checkBrokenAlignment,
  checkDuplicateId,
  checkHeroQuoteUnresolved,
  checkMissingSourceBlock,
  checkSpanDigestMismatch,
} from "./structural.ts";

function createMockContext(
  records: Record<string, unknown> = {},
  indexes: unknown = {},
): {
  ctx: CheckContext;
  reports: CheckReportItem[];
} {
  const reports: CheckReportItem[] = [];
  const map = new Map<string, unknown>(Object.entries(records));
  const ctx: CheckContext = {
    records: map,
    files: [],
    indexes,
    report: (item: CheckReportItem) => reports.push(item),
  };
  return { ctx, reports };
}

describe("checkDuplicateId Refusals (structural.ts)", () => {
  test("checkDuplicateId: (structural.ts:198) duplicate-id rejects duplicate translation unit id in same paper, accepts unique ids", () => {
    // Reject: duplicate translation unit id in same paper
    const reject = createMockContext({
      tu1: { kind: "translation-unit", id: "tu-1", paper: "paper-a" },
      tu2: { kind: "translation-unit", id: "tu-1", paper: "paper-a" },
    });
    checkDuplicateId.run(reject.ctx);
    expect(reject.reports).toHaveLength(1);
    expect(reject.reports[0]?.rule).toBe("duplicate-id");
    expect(reject.reports[0]?.recordId).toBe("tu-1");
    expect(reject.reports[0]?.message).toContain(
      'Duplicate translation unit id "tu-1" in paper "paper-a".',
    );

    // Accept: unique translation unit ids in same paper
    const accept = createMockContext({
      tu1: { kind: "translation-unit", id: "tu-1", paper: "paper-a" },
      tu2: { kind: "translation-unit", id: "tu-2", paper: "paper-a" },
    });
    checkDuplicateId.run(accept.ctx);
    expect(accept.reports).toHaveLength(0);
  });

  test("checkDuplicateId: (structural.ts:210) duplicate-id rejects duplicate citation id in bibliography namespace, accepts unique ids", () => {
    // Reject: duplicate citation id
    const reject = createMockContext({
      c1: { kind: "citation", id: "cite-1" },
      c2: { kind: "citation", id: "cite-1" },
    });
    checkDuplicateId.run(reject.ctx);
    expect(reject.reports).toHaveLength(1);
    expect(reject.reports[0]?.rule).toBe("duplicate-id");
    expect(reject.reports[0]?.recordId).toBe("cite-1");
    expect(reject.reports[0]?.message).toContain(
      'Duplicate citation id "cite-1" in bibliography namespace.',
    );

    // Accept: unique citation ids
    const accept = createMockContext({
      c1: { kind: "citation", id: "cite-1" },
      c2: { kind: "citation", id: "cite-2" },
    });
    checkDuplicateId.run(accept.ctx);
    expect(accept.reports).toHaveLength(0);
  });

  test("checkDuplicateId: (structural.ts:222) duplicate-id rejects duplicate foundation id in foundations namespace, accepts unique ids", () => {
    // Reject: duplicate foundation id
    const reject = createMockContext({
      f1: { kind: "foundation", id: "fdn-1" },
      f2: { kind: "foundation", id: "fdn-1" },
    });
    checkDuplicateId.run(reject.ctx);
    expect(reject.reports).toHaveLength(1);
    expect(reject.reports[0]?.rule).toBe("duplicate-id");
    expect(reject.reports[0]?.recordId).toBe("fdn-1");
    expect(reject.reports[0]?.message).toContain(
      'Duplicate foundation id "fdn-1" in foundations namespace.',
    );

    // Accept: unique foundation ids
    const accept = createMockContext({
      f1: { kind: "foundation", id: "fdn-1" },
      f2: { kind: "foundation", id: "fdn-2" },
    });
    checkDuplicateId.run(accept.ctx);
    expect(accept.reports).toHaveLength(0);
  });

  test("checkDuplicateId: (structural.ts:234) duplicate-id rejects duplicate quantity id in quantities namespace, accepts unique ids", () => {
    // Reject: duplicate quantity id
    const reject = createMockContext({
      q1: { kind: "quantity", id: "qty-1" },
      q2: { kind: "quantity", id: "qty-1" },
    });
    checkDuplicateId.run(reject.ctx);
    expect(reject.reports).toHaveLength(1);
    expect(reject.reports[0]?.rule).toBe("duplicate-id");
    expect(reject.reports[0]?.recordId).toBe("qty-1");
    expect(reject.reports[0]?.message).toContain(
      'Duplicate quantity id "qty-1" in quantities namespace.',
    );

    // Accept: unique quantity ids
    const accept = createMockContext({
      q1: { kind: "quantity", id: "qty-1" },
      q2: { kind: "quantity", id: "qty-2" },
    });
    checkDuplicateId.run(accept.ctx);
    expect(accept.reports).toHaveLength(0);
  });

  test("checkDuplicateId: (structural.ts:246) duplicate-id rejects duplicate experiment id, accepts unique ids", () => {
    // Reject: duplicate experiment id
    const reject = createMockContext({
      e1: { kind: "experiment", id: "exp-1" },
      e2: { kind: "experiment", id: "exp-1" },
    });
    checkDuplicateId.run(reject.ctx);
    expect(reject.reports).toHaveLength(1);
    expect(reject.reports[0]?.rule).toBe("duplicate-id");
    expect(reject.reports[0]?.recordId).toBe("exp-1");
    expect(reject.reports[0]?.message).toContain('Duplicate experiment id "exp-1".');

    // Accept: unique experiment ids
    const accept = createMockContext({
      e1: { kind: "experiment", id: "exp-1" },
      e2: { kind: "experiment", id: "exp-2" },
    });
    checkDuplicateId.run(accept.ctx);
    expect(accept.reports).toHaveLength(0);
  });

  test("checkDuplicateId: (structural.ts:258) duplicate-id rejects duplicate scenario id, accepts unique ids", () => {
    // Reject: duplicate scenario id
    const reject = createMockContext({
      s1: { kind: "scenario", id: "scn-1" },
      s2: { kind: "scenario", id: "scn-1" },
    });
    checkDuplicateId.run(reject.ctx);
    expect(reject.reports).toHaveLength(1);
    expect(reject.reports[0]?.rule).toBe("duplicate-id");
    expect(reject.reports[0]?.recordId).toBe("scn-1");
    expect(reject.reports[0]?.message).toContain('Duplicate scenario id "scn-1".');

    // Accept: unique scenario ids
    const accept = createMockContext({
      s1: { kind: "scenario", id: "scn-1" },
      s2: { kind: "scenario", id: "scn-2" },
    });
    checkDuplicateId.run(accept.ctx);
    expect(accept.reports).toHaveLength(0);
  });

  test("checkDuplicateId: (structural.ts:270) duplicate-id rejects duplicate dataset id, accepts unique ids", () => {
    // Reject: duplicate dataset id
    const reject = createMockContext({
      d1: { kind: "dataset", id: "ds-1" },
      d2: { kind: "dataset", id: "ds-1" },
    });
    checkDuplicateId.run(reject.ctx);
    expect(reject.reports).toHaveLength(1);
    expect(reject.reports[0]?.rule).toBe("duplicate-id");
    expect(reject.reports[0]?.recordId).toBe("ds-1");
    expect(reject.reports[0]?.message).toContain('Duplicate dataset id "ds-1".');

    // Accept: unique dataset ids
    const accept = createMockContext({
      d1: { kind: "dataset", id: "ds-1" },
      d2: { kind: "dataset", id: "ds-2" },
    });
    checkDuplicateId.run(accept.ctx);
    expect(accept.reports).toHaveLength(0);
  });

  test("checkDuplicateId: (structural.ts:282) duplicate-id rejects duplicate tour id, accepts unique ids", () => {
    // Reject: duplicate tour id
    const reject = createMockContext({
      t1: { kind: "tour", id: "tour-1" },
      t2: { kind: "tour", id: "tour-1" },
    });
    checkDuplicateId.run(reject.ctx);
    expect(reject.reports).toHaveLength(1);
    expect(reject.reports[0]?.rule).toBe("duplicate-id");
    expect(reject.reports[0]?.recordId).toBe("tour-1");
    expect(reject.reports[0]?.message).toContain('Duplicate tour id "tour-1".');

    // Accept: unique tour ids
    const accept = createMockContext({
      t1: { kind: "tour", id: "tour-1" },
      t2: { kind: "tour", id: "tour-2" },
    });
    checkDuplicateId.run(accept.ctx);
    expect(accept.reports).toHaveLength(0);
  });

  test("checkDuplicateId: (structural.ts:294) duplicate-id rejects duplicate constant set id, accepts unique ids", () => {
    // Reject: duplicate constant set id
    const reject = createMockContext({
      c1: { kind: "constant-set", id: "cs-1" },
      c2: { kind: "constant-set", id: "cs-1" },
    });
    checkDuplicateId.run(reject.ctx);
    expect(reject.reports).toHaveLength(1);
    expect(reject.reports[0]?.rule).toBe("duplicate-id");
    expect(reject.reports[0]?.recordId).toBe("cs-1");
    expect(reject.reports[0]?.message).toContain('Duplicate constant set id "cs-1".');

    // Accept: unique constant set ids
    const accept = createMockContext({
      c1: { kind: "constant-set", id: "cs-1" },
      c2: { kind: "constant-set", id: "cs-2" },
    });
    checkDuplicateId.run(accept.ctx);
    expect(accept.reports).toHaveLength(0);
  });

  test("checkDuplicateId: (structural.ts:306) duplicate-id rejects duplicate misconception id, accepts unique ids", () => {
    // Reject: duplicate misconception id
    const reject = createMockContext({
      m1: { kind: "misconception", id: "misc-1" },
      m2: { kind: "misconception", id: "misc-1" },
    });
    checkDuplicateId.run(reject.ctx);
    expect(reject.reports).toHaveLength(1);
    expect(reject.reports[0]?.rule).toBe("duplicate-id");
    expect(reject.reports[0]?.recordId).toBe("misc-1");
    expect(reject.reports[0]?.message).toContain('Duplicate misconception id "misc-1".');

    // Accept: unique misconception ids
    const accept = createMockContext({
      m1: { kind: "misconception", id: "misc-1" },
      m2: { kind: "misconception", id: "misc-2" },
    });
    checkDuplicateId.run(accept.ctx);
    expect(accept.reports).toHaveLength(0);
  });

  test("checkDuplicateId: (structural.ts:318) duplicate-id rejects duplicate equation id globally, accepts unique ids", () => {
    // Reject: duplicate equation id globally
    const reject = createMockContext({
      e1: { kind: "equation", id: "eq-1" },
      e2: { kind: "equation", id: "eq-1" },
    });
    checkDuplicateId.run(reject.ctx);
    expect(reject.reports).toHaveLength(1);
    expect(reject.reports[0]?.rule).toBe("duplicate-id");
    expect(reject.reports[0]?.recordId).toBe("eq-1");
    expect(reject.reports[0]?.message).toContain('Duplicate equation id "eq-1" globally.');

    // Accept: unique equation ids globally
    const accept = createMockContext({
      e1: { kind: "equation", id: "eq-1" },
      e2: { kind: "equation", id: "eq-2" },
    });
    checkDuplicateId.run(accept.ctx);
    expect(accept.reports).toHaveLength(0);
  });

  test("checkDuplicateId: (structural.ts:330) duplicate-id rejects duplicate argument id globally, accepts unique ids", () => {
    // Reject: duplicate argument id globally
    const reject = createMockContext({
      a1: { kind: "argument", id: "arg-1" },
      a2: { kind: "argument", id: "arg-1" },
    });
    checkDuplicateId.run(reject.ctx);
    expect(reject.reports).toHaveLength(1);
    expect(reject.reports[0]?.rule).toBe("duplicate-id");
    expect(reject.reports[0]?.recordId).toBe("arg-1");
    expect(reject.reports[0]?.message).toContain('Duplicate argument id "arg-1" globally.');

    // Accept: unique argument ids globally
    const accept = createMockContext({
      a1: { kind: "argument", id: "arg-1" },
      a2: { kind: "argument", id: "arg-2" },
    });
    checkDuplicateId.run(accept.ctx);
    expect(accept.reports).toHaveLength(0);
  });
});

describe("checkMissingSourceBlock Refusals (structural.ts)", () => {
  test("checkMissingSourceBlock: (structural.ts:482) missing-source-block rejects alignment edge referencing missing sentence span, accepts valid sentence span", () => {
    // Reject: alignment edge references sentence span missing from paper source blocks
    const reject = createMockContext({
      b1: {
        kind: "source-block",
        id: "b1",
        paper: "paper-a",
        sentenceSpans: [{ id: "b1-s1" }],
      },
      al1: {
        kind: "alignment",
        id: "al-1",
        paper: "paper-a",
        edges: [
          {
            source: {
              blockId: "b1",
              sentenceId: "b1-s99",
              paper: "paper-a",
            },
          },
        ],
      },
    });
    checkMissingSourceBlock.run(reject.ctx);
    expect(reject.reports).toHaveLength(1);
    expect(reject.reports[0]?.rule).toBe("missing-source-block");
    expect(reject.reports[0]?.recordId).toBe("al-1");
    expect(reject.reports[0]?.path).toBe("alignments.al-1.edges[0].source.sentenceId");
    expect(reject.reports[0]?.message).toContain(
      'Alignment edge references missing sentence span "b1-s99" in paper "paper-a".',
    );

    // Accept: alignment edge references existing sentence span
    const accept = createMockContext({
      b1: {
        kind: "source-block",
        id: "b1",
        paper: "paper-a",
        sentenceSpans: [{ id: "b1-s1" }],
      },
      al1: {
        kind: "alignment",
        id: "al-1",
        paper: "paper-a",
        edges: [
          {
            source: {
              blockId: "b1",
              sentenceId: "b1-s1",
              paper: "paper-a",
            },
          },
        ],
      },
    });
    checkMissingSourceBlock.run(accept.ctx);
    expect(accept.reports).toHaveLength(0);
  });

  test("checkMissingSourceBlock: (structural.ts:508) missing-source-block rejects editorial note referencing missing source unit, accepts existing source unit", () => {
    // Reject: editorial note affectedIds references missing source unit s1-p1
    const reject = createMockContext({
      note1: {
        kind: "editorial-note",
        id: "note-1",
        paper: "paper-a",
        affectedIds: ["s1-p1"],
      },
    });
    checkMissingSourceBlock.run(reject.ctx);
    expect(reject.reports).toHaveLength(1);
    expect(reject.reports[0]?.rule).toBe("missing-source-block");
    expect(reject.reports[0]?.recordId).toBe("note-1");
    expect(reject.reports[0]?.path).toBe("editorial-notes.note-1.affectedIds");
    expect(reject.reports[0]?.message).toContain(
      'Editorial note "note-1" references missing source unit "s1-p1" in paper "paper-a".',
    );

    // Accept: source unit s1-p1 exists in paper-a
    const accept = createMockContext({
      s1p1: {
        kind: "source-block",
        id: "s1-p1",
        paper: "paper-a",
      },
      note1: {
        kind: "editorial-note",
        id: "note-1",
        paper: "paper-a",
        affectedIds: ["s1-p1"],
      },
    });
    checkMissingSourceBlock.run(accept.ctx);
    expect(accept.reports).toHaveLength(0);
  });

  test("checkMissingSourceBlock: (structural.ts:563) missing-source-block rejects cross-paper reference to non-existent record, accepts existing reference", () => {
    // Reject: argument prerequisites references special-relativity#eq-s8-d9 which does not exist
    const reject = createMockContext({
      arg1: {
        kind: "argument",
        id: "arg-1",
        prerequisites: ["special-relativity#eq-s8-d9"],
      },
    });
    checkMissingSourceBlock.run(reject.ctx);
    expect(reject.reports).toHaveLength(1);
    expect(reject.reports[0]?.rule).toBe("missing-source-block");
    expect(reject.reports[0]?.recordId).toBe("arg-1");
    expect(reject.reports[0]?.path).toBe("arguments.arg-1");
    expect(reject.reports[0]?.message).toContain(
      'Cross-paper reference "special-relativity#eq-s8-d9" to paper "special-relativity" does not exist.',
    );

    // Accept: referenced record exists in records
    const accept = createMockContext({
      "eq-s8-d9": {
        kind: "equation",
        id: "eq-s8-d9",
        paper: "special-relativity",
      },
      arg1: {
        kind: "argument",
        id: "arg-1",
        prerequisites: ["special-relativity#eq-s8-d9"],
      },
    });
    checkMissingSourceBlock.run(accept.ctx);
    expect(accept.reports).toHaveLength(0);
  });
});

describe("checkBrokenAlignment Refusals (structural.ts)", () => {
  test("checkBrokenAlignment: (structural.ts:737) broken-alignment rejects German sentence with no alignment edge, accepts aligned sentence", () => {
    // Reject: German sentence b1-s1 in block b1 has no alignment edge
    const reject = createMockContext({
      b1: {
        kind: "source-block",
        id: "b1",
        paper: "paper-a",
        sentenceSpans: [{ id: "b1-s1" }],
      },
    });
    checkBrokenAlignment.run(reject.ctx);
    expect(reject.reports).toHaveLength(1);
    expect(reject.reports[0]?.rule).toBe("broken-alignment");
    expect(reject.reports[0]?.recordId).toBe("b1");
    expect(reject.reports[0]?.path).toBe("source-blocks.b1.sentenceSpans.b1-s1");
    expect(reject.reports[0]?.message).toContain(
      'German sentence "b1-s1" in block "b1" has no alignment edge.',
    );

    // Accept: German sentence b1-s1 has an alignment edge targeting tu-1
    const accept = createMockContext({
      b1: {
        kind: "source-block",
        id: "b1",
        paper: "paper-a",
        sentenceSpans: [{ id: "b1-s1" }],
      },
      tu1: {
        kind: "translation-unit",
        id: "tu-1",
        paper: "paper-a",
      },
      al1: {
        kind: "alignment",
        id: "al-1",
        paper: "paper-a",
        edges: [
          {
            source: { blockId: "b1", sentenceId: "b1-s1" },
            target: { translationUnitId: "tu-1" },
          },
        ],
      },
    });
    checkBrokenAlignment.run(accept.ctx);
    expect(accept.reports).toHaveLength(0);
  });

  test("checkBrokenAlignment: (structural.ts:764) broken-alignment rejects German block-level alignable unit with no alignment edge, accepts aligned block", () => {
    // Reject: German heading s1-h1 has no alignment edge
    const reject = createMockContext({
      s1h1: {
        kind: "source-block",
        id: "s1-h1",
        paper: "paper-a",
        blockKind: "heading",
      },
    });
    checkBrokenAlignment.run(reject.ctx);
    expect(reject.reports).toHaveLength(1);
    expect(reject.reports[0]?.rule).toBe("broken-alignment");
    expect(reject.reports[0]?.recordId).toBe("s1-h1");
    expect(reject.reports[0]?.path).toBe("source-blocks.s1-h1");
    expect(reject.reports[0]?.message).toContain('German block-level alignable unit "s1-h1"');

    // Accept: German heading s1-h1 has an alignment edge targeting tu-h1
    const accept = createMockContext({
      s1h1: {
        kind: "source-block",
        id: "s1-h1",
        paper: "paper-a",
        blockKind: "heading",
      },
      tuh1: {
        kind: "translation-unit",
        id: "tu-h1",
        paper: "paper-a",
      },
      al1: {
        kind: "alignment",
        id: "al-1",
        paper: "paper-a",
        edges: [
          {
            source: { blockId: "s1-h1" },
            target: { translationUnitId: "tu-h1" },
          },
        ],
      },
    });
    checkBrokenAlignment.run(accept.ctx);
    expect(accept.reports).toHaveLength(0);
  });

  test("checkBrokenAlignment: (structural.ts:778) broken-alignment rejects English translation unit with no incoming alignment edge, accepts targeted translation unit", () => {
    // Reject: tu-2 has no incoming alignment edge
    const reject = createMockContext({
      s1p1: {
        kind: "source-block",
        id: "s1-p1",
        paper: "paper-a",
      },
      tu1: {
        kind: "translation-unit",
        id: "tu-1",
        paper: "paper-a",
      },
      tu2: {
        kind: "translation-unit",
        id: "tu-2",
        paper: "paper-a",
      },
      al1: {
        kind: "alignment",
        id: "al-1",
        paper: "paper-a",
        edges: [
          {
            source: { blockId: "s1-p1" },
            target: { translationUnitId: "tu-1" },
          },
        ],
      },
    });
    checkBrokenAlignment.run(reject.ctx);
    expect(reject.reports).toHaveLength(1);
    expect(reject.reports[0]?.rule).toBe("broken-alignment");
    expect(reject.reports[0]?.recordId).toBe("tu-2");
    expect(reject.reports[0]?.path).toBe("translation-units.tu-2");
    expect(reject.reports[0]?.message).toContain(
      'English translation unit "tu-2" has no incoming alignment edge.',
    );

    // Accept: all translation units have incoming alignment edges
    const accept = createMockContext({
      s1p1: {
        kind: "source-block",
        id: "s1-p1",
        paper: "paper-a",
      },
      tu1: {
        kind: "translation-unit",
        id: "tu-1",
        paper: "paper-a",
      },
      al1: {
        kind: "alignment",
        id: "al-1",
        paper: "paper-a",
        edges: [
          {
            source: { blockId: "s1-p1" },
            target: { translationUnitId: "tu-1" },
          },
        ],
      },
    });
    checkBrokenAlignment.run(accept.ctx);
    expect(accept.reports).toHaveLength(0);
  });

  test("checkBrokenAlignment: (structural.ts:805) broken-alignment rejects suffixed translation unit with no sibling split unit, accepts paired split units", () => {
    // Reject: s3-p2-s1a exists without sibling split unit (only 1 suffix)
    const reject = createMockContext({
      s3p2s1: {
        kind: "source-block",
        id: "s3-p2-s1",
        paper: "paper-a",
      },
      s3p2s1a: {
        kind: "translation-unit",
        id: "s3-p2-s1a",
        paper: "paper-a",
      },
      al1: {
        kind: "alignment",
        id: "al-1",
        paper: "paper-a",
        edges: [
          {
            source: { blockId: "s3-p2-s1" },
            target: { translationUnitId: "s3-p2-s1a" },
          },
        ],
      },
    });
    checkBrokenAlignment.run(reject.ctx);
    expect(reject.reports).toHaveLength(1);
    expect(reject.reports[0]?.rule).toBe("broken-alignment");
    expect(reject.reports[0]?.recordId).toBe("s3-p2-s1a");
    expect(reject.reports[0]?.path).toBe("translation-units.s3-p2-s1a");
    expect(reject.reports[0]?.message).toContain(
      'Suffixed translation unit "s3-p2-s1a" has no sibling split unit',
    );

    // Accept: s3-p2-s1a and s3-p2-s1b are paired split units
    const accept = createMockContext({
      s3p2s1: {
        kind: "source-block",
        id: "s3-p2-s1",
        paper: "paper-a",
      },
      s3p2s1a: {
        kind: "translation-unit",
        id: "s3-p2-s1a",
        paper: "paper-a",
      },
      s3p2s1b: {
        kind: "translation-unit",
        id: "s3-p2-s1b",
        paper: "paper-a",
      },
      al1: {
        kind: "alignment",
        id: "al-1",
        paper: "paper-a",
        edges: [
          {
            source: { blockId: "s3-p2-s1" },
            target: { translationUnitId: "s3-p2-s1a" },
          },
          {
            source: { blockId: "s3-p2-s1" },
            target: { translationUnitId: "s3-p2-s1b" },
          },
        ],
      },
    });
    checkBrokenAlignment.run(accept.ctx);
    expect(accept.reports).toHaveLength(0);
  });

  test("checkBrokenAlignment: (structural.ts:814) broken-alignment rejects unsuffixed translation unit existing beside suffixed units, accepts isolated splits", () => {
    // Reject: unsuffixed s3-p2-s1 exists beside suffixed units s3-p2-s1a and s3-p2-s1b
    const reject = createMockContext({
      s3p2s1Block: {
        kind: "source-block",
        id: "s3-p2-s1",
        paper: "paper-a",
      },
      s3p2s1Tu: {
        kind: "translation-unit",
        id: "s3-p2-s1",
        paper: "paper-a",
      },
      s3p2s1a: {
        kind: "translation-unit",
        id: "s3-p2-s1a",
        paper: "paper-a",
      },
      s3p2s1b: {
        kind: "translation-unit",
        id: "s3-p2-s1b",
        paper: "paper-a",
      },
      al1: {
        kind: "alignment",
        id: "al-1",
        paper: "paper-a",
        edges: [
          {
            source: { blockId: "s3-p2-s1" },
            target: { translationUnitId: "s3-p2-s1" },
          },
          {
            source: { blockId: "s3-p2-s1" },
            target: { translationUnitId: "s3-p2-s1a" },
          },
          {
            source: { blockId: "s3-p2-s1" },
            target: { translationUnitId: "s3-p2-s1b" },
          },
        ],
      },
    });
    checkBrokenAlignment.run(reject.ctx);
    expect(reject.reports).toHaveLength(1);
    expect(reject.reports[0]?.rule).toBe("broken-alignment");
    expect(reject.reports[0]?.recordId).toBe("s3-p2-s1");
    expect(reject.reports[0]?.path).toBe("translation-units.s3-p2-s1");
    expect(reject.reports[0]?.message).toContain(
      'Unsuffixed translation unit "s3-p2-s1" exists beside suffixed units ("s3-p2-s1a", "s3-p2-s1b").',
    );

    // Accept: only suffixed split units exist without the unsuffixed base
    const accept = createMockContext({
      s3p2s1Block: {
        kind: "source-block",
        id: "s3-p2-s1",
        paper: "paper-a",
      },
      s3p2s1a: {
        kind: "translation-unit",
        id: "s3-p2-s1a",
        paper: "paper-a",
      },
      s3p2s1b: {
        kind: "translation-unit",
        id: "s3-p2-s1b",
        paper: "paper-a",
      },
      al1: {
        kind: "alignment",
        id: "al-1",
        paper: "paper-a",
        edges: [
          {
            source: { blockId: "s3-p2-s1" },
            target: { translationUnitId: "s3-p2-s1a" },
          },
          {
            source: { blockId: "s3-p2-s1" },
            target: { translationUnitId: "s3-p2-s1b" },
          },
        ],
      },
    });
    checkBrokenAlignment.run(accept.ctx);
    expect(accept.reports).toHaveLength(0);
  });
});

describe("checkHeroQuoteUnresolved Refusals (structural.ts)", () => {
  test("checkHeroQuoteUnresolved: (structural.ts:1358) hero-quote-unresolved rejects quote text not resolving exactly at anchor, accepts matching text", () => {
    // Reject: hero quote text does not resolve exactly at anchor s1-p1
    const reject = createMockContext({
      s1p1: {
        kind: "source-block",
        id: "s1-p1",
        text: "Dies ist der originale deutsche Satz.",
      },
      card1: {
        kind: "discovery-card",
        id: "card-1",
        heroQuote: {
          anchor: "s1-p1",
          text: "Dies ist ein ganz anderer Text.",
        },
      },
    });
    checkHeroQuoteUnresolved.run(reject.ctx);
    expect(reject.reports).toHaveLength(1);
    expect(reject.reports[0]?.rule).toBe("hero-quote-unresolved");
    expect(reject.reports[0]?.recordId).toBe("card-1");
    expect(reject.reports[0]?.path).toBe("card-1.heroQuote[0].text");
    expect(reject.reports[0]?.message).toContain(
      'Hero quote text does not resolve exactly at anchor "s1-p1".',
    );

    // Accept: hero quote text resolves verbatim at anchor s1-p1
    const accept = createMockContext({
      s1p1: {
        kind: "source-block",
        id: "s1-p1",
        text: "Dies ist der originale deutsche Satz.",
      },
      card1: {
        kind: "discovery-card",
        id: "card-1",
        heroQuote: {
          anchor: "s1-p1",
          text: "Dies ist der originale deutsche Satz.",
        },
      },
    });
    checkHeroQuoteUnresolved.run(accept.ctx);
    expect(accept.reports).toHaveLength(0);
  });
});

describe("checkSpanDigestMismatch Refusals (structural.ts)", () => {
  test("checkSpanDigestMismatch: (structural.ts:1534) span-digest-mismatch rejects alignment edge target translation unit digest mismatch, accepts matching digest", () => {
    const tuContent = "English translation text for digest check.";
    const validDigest = spanTextDigest(tuContent);

    // Reject: stored digest differs from computed digest
    const reject = createMockContext({
      "tu-1": {
        kind: "translation-unit",
        id: "tu-1",
        text: tuContent,
      },
      al1: {
        kind: "alignment",
        id: "al-1",
        edges: [
          {
            source: { blockId: "b1" },
            target: {
              translationUnitId: "tu-1",
              range: { textDigest: "sha256-invalid-digest-0000000000" },
            },
          },
        ],
      },
    });
    checkSpanDigestMismatch.run(reject.ctx);
    expect(reject.reports).toHaveLength(1);
    expect(reject.reports[0]?.rule).toBe("span-digest-mismatch");
    expect(reject.reports[0]?.recordId).toBe("al-1");
    expect(reject.reports[0]?.path).toBe("alignments.al-1.edges[0].target.range");
    expect(reject.reports[0]?.message).toContain(
      'Span digest mismatch on alignment edge target translation unit "tu-1": stored digest "sha256-invalid-digest-0000000000" differs from computed digest',
    );

    // Accept: stored digest matches computed digest exactly
    const accept = createMockContext({
      "tu-1": {
        kind: "translation-unit",
        id: "tu-1",
        text: tuContent,
      },
      al1: {
        kind: "alignment",
        id: "al-1",
        edges: [
          {
            source: { blockId: "b1" },
            target: {
              translationUnitId: "tu-1",
              range: { textDigest: validDigest },
            },
          },
        ],
      },
    });
    checkSpanDigestMismatch.run(accept.ctx);
    expect(accept.reports).toHaveLength(0);
  });
});
