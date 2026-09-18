/**
 * Tokenizer and lexical scanner for reviewed diplomatic German ledgers.
 * Governed by bead am-edn-ledger-validator-edv and docs/editorial/LEDGER_FORMAT.md.
 */

export const DRAFT_REPAIRS: Readonly<Record<string, string>> = Object.freeze({
  "RUNNING-HEAD": "Remove running head; running heads belong in receipt pageMap.",
  "PAGE-NUMBER": "Remove page number; carried by [[ANNALEN-PAGE]].",
  ILLEGIBLE: "Resolve reading against 300+ dpi image/witnesses or record in watchList.",
});

export const FORBIDDEN_SUBSTRINGS: readonly string[] = Object.freeze([
  "[[MATH-REGION",
  "unverified",
  "TODO",
  "???",
  "\uFFFD",
  "[?]",
  "<unk>",
]);

export const DEFAULT_RUNNING_HEAD_PATTERNS: readonly string[] = Object.freeze([
  "^A\\.\\s*Einstein\\.?$",
]);

export const DEFAULT_MODERN_SPELLINGS: readonly {
  modern: string;
  period: string;
  citation: string;
}[] = Object.freeze([
  {
    modern: "dass",
    period: "daß",
    citation: "AdP 17, 549, 1905 (universally printed daß)",
  },
  {
    modern: "muss",
    period: "muß",
    citation: "AdP 17, 549, 1905 (universally printed muß)",
  },
  {
    modern: "lässt",
    period: "läßt",
    citation: "AdP 17, 550, 1905 (printed läßt)",
  },
  {
    modern: "Schluss",
    period: "Schluß",
    citation: "AdP 17, 921, 1905 (printed Schluß)",
  },
  {
    modern: "Fluss",
    period: "Fluß",
    citation: "AdP 17, 552, 1905 (printed Fluß)",
  },
  {
    modern: "Potenzial",
    period: "Potential",
    citation: "AdP 17, 551, 1905 (printed Potential)",
  },
  {
    modern: "Differenzial",
    period: "Differential",
    citation: "AdP 17, 553, 1905 (printed Differential)",
  },
  {
    modern: "speziell",
    period: "speciell",
    citation: "AdP 17, 891, 1905 (printed speciell)",
  },
  {
    modern: "Koeffizient",
    period: "Coefficient",
    citation: "AdP 17, 555, 1905 (printed Diffusionskoeffizient/Coefficient)",
  },
]);

export const KNOWN_TAG_NAMES = new Set([
  "ANNALEN-PAGE",
  "ARTICLE-NUMBER",
  "TITLE",
  "/TITLE",
  "AUTHOR",
  "/AUTHOR",
  "HEADING",
  "PART-HEADING",
  "EQ-LABEL",
  "SPERR",
  "/SPERR",
  "EM",
  "/EM",
  "FN-MARK",
  "FN",
  "FN-CONTINUES",
  "FN-CONT",
  "OTHER-ARTICLE-OMITTED",
  "DATELINE",
  "/DATELINE",
  "ACK",
  "/ACK",
  "RECEIVED",
  "/RECEIVED",
  "CONTINUES",
  "RUNNING-HEAD",
  "PAGE-NUMBER",
  "ILLEGIBLE",
]);

export type PageMarkerToken = Readonly<{
  kind: "PAGE_MARKER";
  pageNumber: number;
  totalPages: number;
  raw: string;
}>;

export type AnnalenPageToken = Readonly<{
  kind: "ANNALEN_PAGE";
  printedPage: number;
  raw: string;
}>;

export type TagToken = Readonly<{
  kind: "TAG";
  name: string;
  arg?: string | undefined;
  raw: string;
  startIndex: number;
  endIndex: number;
}>;

export function parsePageMarker(line: string): PageMarkerToken | null {
  const match = line.match(/^---\s*REVIEWED\s+TRANSCRIPTION\s+PAGE\s+(\d+)\s+OF\s+(\d+)\s*---$/);
  if (!match || match[1] === undefined || match[2] === undefined) {
    return null;
  }
  return {
    kind: "PAGE_MARKER",
    pageNumber: Number.parseInt(match[1], 10),
    totalPages: Number.parseInt(match[2], 10),
    raw: line,
  };
}

export function parseAnnalenPage(line: string): AnnalenPageToken | null {
  const match = line.match(/^\[\[ANNALEN-PAGE\s+(\d+)\]\]$/);
  if (!match || match[1] === undefined) {
    return null;
  }
  return {
    kind: "ANNALEN_PAGE",
    printedPage: Number.parseInt(match[1], 10),
    raw: line,
  };
}

/**
 * Extracts all [[...]] tags from a string, keeping their positions.
 */
export function extractTags(text: string): TagToken[] {
  const tags: TagToken[] = [];
  const regex = /\[\[([A-Za-z0-9_/-]+)(?:\s+([\s\S]*?))?\]\]/g;
  let match: RegExpExecArray | null;

  while (true) {
    match = regex.exec(text);
    if (!match) break;
    const name = match[1] ?? "";
    const arg = match[2]?.trim();
    tags.push({
      kind: "TAG",
      name,
      arg: arg && arg.length > 0 ? arg : undefined,
      raw: match[0],
      startIndex: match.index,
      endIndex: regex.lastIndex,
    });
  }

  return tags;
}

/**
 * Finds all bracketed tag-like sequences [[...]] to detect unknown tags.
 */
export function extractAllBracketedTags(
  text: string,
): { tag: string; name: string; index: number }[] {
  const result: { tag: string; name: string; index: number }[] = [];
  const regex = /\[\[([\s\S]*?)\]\]/g;
  let match: RegExpExecArray | null;

  while (true) {
    match = regex.exec(text);
    if (!match) break;
    const full = match[0];
    const inner = match[1]?.trim() ?? "";
    const spaceIndex = inner.search(/\s/);
    const name = spaceIndex === -1 ? inner : inner.substring(0, spaceIndex);
    result.push({
      tag: full,
      name,
      index: match.index,
    });
  }

  return result;
}

/**
 * Detects whether a string has HTML-like syntax outside math.
 * Checks for `<` followed by a letter, `/`, or `!`.
 */
export function findHtmlOutsideMath(
  textWithoutMath: string,
): { index: number; match: string } | null {
  const match = textWithoutMath.match(/<[a-zA-Z/!]/);
  if (match && match.index !== undefined) {
    return { index: match.index, match: match[0] };
  }
  return null;
}
