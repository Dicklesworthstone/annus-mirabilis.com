/**
 * KaTeX parse settings and validator for mathematical expressions in reviewed ledgers.
 * Governed by bead am-edn-ledger-validator-edv and am-eq-static-katex-7da.
 *
 * Enforces strict error throwing, no trust, no macros, bounded expansion/size,
 * and rejects LaTeX macro definitions.
 */

import { renderToString } from "katex";

export const LEDGER_KATEX_SETTINGS = Object.freeze({
  throwOnError: true,
  strict: "error" as const,
  trust: false,
  macros: Object.freeze({}),
  maxExpand: 1000,
  maxSize: 20,
});

export type LedgerMathCode = "math-macro-definition" | "math-parse";

export type LedgerMathParseResult = Readonly<{
  ok: boolean;
  code?: LedgerMathCode | undefined;
  error?: string | undefined;
}>;

const MACRO_DEFINITION_PATTERN = /\\(?:def|gdef|edef|let|newcommand|renewcommand)(?=[^a-zA-Z]|$)/;

/**
 * Validates a mathematical expression against the strict ledger KaTeX settings.
 *
 * @param math The raw LaTeX string inside $...$ or $$...$$
 * @param displayMode True if validating a display equation ($$), false if inline ($)
 */
export function parseLedgerMath(math: string, displayMode: boolean = false): LedgerMathParseResult {
  const macroMatch = math.match(MACRO_DEFINITION_PATTERN);
  if (macroMatch) {
    return {
      ok: false,
      code: "math-macro-definition",
      error: `Macro definition "${macroMatch[0]}" is forbidden in reviewed ledger mathematics.`,
    };
  }

  try {
    // KaTeX public API: renderToString with output discarded
    renderToString(math, {
      ...LEDGER_KATEX_SETTINGS,
      displayMode,
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      code: "math-parse",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
