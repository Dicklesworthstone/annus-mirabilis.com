/**
 * Authored LaTeX exceptions parser and validator (am-eq-latex-generation-hc3).
 *
 * Implements Criterion 8:
 * - Authored exceptions using \amterm and \amop convert correctly
 * - Raw \htmlData in authored input fails (including in subscripts and \text{})
 * - Validates unmarked bound glyphs, unknown IDs, duplicate markers, and extra marker payloads
 */

import { wrapHtmlClass, wrapHtmlData } from "./markers.ts";
import { type LatexToken, LatexTokenizerError, tokenizeLatex } from "./tokenize.ts";

export type AuthoredLatexErrorKind =
  | "raw-htmldata-forbidden"
  | "duplicate-marker"
  | "unknown-id"
  | "unmarked-bound-glyph"
  | "malformed-marker-payload";

export class AuthoredLatexError extends Error {
  readonly kind: AuthoredLatexErrorKind;
  readonly offset?: number | undefined;

  constructor(options: {
    message: string;
    kind: AuthoredLatexErrorKind;
    offset?: number | undefined;
  }) {
    super(options.message);
    this.name = "AuthoredLatexError";
    this.kind = options.kind;
    this.offset = options.offset;
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
  const tokens = tokenizeLatex(input);

  // Rule 1: Raw \htmlData is strictly forbidden in authored input
  for (const token of tokens) {
    if (token.kind === "control-word" && (token.value === "\\htmlData" || token.value === "\\htmlClass")) {
      throw new AuthoredLatexError({
        kind: "raw-htmldata-forbidden",
        offset: token.offset,
        message: `Raw "${token.value}" is strictly forbidden in authored LaTeX at offset ${token.offset}. Use \\amterm or \\amop instead.`,
      });
    }
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
        throw new AuthoredLatexError({
          kind: "malformed-marker-payload",
          offset: markerOffset,
          message: `Expected '{id}' after ${isTerm ? "\\amterm" : "\\amop"} at offset ${markerOffset}.`,
        });
      }

      const idStart = p + 1;
      const idEnd = input.indexOf("}", idStart);
      if (idEnd === -1) {
        throw new AuthoredLatexError({
          kind: "malformed-marker-payload",
          offset: idStart,
          message: `Unterminated '{id}' at offset ${idStart}.`,
        });
      }

      const id = input.slice(idStart, idEnd).trim();
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        throw new AuthoredLatexError({
          kind: "malformed-marker-payload",
          offset: idStart,
          message: `Marker ID "${id}" contains extra payload or invalid characters at offset ${idStart}.`,
        });
      }

      if (seenIds.has(id)) {
        throw new AuthoredLatexError({
          kind: "duplicate-marker",
          offset: idStart,
          message: `Duplicate marker ID "${id}" encountered at offset ${idStart}.`,
        });
      }
      seenIds.add(id);

      if (options.allowedIds && !options.allowedIds.has(id)) {
        throw new AuthoredLatexError({
          kind: "unknown-id",
          offset: idStart,
          message: `Unknown marker ID "${id}" at offset ${idStart}. Not in allowed ID set.`,
        });
      }

      p = idEnd + 1;
      while (p < len && /\s/.test(input[p] ?? "")) p++;

      // Second brace: {content}
      if (p >= len || input[p] !== "{") {
        throw new AuthoredLatexError({
          kind: "malformed-marker-payload",
          offset: p,
          message: `Expected '{content}' for marker "${id}" at offset ${p}.`,
        });
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
        throw new AuthoredLatexError({
          kind: "malformed-marker-payload",
          offset: contentStart,
          message: `Unterminated '{content}' for marker "${id}" at offset ${contentStart}.`,
        });
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
        throw new AuthoredLatexError({
          kind: "unmarked-bound-glyph",
          message: `Expected bound term "${expected}" was not marked in authored LaTeX.`,
        });
      }
    }
  }

  return {
    latex: out,
    termIds: Object.freeze(termIds),
    opIds: Object.freeze(opIds),
  };
}
