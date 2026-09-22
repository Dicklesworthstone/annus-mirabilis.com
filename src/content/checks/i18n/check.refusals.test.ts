/**
 * Refusal throw site test suite for check.ts (am-muyh).
 *
 * Covers lines 60, 112, 131, 140, 156, and 170 in src/content/checks/i18n/check.ts
 * with authentic accept/reject test pairs, asserting explicit refusal codes
 * and messages, with exact line citations.
 *
 * All eight sites in check.ts carry ONE code, `lang-required`, so under am-ksl3 a block
 * that merely names the code credits nothing and only the (check.ts:LINE) citations
 * above earn credit. The message is therefore load-bearing in every case here: it is
 * the only field that separates one arm from another, and two arms of the same if/else
 * are indistinguishable without it (see check.ts:104 in check.test.ts).
 *
 * The remaining two sites live in check.test.ts, the node lane: :74 (German term) and
 * :104 (missing lang). Running only this file measures five of the eight.
 *
 * Zero mocks are used.
 */
import { describe, expect, test } from "bun:test";
import type { CheckContext, CheckReportItem } from "../../compiler/checks/registry.ts";
import { validateI18nRecords } from "./check.ts";

function createCheckContext(records: Map<string, unknown>): {
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

describe("check.ts refusal throw sites (am-muyh)", () => {
  // --------------------------------------------------------------------------
  // Site 0: line 60 - lang-required (inline language override, invalid tag)
  //
  // The only arm reached through checkInlinesForI18n rather than from the record loop,
  // and the one stated requirement in this module's own docblock ("Rejects inline
  // overrides with an invalid BCP 47 tag") that had no test. Driving it needs a VALID
  // record carrying an INVALID inline, so the reject case below is also a control: if
  // the record-level arms fired, there would be more than one report.
  // --------------------------------------------------------------------------
  test("rejects an inline whose lang override is not a valid BCP 47 tag (check.ts:60)", () => {
    // Reject
    const badRecords = new Map<string, unknown>();
    badRecords.set("tr-inline-bad-lang", {
      kind: "translation-unit",
      id: "tr-inline-bad-lang",
      sourceRefs: [{ paper: "brownian-motion", id: "s1-p1" }],
      translator: { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
      lang: "en",
      inlines: [
        { kind: "text", text: "A phrase " },
        { kind: "text", text: "tagged wrongly", lang: "not_a_tag!" },
      ],
    });
    const { context: badCtx, reports: badReports } = createCheckContext(badRecords);
    validateI18nRecords(badCtx);

    expect(badReports.length).toBe(1);
    expect(badReports[0]?.rule).toBe("lang-required");
    expect(badReports[0]?.recordId).toBe("tr-inline-bad-lang");
    // The indexed path is what shows the report came from the inline walk and not from
    // one of the record-level arms, all of which report a bare "lang".
    expect(badReports[0]?.path).toBe("inlines[1].lang");
    expect(badReports[0]?.message).toBe(
      'Invalid BCP 47 language tag "not_a_tag!" on inline element.',
    );

    // Accept: same record, same shape, a valid override on the same inline.
    const goodRecords = new Map<string, unknown>();
    goodRecords.set("tr-inline-good-lang", {
      kind: "translation-unit",
      id: "tr-inline-good-lang",
      sourceRefs: [{ paper: "brownian-motion", id: "s1-p1" }],
      translator: { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
      lang: "en",
      inlines: [
        { kind: "text", text: "A phrase " },
        { kind: "text", text: "korrekt ausgezeichnet", lang: "de" },
      ],
    });
    const { context: goodCtx, reports: goodReports } = createCheckContext(goodRecords);
    validateI18nRecords(goodCtx);
    expect(goodReports.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Site 1: line 112 - lang-required (TranslationUnit invalid lang)
  // --------------------------------------------------------------------------
  test("rejects TranslationUnit with invalid BCP 47 lang tag (check.ts:112)", () => {
    // Reject
    const badRecords = new Map<string, unknown>();
    badRecords.set("tr-invalid-tag", {
      kind: "translation-unit",
      id: "tr-invalid-tag",
      sourceRefs: [{ paper: "brownian-motion", id: "s1-p1" }],
      translator: { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
      lang: "invalid_lang_tag!",
    });
    const { context: badCtx, reports: badReports } = createCheckContext(badRecords);
    validateI18nRecords(badCtx);

    expect(badReports.length).toBe(1);
    expect(badReports[0]?.rule).toBe("lang-required");
    expect(badReports[0]?.path).toBe("lang");
    expect(badReports[0]?.recordId).toBe("tr-invalid-tag");
    expect(badReports[0]?.message).toBe(
      'TranslationUnit "tr-invalid-tag" has invalid BCP 47 language tag "invalid_lang_tag!".',
    );

    // Accept
    const goodRecords = new Map<string, unknown>();
    goodRecords.set("tr-valid-tag", {
      kind: "translation-unit",
      id: "tr-valid-tag",
      sourceRefs: [{ paper: "brownian-motion", id: "s1-p1" }],
      translator: { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
      lang: "en",
    });
    const { context: goodCtx, reports: goodReports } = createCheckContext(goodRecords);
    validateI18nRecords(goodCtx);
    expect(goodReports.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Site 2: line 131 - lang-required (GlossUnit invalid lang)
  // --------------------------------------------------------------------------
  test("rejects GlossUnit with invalid BCP 47 lang tag (check.ts:131)", () => {
    // Reject
    const badRecords = new Map<string, unknown>();
    badRecords.set("gl-invalid-tag", {
      kind: "gloss-unit",
      id: "gl-invalid-tag",
      sentenceId: "sent-01",
      tokens: [],
      sourceRevision: 1,
      lang: "bad_bcp47_tag",
      sourceLang: "de",
    });
    const { context: badCtx, reports: badReports } = createCheckContext(badRecords);
    validateI18nRecords(badCtx);

    expect(badReports.length).toBe(1);
    expect(badReports[0]?.rule).toBe("lang-required");
    expect(badReports[0]?.path).toBe("lang");
    expect(badReports[0]?.recordId).toBe("gl-invalid-tag");
    expect(badReports[0]?.message).toBe(
      'GlossUnit "gl-invalid-tag" has invalid BCP 47 language tag "bad_bcp47_tag".',
    );

    // Accept
    const goodRecords = new Map<string, unknown>();
    goodRecords.set("gl-valid-tag", {
      kind: "gloss-unit",
      id: "gl-valid-tag",
      sentenceId: "sent-01",
      tokens: [],
      sourceRevision: 1,
      lang: "en",
      sourceLang: "de",
    });
    const { context: goodCtx, reports: goodReports } = createCheckContext(goodRecords);
    validateI18nRecords(goodCtx);
    expect(goodReports.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Site 3: line 140 - lang-required (GlossUnit invalid sourceLang)
  // --------------------------------------------------------------------------
  test("rejects GlossUnit with invalid BCP 47 sourceLang tag (check.ts:140)", () => {
    // Reject
    const badRecords = new Map<string, unknown>();
    badRecords.set("gl-invalid-source-tag", {
      kind: "gloss-unit",
      id: "gl-invalid-source-tag",
      sentenceId: "sent-01",
      tokens: [],
      sourceRevision: 1,
      lang: "en",
      sourceLang: "bad_sourcelang_tag",
    });
    const { context: badCtx, reports: badReports } = createCheckContext(badRecords);
    validateI18nRecords(badCtx);

    expect(badReports.length).toBe(1);
    expect(badReports[0]?.rule).toBe("lang-required");
    expect(badReports[0]?.path).toBe("sourceLang");
    expect(badReports[0]?.recordId).toBe("gl-invalid-source-tag");
    expect(badReports[0]?.message).toBe(
      'GlossUnit "gl-invalid-source-tag" has invalid BCP 47 sourceLang "bad_sourcelang_tag".',
    );

    // Accept
    const goodRecords = new Map<string, unknown>();
    goodRecords.set("gl-valid-source-tag", {
      kind: "gloss-unit",
      id: "gl-valid-source-tag",
      sentenceId: "sent-01",
      tokens: [],
      sourceRevision: 1,
      lang: "en",
      sourceLang: "de",
    });
    const { context: goodCtx, reports: goodReports } = createCheckContext(goodRecords);
    validateI18nRecords(goodCtx);
    expect(goodReports.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Site 4: line 156 - lang-required (SourceBlock invalid lang)
  // --------------------------------------------------------------------------
  test("rejects SourceBlock with invalid BCP 47 lang tag (check.ts:156)", () => {
    // Reject
    const badRecords = new Map<string, unknown>();
    badRecords.set("sb-invalid-tag", {
      kind: "paragraph",
      id: "sb-invalid-tag",
      locators: ["p1"],
      diplomaticText: "Text",
      lang: "invalid_german_lang!",
    });
    const { context: badCtx, reports: badReports } = createCheckContext(badRecords);
    validateI18nRecords(badCtx);

    expect(badReports.length).toBe(1);
    expect(badReports[0]?.rule).toBe("lang-required");
    expect(badReports[0]?.path).toBe("lang");
    expect(badReports[0]?.recordId).toBe("sb-invalid-tag");
    expect(badReports[0]?.message).toBe(
      'SourceBlock "sb-invalid-tag" has invalid BCP 47 language tag "invalid_german_lang!".',
    );

    // Accept
    const goodRecords = new Map<string, unknown>();
    goodRecords.set("sb-valid-tag", {
      kind: "paragraph",
      id: "sb-valid-tag",
      locators: ["p1"],
      diplomaticText: "Text",
      lang: "de",
    });
    const { context: goodCtx, reports: goodReports } = createCheckContext(goodRecords);
    validateI18nRecords(goodCtx);
    expect(goodReports.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Site 5: line 170 - lang-required (General text record invalid lang)
  // --------------------------------------------------------------------------
  test("rejects general text record with invalid BCP 47 lang tag (check.ts:170)", () => {
    // Reject
    const badRecords = new Map<string, unknown>();
    badRecords.set("rec-general-invalid", {
      kind: "custom-note",
      id: "rec-general-invalid",
      lang: "invalid_custom_lang@",
    });
    const { context: badCtx, reports: badReports } = createCheckContext(badRecords);
    validateI18nRecords(badCtx);

    expect(badReports.length).toBe(1);
    expect(badReports[0]?.rule).toBe("lang-required");
    expect(badReports[0]?.path).toBe("lang");
    expect(badReports[0]?.recordId).toBe("rec-general-invalid");
    expect(badReports[0]?.message).toBe(
      'Record "rec-general-invalid" has invalid BCP 47 language tag "invalid_custom_lang@".',
    );

    // Accept
    const goodRecords = new Map<string, unknown>();
    goodRecords.set("rec-general-valid", {
      kind: "custom-note",
      id: "rec-general-valid",
      lang: "fr",
    });
    const { context: goodCtx, reports: goodReports } = createCheckContext(goodRecords);
    validateI18nRecords(goodCtx);
    expect(goodReports.length).toBe(0);
  });
});
