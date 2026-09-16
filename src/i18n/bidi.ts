/**
 * Bidirectional text and LTR isolation primitives for mathematics in RTL prose.
 *
 * Requirements:
 * - Mathematics and numeric expressions inside RTL prose are isolated as LTR in render payloads (<bdi dir="ltr"> or Unicode isolates U+2066...U+2069).
 * - Equations and graph axes are never mirrored.
 * - Directional isolates must be balanced.
 *
 * Spec: AGENTS.md and am-cm-i18n-readiness-b2g
 */

import { getDefaultDirection, isRtlLanguage, type TextDirection } from "./language.ts";

export const LRI = "\u2066"; // LEFT-TO-RIGHT ISOLATE
export const RLI = "\u2067"; // RIGHT-TO-LEFT ISOLATE
export const FSI = "\u2068"; // FIRST STRONG ISOLATE
export const PDI = "\u2069"; // POP DIRECTIONAL ISOLATE

export const getDirectionForLanguage = getDefaultDirection;

export { getDefaultDirection, isRtlLanguage, type TextDirection };

/**
 * Wraps a LaTeX formula or mathematical expression in an HTML <bdi dir="ltr"> element.
 */
export function isolateLtrMathHtml(math: string): string {
  return `<bdi dir="ltr">${math}</bdi>`;
}

/**
 * Wraps a LaTeX formula or mathematical expression with Unicode LTR isolate characters (U+2066 ... U+2069).
 */
export function isolateLtrMathUnicode(math: string): string {
  return `${LRI}${math}${PDI}`;
}

/**
 * Checks whether all Unicode directional isolate characters (LRI, RLI, FSI) in the text
 * have matching Pop Directional Isolate (PDI) characters and are properly balanced.
 */
export function isIsolateBalanced(text: string): boolean {
  if (typeof text !== "string") return false;
  let depth = 0;
  for (const char of text) {
    if (char === LRI || char === RLI || char === FSI) {
      depth++;
    } else if (char === PDI) {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

/**
 * Scans text for mathematical formulas (e.g. $...$, \\(...\\), or math expressions containing LaTeX symbols/operators)
 * and isolates them as LTR using HTML or Unicode isolate characters.
 */
export function isolateMathInRtlText(text: string, mode: "html" | "unicode" = "unicode"): string {
  if (!text || typeof text !== "string") return "";

  // Match $...$ or \(...\) or explicit math tokens
  const mathPattern = /(\$[^$]+\$|\\\([^\\]+\\\)|\\[a-zA-Z]+(?:_[a-zA-Z0-9]+)?\s*=\s*[^.\s,]+)/g;

  return text.replace(mathPattern, (match) => {
    return mode === "html" ? isolateLtrMathHtml(match) : isolateLtrMathUnicode(match);
  });
}
