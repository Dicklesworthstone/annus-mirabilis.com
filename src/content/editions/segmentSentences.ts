/**
 * German sentence-boundary rules (am-edn-alignment-tooling-do1).
 * Executable copy of docs/editorial/SEGMENTATION.md. The facsimile still
 * decides doubtful cases; this module only proposes.
 */

export const SENTENCE_ABBREVIATIONS = Object.freeze([
  "z. B.",
  "d. h.",
  "u. s. w.",
  "usw.",
  "vgl.",
  "bzw.",
  "ca.",
  "resp.",
  "a. a. O.",
  "l. c.",
  "S.",
  "p.",
  "Bd.",
  "Ann.",
  "d.",
  "Phys.",
  "Sek.",
  "sec.",
  "cm.",
  "mm.",
  "gr.",
  "Fig.",
  "Gl.",
  "Nr.",
  "Proc.",
  "Wied.",
  "Ber.",
  "Sitzungsber.",
  "Akad.",
  "Wiss.",
]);

const ABBREV_SORTED = [...SENTENCE_ABBREVIATIONS].sort((a, b) => b.length - a.length);

export type SentenceProposal = Readonly<{
  index: number;
  text: string;
  start: number;
  end: number;
}>;

function isUpperOrQuote(ch: string | undefined): boolean {
  if (!ch) return false;
  return /[A-ZÄÖÜ„»"']/.test(ch);
}

function precededByAbbreviation(text: string, dotIndex: number): boolean {
  const before = text.slice(0, dotIndex + 1);
  for (const abbr of ABBREV_SORTED) {
    if (before.endsWith(abbr)) return true;
  }
  return false;
}

function precededByInitial(text: string, dotIndex: number): boolean {
  if (dotIndex < 1) return false;
  const ch = text[dotIndex - 1];
  if (!ch || !/[A-ZÄÖÜ]/.test(ch)) return false;
  const before = text[dotIndex - 2];
  return before === undefined || /\s/.test(before);
}

function precededByOrdinal(text: string, dotIndex: number): boolean {
  let i = dotIndex - 1;
  if (i < 0 || !/\d|[IVXivx]/.test(text[i] ?? "")) return false;
  while (i >= 0 && /[\dIVXivx]/.test(text[i] ?? "")) i -= 1;
  const rest = text.slice(dotIndex + 1);
  return /^\s+(März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Folge|Abschnitt)/.test(
    rest,
  );
}

function insideSectionSign(text: string, dotIndex: number): boolean {
  const window = text.slice(Math.max(0, dotIndex - 8), dotIndex + 1);
  return /§\s*\d+\.$/.test(window);
}

/**
 * Propose sentence spans in a paragraph. Math regions (start/end pairs) are
 * never split. Colons and semicolons are never boundaries.
 */
export function proposeSentences(
  paragraph: string,
  mathRegions: readonly Readonly<{ start: number; end: number }>[] = [],
): readonly SentenceProposal[] {
  const proposals: SentenceProposal[] = [];
  let start = 0;
  const inMath = (i: number) => mathRegions.some((r) => i >= r.start && i < r.end);

  for (let i = 0; i < paragraph.length; i++) {
    const ch = paragraph[i];
    if (ch !== "." && ch !== "?" && ch !== "!") continue;
    if (inMath(i)) continue;
    if (ch === "." && precededByAbbreviation(paragraph, i)) continue;
    if (ch === "." && precededByInitial(paragraph, i)) continue;
    if (ch === "." && precededByOrdinal(paragraph, i)) continue;
    if (ch === "." && insideSectionSign(paragraph, i)) continue;

    let j = i + 1;
    while (j < paragraph.length && /\s/.test(paragraph[j] ?? "")) j += 1;
    const next = paragraph[j];
    const atEnd = j >= paragraph.length;
    if (!atEnd && !isUpperOrQuote(next)) continue;

    const text = paragraph.slice(start, i + 1).trim();
    if (text.length > 0) {
      proposals.push({ index: proposals.length, text, start, end: i + 1 });
    }
    start = j;
    i = j - 1;
  }
  if (start < paragraph.length) {
    const text = paragraph.slice(start).trim();
    if (text.length > 0) {
      proposals.push({ index: proposals.length, text, start, end: paragraph.length });
    }
  }
  return Object.freeze(proposals);
}

export type SegmentationIssue = Readonly<{
  code: "overlapping-segments" | "non-contiguous-segmentation";
  message: string;
  start?: number | undefined;
  end?: number | undefined;
  firstSegmentIndex?: number | undefined;
  secondSegmentIndex?: number | undefined;
}>;

export type SegmentSpan = Readonly<{
  start: number;
  end: number;
  text?: string | undefined;
  id?: string | undefined;
}>;

/**
 * Validate that proposed segments partition text contiguously without
 * overlapping and without dropping non-whitespace text.
 */
export function validateSegmentation(
  text: string,
  segments: readonly SegmentSpan[],
): readonly SegmentationIssue[] {
  const issues: SegmentationIssue[] = [];

  if (segments.length === 0) {
    if (text.trim().length > 0) {
      issues.push({
        code: "non-contiguous-segmentation",
        message: "Non-contiguous segmentation: text has no segments; entire text was dropped.",
        start: 0,
        end: text.length,
      });
    }
    return Object.freeze(issues);
  }

  // 1. Check leading text
  const leading = text.slice(0, segments[0]!.start);
  if (leading.trim().length > 0) {
    issues.push({
      code: "non-contiguous-segmentation",
      message: `Non-contiguous segmentation: leading text was dropped before first segment: "${leading.trim()}".`,
      start: 0,
      end: segments[0]!.start,
    });
  }

  // 2. Check adjacent segment relationships: overlap and non-contiguity
  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1]!;
    const curr = segments[i]!;

    if (curr.start < prev.end) {
      issues.push({
        code: "overlapping-segments",
        message: `Segments overlap: segment ${i - 1} [${prev.start}, ${prev.end}) and segment ${i} [${curr.start}, ${curr.end}) share span [${curr.start}, ${Math.min(prev.end, curr.end)}).`,
        start: curr.start,
        end: Math.min(prev.end, curr.end),
        firstSegmentIndex: i - 1,
        secondSegmentIndex: i,
      });
    } else if (curr.start > prev.end) {
      const gap = text.slice(prev.end, curr.start);
      if (gap.trim().length > 0) {
        issues.push({
          code: "non-contiguous-segmentation",
          message: `Non-contiguous segmentation: text between segment ${i - 1} and segment ${i} was dropped: "${gap.trim()}".`,
          start: prev.end,
          end: curr.start,
          firstSegmentIndex: i - 1,
          secondSegmentIndex: i,
        });
      }
    }
  }

  // 3. Check trailing text
  const trailing = text.slice(segments[segments.length - 1]!.end);
  if (trailing.trim().length > 0) {
    issues.push({
      code: "non-contiguous-segmentation",
      message: `Non-contiguous segmentation: trailing text was dropped after last segment: "${trailing.trim()}".`,
      start: segments[segments.length - 1]!.end,
      end: text.length,
    });
  }

  return Object.freeze(issues);
}
