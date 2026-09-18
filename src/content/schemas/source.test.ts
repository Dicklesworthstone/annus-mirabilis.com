import assert from "node:assert/strict";
import test from "node:test";
import { compareDates, DatePrecisionError, formatDate, formatDateStrict } from "../dates.ts";
import { validateAuthorshipEntry } from "./authorship.ts";
import {
  DateValidationError,
  type PaperDate,
  validateChronology,
  validatePaperDate,
} from "./dates.ts";
import { codePointLength, codePointSlice } from "./inlines.ts";
import {
  type Citation,
  validateAlignment,
  validateCitation,
  validateEditorialNote,
  validateGlossUnit,
  validatePaper,
  validateSourceAsset,
  validateSourceBlock,
  validateTranslationEdition,
  validateTranslationUnit,
  verifyEquationTranslation,
} from "./source.ts";
import { spanTextDigest } from "./spans.ts";
import { parseStrictJson, parseStrictYaml, strictParse } from "./strictParse.ts";

// ==========================================
// 1. PAPER TESTS
// ==========================================
test("Paper: valid paper passes schema validation", () => {
  const raw = {
    slug: "brownian-motion",
    bibKey: "ap-17-549",
    titleGerman:
      "Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen",
    titleEnglishWorking:
      "On the Movement of Small Particles Suspended in Stationary Liquids Required by the Molecular-Kinetic Theory of Heat",
    editorialAdditions: [
      {
        phrase: "Small",
        reason: "Clarifies the microscopic scale of suspended particles for readers.",
        germanBasis: "no-direct-basis",
        witnessCoincidence: "citation-cowper-1926",
      },
    ],
    authorLine: "A. Einstein",
    dates: [
      {
        type: "date-line",
        text: "Bern, Mai 1905.",
        earliest: "1905-05-01",
        latest: "1905-05-31",
        precision: "month",
        source: "Printed date-line, p. 560.",
        verifiedAt: "2026-09-15",
      },
      {
        type: "received",
        earliest: "1905-05-11",
        latest: "1905-05-11",
        precision: "day",
        source: "Issue 8 masthead.",
        verifiedAt: "2026-09-15",
      },
      {
        type: "issue-publication",
        earliest: "1905-07-18",
        latest: "1905-07-18",
        precision: "day",
        source: "Journal issue publication register.",
        verifiedAt: "2026-09-15",
      },
    ],
    journal: {
      name: "Annalen der Physik",
      series: 4,
      volume: 17,
      wholeSeriesVolume: 322,
      issue: 8,
      issueSource: "Masthead",
      pages: { first: 549, last: 560 },
      doi: "10.1002/andp.19053220806",
      doiVerifiedAt: "2026-09-15",
    },
    collectedPapers: { volume: 2, document: 16 },
    orderedBlockIds: ["s1-p1", "s1-p2"],
    companion: false,
    status: "published",
    sourceStatus: "reviewed",
    sourceNotice: "",
    sections: [{ id: "s1", title: "Section 1", arguments: ["arg-1"] }],
  };

  const paper = validatePaper(raw);
  assert.equal(paper.slug, "brownian-motion");
  assert.equal(paper.editorialAdditions.length, 1);
  assert.equal(paper.dates.length, 3);
});

test("Paper: invalid slug or invalid chronology fails", () => {
  const rawInvalidSlug = {
    slug: "quantum-teleportation", // not a valid paper slug
    bibKey: "ap-17-549",
    titleGerman: "Test",
    titleEnglishWorking: "Test",
    editorialAdditions: [],
    dates: [
      {
        type: "date-line",
        earliest: "1905-05-01",
        latest: "1905-05-31",
        precision: "month",
        source: "s",
        verifiedAt: "2026-09-15",
      },
    ],
    journal: { pages: { first: 1, last: 2 } },
  };

  assert.throws(
    () => validatePaper(rawInvalidSlug),
    (err: any) => {
      assert.equal(err.code, "invalid-paper-slug");
      return true;
    },
  );

  const rawBadChronology = {
    slug: "brownian-motion",
    bibKey: "ap-17-549",
    titleGerman: "Test",
    titleEnglishWorking: "Test",
    editorialAdditions: [],
    dates: [
      {
        type: "date-line",
        earliest: "1905-06-01",
        latest: "1905-06-30",
        precision: "month",
        source: "s",
        verifiedAt: "2026-09-15",
      },
      {
        type: "received",
        earliest: "1905-05-11",
        latest: "1905-05-11",
        precision: "day",
        source: "s",
        verifiedAt: "2026-09-15",
      },
    ],
    journal: { pages: { first: 549, last: 560 } },
  };

  assert.throws(
    () => validatePaper(rawBadChronology),
    (err: any) => {
      assert.equal(err.code, "chronology-received-before-dateline");
      return true;
    },
  );
});

// ==========================================
// 2. SOURCE BLOCK TESTS
// ==========================================
test("SourceBlock: valid block with separate status fields passes", () => {
  const text = "Einleitung in die molekularkinetische Theorie.";
  const digest = spanTextDigest(text);

  const raw = {
    id: "s1-p1",
    kind: "paragraph",
    paper: "brownian-motion",
    section: "s1",
    order: 1,
    locators: [
      { pdfPageIndex: 1, printedPage: 549, region: { x: 10, y: 20, width: 300, height: 100 } },
    ],
    diplomaticText: text,
    inlines: [{ kind: "text", text }],
    sentenceSpans: [
      {
        id: "s1-p1-s1",
        span: {
          start: 0,
          end: codePointLength(text),
          blockRevision: 1,
          textDigest: digest,
        },
      },
    ],
    revision: 1,
    status: {
      transcription: "reviewed",
      mathTranscription: "not-applicable",
      translation: "reviewed",
      review: "reviewed",
    },
  };

  const block = validateSourceBlock(raw);
  assert.equal(block.id, "s1-p1");
  assert.equal(block.status.transcription, "reviewed");
  assert.equal(block.status.translation, "reviewed");
});

test("SourceBlock: missing separate status fields fails", () => {
  const rawCombinedStatus = {
    id: "s1-p1",
    kind: "paragraph",
    locators: [{ pdfPageIndex: 1, printedPage: 549 }],
    revision: 1,
    status: "reviewed", // WRONG: must be separate object fields!
  };

  assert.throws(
    () => validateSourceBlock(rawCombinedStatus),
    (err: any) => {
      assert.equal(err.code, "missing-status-block");
      return true;
    },
  );
});

test("SourceBlock: stale span revision or digest mismatch fails", () => {
  const text = "Original German text.";
  const digest = spanTextDigest(text);

  const rawStaleSpan = {
    id: "s1-p1",
    kind: "paragraph",
    locators: [{ pdfPageIndex: 1, printedPage: 549 }],
    inlines: [{ kind: "text", text }],
    sentenceSpans: [
      {
        id: "s1-p1-s1",
        span: {
          start: 0,
          end: 10,
          blockRevision: 1, // Stale when block revision is 2!
          textDigest: digest,
        },
      },
    ],
    revision: 2,
    status: {
      transcription: "draft",
      mathTranscription: "not-applicable",
      translation: "draft",
      review: "draft",
    },
  };

  assert.throws(
    () => validateSourceBlock(rawStaleSpan),
    (err: any) => {
      assert.equal(err.code, "span-revision-stale");
      return true;
    },
  );

  const rawWrongDigest = {
    id: "s1-p1",
    kind: "paragraph",
    locators: [{ pdfPageIndex: 1, printedPage: 549 }],
    inlines: [{ kind: "text", text }],
    sentenceSpans: [
      {
        id: "s1-p1-s1",
        span: {
          start: 0,
          end: 10,
          blockRevision: 1,
          textDigest: "0000000000000000000000000000000000000000000000000000000000000000",
        },
      },
    ],
    revision: 1,
    status: {
      transcription: "draft",
      mathTranscription: "not-applicable",
      translation: "draft",
      review: "draft",
    },
  };

  assert.throws(
    () => validateSourceBlock(rawWrongDigest),
    (err: any) => {
      assert.equal(err.code, "span-digest-mismatch");
      return true;
    },
  );
});

// ==========================================
// 3. TRANSLATION UNIT TESTS
// ==========================================
test("TranslationUnit: references one or more source blocks and requires editor when corrected/reviewed", () => {
  const raw = {
    id: "s3-p2-s1a",
    sourceRefs: [{ paper: "brownian-motion", id: "s3-p2-s1" }],
    inlines: [{ kind: "text", text: "Introduction to molecular kinetic theory." }],
    translator: { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
    editor: { id: "jemanuel", name: "Jeffrey Emanuel", kind: "human" },
    revision: 1,
    unresolvedAlternatives: [
      { text: "Alternative phrasing", rationale: "Preserves period modality." },
    ],
    reviewState: "reviewed",
    lang: "en",
  };

  const tu = validateTranslationUnit(raw);
  assert.equal(tu.id, "s3-p2-s1a");
  assert.equal(tu.reviewState, "reviewed");
  assert.equal(tu.editor?.id, "jemanuel");

  // Missing editor when reviewed must fail
  const rawNoEditor = {
    ...raw,
    editor: undefined,
    reviewState: "reviewed",
  };
  assert.throws(
    () => validateTranslationUnit(rawNoEditor),
    (err: any) => {
      assert.equal(err.code, "missing-editor");
      return true;
    },
  );
});

// ==========================================
// 4. ALIGNMENT & MANY-TO-MANY RELATION
// ==========================================
test("Alignment: many-to-many relation does not assume 1:1 paragraph counts", () => {
  // Planted case: 2 German source blocks align to 3 English translation units
  const raw = {
    id: "align-brownian-s3",
    paper: "brownian-motion",
    edges: [
      {
        source: { paper: "brownian-motion", blockId: "s3-p1", sentenceId: "s3-p1-s1" },
        target: { translationUnitId: "s3-p1-s1a" },
      },
      {
        source: { paper: "brownian-motion", blockId: "s3-p1", sentenceId: "s3-p1-s1" },
        target: { translationUnitId: "s3-p1-s1b" },
      },
      {
        source: { paper: "brownian-motion", blockId: "s3-p2", sentenceId: "s3-p2-s1" },
        target: { translationUnitId: "s3-p2-s1" },
      },
    ],
  };

  const align = validateAlignment(raw);
  assert.equal(align.edges.length, 3);
});

// ==========================================
// 5. GLOSS UNIT TESTS
// ==========================================
test("GlossUnit: tokens and multiword units validation", () => {
  const raw = {
    sentenceId: "s1-p1-s1",
    revision: 1,
    sourceRevision: 1,
    sourceTextDigest: "abc",
    lang: "en",
    sourceLang: "de",
    attribution: { id: "jemanuel", kind: "human" },
    tokens: [
      { german: "In", english: "in" },
      { german: "dieser", english: "this" },
      { german: "Arbeit", english: "work", noteClass: "term", grammarNote: "Technical treatise" },
    ],
    multiwordUnits: [],
  };

  const gloss = validateGlossUnit(raw);
  assert.equal(gloss.tokens.length, 3);

  // Missing noteClass when grammarNote is present fails
  const rawMissingNoteClass = {
    ...raw,
    tokens: [{ german: "Arbeit", english: "work", grammarNote: "note without noteClass" }],
  };
  assert.throws(
    () => validateGlossUnit(rawMissingNoteClass),
    (err: any) => {
      assert.equal(err.code, "missing-note-class");
      return true;
    },
  );
});

// ==========================================
// 6. EDITORIAL NOTE TESTS
// ==========================================
test("EditorialNote: dispute note requires primary sourceSupport, correction requires fields", () => {
  const rawDisputeNoPrimary = {
    id: "note-dispute-1",
    author: { id: "jemanuel", kind: "human" },
    claim: "Priority dispute regarding Brownian equations.",
    sourceSupport: [{ citationId: "cit-sec-1", role: "secondary" }],
    kind: "dispute",
    affectedIds: ["s1-p1"],
    reviewState: "draft",
  };

  assert.throws(
    () => validateEditorialNote(rawDisputeNoPrimary),
    (err: any) => {
      assert.equal(err.code, "dispute-requires-primary-source");
      return true;
    },
  );

  const rawValidDispute = {
    ...rawDisputeNoPrimary,
    sourceSupport: [{ citationId: "cit-prim-1", role: "primary" }],
  };
  const note = validateEditorialNote(rawValidDispute);
  assert.equal(note.kind, "dispute");

  // Correction note missing evidence fails
  const rawCorrectionMissingEvidence = {
    id: "note-corr-1",
    author: { id: "jemanuel", kind: "human" },
    claim: "Typo fix",
    sourceSupport: [],
    kind: "correction",
    affectedIds: ["s1-p1"],
    reviewState: "draft",
    originalReading: "Teilcheu",
    proposedReading: "Teilchen",
    reasoning: "Broken letter",
    // evidence missing!
  };
  assert.throws(
    () => validateEditorialNote(rawCorrectionMissingEvidence),
    (err: any) => {
      assert.equal(err.code, "correction-fields-required");
      return true;
    },
  );
});

// ==========================================
// 7. CITATION TESTS
// ==========================================
test("Citation: accessed date required when url is present and doi is absent", () => {
  const rawUrlNoDoiNoAccessed = {
    id: "cit-web-1",
    title: "Archive Webpage",
    author: "Archive",
    url: "https://example.org/page",
    role: "secondary",
  };

  assert.throws(
    () => validateCitation(rawUrlNoDoiNoAccessed),
    (err: any) => {
      assert.equal(err.code, "accessed-date-required");
      return true;
    },
  );

  const rawUrlWithAccessed = {
    ...rawUrlNoDoiNoAccessed,
    accessed: {
      type: "submitted",
      earliest: "2026-09-15",
      latest: "2026-09-15",
      precision: "day",
      source: "Manual retrieval",
      verifiedAt: "2026-09-15",
    },
  };
  const cit = validateCitation(rawUrlWithAccessed);
  assert.equal(cit.id, "cit-web-1");
});

test("Citation: a DOI-only citation validates without an accessed date", () => {
  const rawDoiOnly = {
    id: "cit-doi-1",
    title: "On the Electrodynamics of Moving Bodies",
    author: "A. Einstein",
    doi: "10.1002/andp.19053221004",
    role: "primary",
  };
  const cit = validateCitation(rawDoiOnly);
  assert.equal(cit.id, "cit-doi-1");
  assert.equal(cit.doi, "10.1002/andp.19053221004");
  assert.equal(cit.accessed, undefined);
});

// ==========================================
// 8. EQUATION BYTE-IDENTITY TEST
// ==========================================
test("Equation: English equation notation must be byte-identical to German", () => {
  const germanLatex = "\\lambda = \\sqrt{2 D t}";
  const englishIdentical = "\\lambda = \\sqrt{2 D t}";
  const englishModified = "\\lambda = \\sqrt{2 D \\tau}"; // tau instead of t!

  // Byte identical passes
  assert.doesNotThrow(() => verifyEquationTranslation(germanLatex, englishIdentical, "eq-1"));

  // Modified notation fails
  assert.throws(
    () => verifyEquationTranslation(germanLatex, englishModified, "eq-1"),
    (err: any) => {
      assert.equal(err.code, "equation-notation-translated");
      return true;
    },
  );
});

// ==========================================
// 9. AUTHORSHIP & AGENT REVIEWER TESTS
// ==========================================
test("Authorship: agent cannot serve as reviewer/facilitator/tester", () => {
  // Agent as author/translator is allowed
  const authorEntry = validateAuthorshipEntry(
    { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
    "author",
  );
  assert.equal(authorEntry.id, "agent:BoldHarbor");

  // Agent as reviewer must fail
  assert.throws(
    () =>
      validateAuthorshipEntry(
        { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
        "reviewer",
      ),
    (err: any) => {
      assert.equal(err.code, "agent-as-reviewer");
      return true;
    },
  );

  // Model without modelId must fail
  assert.throws(
    () => validateAuthorshipEntry({ id: "luna", kind: "model" }),
    (err: any) => {
      assert.equal(err.code, "missing-model-id");
      return true;
    },
  );

  // Id starting with model: must fail
  assert.throws(
    () => validateAuthorshipEntry({ id: "model:gpt-5", kind: "model", modelId: "gpt-5" }),
    (err: any) => {
      assert.equal(err.code, "invalid-model-prefix");
      return true;
    },
  );
});

// ==========================================
// 10. DATE FORMATTING & PRECISION TESTS
// ==========================================
test("Dates: formatting never exceeds recorded precision", () => {
  const yearDate: PaperDate = {
    type: "date-line",
    earliest: "1905-01-01",
    latest: "1905-12-31",
    precision: "year",
    source: "Historical record",
    verifiedAt: "2026-09-15",
  };

  // Asking for day on a year-precision date returns year
  assert.equal(formatDate(yearDate, "day"), "1905");
  assert.equal(formatDate(yearDate, "year"), "1905");

  // formatDateStrict throws on finer precision
  assert.throws(() => formatDateStrict(yearDate, "day"), DatePrecisionError);
  assert.equal(formatDateStrict(yearDate, "year"), "1905");

  const monthDate: PaperDate = {
    type: "date-line",
    earliest: "1905-05-01",
    latest: "1905-05-31",
    precision: "month",
    source: "Date-line",
    verifiedAt: "2026-09-15",
  };
  assert.equal(formatDate(monthDate, "month"), "May 1905");
  assert.equal(formatDate(monthDate, "year"), "1905");
});

test("Dates: chronological comparison handles overlapping intervals as indeterminate", () => {
  const may1905: PaperDate = {
    type: "date-line",
    earliest: "1905-05-01",
    latest: "1905-05-31",
    precision: "month",
    source: "s",
    verifiedAt: "2026-09-15",
  };
  const may11_1905: PaperDate = {
    type: "received",
    earliest: "1905-05-11",
    latest: "1905-05-11",
    precision: "day",
    source: "s",
    verifiedAt: "2026-09-15",
  };
  const june1905: PaperDate = {
    type: "date-line",
    earliest: "1905-06-01",
    latest: "1905-06-30",
    precision: "month",
    source: "s",
    verifiedAt: "2026-09-15",
  };

  // May 1905 (1-31) and May 11 overlap -> indeterminate
  assert.equal(compareDates(may1905, may11_1905), "indeterminate");

  // May 11 strictly precedes June 1905 -> -1
  assert.equal(compareDates(may11_1905, june1905), -1);

  // June 1905 strictly follows May 1905 -> 1
  assert.equal(compareDates(june1905, may1905), 1);
});

test("Dates: a year-precision date and a day-precision date within it compare indeterminate", () => {
  // The exact bug plain "1904-01-01" storage would have hidden: a year-precision date and a day
  // reading that falls within that year genuinely have no established order.
  const year1904: PaperDate = {
    type: "date-line",
    earliest: "1904-01-01",
    latest: "1904-12-31",
    precision: "year",
    source: "s",
    verifiedAt: "2026-09-15",
  };
  const jan3_1904: PaperDate = {
    type: "received",
    earliest: "1904-01-03",
    latest: "1904-01-03",
    precision: "day",
    source: "s",
    verifiedAt: "2026-09-15",
  };
  assert.equal(compareDates(year1904, jan3_1904), "indeterminate");
});

test("PaperDate: coarse-precision dates carrying a single instant field are rejected", () => {
  assert.throws(
    () =>
      validatePaperDate({
        type: "date-line",
        instant: "1905-03-17",
        precision: "day",
        source: "s",
        verifiedAt: "2026-09-15",
      }),
    (err: any) => {
      assert.ok(err instanceof DateValidationError);
      assert.equal(err.code, "date-precision-instant");
      return true;
    },
  );
});

test("PaperDate: interval must span exactly the period the precision names", () => {
  // day precision requires earliest === latest
  assert.throws(
    () =>
      validatePaperDate({
        type: "date-line",
        earliest: "1905-03-17",
        latest: "1905-03-18",
        precision: "day",
        source: "s",
        verifiedAt: "2026-09-15",
      }),
    (err: any) => {
      assert.equal(err.code, "date-precision-interval-mismatch");
      return true;
    },
  );

  // year precision requires Jan 1 to Dec 31 of the same year
  assert.throws(
    () =>
      validatePaperDate({
        type: "date-line",
        earliest: "1904-01-01",
        latest: "1904-06-30",
        precision: "year",
        source: "s",
        verifiedAt: "2026-09-15",
      }),
    (err: any) => {
      assert.equal(err.code, "date-precision-interval-mismatch");
      return true;
    },
  );

  // valid year-precision date passes
  const validYear = validatePaperDate({
    type: "date-line",
    earliest: "1904-01-01",
    latest: "1904-12-31",
    precision: "year",
    source: "s",
    verifiedAt: "2026-09-15",
  });
  assert.equal(validYear.precision, "year");
});

test("PaperDate: earliest after latest is rejected as an inverted interval", () => {
  assert.throws(
    () =>
      validatePaperDate({
        type: "date-line",
        earliest: "1905-05-31",
        latest: "1905-05-01",
        precision: "day",
        source: "s",
        verifiedAt: "2026-09-15",
      }),
    (err: any) => {
      assert.equal(err.code, "date-precision-inverted");
      return true;
    },
  );
});

test("Chronology: received before date-line and published before received are rejected", () => {
  const dateline: PaperDate = {
    type: "date-line",
    earliest: "1905-06-01",
    latest: "1905-06-30",
    precision: "month",
    source: "s",
    verifiedAt: "2026-09-15",
  };
  const receivedBeforeDateline: PaperDate = {
    type: "received",
    earliest: "1905-05-01",
    latest: "1905-05-31",
    precision: "month",
    source: "s",
    verifiedAt: "2026-09-15",
  };
  assert.throws(
    () => validateChronology([dateline, receivedBeforeDateline]),
    (err: any) => {
      assert.ok(err instanceof DateValidationError);
      assert.equal(err.code, "chronology-received-before-dateline");
      return true;
    },
  );

  const received: PaperDate = {
    type: "received",
    earliest: "1905-06-10",
    latest: "1905-06-10",
    precision: "day",
    source: "s",
    verifiedAt: "2026-09-15",
  };
  const publishedBeforeReceived: PaperDate = {
    type: "issue-publication",
    earliest: "1905-06-01",
    latest: "1905-06-01",
    precision: "day",
    source: "s",
    verifiedAt: "2026-09-15",
  };
  assert.throws(
    () => validateChronology([dateline, received, publishedBeforeReceived]),
    (err: any) => {
      assert.equal(err.code, "chronology-published-before-received");
      return true;
    },
  );

  // Correctly ordered dates validate without throwing.
  const publishedAfterReceived: PaperDate = {
    type: "issue-publication",
    earliest: "1905-07-01",
    latest: "1905-07-01",
    precision: "day",
    source: "s",
    verifiedAt: "2026-09-15",
  };
  assert.doesNotThrow(() => validateChronology([dateline, received, publishedAfterReceived]));
});

// ==========================================
// 11. INLINES & UNICODE CODE-POINT TESTS
// ==========================================
test("Inlines: Unicode code-point length vs UTF-16 code units", () => {
  // Emoji (surrogate pair: 2 code units, 1 code point) + combining character
  const sample = "Einstein 💡 über";
  assert.equal(sample.length, 16); // UTF-16 code units
  assert.equal(codePointLength(sample), 15); // Unicode code points

  const sliced = codePointSlice(sample, 0, 10);
  assert.equal(sliced, "Einstein 💡");
});

// ==========================================
// 12. STRICT PARSE TESTS
// ==========================================
test("StrictParse: rejects YAML merge keys (<<:)", () => {
  const yamlWithMerge = `
base: &base
  key: value
derived:
  <<: *base
  key2: value2
`;
  assert.throws(
    () => strictParse(yamlWithMerge, "yaml"),
    (err: any) => {
      assert.equal(err.code, "yaml-merge-key-forbidden");
      return true;
    },
  );
});

// ==========================================
// 13. TRANSLATION EDITION & LANGUAGE TESTS
// ==========================================
test("TranslationEdition: validates language tag, required metadata, and child units", () => {
  const rawTu = {
    id: "s1-p1-s1",
    sourceRefs: [{ paper: "brownian-motion", id: "s1-p1-s1" }],
    inlines: [{ kind: "text", text: "In this paper..." }],
    translator: { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
    revision: 1,
    unresolvedAlternatives: [],
    reviewState: "draft",
    lang: "en",
  };

  const rawEdition = {
    editionId: "edition-en-standard",
    paperId: "ap-17-549",
    language: "en",
    title: "On the Motion of Small Particles Suspended in Liquids at Rest",
    translator: { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
    license: "CC-BY-4.0",
    reviewState: "draft",
    units: [rawTu],
  };

  const edition = validateTranslationEdition(rawEdition);
  assert.equal(edition.editionId, "edition-en-standard");
  assert.equal(edition.language, "en");
  assert.equal(edition.units.length, 1);

  // Invalid language tag
  const badLangEdition = { ...rawEdition, language: "english" };
  assert.throws(
    () => validateTranslationEdition(badLangEdition),
    (err: any) => {
      assert.equal(err.code, "invalid-language-tag");
      return true;
    },
  );
});

// ==========================================
// 14. WITNESS COINCIDENCE CROSS-CHECK
// ==========================================
test("Paper: witnessCoincidence cross-check with citations", () => {
  const basePaper = {
    slug: "brownian-motion",
    bibKey: "ap-17-549",
    titleGerman: "Über die ...",
    titleEnglishWorking: "On the ...",
    editorialAdditions: [
      {
        phrase: "Small",
        reason: "Clarification",
        germanBasis: "no-direct-basis",
        witnessCoincidence: "citation-cowper-1926",
      },
    ],
    authorLine: "A. Einstein",
    dates: [
      {
        type: "received",
        earliest: "1905-05-11",
        latest: "1905-05-11",
        precision: "day",
        source: "Issue 8 masthead.",
        verifiedAt: "2026-09-15",
      },
    ],
    journal: {
      name: "Annalen der Physik",
      series: 4,
      volume: 17,
      year: 1905,
      pages: { first: 549, last: 560 },
    },
  };

  // Rejects when witness citation is not in citations list
  assert.throws(
    () => validatePaper(basePaper, "Paper", []),
    (err: any) => {
      assert.equal(err.code, "witness-citation-not-found");
      return true;
    },
  );

  const secondaryCitation: Citation = {
    id: "citation-cowper-1926",
    type: "book",
    title: "Investigation on the Theory of the Brownian Movement",
    author: "A. D. Cowper",
    role: "secondary",
  };
  const witnessCitation: Citation = {
    ...secondaryCitation,
    role: "comparison-witness",
  };

  // Rejects when witness citation has role other than comparison-witness
  assert.throws(
    () => validatePaper(basePaper, "Paper", [secondaryCitation]),
    (err: any) => {
      assert.equal(err.code, "witness-coincidence-invalid-role");
      return true;
    },
  );

  // Validates when citation is present with comparison-witness role
  const validated = validatePaper(basePaper, "Paper", [witnessCitation]);
  assert.equal(validated.editorialAdditions[0]?.witnessCoincidence, "citation-cowper-1926");
});

// ==========================================
// 15. SOURCE BLOCK LOCATORS ORDER & SPAN COUNTS
// ==========================================
test("SourceBlock: locators ordering, span counts, and containedIn", () => {
  const validParagraph = {
    id: "ap-17-549-p01",
    kind: "paragraph",
    paper: "brownian-motion",
    order: 1,
    locators: [
      { pdfPageIndex: 1, printedPage: 549 },
      { pdfPageIndex: 2, printedPage: 550 },
    ],
    diplomaticText: "Paragraph text.",
    inlines: [{ kind: "text", text: "Paragraph text." }],
    sentenceSpans: [],
    revision: 1,
    status: {
      transcription: "draft",
      mathTranscription: "not-applicable",
      translation: "draft",
      review: "draft",
    },
  };

  const block = validateSourceBlock(validParagraph);
  assert.equal(block.locators.length, 2);

  // Rejects non-1-based pdfPageIndex
  assert.throws(
    () =>
      validateSourceBlock({
        ...validParagraph,
        locators: [{ pdfPageIndex: 0, printedPage: 549 }],
      }),
    (err: any) => {
      assert.equal(err.code, "invalid-pdf-page-index");
      return true;
    },
  );

  // Rejects out-of-order locators (pdfPageIndex not strictly increasing)
  assert.throws(
    () =>
      validateSourceBlock({
        ...validParagraph,
        locators: [
          { pdfPageIndex: 2, printedPage: 550 },
          { pdfPageIndex: 1, printedPage: 549 },
        ],
      }),
    (err: any) => {
      assert.equal(err.code, "locators-not-ordered");
      return true;
    },
  );

  // Heading requires exactly one span
  const headingNoSpans = {
    ...validParagraph,
    id: "ap-17-549-h01",
    kind: "heading",
    sentenceSpans: [],
  };
  assert.throws(
    () => validateSourceBlock(headingNoSpans),
    (err: any) => {
      assert.equal(err.code, "invalid-span-count");
      return true;
    },
  );

  // Equation blocks must not carry sentence spans
  const eqWithSpans = {
    ...validParagraph,
    id: "ap-17-549-eq01",
    kind: "equation",
    containedIn: "ap-17-549-p01",
    sentenceSpans: [
      {
        id: "s1",
        span: {
          start: 0,
          end: 15,
          blockRevision: 1,
          textDigest: spanTextDigest("Paragraph text."),
        },
      },
    ],
  };
  assert.throws(
    () => validateSourceBlock(eqWithSpans),
    (err: any) => {
      assert.equal(err.code, "equation-spans-forbidden");
      return true;
    },
  );

  // ContainedIn validated on equation block
  const validEq = {
    ...validParagraph,
    id: "ap-17-549-eq01",
    kind: "equation",
    containedIn: "ap-17-549-p01",
    sentenceSpans: [],
  };
  const validatedEq = validateSourceBlock(validEq);
  assert.equal(validatedEq.containedIn, "ap-17-549-p01");
});

// ==========================================
// 16. SOURCE ASSET RIGHTS & PATH RULES
// ==========================================
test("SourceAsset: rights vocabulary constraints, path rules, and required fields", () => {
  const validAsset = {
    originUrl: "https://example.org/scans/ap-17-549.pdf",
    acquisitionDate: "2026-09-15",
    sha256: "a".repeat(64),
    mimeType: "application/pdf",
    pageCount: 12,
    pageMapping: [{ pdfPageIndex: 1, printedPage: 549, contents: ["article-text"] }],
    rights: {
      status: "public-domain-text",
      statement: "Public domain per life-plus-70.",
      reuseTerms: "no-reuse-offered",
      recordedAt: "2026-09-01",
    },
    publicationDecision: "reference-only",
    publicationReason: "Consulted only.",
    cloudProcessing: "unknown",
    cloudProcessingBasis: "Not yet examined.",
  };

  assert.equal(validateSourceAsset(validAsset).sha256, "a".repeat(64));

  // Rejects missing required rights field for status (e.g. recordedAt for public-domain-text)
  const missingRecordedAt = {
    ...validAsset,
    rights: {
      status: "public-domain-text",
      statement: "Public domain.",
      reuseTerms: "no-reuse-offered",
    },
  };
  assert.throws(
    () => validateSourceAsset(missingRecordedAt),
    (err: any) => {
      assert.equal(err.code, "missing-required-rights-field");
      return true;
    },
  );

  // Rejects public-domain-image without rights.credit
  const pdImageNoCredit = {
    ...validAsset,
    rights: {
      status: "public-domain-image",
      statement: "Public domain photo.",
      reuseTerms: "no-reuse-offered",
      source: "https://archive.org",
      recordedAt: "2026-09-01",
    },
  };
  assert.throws(
    () => validateSourceAsset(pdImageNoCredit),
    (err: any) => {
      assert.equal(err.code, "missing-required-rights-field");
      return true;
    },
  );

  // Validates public-domain-image with credit
  const pdImageWithCredit = {
    ...validAsset,
    rights: {
      status: "public-domain-image",
      statement: "Public domain photo.",
      reuseTerms: "no-reuse-offered",
      source: "https://archive.org",
      credit: "Swiss Federal Archives, photo by Lucien Chavan, 1905",
      recordedAt: "2026-09-01",
    },
  };
  assert.ok(validateSourceAsset(pdImageWithCredit));

  // Path rule: publish must lie under public/
  const badPublishPath = {
    ...validAsset,
    publicationDecision: "publish",
    path: "sources/ap-17-549.pdf",
    rights: {
      status: "scan-open-terms",
      statement: "Open scan.",
      source: "ETH-Bibliothek",
      reuseTerms: "source-terms",
    },
    cloudProcessing: "permitted",
    cloudProcessingBasis: "Permitted by license.",
  };
  assert.throws(
    () => validateSourceAsset(badPublishPath),
    (err: any) => {
      assert.equal(err.code, "invalid-publish-path");
      return true;
    },
  );

  // Path rule: reference-only must NOT have a path
  const badRefPath = {
    ...validAsset,
    path: "public/papers/ap-17-549.pdf",
  };
  assert.throws(
    () => validateSourceAsset(badRefPath),
    (err: any) => {
      assert.equal(err.code, "unexpected-path");
      return true;
    },
  );
});

// ==========================================
// 17. GLOSS UNIT STRICT VALIDATIONS
// ==========================================
test("GlossUnit: enforces required lang, sourceLang, digests, note classes, and reviewState", () => {
  const validGloss = {
    sentenceId: "s1-p1-s1",
    revision: 1,
    sourceRevision: 1,
    sourceTextDigest: "abc",
    lang: "en",
    sourceLang: "de",
    attribution: { id: "jemanuel", kind: "human" },
    reviewState: "machine-draft",
    tokens: [
      { german: "In", english: "in" },
      { german: "dieser", english: "this" },
    ],
    multiwordUnits: [],
  };

  const gloss = validateGlossUnit(validGloss);
  assert.equal(gloss.reviewState, "machine-draft");

  // Missing lang
  const { lang, ...noLang } = validGloss;
  assert.throws(
    () => validateGlossUnit(noLang),
    (err: any) => {
      assert.equal(err.code, "missing-lang");
      return true;
    },
  );

  // Missing sourceLang
  const { sourceLang, ...noSourceLang } = validGloss;
  assert.throws(
    () => validateGlossUnit(noSourceLang),
    (err: any) => {
      assert.equal(err.code, "missing-source-lang");
      return true;
    },
  );

  // Missing sourceRevision
  const { sourceRevision, ...noSourceRev } = validGloss;
  assert.throws(
    () => validateGlossUnit(noSourceRev),
    (err: any) => {
      assert.equal(err.code, "missing-source-revision");
      return true;
    },
  );

  // Missing sourceTextDigest
  const { sourceTextDigest, ...noSourceDigest } = validGloss;
  assert.throws(
    () => validateGlossUnit(noSourceDigest),
    (err: any) => {
      assert.equal(err.code, "missing-source-text-digest");
      return true;
    },
  );

  // Unlisted noteClass
  const unlistedNoteClass = {
    ...validGloss,
    tokens: [
      { german: "In", english: "in", grammarNote: "preposition", noteClass: "not-a-real-class" },
    ],
  };
  assert.throws(
    () => validateGlossUnit(unlistedNoteClass),
    (err: any) => {
      assert.equal(err.code, "unlisted-note-class");
      return true;
    },
  );

  // Contextual without reason
  const contextualNoReason = {
    ...validGloss,
    tokens: [{ german: "In", english: "in", contextual: true }],
  };
  assert.throws(
    () => validateGlossUnit(contextualNoReason),
    (err: any) => {
      assert.equal(err.code, "missing-contextual-reason");
      return true;
    },
  );

  // Multiword unit invalid kind
  const badMwKind = {
    ...validGloss,
    multiwordUnits: [{ tokenIndices: [0, 1], english: "in this", kind: "invalid-kind" }],
  };
  assert.throws(
    () => validateGlossUnit(badMwKind),
    (err: any) => {
      assert.equal(err.code, "invalid-multiword-kind");
      return true;
    },
  );

  // Multiword unit invalid tokenIndices (out of bounds)
  const badMwIndices = {
    ...validGloss,
    multiwordUnits: [{ tokenIndices: [0, 99], english: "in this", kind: "fixed-phrase" }],
  };
  assert.throws(
    () => validateGlossUnit(badMwIndices),
    (err: any) => {
      assert.equal(err.code, "invalid-multiword-indices");
      return true;
    },
  );
});

// ==========================================
// 18. STRICT PARSER (JSON & YAML) RESTRICTIONS
// ==========================================
test("strictParse: rejects duplicate keys, custom tags, anchors/aliases, and non-NFC text", () => {
  // YAML duplicate keys
  const yamlDup = `
key1: value1
key1: value2
`;
  assert.throws(
    () => parseStrictYaml(yamlDup),
    (err: any) => {
      assert.equal(err.code, "yaml-duplicate-key");
      return true;
    },
  );

  // JSON duplicate keys
  const jsonDup = `{"key": 1, "key": 2}`;
  assert.throws(
    () => parseStrictJson(jsonDup),
    (err: any) => {
      assert.equal(err.code, "json-duplicate-key");
      return true;
    },
  );

  // Custom YAML tag
  const yamlCustomTag = `
val: !customTag 42
`;
  assert.throws(
    () => parseStrictYaml(yamlCustomTag),
    (err: any) => {
      assert.equal(err.code, "yaml-custom-tag-forbidden");
      return true;
    },
  );

  // YAML anchor / alias
  const yamlAnchor = `
base: &anchor { a: 1 }
ref: *anchor
`;
  assert.throws(
    () => parseStrictYaml(yamlAnchor),
    (err: any) => {
      assert.equal(err.code, "yaml-anchor-alias-forbidden");
      return true;
    },
  );

  // Non-NFC text (e.g. decomposed e + combining acute accent)
  const decomposed = "e\u0301cole";
  const jsonNonNfc = `{"title": "${decomposed}"}`;
  assert.throws(
    () => parseStrictJson(jsonNonNfc),
    (err: any) => {
      assert.equal(err.code, "non-nfc-text");
      return true;
    },
  );
});
