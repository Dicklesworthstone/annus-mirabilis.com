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
import { validateSourceBlock, validateTranslationUnit } from "./source.ts";

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
