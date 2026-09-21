/**
 * Authored LaTeX exceptions parser and validator (am-eq-latex-generation-hc3).
 *
 * Implements Criterion 8:
 * - Authored exceptions using \amterm and \amop convert correctly
 * - Raw \htmlData in authored input fails (including in subscripts and \text{})
 * - Validates unmarked bound glyphs, unknown IDs, duplicate markers, and extra marker payloads
 */

import { wrapHtmlClass, wrapHtmlData } from "./markers.ts";
import { tokenizeLatex } from "./tokenize.ts";

export type AuthoredLatexErrorKind =
  | "raw-htmldata-forbidden"
  | "duplicate-marker"
  | "unknown-id"
  | "unmarked-bound-glyph"
  | "malformed-marker-payload";

export class AuthoredLatexError extends Error {
  readonly kind: AuthoredLatexErrorKind;
  readonly offset?: number | undefined;

  /** The code is the FIRST argument, as a kebab-case string literal, per the am-p465 ruling. */
  constructor(kind: AuthoredLatexErrorKind, message: string, offset?: number | undefined) {
    super(message);
    this.name = "AuthoredLatexError";
    this.kind = kind;
    this.offset = offset;
  }
}

export interface ConvertAuthoredOptions {
  readonly allowedIds?: ReadonlySet<string> | undefined;
  readonly expectedTermIds?: readonly string[] | undefined;
  readonly rolesById?: Readonly<Record<string, string>> | undefined;
}

export interface ConvertAuthoredResult {
  readonly latex: string;
  readonly termIds: readonly string[];
  readonly opIds: readonly string[];
}

/**
 * Validates and converts an authored LaTeX string containing \amterm and \amop
 * into standard marked KaTeX HTML markup.
 */
export function convertAuthoredLatex(
  input: string,
  options: ConvertAuthoredOptions = {},
): ConvertAuthoredResult {
  // Rule 1: Raw \htmlData and \htmlClass are strictly forbidden in authored input
  const rawHtmlMatch = /\\(htmlData|htmlClass)(?![a-zA-Z])/.exec(input);
  if (rawHtmlMatch) {
    const cmd = `\\${rawHtmlMatch[1]}`;
    throw new AuthoredLatexError(
      "raw-htmldata-forbidden",
      `Raw "${cmd}" is strictly forbidden in authored LaTeX at offset ${rawHtmlMatch.index}. Use \\amterm or \\amop instead.`,
      rawHtmlMatch.index,
    );
  }

  // Parse \amterm{id}{content} and \amop{id}{content}
  const termIds: string[] = [];
  const opIds: string[] = [];
  const seenIds = new Set<string>();

  let out = "";
  let i = 0;
  const len = input.length;

  while (i < len) {
    if (input.startsWith("\\amterm", i) || input.startsWith("\\amop", i)) {
      const isTerm = input.startsWith("\\amterm", i);
      const cmdLen = isTerm ? 7 : 5;
      const markerOffset = i;
      let p = i + cmdLen;

      // Skip whitespace
      while (p < len && /\s/.test(input[p] ?? "")) p++;

      // First brace: {id}
      if (p >= len || input[p] !== "{") {
        throw new AuthoredLatexError(
          "malformed-marker-payload",
          `Expected '{id}' after ${isTerm ? "\\amterm" : "\\amop"} at offset ${markerOffset}.`,
          markerOffset,
        );
      }

      const idStart = p + 1;
      const idEnd = input.indexOf("}", idStart);
      if (idEnd === -1) {
        throw new AuthoredLatexError(
          "malformed-marker-payload",
          `Unterminated '{id}' at offset ${idStart}.`,
          idStart,
        );
      }

      const id = input.slice(idStart, idEnd).trim();
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        throw new AuthoredLatexError(
          "malformed-marker-payload",
          `Marker ID "${id}" contains extra payload or invalid characters at offset ${idStart}.`,
          idStart,
        );
      }

      if (seenIds.has(id)) {
        throw new AuthoredLatexError(
          "duplicate-marker",
          `Duplicate marker ID "${id}" encountered at offset ${idStart}.`,
          idStart,
        );
      }
      seenIds.add(id);

      if (options.allowedIds && !options.allowedIds.has(id)) {
        throw new AuthoredLatexError(
          "unknown-id",
          `Unknown marker ID "${id}" at offset ${idStart}. Not in allowed ID set.`,
          idStart,
        );
      }

      p = idEnd + 1;
      while (p < len && /\s/.test(input[p] ?? "")) p++;

      // Second brace: {content}
      if (p >= len || input[p] !== "{") {
        throw new AuthoredLatexError(
          "malformed-marker-payload",
          `Expected '{content}' for marker "${id}" at offset ${p}.`,
          p,
        );
      }

      const contentStart = p + 1;
      // Balance braces for content
      let braceDepth = 1;
      let contentEnd = contentStart;
      while (contentEnd < len && braceDepth > 0) {
        if (input[contentEnd] === "\\") {
          contentEnd += 2;
          continue;
        }
        if (input[contentEnd] === "{") braceDepth++;
        if (input[contentEnd] === "}") braceDepth--;
        if (braceDepth === 0) break;
        contentEnd++;
      }

      if (braceDepth !== 0) {
        throw new AuthoredLatexError(
          "malformed-marker-payload",
          `Unterminated '{content}' for marker "${id}" at offset ${contentStart}.`,
          contentStart,
        );
      }

      const content = input.slice(contentStart, contentEnd);
      // Recursively convert content in case of nested markers
      const convertedContent = convertAuthoredLatex(content, {
        allowedIds: options.allowedIds,
        rolesById: options.rolesById,
      }).latex;

      let renderedMarker: string;
      if (isTerm) {
        termIds.push(id);
        const role = options.rolesById?.[id] ?? "input";
        const withClass = wrapHtmlClass(role, convertedContent);
        renderedMarker = wrapHtmlData("term", id, withClass);
      } else {
        opIds.push(id);
        renderedMarker = wrapHtmlData("op", id, convertedContent);
      }

      out += renderedMarker;
      i = contentEnd + 1;
      continue;
    }

    out += input[i] ?? "";
    i++;
  }

  // Check for unmarked bound glyphs
  if (options.expectedTermIds) {
    for (const expected of options.expectedTermIds) {
      if (!seenIds.has(expected)) {
        throw new AuthoredLatexError(
          "unmarked-bound-glyph",
          `Expected bound term "${expected}" was not marked in authored LaTeX.`,
        );
      }
    }
  }

  // Validate the resulting LaTeX syntax with strict tokenizer
  tokenizeLatex(out);

  return {
    latex: out,
    termIds: Object.freeze(termIds),
    opIds: Object.freeze(opIds),
  };
}
