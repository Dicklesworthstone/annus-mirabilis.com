import assert from "node:assert/strict";
import test from "node:test";
import { codePointLength } from "./inlines.ts";
import {
  SchemaValidationError,
  validateAlignment,
  validateCitation,
  validateEditorialNote,
  validateGlossUnit,
  validatePaper,
  validateSourceAsset,
  validateSourceBlock,
  validateTranslationEdition,
  validateTranslationUnit,
} from "./source.ts";
import { spanTextDigest } from "./spans.ts";

/**
 * Untested Refusal Throw Site Suite for src/content/schemas/source.ts (am-muyh, am-r3qt).
 *
 * THE LINE NUMBERS ARE NOT ENUMERATED HERE ANY MORE, ON PURPOSE. This header used to list
 * every site per function. Every one of those numbers had drifted - by +23, +13, -15 or
 * -23 depending on where in the file it sat - and so had all thirty citations in the test
 * names, because code was inserted and removed above them over months and a citation that
 * matches no site is silently ignored. A second enumeration would drift the same way and
 * would be wrong again by the time anyone read it.
 *
 * The citations live in the test names, where the refusal scanner reads them, and they are
 * maintained by planting rather than by counting: rename exactly one site's code, run this
 * file, and the single test that goes red is the one that must carry that line.
 *
 * Each test cites its explicit throw site (source.ts:<line>) and provides both an accept
 * path and a reject path exercising the exact refusal boundary condition.
 */

function assertSchemaRefusal(fn: () => unknown, expectedCode: string): void {
  assert.throws(fn, (err: unknown) => {
    assert.ok(
      err instanceof SchemaValidationError,
      `Expected SchemaValidationError, got ${String(err)}`,
    );
    assert.equal((err as SchemaValidationError).code, expectedCode);
    return true;
  });
}

// ============================================================================
// SHARED VALID FIXTURES
// ============================================================================

const VALID_ADDITION = {
  phrase: "Small",
  reason: "Clarifies the microscopic scale of suspended particles for readers.",
  germanBasis: "no-direct-basis",
};

const VALID_DATES = [
  {
    type: "date-line" as const,
    text: "Bern, Mai 1905.",
    earliest: "1905-05-01",
    latest: "1905-05-31",
    precision: "month" as const,
    source: "Printed date-line, p. 560.",
    verifiedAt: "2026-09-15",
  },
  {
    type: "received" as const,
    earliest: "1905-05-11",
    latest: "1905-05-11",
    precision: "day" as const,
    source: "Issue 8 masthead.",
    verifiedAt: "2026-09-15",
  },
  {
    type: "issue-publication" as const,
    earliest: "1905-07-18",
    latest: "1905-07-18",
    precision: "day" as const,
    source: "Journal issue publication register.",
    verifiedAt: "2026-09-15",
  },
];

const VALID_JOURNAL = {
  name: "Annalen der Physik",
  series: 4,
  volume: 17,
  wholeSeriesVolume: 322,
  issue: 8,
  issueSource: "Masthead",
  pages: { first: 549, last: 560 },
  doi: "10.1002/andp.19053220806",
  doiVerifiedAt: "2026-09-15",
};

const VALID_PAPER = {
  slug: "brownian-motion",
  bibKey: "ap-17-549",
  titleGerman:
    "Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen",
  titleEnglishWorking:
    "On the Movement of Small Particles Suspended in Stationary Liquids Required by the Molecular-Kinetic Theory of Heat",
  editorialAdditions: [VALID_ADDITION],
  authorLine: "A. Einstein",
  dates: VALID_DATES,
  journal: VALID_JOURNAL,
  collectedPapers: { volume: 2, document: 16 },
  orderedBlockIds: ["s1-p1", "s1-p2"],
  companion: false,
  status: "published",
  sourceStatus: "reviewed",
  sourceNotice: "",
  sections: [{ id: "s1", title: "Section 1", arguments: ["arg-1"] }],
};

const VALID_ASSET = {
  originUrl: "https://archive.org/details/annalen-der-physik-1905",
  acquisitionDate: "2026-09-01",
  sha256: "a".repeat(64),
  mimeType: "application/pdf",
  pageCount: 12,
  pageMapping: [{ pdfPage: 1, printedPage: 549 }],
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

const BLOCK_TEXT = "In dieser Arbeit soll gezeigt werden...";
const BLOCK_DIGEST = spanTextDigest(BLOCK_TEXT);

const VALID_BLOCK = {
  id: "s1-p1",
  kind: "paragraph",
  paper: "brownian-motion",
  section: "s1",
  order: 1,
  locators: [
    { pdfPageIndex: 1, printedPage: 549, region: { x: 10, y: 20, width: 300, height: 100 } },
  ],
  diplomaticText: BLOCK_TEXT,
  inlines: [{ kind: "text", text: BLOCK_TEXT }],
  sentenceSpans: [
    {
      id: "s1-p1-s1",
      span: {
        start: 0,
        end: codePointLength(BLOCK_TEXT),
        blockRevision: 1,
        textDigest: BLOCK_DIGEST,
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

const VALID_TU = {
  id: "s3-p2-s1a",
  sourceRefs: [{ paper: "brownian-motion", id: "s3-p2-s1" }],
  inlines: [{ kind: "text", text: "Introduction to molecular kinetic theory." }],
  translator: {
    id: "agent:BoldHarbor",
    name: "Bold Harbor",
    kind: "model",
    modelId: "gpt-5.6-luna",
  },
  editor: { id: "jemanuel", name: "Jeffrey Emanuel", kind: "human" },
  revision: 1,
  unresolvedAlternatives: [
    { text: "Alternative phrasing", rationale: "Preserves period modality." },
  ],
  reviewState: "reviewed",
  lang: "en",
};

const VALID_ALIGNMENT = {
  id: "align-brownian-s3",
  paper: "brownian-motion",
  edges: [
    {
      source: { paper: "brownian-motion", blockId: "s3-p1", sentenceId: "s3-p1-s1" },
      target: { translationUnitId: "s3-p1-s1a" },
    },
  ],
};

const VALID_GLOSS = {
  sentenceId: "s1-p1-s1",
  revision: 1,
  sourceRevision: 1,
  sourceTextDigest: "abc",
  lang: "en",
  sourceLang: "de",
  attribution: { id: "jemanuel", name: "Jeffrey Emanuel", kind: "human" },
  tokens: [
    { german: "In", english: "in" },
    { german: "dieser", english: "this" },
    { german: "Arbeit", english: "work", noteClass: "term", grammarNote: "Technical treatise" },
  ],
  multiwordUnits: [
    {
      tokenIndices: [0, 1],
      english: "in this",
      kind: "fixed-phrase",
    },
  ],
};

const VALID_NOTE = {
  id: "note-dispute-1",
  author: { id: "jemanuel", name: "Jeffrey Emanuel", kind: "human" },
  claim: "Priority dispute regarding Brownian equations.",
  sourceSupport: [{ citationId: "cit-prim-1", role: "primary" }],
  kind: "dispute",
  affectedIds: ["s1-p1"],
  reviewState: "draft",
};

const VALID_CORRECTION_NOTE = {
  id: "note-corr-1",
  author: { id: "jemanuel", name: "Jeffrey Emanuel", kind: "human" },
  claim: "Typographical correction in German text.",
  sourceSupport: [],
  kind: "correction",
  originalReading: "Teilcheu",
  proposedReading: "Teilchen",
  reasoning: "Broken letter n rendered as u.",
  evidence: "Facsimile page 550, line 12 shows broken serif.",
  layer: "source",
  reviewState: "reviewed",
};

const VALID_CITATION = {
  id: "cit-doi-1",
  title: "On the Electrodynamics of Moving Bodies",
  author: "A. Einstein",
  doi: "10.1002/andp.19053221004",
  role: "primary",
};

const VALID_EDITION = {
  editionId: "edition-en-standard",
  paperId: "ap-17-549",
  language: "en",
  title: "On the Motion of Small Particles Suspended in Liquids at Rest",
  translator: {
    id: "agent:BoldHarbor",
    name: "Bold Harbor",
    kind: "model",
    modelId: "gpt-5.6-luna",
  },
  license: "CC-BY-4.0",
  reviewState: "draft",
  units: [VALID_TU],
};

// ============================================================================
// 1. VALIDATE PAPER REFUSALS (12 SITES)
// ============================================================================

test("validatePaper: (source.ts:151) invalid-record rejects non-object raw record, accepts valid paper", () => {
  assertSchemaRefusal(() => validatePaper(null), "invalid-record");
  assertSchemaRefusal(() => validatePaper("not-an-object"), "invalid-record");
  const accepted = validatePaper(VALID_PAPER);
  assert.equal(accepted.slug, "brownian-motion");
});

test("validatePaper: (source.ts:140) invalid-bib-key rejects malformed bibKey, accepts valid ap-vol-page", () => {
  assertSchemaRefusal(
    () => validatePaper({ ...VALID_PAPER, bibKey: "invalid_key" }),
    "invalid-bib-key",
  );
  const accepted = validatePaper({ ...VALID_PAPER, bibKey: "ap-17-549" });
  assert.equal(accepted.bibKey, "ap-17-549");
});

test("validatePaper: (source.ts:148) missing-title-german rejects empty or missing titleGerman, accepts non-empty string", () => {
  assertSchemaRefusal(
    () => validatePaper({ ...VALID_PAPER, titleGerman: "   " }),
    "missing-title-german",
  );
  assertSchemaRefusal(
    () => validatePaper({ ...VALID_PAPER, titleGerman: 123 }),
    "missing-title-german",
  );
  const accepted = validatePaper({ ...VALID_PAPER, titleGerman: "Gültiger deutscher Titel" });
  assert.equal(accepted.titleGerman, "Gültiger deutscher Titel");
});

test("validatePaper: (source.ts:156) missing-title-english rejects empty or missing titleEnglishWorking, accepts valid title", () => {
  assertSchemaRefusal(
    () => validatePaper({ ...VALID_PAPER, titleEnglishWorking: "" }),
    "missing-title-english",
  );
  const accepted = validatePaper({
    ...VALID_PAPER,
    titleEnglishWorking: "Valid English Working Title",
  });
  assert.equal(accepted.titleEnglishWorking, "Valid English Working Title");
});

test("validatePaper: (source.ts:166) missing-editorial-additions rejects non-array editorialAdditions, accepts array", () => {
  assertSchemaRefusal(
    () => validatePaper({ ...VALID_PAPER, editorialAdditions: null }),
    "missing-editorial-additions",
  );
  const accepted = validatePaper({ ...VALID_PAPER, editorialAdditions: [] });
  assert.deepEqual(accepted.editorialAdditions, []);
});

test("validatePaper: (source.ts:175) invalid-addition rejects non-object addition entry, accepts valid addition", () => {
  assertSchemaRefusal(
    () => validatePaper({ ...VALID_PAPER, editorialAdditions: [null] }),
    "invalid-addition",
  );
  assertSchemaRefusal(
    () => validatePaper({ ...VALID_PAPER, editorialAdditions: ["not-an-object"] }),
    "invalid-addition",
  );
  const accepted = validatePaper({ ...VALID_PAPER, editorialAdditions: [VALID_ADDITION] });
  assert.equal(accepted.editorialAdditions.length, 1);
});

test("validatePaper: (source.ts:183) missing-phrase rejects addition with non-string phrase, accepts string phrase", () => {
  assertSchemaRefusal(
    () =>
      validatePaper({
        ...VALID_PAPER,
        editorialAdditions: [{ ...VALID_ADDITION, phrase: 123 }],
      }),
    "missing-phrase",
  );
  const accepted = validatePaper({
    ...VALID_PAPER,
    editorialAdditions: [{ ...VALID_ADDITION, phrase: "Microscopic" }],
  });
  assert.equal(accepted.editorialAdditions[0]?.phrase, "Microscopic");
});

test("validatePaper: (source.ts:190) missing-reason rejects addition with non-string reason, accepts string reason", () => {
  assertSchemaRefusal(
    () =>
      validatePaper({
        ...VALID_PAPER,
        editorialAdditions: [{ ...VALID_ADDITION, reason: undefined }],
      }),
    "missing-reason",
  );
  const accepted = validatePaper({
    ...VALID_PAPER,
    editorialAdditions: [{ ...VALID_ADDITION, reason: "Clarifies scope." }],
  });
  assert.equal(accepted.editorialAdditions[0]?.reason, "Clarifies scope.");
});

test("validatePaper: (source.ts:197) missing-basis rejects addition with non-string germanBasis, accepts string germanBasis", () => {
  assertSchemaRefusal(
    () =>
      validatePaper({
        ...VALID_PAPER,
        editorialAdditions: [{ ...VALID_ADDITION, germanBasis: null }],
      }),
    "missing-basis",
  );
  const accepted = validatePaper({
    ...VALID_PAPER,
    editorialAdditions: [{ ...VALID_ADDITION, germanBasis: "no-direct-basis" }],
  });
  assert.equal(accepted.editorialAdditions[0]?.germanBasis, "no-direct-basis");
});

test("validatePaper: (source.ts:238) missing-dates rejects empty or non-array dates, accepts non-empty dates", () => {
  assertSchemaRefusal(() => validatePaper({ ...VALID_PAPER, dates: [] }), "missing-dates");
  assertSchemaRefusal(() => validatePaper({ ...VALID_PAPER, dates: null }), "missing-dates");
  const accepted = validatePaper({ ...VALID_PAPER, dates: VALID_DATES });
  assert.equal(accepted.dates.length, 3);
});

test("validatePaper: (source.ts:253) missing-journal rejects null or non-object journal, accepts valid journal", () => {
  assertSchemaRefusal(() => validatePaper({ ...VALID_PAPER, journal: null }), "missing-journal");
  assertSchemaRefusal(
    () => validatePaper({ ...VALID_PAPER, journal: "Annalen" }),
    "missing-journal",
  );
  const accepted = validatePaper({ ...VALID_PAPER, journal: VALID_JOURNAL });
  assert.equal(accepted.journal.name, "Annalen der Physik");
});

test("validatePaper: (source.ts:266) invalid-journal-pages rejects invalid pages {first, last}, accepts ordered range", () => {
  assertSchemaRefusal(
    () =>
      validatePaper({
        ...VALID_PAPER,
        journal: { ...VALID_JOURNAL, pages: { first: 560, last: 549 } },
      }),
    "invalid-journal-pages",
  );
  assertSchemaRefusal(
    () => validatePaper({ ...VALID_PAPER, journal: { ...VALID_JOURNAL, pages: null } }),
    "invalid-journal-pages",
  );
  const accepted = validatePaper({
    ...VALID_PAPER,
    journal: { ...VALID_JOURNAL, pages: { first: 549, last: 560 } },
  });
  assert.equal(accepted.journal.pages.first, 549);
});

// ============================================================================
// 2. VALIDATE SOURCE ASSET REFUSALS (20 SITES)
// ============================================================================

test("validateSourceAsset: (source.ts:337) invalid-record rejects non-object raw asset, accepts valid asset", () => {
  assertSchemaRefusal(() => validateSourceAsset(null), "invalid-record");
  assertSchemaRefusal(() => validateSourceAsset("bad-asset"), "invalid-record");
  const accepted = validateSourceAsset(VALID_ASSET);
  assert.equal(accepted.mimeType, "application/pdf");
});

test("validateSourceAsset: (source.ts:331) invalid-acquisition-date rejects non-YYYY-MM-DD date, accepts ISO date", () => {
  assertSchemaRefusal(
    () => validateSourceAsset({ ...VALID_ASSET, acquisitionDate: "09-01-2026" }),
    "invalid-acquisition-date",
  );
  assertSchemaRefusal(
    () => validateSourceAsset({ ...VALID_ASSET, acquisitionDate: 20260901 }),
    "invalid-acquisition-date",
  );
  const accepted = validateSourceAsset({ ...VALID_ASSET, acquisitionDate: "2026-09-01" });
  assert.equal(accepted.acquisitionDate, "2026-09-01");
});

test("validateSourceAsset: (source.ts:339) invalid-sha256 rejects malformed hash, accepts 64-char hex", () => {
  assertSchemaRefusal(
    () => validateSourceAsset({ ...VALID_ASSET, sha256: "not-a-hash" }),
    "invalid-sha256",
  );
  assertSchemaRefusal(
    () => validateSourceAsset({ ...VALID_ASSET, sha256: "A".repeat(64) }),
    "invalid-sha256",
  );
  const accepted = validateSourceAsset({ ...VALID_ASSET, sha256: "c".repeat(64) });
  assert.equal(accepted.sha256, "c".repeat(64));
});

test("validateSourceAsset: (source.ts:347) invalid-mime-type rejects mime without slash, accepts valid mime", () => {
  assertSchemaRefusal(
    () => validateSourceAsset({ ...VALID_ASSET, mimeType: "pdf" }),
    "invalid-mime-type",
  );
  const accepted = validateSourceAsset({ ...VALID_ASSET, mimeType: "application/pdf" });
  assert.equal(accepted.mimeType, "application/pdf");
});

test("validateSourceAsset: (source.ts:355) invalid-page-count rejects non-positive or non-integer pageCount, accepts integer", () => {
  assertSchemaRefusal(
    () => validateSourceAsset({ ...VALID_ASSET, pageCount: 0 }),
    "invalid-page-count",
  );
  assertSchemaRefusal(
    () => validateSourceAsset({ ...VALID_ASSET, pageCount: 3.14 }),
    "invalid-page-count",
  );
  const accepted = validateSourceAsset({ ...VALID_ASSET, pageCount: 12 });
  assert.equal(accepted.pageCount, 12);
});

test("validateSourceAsset: (source.ts:363) missing-page-mapping rejects empty or non-array pageMapping, accepts non-empty array", () => {
  assertSchemaRefusal(
    () => validateSourceAsset({ ...VALID_ASSET, pageMapping: [] }),
    "missing-page-mapping",
  );
  assertSchemaRefusal(
    () => validateSourceAsset({ ...VALID_ASSET, pageMapping: null }),
    "missing-page-mapping",
  );
  const accepted = validateSourceAsset({
    ...VALID_ASSET,
    pageMapping: [{ pdfPage: 1, printedPage: 549 }],
  });
  assert.equal(accepted.pageMapping.length, 1);
});

test("validateSourceAsset: (source.ts:374) missing-rights rejects null or non-object rights, accepts valid rights", () => {
  assertSchemaRefusal(
    () => validateSourceAsset({ ...VALID_ASSET, rights: null }),
    "missing-rights",
  );
  assertSchemaRefusal(
    () => validateSourceAsset({ ...VALID_ASSET, rights: "public-domain" }),
    "missing-rights",
  );
  const accepted = validateSourceAsset({ ...VALID_ASSET, rights: VALID_ASSET.rights });
  assert.equal(accepted.rights.status, "public-domain-text");
});

test("validateSourceAsset: (source.ts:382) invalid-rights-status rejects unknown rights status, accepts recognized status", () => {
  assertSchemaRefusal(
    () =>
      validateSourceAsset({
        ...VALID_ASSET,
        rights: { ...VALID_ASSET.rights, status: "unknown-rights-status" },
      }),
    "invalid-rights-status",
  );
  const accepted = validateSourceAsset({
    ...VALID_ASSET,
    rights: { ...VALID_ASSET.rights, status: "public-domain-text" },
  });
  assert.equal(accepted.rights.status, "public-domain-text");
});

test("validateSourceAsset: (source.ts:390) invalid-reuse-terms rejects unknown reuse terms, accepts recognized terms", () => {
  assertSchemaRefusal(
    () =>
      validateSourceAsset({
        ...VALID_ASSET,
        rights: { ...VALID_ASSET.rights, reuseTerms: "unrestricted-commercial" },
      }),
    "invalid-reuse-terms",
  );
  const accepted = validateSourceAsset({
    ...VALID_ASSET,
    rights: { ...VALID_ASSET.rights, reuseTerms: "no-reuse-offered" },
  });
  assert.equal(accepted.rights.reuseTerms, "no-reuse-offered");
});

test("validateSourceAsset: (source.ts:398) missing-rights-statement rejects non-string rights.statement, accepts string statement", () => {
  assertSchemaRefusal(
    () =>
      validateSourceAsset({
        ...VALID_ASSET,
        rights: { ...VALID_ASSET.rights, statement: null },
      }),
    "missing-rights-statement",
  );
  const accepted = validateSourceAsset({
    ...VALID_ASSET,
    rights: { ...VALID_ASSET.rights, statement: "Public domain in the United States." },
  });
  assert.equal(accepted.rights.statement, "Public domain in the United States.");
});

test("validateSourceAsset: (source.ts:408) invalid-publication-decision rejects invalid decision value, accepts valid decision", () => {
  assertSchemaRefusal(
    () => validateSourceAsset({ ...VALID_ASSET, publicationDecision: "commercial-publish" }),
    "invalid-publication-decision",
  );
  const accepted = validateSourceAsset({
    ...VALID_ASSET,
    publicationDecision: "reference-only",
  });
  assert.equal(accepted.publicationDecision, "reference-only");
});

test("validateSourceAsset: (source.ts:416) invalid-cloud-processing rejects invalid cloudProcessing value, accepts valid enum", () => {
  assertSchemaRefusal(
    () => validateSourceAsset({ ...VALID_ASSET, cloudProcessing: "unrestricted" }),
    "invalid-cloud-processing",
  );
  const accepted = validateSourceAsset({ ...VALID_ASSET, cloudProcessing: "unknown" });
  assert.equal(accepted.cloudProcessing, "unknown");
});

test("validateSourceAsset: (source.ts:424) missing-cloud-processing-basis rejects empty cloudProcessingBasis, accepts non-empty string", () => {
  assertSchemaRefusal(
    () => validateSourceAsset({ ...VALID_ASSET, cloudProcessingBasis: "   " }),
    "missing-cloud-processing-basis",
  );
  const accepted = validateSourceAsset({
    ...VALID_ASSET,
    cloudProcessingBasis: "Evaluation pending review of institutional terms.",
  });
  assert.equal(accepted.cloudProcessingBasis, "Evaluation pending review of institutional terms.");
});

test("validateSourceAsset: (source.ts:435) invalid-path rejects non-string path when path is defined, accepts undefined or string", () => {
  assertSchemaRefusal(() => validateSourceAsset({ ...VALID_ASSET, path: 12345 }), "invalid-path");
  const accepted = validateSourceAsset({ ...VALID_ASSET, path: undefined });
  assert.equal(accepted.path, undefined);
});

test("validateSourceAsset: (source.ts:455) invalid-pin-local-path rejects pin-local-only path outside sources/, accepts sources/ path", () => {
  assertSchemaRefusal(
    () =>
      validateSourceAsset({
        ...VALID_ASSET,
        publicationDecision: "pin-local-only",
        path: "public/papers/ap-17-549.pdf",
      }),
    "invalid-pin-local-path",
  );
  const accepted = validateSourceAsset({
    ...VALID_ASSET,
    publicationDecision: "pin-local-only",
    path: "sources/pinned/ap-17-549.pdf",
  });
  assert.equal(accepted.path, "sources/pinned/ap-17-549.pdf");
});

test("validateSourceAsset: (source.ts:516) missing-required-rights-field rejects public-domain-image missing rights.source, accepts with source", () => {
  assertSchemaRefusal(
    () =>
      validateSourceAsset({
        ...VALID_ASSET,
        rights: {
          status: "public-domain-image",
          statement: "Public domain image.",
          reuseTerms: "no-reuse-offered",
          credit: "Lucien Chavan, 1905",
          recordedAt: "2026-09-01",
        },
      }),
    "missing-required-rights-field",
  );
  const accepted = validateSourceAsset({
    ...VALID_ASSET,
    rights: {
      status: "public-domain-image",
      statement: "Public domain image.",
      reuseTerms: "no-reuse-offered",
      source: "https://archive.org",
      credit: "Lucien Chavan, 1905",
      recordedAt: "2026-09-01",
    },
  });
  assert.equal(accepted.rights.source, "https://archive.org");
});

test("validateSourceAsset: (source.ts:527) missing-required-rights-field rejects public-domain-image missing rights.credit, accepts with credit", () => {
  assertSchemaRefusal(
    () =>
      validateSourceAsset({
        ...VALID_ASSET,
        rights: {
          status: "public-domain-image",
          statement: "Public domain photo.",
          reuseTerms: "no-reuse-offered",
          source: "https://archive.org",
          recordedAt: "2026-09-01",
        },
      }),
    "missing-required-rights-field",
  );
  const accepted = validateSourceAsset({
    ...VALID_ASSET,
    rights: {
      status: "public-domain-image",
      statement: "Public domain photo.",
      reuseTerms: "no-reuse-offered",
      source: "https://archive.org",
      credit: "Lucien Chavan, 1905",
      recordedAt: "2026-09-01",
    },
  });
  assert.equal(accepted.rights.credit, "Lucien Chavan, 1905");
});

test("validateSourceAsset: (source.ts:538) missing-required-rights-field rejects public-domain-text missing rights.recordedAt, accepts with date", () => {
  assertSchemaRefusal(
    () =>
      validateSourceAsset({
        ...VALID_ASSET,
        rights: {
          status: "public-domain-text",
          statement: "Public domain per life-plus-70.",
          reuseTerms: "no-reuse-offered",
        },
      }),
    "missing-required-rights-field",
  );
  const accepted = validateSourceAsset({
    ...VALID_ASSET,
    rights: {
      status: "public-domain-text",
      statement: "Public domain per life-plus-70.",
      reuseTerms: "no-reuse-offered",
      recordedAt: "2026-09-01",
    },
  });
  assert.equal(accepted.rights.recordedAt, "2026-09-01");
});

test("validateSourceAsset: (source.ts:537) missing-publication-reason rejects non-publish decision without publicationReason, accepts with reason", () => {
  assertSchemaRefusal(
    () =>
      validateSourceAsset({
        ...VALID_ASSET,
        publicationDecision: "reference-only",
        publicationReason: "   ",
      }),
    "missing-publication-reason",
  );
  const accepted = validateSourceAsset({
    ...VALID_ASSET,
    publicationDecision: "reference-only",
    publicationReason: "Historical reference only.",
  });
  assert.equal(accepted.publicationReason, "Historical reference only.");
});

test("validateSourceAsset: (source.ts:576) missing-required-rights-field rejects named-license missing rights.source, accepts with source", () => {
  assertSchemaRefusal(
    () =>
      validateSourceAsset({
        originUrl: "https://example.org",
        acquisitionDate: "2026-09-01",
        sha256: "a".repeat(64),
        mimeType: "text/plain",
        pageCount: 1,
        pageMapping: [{ pdfPage: 1, printedPage: 1 }],
        rights: {
          status: "site-original-code",
          statement: "MIT License with rider.",
          reuseTerms: "named-license",
        },
        publicationDecision: "publish",
        path: "public/code.txt",
        cloudProcessing: "permitted",
        cloudProcessingBasis: "Permitted by license.",
      }),
    "missing-required-rights-field",
  );
  const accepted = validateSourceAsset({
    originUrl: "https://example.org",
    acquisitionDate: "2026-09-01",
    sha256: "a".repeat(64),
    mimeType: "text/plain",
    pageCount: 1,
    pageMapping: [{ pdfPage: 1, printedPage: 1 }],
    rights: {
      status: "site-original-code",
      statement: "MIT License with rider.",
      source: "https://github.com/example/repo",
      reuseTerms: "named-license",
    },
    publicationDecision: "publish",
    path: "public/code.txt",
    cloudProcessing: "permitted",
    cloudProcessingBasis: "Permitted by license.",
  });
  assert.equal(accepted.rights.source, "https://github.com/example/repo");
});

test("validateSourceAsset: (source.ts:587) missing-required-rights-field rejects scan-terms-unknown with whitespace statement for reuseTerms, accepts non-empty", () => {
  assertSchemaRefusal(
    () =>
      validateSourceAsset({
        originUrl: "https://example.org",
        acquisitionDate: "2026-09-01",
        sha256: "a".repeat(64),
        mimeType: "application/pdf",
        pageCount: 1,
        pageMapping: [{ pdfPage: 1, printedPage: 1 }],
        rights: {
          status: "scan-terms-unknown",
          source: "https://example.org",
          recordedAt: "2026-09-01",
          reuseTerms: "no-reuse-offered",
          statement: "   ",
        },
        publicationDecision: "reference-only",
        publicationReason: "Terms pending retrieval.",
        cloudProcessing: "unknown",
        cloudProcessingBasis: "Unknown terms.",
      }),
    "missing-required-rights-field",
  );
  const accepted = validateSourceAsset({
    originUrl: "https://example.org",
    acquisitionDate: "2026-09-01",
    sha256: "a".repeat(64),
    mimeType: "application/pdf",
    pageCount: 1,
    pageMapping: [{ pdfPage: 1, printedPage: 1 }],
    rights: {
      status: "scan-terms-unknown",
      source: "https://example.org",
      recordedAt: "2026-09-01",
      reuseTerms: "no-reuse-offered",
      statement: "No terms located yet.",
    },
    publicationDecision: "reference-only",
    publicationReason: "Terms pending retrieval.",
    cloudProcessing: "unknown",
    cloudProcessingBasis: "Unknown terms.",
  });
  assert.equal(accepted.rights.statement, "No terms located yet.");
});

// ============================================================================
// 3. VALIDATE SOURCE BLOCK REFUSALS (12 SITES)
// ============================================================================

test("validateSourceBlock: (source.ts:678) invalid-record rejects non-object raw block, accepts valid block", () => {
  assertSchemaRefusal(() => validateSourceBlock(null), "invalid-record");
  assertSchemaRefusal(() => validateSourceBlock("not-an-object"), "invalid-record");
  const accepted = validateSourceBlock(VALID_BLOCK);
  assert.equal(accepted.id, "s1-p1");
});

test("validateSourceBlock: (source.ts:699) invalid-locator rejects non-object locator, accepts valid locator", () => {
  assertSchemaRefusal(
    () => validateSourceBlock({ ...VALID_BLOCK, locators: ["bad-locator"] }),
    "invalid-locator",
  );
  const accepted = validateSourceBlock({
    ...VALID_BLOCK,
    locators: [{ pdfPageIndex: 1, printedPage: 549 }],
  });
  assert.equal(accepted.locators.length, 1);
});

test("validateSourceBlock: (source.ts:719) invalid-printed-page rejects non-numeric printedPage, accepts number", () => {
  assertSchemaRefusal(
    () =>
      validateSourceBlock({
        ...VALID_BLOCK,
        locators: [{ pdfPageIndex: 1, printedPage: "549" }],
      }),
    "invalid-printed-page",
  );
  const accepted = validateSourceBlock({
    ...VALID_BLOCK,
    locators: [{ pdfPageIndex: 1, printedPage: 549 }],
  });
  assert.equal(accepted.locators[0]?.printedPage, 549);
});

test("validateSourceBlock: (source.ts:746) invalid-locator-region rejects non-numeric region properties, accepts numeric region", () => {
  assertSchemaRefusal(
    () =>
      validateSourceBlock({
        ...VALID_BLOCK,
        locators: [
          {
            pdfPageIndex: 1,
            printedPage: 549,
            region: { x: "0", y: 0, width: 100, height: 100 },
          },
        ],
      }),
    "invalid-locator-region",
  );
  const accepted = validateSourceBlock({
    ...VALID_BLOCK,
    locators: [
      {
        pdfPageIndex: 1,
        printedPage: 549,
        region: { x: 10, y: 20, width: 300, height: 100 },
      },
    ],
  });
  assert.equal(accepted.locators[0]?.region?.x, 10);
});

test("validateSourceBlock: (source.ts:771) invalid-contained-in rejects whitespace or empty containedIn, accepts valid string", () => {
  assertSchemaRefusal(
    () => validateSourceBlock({ ...VALID_BLOCK, containedIn: "   " }),
    "invalid-contained-in",
  );
  assertSchemaRefusal(
    () => validateSourceBlock({ ...VALID_BLOCK, containedIn: 123 }),
    "invalid-contained-in",
  );
  const accepted = validateSourceBlock({ ...VALID_BLOCK, containedIn: "sec-01" });
  assert.equal(accepted.containedIn, "sec-01");
});

test("validateSourceBlock: (source.ts:795) invalid-revision rejects non-positive or non-integer revision, accepts positive integer", () => {
  assertSchemaRefusal(
    () => validateSourceBlock({ ...VALID_BLOCK, revision: 0 }),
    "invalid-revision",
  );
  assertSchemaRefusal(
    () => validateSourceBlock({ ...VALID_BLOCK, revision: -1 }),
    "invalid-revision",
  );
  const accepted = validateSourceBlock({ ...VALID_BLOCK, revision: 1 });
  assert.equal(accepted.revision, 1);
});

test("validateSourceBlock: (source.ts:824) invalid-direction rejects invalid text direction, accepts ltr or rtl", () => {
  assertSchemaRefusal(
    () => validateSourceBlock({ ...VALID_BLOCK, dir: "invalid-dir" }),
    "invalid-direction",
  );
  const accepted = validateSourceBlock({ ...VALID_BLOCK, dir: "ltr" });
  assert.equal(accepted.dir, "ltr");
});

test("validateSourceBlock: (source.ts:826) invalid-transcription-status rejects invalid status.transcription, accepts valid value", () => {
  assertSchemaRefusal(
    () =>
      validateSourceBlock({
        ...VALID_BLOCK,
        status: { ...VALID_BLOCK.status, transcription: "unknown-status" },
      }),
    "invalid-transcription-status",
  );
  const accepted = validateSourceBlock({
    ...VALID_BLOCK,
    status: { ...VALID_BLOCK.status, transcription: "reviewed" },
  });
  assert.equal(accepted.status.transcription, "reviewed");
});

test("validateSourceBlock: (source.ts:838) invalid-math-status rejects invalid status.mathTranscription, accepts valid value", () => {
  assertSchemaRefusal(
    () =>
      validateSourceBlock({
        ...VALID_BLOCK,
        status: { ...VALID_BLOCK.status, mathTranscription: "pending" },
      }),
    "invalid-math-status",
  );
  const accepted = validateSourceBlock({
    ...VALID_BLOCK,
    status: { ...VALID_BLOCK.status, mathTranscription: "not-applicable" },
  });
  assert.equal(accepted.status.mathTranscription, "not-applicable");
});

test("validateSourceBlock: (source.ts:846) invalid-translation-status rejects invalid status.translation, accepts valid value", () => {
  assertSchemaRefusal(
    () =>
      validateSourceBlock({
        ...VALID_BLOCK,
        status: { ...VALID_BLOCK.status, translation: "in-progress" },
      }),
    "invalid-translation-status",
  );
  const accepted = validateSourceBlock({
    ...VALID_BLOCK,
    status: { ...VALID_BLOCK.status, translation: "reviewed" },
  });
  assert.equal(accepted.status.translation, "reviewed");
});

test("validateSourceBlock: (source.ts:854) invalid-review-status rejects invalid status.review, accepts valid value", () => {
  assertSchemaRefusal(
    () =>
      validateSourceBlock({
        ...VALID_BLOCK,
        status: { ...VALID_BLOCK.status, review: "completed" },
      }),
    "invalid-review-status",
  );
  const accepted = validateSourceBlock({
    ...VALID_BLOCK,
    status: { ...VALID_BLOCK.status, review: "accepted" },
  });
  assert.equal(accepted.status.review, "accepted");
});

test("validateSourceBlock: (source.ts:874) missing-span-id rejects sentenceSpan without string id, accepts with id", () => {
  assertSchemaRefusal(
    () =>
      validateSourceBlock({
        ...VALID_BLOCK,
        sentenceSpans: [{ id: 12345, span: VALID_BLOCK.sentenceSpans[0]?.span }],
      }),
    "missing-span-id",
  );
  const accepted = validateSourceBlock({
    ...VALID_BLOCK,
    sentenceSpans: [{ id: "s1-p1-s1", span: VALID_BLOCK.sentenceSpans[0]?.span }],
  });
  assert.equal(accepted.sentenceSpans[0]?.id, "s1-p1-s1");
});

// ============================================================================
// 4. VALIDATE TRANSLATION UNIT REFUSALS (4 SITES)
// ============================================================================

test("validateTranslationUnit: (source.ts:968) invalid-record rejects non-object raw translation unit, accepts valid unit", () => {
  assertSchemaRefusal(() => validateTranslationUnit(null), "invalid-record");
  assertSchemaRefusal(() => validateTranslationUnit("bad-tu"), "invalid-record");
  const accepted = validateTranslationUnit(VALID_TU);
  assert.equal(accepted.id, "s3-p2-s1a");
});

test("validateTranslationUnit: (source.ts:993) invalid-revision rejects non-positive or non-integer revision, accepts positive integer", () => {
  assertSchemaRefusal(
    () => validateTranslationUnit({ ...VALID_TU, revision: 0 }),
    "invalid-revision",
  );
  assertSchemaRefusal(
    () => validateTranslationUnit({ ...VALID_TU, revision: -2 }),
    "invalid-revision",
  );
  const accepted = validateTranslationUnit({ ...VALID_TU, revision: 3 });
  assert.equal(accepted.revision, 3);
});

test("validateTranslationUnit: (source.ts:1028) invalid-direction rejects invalid text direction, accepts ltr or rtl", () => {
  assertSchemaRefusal(
    () => validateTranslationUnit({ ...VALID_TU, dir: "top-to-bottom" }),
    "invalid-direction",
  );
  const accepted = validateTranslationUnit({ ...VALID_TU, dir: "ltr" });
  assert.equal(accepted.dir, "ltr");
});

test("validateTranslationUnit: (source.ts:1039) invalid-review-state rejects invalid reviewState, accepts valid state", () => {
  assertSchemaRefusal(
    () => validateTranslationUnit({ ...VALID_TU, reviewState: "not-ready" }),
    "invalid-review-state",
  );
  const accepted = validateTranslationUnit({ ...VALID_TU, reviewState: "reviewed" });
  assert.equal(accepted.reviewState, "reviewed");
});

// ============================================================================
// 5. VALIDATE ALIGNMENT REFUSALS (5 SITES)
// ============================================================================

test("validateAlignment: (source.ts:1107) invalid-record rejects non-object raw alignment, accepts valid alignment", () => {
  assertSchemaRefusal(() => validateAlignment(null), "invalid-record");
  assertSchemaRefusal(() => validateAlignment(1234), "invalid-record");
  const accepted = validateAlignment(VALID_ALIGNMENT);
  assert.equal(accepted.id, "align-brownian-s3");
});

test("validateAlignment: (source.ts:1106) missing-edges rejects empty or non-array edges, accepts non-empty array", () => {
  assertSchemaRefusal(() => validateAlignment({ ...VALID_ALIGNMENT, edges: [] }), "missing-edges");
  assertSchemaRefusal(
    () => validateAlignment({ ...VALID_ALIGNMENT, edges: null }),
    "missing-edges",
  );
  const accepted = validateAlignment({ ...VALID_ALIGNMENT, edges: VALID_ALIGNMENT.edges });
  assert.equal(accepted.edges.length, 1);
});

test("validateAlignment: (source.ts:1116) invalid-edge rejects non-object edge element, accepts valid edge object", () => {
  assertSchemaRefusal(
    () => validateAlignment({ ...VALID_ALIGNMENT, edges: [null] }),
    "invalid-edge",
  );
  assertSchemaRefusal(
    () => validateAlignment({ ...VALID_ALIGNMENT, edges: ["not-an-edge"] }),
    "invalid-edge",
  );
  const accepted = validateAlignment({
    ...VALID_ALIGNMENT,
    edges: [VALID_ALIGNMENT.edges[0]],
  });
  assert.equal(accepted.edges.length, 1);
});

test("validateAlignment: (source.ts:1127) invalid-edge-source rejects edge missing paper or blockId in source, accepts complete source", () => {
  assertSchemaRefusal(
    () =>
      validateAlignment({
        ...VALID_ALIGNMENT,
        edges: [{ source: { paper: "brownian-motion" }, target: { translationUnitId: "tu-1" } }],
      }),
    "invalid-edge-source",
  );
  const accepted = validateAlignment({
    ...VALID_ALIGNMENT,
    edges: [
      {
        source: { paper: "brownian-motion", blockId: "s3-p1" },
        target: { translationUnitId: "tu-1" },
      },
    ],
  });
  assert.equal(accepted.edges[0]?.source.blockId, "s3-p1");
});

test("validateAlignment: (source.ts:1135) invalid-edge-target rejects edge missing translationUnitId in target, accepts complete target", () => {
  assertSchemaRefusal(
    () =>
      validateAlignment({
        ...VALID_ALIGNMENT,
        edges: [{ source: { paper: "brownian-motion", blockId: "s3-p1" }, target: {} }],
      }),
    "invalid-edge-target",
  );
  const accepted = validateAlignment({
    ...VALID_ALIGNMENT,
    edges: [
      {
        source: { paper: "brownian-motion", blockId: "s3-p1" },
        target: { translationUnitId: "s3-p1-s1a" },
      },
    ],
  });
  assert.equal(accepted.edges[0]?.target.translationUnitId, "s3-p1-s1a");
});

// ============================================================================
// 6. VALIDATE GLOSS UNIT REFUSALS (13 SITES)
// ============================================================================

test("validateGlossUnit: (source.ts:1214) invalid-record rejects non-object raw gloss unit, accepts valid gloss unit", () => {
  assertSchemaRefusal(() => validateGlossUnit(null), "invalid-record");
  assertSchemaRefusal(() => validateGlossUnit(true), "invalid-record");
  const accepted = validateGlossUnit(VALID_GLOSS);
  assert.equal(accepted.sentenceId, "s1-p1-s1");
});

test("validateGlossUnit: (source.ts:1238) missing-sentence-id rejects empty or missing sentenceId, accepts valid id", () => {
  assertSchemaRefusal(
    () => validateGlossUnit({ ...VALID_GLOSS, sentenceId: "   " }),
    "missing-sentence-id",
  );
  assertSchemaRefusal(
    () => validateGlossUnit({ ...VALID_GLOSS, sentenceId: 123 }),
    "missing-sentence-id",
  );
  const accepted = validateGlossUnit({ ...VALID_GLOSS, sentenceId: "s1-p1-s1" });
  assert.equal(accepted.sentenceId, "s1-p1-s1");
});

test("validateGlossUnit: (source.ts:1231) invalid-revision rejects non-positive or non-integer revision, accepts positive integer", () => {
  assertSchemaRefusal(() => validateGlossUnit({ ...VALID_GLOSS, revision: 0 }), "invalid-revision");
  assertSchemaRefusal(
    () => validateGlossUnit({ ...VALID_GLOSS, revision: -1 }),
    "invalid-revision",
  );
  const accepted = validateGlossUnit({ ...VALID_GLOSS, revision: 2 });
  assert.equal(accepted.revision, 2);
});

test("validateGlossUnit: (source.ts:1288) invalid-language-tag rejects invalid sourceLang tag, accepts valid tag", () => {
  assertSchemaRefusal(
    () => validateGlossUnit({ ...VALID_GLOSS, sourceLang: "bad!source!lang" }),
    "invalid-language-tag",
  );
  const accepted = validateGlossUnit({ ...VALID_GLOSS, sourceLang: "de" });
  assert.equal(accepted.sourceLang, "de");
});

test("validateGlossUnit: (source.ts:1312) missing-attribution rejects falsy attribution, accepts valid attribution entry", () => {
  assertSchemaRefusal(
    () => validateGlossUnit({ ...VALID_GLOSS, attribution: null }),
    "missing-attribution",
  );
  assertSchemaRefusal(
    () => validateGlossUnit({ ...VALID_GLOSS, attribution: undefined }),
    "missing-attribution",
  );
  const accepted = validateGlossUnit({ ...VALID_GLOSS, attribution: VALID_GLOSS.attribution });
  assert.equal(accepted.attribution.id, "jemanuel");
});

test("validateGlossUnit: (source.ts:1325) missing-tokens rejects empty or non-array tokens, accepts non-empty array", () => {
  assertSchemaRefusal(() => validateGlossUnit({ ...VALID_GLOSS, tokens: [] }), "missing-tokens");
  assertSchemaRefusal(() => validateGlossUnit({ ...VALID_GLOSS, tokens: null }), "missing-tokens");
  const accepted = validateGlossUnit({ ...VALID_GLOSS, tokens: VALID_GLOSS.tokens });
  assert.equal(accepted.tokens.length, 3);
});

test("validateGlossUnit: (source.ts:1324) invalid-direction rejects invalid text direction, accepts ltr or rtl", () => {
  assertSchemaRefusal(
    () => validateGlossUnit({ ...VALID_GLOSS, dir: "vertical" }),
    "invalid-direction",
  );
  const accepted = validateGlossUnit({ ...VALID_GLOSS, dir: "ltr" });
  assert.equal(accepted.dir, "ltr");
});

test("validateGlossUnit: (source.ts:1330) invalid-review-state rejects unknown reviewState, accepts valid state", () => {
  assertSchemaRefusal(
    () => validateGlossUnit({ ...VALID_GLOSS, reviewState: "unapproved" }),
    "invalid-review-state",
  );
  const accepted = validateGlossUnit({ ...VALID_GLOSS, reviewState: "draft" });
  assert.equal(accepted.reviewState, "draft");
});

test("validateGlossUnit: (source.ts:1355) invalid-token rejects non-object token entry, accepts valid token object", () => {
  assertSchemaRefusal(() => validateGlossUnit({ ...VALID_GLOSS, tokens: [null] }), "invalid-token");
  assertSchemaRefusal(
    () => validateGlossUnit({ ...VALID_GLOSS, tokens: ["not-a-token"] }),
    "invalid-token",
  );
  const accepted = validateGlossUnit({
    ...VALID_GLOSS,
    tokens: [{ german: "Wort", english: "word" }],
    multiwordUnits: [],
  });
  assert.equal(accepted.tokens.length, 1);
});

test("validateGlossUnit: (source.ts:1363) missing-german-token rejects token missing string german word, accepts with german", () => {
  assertSchemaRefusal(
    () => validateGlossUnit({ ...VALID_GLOSS, tokens: [{ english: "word" }] }),
    "missing-german-token",
  );
  const accepted = validateGlossUnit({
    ...VALID_GLOSS,
    tokens: [{ german: "Wort", english: "word" }],
    multiwordUnits: [],
  });
  assert.equal(accepted.tokens[0]?.german, "Wort");
});

test("validateGlossUnit: (source.ts:1413) invalid-multiword-unit rejects non-object multiword unit, accepts valid multiword unit", () => {
  assertSchemaRefusal(
    () => validateGlossUnit({ ...VALID_GLOSS, multiwordUnits: [null] }),
    "invalid-multiword-unit",
  );
  assertSchemaRefusal(
    () => validateGlossUnit({ ...VALID_GLOSS, multiwordUnits: ["bad-unit"] }),
    "invalid-multiword-unit",
  );
  const accepted = validateGlossUnit({
    ...VALID_GLOSS,
    multiwordUnits: [VALID_GLOSS.multiwordUnits[0]],
  });
  assert.equal(accepted.multiwordUnits.length, 1);
});

test("validateGlossUnit: (source.ts:1436) missing-multiword-english rejects multiword unit with empty english, accepts valid english", () => {
  assertSchemaRefusal(
    () =>
      validateGlossUnit({
        ...VALID_GLOSS,
        multiwordUnits: [{ tokenIndices: [0, 1], kind: "fixed-phrase", english: "   " }],
      }),
    "missing-multiword-english",
  );
  const accepted = validateGlossUnit({
    ...VALID_GLOSS,
    multiwordUnits: [{ tokenIndices: [0, 1], kind: "fixed-phrase", english: "in this" }],
  });
  assert.equal(accepted.multiwordUnits[0]?.english, "in this");
});

test("validateGlossUnit: (source.ts:1444) unlisted-note-class rejects multiword unit with unknown noteClass, accepts listed noteClass", () => {
  assertSchemaRefusal(
    () =>
      validateGlossUnit({
        ...VALID_GLOSS,
        multiwordUnits: [
          {
            tokenIndices: [0, 1],
            kind: "fixed-phrase",
            english: "in this",
            noteClass: "unlisted-note-class",
          },
        ],
      }),
    "unlisted-note-class",
  );
  const accepted = validateGlossUnit({
    ...VALID_GLOSS,
    multiwordUnits: [
      {
        tokenIndices: [0, 1],
        kind: "fixed-phrase",
        english: "in this",
        noteClass: "term",
      },
    ],
  });
  assert.equal(accepted.multiwordUnits[0]?.noteClass, "term");
});

// ============================================================================
// 7. VALIDATE EDITORIAL NOTE REFUSALS (6 SITES)
// ============================================================================

test("validateEditorialNote: (source.ts:1505) invalid-record rejects non-object raw note, accepts valid note", () => {
  assertSchemaRefusal(() => validateEditorialNote(null), "invalid-record");
  assertSchemaRefusal(() => validateEditorialNote(999), "invalid-record");
  const accepted = validateEditorialNote(VALID_NOTE);
  assert.equal(accepted.id, "note-dispute-1");
});

test("validateEditorialNote: (source.ts:1548) missing-claim rejects empty or non-string claim, accepts non-empty claim", () => {
  assertSchemaRefusal(
    () => validateEditorialNote({ ...VALID_NOTE, claim: "   " }),
    "missing-claim",
  );
  assertSchemaRefusal(() => validateEditorialNote({ ...VALID_NOTE, claim: null }), "missing-claim");
  const accepted = validateEditorialNote({ ...VALID_NOTE, claim: "Einstein priority claim." });
  assert.equal(accepted.claim, "Einstein priority claim.");
});

test("validateEditorialNote: (source.ts:1539) invalid-language-tag rejects invalid note language tag, accepts valid tag", () => {
  assertSchemaRefusal(
    () => validateEditorialNote({ ...VALID_NOTE, lang: "bad!note!lang" }),
    "invalid-language-tag",
  );
  const accepted = validateEditorialNote({ ...VALID_NOTE, lang: "en" });
  assert.equal(accepted.lang, "en");
});

test("validateEditorialNote: (source.ts:1554) invalid-direction rejects invalid note text direction, accepts ltr or rtl", () => {
  assertSchemaRefusal(
    () => validateEditorialNote({ ...VALID_NOTE, dir: "bidi-invalid" }),
    "invalid-direction",
  );
  const accepted = validateEditorialNote({ ...VALID_NOTE, dir: "ltr" });
  assert.equal(accepted.dir, "ltr");
});

test("validateEditorialNote: (source.ts:1608) invalid-correction-layer rejects layer other than source or translation, accepts source", () => {
  assertSchemaRefusal(
    () => validateEditorialNote({ ...VALID_CORRECTION_NOTE, layer: "gloss" }),
    "invalid-correction-layer",
  );
  const accepted = validateEditorialNote({ ...VALID_CORRECTION_NOTE, layer: "source" });
  assert.equal(accepted.layer, "source");
});

test("validateEditorialNote: (source.ts:1596) invalid-review-state rejects unknown note reviewState, accepts valid state", () => {
  assertSchemaRefusal(
    () => validateEditorialNote({ ...VALID_NOTE, reviewState: "unapproved" }),
    "invalid-review-state",
  );
  const accepted = validateEditorialNote({ ...VALID_NOTE, reviewState: "reviewed" });
  assert.equal(accepted.reviewState, "reviewed");
});

// ============================================================================
// 8. VALIDATE CITATION REFUSALS (3 SITES)
// ============================================================================

test("validateCitation: (source.ts:1642) invalid-record rejects non-object raw citation, accepts valid citation", () => {
  assertSchemaRefusal(() => validateCitation(null), "invalid-record");
  assertSchemaRefusal(() => validateCitation("bad-citation"), "invalid-record");
  const accepted = validateCitation(VALID_CITATION);
  assert.equal(accepted.id, "cit-doi-1");
});

test("validateCitation: (source.ts:1651) missing-id rejects empty or non-string id, accepts valid id", () => {
  assertSchemaRefusal(() => validateCitation({ ...VALID_CITATION, id: "   " }), "missing-id");
  assertSchemaRefusal(() => validateCitation({ ...VALID_CITATION, id: null }), "missing-id");
  const accepted = validateCitation({ ...VALID_CITATION, id: "cit-1905-einstein" });
  assert.equal(accepted.id, "cit-1905-einstein");
});

test("validateCitation: (source.ts:1654) missing-title rejects empty or non-string title, accepts valid title", () => {
  assertSchemaRefusal(() => validateCitation({ ...VALID_CITATION, title: "   " }), "missing-title");
  assertSchemaRefusal(() => validateCitation({ ...VALID_CITATION, title: 123 }), "missing-title");
  const accepted = validateCitation({
    ...VALID_CITATION,
    title: "Zur Elektrodynamik bewegter Körper",
  });
  assert.equal(accepted.title, "Zur Elektrodynamik bewegter Körper");
});

// ============================================================================
// 9. VALIDATE TRANSLATION EDITION REFUSALS (9 SITES)
// ============================================================================

test("validateTranslationEdition: (source.ts:1740) invalid-record rejects non-object raw edition, accepts valid edition", () => {
  assertSchemaRefusal(() => validateTranslationEdition(null), "invalid-record");
  assertSchemaRefusal(() => validateTranslationEdition("bad-edition"), "invalid-record");
  const accepted = validateTranslationEdition(VALID_EDITION);
  assert.equal(accepted.editionId, "edition-en-standard");
});

test("validateTranslationEdition: (source.ts:1772) missing-edition-id rejects empty or missing editionId, accepts non-empty id", () => {
  assertSchemaRefusal(
    () => validateTranslationEdition({ ...VALID_EDITION, editionId: "   " }),
    "missing-edition-id",
  );
  assertSchemaRefusal(
    () => validateTranslationEdition({ ...VALID_EDITION, editionId: null }),
    "missing-edition-id",
  );
  const accepted = validateTranslationEdition({
    ...VALID_EDITION,
    editionId: "edition-en-standard",
  });
  assert.equal(accepted.editionId, "edition-en-standard");
});

test("validateTranslationEdition: (source.ts:1780) missing-paper-id rejects empty or missing paperId, accepts valid paperId", () => {
  assertSchemaRefusal(
    () => validateTranslationEdition({ ...VALID_EDITION, paperId: "   " }),
    "missing-paper-id",
  );
  assertSchemaRefusal(
    () => validateTranslationEdition({ ...VALID_EDITION, paperId: 123 }),
    "missing-paper-id",
  );
  const accepted = validateTranslationEdition({ ...VALID_EDITION, paperId: "ap-17-549" });
  assert.equal(accepted.paperId, "ap-17-549");
});

test("validateTranslationEdition: (source.ts:1765) missing-title rejects empty or missing edition title, accepts valid title", () => {
  assertSchemaRefusal(
    () => validateTranslationEdition({ ...VALID_EDITION, title: "   " }),
    "missing-title",
  );
  assertSchemaRefusal(
    () => validateTranslationEdition({ ...VALID_EDITION, title: null }),
    "missing-title",
  );
  const accepted = validateTranslationEdition({
    ...VALID_EDITION,
    title: "English Translation Edition",
  });
  assert.equal(accepted.title, "English Translation Edition");
});

test("validateTranslationEdition: (source.ts:1796) missing-license rejects empty or missing license, accepts valid license", () => {
  assertSchemaRefusal(
    () => validateTranslationEdition({ ...VALID_EDITION, license: "   " }),
    "missing-license",
  );
  assertSchemaRefusal(
    () => validateTranslationEdition({ ...VALID_EDITION, license: undefined }),
    "missing-license",
  );
  const accepted = validateTranslationEdition({ ...VALID_EDITION, license: "CC-BY-4.0" });
  assert.equal(accepted.license, "CC-BY-4.0");
});

test("validateTranslationEdition: (source.ts:1806) missing-language rejects empty or missing language, accepts valid language", () => {
  assertSchemaRefusal(
    () => validateTranslationEdition({ ...VALID_EDITION, language: "   " }),
    "missing-language",
  );
  assertSchemaRefusal(
    () => validateTranslationEdition({ ...VALID_EDITION, language: null }),
    "missing-language",
  );
  const accepted = validateTranslationEdition({ ...VALID_EDITION, language: "en" });
  assert.equal(accepted.language, "en");
});

test("validateTranslationEdition: (source.ts:1819) invalid-language-tag rejects invalid edition language tag, accepts valid tag", () => {
  assertSchemaRefusal(
    () => validateTranslationEdition({ ...VALID_EDITION, language: "bad!lang!tag" }),
    "invalid-language-tag",
  );
  const accepted = validateTranslationEdition({ ...VALID_EDITION, language: "en-US" });
  assert.equal(accepted.language, "en-US");
});

test("validateTranslationEdition: (source.ts:1829) invalid-review-state rejects unknown edition reviewState, accepts valid state", () => {
  assertSchemaRefusal(
    () => validateTranslationEdition({ ...VALID_EDITION, reviewState: "unapproved" }),
    "invalid-review-state",
  );
  const accepted = validateTranslationEdition({ ...VALID_EDITION, reviewState: "reviewed" });
  assert.equal(accepted.reviewState, "reviewed");
});

test("validateTranslationEdition: (source.ts:1843) missing-units rejects non-array units, accepts array of units", () => {
  assertSchemaRefusal(
    () => validateTranslationEdition({ ...VALID_EDITION, units: null }),
    "missing-units",
  );
  assertSchemaRefusal(
    () => validateTranslationEdition({ ...VALID_EDITION, units: "not-an-array" }),
    "missing-units",
  );
  const accepted = validateTranslationEdition({ ...VALID_EDITION, units: [] });
  assert.deepEqual(accepted.units, []);
});

/**
 * am-r3qt. Eleven more sites, and thirty stale citations.
 *
 * The thirty are the larger finding and they are fixed above, in the test names: every
 * citation in this file pointed at the wrong line. They had drifted in four distinct
 * bands - +23, +13, -15 and -23 - as code was inserted and removed above them, and
 * nothing reported it because a citation matching no site is silently ignored. Under the
 * old mention-credit rule the sites were credited anyway, so 32 tests that DO drive their
 * refusals were all reported as untested the moment attribution became strict.
 *
 * Each repointing was established by planting: renaming exactly one site's code reddens
 * exactly one test, and that test now carries that site's line. None of the thirty needed
 * a new assertion.
 *
 * The eleven below were driven by nothing. Unlike facsimileSourceSchema, NONE of them is
 * unreachable: this module validates a record field by field with no validating loader
 * above it, so the duplicated-guard pattern that killed four refusals elsewhere does not
 * appear here at all. Eleven sites, eleven real gaps.
 */

test("validateSourceAsset: (source.ts:505) missing-required-rights-field rejects a status whose required statement is blank", () => {
  // The per-status required-field loop, which is a different site from the five
  // field-specific ones above it: this one fires for rights.statement on ANY status whose
  // vocabulary entry requires it, so it is the rule rather than a named field.
  const rights = { ...(VALID_ASSET.rights as Record<string, unknown>), statement: "   " };
  assertSchemaRefusal(
    () => validateSourceAsset({ ...VALID_ASSET, rights }),
    "missing-required-rights-field",
  );
  const accepted = validateSourceAsset(VALID_ASSET);
  assert.equal(accepted.sha256, VALID_ASSET.sha256);
});

test("validateSourceBlock: (source.ts:687) missing-id rejects a block with no id", () => {
  assertSchemaRefusal(() => validateSourceBlock({ ...VALID_BLOCK, id: "   " }), "missing-id");
  assertSchemaRefusal(() => validateSourceBlock({ ...VALID_BLOCK, id: null }), "missing-id");
  assert.equal(validateSourceBlock(VALID_BLOCK).id, VALID_BLOCK.id);
});

test("validateSourceBlock: (source.ts:690) invalid-kind rejects a block kind outside the list", () => {
  // A block id survives a rename; a block KIND selects which face renders it, so an
  // unlisted kind is a record nothing can display rather than a record with a typo.
  assertSchemaRefusal(
    () => validateSourceBlock({ ...VALID_BLOCK, kind: "marginalia" }),
    "invalid-kind",
  );
  assert.equal(validateSourceBlock(VALID_BLOCK).kind, "paragraph");
});

test("validateSourceBlock: (source.ts:809) invalid-language-tag rejects a malformed block lang", () => {
  // lang is optional on a block, so the refusal fires only when one is PRESENT and
  // malformed. Passing undefined must still be accepted, or this arm would be asserting
  // that the field is required, which it is not.
  assertSchemaRefusal(
    () => validateSourceBlock({ ...VALID_BLOCK, lang: "deutsch" }),
    "invalid-language-tag",
  );
  const accepted = validateSourceBlock({ ...VALID_BLOCK, lang: undefined });
  assert.equal(accepted.id, VALID_BLOCK.id);
});

test("validateTranslationUnit: (source.ts:977) missing-id rejects a unit with no id", () => {
  assertSchemaRefusal(() => validateTranslationUnit({ ...VALID_TU, id: "" }), "missing-id");
  assertSchemaRefusal(() => validateTranslationUnit({ ...VALID_TU, id: 7 }), "missing-id");
  assert.equal(validateTranslationUnit(VALID_TU).id, VALID_TU.id);
});

test("validateGlossUnit: (source.ts:1260) missing-lang rejects a gloss with no target language", () => {
  // Required here and optional on a SourceBlock, which is why the two have separate
  // sites: a gloss with no target language cannot be rendered for any reader.
  assertSchemaRefusal(() => validateGlossUnit({ ...VALID_GLOSS, lang: "  " }), "missing-lang");
  assertSchemaRefusal(() => validateGlossUnit({ ...VALID_GLOSS, lang: undefined }), "missing-lang");
  assert.equal(validateGlossUnit(VALID_GLOSS).lang, "en");
});

test("validateGlossUnit: (source.ts:1272) invalid-language-tag rejects a malformed gloss lang", () => {
  // Reached only because the presence check above it PASSES, which is what separates
  // this arm from missing-lang: "deutsch" is present and is not a language tag.
  assertSchemaRefusal(
    () => validateGlossUnit({ ...VALID_GLOSS, lang: "deutsch" }),
    "invalid-language-tag",
  );
  assert.equal(validateGlossUnit(VALID_GLOSS).lang, "en");
});

test("validateGlossUnit: (source.ts:1367) unlisted-note-class rejects a token noteClass outside the list", () => {
  // noteClass is optional on a token, so undefined must pass. The refusal exists because
  // a gloss note is rendered by class, and an unlisted class is a note with no treatment.
  const tokens = (VALID_GLOSS.tokens as Record<string, unknown>[]).map((token, index) =>
    index === 0 ? { ...token, noteClass: "editor-aside" } : token,
  );
  assertSchemaRefusal(() => validateGlossUnit({ ...VALID_GLOSS, tokens }), "unlisted-note-class");
  assert.equal(validateGlossUnit(VALID_GLOSS).sentenceId, VALID_GLOSS.sentenceId);
});

test("validateEditorialNote: (source.ts:1514) missing-id rejects a note with no id", () => {
  assertSchemaRefusal(() => validateEditorialNote({ ...VALID_NOTE, id: "   " }), "missing-id");
  assert.equal(validateEditorialNote(VALID_NOTE).id, VALID_NOTE.id);
});

test("validateEditorialNote: (source.ts:1517) invalid-kind rejects a note kind outside the list", () => {
  // The kinds are the editorial layers AGENTS.md separates - historian's margin,
  // correction, typographical, dispute, side note - so an unlisted kind is a note whose
  // attribution layer is undefined, not a cosmetic mislabel.
  assertSchemaRefusal(
    () => validateEditorialNote({ ...VALID_NOTE, kind: "footnote" }),
    "invalid-kind",
  );
  assert.equal(validateEditorialNote(VALID_NOTE).kind, "dispute");
});

test("validateCitation: (source.ts:1662) invalid-role rejects a citation role outside the four", () => {
  // The four roles carry different evidential weight - a comparison witness is not a
  // primary source - so an unlisted role would let a witness be cited as evidence.
  assertSchemaRefusal(
    () => validateCitation({ ...VALID_CITATION, role: "supporting" }),
    "invalid-role",
  );
  for (const role of ["primary", "comparison-witness", "secondary", "technical"]) {
    assert.equal(validateCitation({ ...VALID_CITATION, role }).role, role);
  }
});
