import assert from "node:assert/strict";
import test from "node:test";
import {
  type CheckContext,
  type CheckReportItem,
  listRegisteredChecks,
} from "../../compiler/checks/registry.ts";
import { I18N_LANG_REQUIRED_CHECK_ID, registerI18nCheck, validateI18nRecords } from "./check.ts";

function createMockContext(records: Map<string, unknown>): {
  context: CheckContext;
  reports: CheckReportItem[];
} {
  const reports: CheckReportItem[] = [];
  const context: CheckContext = {
    records,
    files: [],
    indexes: {},
    report: (item) => {
      reports.push(item);
    },
  };
  return { context, reports };
}

test("i18n compiler check: registers under family 'i18n' with error severity", () => {
  registerI18nCheck();
  const checks = listRegisteredChecks();
  const i18nCheck = checks.find((c) => c.id === I18N_LANG_REQUIRED_CHECK_ID);

  assert.notEqual(i18nCheck, undefined);
  assert.equal(i18nCheck?.family, "i18n");
  assert.equal(i18nCheck?.severity, "error");
  assert.equal(i18nCheck?.beadId, "am-cm-i18n-readiness-b2g");
});

test("i18n compiler check: valid translation units and source blocks pass cleanly", () => {
  const records = new Map<string, unknown>();
  records.set("tr-bm-01", {
    kind: "translation-unit",
    id: "tr-bm-01",
    sourceRefs: [{ paper: "brownian-motion", id: "s1-p1" }],
    translator: { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
    lang: "en",
    inlines: [
      { kind: "text", text: "In this paper, " },
      { kind: "term", text: "Wärme", termId: "heat", lang: "de" },
      { kind: "text", text: " is investigated." },
    ],
  });

  const { context, reports } = createMockContext(records);
  validateI18nRecords(context);

  assert.equal(reports.length, 0);
});

test("i18n compiler check: missing lang on a translation unit triggers 'lang-required' (check.ts:104)", () => {
  const records = new Map<string, unknown>();
  // 1. Missing lang
  records.set("tr-missing-lang", {
    kind: "translation-unit",
    id: "tr-missing-lang",
    sourceRefs: [{ paper: "brownian-motion", id: "s1-p1" }],
    translator: { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
    inlines: [{ kind: "text", text: "Some text" }],
  });

  // 2. Invalid tag "english"
  records.set("tr-invalid-lang", {
    kind: "translation-unit",
    id: "tr-invalid-lang",
    sourceRefs: [{ paper: "brownian-motion", id: "s1-p1" }],
    translator: { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
    lang: "english",
    inlines: [{ kind: "text", text: "Some text" }],
  });

  const { context, reports } = createMockContext(records);
  validateI18nRecords(context);

  assert.equal(reports.length, 2);
  assert.equal(reports[0]?.recordId, "tr-missing-lang");
  assert.equal(reports[0]?.rule, "lang-required");
  assert.equal(reports[1]?.recordId, "tr-invalid-lang");
  assert.equal(reports[1]?.rule, "lang-required");

  // THE MESSAGES ARE THE ASSERTION THAT PINS check.ts:104, AND THEY WERE MISSING.
  //
  // The missing-lang arm at :104 and the invalid-tag arm at :112 are the two halves of
  // one if/else-if, and they emit the SAME rule, the SAME path and the SAME recordId.
  // Measured by neutralising :104 alone: the record falls through to :112, which reports
  // `has invalid BCP 47 language tag "undefined"` - one report, same rule, same recordId,
  // same count. Every assertion above survived that substitution, so this test passed
  // whether or not :104 existed at all, and the refusal scanner was right to leave the
  // site uncredited.
  //
  // Only the message separates the two arms, so only the message can pin them.
  assert.equal(
    reports[0]?.message,
    'TranslationUnit "tr-missing-lang" is missing required "lang" field.',
  );
  assert.equal(
    reports[1]?.message,
    'TranslationUnit "tr-invalid-lang" has invalid BCP 47 language tag "english".',
  );
});

test("i18n compiler check: German term in English text without lang='de' triggers 'lang-required' (check.ts:74)", () => {
  const records = new Map<string, unknown>();
  records.set("tr-german-term-unannotated", {
    kind: "translation-unit",
    id: "tr-german-term-unannotated",
    sourceRefs: [{ paper: "brownian-motion", id: "s1-p1" }],
    translator: { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
    lang: "en",
    inlines: [
      { kind: "text", text: "The concept of " },
      { kind: "term", text: "Gedankenexperiment", termId: "thought-experiment" }, // Missing lang: "de"
      { kind: "text", text: " was central to Einstein's reasoning." },
    ],
  });

  const { context, reports } = createMockContext(records);
  validateI18nRecords(context);

  assert.equal(reports.length, 1);
  assert.equal(reports[0]?.recordId, "tr-german-term-unannotated");
  assert.equal(reports[0]?.rule, "lang-required");
  assert.match(reports[0]?.message ?? "", /requires lang="de"/);
});

test("i18n compiler check: invalid BCP 47 sourceLang on GlossUnit triggers report", () => {
  const records = new Map<string, unknown>();
  records.set("gloss-bad-lang", {
    kind: "gloss-unit",
    sentenceId: "s1-p1-s1",
    tokens: [{ german: "Wärme" }],
    sourceRevision: 1,
    sourceLang: "deutsch",
    lang: "en",
  });

  const { context, reports } = createMockContext(records);
  validateI18nRecords(context);

  assert.equal(reports.length, 1);
  assert.equal(reports[0]?.recordId, "gloss-bad-lang");
  assert.equal(reports[0]?.rule, "lang-required");
  assert.equal(reports[0]?.path, "sourceLang");
});
