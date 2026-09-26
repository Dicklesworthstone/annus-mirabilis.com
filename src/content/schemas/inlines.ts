/**
 * Inline node definitions, Unicode code-point measurement, and plain text extraction.
 * Specification: AGENTS.md and am-cm-schemas-source-1en
 */

import { validateDirection, validateLanguageTag } from "../../i18n/language.ts";

export type TextInline = Readonly<{
  kind: "text";
  text: string;
  lang?: string | undefined;
  dir?: "ltr" | "rtl" | undefined;
}>;

export type EmphasisInline = Readonly<{
  kind: "emphasis";
  inlines: readonly Inline[];
  lang?: string | undefined;
  dir?: "ltr" | "rtl" | undefined;
}>;

export type MathInline = Readonly<{
  kind: "math";
  latex: string;
  /** true for a reference to a displayed equation block printed at this position; a display
   * math inline carries no inlineId and contributes no characters to plainText() (it names the
   * block, the block owns the printed text). Absent or false for an authored inline expression,
   * which may carry inlineId but never equationId. */
  display?: boolean | undefined;
  equationId?: string | undefined;
  inlineId?: string | undefined;
}>;

export type FootnoteMarkInline = Readonly<{
  kind: "footnote-mark";
  mark: string;
  footnoteId: string;
}>;

type TermInlineFields = Readonly<{
  kind: "term";
  text: string;
  termId: string;
  definition?: string | undefined;
  lang?: string | undefined;
  dir?: "ltr" | "rtl" | undefined;
}>;

export type ReferenceInline = Readonly<{
  kind: "reference";
  text: string;
  targetId: string;
  lang?: string | undefined;
  dir?: "ltr" | "rtl" | undefined;
}>;

export type CitationRefInline = Readonly<{
  kind: "citation-ref";
  citationId: string;
  locator?: string | undefined;
}>;

export type SpaceInline = Readonly<{
  kind: "space";
  count?: number | undefined;
}>;

export type LineBreakInline = Readonly<{
  kind: "line-break";
}>;

export type Inline =
  | TextInline
  | EmphasisInline
  | MathInline
  | FootnoteMarkInline
  | TermInline
  | ReferenceInline
  | MisprintInline
  | CitationRefInline
  | SpaceInline
  | LineBreakInline;

/**
 * Extracts plain unformatted text from a sequence of inline nodes.
 */
export function plainText(inlinesOrText: readonly Inline[] | string): string {
  if (typeof inlinesOrText === "string") return inlinesOrText;
  if (!Array.isArray(inlinesOrText)) return "";

  let res = "";
  for (const node of inlinesOrText) {
    if (!node || typeof node !== "object") continue;
    switch (node.kind) {
      case "text":
        res += node.text || "";
        break;
      case "emphasis":
        res += plainText(node.inlines);
        break;
      case "math":
        if (!node.display) res += node.latex || "";
        break;
      case "footnote-mark":
        res += node.mark || "";
        break;
      case "term":
      case "reference":
      case "misprint":
        res += node.text || "";
        break;
      case "citation-ref":
        // Citation references don't add semantic body words, or add locator
        if (node.locator) res += ` (${node.locator})`;
        break;
      case "space":
        res += " ".repeat(node.count || 1);
        break;
      case "line-break":
        res += "\n";
        break;
    }
  }
  return res;
}

/**
 * Computes length of text in Unicode code points (handling emoji, surrogate pairs, and combining marks).
 */
export function codePointLength(text: string): number {
  return Array.from(text).length;
}

/**
 * Slices a string by Unicode code-point indices [start, end).
 */
export function codePointSlice(text: string, start: number, end?: number): string {
  const points = Array.from(text);
  const sliced = end !== undefined ? points.slice(start, end) : points.slice(start);
  return sliced.join("");
}

export function validateInline(node: unknown, path = "inline"): Inline {
  if (!node || typeof node !== "object") {
    throw new Error(`${path}: Expected an inline object.`);
  }
  const o = node as Record<string, unknown>;
  const kind = o.kind as string;

  const lang = o.lang !== undefined ? validateLanguageTag(o.lang, `${path}.lang`) : undefined;
  const dir = o.dir !== undefined ? validateDirection(o.dir, `${path}.dir`) : undefined;

  switch (kind) {
    case "text":
      if (typeof o.text !== "string") throw new Error(`${path}: text is required.`);
      return {
        kind: "text",
        text: o.text,
        ...(lang ? { lang } : {}),
        ...(dir ? { dir } : {}),
      };
    case "emphasis":
      if (!Array.isArray(o.inlines)) throw new Error(`${path}: inlines array is required.`);
      return {
        kind: "emphasis",
        inlines: o.inlines.map((item, i) => validateInline(item, `${path}.inlines[${i}]`)),
        ...(lang ? { lang } : {}),
        ...(dir ? { dir } : {}),
      };
    case "math": {
      if (typeof o.latex !== "string") throw new Error(`${path}: latex is required.`);
      const display = o.display === true;
      // Not yet enforced: requiring equationId when display is true, or forbidding equationId
      // when display is absent. Existing bilingual-faces fixtures reference an equation block's
      // id from a non-display math inline without the flag, and tightening this now would
      // reject that live, in-flight content rather than this bead's own new fixtures. See
      // am-cm-schemas-source-1en's BATCH_PENDING for the coordination this needs.
      if (display && typeof o.inlineId === "string") {
        throw new Error(
          `${path}: a display math inline (display: true) must not carry an inlineId; it references an equation block by id instead.`,
        );
      }
      return {
        kind: "math",
        latex: o.latex,
        ...(o.display !== undefined ? { display } : {}),
        ...(typeof o.equationId === "string" ? { equationId: o.equationId } : {}),
        ...(typeof o.inlineId === "string" ? { inlineId: o.inlineId } : {}),
      };
    }
    case "footnote-mark":
      if (typeof o.mark !== "string") throw new Error(`${path}: mark is required.`);
      if (typeof o.footnoteId !== "string") throw new Error(`${path}: footnoteId is required.`);
      return { kind: "footnote-mark", mark: o.mark, footnoteId: o.footnoteId };
    case "term":
      if (typeof o.text !== "string") throw new Error(`${path}: text is required.`);
      if (typeof o.termId !== "string") throw new Error(`${path}: termId is required.`);
      return {
        kind: "term",
        text: o.text,
        termId: o.termId,
        ...definitionOf(o, path),
        ...(lang ? { lang } : {}),
        ...(dir ? { dir } : {}),
      };
    case "reference":
      if (typeof o.text !== "string") throw new Error(`${path}: text is required.`);
      if (typeof o.targetId !== "string") throw new Error(`${path}: targetId is required.`);
      return {
        kind: "reference",
        text: o.text,
        targetId: o.targetId,
        ...(lang ? { lang } : {}),
        ...(dir ? { dir } : {}),
      };
    case "citation-ref":
      if (typeof o.citationId !== "string") throw new Error(`${path}: citationId is required.`);
      return {
        kind: "citation-ref",
        citationId: o.citationId,
        ...(typeof o.locator === "string" ? { locator: o.locator } : {}),
      };
    case "space":
      return {
        kind: "space",
        ...(typeof o.count === "number" ? { count: o.count } : {}),
      };
    case "line-break":
      return { kind: "line-break" };
    case "misprint":
      if (
        typeof o.text !== "string" ||
        o.text.length === 0 ||
        typeof o.recordId !== "string" ||
        !/^[a-z0-9][a-z0-9-]*$/.test(o.recordId)
      )
        throw new MisprintInlineError(
          "misprint-without-record",
          `${path}: a misprint needs its word as printed and the id of its receipt record.`,
        );
      return {
        kind: "misprint",
        text: o.text,
        recordId: o.recordId,
        ...(lang ? { lang } : {}),
        ...(dir ? { dir } : {}),
      };
    default:
      throw new Error(`${path}: Unknown inline kind "${kind}".`);
  }
}

/*
 * Kept at the end of the file so that no refusal site above moves: the ratchets cite them by line.
 * `definitionLang` is the language of the definition when it differs from the term's: an English
 * note on a German word is `lang: de` with `definitionLang: en`, so a screen reader reads each in
 * its own voice.
 */
export type TermInline = TermInlineFields & Readonly<{ definitionLang?: string | undefined }>;

/** A term's definition and, when given, the definition's own language. */
function definitionOf(
  o: Record<string, unknown>,
  path: string,
): { definition?: string; definitionLang?: string } {
  return {
    ...(typeof o.definition === "string" ? { definition: o.definition } : {}),
    ...(o.definitionLang !== undefined
      ? { definitionLang: validateLanguageTag(o.definitionLang, `${path}.definitionLang`) }
      : {}),
  };
}

/**
 * A word the 1905 compositor set wrongly, kept exactly as printed and marked against the receipt
 * record that explains it (docs/provenance/<key>.md, typographicalErrors; dispatch 262). `text` is
 * the printed word, so marking a block changes no character of its German text. The reading meant
 * and the reason come from the record (src/content/provenance/misprints.ts), never from here.
 */
export type MisprintInline = Readonly<{
  kind: "misprint";
  text: string;
  recordId: string;
  lang?: string | undefined;
  dir?: "ltr" | "rtl" | undefined;
}>;

/** A misprint inline that cannot be marked: its printed word or its record id is missing. */
export class MisprintInlineError extends Error {
  constructor(
    readonly code: "misprint-without-record",
    message: string,
  ) {
    super(message);
    this.name = "MisprintInlineError";
  }
}
