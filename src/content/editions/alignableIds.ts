/**
 * Alignable-unit classification for edition tooling (am-edn-alignment-tooling-do1).
 *
 * Permanent ids are defined once in `src/content/ids.ts` (am-cm-id-scheme-8bn).
 * This module classifies those ids; it does not invent a second grammar.
 * Reader anchors consume the same parsers.
 */

import {
  type AlignableUnitId,
  parseAlignableUnitId,
  parseClosingId,
  parseFootnoteId,
  parseHeadingId,
  parseSentenceId,
  parseTranslationUnitId,
  SENTENCE_ID_PATTERN,
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
  if (/^masthead-(title|author)$/.test(raw)) {
    return { id: raw, kind: "masthead", alignsAt: "block" };
  }
  if (/^part-[12]$/.test(raw)) {
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

/** German source units never carry a split letter suffix. */
export function isGermanSentenceId(raw: string): boolean {
  return SENTENCE_ID_PATTERN.test(raw) && parseSentenceId(raw).ok;
}

export function requireAlignableId(raw: string): AlignableUnitId {
  const parsed = parseAlignableUnitId(raw);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return parsed.value;
}

export function paragraphIdOfSentence(sentenceId: string): string | null {
  const match = sentenceId.match(/^(s\d+-p[1-9]\d*)-s[1-9]\d*$/);
  return match?.[1] ?? null;
}
