/**
 * Scoped notation resolution for LaTeX rendering (am-eq-latex-generation-hc3).
 * Enforces Criterion 2 and Criterion 9.
 */

import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import {
  buildSourceManifestIndex,
  normalizeGlyph,
  normalizeSectionId,
  scopeMatches,
} from "../../content/notation/resolve.ts";
import type { ConcordanceEntry, PaperConcordance } from "../../content/schemas/concordance.ts";
import type { Expression } from "../ast.ts";
import { NotationScopeError, type RenderLatexOptions } from "./types.ts";

export interface ResolvedSymbol {
  readonly glyph: string;
  readonly role: string;
  readonly entry?: ConcordanceEntry | undefined;
}

/**
 * Resolves a symbol expression to its appropriate glyph and role
 * according to perspective ('source' vs 'modern') and active scope.
 */
export function resolveSymbolGlyph(
  node: Extract<Expression, { kind: "symbol" }>,
  options: RenderLatexOptions,
): ResolvedSymbol {
  const paper = options.paper;
  const scope = options.sectionId ?? options.anchor;
  const perspective = options.perspective ?? "source";
  const strict = options.strictConcordance ?? (Boolean(paper) || perspective === "modern");

  // Determine fallback role and glyph from registry if available
  const registryEntry = options.registry?.[node.quantityId];
  const role = registryEntry?.role ?? "input";
  const fallbackGlyph = registryEntry?.glyph ?? node.termId;

  if (paper) {
    let concordance: PaperConcordance | undefined;
    if (options.concordance) {
      if (Array.isArray(options.concordance)) {
        concordance = options.concordance.find((c) => c.paper === paper);
      } else {
        concordance = options.concordance as PaperConcordance;
      }
    }
    if (!concordance) {
      try {
        concordance = loadConcordanceForPaper(paper);
      } catch (err) {
        if (strict) {
          throw new NotationScopeError(
            "unknown-paper",
            `Equation "${options.equationId ?? "unknown"}" references unknown paper "${paper}": ${(err as Error).message}`,
            {
              equationId: options.equationId,
              symbol: node.termId || node.quantityId,
              paper: paper,
              scope: scope,
            },
          );
        }
      }
    }

    if (concordance) {
      if (!scope && strict) {
        throw new NotationScopeError(
          "missing-scope",
          `Equation "${options.equationId ?? "unknown"}" is missing notation scope (sectionId or anchor) for paper "${paper}".`,
          { equationId: options.equationId, symbol: node.termId || node.quantityId, paper: paper },
        );
      }

      const normScope = scope ? normalizeSectionId(scope) : undefined;
      const manifestIndex = options.manifestIndex ?? buildSourceManifestIndex([]);
      const sectionId = scope ? manifestIndex.getSectionForAnchor(paper, scope) : undefined;

      // Find all matching concordance entries in scope
      const matchingEntries: ConcordanceEntry[] = [];
      for (const entry of concordance.entries) {
        const matchesQuantity =
          "quantityId" in entry.binding && entry.binding.quantityId === node.quantityId;
        const entryLatex = normalizeGlyph(entry.glyph.latex);
        const entryUnicode = normalizeGlyph(entry.glyph.unicode);
        const matchesGlyph =
          entryLatex === fallbackGlyph ||
          entryUnicode === fallbackGlyph ||
          entry.glyph.latex === fallbackGlyph ||
          entry.glyph.unicode === fallbackGlyph;

        if (matchesQuantity || matchesGlyph) {
          if (!scope || scopeMatches(entry.scope, scope, sectionId)) {
            matchingEntries.push(entry);
          }
        }
      }

      let matchedEntry: ConcordanceEntry | undefined;
      if (matchingEntries.length === 1) {
        matchedEntry = matchingEntries[0];
      } else if (matchingEntries.length > 1) {
        // Disambiguate among entries with the same quantityId
        // 1. Check registry fallback glyph match
        matchedEntry = matchingEntries.find(
          (e) =>
            normalizeGlyph(e.glyph.latex) === fallbackGlyph ||
            normalizeGlyph(e.glyph.unicode) === fallbackGlyph,
        );

        // 2. Check node.termId suffix (e.g. eq.t.y -> "y", eq.t.yPrime -> "yprime")
        if (!matchedEntry && node.termId) {
          const parts = node.termId.split(".");
          const rawSuffix = parts[parts.length - 1] ?? "";
          const normSuffix = rawSuffix.toLowerCase().replace(/prime$/, "'");

          matchedEntry = matchingEntries.find((e) => {
            const entryLatex = normalizeGlyph(e.glyph.latex).toLowerCase();
            const entryUnicode = normalizeGlyph(e.glyph.unicode).toLowerCase();
            if (
              entryLatex === normSuffix ||
              entryUnicode === normSuffix ||
              entryLatex === rawSuffix.toLowerCase()
            ) {
              return true;
            }
            const idParts = e.id.split(".");
            const symbolPart = idParts[1]?.toLowerCase();
            return symbolPart === rawSuffix.toLowerCase() || symbolPart === normSuffix;
          });
        }

        if (!matchedEntry) {
          matchedEntry = matchingEntries[0];
        }
      }

      if (!matchedEntry) {
        // Check concordance modernOnlySymbols
        const modernOnly = concordance.modernOnlySymbols?.find(
          (m) => m.id === node.quantityId || m.id === node.termId,
        );
        if (modernOnly) {
          const glyph = modernOnly.glyph.latex || modernOnly.glyph.unicode;
          if (perspective === "modern" && options.onAppliedOperation) {
            options.onAppliedOperation(modernOnly.id, "modern-only-symbol");
          }
          return {
            glyph,
            role,
          };
        }

        // Check alternateForm modernOnlySymbols if passed
        const altSymbols = (
          options.alternateForm as
            | { modernOnlySymbols?: readonly { quantityId: string; glyph: string }[] }
            | undefined
        )?.modernOnlySymbols;
        const altMatch = altSymbols?.find((m) => m.quantityId === node.quantityId);
        if (altMatch) {
          return {
            glyph: altMatch.glyph,
            role,
          };
        }

        if (strict) {
          throw new NotationScopeError(
            "missing-entry",
            `Equation "${options.equationId ?? "unknown"}" symbol "${node.termId || node.quantityId}" has no concordance entry in scope "${scope}" for paper "${paper}".`,
            {
              equationId: options.equationId,
              symbol: node.termId || node.quantityId,
              paper: paper,
              scope: scope,
            },
          );
        }
      } else {
        // Entry found in scope
        if (perspective === "modern") {
          // Toggle contract: apply modern glyph only for rename operations
          if (matchedEntry.operation.kind === "rename") {
            const target = matchedEntry.operation.target;
            let modernGlyph: string | undefined;
            if (target.form === "symbol" || target.form === "group") {
              modernGlyph =
                typeof target.modernGlyph === "string"
                  ? target.modernGlyph
                  : target.modernGlyph.latex || target.modernGlyph.unicode;
            } else if (target.form === "expression" || target.form === "scaled") {
              if (target.modernGlyph) {
                modernGlyph =
                  typeof target.modernGlyph === "string"
                    ? target.modernGlyph
                    : target.modernGlyph.latex || target.modernGlyph.unicode;
              }
            }

            if (modernGlyph) {
              if (options.onAppliedOperation) {
                options.onAppliedOperation(matchedEntry.id, "rename");
              }
              return {
                glyph: modernGlyph,
                role,
                entry: matchedEntry,
              };
            }
          }
          // Non-rename operations (unitConversion, modernization) leave the symbol unconverted
          return {
            glyph: matchedEntry.glyph.latex || matchedEntry.glyph.unicode,
            role,
            entry: matchedEntry,
          };
        } else {
          // Source perspective: use printed 1905 glyph from concordance
          return {
            glyph: matchedEntry.glyph.latex || matchedEntry.glyph.unicode,
            role,
            entry: matchedEntry,
          };
        }
      }
    }
  }

  // Fallback when paper is not specified
  if (!registryEntry && strict) {
    throw new NotationScopeError(
      "missing-entry",
      `Equation "${options.equationId ?? "unknown"}" symbol "${node.termId || node.quantityId}" has no notation binding in registry.`,
      { equationId: options.equationId, symbol: node.termId || node.quantityId },
    );
  }

  return {
    glyph: fallbackGlyph,
    role,
  };
}
