/**
 * Glyph collision checking for equation LaTeX rendering (am-eq-latex-generation-hc3).
 *
 * Implements Criterion 4:
 * - Fails the §3 fixture when auxiliary x' lacks a distinct modern glyph; passes when concordance supplies one.
 * - Modern-form collision between two quantities in one equation is an ERROR.
 * - The same collision in the printed form is a review WARNING, not an error.
 * - A modernOnlySymbols glyph that collides with a renamed symbol is an ERROR.
 */

import { type Expression, walk } from "../ast.ts";
import type { PaperConcordance } from "../../content/schemas/concordance.ts";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import { resolveSymbolGlyph } from "./notation.ts";
import type { RenderLatexOptions } from "./types.ts";

export interface CollisionDiagnostic {
  readonly kind: "error" | "warning";
  readonly rule: "modern-glyph-collision" | "printed-glyph-collision" | "modern-only-symbol-collision";
  readonly quantityIds: readonly string[];
  readonly glyph: string;
  readonly message: string;
}

export interface CollisionCheckResult {
  readonly ok: boolean;
  readonly diagnostics: readonly CollisionDiagnostic[];
}

/**
 * Checks for glyph collisions across symbols in an equation tree.
 */
export function checkEquationGlyphCollisions(
  tree: Expression,
  options: RenderLatexOptions = {},
): CollisionCheckResult {
  const perspective = options.perspective ?? "modern";
  const diagnostics: CollisionDiagnostic[] = [];

  // Extract all unique symbol nodes in the tree
  const symbols = walk(tree).filter((n): n is Extract<Expression, { kind: "symbol" }> => n.kind === "symbol");

  // Map from rendered glyph -> array of distinct quantityIds that produce it
  const glyphToQuantities = new Map<string, Set<string>>();

  for (const symNode of symbols) {
    try {
      const resolved = resolveSymbolGlyph(symNode, options);
      const glyph = resolved.glyph;
      const set = glyphToQuantities.get(glyph) ?? new Set<string>();
      set.add(symNode.quantityId);
      glyphToQuantities.set(glyph, set);
    } catch (err) {
      if (options.strictConcordance ?? (Boolean(options.paper) || perspective === "modern")) {
        diagnostics.push({
          kind: "error",
          rule: "modern-glyph-collision",
          quantityIds: [symNode.quantityId],
          glyph: symNode.termId,
          message: (err as Error).message,
        });
      }
    }
  }

  for (const [glyph, qidsSet] of glyphToQuantities.entries()) {
    if (qidsSet.size > 1) {
      const qids = Array.from(qidsSet);
      if (perspective === "modern") {
        // Modern-form collision between two quantities is an ERROR
        diagnostics.push({
          kind: "error",
          rule: "modern-glyph-collision",
          quantityIds: qids,
          glyph,
          message: `Modern glyph "${glyph}" collides between quantities [${qids.join(", ")}] in equation "${options.equationId ?? "unknown"}".`,
        });
      } else {
        // Printed-form collision is a review WARNING, not an error
        diagnostics.push({
          kind: "warning",
          rule: "printed-glyph-collision",
          quantityIds: qids,
          glyph,
          message: `Printed glyph "${glyph}" is shared by quantities [${qids.join(", ")}] in equation "${options.equationId ?? "unknown"}".`,
        });
      }
    }
  }

  // Check collision against modernOnlySymbols if available in concordance
  if (perspective === "modern" && options.paper) {
    let concordance: PaperConcordance | undefined;
    if (options.concordance) {
      concordance = Array.isArray(options.concordance)
        ? options.concordance.find((c) => c.paper === options.paper)
        : (options.concordance as PaperConcordance);
    }
    if (!concordance) {
      try {
        concordance = loadConcordanceForPaper(options.paper);
      } catch {
        // Ignored
      }
    }

    if (concordance?.modernOnlySymbols) {
      for (const mos of concordance.modernOnlySymbols) {
        const mosGlyph = mos.glyph.latex || mos.glyph.unicode;
        const matchingQids = glyphToQuantities.get(mosGlyph);
        if (matchingQids) {
          diagnostics.push({
            kind: "error",
            rule: "modern-only-symbol-collision",
            quantityIds: Array.from(matchingQids),
            glyph: mosGlyph,
            message: `Renamed symbol in equation "${options.equationId ?? "unknown"}" collides with modernOnlySymbol "${mosGlyph}".`,
          });
        }
      }
    }
  }

  const hasErrors = diagnostics.some((d) => d.kind === "error");
  return {
    ok: !hasErrors,
    diagnostics,
  };
}
