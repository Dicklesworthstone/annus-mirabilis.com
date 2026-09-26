import assert from "node:assert/strict";
import test from "node:test";
import { validateInline } from "../content/schemas/inlines.ts";
import {
  validateGlossUnit,
  validateSourceBlock,
  validateTranslationEdition,
  validateTranslationUnit,
} from "../content/schemas/source.ts";
import { isValidLanguageTag, validateLanguageTag } from "./language.ts";

test("langSchema: validates BCP 47 language tag grammar", () => {
  const validTags = ["de", "en", "fr", "en-US", "de-CH", "ar", "he", "zh-Hant", "ast", "gsw"];
  for (const tag of validTags) {
    assert.equal(isValidLanguageTag(tag), true, `Tag "${tag}" should be valid`);
    assert.equal(validateLanguageTag(tag), tag);
  }

  const invalidTags = ["english", "deutsch", "DE", "EN", "", "123", "en_US"];
  for (const tag of invalidTags) {
    assert.equal(isValidLanguageTag(tag), false, `Tag "${tag}" should be invalid`);
    assert.throws(() => validateLanguageTag(tag));
  }
});

test("langSchema: TranslationUnit without lang or with invalid lang fails (source.ts:1002) (source.ts:1014)", () => {
  const validTu = {
    id: "tr-01",
    sourceRefs: [{ paper: "brownian-motion", id: "s1-p1" }],
    inlines: [{ kind: "text", text: "In this paper..." }],
    translator: { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
    revision: 1,
    unresolvedAlternatives: [],
    reviewState: "draft",
    lang: "en",
  };

  // Valid TU passes
  const parsed = validateTranslationUnit(validTu);
  assert.equal(parsed.lang, "en");

  // Missing lang fails
  const missingLangTu = { ...validTu, lang: undefined };
  assert.throws(
    () => validateTranslationUnit(missingLangTu),
    (err: any) => {
      assert.equal(err.code, "missing-lang");
      return true;
    },
  );

  // Invalid lang fails
  const invalidLangTu = { ...validTu, lang: "english" };
  assert.throws(
    () => validateTranslationUnit(invalidLangTu),
    (err: any) => {
      assert.equal(err.code, "invalid-language-tag");
      return true;
    },
  );
});

test("langSchema: GlossUnit with invalid sourceLang (e.g. 'deutsch') fails", () => {
  const validGloss = {
    sentenceId: "s1-p1-s1",
    revision: 1,
    sourceRevision: 1,
    sourceTextDigest: "abc123",
    lang: "en",
    sourceLang: "de",
    attribution: { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
    tokens: [{ german: "Wärme", english: "heat" }],
    multiwordUnits: [],
  };

  const parsed = validateGlossUnit(validGloss);
  assert.equal(parsed.sourceLang, "de");

  const invalidGloss = { ...validGloss, sourceLang: "deutsch" };
  assert.throws(
    () => validateGlossUnit(invalidGloss),
    (err: any) => {
      assert.equal(err.code, "invalid-language-tag");
      return true;
    },
  );
});

test("langSchema: validateSourceBlock accepts optional custom lang", () => {
  const sb = validateSourceBlock({
    id: "s1-p1",
    kind: "paragraph",
    locators: [{ pdfPageIndex: 1, printedPage: 549 }],
    inlines: [{ kind: "text", text: "Originaler Text" }],
    revision: 1,
    status: {
      transcription: "draft",
      mathTranscription: "not-applicable",
      translation: "draft",
      review: "draft",
    },
  });
  assert.equal(sb.lang, undefined);

  const customSb = validateSourceBlock({
    id: "s1-p1",
    kind: "paragraph",
    locators: [{ pdfPageIndex: 1, printedPage: 549 }],
    inlines: [{ kind: "text", text: "Originaler Text" }],
    revision: 1,
    status: {
      transcription: "draft",
      mathTranscription: "not-applicable",
      translation: "draft",
      review: "draft",
    },
    lang: "de-AT",
  });
  assert.equal(customSb.lang, "de-AT");
});

test("langSchema: validateTranslationEdition validates language metadata", () => {
  const edition = validateTranslationEdition({
    editionId: "ed-en-standard",
    paperId: "brownian-motion",
    title: "On the Motion of Small Particles",
    language: "en",
    license: "CC-BY-4.0",
    reviewState: "reviewed",
    translator: { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
    units: [
      {
        id: "tr-01",
        sourceRefs: [{ paper: "brownian-motion", id: "s1-p1" }],
        inlines: [{ kind: "text", text: "In this paper..." }],
        translator: { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
        editor: { id: "person:JE", kind: "human", name: "Jeff Emanuel" },
        revision: 1,
        unresolvedAlternatives: [],
        reviewState: "reviewed",
        lang: "en",
      },
    ],
  });
  assert.equal(edition.language, "en");
});

test("langSchema: Inline term annotation with lang='de' passes validation", () => {
  const inlineWithLang = validateInline({
    kind: "term",
    text: "Gedankenexperiment",
    termId: "thought-experiment",
    lang: "de",
  });
  assert.equal(inlineWithLang.kind, "term");
  if (inlineWithLang.kind === "term") {
    assert.equal(inlineWithLang.lang, "de");
  }

  // Inline with invalid lang fails
  assert.throws(() =>
    validateInline({
      kind: "term",
      text: "Gedankenexperiment",
      termId: "thought-experiment",
      lang: "german",
    }),
  );
});
