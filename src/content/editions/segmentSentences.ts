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

export type DisplayMathRegion = Readonly<{
  start: number;
  end: number;
  latex: string;
  label?: string | undefined;
  isSentenceBoundary: boolean;
}>;

export type InlineMathRegion = Readonly<{
  start: number;
  end: number;
  latex: string;
}>;

function isUpperOrQuote(ch: string | undefined): boolean {
  if (!ch) return false;
  return /[A-ZÄÖÜ„»"']/.test(ch);
}

function isInsideAbbreviation(text: string, dotIndex: number): boolean {
  for (const abbr of ABBREV_SORTED) {
    const startWindow = Math.max(0, dotIndex - abbr.length + 1);
    const endWindow = Math.min(text.length, dotIndex + abbr.length);
    const window = text.slice(startWindow, endWindow).toLowerCase();
    const target = abbr.toLowerCase();
    const idxInWindow = window.indexOf(target);
    if (idxInWindow !== -1) {
      const abbrStart = startWindow + idxInWindow;
      const abbrEnd = abbrStart + abbr.length;
      if (dotIndex >= abbrStart && dotIndex < abbrEnd) {
        const prevChar = abbrStart > 0 ? text[abbrStart - 1] : " ";
        if (prevChar === undefined || /\s|[([„»"']/.test(prevChar)) {
          return true;
        }
      }
    }
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
  return /^\s+(März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Folge|Abschnitt|Band|Bd|p|pag|S)/i.test(
    rest,
  );
}

function insideSectionSign(text: string, dotIndex: number): boolean {
  const window = text.slice(Math.max(0, dotIndex - 8), dotIndex + 1);
  return /§\s*\d+\.$/.test(window);
}

/**
 * Scan for display math regions $$ ... $$ with optional [[EQ-LABEL ...]].
 * Identifies whether each display forms a sentence boundary per rule A.3.
 */
export function findDisplayMathRegions(text: string): readonly DisplayMathRegion[] {
  const regions: DisplayMathRegion[] = [];
  const displayRegex = /\$\$\s*([\s\S]*?)\s*\$\$(?:\s*\[\[EQ-LABEL\s+([^\]]+)\]\])?/g;
  let match: RegExpExecArray | null = displayRegex.exec(text);

  while (match !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    const latex = match[1] ?? "";
    const label = match[2]?.trim();

    // Check if latex ends with full stop (optionally followed by spacing commands or spaces)
    const endsWithPeriod = /\.\s*(?:\\quad|\\enspace|~|\\ |\s)*$/.test(latex.trim());

    // Check next non-whitespace character after the display
    let nextChar: string | undefined;
    for (let k = end; k < text.length; k++) {
      if (!/\s/.test(text[k] ?? "")) {
        nextChar = text[k];
        break;
      }
    }

    const isSentenceBoundary = endsWithPeriod && isUpperOrQuote(nextChar);

    regions.push({
      start,
      end,
      latex,
      ...(label !== undefined ? { label } : {}),
      isSentenceBoundary,
    });

    match = displayRegex.exec(text);
  }

  return Object.freeze(regions);
}

/**
 * Scan for inline math regions $ ... $ (excluding display math $$ ... $$).
 */
export function findInlineMathRegions(text: string): readonly InlineMathRegion[] {
  const regions: InlineMathRegion[] = [];
  let i = 0;
  while (i < text.length) {
    // Skip display equations
    if (text[i] === "$" && text[i + 1] === "$") {
      const close = text.indexOf("$$", i + 2);
      if (close !== -1) {
        i = close + 2;
        continue;
      }
    }
    if (text[i] === "$" && (i === 0 || text[i - 1] !== "\\")) {
      const start = i;
      let j = i + 1;
      while (j < text.length && text[j] !== "$") {
        if (text[j] === "\\") j += 2;
        else j += 1;
      }
      if (j < text.length && text[j] === "$") {
        regions.push({
          start,
          end: j + 1,
          latex: text.slice(start + 1, j),
        });
        i = j + 1;
        continue;
      }
    }
    i += 1;
  }
  return Object.freeze(regions);
}

/**
 * Extract 1-based inline math region IDs for a sentence (am-edn-alignment-tooling-do1 Scope B.3).
 * Counts every inline math region in printed order: s<n>-p<m>-s<k>-m1, -m2, etc.
 */
export function extractSentenceInlineMathIds(
  sentenceText: string,
  sentenceId: string,
): readonly string[] {
  const inlines = findInlineMathRegions(sentenceText);
  return Object.freeze(inlines.map((_, idx) => `${sentenceId}-m${idx + 1}`));
}

/**
 * Propose sentence spans in a paragraph. Math regions (start/end pairs) are
 * never split. Colons and semicolons are never boundaries.
 * Display references split only if the display's LaTeX ends with '.' and is
 * followed by an uppercase letter.
 */
export function proposeSentences(
  paragraph: string,
  mathRegions: readonly Readonly<{ start: number; end: number }>[] = [],
): readonly SentenceProposal[] {
  const proposals: SentenceProposal[] = [];
  const displays = findDisplayMathRegions(paragraph);
  const inlines = findInlineMathRegions(paragraph);
  const allMath = [...mathRegions, ...inlines];

  let start = 0;
  let i = 0;

  const inMath = (pos: number) => allMath.some((r) => pos >= r.start && pos < r.end);

  while (i < paragraph.length) {
    const disp = displays.find((d) => d.start === i);
    if (disp) {
      if (disp.isSentenceBoundary) {
        const text = paragraph.slice(start, disp.end).trim();
        if (text.length > 0) {
          proposals.push({ index: proposals.length, text, start, end: disp.end });
        }
        let nextStart = disp.end;
        while (nextStart < paragraph.length && /\s/.test(paragraph[nextStart] ?? "")) {
          nextStart += 1;
        }
        start = nextStart;
        i = nextStart;
        continue;
      } else {
        i = disp.end;
        continue;
      }
    }

    const ch = paragraph[i];
    if (ch !== "." && ch !== "?" && ch !== "!") {
      i += 1;
      continue;
    }
    if (inMath(i)) {
      i += 1;
      continue;
    }
    if (ch === "." && isInsideAbbreviation(paragraph, i)) {
      i += 1;
      continue;
    }
    if (ch === "." && precededByInitial(paragraph, i)) {
      i += 1;
      continue;
    }
    if (ch === "." && precededByOrdinal(paragraph, i)) {
      i += 1;
      continue;
    }
    if (ch === "." && insideSectionSign(paragraph, i)) {
      i += 1;
      continue;
    }

    let j = i + 1;
    while (j < paragraph.length && /\s/.test(paragraph[j] ?? "")) j += 1;
    const next = paragraph[j];
    const atEnd = j >= paragraph.length;
    if (!atEnd && !isUpperOrQuote(next)) {
      i += 1;
      continue;
    }

    const text = paragraph.slice(start, i + 1).trim();
    if (text.length > 0) {
      proposals.push({ index: proposals.length, text, start, end: i + 1 });
    }
    start = j;
    i = j;
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
  const first = segments[0];
  if (first) {
    const leading = text.slice(0, first.start);
    if (leading.trim().length > 0) {
      issues.push({
        code: "non-contiguous-segmentation",
        message: `Non-contiguous segmentation: leading text was dropped before first segment: "${leading.trim()}".`,
        start: 0,
        end: first.start,
      });
    }
  }

  // 2. Check adjacent segment relationships: overlap and non-contiguity
  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1];
    const curr = segments[i];
    if (!prev || !curr) continue;

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
  const last = segments[segments.length - 1];
  if (last) {
    const trailing = text.slice(last.end);
    if (trailing.trim().length > 0) {
      issues.push({
        code: "non-contiguous-segmentation",
        message: `Non-contiguous segmentation: trailing text was dropped after last segment: "${trailing.trim()}".`,
        start: last.end,
        end: text.length,
      });
    }
  }

  return Object.freeze(issues);
}
