/**
 * A record from one edition layer must never validate as a record of another. Types alone are
 * not a gate: TypeScript's structural typing would happily accept an English TranslationUnit
 * object wherever a SourceBlock is expected if the two shapes ever converged, and the mistake
 * would typecheck. This suite plants one negative per layer boundary -- a record that SHOULD be
 * refused, asserted refused by the real runtime validators -- paired with a genuinely valid
 * record of the target type, so the test cannot pass merely because the validator rejects
 * everything. Specification: am-cm-schemas-source-1en.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  validateEditorialNote,
  validateGlossUnit,
  validateSourceAsset,
  validateSourceBlock,
  validateTranslationUnit,
} from "./source.ts";

const validSourceBlock = {
  id: "s1-p1",
  kind: "paragraph",
  paper: "brownian-motion",
  section: "s1",
  order: 1,
  locators: [{ pdfPageIndex: 1, printedPage: 549 }],
  inlines: [{ kind: "text", text: "Einleitung." }],
  sentenceSpans: [],
  revision: 1,
  status: {
    transcription: "draft",
    mathTranscription: "not-applicable",
    translation: "draft",
    review: "draft",
  },
};

const validTranslationUnit = {
  id: "s1-p1-s1a",
  sourceRefs: [{ paper: "brownian-motion", id: "s1-p1" }],
  inlines: [{ kind: "text", text: "Introduction." }],
  translator: { id: "jemanuel", kind: "human" },
  revision: 1,
  unresolvedAlternatives: [],
  reviewState: "draft",
  lang: "en",
};

test("layer boundary: a well-formed TranslationUnit is refused when validated as a SourceBlock", () => {
  // Control: the same record validates cleanly as what it actually is.
  const tu = validateTranslationUnit(validTranslationUnit);
  assert.equal(tu.id, "s1-p1-s1a");

  // The English translation unit has no kind and no locators -- the German source-block slot's
  // own required fields -- so it must never occupy that slot.
  assert.throws(
    () => validateSourceBlock(validTranslationUnit),
    (err: any) => {
      assert.equal(err.name, "SchemaValidationError");
      assert.ok(
        err.code === "invalid-kind" || err.code === "missing-locators",
        `expected invalid-kind or missing-locators, got ${err.code}`,
      );
      return true;
    },
  );
});

test("layer boundary: a well-formed SourceBlock is refused when validated as a TranslationUnit", () => {
  // Control: the same record validates cleanly as what it actually is.
  const block = validateSourceBlock(validSourceBlock);
  assert.equal(block.id, "s1-p1");

  // The German source block carries no sourceRefs and no translator -- the translation layer's
  // own required fields -- so it must never occupy a translation unit's slot.
  assert.throws(
    () => validateTranslationUnit(validSourceBlock),
    (err: any) => {
      assert.equal(err.name, "SchemaValidationError");
      assert.equal(err.code, "missing-source-refs");
      return true;
    },
  );
});

test("layer boundary: swapping only the discriminating fields does not make either side pass as the other", () => {
  // A record with a SourceBlock's discriminating fields grafted onto a TranslationUnit's other
  // fields is still not a real TranslationUnit -- the reverse direction of the same rule -- since
  // it now lacks sourceRefs and translator.
  const grafted = {
    ...validTranslationUnit,
    kind: "paragraph",
    locators: [{ pdfPageIndex: 1, printedPage: 549 }],
    sourceRefs: undefined,
    translator: undefined,
  };
  assert.throws(
    () => validateTranslationUnit(grafted),
    (err: any) => {
      assert.equal(err.code, "missing-source-refs");
      return true;
    },
  );
});

const validGlossUnit = {
  sentenceId: "s1-p1-s1",
  revision: 1,
  sourceRevision: 1,
  sourceTextDigest: "abc",
  lang: "en",
  sourceLang: "de",
  attribution: { id: "jemanuel", kind: "human" },
  tokens: [{ german: "In", english: "in" }],
  multiwordUnits: [],
};

const validEditorialNote = {
  id: "note-s1-p1-1",
  author: { id: "jemanuel", kind: "human" },
  claim: "The printed date-line reads Bern, den 17. März 1905.",
  sourceSupport: [],
  kind: "side-note",
  affectedIds: ["s1-p1"],
  reviewState: "draft",
};

test("layer boundary: a well-formed GlossUnit is refused when validated as a SourceBlock or a TranslationUnit", () => {
  // Control: the same record validates cleanly as what it actually is.
  const gloss = validateGlossUnit(validGlossUnit);
  assert.equal(gloss.sentenceId, "s1-p1-s1");

  // The gloss unit has no id (it is addressed by sentenceId instead), no kind, no locators, no
  // sourceRefs, and no translator -- it carries tokens and an attribution instead, so it must
  // never occupy either layer's slot.
  assert.throws(
    () => validateSourceBlock(validGlossUnit),
    (err: any) => {
      assert.equal(err.name, "SchemaValidationError");
      assert.ok(
        err.code === "missing-id" || err.code === "invalid-kind" || err.code === "missing-locators",
        `expected missing-id, invalid-kind, or missing-locators, got ${err.code}`,
      );
      return true;
    },
  );
  assert.throws(
    () => validateTranslationUnit(validGlossUnit),
    (err: any) => {
      assert.equal(err.name, "SchemaValidationError");
      assert.ok(
        err.code === "missing-id" || err.code === "missing-source-refs",
        `expected missing-id or missing-source-refs, got ${err.code}`,
      );
      return true;
    },
  );
});

test("layer boundary: a well-formed EditorialNote is refused when validated as a SourceBlock or a TranslationUnit", () => {
  // Control: the same record validates cleanly as what it actually is.
  const note = validateEditorialNote(validEditorialNote);
  assert.equal(note.id, "note-s1-p1-1");

  // The editorial note carries a claim and affectedIds, not a locators list or sourceRefs -- an
  // annotation about the source is not the source, and it is not a translation of it either.
  assert.throws(
    () => validateSourceBlock(validEditorialNote),
    (err: any) => {
      assert.equal(err.name, "SchemaValidationError");
      assert.ok(
        err.code === "invalid-kind" || err.code === "missing-locators",
        `expected invalid-kind or missing-locators, got ${err.code}`,
      );
      return true;
    },
  );
  assert.throws(
    () => validateTranslationUnit(validEditorialNote),
    (err: any) => {
      assert.equal(err.name, "SchemaValidationError");
      assert.equal(err.code, "missing-source-refs");
      return true;
    },
  );
});

const validSourceAsset = {
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

test("layer boundary: a well-formed SourceAsset (the pinned facsimile) is refused when validated as a SourceBlock or a TranslationUnit", () => {
  // Control: the same record validates cleanly as what it actually is.
  const asset = validateSourceAsset(validSourceAsset);
  assert.equal(asset.sha256, "a".repeat(64));

  // The pinned facsimile carries no id, no kind, no locators, no sourceRefs, and no translator --
  // it carries bytes, rights, and a page mapping instead, so it must never occupy the German
  // source-block slot or the English translation-unit slot. A later layer never substitutes for
  // an earlier one, and the earliest layer never substitutes for a later one either.
  assert.throws(
    () => validateSourceBlock(validSourceAsset),
    (err: any) => {
      assert.equal(err.name, "SchemaValidationError");
      assert.ok(
        err.code === "missing-id" || err.code === "invalid-kind" || err.code === "missing-locators",
        `expected missing-id, invalid-kind, or missing-locators, got ${err.code}`,
      );
      return true;
    },
  );
  assert.throws(
    () => validateTranslationUnit(validSourceAsset),
    (err: any) => {
      assert.equal(err.name, "SchemaValidationError");
      assert.ok(
        err.code === "missing-id" || err.code === "missing-source-refs",
        `expected missing-id or missing-source-refs, got ${err.code}`,
      );
      return true;
    },
  );
});

test("layer boundary: a well-formed SourceBlock is refused when validated as a SourceAsset", () => {
  // The reverse direction: the German diplomatic text is not a pinned facsimile either. It
  // carries none of a SourceAsset's own required fields (originUrl, acquisitionDate, sha256,
  // mimeType, pageCount, pageMapping, rights).
  assert.throws(
    () => validateSourceAsset(validSourceBlock),
    (err: any) => {
      assert.equal(err.name, "SchemaValidationError");
      assert.equal(err.code, "missing-origin-url");
      return true;
    },
  );
});
