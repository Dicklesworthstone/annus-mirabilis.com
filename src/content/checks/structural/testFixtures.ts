/**
 * Base fixture corpus and mutation utilities for structural compiler tests.
 *
 * Spec: am-cm-checks-structural-lq0
 */

import { spanTextDigest } from "../../schemas/spans.ts";

export interface ContentFile {
  path: string;
  text: string;
}

/**
 * Constructs a fully valid base corpus satisfying all 10 structural rules.
 */
export function createBaseCorpus(): ContentFile[] {
  const germanP1Text = "Dies ist der erste deutsche Satz. Dies ist der zweite deutsche Satz.";
  const p1Digest = spanTextDigest(germanP1Text);
  const s1Text = "Dies ist der erste deutsche Satz.";

  const tu1Text = "This is the first English sentence.";
  const tu2Text = "This is the second English sentence.";

  const eqMath = "E = m c^2";

  return [
    {
      path: "content/bibliography/cite-test-1905.json",
      text: JSON.stringify({
        schemaVersion: 1,
        kind: "citation",
        id: "cite-test-1905",
        title: "Test Citation 1905",
        role: "primary",
        author: [{ family: "Einstein", given: "Albert" }],
      }),
    },
    {
      path: "content/papers/test-paper.json",
      text: JSON.stringify({
        schemaVersion: 1,
        kind: "paper",
        id: "test-paper",
        slug: "test-paper",
        title: "Test Paper on Electrodynamics",
        germanTitle: "Zur Elektrodynamik bewegter Körper",
        description: "Test paper description",
        citation: "cite-test-1905",
        status: "in-preparation",
        sourceStatus: "in-preparation",
        sourceNotice: "Facsimile in preparation",
        dates: [
          {
            type: "date-line",
            earliest: "1905-05-01",
            latest: "1905-05-31",
            precision: "month",
            source: "Bern date-line",
            verifiedAt: "2026-01-01",
          },
          {
            type: "received",
            earliest: "1905-05-11",
            latest: "1905-05-11",
            precision: "day",
            source: "Annalen",
            verifiedAt: "2026-01-01",
          },
          {
            type: "issue-publication",
            earliest: "1905-07-18",
            latest: "1905-07-18",
            precision: "day",
            source: "Annalen masthead",
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
        sections: [
          {
            id: "s1",
            title: "First Section",
            arguments: ["arg-tp-01"],
          },
        ],
      }),
    },
    {
      path: "content/source-blocks/test-paper/s1.json",
      text: JSON.stringify({
        kind: "source-block",
        id: "s1",
        paper: "test-paper",
        order: 1,
        locators: [{ pdfPageIndex: 1, printedPage: 891 }],
        revision: 1,
        status: {
          transcription: "reviewed",
          mathTranscription: "not-applicable",
          translation: "reviewed",
          review: "reviewed",
        },
        inlines: [{ kind: "text", text: "1. Kinematischer Teil" }],
      }),
    },
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
        inlines: [{ kind: "text", text: germanP1Text }],
        sentenceSpans: [
          {
            id: "s1-p1-s1",
            span: {
              start: 0,
              end: s1Text.length,
              blockRevision: 1,
              textDigest: p1Digest,
            },
          },
          {
            id: "s1-p1-s2",
            span: {
              start: s1Text.length + 1,
              end: germanP1Text.length,
              blockRevision: 1,
              textDigest: p1Digest,
            },
          },
        ],
      }),
    },
    {
      path: "content/source-blocks/test-paper/s1-eq1.json",
      text: JSON.stringify({
        kind: "source-block",
        id: "s1-eq1",
        paper: "test-paper",
        order: 3,
        locators: [{ pdfPageIndex: 1, printedPage: 891 }],
        revision: 1,
        status: {
          transcription: "reviewed",
          mathTranscription: "reviewed",
          translation: "reviewed",
          review: "reviewed",
        },
        inlines: [{ kind: "math", latex: eqMath }],
        latex: eqMath,
      }),
    },
    {
      path: "content/source-blocks/test-paper/s1-fn1.json",
      text: JSON.stringify({
        kind: "source-block",
        id: "s1-fn1",
        paper: "test-paper",
        order: 4,
        locators: [{ pdfPageIndex: 1, printedPage: 891 }],
        revision: 1,
        status: {
          transcription: "reviewed",
          mathTranscription: "not-applicable",
          translation: "reviewed",
          review: "reviewed",
        },
        inlines: [{ kind: "text", text: "Erste Fußnote." }],
      }),
    },
    {
      path: "content/source-blocks/test-paper/closing-dateline.json",
      text: JSON.stringify({
        kind: "source-block",
        id: "closing-dateline",
        paper: "test-paper",
        order: 5,
        locators: [{ pdfPageIndex: 2, printedPage: 892 }],
        revision: 1,
        status: {
          transcription: "reviewed",
          mathTranscription: "not-applicable",
          translation: "reviewed",
          review: "reviewed",
        },
        inlines: [{ kind: "text", text: "Bern, Mai 1905." }],
      }),
    },
    {
      path: "content/source-blocks/test-paper/closing-received.json",
      text: JSON.stringify({
        kind: "source-block",
        id: "closing-received",
        paper: "test-paper",
        order: 6,
        locators: [{ pdfPageIndex: 2, printedPage: 892 }],
        revision: 1,
        status: {
          transcription: "reviewed",
          mathTranscription: "not-applicable",
          translation: "reviewed",
          review: "reviewed",
        },
        inlines: [{ kind: "text", text: "(Eingegangen 11. Mai 1905.)" }],
      }),
    },
    {
      path: "content/translation-units/test-paper/s1.json",
      text: JSON.stringify({
        kind: "translation-unit",
        id: "s1",
        paper: "test-paper",
        sourceRefs: [{ paper: "test-paper", id: "s1" }],
        inlines: [{ kind: "text", text: "1. Kinematical Part" }],
        translator: { name: "A. Translator", role: "translator" },
        lang: "en",
        revision: 1,
        reviewState: "reviewed",
      }),
    },
    {
      path: "content/translation-units/test-paper/s1-p1-s1.json",
      text: JSON.stringify({
        kind: "translation-unit",
        id: "s1-p1-s1",
        paper: "test-paper",
        sourceRefs: [{ paper: "test-paper", id: "s1-p1-s1" }],
        inlines: [{ kind: "text", text: tu1Text }],
        translator: { name: "A. Translator", role: "translator" },
        lang: "en",
        revision: 1,
        reviewState: "reviewed",
      }),
    },
    {
      path: "content/translation-units/test-paper/s1-p1-s2.json",
      text: JSON.stringify({
        kind: "translation-unit",
        id: "s1-p1-s2",
        paper: "test-paper",
        sourceRefs: [{ paper: "test-paper", id: "s1-p1-s2" }],
        inlines: [{ kind: "text", text: tu2Text }],
        translator: { name: "A. Translator", role: "translator" },
        lang: "en",
        revision: 1,
        reviewState: "reviewed",
      }),
    },
    {
      path: "content/translation-units/test-paper/s1-eq1.json",
      text: JSON.stringify({
        kind: "translation-unit",
        id: "s1-eq1",
        paper: "test-paper",
        sourceRefs: [{ paper: "test-paper", id: "s1-eq1" }],
        inlines: [{ kind: "math", latex: eqMath }],
        latex: eqMath,
        translator: { name: "A. Translator", role: "translator" },
        lang: "en",
        revision: 1,
        reviewState: "reviewed",
      }),
    },
    {
      path: "content/translation-units/test-paper/s1-fn1.json",
      text: JSON.stringify({
        kind: "translation-unit",
        id: "s1-fn1",
        paper: "test-paper",
        sourceRefs: [{ paper: "test-paper", id: "s1-fn1" }],
        inlines: [{ kind: "text", text: "First footnote." }],
        translator: { name: "A. Translator", role: "translator" },
        lang: "en",
        revision: 1,
        reviewState: "reviewed",
      }),
    },
    {
      path: "content/translation-units/test-paper/closing-dateline.json",
      text: JSON.stringify({
        kind: "translation-unit",
        id: "closing-dateline",
        paper: "test-paper",
        sourceRefs: [{ paper: "test-paper", id: "closing-dateline" }],
        inlines: [{ kind: "text", text: "Bern, May 1905." }],
        translator: { name: "A. Translator", role: "translator" },
        lang: "en",
        revision: 1,
        reviewState: "reviewed",
      }),
    },
    {
      path: "content/translation-units/test-paper/closing-received.json",
      text: JSON.stringify({
        kind: "translation-unit",
        id: "closing-received",
        paper: "test-paper",
        sourceRefs: [{ paper: "test-paper", id: "closing-received" }],
        inlines: [{ kind: "text", text: "(Received 11 May 1905.)" }],
        translator: { name: "A. Translator", role: "translator" },
        lang: "en",
        revision: 1,
        reviewState: "reviewed",
      }),
    },
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
            source: { paper: "test-paper", blockId: "s1-p1", sentenceId: "s1-p1-s1" },
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
    {
      path: "content/arguments/test-paper/arg-tp-01.json",
      text: JSON.stringify({
        schemaVersion: 1,
        kind: "argument",
        id: "arg-tp-01",
        paper: "test-paper",
        section: "s1",
        title: "Test Argument",
        thesis: "First premise of test paper",
        claim: "First premise claim",
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
    {
      path: "content/equations/test-paper/eq-tp-01.json",
      text: JSON.stringify({
        schemaVersion: 1,
        kind: "equation",
        id: "eq-tp-01",
        paper: "test-paper",
        argument: "arg-tp-01",
        title: "Energy Mass Relation",
        latex: eqMath,
        germanLatex: eqMath,
        englishLatex: eqMath,
        notes: [],
      }),
    },
  ];
}

/**
 * Replaces, adds, or removes a file in the fixture corpus.
 */
export function mutateCorpus(
  base: ContentFile[],
  mutations: { path: string; text?: string; delete?: boolean }[],
): ContentFile[] {
  const map = new Map<string, string>();
  for (const f of base) map.set(f.path, f.text);

  for (const mut of mutations) {
    if (mut.delete) {
      map.delete(mut.path);
    } else if (mut.text !== undefined) {
      map.set(mut.path, mut.text);
    }
  }

  return Array.from(map.entries()).map(([path, text]) => ({ path, text }));
}
