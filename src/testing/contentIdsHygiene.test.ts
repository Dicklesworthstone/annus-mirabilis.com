import { describe, expect, it } from "bun:test";
import {
  parseBibKey,
  parseClosingId,
  parseConcordanceEntryId,
  parseEntranceId,
  parseEquationAnchor,
  parseEquationRecordId,
  parseFootnoteId,
  parseGenericRecordId,
  parseHeadingId,
  parseInlineMathId,
  parseInstrumentId,
  parseModeId,
  parseParagraphId,
  parsePaperCode,
  parsePredictPromptId,
  parsePresetId,
  parsePremiseId,
  parseQuantityId,
  parseReferenceId,
  parseRouteSlug,
  parseSectionId,
  parseSentenceId,
  parseTapeId,
  parseTranslationUnitId,
  validateSlug,
} from "../content/ids.ts";
import { parseAnchor } from "../content/anchors.ts";
import { TestLogger, newRunIdentity } from "./log/logger.ts";

describe("Content IDs Grammar, Dot Rule, and Negative Characterizations", () => {
  const logger = new TestLogger("content-ids", newRunIdentity());

  it("enforces the Dot Rule across instrument slugs", () => {
    // Valid: dot only between two digits
    expect(validateSlug("boost-0.6c").ok).toBe(true);
    expect(validateSlug("0-8-micron").ok).toBe(true);
    expect(validateSlug("wave-1.5").ok).toBe(true);

    // Rejected shapes
    const rejectedShapes = [
      [".6c", "leading dot"],
      ["0.c", "no digit after dot"],
      ["a.b", "letters around dot"],
      ["0..6", "double dot"],
      ["0.6.7", "multiple dots in token"],
      ["-leading-hyphen", "leading hyphen"],
      ["trailing-hyphen-", "trailing hyphen"],
      ["double--hyphen", "double hyphen"],
      ["Uppercase-Slug", "uppercase characters"],
    ];

    for (const [slug, reason] of rejectedShapes) {
      const res = validateSlug(slug!);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBeDefined();
      }
    }
  });

  it("enforces disjoint grammars for modes, presets, prompts, and tapes", () => {
    // Modes
    const validModes = ["sr-02:apparatus", "bm-04:kicks-off", "bm-07:kitchen", "me-03:box-1906", "lq-02:1904", "shelf-michelson-morley:1904"];
    for (const m of validModes) {
      expect(parseModeId(m).ok).toBe(true);
      expect(parsePresetId(m).ok).toBe(false);
      expect(parsePredictPromptId(m).ok).toBe(false);
      expect(parseTapeId(m).ok).toBe(false);
    }

    // Presets
    const validPresets = ["sr-03-boost-0.6c", "lq-08-intensity-probe", "me-03-card-coal", "me-03-sealed-lamp-and-mirror", "shelf-michelson-morley-1904", "light-thread-two-slits"];
    for (const p of validPresets) {
      expect(parsePresetId(p).ok).toBe(true);
      expect(parseModeId(p).ok).toBe(false);
      expect(parsePredictPromptId(p).ok).toBe(false);
    }

    // Predict Prompts
    const promptId = "sr-09-predict-approaching";
    expect(parsePredictPromptId(promptId).ok).toBe(true);
    expect(parsePresetId(promptId).ok).toBe(false);
    expect(parseModeId(promptId).ok).toBe(false);

    // Teaching Tapes
    const validTapes = ["einstein-0-8-micron", "perrins-count", "the-boost-to-0.6c", "the-two-pulses", "the-locked-positions"];
    for (const t of validTapes) {
      expect(parseTapeId(t).ok).toBe(true);
      expect(parseModeId(t).ok).toBe(false);
    }

    // Retired colon forms rejected
    const retiredPresets = ["lq-08:intensity-probe", "me-03:card-coal"];
    for (const rp of retiredPresets) {
      const presetRes = parsePresetId(rp);
      expect(presetRes.ok).toBe(false);
      if (!presetRes.ok) {
        expect(presetRes.error).toContain("hyphen format");
      }
    }

    const retiredTape = "lq-05:locked-positions";
    const tapeRes = parseTapeId(retiredTape);
    expect(tapeRes.ok).toBe(false);
    if (!tapeRes.ok) {
      expect(tapeRes.error).toContain("slug format");
    }
  });

  it("validates all planted negative rejection cases from the bead specification", () => {
    // 1. Invalid section/paragraph/sentence
    expect(parseParagraphId("s3-p0").ok).toBe(false);
    expect(parseParagraphId("S3-p1").ok).toBe(false);
    expect(parseSentenceId("s3-p2-s1a").ok).toBe(false); // German sentence cannot have split letter suffix
    expect(parseFootnoteId("s3-fn0").ok).toBe(false);
    expect(parseFootnoteId("s3-fn1-s1").ok).toBe(false); // Footnotes have no sentence sub-ids
    expect(parseHeadingId("s3-h").ok).toBe(false); // Heading is s3, not s3-h
    expect(parseClosingId("closing-ack-s1").ok).toBe(false); // Closings have no sentence sub-ids

    // 2. Invalid split translation suffix
    expect(parseTranslationUnitId("closing-acka").ok).toBe(false); // Must use hyphen closing-ack-a
    expect(parseTranslationUnitId("closing-ack-a").ok).toBe(true);

    // 3. Invalid equation
    expect(parseEquationAnchor("eq-").ok).toBe(false);
    expect(parseEquationAnchor("eq-s3-d0").ok).toBe(false);

    // 4. Invalid instrument
    expect(parseInstrumentId("lq-1").ok).toBe(false); // must be 2 digits
    expect(parseInstrumentId("LQ-01").ok).toBe(false); // must be lowercase
    expect(parseInstrumentId("shelf-fizaeu").ok).toBe(false); // undeclared non-core

    // 5. Invalid bibliographic key
    expect(parseBibKey("ap-17").ok).toBe(false); // missing page

    // 6. Invalid concordance
    expect(parseConcordanceEntryId("bm.K.Viscosity").ok).toBe(false); // meaning must be kebab

    // 7. Invalid card/premise ID
    expect(parsePremiseId("journey-i-rayleigh").ok).toBe(false); // missing year pattern

    // 8. Invalid entrance ID
    expect(parseEntranceId("entrance-brownian").ok).toBe(false); // must be full slug entrance-brownian-motion
    expect(parseEntranceId("entrance-molecular-dimensions").ok).toBe(false); // companion has no entrance record

    // 9. Invalid mode trailing hyphen
    expect(parseModeId("lq-02:1904-").ok).toBe(false);
  });
});
