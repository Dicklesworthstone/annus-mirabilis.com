/**
 * Alignable-unit classification for edition tooling (am-edn-alignment-tooling-do1).
 *
 * Permanent ids are defined once in `src/content/ids.ts` (am-cm-id-scheme-8bn).
 * This module classifies those ids; it does not invent a second grammar.
 * Reader anchors consume the same parsers.
 */

import {
  type AlignableUnitId,
  MASTHEAD_ID_PATTERN,
  PART_HEADING_ID_PATTERN,
  parseAlignableUnitId,
  parseClosingId,
  parseEquationAnchor,
  parseFootnoteId,
  parseHeadingId,
  parseParagraphId,
  parseSentenceId,
  parseTranslationUnitId,
} from "../ids.ts";

export type AlignableKind =
  | "sentence"
  | "heading"
  | "part-heading"
  | "masthead"
  | "footnote"
  | "closing";

export type AlignableClassification = Readonly<{
  id: string;
  kind: AlignableKind;
  alignsAt: "sentence" | "block";
}>;

export function classifyAlignableUnit(raw: string): AlignableClassification | null {
  const parsed = parseAlignableUnitId(raw);
  if (!parsed.ok) return null;
  if (parseSentenceId(raw).ok) {
    return { id: raw, kind: "sentence", alignsAt: "sentence" };
  }
  if (parseFootnoteId(raw).ok) {
    return { id: raw, kind: "footnote", alignsAt: "block" };
  }
  if (parseClosingId(raw).ok) {
    return { id: raw, kind: "closing", alignsAt: "block" };
  }
  if (MASTHEAD_ID_PATTERN.test(raw)) {
    return { id: raw, kind: "masthead", alignsAt: "block" };
  }
  if (PART_HEADING_ID_PATTERN.test(raw)) {
    return { id: raw, kind: "part-heading", alignsAt: "block" };
  }
  if (parseHeadingId(raw).ok) {
    return { id: raw, kind: "heading", alignsAt: "block" };
  }
  return { id: parsed.value as string, kind: "heading", alignsAt: "block" };
}

export function isPermanentGermanId(raw: string): boolean {
  return parseAlignableUnitId(raw).ok;
}

export function isPermanentEnglishId(raw: string): boolean {
  return parseTranslationUnitId(raw).ok;
}

/** Paragraph ids come from `parseParagraphId`; alignment does not re-spell them. */
export function isPermanentParagraphId(raw: string): boolean {
  return parseParagraphId(raw).ok;
}

/** Footnote ids come from `parseFootnoteId`; numbering is 1-indexed. */
export function isPermanentFootnoteId(raw: string): boolean {
  return parseFootnoteId(raw).ok;
}

/** Equation anchors come from `parseEquationAnchor`; display indices are 1-indexed. */
export function isPermanentEquationAnchor(raw: string): boolean {
  return parseEquationAnchor(raw).ok;
}

/** German source units never carry a split letter suffix. */
export function isGermanSentenceId(raw: string): boolean {
  return parseSentenceId(raw).ok;
}

export function requireAlignableId(raw: string): AlignableUnitId {
  const parsed = parseAlignableUnitId(raw);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return parsed.value;
}

export function paragraphIdOfSentence(sentenceId: string): string | null {
  if (!parseSentenceId(sentenceId).ok) return null;
  const paragraphId = sentenceId.replace(/-s[1-9]\d*$/, "");
  return parseParagraphId(paragraphId).ok ? paragraphId : null;
}
