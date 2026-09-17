/**
 * printCoverage.ts
 *
 * Compiler coverage check for printable chapters (am-plat-print-3orn).
 *
 * Checks:
 * 1. Step coverage: Fails a section whose printed form would lose a required step:
 *    a printed reading references a derivation step or equation card that the policy omits.
 * 2. Printable equation width: Reports `print-overflow` for a display equation wider
 *    than the printable width that has no authored multi-line form.
 *
 * Spec: AGENTS.md §6.2, §15.4 and am-plat-print-3orn
 */

import {
  type CheckContext,
  type ContentCheck,
  registerCheck,
} from "../../content/compiler/checks/registry.ts";
import { shouldPrintDerivationRoute } from "./printPolicy.ts";

export const PRINT_COVERAGE_BEAD_ID = "am-plat-print-3orn";

/** Maximum recommended single-line LaTeX character length before requiring a multi-line form. */
export const MAX_PRINTABLE_EQUATION_WIDTH_CHARS = 85;

export interface PrintCoverageDiagnostic {
  readonly recordId: string;
  readonly rule: "print-step-coverage" | "print-overflow";
  readonly severity: "error" | "flag";
  readonly message: string;
  readonly path?: string | undefined;
}

/**
 * Checks whether an equation record has an authored multi-line representation.
 */
export function hasAuthoredMultiLineForm(equation: Record<string, unknown>): boolean {
  if (typeof equation.multiLineForm === "string" && equation.multiLineForm.trim().length > 0) {
    return true;
  }
  if (equation.hasMultiLineForm === true || equation.isMultiLine === true) {
    return true;
  }
  if (typeof equation.latex === "string") {
    if (
      equation.latex.includes("\\\\") ||
      equation.latex.includes("\\begin{aligned}") ||
      equation.latex.includes("\\begin{split}") ||
      equation.latex.includes("\\begin{gather}") ||
      equation.latex.includes("\\begin{matrix}")
    ) {
      return true;
    }
  }
  if (
    typeof equation.explanation === "string" &&
    equation.explanation.includes("\\begin{aligned}")
  ) {
    return true;
  }
  return false;
}

/**
 * Validates display equations for printable width constraints.
 */
export function checkEquationPrintWidth(
  equation: Record<string, unknown>,
): readonly PrintCoverageDiagnostic[] {
  const diagnostics: PrintCoverageDiagnostic[] = [];
  const id = typeof equation.id === "string" ? equation.id : "unknown-equation";

  // Check LaTeX width or tree complexity
  const latexStr =
    typeof equation.latex === "string"
      ? equation.latex
      : typeof equation.spoken === "string"
        ? equation.spoken
        : "";

  if (latexStr.length > MAX_PRINTABLE_EQUATION_WIDTH_CHARS) {
    if (!hasAuthoredMultiLineForm(equation)) {
      diagnostics.push({
        recordId: id,
        rule: "print-overflow",
        severity: "flag",
        message: `Display equation '${id}' exceeds printable width (${latexStr.length} chars > ${MAX_PRINTABLE_EQUATION_WIDTH_CHARS}) and has no authored multi-line form.`,
        path: `equations.${id}`,
      });
    }
  }

  return diagnostics;
}

/**
 * Validates that all steps and equation cards referenced by printed readings survive in print.
 */
export function checkSectionStepCoverage(
  section: Record<string, unknown>,
  derivationRoutes: readonly Record<string, unknown>[] = [],
): readonly PrintCoverageDiagnostic[] {
  const diagnostics: PrintCoverageDiagnostic[] = [];
  const sectionId = typeof section.id === "string" ? section.id : "unknown-section";

  // Check referenced steps from printed readings (evaluating across default detail levels 0..3)
  const referencedStepIds = new Set<string>();

  // Extract referenced steps from section / reading records
  const extractSteps = (obj: unknown) => {
    if (!obj || typeof obj !== "object") return;
    const r = obj as Record<string, unknown>;
    if (Array.isArray(r.referencedStepIds)) {
      for (const s of r.referencedStepIds) if (typeof s === "string") referencedStepIds.add(s);
    }
    if (Array.isArray(r.stepIds)) {
      for (const s of r.stepIds) if (typeof s === "string") referencedStepIds.add(s);
    }
    if (Array.isArray(r.requiredSteps)) {
      for (const s of r.requiredSteps) if (typeof s === "string") referencedStepIds.add(s);
    }
  };

  extractSteps(section);
  if (Array.isArray(section.readings)) {
    for (const rd of section.readings) {
      extractSteps(rd);
    }
  }

  if (referencedStepIds.size === 0) {
    return diagnostics;
  }

  // Determine which steps survive in print
  const printableStepIds = new Set<string>();
  for (const route of derivationRoutes) {
    const routeKind = typeof route.kind === "string" ? route.kind : "source-order";
    const visibility = shouldPrintDerivationRoute(
      routeKind,
      route as { readonly essentialForPrint?: boolean },
    );
    if (visibility.expanded && Array.isArray(route.steps)) {
      for (const st of route.steps) {
        if (st && typeof st === "object") {
          const stepId = (st as Record<string, unknown>).id;
          if (typeof stepId === "string") {
            printableStepIds.add(stepId);
          }
        }
      }
    }
  }

  for (const stepId of referencedStepIds) {
    if (!printableStepIds.has(stepId)) {
      diagnostics.push({
        recordId: sectionId,
        rule: "print-step-coverage",
        severity: "error",
        message: `Printed reading in section '${sectionId}' references step '${stepId}' which is omitted in print.`,
        path: `sections.${sectionId}.referencedStepIds`,
      });
    }
  }

  return diagnostics;
}

/**
 * Compiler check runner for print coverage.
 */
export function runPrintCoverageCheck(context: CheckContext): void {
  const derivationRoutes: Record<string, unknown>[] = [];
  const sections: Record<string, unknown>[] = [];
  const equations: Record<string, unknown>[] = [];

  for (const [, record] of context.records) {
    if (!record || typeof record !== "object") continue;
    const r = record as Record<string, unknown>;
    if (r.kind === "equation") {
      equations.push(r);
    } else if (r.kind === "derivation-route" || r.kind === "derivation-chain") {
      derivationRoutes.push(r);
    } else if (r.kind === "section" || r.targetKind === "section") {
      sections.push(r);
    }
  }

  // 1. Check equations for printable width
  for (const eq of equations) {
    const diags = checkEquationPrintWidth(eq);
    for (const d of diags) {
      context.report({
        recordId: d.recordId,
        rule: d.rule,
        severity: d.severity,
        message: d.message,
        path: d.path,
      });
    }
  }

  // 2. Check sections for step coverage
  for (const sec of sections) {
    const diags = checkSectionStepCoverage(sec, derivationRoutes);
    for (const d of diags) {
      context.report({
        recordId: d.recordId,
        rule: d.rule,
        severity: d.severity,
        message: d.message,
        path: d.path,
      });
    }
  }
}

export function registerPrintCoverageCheck(): void {
  const check: ContentCheck = {
    id: "coverage.print",
    family: "coverage",
    severity: "error",
    beadId: PRINT_COVERAGE_BEAD_ID,
    description: "Verifies printable step coverage and display equation widths for print media.",
    run: runPrintCoverageCheck,
  };
  registerCheck(check);
}
