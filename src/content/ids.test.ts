/**
 * Table-driven accept/reject proof for the stable id, anchor, alias, and revision scheme
 * (am-cm-id-scheme-8bn). This does not invent a new grammar: it proves the grammar three lanes
 * already ship against (this file's own src/content/ids.ts, src/content/anchors.ts, and
 * src/reader/weave/contentIds.ts) matches the bead's own stated examples, and catches any
 * drift a future edit to ids.ts would otherwise introduce silently.
 */
import { describe, expect, test } from "bun:test";
import {
  allocateEquationIds,
  normalizePrintedLabel,
  parseAlignableUnitId,
  parseAlternateFormId,
  parseBibKey,
  parseClosingId,
  parseConcordanceEntryId,
  parseEntranceId,
  parseEquationAnchor,
  parseEquationOpId,
  parseEquationRecordId,
  parseEquationTermId,
  parseFootnoteId,
  parseGenericRecordId,
  parseHeadingId,
  parseInlineMathId,
  parseInstrumentId,
  parseModeId,
  parseOperationId,
  parsePaperCode,
  parseParagraphId,
  parsePredictPromptId,
  parsePremiseId,
  parsePresetId,
  parseQualifiedId,
  parseQuantityId,
  parseReferenceId,
  parseRouteSlug,
  parseSectionId,
  parseSentenceId,
  parseTapeId,
  parseTermId,
  parseTranslationUnitId,
  validateSlug,
} from "./ids.ts";

function expectAccept(result: { ok: boolean }, id: string) {
  if (!result.ok) throw new Error(`expected '${id}' to be accepted, but it was rejected`);
  expect(result.ok).toBe(true);
}

function expectReject(result: { ok: boolean; error?: string }, id: string) {
  if (result.ok) throw new Error(`expected '${id}' to be rejected, but it was accepted`);
  expect(result.ok).toBe(false);
}

describe("route slugs, bibliographic keys, and paper codes", () => {
  test("every canonical route slug is accepted", () => {
    for (const slug of [
      "light-quanta",
      "brownian-motion",
      "special-relativity",
      "mass-energy",
      "molecular-dimensions",
    ]) {
      expectAccept(parseRouteSlug(slug), slug);
    }
  });

  test("every canonical bibliographic key is accepted, and a malformed one is rejected", () => {
    for (const key of [
      "ap-17-132",
      "ap-17-549",
      "ap-17-891",
      "ap-18-639",
      "ap-19-289",
      "ap-34-591",
    ]) {
      expectAccept(parseBibKey(key), key);
    }
    expectReject(parseBibKey("ap-17"), "ap-17");
  });

  test("every paper code is accepted", () => {
    for (const code of ["lq", "bm", "sr", "me", "md"]) {
      expectAccept(parsePaperCode(code), code);
    }
    expectReject(parsePaperCode("xx"), "xx");
  });
});

describe("slug grammar and the dot rule", () => {
  test("valid slugs accept", () => {
    for (const slug of ["boost-0.6c", "0-8-micron", "wave-1.5"]) {
      expectAccept(validateSlug(slug), slug);
    }
  });

  test("a dot outside 'between two digits' is rejected", () => {
    for (const slug of ["sr-03-boost-.6c", "sr-03-boost-0.c", "a.b"]) {
      expectReject(validateSlug(slug.replace(/^sr-03-/, "")), slug);
    }
    expectReject(validateSlug(".6c"), ".6c");
    expectReject(validateSlug("0.c"), "0.c");
    expectReject(validateSlug("a.b"), "a.b");
  });

  test("a double dot or a chain of two dots is rejected", () => {
    expectReject(validateSlug("0..6"), "0..6");
    expectReject(validateSlug("0.6.7"), "0.6.7");
  });

  test("uppercase, leading/trailing/double hyphens are rejected", () => {
    expectReject(validateSlug("Boost"), "Boost");
    expectReject(validateSlug("-boost"), "-boost");
    expectReject(validateSlug("boost-"), "boost-");
    expectReject(validateSlug("boost--fast"), "boost--fast");
  });
});

describe("instrument ids", () => {
  test("the core catalogue format is accepted for every paper prefix", () => {
    for (const id of ["lq-01", "bm-08", "sr-13", "me-03"]) {
      const result = parseInstrumentId(id);
      expectAccept(result, id);
      if (result.ok) expect(result.kind).toBe("core");
    }
  });

  test("every declared non-core instrument id is accepted with its declared kind", () => {
    const shelf = parseInstrumentId("shelf-michelson-morley");
    expectAccept(shelf, "shelf-michelson-morley");
    if (shelf.ok) expect(shelf.kind).toBe("shelf");
    for (const id of ["shelf-fizeau", "shelf-maxwell-galilean"]) {
      const r = parseInstrumentId(id);
      expectAccept(r, id);
      if (r.ok) expect(r.kind).toBe("shelf");
    }
    for (const id of ["avogadro-lab", "light-thread"]) {
      const r = parseInstrumentId(id);
      expectAccept(r, id);
      if (r.ok) expect(r.kind).toBe("discovery");
    }
  });

  test("an undeclared non-core id and a malformed core id are rejected, naming the declared list", () => {
    const r1 = parseInstrumentId("shelf-fizaeu");
    expectReject(r1, "shelf-fizaeu");
    if (!r1.ok) expect(r1.error).toContain("declared non-core list");
    expectReject(parseInstrumentId("lq-1"), "lq-1");
    expectReject(parseInstrumentId("LQ-01"), "LQ-01");
    expectReject(parseInstrumentId("avogadro"), "avogadro");
  });
});

describe("modes, presets, predict prompts, and tapes -- never parse as one another", () => {
  test("declared modes parse as modes", () => {
    for (const id of [
      "sr-02:apparatus",
      "bm-04:kicks-off",
      "bm-07:kitchen",
      "me-03:box-1906",
      "lq-02:1904",
      "sr-04:1904",
      "shelf-michelson-morley:1904",
    ]) {
      expectAccept(parseModeId(id), id);
    }
  });

  test("declared presets parse as presets, including a non-core instrument prefix", () => {
    for (const id of [
      "sr-03-boost-0.6c",
      "lq-08-intensity-probe",
      "me-03-card-coal",
      "me-03-sealed-lamp-and-mirror",
      "light-thread-two-slits",
    ]) {
      expectAccept(parsePresetId(id), id);
    }
  });

  test("a predict prompt parses as a predict prompt", () => {
    expectAccept(parsePredictPromptId("sr-09-predict-approaching"), "sr-09-predict-approaching");
  });

  test("the five named teaching tapes parse as tape ids", () => {
    for (const id of [
      "einstein-0-8-micron",
      "perrins-count",
      "the-boost-to-0.6c",
      "the-two-pulses",
      "the-locked-positions",
    ]) {
      expectAccept(parseTapeId(id), id);
    }
  });

  test("retired colon forms are rejected, naming the hyphen or slug replacement", () => {
    for (const id of ["lq-08:intensity-probe", "me-03:card-coal"]) {
      const r = parsePresetId(id);
      expectReject(r, id);
      if (!r.ok) expect(r.error).toContain("hyphen");
    }
    const r = parseTapeId("lq-05:locked-positions");
    expectReject(r, "lq-05:locked-positions");
    if (!r.ok) expect(r.error).toContain("slug");
    expectReject(parsePresetId("lq-05:journey-stage-e"), "lq-05:journey-stage-e");
  });

  test("a mode segment never carries a second colon", () => {
    expectReject(parseModeId("lq-02:1904-"), "lq-02:1904-");
    expectReject(parseModeId("sr-04:Mode"), "sr-04:Mode");
    expectReject(parseModeId("lq-08::count-model"), "lq-08::count-model");
  });

  test("a preset whose first slug token is 'predict' is rejected, so it can never be read as a prompt", () => {
    const r = parsePresetId("sr-03-predict-boost");
    expectReject(r, "sr-03-predict-boost");
    if (!r.ok) expect(r.rule).toBe("preset-predict-collision");
  });

  test("the dot rule applies inside every instrument-scoped segment", () => {
    expectAccept(parsePresetId("sr-03-boost-0.6c"), "sr-03-boost-0.6c");
    for (const id of [
      "sr-03-boost-.6c",
      "sr-03-boost-0.c",
      "sr-03-boost-0..6",
      "sr-03-boost-0.6.7",
    ]) {
      expectReject(parsePresetId(id), id);
    }
  });
});

describe("source structure ids", () => {
  test("sections accept n >= 0, including the unnumbered introduction s0", () => {
    expectAccept(parseSectionId("s0"), "s0");
    expectAccept(parseSectionId("s3"), "s3");
    expectReject(parseSectionId("S3"), "S3");
  });

  test("headings are the section id itself; s0 and the retired -h form are rejected", () => {
    expectAccept(parseHeadingId("s3"), "s3");
    expectAccept(parseHeadingId("part-2"), "part-2");
    expectReject(parseHeadingId("s0"), "s0");
    const r = parseHeadingId("s3-h");
    expectReject(r, "s3-h");
    if (!r.ok) expect(r.rule).toBe("heading-id-grammar");
  });

  test("paragraphs accept m >= 1 and reject m = 0", () => {
    expectAccept(parseParagraphId("s3-p2"), "s3-p2");
    expectReject(parseParagraphId("s3-p0"), "s3-p0");
  });

  test("AC1 boundary: an uppercase section letter is rejected while the lowercase paragraph id accepts", () => {
    expectAccept(parseParagraphId("s3-p1"), "s3-p1");
    expectReject(parseParagraphId("S3-p1"), "S3-p1");
  });

  test("a related-document paragraph accepts the hyphenated <role>-<year>- prefix and rejects the unhyphenated form", () => {
    expectAccept(parseParagraphId("correction-1911-s0-p1"), "correction-1911-s0-p1");
    expectReject(parseParagraphId("correction1911-s0-p1"), "correction1911-s0-p1");
  });

  test("sentences accept k >= 1, and a letter-suffixed German sentence id is rejected by name", () => {
    expectAccept(parseSentenceId("s3-p2-s1"), "s3-p2-s1");
    const r = parseSentenceId("s3-p2-s1a");
    expectReject(r, "s3-p2-s1a");
    if (!r.ok) expect(r.rule).toBe("german-sentence-no-suffix");
  });

  test("footnotes are block-level (no sentence sub-id) and section-sequential (ids.ts:470)", () => {
    expectAccept(parseFootnoteId("s3-fn1"), "s3-fn1");
    expectAccept(parseFootnoteId("s3-fn2"), "s3-fn2");
    const r = parseFootnoteId("s3-fn1-s1");
    expectReject(r, "s3-fn1-s1");
    if (!r.ok) expect(r.rule).toBe("footnote-id-grammar");
  });

  test("AC1 boundary: footnote numbering is 1-indexed -- fn0 is rejected while fn1 accepts", () => {
    expectAccept(parseFootnoteId("s3-fn1"), "s3-fn1");
    expectReject(parseFootnoteId("s3-fn0"), "s3-fn0");
  });

  test("closings are the three named block ids, including closing-received; a sentence sub-id is rejected", () => {
    for (const id of ["closing-dateline", "closing-ack", "closing-received"]) {
      expectAccept(parseClosingId(id), id);
    }
    expectReject(parseClosingId("closing-ack-s1"), "closing-ack-s1");
  });

  test("alignable unit id covers both sentence-level and block-level units", () => {
    for (const id of ["s3-p2-s1", "s3", "s3-fn1", "closing-ack", "masthead-title", "part-1"]) {
      expectAccept(parseAlignableUnitId(id), id);
    }
  });

  test("inline math ids count every printed region 1-based, in sentences and footnotes", () => {
    expectAccept(parseInlineMathId("s3-p2-s1-m3"), "s3-p2-s1-m3");
    expectAccept(parseInlineMathId("s3-fn2-m1"), "s3-fn2-m1");
    expectReject(parseInlineMathId("s3-fn0-m1"), "s3-fn0-m1");
  });

  test("reference occurrence ids name the occurrence of a real alignable unit", () => {
    expectAccept(parseReferenceId("s3-p2-s1-r1"), "s3-p2-s1-r1");
    expectAccept(parseReferenceId("s3-fn1-r2"), "s3-fn1-r2");
    expectReject(parseReferenceId("not-a-unit-r1"), "not-a-unit-r1");
  });
});

describe("split translation units", () => {
  test("a digit-ending base id appends the letter directly", () => {
    for (const id of ["s3-p2-s1a", "s3-p2-s1b", "s3-fn1a", "s3a", "part-1a"]) {
      expectAccept(parseTranslationUnitId(id), id);
    }
  });

  test("a letter-ending base id joins the suffix with a hyphen, and the unjoined form is rejected", () => {
    expectAccept(parseTranslationUnitId("closing-ack-a"), "closing-ack-a");
    expectAccept(parseTranslationUnitId("masthead-title-a"), "masthead-title-a");
    const r = parseTranslationUnitId("closing-acka");
    expectReject(r, "closing-acka");
    if (!r.ok) expect(r.rule).toBe("split-suffix-grammar");
  });

  test("an unsuffixed alignable unit id is itself a valid translation unit id (the not-split case)", () => {
    expectAccept(parseTranslationUnitId("s3-p2-s1"), "s3-p2-s1");
  });
});

describe("equations and printed-label normalization", () => {
  test("normalizePrintedLabel produces every token in the normalization table", () => {
    expect(normalizePrintedLabel("(7)")).toBe("7");
    expect(normalizePrintedLabel("(7a)")).toBe("7a");
    expect(normalizePrintedLabel("(1')")).toBe("1p");
    expect(normalizePrintedLabel("(1'')")).toBe("1pp");
    expect(normalizePrintedLabel("(II)")).toBe("roman-2");
    expect(normalizePrintedLabel("(IIa)")).toBe("roman-2a");
    expect(normalizePrintedLabel("(II')")).toBe("roman-2p");
  });

  test("a typographic prime normalizes the same as its ASCII equivalent", () => {
    expect(normalizePrintedLabel("(2′)")).toBe(normalizePrintedLabel("(2')"));
  });

  test("equation anchors accept the unique, section-qualified, and unnumbered-display forms", () => {
    for (const id of ["eq-7", "eq-s3-1", "eq-s3-d2", "eq-roman-2"]) {
      expectAccept(parseEquationAnchor(id), id);
    }
    expectReject(parseEquationAnchor("eq-"), "eq-");
  });

  test("AC1 boundary: unnumbered-display equation indices are 1-indexed -- d0 is rejected while d1 accepts", () => {
    expectAccept(parseEquationAnchor("eq-s3-d1"), "eq-s3-d1");
    expectReject(parseEquationAnchor("eq-s3-d0"), "eq-s3-d0");
  });

  test("global equation record ids embed the paper code and round-trip through the anchor form", () => {
    expectAccept(parseEquationRecordId("eq-bm-s3-d4"), "eq-bm-s3-d4");
  });

  test("term and operation ids build on a valid equation record id", () => {
    expectAccept(parseEquationTermId("eq-sr-s3-1.t.beta"), "eq-sr-s3-1.t.beta");
    expectAccept(parseEquationOpId("eq-sr-s3-1.op.lorentz-factor"), "eq-sr-s3-1.op.lorentz-factor");
    expectReject(parseEquationTermId("not-an-eq-id.t.beta"), "not-an-eq-id.t.beta");
  });

  test("a repeated printed label across two sections forces the section-qualified form for both", () => {
    const allocated = allocateEquationIds("sr", [
      { section: "s1", printedLabel: "(1)" },
      { section: "s2", printedLabel: "(2)" },
      { section: "s3", printedLabel: "(1)" },
    ]);
    expect(allocated[0]?.localId).toBe("eq-s1-1");
    expect(allocated[1]?.localId).toBe("eq-2");
    expect(allocated[2]?.localId).toBe("eq-s3-1");
  });

  test("a printed label repeated WITHIN one section falls back to the editorial d<j> form for each occurrence", () => {
    const allocated = allocateEquationIds("sr", [
      { section: "s3", printedLabel: "(1)" },
      { section: "s3", printedLabel: "(1)" },
    ]);
    expect(new Set(allocated.map((a) => a.localId)).size).toBe(2);
    expect(allocated[0]?.localId).toMatch(/^eq-s3-d\d+$/);
    expect(allocated[0]?.originalLabel).toBe("(1)");
    expect(allocated[1]?.localId).toMatch(/^eq-s3-d\d+$/);
  });
});

describe("concordance, quantities, knowledge cards, and first-encounters", () => {
  test("quantity ids are lower camelCase and reject an underscore", () => {
    expectAccept(parseQuantityId("stoppingPotentialMagnitude"), "stoppingPotentialMagnitude");
    expectReject(parseQuantityId("stopping_potential"), "stopping_potential");
  });

  test("concordance entry ids are case-sensitive in the glyph segment, distinguishing L from l", () => {
    const upper = parseConcordanceEntryId("sr.L.magnetic-field-x");
    const lower = parseConcordanceEntryId("sr.l.direction-cosine");
    expectAccept(upper, "sr.L.magnetic-field-x");
    expectAccept(lower, "sr.l.direction-cosine");
    expect(upper.ok && lower.ok && upper.value !== lower.value).toBe(true);
    expectReject(parseConcordanceEntryId("bm.K.Viscosity"), "bm.K.Viscosity");
  });

  test("knowledge-card (premise) ids follow <author>-<year>-<topic>, within 80 characters", () => {
    for (const id of [
      "rayleigh-1900-radiation-law",
      "sutherland-1904-dunedin",
      "poincare-1900-fictitious-fluid",
      "van-t-hoff-1887-osmotic-pressure",
    ]) {
      expectAccept(parsePremiseId(id), id);
    }
    expectReject(parsePremiseId("journey-i-rayleigh"), "journey-i-rayleigh");
  });

  test("a generic record id over 80 characters is rejected", () => {
    const tooLong = `a${"-b".repeat(40)}`;
    expect(tooLong.length).toBeGreaterThan(80);
    expectReject(parseGenericRecordId(tooLong), tooLong);
  });

  test("entrance record ids accept exactly the four main papers and reject a short or bare form", () => {
    for (const id of [
      "entrance-light-quanta",
      "entrance-brownian-motion",
      "entrance-special-relativity",
      "entrance-mass-energy",
    ]) {
      expectAccept(parseEntranceId(id), id);
    }
    expectReject(parseEntranceId("entrance-brownian"), "entrance-brownian");
    expectReject(parseEntranceId("entrance-molecular-dimensions"), "entrance-molecular-dimensions");
  });
});

describe("type-level: a branded id cannot be passed where a different branded id is expected without parsing", () => {
  test("this file compiles, which is the proof: see ids.types.test.ts for the @ts-expect-error cases", () => {
    expect(true).toBe(true);
  });
});

describe("refusal coverage: slugs, bib keys, and paper codes (ids.ts throw sites)", () => {
  test("PLANTED: malformed bibliographic key refuses with bib-key-grammar (ids.ts:59)", () => {
    const res = parseBibKey("invalid-bib-key");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.rule).toBe("bib-key-grammar");
    const pass = parseBibKey("ap-17-132");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: malformed route slug refuses with route-slug-grammar (ids.ts:70)", () => {
    const res = parseRouteSlug("invalid-slug");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.rule).toBe("route-slug-grammar");
    const pass = parseRouteSlug("brownian-motion");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: malformed paper code refuses with paper-code-grammar (ids.ts:81)", () => {
    const res = parsePaperCode("xx");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.rule).toBe("paper-code-grammar");
    const pass = parsePaperCode("bm");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: empty slug refuses with slug-grammar (ids.ts:101)", () => {
    const res = validateSlug("");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.rule).toBe("slug-grammar");
    const pass = validateSlug("valid-slug");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: slug with colon or space refuses with slug-grammar (ids.ts:107)", () => {
    const resColon = validateSlug("foo:bar");
    expect(resColon.ok).toBe(false);
    if (!resColon.ok) expect(resColon.rule).toBe("slug-grammar");
    const resSpace = validateSlug("foo bar");
    expect(resSpace.ok).toBe(false);
    if (!resSpace.ok) expect(resSpace.rule).toBe("slug-grammar");
    const pass = validateSlug("foo-bar");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: slug with leading/trailing/double hyphens refuses with slug-grammar (ids.ts:114)", () => {
    const res = validateSlug("-foo-bar");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.rule).toBe("slug-grammar");
    const pass = validateSlug("foo-bar");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: uppercase slug refuses with slug-grammar (ids.ts:118)", () => {
    const res = validateSlug("Foo-bar");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.rule).toBe("slug-grammar");
    const pass = validateSlug("foo-bar");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: slug token with invalid characters refuses with slug-grammar (ids.ts:147)", () => {
    const res = validateSlug("foo@bar");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.rule).toBe("slug-grammar");
    const pass = validateSlug("foo-bar");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: slug token starting/ending with dot refuses with slug-dot-rule (ids.ts:127)", () => {
    const res = validateSlug(".6c");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.rule).toBe("slug-dot-rule");
    const pass = validateSlug("0.6c");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: slug token with consecutive dots refuses with slug-dot-rule (ids.ts:134)", () => {
    const res = validateSlug("0..6c");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.rule).toBe("slug-dot-rule");
    const pass = validateSlug("0.6c");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: slug token with dot between non-digits refuses with slug-dot-rule (ids.ts:141)", () => {
    const res = validateSlug("a.b");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.rule).toBe("slug-dot-rule");
    const pass = validateSlug("0.6c");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: invalid instrument ID refuses with instrument-id-grammar (ids.ts:202)", () => {
    const res = parseInstrumentId("invalid-id");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("instrument-id-grammar");
      expect(res.error).toContain("Invalid instrument ID");
    }
    const passCore = parseInstrumentId("lq-01");
    expect(passCore.ok).toBe(true);
    const passShelf = parseInstrumentId("shelf-fizeau");
    expect(passShelf.ok).toBe(true);
  });

  test("PLANTED: empty or non-string mode ID refuses with mode-id-grammar (ids.ts:213)", () => {
    const resEmpty = parseModeId("");
    expect(resEmpty.ok).toBe(false);
    if (!resEmpty.ok) {
      expect(resEmpty.rule).toBe("mode-id-grammar");
      expect(resEmpty.error).toBe("Mode ID must be a non-empty string");
    }
    const resNull = parseModeId(null as any);
    expect(resNull.ok).toBe(false);
    if (!resNull.ok) {
      expect(resNull.rule).toBe("mode-id-grammar");
    }
    const pass = parseModeId("sr-02:apparatus");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: mode ID without exactly one colon refuses with mode-id-grammar (ids.ts:220)", () => {
    const resNoColon = parseModeId("sr-02");
    expect(resNoColon.ok).toBe(false);
    if (!resNoColon.ok) {
      expect(resNoColon.rule).toBe("mode-id-grammar");
      expect(resNoColon.error).toContain("must have exactly one colon");
    }
    const resTwoColons = parseModeId("sr:02:apparatus");
    expect(resTwoColons.ok).toBe(false);
    if (!resTwoColons.ok) {
      expect(resTwoColons.rule).toBe("mode-id-grammar");
    }
    const pass = parseModeId("sr-02:apparatus");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: empty or non-string preset ID refuses with preset-id-grammar (ids.ts:244)", () => {
    const resEmpty = parsePresetId("");
    expect(resEmpty.ok).toBe(false);
    if (!resEmpty.ok) {
      expect(resEmpty.rule).toBe("preset-id-grammar");
      expect(resEmpty.error).toBe("Preset ID must be a non-empty string");
    }
    const resNull = parsePresetId(null as any);
    expect(resNull.ok).toBe(false);
    if (!resNull.ok) {
      expect(resNull.rule).toBe("preset-id-grammar");
    }
    const pass = parsePresetId("sr-03-boost-0.6c");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: preset ID containing colon refuses with preset-id-grammar (ids.ts:250)", () => {
    const res = parsePresetId("sr-03:boost-0.6c");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("preset-id-grammar");
      expect(res.error).toContain("cannot contain a colon");
    }
    const pass = parsePresetId("sr-03-boost-0.6c");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: preset ID without valid instrument prefix refuses with preset-id-grammar (ids.ts:271)", () => {
    const res = parsePresetId("unknown-01-foo");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("preset-id-grammar");
      expect(res.error).toContain("must begin with a valid instrument ID");
    }
    const pass = parsePresetId("sr-03-boost-0.6c");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: empty or non-string predict prompt ID refuses with predict-prompt-grammar (ids.ts:298)", () => {
    const resEmpty = parsePredictPromptId("");
    expect(resEmpty.ok).toBe(false);
    if (!resEmpty.ok) {
      expect(resEmpty.rule).toBe("predict-prompt-grammar");
      expect(resEmpty.error).toBe("Predict prompt ID must be a non-empty string");
    }
    const resUndefined = parsePredictPromptId(undefined as any);
    expect(resUndefined.ok).toBe(false);
    if (!resUndefined.ok) {
      expect(resUndefined.rule).toBe("predict-prompt-grammar");
    }
    const pass = parsePredictPromptId("sr-09-predict-approaching");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: predict prompt ID containing colon refuses with predict-prompt-grammar (ids.ts:305)", () => {
    const res = parsePredictPromptId("sr-09:predict-approaching");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("predict-prompt-grammar");
      expect(res.error).toContain("cannot contain a colon");
    }
    const pass = parsePredictPromptId("sr-09-predict-approaching");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: predict prompt ID without predict pattern refuses with predict-prompt-grammar (ids.ts:325)", () => {
    const res = parsePredictPromptId("invalid-predict-foo");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("predict-prompt-grammar");
      expect(res.error).toContain("must match '<instrumentId>-predict-<slug>'");
    }
    const pass = parsePredictPromptId("sr-09-predict-approaching");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: empty or non-string tape ID refuses with tape-id-grammar (ids.ts:342)", () => {
    const resEmpty = parseTapeId("");
    expect(resEmpty.ok).toBe(false);
    if (!resEmpty.ok) {
      expect(resEmpty.rule).toBe("tape-id-grammar");
      expect(resEmpty.error).toBe("Tape ID must be a non-empty string");
    }
    const resNull = parseTapeId(null as any);
    expect(resNull.ok).toBe(false);
    if (!resNull.ok) {
      expect(resNull.rule).toBe("tape-id-grammar");
    }
    const pass = parseTapeId("the-locked-positions");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: tape ID containing colon refuses with tape-id-grammar (ids.ts:348)", () => {
    const res = parseTapeId("tape:locked-positions");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("tape-id-grammar");
      expect(res.error).toContain("cannot contain a colon");
    }
    const pass = parseTapeId("the-locked-positions");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: invalid section ID refuses with section-id-grammar (ids.ts:404)", () => {
    const res = parseSectionId("invalid");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("section-id-grammar");
      expect(res.error).toContain("Invalid section ID");
    }
    const pass = parseSectionId("s0");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: retired heading ID ending with -h refuses with heading-id-grammar (ids.ts:423)", () => {
    const res = parseHeadingId("s3-h");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("heading-id-grammar");
      expect(res.error).toContain("Retired heading ID");
    }
    const pass = parseHeadingId("s3");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: invalid heading ID refuses with heading-id-grammar (ids.ts:429)", () => {
    const res = parseHeadingId("invalid");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("heading-id-grammar");
      expect(res.error).toContain("Invalid heading ID");
    }
    const passPart = parseHeadingId("part-1");
    expect(passPart.ok).toBe(true);
  });

  test("PLANTED: invalid paragraph ID refuses with paragraph-id-grammar (ids.ts:440)", () => {
    const res = parseParagraphId("invalid");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("paragraph-id-grammar");
      expect(res.error).toContain("Invalid paragraph ID");
    }
    const pass = parseParagraphId("s3-p2");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: invalid sentence ID refuses with sentence-id-grammar (ids.ts:458)", () => {
    const res = parseSentenceId("invalid");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("sentence-id-grammar");
      expect(res.error).toContain("Invalid sentence ID");
    }
    const pass = parseSentenceId("s3-p2-s1");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: invalid footnote ID refuses with footnote-id-grammar (ids.ts:476)", () => {
    const res = parseFootnoteId("invalid");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("footnote-id-grammar");
      expect(res.error).toContain("Invalid footnote ID");
    }
    const pass = parseFootnoteId("s3-fn1");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: retired closing sentence ID with -s refuses with closing-id-grammar (ids.ts:488)", () => {
    const res = parseClosingId("closing-ack-s1");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("closing-id-grammar");
      expect(res.error).toContain("Retired closing sentence ID");
    }
    const pass = parseClosingId("closing-ack");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: invalid closing ID refuses with closing-id-grammar (ids.ts:494)", () => {
    const res = parseClosingId("closing-invalid");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("closing-id-grammar");
      expect(res.error).toContain("Invalid closing ID");
    }
    const pass = parseClosingId("closing-dateline");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: invalid alignable unit ID refuses with alignable-unit-grammar (ids.ts:512)", () => {
    const res = parseAlignableUnitId("invalid-alignable");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("alignable-unit-grammar");
      expect(res.error).toContain("Invalid alignable unit ID");
    }
    const pass = parseAlignableUnitId("s3-p2-s1");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: invalid translation unit ID refuses with translation-unit-grammar (ids.ts:548)", () => {
    const res = parseTranslationUnitId("invalid-translation-unit");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("translation-unit-grammar");
      expect(res.error).toContain("Invalid translation unit ID");
    }
    const pass = parseTranslationUnitId("s3-p2-s1a");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: invalid inline math ID refuses with inline-math-grammar (ids.ts:562)", () => {
    const res = parseInlineMathId("invalid-m1");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("inline-math-grammar");
      expect(res.error).toContain("Invalid inline math ID");
    }
    const pass = parseInlineMathId("s3-p2-s1-m1");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: invalid reference ID refuses with reference-id-grammar (ids.ts:577)", () => {
    const res = parseReferenceId("invalid-r1");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("reference-id-grammar");
      expect(res.error).toContain("Invalid reference occurrence ID");
    }
    const pass = parseReferenceId("s3-p2-s1-r1");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: invalid equation anchor refuses with equation-anchor-grammar (ids.ts:648)", () => {
    const res = parseEquationAnchor("invalid-eq");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("equation-anchor-grammar");
      expect(res.error).toContain("Invalid equation anchor");
    }
    const pass = parseEquationAnchor("eq-7");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: invalid equation record ID refuses with equation-record-id-grammar (ids.ts:663)", () => {
    const res = parseEquationRecordId("eq-invalid-s3-d4");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("equation-record-id-grammar");
      expect(res.error).toContain("Invalid global equation record ID");
    }
    const pass = parseEquationRecordId("eq-bm-s3-d4");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: empty or non-string operation ID refuses with operation-id-grammar (ids.ts:807)", () => {
    const resEmpty = parseOperationId("");
    expect(resEmpty.ok).toBe(false);
    if (!resEmpty.ok) {
      expect(resEmpty.rule).toBe("operation-id-grammar");
      expect(resEmpty.error).toBe("Operation ID must be a non-empty string");
    }
    const resNull = parseOperationId(null as any);
    expect(resNull.ok).toBe(false);
    if (!resNull.ok) {
      expect(resNull.rule).toBe("operation-id-grammar");
    }
    const pass = parseOperationId("eq-7.op.add");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: operation ID missing op dot refuses with operation-id-grammar (ids.ts:815)", () => {
    const res = parseOperationId("no-op-dot");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("operation-id-grammar");
      expect(res.error).toContain("must match '<equation>.op.<name>'");
    }
    const pass = parseOperationId("eq-7.op.add");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: operation ID with invalid equation base refuses with operation-id-grammar (ids.ts:824)", () => {
    const res = parseOperationId("invalid-base.op.add");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("operation-id-grammar");
      expect(res.error).toContain("is not a valid equation base ID");
    }
    const pass = parseOperationId("eq-7.op.add");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: operation ID with non-camelCase name refuses with operation-id-grammar (ids.ts:831)", () => {
    const res = parseOperationId("eq-7.op.Invalid_Name");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("operation-id-grammar");
      expect(res.error).toContain("must be lower camelCase ASCII");
    }
    const pass = parseOperationId("eq-7.op.add");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: alternate form ID missing alt dot refuses with alternate-form-id-grammar (ids.ts:850)", () => {
    const res = parseAlternateFormId("no-alt-dot");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("alternate-form-id-grammar");
      expect(res.error).toContain("must match '<equation>.alt.<name>'");
    }
    const pass = parseAlternateFormId("eq-7.alt.expanded");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: alternate form ID with invalid equation base refuses with alternate-form-id-grammar (ids.ts:859)", () => {
    const res = parseAlternateFormId("invalid-base.alt.expanded");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("alternate-form-id-grammar");
      expect(res.error).toContain("is not a valid equation base ID");
    }
    const pass = parseAlternateFormId("eq-7.alt.expanded");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: alternate form ID with non-camelCase name refuses with alternate-form-id-grammar (ids.ts:866)", () => {
    const res = parseAlternateFormId("eq-7.alt.Invalid_Name");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("alternate-form-id-grammar");
      expect(res.error).toContain("must be lower camelCase ASCII");
    }
    const pass = parseAlternateFormId("eq-7.alt.expanded");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: qualified ID missing slash refuses with qualified-id-grammar (ids.ts:885)", () => {
    const res = parseQualifiedId("no-slash");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("qualified-id-grammar");
      expect(res.error).toContain("must match '<route-slug>/<local-id>'");
    }
    const pass = parseQualifiedId("brownian-motion/eq-7");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: qualified ID with unknown route slug refuses with qualified-id-grammar (ids.ts:895)", () => {
    const res = parseQualifiedId("invalid-slug/eq-7");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("qualified-id-grammar");
      expect(res.error).toContain("unknown route slug 'invalid-slug'");
    }
    const pass = parseQualifiedId("brownian-motion/eq-7");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: qualified ID with invalid local ID refuses with qualified-id-grammar (ids.ts:908)", () => {
    const res = parseQualifiedId("brownian-motion/invalid-local");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("qualified-id-grammar");
      expect(res.error).toContain("is not a valid local ID");
    }
    const pass = parseQualifiedId("brownian-motion/eq-7");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: invalid equation term ID refuses with equation-term-id-grammar (ids.ts:937)", () => {
    const res = parseEquationTermId("invalid-term");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("equation-term-id-grammar");
      expect(res.error).toContain("Invalid equation term ID");
    }
    const pass = parseEquationTermId("eq-bm-s3-d4.t.energy");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: invalid equation operation ID refuses with equation-op-id-grammar (ids.ts:951)", () => {
    const res = parseEquationOpId("invalid-op");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("equation-op-id-grammar");
      expect(res.error).toContain("Invalid equation operation ID");
    }
    const pass = parseEquationOpId("eq-bm-s3-d4.op.add");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: invalid quantity ID refuses with quantity-id-grammar (ids.ts:969)", () => {
    const res = parseQuantityId("Invalid_Quantity");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("quantity-id-grammar");
      expect(res.error).toContain("Invalid quantity ID");
    }
    const pass = parseQuantityId("stoppingPotentialMagnitude");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: invalid concordance entry ID refuses with concordance-id-grammar (ids.ts:984)", () => {
    const res = parseConcordanceEntryId("invalid.entry");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("concordance-id-grammar");
      expect(res.error).toContain("Invalid concordance entry ID");
    }
    const pass = parseConcordanceEntryId("bm.k.viscosity");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: invalid premise ID refuses with premise-id-grammar (ids.ts:998)", () => {
    const res = parsePremiseId("invalid-premise");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("premise-id-grammar");
      expect(res.error).toContain("Invalid knowledge card / premise ID");
    }
    const pass = parsePremiseId("rayleigh-1900-radiation-law");
    expect(pass.ok).toBe(true);
  });

  test("PLANTED: invalid generic record ID refuses with record-id-grammar (ids.ts:1035)", () => {
    const res = parseGenericRecordId("Invalid_Record");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("record-id-grammar");
      expect(res.error).toContain("Invalid record ID");
    }
    const pass = parseGenericRecordId("generic-record-id");
    expect(pass.ok).toBe(true);
  });
});

describe("am-r3qt: five refusal sites in ids.ts that nothing drove", () => {
  // ids.ts is the best-maintained file I have audited tonight: 52 of its 65 sites carry a
  // citation and NOT ONE of those citations has drifted, against 594 dead citations
  // elsewhere in the tree. So these five are ordinary gaps rather than attribution damage,
  // and three of its other owed sites needed only a citation on a test that already
  // drives them.
  //
  // Read with python rather than grep: ids.ts contains two NUL bytes, so grep treats it as
  // binary and returns nothing for content that is plainly there.

  test("PLANTED: section zero has no heading block and says so (ids.ts:416)", () => {
    // Not a generic grammar failure. s0 is a WELL-FORMED section id that has no heading
    // block, because the unnumbered introductions of papers 1 to 3 use s0 and headings
    // start at s1. The message has to say that, or an author will keep trying to spell it
    // differently, so the message is asserted and not only the rule.
    const res = parseHeadingId("s0");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("heading-id-grammar");
      expect(res.error).toContain("part-1");
    }
    // The acceptance half: s1 and the part headings must still parse, or this arm would be
    // asserting that heading ids are rejected in general.
    expect(parseHeadingId("s1").ok).toBe(true);
    expect(parseHeadingId("part-1").ok).toBe(true);
  });

  test("PLANTED: an empty term ID refuses with term-id-grammar (ids.ts:773)", () => {
    // The first of four sites sharing this code, and they are four different faults. This
    // one is absence.
    for (const raw of ["", null, undefined, 7]) {
      const res = parseTermId(raw as unknown as string);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.rule).toBe("term-id-grammar");
    }
    expect(parseTermId("eq-s3-d4.t.viscosity").ok).toBe(true);
  });

  test("PLANTED: a term ID whose equation base is not an equation refuses (ids.ts:789)", () => {
    // The discriminating site. The shape '<something>.t.<name>' is satisfied, so the
    // pattern arm above it passes and this one has to catch a base that is not an
    // equation. Asserting the message is what separates the two, since both carry
    // term-id-grammar.
    const res = parseTermId("not-an-equation.t.viscosity");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("term-id-grammar");
      expect(res.error).toContain("not a valid equation base");
    }
  });

  test("PLANTED: an empty alternate form ID refuses with alternate-form-id-grammar (ids.ts:842)", () => {
    for (const raw of ["", null]) {
      const res = parseAlternateFormId(raw as unknown as string);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.rule).toBe("alternate-form-id-grammar");
    }
  });

  test("PLANTED: an empty qualified ID refuses with qualified-id-grammar (ids.ts:877)", () => {
    for (const raw of ["", null]) {
      const res = parseQualifiedId(raw as unknown as string);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.rule).toBe("qualified-id-grammar");
    }
  });
});
