/**
 * German word tokenizer for glosses and review packets (am-edn-alignment-tooling-do1).
 * Token indices are 0-based among word tokens, excluding math atoms and punctuation.
 * Emphasis tags ([[SPERR]], [[/SPERR]], [[EM]], [[/EM]]) never split a token.
 */

import { SENTENCE_ABBREVIATIONS } from "./segmentSentences.ts";

export type GermanTokenKind = "word" | "math" | "footnote-mark" | "punctuation";

export type GermanToken = Readonly<{
  kind: GermanTokenKind;
  text: string;
  start: number;
  end: number;
  tokenIndex?: number | undefined;
}>;

export const UNIT_WORDS = Object.freeze([
  "Sek.",
  "sec.",
  "cm.",
  "mm.",
  "cm",
  "mm",
  "μ",
  "Mikron",
  "Volt",
  "Amp.",
]);

const ABBREV_SORTED = [...SENTENCE_ABBREVIATIONS, ...UNIT_WORDS]
  .filter((v, i, arr) => arr.indexOf(v) === i)
  .sort((a, b) => b.length - a.length);

const LETTER = /[A-Za-zÄÖÜäöüßÁÉÍÓÚáéíóúÂÊÎÔÛâêîôûÀÈÌÒÙàèìòùÇçÑñ]/;

function matchAt(text: string, i: number, candidate: string): boolean {
  return text.slice(i, i + candidate.length) === candidate;
}

/**
 * Tokenize one alignable unit. Math regions and footnote marks are atoms,
 * not tokens. Punctuation is not a token. Emphasis tags are skipped and
 * never split word tokens.
 */
export function tokenizeGerman(
  text: string,
  options?: {
    mathRegions?: readonly Readonly<{ start: number; end: number; text?: string }>[];
    footnoteMarks?: readonly Readonly<{ start: number; end: number; text?: string }>[];
  },
): readonly GermanToken[] {
  const tokens: GermanToken[] = [];
  let tokenIndex = 0;
  let i = 0;
  const math = [...(options?.mathRegions ?? [])].sort((a, b) => a.start - b.start);
  const marks = [...(options?.footnoteMarks ?? [])].sort((a, b) => a.start - b.start);

  const atomAt = (pos: number) => {
    const m = math.find((r) => pos >= r.start && pos < r.end);
    if (m)
      return {
        kind: "math" as const,
        start: m.start,
        end: m.end,
        text: m.text ?? text.slice(m.start, m.end),
      };
    const f = marks.find((r) => pos >= r.start && pos < r.end);
    if (f)
      return {
        kind: "footnote-mark" as const,
        start: f.start,
        end: f.end,
        text: f.text ?? text.slice(f.start, f.end),
      };
    return null;
  };

  while (i < text.length) {
    const atom = atomAt(i);
    if (atom) {
      tokens.push({ kind: atom.kind, text: atom.text, start: atom.start, end: atom.end });
      i = atom.end;
      continue;
    }

    // Skip whitespace
    if (/\s/.test(text[i] ?? "")) {
      i += 1;
      continue;
    }

    // Skip emphasis tags ([[SPERR]], [[/SPERR]], [[EM]], [[/EM]]) - emphasis never splits a token
    const emphasis = text.slice(i).match(/^\[\[\/?(?:SPERR|EM)\]\]/);
    if (emphasis) {
      i += emphasis[0].length;
      continue;
    }

    // Match listed abbreviations and unit words
    let matched = false;
    for (const abbr of ABBREV_SORTED) {
      if (matchAt(text, i, abbr)) {
        tokens.push({ kind: "word", text: abbr, start: i, end: i + abbr.length, tokenIndex });
        tokenIndex += 1;
        i += abbr.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Match section with number (e.g. § 8)
    const section = text.slice(i).match(/^§\s*\d+/);
    if (section) {
      tokens.push({
        kind: "word",
        text: section[0],
        start: i,
        end: i + section[0].length,
        tokenIndex,
      });
      tokenIndex += 1;
      i += section[0].length;
      continue;
    }

    // Match ordinal with period (e.g. 17.)
    const ordinal = text.slice(i).match(/^\d+\.(?=\s|$)/);
    if (ordinal) {
      tokens.push({
        kind: "word",
        text: ordinal[0],
        start: i,
        end: i + ordinal[0].length,
        tokenIndex,
      });
      tokenIndex += 1;
      i += ordinal[0].length;
      continue;
    }

    // Match number with decimal comma (e.g. 0,001)
    const decimal = text.slice(i).match(/^\d+,\d+/);
    if (decimal) {
      tokens.push({
        kind: "word",
        text: decimal[0],
        start: i,
        end: i + decimal[0].length,
        tokenIndex,
      });
      tokenIndex += 1;
      i += decimal[0].length;
      continue;
    }

    // Match a bare number (e.g. the year in "(Eingegangen 27. September 1905.)"). Without this rule
    // a number not followed by a space or the end became one punctuation token per digit, so the
    // received date's year had no token, no gloss, and no place on the gloss face.
    const integer = text.slice(i).match(/^\d+/);
    if (integer) {
      tokens.push({
        kind: "word",
        text: integer[0],
        start: i,
        end: i + integer[0].length,
        tokenIndex,
      });
      tokenIndex += 1;
      i += integer[0].length;
      continue;
    }

    // Match word with internal hyphens and apostrophes (e.g. Maxwell-Hertzschen, Doppler'schen)
    const ch = text[i] ?? "";
    if (LETTER.test(ch)) {
      let j = i + 1;
      while (j < text.length) {
        const n = text[j] ?? "";
        if (LETTER.test(n) || n === "'" || n === "’") {
          j += 1;
          continue;
        }
        if (n === "-" && j + 1 < text.length && LETTER.test(text[j + 1] ?? "")) {
          j += 2;
          continue;
        }
        break;
      }
      const word = text.slice(i, j);
      tokens.push({ kind: "word", text: word, start: i, end: j, tokenIndex });
      tokenIndex += 1;
      i = j;
      continue;
    }

    // Punctuation
    tokens.push({ kind: "punctuation", text: ch, start: i, end: i + 1 });
    i += 1;
  }

  return Object.freeze(tokens);
}

export function wordTokens(tokens: readonly GermanToken[]): readonly GermanToken[] {
  return Object.freeze(tokens.filter((t) => t.kind === "word"));
}
