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
  | "closing"
  | "display";

export type AlignableClassification = Readonly<{
  id: string;
  kind: AlignableKind;
  alignsAt: "sentence" | "block";
}>;

export function classifyAlignableUnit(raw: string): AlignableClassification | null {
  // CHECKED FIRST, because a display anchor is not an "alignable unit id" in the narrow sense
  // `parseAlignableUnitId` covers, so the early return below refuses it. Placing this branch after
  // that return made it unreachable, which the test that reads the real corpus caught at once.
  if (parseEquationAnchor(raw).ok) {
    return { id: raw, kind: "display", alignsAt: "block" };
  }
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

/**
 * A DISPLAY EQUATION IS AN ALIGNABLE GERMAN UNIT, and leaving it out emptied the alignment.
 *
 * `parseAlignableUnitId` covers sentences, headings, mastheads, part headings, footnotes and
 * closings, and not display-equation anchors -- so every authored edge from a printed display was
 * refused as "not a permanent German alignable id". Measured across the four papers on 2026-10-05:
 * 200 such edges, 7 in mass-energy, 52 in light-quanta, 43 in brownian-motion and 98 in
 * special-relativity, and 200 is also exactly the number of units each manifest declares with kind
 * `display-equation`. Every one of the 200 is present in its own manifest, so these were not
 * dangling references; the predicate simply could not describe them. Each refused edge also cost
 * its English unit an `unaligned-target`, which is why the issue counts came in matched pairs.
 *
 * The rejection is kept where it belongs: a display index is 1-indexed, so `eq-s3-d0` is still
 * refused, and the boundary test that pins that passes `eq-s3-d1` as a German id already.
 *
 * ONE id in the corpus is still refused after this, and deliberately: special-relativity's `eq-A`,
 * Einstein's printed equation (A) on page 918, whose manifest unit records `originalLabel: (A)`.
 * The anchor grammar accepts a numeric printed label (`eq-5`, `eq-s9-5`) and not a letter, and the
 * grammar is owned by am-cm-id-scheme-8bn rather than by alignment, so it is reported as one true
 * issue instead of quietly widened here.
 */
export function isPermanentGermanId(raw: string): boolean {
  return parseAlignableUnitId(raw).ok || parseEquationAnchor(raw).ok;
}

/**
 * THE MIRROR OF THE GERMAN CASE, and the corpus is as unambiguous about it.
 *
 * A display equation is addressed on the English face by the SAME anchor as on the German one --
 * `eq-s0-d1` aligns to `eq-s0-d1` -- because AGENTS.md requires an English equation block to be
 * byte-identical to its aligned German block. `parseTranslationUnitId` does not admit an anchor, so
 * every edge into a printed display reported `missing-target-id`.
 *
 * Measured 2026-10-05: of 821 translation-unit records on disk, 200 carry an equation anchor as
 * their own `id`, which is exactly the number of units the four manifests declare with kind
 * `display-equation`. They are authored records, not references to nothing.
 */
export function isPermanentEnglishId(raw: string): boolean {
  return parseTranslationUnitId(raw).ok || parseEquationAnchor(raw).ok;
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
