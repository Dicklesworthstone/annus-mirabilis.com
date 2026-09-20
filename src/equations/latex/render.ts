/**
 * AST-to-LaTeX visitor and renderer (am-eq-latex-generation-hc3).
 *
 * Implements:
 * - Criterion 1: Printed, modern, and alternate outputs in plain and colorized modes.
 * - Criterion 2: Modern notation derived strictly from concordance renames and monomial merges.
 * - Criterion 3: Alternate form rendering (unit-conversion and modernization).
 * - Criterion 6: Role classes and term/op marker grammar.
 * - Criterion 9: Loud missing notation scope or entry failure.
 */

import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import type { AlternateForm } from "../alternateForms.ts";
import { type Expression, nodeId } from "../ast.ts";
import type { QuantityRegistry } from "../quantities.ts";
import { checkEquationGlyphCollisions } from "./collisions.ts";
import { wrapHtmlClass, wrapHtmlData } from "./markers.ts";
import { tryMergeMonomialQuotient } from "./monomial.ts";
import { resolveSymbolGlyph } from "./notation.ts";
import {
  type AppliedOperation,
  type FormRelation,
  NotationScopeError,
  type RenderEquationLatexInput,
  type RenderEquationLatexResult,
  type RenderLatexOptions,
  type RenderPerspective,
  type Span,
} from "./types.ts";

/**
 * Renders an AST expression into LaTeX under the specified options.
 */
export function renderLatex(tree: Expression, options: RenderLatexOptions = {}): string {
  // If an alternate form is specified, render its tree
  const targetTree = options.alternateForm ? options.alternateForm.tree : tree;

  const marked = options.mode === "colorized" || Boolean(options.marked);

  const render = (n: Expression): string => {
    let s: string;

    switch (n.kind) {
      case "number": {
        const [m, e] = n.value.split("e");
        s = e === undefined ? n.value : `${m}\\times10^{${e}}`;
        break;
      }

      case "constant":
        s = "\\pi";
        break;

      case "symbol": {
        const resolved = resolveSymbolGlyph(n, options);
        s = resolved.glyph;

        if (n.scale && (n.scale.num !== 1 || n.scale.den !== 1)) {
          s = `\\frac{${n.scale.num}}{${n.scale.den}}\\left(${s}\\right)`;
        }

        if (marked) {
          const id = nodeId(n);
          if (id) {
            s = wrapHtmlClass(resolved.role, s);
            s = wrapHtmlData("term", id, s);
          }
        }
        return s;
      }

      case "sum": {
        const parts: string[] = [];
        for (let i = 0; i < n.args.length; i++) {
          const arg = n.args[i];
          if (!arg) continue;

          if (arg.kind === "negate") {
            const inner = render(arg.argument);
            const wrapped = ["sum", "relation"].includes(arg.argument.kind)
              ? `\\left(${inner}\\right)`
              : inner;
            if (i === 0) {
              parts.push(`-${wrapped}`);
            } else {
              parts.push(`- ${wrapped}`);
            }
          } else if (arg.kind === "product") {
            const firstArg = arg.args[0];
            if (
              arg.args.length > 1 &&
              firstArg &&
              firstArg.kind === "number" &&
              firstArg.value === "-1"
            ) {
              const remaining = arg.args.slice(1);
              const inner = remaining
                .map((x: Expression) =>
                  ["sum", "relation", "negate"].includes(x.kind)
                    ? `\\left(${render(x)}\\right)`
                    : render(x),
                )
                .join("\\,");
              if (i === 0) {
                parts.push(`-${inner}`);
              } else {
                parts.push(`- ${inner}`);
              }
            } else {
              const rendered = render(arg);
              if (i === 0) {
                parts.push(rendered);
              } else {
                parts.push(`+ ${rendered}`);
              }
            }
          } else {
            const rendered = render(arg);
            if (i === 0) {
              parts.push(rendered);
            } else {
              parts.push(`+ ${rendered}`);
            }
          }
        }
        s = parts.join(" ");
        break;
      }

      case "product":
        s = n.args
          .map((x) =>
            ["sum", "relation", "negate"].includes(x.kind)
              ? `\\left(${render(x)}\\right)`
              : render(x),
          )
          .join("\\,");
        break;

      case "quotient": {
        // First attempt monomial factor set group merge in modern perspective
        const merged = tryMergeMonomialQuotient(n, render, options);
        if (merged !== undefined) {
          s = merged;
        } else if (n.numerator.kind === "negate") {
          s = `-\\frac{${render(n.numerator.argument)}}{${render(n.denominator)}}`;
        } else {
          s = `\\frac{${render(n.numerator)}}{${render(n.denominator)}}`;
        }
        break;
      }

      case "power":
        s = `\\left(${render(n.base)}\\right)^{${
          n.exponent.den === 1 ? n.exponent.num : `\\frac{${n.exponent.num}}{${n.exponent.den}}`
        }}`;
        break;

      case "root":
        s = `\\sqrt${n.degree === 2 ? "" : `[${n.degree}]`}{${render(n.radicand)}}`;
        break;

      case "negate":
        s = `-\\left(${render(n.argument)}\\right)`;
        break;

      case "group":
        s = `\\left(${render(n.argument)}\\right)`;
        break;

      case "average":
        s = `\\left\\langle ${render(n.argument)}\\right\\rangle`;
        break;

      case "function": {
        // Special case for exponential with monomial quotient argument in modern perspective
        if (n.name === "exp" && n.argument.kind === "quotient") {
          const mergedArg = tryMergeMonomialQuotient(n.argument, render, options);
          if (mergedArg !== undefined) {
            s = `\\exp\\left(${mergedArg}\\right)`;
            break;
          }
        }
        s = `\\${n.name}\\left(${render(n.argument)}\\right)`;
        break;
      }

      case "relation": {
        const op = n.operator === "approx" ? "\\approx" : n.operator === "define" ? ":=" : "=";
        s = `${render(n.left)} ${op} ${render(n.right)}`;
        break;
      }

      case "derivative": {
        const d = n.partial ? "\\partial" : "\\mathrm{d}";
        const p = n.order === 1 ? "" : `^{${n.order}}`;
        s = `\\frac{${d}${p}\\left(${render(n.expression)}\\right)}{${d}${render(n.variable)}${p}}`;
        break;
      }

      case "integral":
        s = `\\int ${render(n.expression)}\\,\\mathrm{d}${render(n.variable)}`;
        break;
    }

    const id = nodeId(n);
    if (marked && id) {
      s = wrapHtmlData("op", id, s);
    }

    return s;
  };

  return render(targetTree);
}

function isRenderLatexOptions(
  obj: QuantityRegistry | RenderLatexOptions,
): obj is RenderLatexOptions {
  return (
    "perspective" in obj ||
    "mode" in obj ||
    "paper" in obj ||
    "strictConcordance" in obj ||
    "marked" in obj ||
    "sectionId" in obj ||
    "anchor" in obj ||
    "equationId" in obj ||
    "concordance" in obj ||
    "alternateForm" in obj
  );
}

/**
 * Backward-compatible expressionLatex function.
 * Supports both legacy signature: (tree, registry, marked?)
 * and options signature: (tree, options)
 */
export function expressionLatex(
  tree: Expression,
  registryOrOptions?: QuantityRegistry | RenderLatexOptions,
  marked = false,
): string {
  if (!registryOrOptions) {
    return renderLatex(tree, { marked });
  }

  if (isRenderLatexOptions(registryOrOptions)) {
    return renderLatex(tree, registryOrOptions);
  }

  return renderLatex(tree, {
    registry: registryOrOptions,
    marked,
    strictConcordance: false,
  });
}

export const RENDERER_VERSION = 1;

/**
 * Extracts term and op spans from a marked LaTeX string.
 */
export function extractSpansFromLatex(latex: string): {
  readonly termSpans: readonly Span[];
  readonly opSpans: readonly Span[];
} {
  const termSpans: Span[] = [];
  const opSpans: Span[] = [];

  const prefixPattern = /\\htmlData\{(term|op)=([^}]+)\}\{/g;
  // The exec cursor is advanced explicitly rather than by assigning inside the
  // loop condition, which hides the mutation from a reader scanning the header.
  let match = prefixPattern.exec(latex);

  while (match !== null) {
    const kind = match[1];
    const id = match[2] ?? "";
    const start = match.index;
    const bodyStart = match.index + match[0].length;

    let depth = 1;
    let end = bodyStart;
    while (end < latex.length && depth > 0) {
      const char = latex[end];
      if (char === "\\") {
        end += 2;
        continue;
      }
      if (char === "{") {
        depth++;
      } else if (char === "}") {
        depth--;
      }
      end++;
    }

    if (kind === "term") {
      termSpans.push({
        id,
        termId: id,
        start,
        end,
      });
    } else {
      opSpans.push({
        id,
        opId: id,
        start,
        end,
      });
    }
    match = prefixPattern.exec(latex);
  }

  return { termSpans, opSpans };
}

/**
 * Top-level equation LaTeX rendering function (am-eq-latex-generation-hc3).
 *
 * Inputs:
 * - equation: The equation record containing identity, paper, scope, AST tree, and optional alternate forms.
 * - form: Form selector ({ kind: 'printed' }, { kind: 'modern' }, or { kind: 'alternate', id }).
 * - color: Presentation color mode ('plain' or 'colorized').
 * - concordance: Scoped notation concordance (optional, loaded by paper if omitted).
 * - registry: Quantity registry for semantic metadata.
 *
 * Returns:
 * - latex: Deterministic LaTeX string.
 * - termSpans: Array of term spans with offsets in the rendered LaTeX.
 * - opSpans: Array of op spans with offsets in the rendered LaTeX.
 * - formRelation: 'printed' | 'rename-only' | 'unit-conversion' | 'modernization'.
 * - appliedOperations: Array of concordance and alternate operations applied.
 * - warnings: Review warnings (e.g. printed glyph collisions).
 */
export function renderEquationLatex(input: RenderEquationLatexInput): RenderEquationLatexResult {
  const { equation, form, color, registry } = input;
  let concordance = input.concordance;
  if (!concordance && equation.paper) {
    try {
      concordance = loadConcordanceForPaper(equation.paper);
    } catch {
      // Concordance might be passed explicitly or not found
    }
  }

  let targetTree: Expression;
  let formRelation: FormRelation;
  let perspective: RenderPerspective;
  let activeAlternateForm: AlternateForm | undefined;

  if (form.kind === "printed") {
    targetTree = equation.tree;
    formRelation = "printed";
    perspective = "source";
  } else if (form.kind === "modern") {
    targetTree = equation.tree;
    formRelation = "rename-only";
    perspective = "modern";
  } else if (form.kind === "alternate") {
    const alt = equation.alternateForms?.find((a) => a.id === form.id);
    if (!alt) {
      throw new Error(`Alternate form "${form.id}" not found on equation "${equation.id}".`);
    }
    targetTree = alt.tree;
    formRelation = alt.relation;
    perspective = "modern";
    activeAlternateForm = alt;
  } else {
    throw new Error(`Unknown form kind: ${(form as { kind: string }).kind}`);
  }

  // Check glyph collisions
  const collisionResult = checkEquationGlyphCollisions(targetTree, {
    paper: equation.paper,
    sectionId: equation.sectionId,
    anchor: equation.anchor,
    equationId: equation.id,
    perspective,
    concordance,
    registry,
    alternateForm: activeAlternateForm,
  });

  if (!collisionResult.ok) {
    const errorDiag = collisionResult.diagnostics.find((d) => d.kind === "error");
    throw new NotationScopeError({
      kind: "glyph-collision",
      equationId: equation.id,
      paper: equation.paper,
      scope: equation.sectionId ?? equation.anchor,
      message: errorDiag?.message ?? `Glyph collision in equation "${equation.id}".`,
    });
  }

  const warnings = collisionResult.diagnostics
    .filter((d) => d.kind === "warning")
    .map((d) => d.message);

  // Track applied operations
  const appliedOperationsMap = new Map<string, string>();

  // Render the LaTeX
  const renderOptions: RenderLatexOptions = {
    perspective,
    mode: color,
    paper: equation.paper,
    sectionId: equation.sectionId,
    anchor: equation.anchor,
    equationId: equation.id,
    concordance,
    registry,
    alternateForm: activeAlternateForm,
    strictConcordance: Boolean(equation.paper) || perspective === "modern",
    onAppliedOperation: (entryId, operation) => {
      appliedOperationsMap.set(entryId, operation);
    },
  };

  const latex = renderLatex(targetTree, renderOptions);

  // Extract term and op spans
  const { termSpans, opSpans } =
    color === "colorized" ? extractSpansFromLatex(latex) : { termSpans: [], opSpans: [] };

  const appliedOperations: AppliedOperation[] = [];
  if (activeAlternateForm) {
    appliedOperations.push({
      entryId: activeAlternateForm.id,
      operation: activeAlternateForm.relation,
    });
  }
  for (const [entryId, operation] of appliedOperationsMap.entries()) {
    appliedOperations.push({ entryId, operation });
  }

  return {
    latex,
    termSpans,
    opSpans,
    formRelation,
    appliedOperations,
    warnings,
  };
}
