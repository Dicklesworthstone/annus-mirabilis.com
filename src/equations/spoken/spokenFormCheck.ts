/**
 * Compiler check for equation spoken forms and accessibility payloads (am-eq-spoken-forms-w4f).
 * Specification: AGENTS.md, am-eq-spoken-forms-w4f.
 */

import { lintSpokenForm } from "./lintSpokenForm.ts";
import type { SpokenFormLintFinding, SpokenForms } from "./types.ts";

export interface EquationAccessibilityPayload {
  readonly id: string;
  readonly paper: string;
  readonly title: string;
  readonly spoken?: string | undefined;
  readonly spokenForms?: SpokenForms | undefined;
  readonly plainLatexPrinted?: string | undefined;
  readonly plainLatexModern?: string | undefined;
  readonly boundTerms?: readonly string[] | undefined;
}

export type AccessibilityCheckRule =
  | "missing-spoken-form"
  | "missing-accessibility-alternative"
  | "lint-error"
  | "lint-warning";

export interface AccessibilityCheckDiagnostic {
  readonly severity: "error" | "warning";
  readonly rule: AccessibilityCheckRule;
  readonly equationId: string;
  readonly subKind?: string | undefined;
  readonly message: string;
  readonly finding?: SpokenFormLintFinding | undefined;
}

export interface AccessibilityCheckResult {
  readonly valid: boolean;
  readonly diagnostics: readonly AccessibilityCheckDiagnostic[];
  readonly errors: readonly AccessibilityCheckDiagnostic[];
  readonly warnings: readonly AccessibilityCheckDiagnostic[];
}

/**
 * Validates the accessibility and spoken forms of an equation record.
 */
export function checkEquationAccessibility(
  payload: EquationAccessibilityPayload,
  options?: { readonly requireAlternate?: boolean },
): AccessibilityCheckResult {
  const diagnostics: AccessibilityCheckDiagnostic[] = [];
  const { id, spoken, spokenForms, plainLatexPrinted, plainLatexModern, boundTerms } = payload;

  const printedSpoken = spokenForms?.printed ?? spoken;
  const modernSpoken = spokenForms?.modern ?? spoken;
  const alternateSpoken = spokenForms?.alternate;

  // 1. Primary spoken form must be present
  if (!printedSpoken || !printedSpoken.trim()) {
    diagnostics.push({
      severity: "error",
      rule: "missing-spoken-form",
      equationId: id,
      message: `Equation "${id}" is missing primary authored spoken text.`,
    });
  }

  // 2. Check if notation rename requires distinct modern spoken form
  const hasDistinctModernLatex =
    Boolean(plainLatexPrinted) &&
    Boolean(plainLatexModern) &&
    plainLatexPrinted?.trim() !== plainLatexModern?.trim();

  if (hasDistinctModernLatex) {
    if (!spokenForms?.modern || !spokenForms.modern.trim()) {
      diagnostics.push({
        severity: "error",
        rule: "missing-accessibility-alternative",
        equationId: id,
        subKind: "missing-modern-spoken-form",
        message: `Equation "${id}" has distinct printed and modern mathematical forms, but lacks an authored modern spoken form.`,
      });
    }
  }

  // 3. Check alternate spoken form if required
  if (options?.requireAlternate && (!alternateSpoken || !alternateSpoken.trim())) {
    diagnostics.push({
      severity: "error",
      rule: "missing-accessibility-alternative",
      equationId: id,
      subKind: "missing-alternate-spoken-form",
      message: `Equation "${id}" is missing required alternate conceptual spoken form.`,
    });
  }

  // 4. Lint all available spoken text
  const textsToLint = [
    { label: "printed", text: printedSpoken },
    { label: "modern", text: modernSpoken },
    { label: "alternate", text: alternateSpoken },
  ];

  for (const { label, text } of textsToLint) {
    if (!text) continue;
    const lintResult = lintSpokenForm(text, { boundTerms, notationContext: payload.paper });
    for (const finding of lintResult.findings) {
      diagnostics.push({
        severity: finding.severity,
        rule: finding.severity === "error" ? "lint-error" : "lint-warning",
        equationId: id,
        subKind: `${label}:${finding.rule}`,
        message: `[${label}] ${finding.message}`,
        finding,
      });
    }
  }

  const errors = diagnostics.filter((d) => d.severity === "error");
  const warnings = diagnostics.filter((d) => d.severity === "warning");

  return {
    valid: errors.length === 0,
    diagnostics,
    errors,
    warnings,
  };
}
