/**
 * Brace-aware LaTeX tokenizer (am-eq-latex-generation-hc3).
 *
 * Implements Criterion 7:
 * - Reports every control sequence and environment name at every nesting depth
 * - Returns typed errors with exact offsets for unbalanced or unterminated input
 * - Shared across equation rendering and static KaTeX scan (am-eq-static-katex-7da)
 */

export type LatexTokenKind =
  | "control-word"
  | "control-symbol"
  | "environment-begin"
  | "environment-end"
  | "group-open"
  | "group-close"
  | "subscript"
  | "superscript"
  | "text"
  | "whitespace";

export interface LatexToken {
  readonly kind: LatexTokenKind;
  readonly value: string;
  readonly offset: number;
  readonly depth: number;
  readonly environmentName?: string | undefined;
}

export type LatexTokenizerErrorKind =
  | "unbalanced-open-brace"
  | "unbalanced-close-brace"
  | "trailing-backslash"
  | "mismatched-environment"
  | "unterminated-environment";

export class LatexTokenizerError extends Error {
  readonly kind: LatexTokenizerErrorKind;
  readonly offset: number;

  /** The code is the FIRST argument, as a kebab-case string literal, per the am-p465 ruling. */
  constructor(kind: LatexTokenizerErrorKind, message: string, offset: number) {
    super(message);
    this.name = "LatexTokenizerError";
    this.kind = kind;
    this.offset = offset;
  }
}

interface OpenEnvironment {
  readonly name: string;
  readonly offset: number;
  readonly depth: number;
}

/**
 * Tokenizes a LaTeX mathematical expression, tracking nesting depth and validating
 * balanced braces and environment pairing.
 */
export function tokenizeLatex(input: string): readonly LatexToken[] {
  const tokens: LatexToken[] = [];
  const len = input.length;
  let i = 0;
  let depth = 0;

  const braceStack: number[] = [];
  const envStack: OpenEnvironment[] = [];

  while (i < len) {
    const ch = input[i] ?? "";

    if (ch === "{") {
      tokens.push({
        kind: "group-open",
        value: "{",
        offset: i,
        depth,
      });
      braceStack.push(i);
      depth++;
      i++;
      continue;
    }

    if (ch === "}") {
      if (depth === 0 || braceStack.length === 0) {
        throw new LatexTokenizerError(
          "unbalanced-close-brace",
          `Extra or unbalanced closing brace '}' at offset ${i}.`,
          i,
        );
      }
      depth--;
      braceStack.pop();
      tokens.push({
        kind: "group-close",
        value: "}",
        offset: i,
        depth,
      });
      i++;
      continue;
    }

    if (ch === "_") {
      tokens.push({
        kind: "subscript",
        value: "_",
        offset: i,
        depth,
      });
      i++;
      continue;
    }

    if (ch === "^") {
      tokens.push({
        kind: "superscript",
        value: "^",
        offset: i,
        depth,
      });
      i++;
      continue;
    }

    if (/\s/.test(ch)) {
      const start = i;
      while (i < len && /\s/.test(input[i] ?? "")) {
        i++;
      }
      tokens.push({
        kind: "whitespace",
        value: input.slice(start, i),
        offset: start,
        depth,
      });
      continue;
    }

    if (ch === "\\") {
      const start = i;
      i++; // consume backslash

      if (i >= len) {
        throw new LatexTokenizerError(
          "trailing-backslash",
          `Trailing lone backslash at offset ${start}.`,
          start,
        );
      }

      const nextChar = input[i] ?? "";

      // Control symbol (non-alpha character)
      if (!/[a-zA-Z]/.test(nextChar)) {
        const value = `\\${nextChar}`;
        tokens.push({
          kind: "control-symbol",
          value,
          offset: start,
          depth,
        });
        i++;
        continue;
      }

      // Control word (letters)
      const wordStart = i;
      while (i < len && /[a-zA-Z]/.test(input[i] ?? "")) {
        i++;
      }
      const word = input.slice(wordStart, i);
      const command = `\\${word}`;

      // Check for \begin{env} or \end{env}
      if (word === "begin" || word === "end") {
        // Skip whitespace between \begin and {
        let p = i;
        while (p < len && /\s/.test(input[p] ?? "")) p++;
        if (p < len && input[p] === "{") {
          const envNameStart = p + 1;
          const closeBrace = input.indexOf("}", envNameStart);
          if (closeBrace !== -1) {
            const envName = input.slice(envNameStart, closeBrace).trim();
            if (word === "begin") {
              tokens.push({
                kind: "environment-begin",
                value: command,
                offset: start,
                depth,
                environmentName: envName,
              });
              envStack.push({ name: envName, offset: start, depth });
              i = closeBrace + 1;
              continue;
            } else {
              // word === "end"
              const openEnv = envStack.pop();
              if (!openEnv || openEnv.name !== envName) {
                throw new LatexTokenizerError(
                  "mismatched-environment",
                  `Mismatched environment: expected \\end{${openEnv?.name ?? "none"}}, got \\end{${envName}} at offset ${start}.`,
                  start,
                );
              }
              tokens.push({
                kind: "environment-end",
                value: command,
                offset: start,
                depth,
                environmentName: envName,
              });
              i = closeBrace + 1;
              continue;
            }
          }
        }
      }

      tokens.push({
        kind: "control-word",
        value: command,
        offset: start,
        depth,
      });
      continue;
    }

    // Normal text / symbols / digits
    const start = i;
    while (
      i < len &&
      input[i] !== "{" &&
      input[i] !== "}" &&
      input[i] !== "\\" &&
      input[i] !== "_" &&
      input[i] !== "^" &&
      !/\s/.test(input[i] ?? "")
    ) {
      i++;
    }
    tokens.push({
      kind: "text",
      value: input.slice(start, i),
      offset: start,
      depth,
    });
  }

  if (braceStack.length > 0) {
    const unclosedOffset = braceStack[braceStack.length - 1] ?? 0;
    throw new LatexTokenizerError(
      "unbalanced-open-brace",
      `Unbalanced open brace '{' at offset ${unclosedOffset} (unterminated before end of input).`,
      unclosedOffset,
    );
  }

  if (envStack.length > 0) {
    const unclosedEnv = envStack[envStack.length - 1];
    if (unclosedEnv) {
      throw new LatexTokenizerError(
        "unterminated-environment",
        `Unterminated environment \\begin{${unclosedEnv.name}} opened at offset ${unclosedEnv.offset}.`,
        unclosedEnv.offset,
      );
    }
  }

  return Object.freeze(tokens);
}
