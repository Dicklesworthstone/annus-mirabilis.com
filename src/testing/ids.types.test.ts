import { describe, expect, it } from "bun:test";
import type {
  AlignableUnitId,
  EquationAnchor,
  EquationRecordId,
  FootnoteId,
  HeadingId,
  InstrumentId,
  ModeId,
  PaperCode,
  ParagraphId,
  PredictPromptId,
  PremiseId,
  PresetId,
  QuantityId,
  RouteSlug,
  SectionId,
  SentenceId,
  TapeId,
  TranslationUnitId,
} from "../content/ids.ts";
import {
  parseBibKey,
  parseInstrumentId,
  parseModeId,
  parsePredictPromptId,
  parsePresetId,
  parseTapeId,
} from "../content/ids.ts";

describe("Branded Types Compile-Time and Runtime Contracts", () => {
  it("validates that branded parsers return branded values", () => {
    const inst = parseInstrumentId("sr-02");
    expect(inst.ok).toBe(true);
    if (inst.ok) {
      const typedInst: InstrumentId = inst.value;
      expect(typeof typedInst).toBe("string");
    }

    const mode = parseModeId("sr-02:apparatus");
    expect(mode.ok).toBe(true);
    if (mode.ok) {
      const typedMode: ModeId = mode.value;
      expect(typeof typedMode).toBe("string");
    }

    const preset = parsePresetId("sr-03-boost-0.6c");
    expect(preset.ok).toBe(true);
    if (preset.ok) {
      const typedPreset: PresetId = preset.value;
      expect(typeof typedPreset).toBe("string");
    }

    const prompt = parsePredictPromptId("sr-09-predict-approaching");
    expect(prompt.ok).toBe(true);
    if (prompt.ok) {
      const typedPrompt: PredictPromptId = prompt.value;
      expect(typeof typedPrompt).toBe("string");
    }

    const tape = parseTapeId("the-locked-positions");
    expect(tape.ok).toBe(true);
    if (tape.ok) {
      const typedTape: TapeId = tape.value;
      expect(typeof typedTape).toBe("string");
    }
  });

  it("checks branded type invariants with static compile assignments", () => {
    // These demonstrate the static typing structure
    const section = "s3" as SectionId;
    const heading = "s3" as HeadingId;
    const para = "s3-p2" as ParagraphId;
    const sentence = "s3-p2-s1" as SentenceId;
    const footnote = "s3-fn1" as FootnoteId;
    const alignable: AlignableUnitId = sentence;
    const translation: TranslationUnitId = "s3-p2-s1a" as TranslationUnitId;

    expect(typeof section).toBe("string");
    expect(typeof heading).toBe("string");
    expect(typeof para).toBe("string");
    expect(typeof sentence).toBe("string");
    expect(typeof footnote).toBe("string");
    expect(typeof alignable).toBe("string");
    expect(typeof translation).toBe("string");
  });
});
