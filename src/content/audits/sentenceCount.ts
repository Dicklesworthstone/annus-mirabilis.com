/**
 * Sentence and word counts for the R0/R2 heuristics (am-cm-audit-scripts-d34).
 * Abbreviations are protected so "Ann. Phys. 17, p. 549" is not three sentences.
 */

export const PROTECTED_ABBREVIATIONS = [
  "Ann. Phys.",
  "vol.",
  "pp.",
  "e.g.",
  "i.e.",
  "cf.",
  "p.",
] as const;

const DOT = "\u00b7";

export function protectAbbreviations(text: string): string {
  let protectedText = text;
  for (const abbreviation of PROTECTED_ABBREVIATIONS) {
    const escaped = abbreviation.replaceAll(".", "\\.");
    const pattern = new RegExp(`\\b${escaped}`, "g");
    protectedText = protectedText.replace(pattern, abbreviation.replaceAll(".", DOT));
  }
  return protectedText;
}

export function countSentences(text: string): number {
  const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
  let count = 0;
  for (const { segment } of segmenter.segment(protectAbbreviations(text))) {
    if (segment.trim().length > 0) count += 1;
  }
  return count;
}

export function countWords(text: string): number {
  const segmenter = new Intl.Segmenter("en", { granularity: "word" });
  let count = 0;
  for (const part of segmenter.segment(text)) {
    if (part.isWordLike) count += 1;
  }
  return count;
}
