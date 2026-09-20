/**
 * Linter for authored spoken mathematics text (am-eq-spoken-forms-w4f).
 * Specification: AGENTS.md, am-eq-spoken-forms-w4f.
 *
 * Catches raw LaTeX, dollar signs, unannounced integrals, misleading variable names,
 * and unnatural fraction voicing ("d over d t").
 */

import type { SpokenFormLintFinding, SpokenFormLintResult } from "./types.ts";

const RAW_LATEX_PATTERN = /\\[a-zA-Z]+|\\[0-9]+/g;
const DOLLAR_DELIMITER_PATTERN = /\$|\\[()[\]]/g;
const HTML_TAG_PATTERN = /<\/?[a-zA-Z][^>]*>/g;
const D_OVER_DT_PATTERN =
  /\b(?:d|partial)\s+over\s+(?:d|partial)\s*[a-zA-Z]\b|\b(?:d|partial)\s+over\s+[a-zA-Z]\b/i;

export interface LintSpokenFormOptions {
  readonly boundTerms?: readonly string[] | undefined;
  readonly notationContext?: string | undefined;
}

export function lintSpokenForm(
  text: string,
  options?: LintSpokenFormOptions,
): SpokenFormLintResult {
  const findings: SpokenFormLintFinding[] = [];

  if (!text || typeof text !== "string") {
    findings.push({
      severity: "error",
      rule: "no-raw-latex",
      message: "Spoken form must be a non-empty string.",
    });
    return {
      valid: false,
      findings,
      errors: findings,
      warnings: [],
    };
  }

  // 1. Check for raw LaTeX commands (e.g. \frac, \sqrt, \beta)
  const latexMatches = text.match(RAW_LATEX_PATTERN);
  if (latexMatches) {
    for (const match of latexMatches) {
      findings.push({
        severity: "error",
        rule: "no-raw-latex",
        message: `Raw LaTeX command "${match}" found in spoken form. Use plain English words like "fraction", "square root", or symbol names.`,
        match,
      });
    }
  }

  // 2. Check for dollar signs or math delimiters (e.g. $, $$, \()
  const dollarMatches = text.match(DOLLAR_DELIMITER_PATTERN);
  if (dollarMatches) {
    for (const match of dollarMatches) {
      findings.push({
        severity: "error",
        rule: "no-dollar-delimiters",
        message: `Math delimiter "${match}" found in spoken form. Spoken text must be pure natural language.`,
        match,
      });
    }
  }

  // 3. Check for HTML tags
  const htmlMatches = text.match(HTML_TAG_PATTERN);
  if (htmlMatches) {
    for (const match of htmlMatches) {
      findings.push({
        severity: "error",
        rule: "no-html-tags",
        message: `HTML markup "${match}" found in spoken form.`,
        match,
      });
    }
  }

  // 4. Check for "x prime" if notationContext indicates moving-frame coordinate
  if (/\bx\s*prime\b/i.test(text)) {
    const isRelativityContext =
      options?.notationContext === "special-relativity" ||
      options?.notationContext === "moving-frame" ||
      text.toLowerCase().includes("moving system") ||
      text.toLowerCase().includes("moving coordinate");

    findings.push({
      severity: "warning",
      rule: "no-x-prime-for-xi",
      message: isRelativityContext
        ? 'Phrase "x prime" used for moving coordinate; in 1905 relativity, moving coordinate is xi (xi), while x prime is an auxiliary coordinate in §3.'
        : 'Phrase "x prime" detected; verify if this refers to moving coordinate xi or auxiliary Galilean coordinate x\'.',
      match: "x prime",
    });
  }

  // 5. Check for unstated integral variable ("integral" without "with respect to" or "d[var]" or "over")
  if (/\bintegral\b|\bintegrate\b/i.test(text)) {
    const hasVariable =
      /\bwith\s+respect\s+to\b|\bover\b|\bfrom\b|\bof\s+[a-zA-Z\s]+\s+d[a-zA-Z]\b|\bdefinite\s+integral\b/i.test(
        text,
      );
    if (!hasVariable) {
      findings.push({
        severity: "warning",
        rule: "unstated-integral-variable",
        message:
          'Spoken integral does not state the variable of integration. Specify e.g. "with respect to x" or "from a to b".',
        match: "integral",
      });
    }
  }

  // 6. Check for naive "d over d t" voicing
  const dOverDtMatch = text.match(D_OVER_DT_PATTERN);
  if (dOverDtMatch) {
    findings.push({
      severity: "warning",
      rule: "no-d-over-dt",
      message: `Phrase "${dOverDtMatch[0]}" found. Voice derivatives naturally, e.g. "derivative with respect to t" or "partial derivative with respect to x".`,
      match: dOverDtMatch[0],
    });
  }

  // 7. Check for unmentioned bound terms
  if (options?.boundTerms && options.boundTerms.length > 0) {
    const textLower = text.toLowerCase();
    for (const term of options.boundTerms) {
      const termLower = term.toLowerCase().replace(/_/g, " ");
      if (!textLower.includes(termLower) && !textLower.includes(term.toLowerCase())) {
        findings.push({
          severity: "warning",
          rule: "unmentioned-bound-term",
          message: `Bound term "${term}" does not appear to be mentioned in spoken form.`,
          match: term,
        });
      }
    }
  }

  const errors = findings.filter((f) => f.severity === "error");
  const warnings = findings.filter((f) => f.severity === "warning");

  return {
    valid: errors.length === 0,
    findings,
    errors,
    warnings,
  };
}
