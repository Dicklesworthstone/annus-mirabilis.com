/**
 * Comprehensive test suite for all 10 structural compiler rejections.
 *
 * Base valid corpus passes cleanly (0 errors).
 * Each rule has dedicated passing and failing mutation fixtures asserting
 * rule ID, record ID, and error messages.
 *
 * Spec: AGENTS.md, COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md §11.7, and am-cm-checks-structural-lq0
 */

import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { TestLogger } from "../../../testing/log/logger.ts";
import { clearRegisteredChecksForTests } from "../../compiler/checks/registry.ts";
import { compileContent } from "../../compiler/compiler.ts";
import { spanTextDigest } from "../../schemas/spans.ts";
import { registerStructuralChecks } from "./structural.ts";
import { createBaseCorpus, mutateCorpus } from "./testFixtures.ts";

const logger = new TestLogger("content-structural-tests");

afterAll(async () => {
  await logger.flush();
});

describe("Structural Compiler Rejections", () => {
  beforeEach(() => {
    clearRegisteredChecksForTests();
    registerStructuralChecks();
  });

  it("passes the valid base corpus with 0 structural errors", async () => {
    const start = performance.now();
    const corpus = createBaseCorpus();
    const result = await compileContent(corpus);

    const errors = result.diagnostics.filter((d) => d.severity === "error");
    const durationMs = performance.now() - start;

    logger.log({
      testId: "base-corpus-valid",
      extra: {
        mutation: "none",
        expectedRule: "none",
        actualRules: errors.map((d) => d.code),
        outcome: errors.length === 0 ? "passed" : "failed",
      },
      durationMs,
      outcome: errors.length === 0 ? "passed" : "failed",
    });

    expect(errors).toHaveLength(0);
    expect(result.ok).toBe(true);
  });

  // 1. duplicate-id
  it("rejects duplicate sentence span id within a source block and duplicate argument id globally", async () => {
    const start = performance.now();
    const base = createBaseCorpus();
    const mutated = mutateCorpus(base, [
      {
        path: "content/source-blocks/test-paper/s1-p1.json",
        text: JSON.stringify({
          kind: "source-block",
          id: "s1-p1",
          paper: "test-paper",
          order: 2,
          locators: [{ pdfPageIndex: 1, printedPage: 891 }],
          revision: 1,
          status: {
            transcription: "reviewed",
            mathTranscription: "not-applicable",
            translation: "reviewed",
            review: "reviewed",
          },
          inlines: [{ kind: "text", text: "Dies ist der erste Satz. Dies ist der zweite Satz." }],
          sentenceSpans: [
            {
              id: "s1-p1-s1", // Duplicate sentence span ID
              span: {
                start: 0,
                end: 24,
                blockRevision: 1,
                textDigest: spanTextDigest("Dies ist der erste Satz. Dies ist der zweite Satz."),
              },
            },
            {
              id: "s1-p1-s1", // DUPLICATE SENTENCE SPAN ID
              span: {
                start: 25,
                end: 50,
                blockRevision: 1,
                textDigest: spanTextDigest("Dies ist der erste Satz. Dies ist der zweite Satz."),
              },
            },
          ],
        }),
      },
      {
        path: "content/arguments/paper-b/arg-tp-01.json",
        text: JSON.stringify({
          schemaVersion: 1,
          kind: "argument",
          id: "arg-tp-01", // DUPLICATE ARGUMENT ID GLOBALLY
          paper: "paper-b",
          section: "s1",
          title: "Duplicate Argument",
          thesis: "Thesis",
          claim: "Claim",
          citations: ["cite-test-1905"],
          prerequisites: [],
          help: {},
          readings: {
            overview: [],
            "full-explanation": [],
            "every-step": [],
            "historical-context": [],
          },
          experiments: [],
        }),
      },
    ]);

    const result = await compileContent(mutated);
    const dupErrors = result.diagnostics.filter(
      (d) => d.code === "duplicate-id" || d.rule === "duplicate-id",
    );
    const durationMs = performance.now() - start;

    logger.log({
      testId: "duplicate-id-rejections",
      extra: {
        mutation: "duplicate-sentence-and-global-argument-id",
        expectedRule: "duplicate-id",
        actualRules: result.diagnostics.map((d) => d.code),
        outcome: dupErrors.length >= 1 ? "passed" : "failed",
      },
      durationMs,
      outcome: dupErrors.length >= 1 ? "passed" : "failed",
    });

    expect(dupErrors.length).toBeGreaterThanOrEqual(1);
    expect(dupErrors.some((e) => e.recordId === "s1-p1-s1" || e.recordId === "arg-tp-01")).toBe(
      true,
    );
    expect(dupErrors[0]!.repair).toBeDefined();
  });

  // 2. missing-source-block
  it("rejects translation unit pointing to s9-p1 which does not exist", async () => {
    const start = performance.now();
    const base = createBaseCorpus();
    const mutated = mutateCorpus(base, [
      {
        path: "content/translation-units/test-paper/s9-p1.json",
        text: JSON.stringify({
          kind: "translation-unit",
          id: "s9-p1",
          paper: "test-paper",
          sourceRefs: [{ paper: "test-paper", id: "s9-p1" }], // Missing source block
          inlines: [{ kind: "text", text: "Translation of missing block" }],
          translator: { name: "A. Translator", role: "translator" },
          lang: "en",
          revision: 1,
          reviewState: "reviewed",
        }),
      },
    ]);

    const result = await compileContent(mutated);
    const missingErrors = result.diagnostics.filter(
      (d) => d.code === "missing-source-block" || d.rule === "missing-source-block",
    );
    const durationMs = performance.now() - start;

    logger.log({
      testId: "missing-source-block-translation-ref",
      extra: {
        mutation: "translation-ref-missing-block",
        expectedRule: "missing-source-block",
        actualRules: result.diagnostics.map((d) => d.code),
        outcome: missingErrors.length > 0 ? "passed" : "failed",
      },
      durationMs,
      outcome: missingErrors.length > 0 ? "passed" : "failed",
    });

    expect(missingErrors.length).toBeGreaterThanOrEqual(1);
    expect(missingErrors.some((e) => e.message.includes("s9-p1"))).toBe(true);
  });

  it("rejects cross-paper reference to special-relativity#eq-s8-d9 that does not exist", async () => {
    const start = performance.now();
    const base = createBaseCorpus();
    const mutated = mutateCorpus(base, [
      {
        path: "content/arguments/test-paper/arg-tp-01.json",
        text: JSON.stringify({
          schemaVersion: 1,
          kind: "argument",
          id: "arg-tp-01",
          paper: "test-paper",
          section: "s1",
          title: "Test Argument",
          thesis: "First premise",
          claim: "Claim",
          citations: ["cite-test-1905"],
          prerequisites: [{ id: "special-relativity#eq-s8-d9", edge: "premise" }],
          help: {},
          readings: {
            overview: [],
            "full-explanation": [],
            "every-step": [],
            "historical-context": [],
          },
          experiments: [],
        }),
      },
    ]);

    const result = await compileContent(mutated);
    const missingErrors = result.diagnostics.filter(
      (d) =>
        d.code === "missing-source-block" ||
        d.rule === "missing-source-block" ||
        d.code === "dangling-reference",
    );
    const durationMs = performance.now() - start;

    logger.log({
      testId: "missing-cross-paper-ref",
      extra: {
        mutation: "cross-paper-ref-missing",
        expectedRule: "missing-source-block",
        actualRules: result.diagnostics.map((d) => d.code),
        outcome: missingErrors.length > 0 ? "passed" : "failed",
      },
      durationMs,
      outcome: missingErrors.length > 0 ? "passed" : "failed",
    });

    expect(missingErrors.length).toBeGreaterThanOrEqual(1);
  });

  // 3. broken-alignment
  it("rejects an alignment edge whose range extends beyond the sentence", async () => {
    const start = performance.now();
    const base = createBaseCorpus();
    const mutated = mutateCorpus(base, [
      {
        path: "content/alignments/test-paper.json",
        text: JSON.stringify({
          kind: "alignment",
          id: "test-paper",
          paper: "test-paper",
          edges: [
            {
              source: { paper: "test-paper", blockId: "s1" },
              target: { translationUnitId: "s1" },
            },
            {
              source: {
                paper: "test-paper",
                blockId: "s1-p1",
                sentenceId: "s1-p1-s1",
                range: { start: 0, end: 99999, blockRevision: 1, textDigest: "dummy" },
              },
              target: { translationUnitId: "s1-p1-s1" },
            },
            {
              source: { paper: "test-paper", blockId: "s1-p1", sentenceId: "s1-p1-s2" },
              target: { translationUnitId: "s1-p1-s2" },
            },
            {
              source: { paper: "test-paper", blockId: "s1-eq1" },
              target: { translationUnitId: "s1-eq1" },
            },
            {
              source: { paper: "test-paper", blockId: "s1-fn1" },
              target: { translationUnitId: "s1-fn1" },
            },
            {
              source: { paper: "test-paper", blockId: "closing-dateline" },
              target: { translationUnitId: "closing-dateline" },
            },
            {
              source: { paper: "test-paper", blockId: "closing-received" },
              target: { translationUnitId: "closing-received" },
            },
          ],
        }),
      },
    ]);

    const result = await compileContent(mutated);
    const alignErrors = result.diagnostics.filter(
      (d) => d.code === "broken-alignment" || d.rule === "broken-alignment",
    );
    const durationMs = performance.now() - start;

    logger.log({
      testId: "broken-alignment-out-of-bounds-range",
      extra: {
        mutation: "alignment-range-out-of-bounds",
        expectedRule: "broken-alignment",
        actualRules: result.diagnostics.map((d) => d.code),
        outcome: alignErrors.length > 0 ? "passed" : "failed",
      },
      durationMs,
      outcome: alignErrors.length > 0 ? "passed" : "failed",
    });

    expect(alignErrors.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects unaligned German sentence, unaligned footnote, unaligned section heading, and unaligned closing", async () => {
    const start = performance.now();
    const base = createBaseCorpus();
    // Remove edges for s1-p1-s2, s1-fn1, s1, and closing-received
    const mutated = mutateCorpus(base, [
      {
        path: "content/alignments/test-paper.json",
        text: JSON.stringify({
          kind: "alignment",
          id: "test-paper",
          paper: "test-paper",
          edges: [
            {
              source: { paper: "test-paper", blockId: "s1-p1", sentenceId: "s1-p1-s1" },
              target: { translationUnitId: "s1-p1-s1" },
            },
            {
              source: { paper: "test-paper", blockId: "s1-eq1" },
              target: { translationUnitId: "s1-eq1" },
            },
            {
              source: { paper: "test-paper", blockId: "closing-dateline" },
              target: { translationUnitId: "closing-dateline" },
            },
          ],
        }),
      },
    ]);

    const result = await compileContent(mutated);
    const alignErrors = result.diagnostics.filter(
      (d) => d.code === "broken-alignment" || d.rule === "broken-alignment",
    );
    const durationMs = performance.now() - start;

    logger.log({
      testId: "unaligned-german-units",
      extra: {
        mutation: "unaligned-german-sentence-and-blocks",
        expectedRule: "broken-alignment",
        actualRules: result.diagnostics.map((d) => d.code),
        outcome: alignErrors.length >= 4 ? "passed" : "failed",
      },
      durationMs,
      outcome: alignErrors.length >= 4 ? "passed" : "failed",
    });

    expect(alignErrors.some((e) => e.message.includes("s1-p1-s2"))).toBe(true);
    expect(alignErrors.some((e) => e.message.includes("s1-fn1"))).toBe(true);
    expect(alignErrors.some((e) => e.message.includes("s1"))).toBe(true);
    expect(alignErrors.some((e) => e.message.includes("closing-received"))).toBe(true);
  });

  it("rejects lone suffixed unit s2-p1-s3a and lone block-level suffix s2-fn1a without siblings", async () => {
    const start = performance.now();
    const base = createBaseCorpus();
    const mutated = mutateCorpus(base, [
      {
        path: "content/translation-units/test-paper/s2-p1-s3a.json",
        text: JSON.stringify({
          kind: "translation-unit",
          id: "s2-p1-s3a", // Lone suffix
          paper: "test-paper",
          sourceRefs: [{ paper: "test-paper", id: "s1-p1-s1" }],
          inlines: [{ kind: "text", text: "Lone suffix a" }],
          translator: { name: "A. Translator", role: "translator" },
          lang: "en",
          revision: 1,
          reviewState: "reviewed",
        }),
      },
      {
        path: "content/translation-units/test-paper/s2-fn1a.json",
        text: JSON.stringify({
          kind: "translation-unit",
          id: "s2-fn1a", // Lone suffix
          paper: "test-paper",
          sourceRefs: [{ paper: "test-paper", id: "s1-fn1" }],
          inlines: [{ kind: "text", text: "Lone footnote suffix a" }],
          translator: { name: "A. Translator", role: "translator" },
          lang: "en",
          revision: 1,
          reviewState: "reviewed",
        }),
      },
    ]);

    const result = await compileContent(mutated);
    const alignErrors = result.diagnostics.filter(
      (d) => d.code === "broken-alignment" || d.rule === "broken-alignment",
    );
    const durationMs = performance.now() - start;

    logger.log({
      testId: "lone-suffix-split-units",
      extra: {
        mutation: "lone-suffix-split",
        expectedRule: "broken-alignment",
        actualRules: result.diagnostics.map((d) => d.code),
        outcome: alignErrors.length > 0 ? "passed" : "failed",
      },
      durationMs,
      outcome: alignErrors.length > 0 ? "passed" : "failed",
    });

    expect(alignErrors.some((e) => e.message.includes("s2-p1-s3a"))).toBe(true);
    expect(alignErrors.some((e) => e.message.includes("s2-fn1a"))).toBe(true);
  });

  // 4. dangling-citation
  it("rejects citation pais-1982 referenced by an editorial note but undefined", async () => {
    const start = performance.now();
    const base = createBaseCorpus();
    const mutated = mutateCorpus(base, [
      {
        path: "content/editorial-notes/test-paper/note-01.json",
        text: JSON.stringify({
          kind: "editorial-note",
          id: "note-01",
          paper: "test-paper",
          claim: "Historical claim referencing missing citation",
          author: { name: "Historian", role: "author" },
          sourceSupport: [{ citationId: "pais-1982", role: "secondary" }],
          affectedIds: ["s1-p1"],
          reviewState: "reviewed",
        }),
      },
    ]);

    const result = await compileContent(mutated);
    const citErrors = result.diagnostics.filter(
      (d) => d.code === "dangling-citation" || d.rule === "dangling-citation",
    );
    const durationMs = performance.now() - start;

    logger.log({
      testId: "dangling-citation-editorial-note",
      extra: {
        mutation: "editorial-note-missing-citation",
        expectedRule: "dangling-citation",
        actualRules: result.diagnostics.map((d) => d.code),
        outcome: citErrors.length > 0 ? "passed" : "failed",
      },
      durationMs,
      outcome: citErrors.length > 0 ? "passed" : "failed",
    });

    expect(citErrors.length).toBeGreaterThanOrEqual(1);
    expect(citErrors[0]!.message).toContain("pais-1982");
    expect(citErrors[0]!.repair).toBeDefined();
  });

  // 5. impossible-date-order
  it("rejects received date 1905-03-16 before date-line 1905-03-17", async () => {
    const start = performance.now();
    const base = createBaseCorpus();
    const mutated = mutateCorpus(base, [
      {
        path: "content/papers/test-paper.json",
        text: JSON.stringify({
          schemaVersion: 1,
          kind: "paper",
          id: "test-paper",
          slug: "test-paper",
          title: "Test Paper",
          germanTitle: "Test",
          description: "Test",
          citation: "cite-test-1905",
          status: "in-preparation",
          sourceStatus: "in-preparation",
          sourceNotice: "Notice",
          dates: [
            {
              type: "date-line",
              earliest: "1905-03-17",
              latest: "1905-03-17",
              precision: "day",
              source: "Date-line",
              verifiedAt: "2026-01-01",
            },
            {
              type: "received",
              earliest: "1905-03-16", // Received before date-line
              latest: "1905-03-16",
              precision: "day",
              source: "Receipt",
              verifiedAt: "2026-01-01",
            },
          ],
          orderedBlockIds: [
            "s1",
            "s1-p1",
            "s1-eq1",
            "s1-fn1",
            "closing-dateline",
            "closing-received",
          ],
          sections: [{ id: "s1", title: "First", arguments: ["arg-tp-01"] }],
        }),
      },
    ]);

    const result = await compileContent(mutated);
    const dateErrors = result.diagnostics.filter(
      (d) => d.code === "impossible-date-order" || d.rule === "impossible-date-order",
    );
    const durationMs = performance.now() - start;

    logger.log({
      testId: "impossible-date-order-day-inversion",
      extra: {
        mutation: "received-before-dateline",
        expectedRule: "impossible-date-order",
        actualRules: result.diagnostics.map((d) => d.code),
        outcome: dateErrors.length > 0 ? "passed" : "failed",
      },
      durationMs,
      outcome: dateErrors.length > 0 ? "passed" : "failed",
    });

    expect(dateErrors.length).toBeGreaterThanOrEqual(1);
    expect(dateErrors[0]!.message).toContain("strictly after received date");
  });

  it("passes date-line 'Bern, Mai 1905' with receipt on 11 May 1905, and fails 'Bern, Juni 1905' with receipt on 11 May 1905", async () => {
    const start = performance.now();
    const base = createBaseCorpus();

    // 1. Passing month precision date-line: Mai 1905 (earliest 1905-05-01 <= receipt latest 1905-05-11)
    const passingRes = await compileContent(base);
    expect(passingRes.diagnostics.filter((d) => d.code === "impossible-date-order")).toHaveLength(
      0,
    );

    // 2. Failing month precision date-line: Juni 1905 (earliest 1905-06-01 > receipt latest 1905-05-11)
    const failingMut = mutateCorpus(base, [
      {
        path: "content/papers/test-paper.json",
        text: JSON.stringify({
          schemaVersion: 1,
          kind: "paper",
          id: "test-paper",
          slug: "test-paper",
          title: "Test Paper",
          germanTitle: "Test",
          description: "Test",
          citation: "cite-test-1905",
          status: "in-preparation",
          sourceStatus: "in-preparation",
          sourceNotice: "Notice",
          dates: [
            {
              type: "date-line",
              earliest: "1905-06-01",
              latest: "1905-06-30",
              precision: "month",
              source: "Bern Juni date-line",
              verifiedAt: "2026-01-01",
            },
            {
              type: "received",
              earliest: "1905-05-11",
              latest: "1905-05-11",
              precision: "day",
              source: "Receipt",
              verifiedAt: "2026-01-01",
            },
          ],
          orderedBlockIds: [
            "s1",
            "s1-p1",
            "s1-eq1",
            "s1-fn1",
            "closing-dateline",
            "closing-received",
          ],
          sections: [{ id: "s1", title: "First", arguments: ["arg-tp-01"] }],
        }),
      },
    ]);

    const failingRes = await compileContent(failingMut);
    const dateErrors = failingRes.diagnostics.filter(
      (d) => d.code === "impossible-date-order" || d.rule === "impossible-date-order",
    );
    const durationMs = performance.now() - start;

    logger.log({
      testId: "impossible-date-order-month-precision",
      extra: {
        mutation: "june-dateline-may-receipt",
        expectedRule: "impossible-date-order",
        actualRules: failingRes.diagnostics.map((d) => d.code),
        outcome: dateErrors.length > 0 ? "passed" : "failed",
      },
      durationMs,
      outcome: dateErrors.length > 0 ? "passed" : "failed",
    });

    expect(dateErrors.length).toBeGreaterThanOrEqual(1);
  });

  it("passes dissertation real dates and fails swapped date-line and submission dates", async () => {
    const start = performance.now();
    const base = createBaseCorpus();

    // 1. Passing real dissertation dates: dated 30 April 1905, submitted 20 July 1905
    const dissBase = mutateCorpus(base, [
      {
        path: "content/papers/test-paper.json",
        text: JSON.stringify({
          schemaVersion: 1,
          kind: "paper",
          id: "test-paper",
          slug: "test-paper",
          title: "Dissertation",
          germanTitle: "Dissertation",
          description: "Dissertation",
          citation: "cite-test-1905",
          companion: true,
          status: "in-preparation",
          sourceStatus: "in-preparation",
          sourceNotice: "Notice",
          dates: [
            {
              type: "date-line",
              earliest: "1905-04-30",
              latest: "1905-04-30",
              precision: "day",
              source: "Dated 30 April 1905",
              verifiedAt: "2026-01-01",
            },
            {
              type: "submitted",
              earliest: "1905-07-20",
              latest: "1905-07-20",
              precision: "day",
              source: "Submitted 20 July 1905",
              verifiedAt: "2026-01-01",
            },
          ],
          orderedBlockIds: [
            "s1",
            "s1-p1",
            "s1-eq1",
            "s1-fn1",
            "closing-dateline",
            "closing-received",
          ],
          sections: [{ id: "s1", title: "First", arguments: ["arg-tp-01"] }],
        }),
      },
    ]);

    const dissPass = await compileContent(dissBase);
    expect(dissPass.diagnostics.filter((d) => d.code === "impossible-date-order")).toHaveLength(0);

    // 2. Swapped dissertation dates: dated 20 July 1905, submitted 30 April 1905
    const dissSwap = mutateCorpus(base, [
      {
        path: "content/papers/test-paper.json",
        text: JSON.stringify({
          schemaVersion: 1,
          kind: "paper",
          id: "test-paper",
          slug: "test-paper",
          title: "Dissertation",
          germanTitle: "Dissertation",
          description: "Dissertation",
          citation: "cite-test-1905",
          companion: true,
          status: "in-preparation",
          sourceStatus: "in-preparation",
          sourceNotice: "Notice",
          dates: [
            {
              type: "date-line",
              earliest: "1905-07-20",
              latest: "1905-07-20",
              precision: "day",
              source: "Swapped date-line",
              verifiedAt: "2026-01-01",
            },
            {
              type: "submitted",
              earliest: "1905-04-30",
              latest: "1905-04-30",
              precision: "day",
              source: "Swapped submission",
              verifiedAt: "2026-01-01",
            },
          ],
          orderedBlockIds: [
            "s1",
            "s1-p1",
            "s1-eq1",
            "s1-fn1",
            "closing-dateline",
            "closing-received",
          ],
          sections: [{ id: "s1", title: "First", arguments: ["arg-tp-01"] }],
        }),
      },
    ]);

    const dissFail = await compileContent(dissSwap);
    const dateErrors = dissFail.diagnostics.filter(
      (d) => d.code === "impossible-date-order" || d.rule === "impossible-date-order",
    );
    const durationMs = performance.now() - start;

    logger.log({
      testId: "impossible-date-order-dissertation-dates",
      extra: {
        mutation: "dissertation-swapped-dates",
        expectedRule: "impossible-date-order",
        actualRules: dissFail.diagnostics.map((d) => d.code),
        outcome: dateErrors.length > 0 ? "passed" : "failed",
      },
      durationMs,
      outcome: dateErrors.length > 0 ? "passed" : "failed",
    });

    expect(dateErrors.length).toBeGreaterThanOrEqual(1);
  });

  // 6. equation-not-identical
  it("rejects an English equation block with modified mathematical content / extra space", async () => {
    const start = performance.now();
    const base = createBaseCorpus();
    const mutated = mutateCorpus(base, [
      {
        path: "content/translation-units/test-paper/s1-eq1.json",
        text: JSON.stringify({
          kind: "translation-unit",
          id: "s1-eq1",
          paper: "test-paper",
          sourceRefs: [{ paper: "test-paper", id: "s1-eq1" }],
          inlines: [{ kind: "math", latex: "E = m c^2 " }], // Extra space in math
          latex: "E = m c^2 ",
          translator: { name: "A. Translator", role: "translator" },
          lang: "en",
          revision: 1,
          reviewState: "reviewed",
        }),
      },
      {
        path: "content/equations/test-paper/eq-tp-01.json",
        text: JSON.stringify({
          schemaVersion: 1,
          kind: "equation",
          id: "eq-tp-01",
          paper: "test-paper",
          argument: "arg-tp-01",
          title: "Energy Mass Relation",
          latex: "E = m c^2",
          germanLatex: "E = m c^2",
          englishLatex: "E = m c^2 ", // Byte difference
          notes: [],
        }),
      },
    ]);

    const result = await compileContent(mutated);
    const eqErrors = result.diagnostics.filter(
      (d) => d.code === "equation-not-identical" || d.rule === "equation-not-identical",
    );
    const durationMs = performance.now() - start;

    logger.log({
      testId: "equation-not-identical-byte-diff",
      extra: {
        mutation: "english-equation-extra-space",
        expectedRule: "equation-not-identical",
        actualRules: result.diagnostics.map((d) => d.code),
        outcome: eqErrors.length > 0 ? "passed" : "failed",
      },
      durationMs,
      outcome: eqErrors.length > 0 ? "passed" : "failed",
    });

    expect(eqErrors.length).toBeGreaterThanOrEqual(1);
    expect(eqErrors[0]!.repair).toBeDefined();
  });

  // 7. complete-while-missing
  it("rejects a paper marked complete with a machine-draft translation", async () => {
    const start = performance.now();
    const base = createBaseCorpus();
    const mutated = mutateCorpus(base, [
      {
        path: "content/papers/test-paper.json",
        text: JSON.stringify({
          schemaVersion: 1,
          kind: "paper",
          id: "test-paper",
          slug: "test-paper",
          title: "Test Paper",
          germanTitle: "Test",
          description: "Test",
          citation: "cite-test-1905",
          sourceStatus: "in-preparation",
          sourceNotice: "Notice",
          status: "complete", // Marked complete
          orderedBlockIds: [
            "s1",
            "s1-p1",
            "s1-eq1",
            "s1-fn1",
            "closing-dateline",
            "closing-received",
          ],
          sections: [{ id: "s1", title: "First", arguments: ["arg-tp-01"] }],
        }),
      },
      {
        path: "content/translation-units/test-paper/s1-p1-s1.json",
        text: JSON.stringify({
          kind: "translation-unit",
          id: "s1-p1-s1",
          paper: "test-paper",
          sourceRefs: [{ paper: "test-paper", id: "s1-p1-s1" }],
          inlines: [{ kind: "text", text: "Machine draft text" }],
          translator: { name: "Machine", role: "translator" },
          lang: "en",
          revision: 1,
          reviewState: "draft", // Unreviewed draft
        }),
      },
    ]);

    const result = await compileContent(mutated);
    const completeErrors = result.diagnostics.filter(
      (d) => d.code === "complete-while-missing" || d.rule === "complete-while-missing",
    );
    const durationMs = performance.now() - start;

    logger.log({
      testId: "complete-while-missing-draft-unit",
      extra: {
        mutation: "complete-status-with-draft-tu",
        expectedRule: "complete-while-missing",
        actualRules: result.diagnostics.map((d) => d.code),
        outcome: completeErrors.length > 0 ? "passed" : "failed",
      },
      durationMs,
      outcome: completeErrors.length > 0 ? "passed" : "failed",
    });

    expect(completeErrors.length).toBeGreaterThanOrEqual(1);
    expect(completeErrors[0]!.message).toContain("marked complete");
  });

  // 8. hero-quote-unresolved
  it("rejects hero quote with changed word and ellipsis quote with out-of-order segments", async () => {
    const start = performance.now();
    const base = createBaseCorpus();
    const mutated = mutateCorpus(base, [
      {
        path: "content/arguments/test-paper/arg-tp-01.json",
        text: JSON.stringify({
          schemaVersion: 1,
          kind: "argument",
          id: "arg-tp-01",
          paper: "test-paper",
          section: "s1",
          title: "Test Argument",
          thesis: "First premise",
          claim: "Claim",
          citations: ["cite-test-1905"],
          prerequisites: [],
          help: {},
          readings: {
            overview: [],
            "full-explanation": [],
            "every-step": [],
            "historical-context": [],
          },
          experiments: [],
          heroQuotes: [
            {
              anchor: "s1-p1",
              quote: "Dies ist der veränderte deutsche Satz.", // Changed word
            },
            {
              anchor: "s1-p1",
              segments: ["zweite deutsche Satz", "erste deutsche Satz"], // Out of order
            },
          ],
        }),
      },
    ]);

    const result = await compileContent(mutated);
    const quoteErrors = result.diagnostics.filter(
      (d) => d.code === "hero-quote-unresolved" || d.rule === "hero-quote-unresolved",
    );
    const durationMs = performance.now() - start;

    logger.log({
      testId: "hero-quote-unresolved-mismatch",
      extra: {
        mutation: "hero-quote-changed-word-and-out-of-order-segments",
        expectedRule: "hero-quote-unresolved",
        actualRules: result.diagnostics.map((d) => d.code),
        outcome: quoteErrors.length >= 2 ? "passed" : "failed",
      },
      durationMs,
      outcome: quoteErrors.length >= 2 ? "passed" : "failed",
    });

    expect(quoteErrors.length).toBeGreaterThanOrEqual(2);
  });

  // 9. ledger-marker-in-edition
  it("rejects edition paragraph containing a ledger page marker", async () => {
    const start = performance.now();
    const base = createBaseCorpus();
    const mutated = mutateCorpus(base, [
      {
        path: "content/source-blocks/test-paper/s1-p1.json",
        text: JSON.stringify({
          kind: "source-block",
          id: "s1-p1",
          paper: "test-paper",
          order: 2,
          locators: [{ pdfPageIndex: 1, printedPage: 891 }],
          revision: 1,
          status: {
            transcription: "reviewed",
            mathTranscription: "not-applicable",
            translation: "reviewed",
            review: "reviewed",
          },
          inlines: [
            {
              kind: "text",
              text: "Dies ist Text vor dem Marker.\n--- REVIEWED TRANSCRIPTION PAGE 1 OF 12 ---\nText danach.",
            },
          ],
        }),
      },
    ]);

    const result = await compileContent(mutated);
    const ledgerErrors = result.diagnostics.filter(
      (d) => d.code === "ledger-marker-in-edition" || d.rule === "ledger-marker-in-edition",
    );
    const durationMs = performance.now() - start;

    logger.log({
      testId: "ledger-marker-in-edition-rejection",
      extra: {
        mutation: "edition-with-ledger-page-marker",
        expectedRule: "ledger-marker-in-edition",
        actualRules: result.diagnostics.map((d) => d.code),
        outcome: ledgerErrors.length > 0 ? "passed" : "failed",
      },
      durationMs,
      outcome: ledgerErrors.length > 0 ? "passed" : "failed",
    });

    expect(ledgerErrors.length).toBeGreaterThanOrEqual(1);
    expect(ledgerErrors[0]!.message).toContain("ledger scan marker");
    expect(ledgerErrors[0]!.repair).toContain("Remove scan page furniture");
  });

  // 10. span-digest-mismatch
  it("fails when paragraph text is edited without re-measuring sentence spans or alignment ranges, and passes once re-measured", async () => {
    const start = performance.now();
    const base = createBaseCorpus();

    // Edited paragraph text while keeping old textDigest
    const oldDigest = spanTextDigest("Original unedited text");
    const mutated = mutateCorpus(base, [
      {
        path: "content/source-blocks/test-paper/s1-p1.json",
        text: JSON.stringify({
          kind: "source-block",
          id: "s1-p1",
          paper: "test-paper",
          order: 2,
          locators: [{ pdfPageIndex: 1, printedPage: 891 }],
          revision: 2, // Bumped revision but stale digest
          status: {
            transcription: "reviewed",
            mathTranscription: "not-applicable",
            translation: "reviewed",
            review: "reviewed",
          },
          inlines: [{ kind: "text", text: "Dies ist neu editierter Satz." }],
          sentenceSpans: [
            {
              id: "s1-p1-s1",
              span: {
                start: 0,
                end: 10,
                blockRevision: 2,
                textDigest: oldDigest, // STALE DIGEST MISMATCH
              },
            },
          ],
        }),
      },
    ]);

    const failResult = await compileContent(mutated);
    const digestErrors = failResult.diagnostics.filter(
      (d) => d.code === "span-digest-mismatch" || d.rule === "span-digest-mismatch",
    );

    expect(digestErrors.length).toBeGreaterThanOrEqual(1);
    expect(digestErrors[0]!.recordId).toBe("s1-p1");
    expect(digestErrors[0]!.repair).toContain("Re-measure the spans");

    // Fix: Re-measure spans with true computed digest
    const newText = "Dies ist neu editierter Satz.";
    const correctDigest = spanTextDigest(newText);
    const fixed = mutateCorpus(base, [
      {
        path: "content/source-blocks/test-paper/s1-p1.json",
        text: JSON.stringify({
          kind: "source-block",
          id: "s1-p1",
          paper: "test-paper",
          order: 2,
          locators: [{ pdfPageIndex: 1, printedPage: 891 }],
          revision: 2,
          status: {
            transcription: "reviewed",
            mathTranscription: "not-applicable",
            translation: "reviewed",
            review: "reviewed",
          },
          inlines: [{ kind: "text", text: newText }],
          sentenceSpans: [
            {
              id: "s1-p1-s1",
              span: {
                start: 0,
                end: newText.length,
                blockRevision: 2,
                textDigest: correctDigest, // RE-MEASURED DIGEST
              },
            },
          ],
        }),
      },
    ]);

    const passResult = await compileContent(fixed);
    const passDigestErrors = passResult.diagnostics.filter(
      (d) => d.code === "span-digest-mismatch" || d.rule === "span-digest-mismatch",
    );
    const durationMs = performance.now() - start;

    logger.log({
      testId: "span-digest-mismatch-fix-cycle",
      extra: {
        mutation: "span-digest-mismatch-and-remeasure",
        expectedRule: "span-digest-mismatch",
        actualRules: failResult.diagnostics.map((d) => d.code),
        outcome: digestErrors.length > 0 && passDigestErrors.length === 0 ? "passed" : "failed",
      },
      durationMs,
      outcome: digestErrors.length > 0 && passDigestErrors.length === 0 ? "passed" : "failed",
    });

    expect(passDigestErrors).toHaveLength(0);
  });
});
