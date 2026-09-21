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
  maxExpand: 1000,
  maxSize: 20,
});

/**
 * A FRESH, WRITABLE macros object per call. KaTeX writes its own bookkeeping into this
 * object when it processes an environment - `\begin{aligned}` among them - so a frozen or
 * shared one is not a stricter setting, it is a broken one.
 *
 * `macros: Object.freeze({})` stood here until 2026-09-20 and made KaTeX throw
 * "Attempting to define property on object that is not extensible", which the ledger
 * validator then reported as `math-parse` - a code that reads as "the editor mistyped the
 * LaTeX". Measured: `\begin{aligned}...\end{aligned}` fails with the frozen object and
 * passes with a plain one, while an ordinary equation passes with either. It was found
 * transcribing ap-18-639, whose page 641 prints a two-line aligned pair of equations that
 * no faithful transcription can express without an alignment environment.
 *
 * NOTHING IS LOOSENED BY THIS. The prohibition on macros is enforced by
 * MACRO_DEFINITION_PATTERN below, which refuses the source text before KaTeX ever runs,
 * and no macro is predefined here. Freezing an empty object never protected anything; it
 * only stopped KaTeX from doing its own internal bookkeeping.
 */
function freshMacros(): Record<string, string> {
  return {};
}

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
      macros: freshMacros(),
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
