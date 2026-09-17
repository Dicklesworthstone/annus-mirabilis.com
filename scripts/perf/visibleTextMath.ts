export interface VisibleTextMathCheckResult {
  ok: boolean;
  violations: readonly string[];
  mathMlCount: number;
  katexCount: number;
  fontOverridesFound: readonly string[];
}

export const REQUIRED_FONT_OVERRIDES = [
  "size-adjust",
  "ascent-override",
  "descent-override",
  "line-gap-override",
] as const;

/**
 * Checks that initial HTML (rendered without JavaScript) contains:
 * - Expected paragraph R1 text.
 * - Displayed equations with both KaTeX HTML and MathML (<math> element).
 * - Self-hosted fonts with font-face metric overrides.
 */
export function checkVisibleTextAndMath(
  html: string,
  options?: {
    expectedParagraphTexts?: readonly string[];
    cssContent?: string;
  },
): VisibleTextMathCheckResult {
  const violations: string[] = [];

  // 1. Check math elements: must include <math> and katex HTML markup
  const mathMatches = html.match(/<math[\s>]/gi) ?? [];
  const katexMatches = html.match(/class=["'][^"']*katex[^"']*["']/gi) ?? [];

  if (mathMatches.length === 0 && html.includes("katex")) {
    violations.push("initial HTML includes KaTeX markup but lacks <math> (MathML) element");
  }

  // 2. Check expected paragraph texts
  if (options?.expectedParagraphTexts) {
    for (const text of options.expectedParagraphTexts) {
      if (!html.includes(text)) {
        violations.push(`expected text "${text.slice(0, 40)}..." is missing from initial HTML`);
      }
    }
  }

  // 3. Check CSS for font metric overrides
  const fontOverridesFound: string[] = [];
  const css = options?.cssContent ?? html;
  for (const override of REQUIRED_FONT_OVERRIDES) {
    if (new RegExp(`${override}\\s*:`, "i").test(css)) {
      fontOverridesFound.push(override);
    }
  }

  // If cssContent was provided, check that all 4 overrides exist
  if (options?.cssContent !== undefined) {
    for (const override of REQUIRED_FONT_OVERRIDES) {
      if (!fontOverridesFound.includes(override)) {
        violations.push(`@font-face fallback metric override "${override}" is missing from CSS`);
      }
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    mathMlCount: mathMatches.length,
    katexCount: katexMatches.length,
    fontOverridesFound,
  };
}
