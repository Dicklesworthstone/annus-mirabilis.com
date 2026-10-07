/**
 * Type-level proof that the content ids are NOMINAL (am-cm-id-scheme-8bn).
 *
 * Checked by `bun run check:types`, because an UNUSED `@ts-expect-error` is itself a type error. So
 * if `Brand` ever stops distinguishing one id from another, this file fails the repository-wide gate
 * rather than passing quietly.
 *
 * IT DID NOT CHECK ANYTHING BEFORE. Every value was created with an unchecked cast --
 * `const section = "s3" as SectionId` -- and then asserted to be a string:
 *
 *     expect(typeof section).toBe("string");
 *
 * A cast cannot fail and `typeof x === "string"` is true by construction for every one of these
 * brands, so the file would have passed with `Brand` deleted outright. Seven assertions, all
 * tautological, in a file named for compile-time proof: the shape AGENTS.md calls RH-5.
 *
 * It was also the target of a POINTER. `src/content/ids.test.ts` carried a test titled "this file
 * compiles, which is the proof: see ids.types.test.ts for the @ts-expect-error cases" whose body was
 * `expect(true).toBe(true)`. This file had NO `@ts-expect-error` cases -- measured against its three
 * sibling `.types.test.ts` files, which carry 4, 3 and 2 -- so the pointer named a proof that did not
 * exist, and the tautology at each end made both files green.
 *
 * WHAT MAKES THE NEGATIVES REAL: `Brand<T, B> = T & { readonly [brand]: B }` over a `unique symbol`
 * (src/content/ids.ts:9). Two brands over the same `string` are therefore incompatible in both
 * directions, which is what the cases below assert.
 */
import { describe, expect, test } from "bun:test";
import type {
  AlignableUnitId,
  FootnoteId,
  HeadingId,
  InstrumentId,
  ModeId,
  ParagraphId,
  PresetId,
  SectionId,
  SentenceId,
  TapeId,
} from "../content/ids.ts";
import {
  parseInstrumentId,
  parseModeId,
  parsePresetId,
  parseSentenceId,
  parseTapeId,
} from "../content/ids.ts";

describe("a raw string is not an id: it has to come through a parser", () => {
  test("assigning a bare string to any branded id is a type error", () => {
    // @ts-expect-error a string is not a SectionId: the brand is what a parser adds, and accepting
    // a raw string here is how an unvalidated id reaches a record.
    const section: SectionId = "s3";
    // @ts-expect-error same for a paragraph id.
    const paragraph: ParagraphId = "s3-p2";
    // @ts-expect-error and for an instrument id, which has its own grammar.
    const instrument: InstrumentId = "sr-02";
    expect([section, paragraph, instrument].every((v) => typeof v === "string")).toBe(true);
  });

  test("a parser's accepted value IS assignable, which is the accept half", () => {
    const parsed = parseSentenceId("s3-p2-s1");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("parseSentenceId must accept s3-p2-s1");
    // No cast and no directive: this compiles because the parser returns the brand.
    const sentence: SentenceId = parsed.value;
    expect(sentence).toBe("s3-p2-s1");
  });
});

describe("two brands over the same string are incompatible in both directions", () => {
  test("a SentenceId is not a ParagraphId, and a ParagraphId is not a SentenceId", () => {
    const parsedSentence = parseSentenceId("s3-p2-s1");
    if (!parsedSentence.ok) throw new Error("parseSentenceId must accept s3-p2-s1");
    const sentence: SentenceId = parsedSentence.value;
    // @ts-expect-error a sentence id is not a paragraph id. Inserting a sentence where a paragraph
    // is expected is exactly the confusion the id grammar exists to prevent.
    const asParagraph: ParagraphId = sentence;
    // @ts-expect-error and the other direction, so this is nominality rather than a one-way widening.
    const backAgain: SentenceId = asParagraph as ParagraphId;
    expect(typeof backAgain).toBe("string");
  });

  test("an instrument id is not a mode, preset or tape id, though all four are strings", () => {
    const instrument = parseInstrumentId("sr-02");
    if (!instrument.ok) throw new Error("parseInstrumentId must accept sr-02");
    // @ts-expect-error a bare instrument id is not a mode id; a mode is `<instrumentId>:<mode>`.
    const mode: ModeId = instrument.value;
    // @ts-expect-error nor a preset id, which is `<instrumentId>-<slug>`.
    const preset: PresetId = instrument.value;
    // @ts-expect-error nor a tape id, which is a slug of its own.
    const tape: TapeId = instrument.value;
    expect([mode, preset, tape].every((v) => v === "sr-02")).toBe(true);
  });

  test("each of those parsers does accept its own form, so the refusals above are about the TYPE", () => {
    // Without this the file would prove only that nothing is assignable to anything.
    expect(parseModeId("sr-02:apparatus").ok).toBe(true);
    expect(parsePresetId("sr-03-boost-0.6c").ok).toBe(true);
    expect(parseTapeId("the-locked-positions").ok).toBe(true);
    expect(parseInstrumentId("sr-02").ok).toBe(true);
  });
});

describe("AlignableUnitId is a union, and it admits exactly its members", () => {
  test("a SentenceId, a HeadingId and a FootnoteId are all alignable", () => {
    const parsed = parseSentenceId("s3-p2-s1");
    if (!parsed.ok) throw new Error("parseSentenceId must accept s3-p2-s1");
    // These compile with no directive: the union names all three.
    const fromSentence: AlignableUnitId = parsed.value;
    const fromHeading: AlignableUnitId = "s3" as HeadingId;
    const fromFootnote: AlignableUnitId = "s3-fn1" as FootnoteId;
    expect([fromSentence, fromHeading, fromFootnote].length).toBe(3);
  });

  test("a ParagraphId is NOT alignable, which is the union's whole content", () => {
    // AGENTS.md aligns SENTENCES, not paragraphs: "Alignment: explicit many-to-many relation
    // between source spans and translated spans". A paragraph slipping into an alignment edge is
    // the error this union refuses, and it is the one case that makes the union mean anything --
    // without it, `AlignableUnitId` could be `Brand<string, any>` and every case above would pass.
    // @ts-expect-error a paragraph id is not an alignable unit id.
    const fromParagraph: AlignableUnitId = "s3-p2" as ParagraphId;
    expect(typeof fromParagraph).toBe("string");
  });

  test("an InstrumentId is not alignable either, so the union is not just 'any content id'", () => {
    const instrument = parseInstrumentId("sr-02");
    if (!instrument.ok) throw new Error("parseInstrumentId must accept sr-02");
    // @ts-expect-error an instrument id addresses a laboratory, not a span of the paper.
    const fromInstrument: AlignableUnitId = instrument.value;
    expect(typeof fromInstrument).toBe("string");
  });
});
