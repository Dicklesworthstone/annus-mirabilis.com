/**
 * Monomial factor-set binding, extraction, and dual-view representation.
 *
 * Implements acceptance criteria for am-eq-expression-tree-8kl:
 * - Extracts monomial factor sets from products, quotients, powers, and groups.
 * - Supports composite groups binding BOTH as subtrees AND as monomial factor sets
 *   (e.g., R and N inside RT/N; R, beta, and N inside R*beta*nu/N).
 * - Preserves printed structure (AST unchanged) and preserves each member's individual
 *   canonical quantity binding.
 * - Provides both directions: subtree view and factor-set view of the exact same node.
 */

import { ContentError } from "../content/compiler/json.ts";
import { children, type ExactScale, type Expression, findNode, nodeId, walk } from "./ast.ts";

export interface MonomialFactor {
  readonly termId: string;
  readonly quantityId: string;
  readonly exponent: number; // e.g. +1 for numerator, -1 for denominator
  readonly scale?: ExactScale;
}

export interface MonomialFactorSet {
  readonly factors: readonly MonomialFactor[];
  readonly byTermId: ReadonlyMap<string, MonomialFactor>;
  has(termId: string): boolean;
  get(termId: string): MonomialFactor | undefined;
  exponentOf(termId: string): number;
}

export type CompositeGroupKind = "subtree" | "monomial";

export interface CompositeGroup {
  readonly id: string;
  readonly quantityId: string;
  readonly kind: CompositeGroupKind;
  /** The term IDs participating in this group */
  readonly termIds: readonly string[];
  /** For monomial factor sets: expected exponent per term ID */
  readonly exponents?: Readonly<Record<string, number>>;
  /** For subtree groups: the optional root node ID of the subtree */
  readonly rootNodeId?: string;
}

export interface NodeDualView {
  readonly node: Expression;
  /** Subtree view: the hierarchical Expression AST */
  readonly subtree: Expression;
  /** Monomial factor-set view: the extracted factor set */
  readonly factorSet: MonomialFactorSet;
  /** Navigate from factor or termId back to the exact AST node in the subtree */
  nodeForFactor(termIdOrFactor: string | MonomialFactor): Expression | undefined;
  getSubtreeView(): Expression;
  getFactorSetView(): MonomialFactorSet;
}

/**
 * Extracts the monomial factor set from an Expression (traversing products,
 * quotients, powers, groups, and symbols).
 *
 * Throws ContentError if a non-monomial construct (such as a sum or relation)
 * is encountered.
 */
export function extractMonomialFactorSet(expr: Expression): MonomialFactorSet {
  const factorMap = new Map<string, MonomialFactor>();

  function collect(n: Expression, currentExp: number): void {
    switch (n.kind) {
      case "symbol": {
        const existing = factorMap.get(n.termId);
        if (existing) {
          factorMap.set(n.termId, {
            ...existing,
            exponent: existing.exponent + currentExp,
          });
        } else {
          factorMap.set(n.termId, {
            termId: n.termId,
            quantityId: n.quantityId,
            exponent: currentExp,
            ...(n.scale ? { scale: n.scale } : {}),
          });
        }
        break;
      }
      case "product": {
        for (const arg of n.args) {
          collect(arg, currentExp);
        }
        break;
      }
      case "quotient": {
        collect(n.numerator, currentExp);
        collect(n.denominator, -currentExp);
        break;
      }
      case "power": {
        if (n.exponent.den === 1) {
          collect(n.base, currentExp * n.exponent.num);
        } else {
          throw new ContentError(
            "monomial-fractional-power",
            nodeId(n) ?? "power",
            "Fractional powers are not supported in integer monomial factor sets.",
          );
        }
        break;
      }
      case "group": {
        collect(n.argument, currentExp);
        break;
      }
      case "number":
      case "constant":
        // Scalars and mathematical constants do not contribute bound symbol factors
        break;
      default:
        throw new ContentError(
          "monomial-invalid-node",
          nodeId(n) ?? n.kind,
          `Cannot extract monomial factors from node of kind '${n.kind}'.`,
        );
    }
  }

  collect(expr, 1);

  const factors = Array.from(factorMap.values()).filter((f) => f.exponent !== 0);
  const byTermId = new Map(factors.map((f) => [f.termId, f]));

  return Object.freeze({
    factors: Object.freeze(factors),
    byTermId,
    has: (termId: string) => byTermId.has(termId),
    get: (termId: string) => byTermId.get(termId),
    exponentOf: (termId: string) => byTermId.get(termId)?.exponent ?? 0,
  });
}

/**
 * Returns a dual view of the exact same node:
 * - subtree view (the unmodified AST expression)
 * - factor-set view (the extracted monomial factors)
 * and bidirectional mapping between them.
 */
export function viewNode(node: Expression): NodeDualView {
  const factorSet = extractMonomialFactorSet(node);
  return Object.freeze({
    node,
    subtree: node,
    factorSet,
    nodeForFactor: (arg: string | MonomialFactor) => {
      const termId = typeof arg === "string" ? arg : arg.termId;
      return findNode(node, termId);
    },
    getSubtreeView: () => node,
    getFactorSetView: () => factorSet,
  });
}

/**
 * Finds all symbol term IDs under a node.
 */
export function symbolTermIdsUnder(node: Expression): Set<string> {
  const ids = new Set<string>();
  for (const n of walk(node)) {
    if (n.kind === "symbol") {
      ids.add(n.termId);
    }
  }
  return ids;
}

/**
 * Finds the innermost node containing all specified termIds.
 */
export function findInnermostContainingNode(
  root: Expression,
  termIds: readonly string[],
): Expression | undefined {
  const termSet = new Set(termIds);
  const rootTerms = symbolTermIdsUnder(root);
  for (const id of termSet) {
    if (!rootTerms.has(id)) return undefined;
  }

  let current: Expression = root;
  while (true) {
    let nextChild: Expression | undefined;
    for (const child of children(current)) {
      const childTerms = symbolTermIdsUnder(child);
      let allInChild = true;
      for (const id of termSet) {
        if (!childTerms.has(id)) {
          allInChild = false;
          break;
        }
      }
      if (allInChild) {
        nextChild = child;
        break;
      }
    }
    if (nextChild) {
      current = nextChild;
    } else {
      return current;
    }
  }
}

export type CompositeGroupValidationResult =
  | { readonly ok: true; readonly group: CompositeGroup; readonly quantityId: string }
  | { readonly ok: false; readonly error: string; readonly rule: string };

export interface ValidationRulesOptions {
  readonly checkTermsExist?: boolean;
  readonly checkMonomialMembership?: boolean;
  readonly checkExponents?: boolean;
  readonly checkPreserveMemberBindings?: boolean;
  readonly checkSubtreeContiguity?: boolean;
}

/**
 * Validates a composite group against an expression tree.
 */
export function validateCompositeGroup(
  group: CompositeGroup,
  root: Expression,
  options: ValidationRulesOptions = {},
): CompositeGroupValidationResult {
  const {
    checkTermsExist = true,
    checkMonomialMembership = true,
    checkExponents = true,
    checkPreserveMemberBindings = true,
    checkSubtreeContiguity = true,
  } = options;

  // Rule 1: All termIds must exist as symbols in the expression
  if (checkTermsExist) {
    for (const termId of group.termIds) {
      const found = findNode(root, termId);
      if (!found || found.kind !== "symbol") {
        return {
          ok: false,
          rule: "composite-group-terms-exist",
          error: `Term '${termId}' in composite group '${group.id}' not found as a symbol in expression.`,
        };
      }
    }
  }

  // Rule 2: Subtree vs Monomial binding
  if (group.kind === "subtree") {
    if (checkSubtreeContiguity) {
      // Find if there is a subtree whose leaf symbols match group.termIds exactly
      let matchingSubtree: Expression | undefined;
      if (group.rootNodeId) {
        const candidate = findNode(root, group.rootNodeId);
        if (candidate) {
          const leaves = symbolTermIdsUnder(candidate);
          if (leaves.size === group.termIds.length && group.termIds.every((id) => leaves.has(id))) {
            matchingSubtree = candidate;
          }
        }
      } else {
        for (const candidate of walk(root)) {
          const leaves = symbolTermIdsUnder(candidate);
          if (leaves.size === group.termIds.length && group.termIds.every((id) => leaves.has(id))) {
            matchingSubtree = candidate;
            break;
          }
        }
      }

      if (!matchingSubtree) {
        return {
          ok: false,
          rule: "composite-group-subtree-mismatch",
          error: `Composite group '${group.id}' is declared as 'subtree' but term IDs [${group.termIds.join(", ")}] do not form a contiguous subtree.`,
        };
      }
    }
  } else if (group.kind === "monomial") {
    const innermost = findInnermostContainingNode(root, group.termIds);
    if (!innermost) {
      return {
        ok: false,
        rule: "composite-group-monomial-mismatch",
        error: `Terms [${group.termIds.join(", ")}] have no common containing expression.`,
      };
    }

    let factorSet: MonomialFactorSet;
    try {
      factorSet = extractMonomialFactorSet(innermost);
    } catch {
      return {
        ok: false,
        rule: "composite-group-monomial-mismatch",
        error: `Innermost node containing [${group.termIds.join(", ")}] is not a monomial product or quotient.`,
      };
    }

    if (checkMonomialMembership) {
      for (const termId of group.termIds) {
        if (!factorSet.has(termId)) {
          return {
            ok: false,
            rule: "composite-group-monomial-mismatch",
            error: `Term '${termId}' is not a factor of the monomial factor set for group '${group.id}'.`,
          };
        }
      }
    }

    if (checkExponents && group.exponents) {
      for (const [termId, expectedExp] of Object.entries(group.exponents)) {
        const actualExp = factorSet.exponentOf(termId);
        if (actualExp !== expectedExp) {
          return {
            ok: false,
            rule: "composite-group-exponents-mismatch",
            error: `Composite group '${group.id}' exponent mismatch for term '${termId}': expected ${expectedExp}, got ${actualExp}.`,
          };
        }
      }
    }
  } else {
    return {
      ok: false,
      rule: "composite-group-invalid-kind",
      error: `Invalid composite group kind '${(group as { kind: string }).kind}'. Expected 'subtree' or 'monomial'.`,
    };
  }

  // Rule 6: Members must preserve their own individual quantity bindings
  if (checkPreserveMemberBindings) {
    for (const termId of group.termIds) {
      const node = findNode(root, termId);
      if (node && node.kind === "symbol") {
        if (node.quantityId === group.quantityId) {
          return {
            ok: false,
            rule: "composite-group-member-binding-preserved",
            error: `Member term '${termId}' has had its individual quantity binding replaced by composite group quantity '${group.quantityId}'.`,
          };
        }
      }
    }
  }

  return { ok: true, group, quantityId: group.quantityId };
}

export type CompositeGroupBindResult =
  | { readonly ok: true; readonly group: CompositeGroup; readonly expression: Expression }
  | { readonly ok: false; readonly error: string; readonly rule: string };

/**
 * Binds a composite group to an expression tree.
 * Verifies validity and guarantees the printed AST structure is 100% preserved.
 */
export function bindCompositeGroup(
  group: CompositeGroup,
  root: Expression,
  options: ValidationRulesOptions = {},
): CompositeGroupBindResult {
  const validation = validateCompositeGroup(group, root, options);
  if (!validation.ok) {
    return validation;
  }
  // The printed structure is strictly preserved: the returned expression is identical.
  return {
    ok: true,
    group,
    expression: root,
  };
}
