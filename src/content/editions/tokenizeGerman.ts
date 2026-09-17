/**
 * German word tokenizer for glosses and review packets (am-edn-alignment-tooling-do1).
 * Token indices are 0-based among word tokens, excluding math atoms and punctuation.
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

const ABBREV_SORTED = [...SENTENCE_ABBREVIATIONS].sort((a, b) => b.length - a.length);
const LETTER = /[A-Za-zÄÖÜäöüßÁÉÍÓÚáéíóúÂÊÎÔÛâêîôûÀÈÌÒÙàèìòùÇçÑñ]/;

function matchAt(text: string, i: number, candidate: string): boolean {
  return text.slice(i, i + candidate.length) === candidate;
}

/**
 * Tokenize one alignable unit. Math regions and footnote marks are atoms,
 * not tokens. Punctuation is not a token.
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
    if (/\s/.test(text[i] ?? "")) {
      i += 1;
      continue;
    }

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

    const ch = text[i] ?? "";
    if (LETTER.test(ch)) {
      let j = i + 1;
      while (j < text.length) {
        const n = text[j] ?? "";
        if (LETTER.test(n) || n === "'" || n === "’" || n === "-") {
          j += 1;
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

    tokens.push({ kind: "punctuation", text: ch, start: i, end: i + 1 });
    i += 1;
  }

  return Object.freeze(tokens);
}

export function wordTokens(tokens: readonly GermanToken[]): readonly GermanToken[] {
  return Object.freeze(tokens.filter((t) => t.kind === "word"));
}
