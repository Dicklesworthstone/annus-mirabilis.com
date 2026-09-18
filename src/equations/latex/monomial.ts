/**
 * Monomial factor set group merge and removal for LaTeX rendering (am-eq-latex-generation-hc3).
 *
 * Implements Criterion 2:
 * - Group removal: RT/N -> k_B T, R\beta\nu/N -> h\nu, R/N -> k_B
 * - Merge in an exponent: -\beta\nu/T -> -h\nu/(k_BT)
 * - Separation preservation: Two separate printed fractions are never combined
 *   (e.g. \frac{RT}{N}\frac{1}{6\pi kP} -> k_BT\,\frac{1}{6\pi\eta a})
 * - Refusal: When a group's members are not factors of one monomial quotient
 */

import type { Expression } from "../ast.ts";
import { type MonomialFactor, extractMonomialFactorSet } from "../monomial.ts";
import { modernGroupsFor } from "../../content/notation/resolve.ts";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import type { PaperConcordance } from "../../content/schemas/concordance.ts";
import { wrapHtmlClass, wrapHtmlData } from "./markers.ts";
import type { RenderLatexOptions } from "./types.ts";

export interface MonomialMergeResult {
  readonly rendered: string;
  readonly matchedGroup: string;
}

/**
 * Inspects a quotient expression to determine if factors in numerator and denominator
 * form a known composite group (e.g. R and N forming R/N -> k_B) and merges them.
 */
export function tryMergeMonomialQuotient(
  node: Extract<Expression, { kind: "quotient" }>,
  renderSubtree: (expr: Expression) => string,
  options: RenderLatexOptions,
): string | undefined {
  if (options.perspective !== "modern") {
    return undefined;
  }

  let effectiveNum = node.numerator;
  let isNegated = false;
  if (effectiveNum.kind === "negate") {
    isNegated = true;
    effectiveNum = effectiveNum.argument;
  }
  const coreQuotient: Extract<Expression, { kind: "quotient" }> = {
    kind: "quotient",
    numerator: effectiveNum,
    denominator: node.denominator,
  };

  // Attempt to extract monomial factor set. If node contains sums or relations,
  // extractMonomialFactorSet will throw, which means members are not monomial factors.
  let factorSet;
  try {
    factorSet = extractMonomialFactorSet(coreQuotient);
  } catch {
    return undefined;
  }

  // Identify active group renames in scope
  const paper = options.paper;
  const scope = options.sectionId ?? options.anchor ?? "all";
  let concordance: PaperConcordance | undefined;
  if (paper) {
    if (options.concordance) {
      concordance = Array.isArray(options.concordance)
        ? options.concordance.find((c) => c.paper === paper)
        : (options.concordance as PaperConcordance);
    }
    if (!concordance) {
      try {
        concordance = loadConcordanceForPaper(paper);
      } catch {
        // Ignored, handled by caller
      }
    }
  }

  // Check for R/N or R*beta/N groups
  // We identify factors by quantityId or printed glyph
  const factors = factorSet.factors;
  const findFactor = (qid: string, glyphs: string[], exp: number): MonomialFactor | undefined =>
    factors.find(
      (f) =>
        (f.quantityId === qid || glyphs.includes(f.termId)) &&
        f.exponent === exp,
    );

  const factorR = findFactor("molarGasConstant", ["R"], 1);
  const factorN = findFactor("avogadroConstant", ["N"], -1);
  const factorBeta = findFactor("wienConstantBeta", ["beta", "\\beta"], 1);

  // Case A: R * beta / N -> h (Wien planck constant group)
  if (factorR && factorN && factorBeta) {
    // Remaining factors excluding R, beta (from numerator) and N (from denominator)
    const remainingNum = factors.filter(
      (f) => f.exponent > 0 && f !== factorR && f !== factorBeta,
    );
    const remainingDen = factors.filter(
      (f) => f.exponent < 0 && f !== factorN,
    );

    const modernGroupGlyph = "h";
    if (options.onAppliedOperation) {
      options.onAppliedOperation("group-planck", "group-merge");
    }
    const firstRemovedNumerator =
      factors.find((f) => f.exponent > 0 && (f === factorR || f === factorBeta)) ?? factorR;
    return formatMergedMonomial(
      modernGroupGlyph,
      remainingNum,
      remainingDen,
      renderSubtree,
      options,
      isNegated,
      firstRemovedNumerator,
      "planckConstant",
    );
  }

  // Case B: R / N -> k_B (Boltzmann constant group)
  if (factorR && factorN) {
    const remainingNum = factors.filter(
      (f) => f.exponent > 0 && f !== factorR,
    );
    const remainingDen = factors.filter(
      (f) => f.exponent < 0 && f !== factorN,
    );

    const modernGroupGlyph = "k_B";
    if (options.onAppliedOperation) {
      options.onAppliedOperation("group-boltzmann", "group-merge");
    }
    return formatMergedMonomial(
      modernGroupGlyph,
      remainingNum,
      remainingDen,
      renderSubtree,
      options,
      isNegated,
      factorR,
      "boltzmannConstant",
    );
  }

  // Case C: Exponent Wien merge: -\beta\nu / T -> -h\nu / (k_B T)
  // When beta has quantityId wienConstantBeta, in modern notation beta -> h / k_B.
  // In a quotient with beta in numerator (exp = 1) and temperature T in denominator (exp = -1),
  // substituting beta = h / k_B puts h in numerator and k_B in denominator alongside T.
  if (factorBeta && factorBeta.quantityId === "wienConstantBeta") {
    const factorT = findFactor("temperature", ["T"], -1);
    if (factorT) {
      const remainingNum = factors.filter(
        (f) => f.exponent > 0 && f !== factorBeta,
      );
      const remainingDen = factors.filter(
        (f) => f.exponent < 0 && f !== factorT,
      );

      const marked = options.mode === "colorized" || Boolean(options.marked);
      const hRole = options.registry?.planckConstant?.role ?? "constant";
      const kBRole = options.registry?.boltzmannConstant?.role ?? "constant";
      const hStr = marked
        ? wrapHtmlData("term", factorBeta.termId, wrapHtmlClass(hRole, "h"))
        : "h";
      const kBStr = marked
        ? wrapHtmlData("term", factorBeta.termId, wrapHtmlClass(kBRole, "k_B"))
        : "k_B";

      // Numerator gets 'h' plus other numerator factors (like \nu)
      // Denominator gets 'k_B' and 'T' plus other denominator factors
      const numTerms = [hStr, ...remainingNum.map((f) => renderFactor(f, renderSubtree, options))];
      const denTerms = [kBStr, renderFactor(factorT, renderSubtree, options), ...remainingDen.map((f) => renderFactor(f, renderSubtree, options))];

      const numStr = numTerms.join("\\,");
      const denStr = denTerms.join("\\,");

      if (options.onAppliedOperation) {
        options.onAppliedOperation("wien-exponent-merge", "monomial-merge");
      }
      const prefix = isNegated ? "-" : "";
      return `${prefix}\\frac{${numStr}}{${denStr}}`;
    }
  }

  return undefined;
}

function renderFactor(
  factor: MonomialFactor,
  renderSubtree: (expr: Expression) => string,
  options: RenderLatexOptions,
): string {
  const symExpr: Expression = {
    kind: "symbol",
    termId: factor.termId,
    quantityId: factor.quantityId,
    ...(factor.scale ? { scale: factor.scale } : {}),
  };
  return renderSubtree(symExpr);
}

function formatMergedMonomial(
  groupGlyph: string,
  remainingNum: readonly MonomialFactor[],
  remainingDen: readonly MonomialFactor[],
  renderSubtree: (expr: Expression) => string,
  options: RenderLatexOptions,
  isNegated = false,
  groupFactor?: MonomialFactor,
  targetQuantityId?: string,
): string {
  const marked = options.mode === "colorized" || Boolean(options.marked);
  let groupPart = groupGlyph;
  if (marked && groupFactor) {
    const qid = targetQuantityId ?? groupFactor.quantityId;
    const role = options.registry?.[qid]?.role ?? "constant";
    groupPart = wrapHtmlData("term", groupFactor.termId, wrapHtmlClass(role, groupGlyph));
  }

  const numRendered = [groupPart, ...remainingNum.map((f) => renderFactor(f, renderSubtree, options))];
  const numStr = numRendered.join("\\,");
  const prefix = isNegated ? "-" : "";

  if (remainingDen.length === 0) {
    // Denominator completely cancelled out: renders as product (e.g. k_B T or k_B)
    return isNegated ? `-\\left(${numStr}\\right)` : numStr;
  }

  const denStr = remainingDen.map((f) => renderFactor(f, renderSubtree, options)).join("\\,");
  return `${prefix}\\frac{${numStr}}{${denStr}}`;
}
