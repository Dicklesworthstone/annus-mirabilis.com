/**
 * Inline node definitions, Unicode code-point measurement, and plain text extraction.
 * Specification: AGENTS.md and am-cm-schemas-source-1en
 */

export type TextInline = Readonly<{
  kind: "text";
  text: string;
}>;

export type EmphasisInline = Readonly<{
  kind: "emphasis";
  inlines: readonly Inline[];
}>;

export type MathInline = Readonly<{
  kind: "math";
  latex: string;
  equationId?: string | undefined;
  inlineId?: string | undefined;
}>;

export type FootnoteMarkInline = Readonly<{
  kind: "footnote-mark";
  mark: string;
  footnoteId: string;
}>;

export type TermInline = Readonly<{
  kind: "term";
  text: string;
  termId: string;
  definition?: string | undefined;
}>;

export type ReferenceInline = Readonly<{
  kind: "reference";
  text: string;
  targetId: string;
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
        res += node.latex || "";
        break;
      case "footnote-mark":
        res += node.mark || "";
        break;
      case "term":
        res += node.text || "";
        break;
      case "reference":
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

  switch (kind) {
    case "text":
      if (typeof o.text !== "string") throw new Error(`${path}: text is required.`);
      return { kind: "text", text: o.text };
    case "emphasis":
      if (!Array.isArray(o.inlines)) throw new Error(`${path}: inlines array is required.`);
      return {
        kind: "emphasis",
        inlines: o.inlines.map((item, i) => validateInline(item, `${path}.inlines[${i}]`)),
      };
    case "math":
      if (typeof o.latex !== "string") throw new Error(`${path}: latex is required.`);
      return {
        kind: "math",
        latex: o.latex,
        ...(typeof o.equationId === "string" ? { equationId: o.equationId } : {}),
        ...(typeof o.inlineId === "string" ? { inlineId: o.inlineId } : {}),
      };
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
        ...(typeof o.definition === "string" ? { definition: o.definition } : {}),
      };
    case "reference":
      if (typeof o.text !== "string") throw new Error(`${path}: text is required.`);
      if (typeof o.targetId !== "string") throw new Error(`${path}: targetId is required.`);
      return { kind: "reference", text: o.text, targetId: o.targetId };
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
    default:
      throw new Error(`${path}: Unknown inline kind "${kind}".`);
  }
}
