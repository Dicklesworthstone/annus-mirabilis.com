/**
 * Validation rules and checks for Semantic Expression Trees.
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md (§4.7, §11.2, §11.3, §11.4, §11.5).
 * Epic: am-ep-equations-y76
 * Bead: am-eq-expression-tree-8kl
 */

import { parseAlternateFormId, parseOperationId, parseTermId } from "../../content/ids.ts";
import {
  legacySpellingMessage,
  resolveQuantityId,
} from "../../content/quantities/resolveQuantityId.ts";
import type {
  AlternateForm,
  CompositeGroup,
  EquationTree,
  ExactScale,
  Expression,
  LayoutHints,
} from "./types.ts";
import { children, nodeId, walk } from "./walk.ts";

export interface EquationDiagnostic {
  readonly equationId: string;
  readonly nodeId?: string | null | undefined;
  readonly rule: string;
  readonly severity: "error" | "flag";
  readonly message: string;
  readonly file?: string | undefined;
  readonly line?: number | undefined;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly diagnostics: readonly EquationDiagnostic[];
}

export interface ValidateTreeOptions {
  readonly equationId: string;
  readonly file?: string | undefined;
  readonly line?: number | undefined;
  readonly operationExplanations?: ReadonlyArray<{ opId: string; explanation: string }> | undefined;
  readonly renameMap?: ReadonlyMap<string, string> | undefined;
  readonly isPrinted?: boolean | undefined;
}

const INCOMPATIBLE_SEMANTIC_KINDS: ReadonlyArray<readonly [string, string]> = [
  ["cyclic", "angular"],
  ["cyclic-frequency", "angular-frequency"],
  ["per-frequency", "per-wavelength"],
  ["spectral-density-frequency", "spectral-density-wavelength"],
  ["spectral-density-frequency", "total-density"],
  ["spectral-density-wavelength", "total-density"],
  ["density", "total"],
  ["coordinate", "proper"],
  ["coordinate-time", "proper-time"],
  ["laboratory-force", "comoving-force"],
  ["mean-square", "variance"],
  ["measured", "latent"],
  ["measured-position", "latent-position"],
];

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

export function validateEquationTreeSemantics(
  tree: EquationTree,
  options: ValidateTreeOptions,
): ValidationResult {
  const diagnostics: EquationDiagnostic[] = [];
  const { equationId, file, line } = options;

  function report(
    rule: string,
    message: string,
    targetNodeId?: string | null,
    severity: "error" | "flag" = "error",
  ) {
    diagnostics.push({
      equationId,
      nodeId: targetNodeId ?? null,
      rule,
      severity,
      message,
      file,
      line,
    });
  }

  const allNodes = walk(tree.root);
  const seenIds = new Set<string>();

  // 1. Validate node IDs, term bindings, quantities, scales
  for (const node of allNodes) {
    const id = nodeId(node);
    if (id) {
      if (seenIds.has(id)) {
        report("duplicate-id", `Duplicate selectable ID '${id}' in equation '${equationId}'.`, id);
      }
      seenIds.add(id);
    }

    if (node.kind === "symbol") {
      const termCheck = parseTermId(node.termId);
      if (!termCheck.ok) {
        report("invalid-term-id", termCheck.error, node.termId);
      }

      // Quantity resolution
      if (!node.quantityId || !node.quantityId.trim()) {
        report(
          "unbound-symbol",
          `Symbol '${node.termId}' is unbound (missing quantityId).`,
          node.termId,
        );
      } else {
        const qRes = resolveQuantityId(node.quantityId);
        if (!qRes.ok) {
          if (qRes.kind === "legacy-spelling") {
            const suggestion = legacySpellingMessage(node.quantityId);
            report(
              "rejected-quantity-spelling",
              `Rejected spelling '${node.quantityId}' on term '${node.termId}': ${suggestion}.`,
              node.termId,
            );
          } else {
            report(
              "unknown-quantity-id",
              `Symbol '${node.termId}' binds unknown quantity ID '${node.quantityId}'.`,
              node.termId,
            );
          }
        } else {
          // No printed symbol may bind avogadroNumberEstimate
          if (options.isPrinted !== false && node.quantityId === "avogadroNumberEstimate") {
            report(
              "invalid-estimate-binding",
              `Printed symbol '${node.termId}' binds estimate quantity 'avogadroNumberEstimate'. Printed symbols must bind constant 'avogadroConstant'.`,
              node.termId,
            );
          }
        }
      }

      // Scale check
      if (node.scale !== undefined) {
        const { num, den } = node.scale;
        if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den)) {
          report(
            "invalid-scale",
            `Scale on term '${node.termId}' must have safe integer num and den.`,
            node.termId,
          );
        } else if (den <= 0) {
          report(
            "invalid-scale-denominator",
            `Scale on term '${node.termId}' has zero or negative denominator (${den}). Denominator must be > 0.`,
            node.termId,
          );
        } else if (num === 0) {
          report("zero-scale", `Scale on term '${node.termId}' cannot be zero.`, node.termId);
        } else if (gcd(num, den) !== 1) {
          report(
            "non-reduced-scale",
            `Scale { num: ${num}, den: ${den} } on term '${node.termId}' is not in lowest terms.`,
            node.termId,
          );
        }
      }
    } else if ("opId" in node && node.opId) {
      const opCheck = parseOperationId(node.opId);
      if (!opCheck.ok) {
        report("invalid-op-id", opCheck.error, node.opId);
      }
    }
  }

  // 2. Dangling operation explanations
  if (options.operationExplanations) {
    for (const exp of options.operationExplanations) {
      if (!seenIds.has(exp.opId)) {
        report(
          "dangling-op-id",
          `Operation explanation references opId '${exp.opId}' which does not exist in equation '${equationId}'.`,
          exp.opId,
        );
      }
    }
  }

  // 3. Composite groups validation
  if (tree.groups) {
    for (const group of tree.groups) {
      const memberSet = new Set(group.memberTermIds);
      for (const mId of group.memberTermIds) {
        if (!seenIds.has(mId)) {
          report(
            "missing-group-member",
            `Composite group '${group.id}' names member '${mId}' not in equation.`,
            mId,
          );
        }
      }

      // Group members must be monomial factors or contiguous subtree
      const isMonomialOrSubtree = checkGroupMonomial(tree.root, memberSet);
      if (!isMonomialOrSubtree) {
        report(
          "invalid-group-monomial",
          `Composite group '${group.id}' members are neither a contiguous subtree nor monomial factors of one product/quotient.`,
          group.id,
        );
      }
    }
  }

  // 4. Alternate forms validation
  if (tree.alternateForms) {
    for (const alt of tree.alternateForms) {
      const altIdRes = parseAlternateFormId(alt.id);
      if (!altIdRes.ok) {
        report("invalid-alternate-id", altIdRes.error, alt.id);
      }

      if (alt.relation === "unit-conversion") {
        if (!alt.unitSystem || !alt.unitSystem.from || !alt.unitSystem.to) {
          report(
            "missing-unit-system",
            `Alternate form '${alt.id}' has relation 'unit-conversion' but is missing unitSystem: { from, to }.`,
            alt.id,
          );
        }
        if (!alt.derivationChainId || !alt.derivationChainId.trim()) {
          report(
            "missing-derivation-chain",
            `Alternate form '${alt.id}' has relation 'unit-conversion' but is missing derivationChainId.`,
            alt.id,
          );
        }
      } else if (alt.relation === "modernization") {
        if (!alt.modernLensId || !alt.modernLensId.trim()) {
          report(
            "missing-modern-lens",
            `Alternate form '${alt.id}' has relation 'modernization' but is missing modernLensId.`,
            alt.id,
          );
        }
        if (alt.historicalStatus !== "later-development") {
          report(
            "invalid-historical-status",
            `Alternate form '${alt.id}' has relation 'modernization' but historicalStatus is not 'later-development'.`,
            alt.id,
          );
        }
      }

      // alternate-is-rename check
      if (checkAlternateIsOnlyRename(tree.root, alt.tree, options.renameMap)) {
        report(
          "alternate-is-rename",
          `Alternate form '${alt.id}' only applies symbol renames; renames belong in the concordance, not alternate forms.`,
          alt.id,
        );
      }
    }
  }

  // 5. Layout hints validation
  if (tree.layout) {
    validateLayoutBreaks(tree.root, tree.layout, equationId, report);
  }

  // 6. Semantic kind conflicts
  checkSemanticKindConflicts(tree.root, report);

  return {
    ok: diagnostics.length === 0,
    diagnostics,
  };
}

function checkGroupMonomial(root: Expression, memberSet: Set<string>): boolean {
  // Check if memberSet forms a monomial factor set within a product or quotient
  // Find the lowest common ancestor of all members
  function findLCA(node: Expression): Expression | null {
    const idsInSubtree = walk(node)
      .map(nodeId)
      .filter((id): id is string => id !== null && memberSet.has(id));

    if (idsInSubtree.length === memberSet.size) {
      // Check if any child contains all
      for (const child of children(node)) {
        const inChild = walk(child)
          .map(nodeId)
          .filter((id): id is string => id !== null && memberSet.has(id));
        if (inChild.length === memberSet.size) {
          return findLCA(child);
        }
      }
      return node;
    }
    return null;
  }

  const lca = findLCA(root);
  if (!lca) return false;

  // Allowed monomial LCAs: product, quotient
  if (lca.kind !== "product" && lca.kind !== "quotient") {
    return false;
  }

  // Check that none of the members are buried inside sums, exponents, or function arguments
  for (const memberId of memberSet) {
    if (isBuriedInSumOrExponent(lca, memberId)) {
      return false;
    }
  }
  return true;
}

function isBuriedInSumOrExponent(root: Expression, targetId: string): boolean {
  let buried = false;

  function visit(node: Expression, insideForbidden: boolean) {
    if (nodeId(node) === targetId && insideForbidden) {
      buried = true;
      return;
    }
    const forbidChildren =
      node.kind === "sum" ||
      node.kind === "function" ||
      node.kind === "root" ||
      (node.kind === "power" && typeof node.exponent === "object" && "kind" in node.exponent);

    for (const child of children(node)) {
      visit(child, insideForbidden || forbidChildren);
    }
  }

  visit(root, false);
  return buried;
}

function checkAlternateIsOnlyRename(
  primaryRoot: Expression,
  altRoot: Expression,
  renameMap?: ReadonlyMap<string, string>,
): boolean {
  // If primary and alt have identical structure and differing only in symbol glyph/quantity bindings
  // and all differences are accounted for in renames
  if (primaryRoot.kind !== altRoot.kind) return false;

  const primarySymbols = walk(primaryRoot).filter(
    (n): n is Extract<Expression, { kind: "symbol" }> => n.kind === "symbol",
  );
  const altSymbols = walk(altRoot).filter(
    (n): n is Extract<Expression, { kind: "symbol" }> => n.kind === "symbol",
  );

  if (primarySymbols.length !== altSymbols.length) return false;

  // If the shapes and operators are strictly identical
  function shapesEqual(a: Expression, b: Expression): boolean {
    if (a.kind !== b.kind) return false;
    if (a.kind === "symbol") return true;
    if (a.kind === "constant") return a.name === (b as typeof a).name;
    if (a.kind === "number") return a.value === (b as typeof a).value;
    const aChildren = children(a);
    const bChildren = children(b);
    if (aChildren.length !== bChildren.length) return false;
    return aChildren.every((ac, i) => {
      const bc = bChildren[i];
      return bc !== undefined && shapesEqual(ac, bc);
    });
  }

  if (!shapesEqual(primaryRoot, altRoot)) return false;

  // If renameMap is provided, check if every primary -> alt is in renameMap
  if (renameMap && renameMap.size > 0) {
    let hasRename = false;
    for (let i = 0; i < primarySymbols.length; i++) {
      const p = primarySymbols[i]!;
      const a = altSymbols[i]!;
      if (p.quantityId !== a.quantityId) {
        if (renameMap.get(p.quantityId) === a.quantityId) {
          hasRename = true;
        } else {
          return false; // Not a declared rename
        }
      }
    }
    return hasRename;
  }

  // If symbols match 1:1 except for trivial glyph/id differences without any new quantities
  let allQuantitiesSame = true;
  for (let i = 0; i < primarySymbols.length; i++) {
    if (primarySymbols[i]!.quantityId !== altSymbols[i]!.quantityId) {
      allQuantitiesSame = false;
    }
  }
  return allQuantitiesSame;
}

function validateLayoutBreaks(
  root: Expression,
  layout: LayoutHints,
  equationId: string,
  report: (rule: string, message: string, nodeId?: string | null) => void,
): void {
  const allNodes = walk(root);
  const nodeMap = new Map<string, Expression>();
  for (const n of allNodes) {
    const id = nodeId(n);
    if (id) nodeMap.set(id, n);
  }

  // Validate alignAt IDs
  if (layout.alignAt) {
    const alignSet = new Set<string>();
    for (const aId of layout.alignAt) {
      if (!nodeMap.has(aId)) {
        report(
          "unresolved-align-at",
          `alignAt ID '${aId}' not found in equation '${equationId}'.`,
          aId,
        );
      }
      if (alignSet.has(aId)) {
        report(
          "duplicate-align-at",
          `Duplicate alignAt ID '${aId}' in equation '${equationId}'.`,
          aId,
        );
      }
      alignSet.add(aId);
    }
  }

  if (layout.breaks) {
    for (const bId of layout.breaks) {
      const breakNode = nodeMap.get(bId);
      if (!breakNode) {
        report(
          "unresolved-break-id",
          `Break ID '${bId}' not found in equation '${equationId}'.`,
          bId,
        );
        continue;
      }

      // If the break is after the root relation itself (breaking after the '=' operator)
      if (breakNode === root && root.kind === "relation") {
        continue;
      }

      // Check where breakNode sits in the tree
      const parent = findParent(root, bId);
      if (!parent) {
        report("invalid-break-location", `Break node '${bId}' has no parent.`, bId);
        continue;
      }

      // Break node must be a child of relation, top-level sum/difference, or top-level product
      const isValidParent =
        parent.kind === "relation" ||
        (parent === root && (parent.kind === "sum" || parent.kind === "product")) ||
        (root.kind === "relation" &&
          (parent === root.left || parent === root.right) &&
          (parent.kind === "sum" || parent.kind === "product"));

      if (!isValidParent) {
        // Check if inside atom (fraction, radicand, subscript, superscript, function argument)
        if (isInsideAtom(root, bId)) {
          report(
            "linebreak-inside-atom",
            `Break authored inside atom (fraction bar, radicand, exponent, or function argument) at node '${bId}'.`,
            bId,
          );
        } else {
          report(
            "invalid-break-location",
            `Break node '${bId}' is not a child of a relation, top-level sum, or top-level product.`,
            bId,
          );
        }
        continue;
      }

      // Must not be the last child
      const pChildren = children(parent);
      const lastChild = pChildren[pChildren.length - 1];
      if (lastChild && nodeId(lastChild) === bId) {
        report(
          "break-after-last-child",
          `Break node '${bId}' cannot be the last child of its parent.`,
          bId,
        );
      }
    }
  }
}

function findParent(root: Expression, targetId: string): Expression | null {
  for (const child of children(root)) {
    if (nodeId(child) === targetId) return root;
    const found = findParent(child, targetId);
    if (found) return found;
  }
  return null;
}

function isInsideAtom(root: Expression, targetId: string): boolean {
  let insideAtom = false;

  function visit(node: Expression, inAtom: boolean) {
    if (nodeId(node) === targetId && inAtom) {
      insideAtom = true;
      return;
    }

    const atomParent =
      node.kind === "quotient" ||
      node.kind === "root" ||
      node.kind === "power" ||
      node.kind === "function";

    for (const child of children(node)) {
      visit(child, inAtom || atomParent);
    }
  }

  visit(root, false);
  return insideAtom;
}

function checkSemanticKindConflicts(
  root: Expression,
  report: (rule: string, message: string, nodeId?: string | null) => void,
): void {
  // Walk sums and products to detect semantic kind conflicts
  for (const node of walk(root)) {
    if (node.kind === "sum") {
      const kinds = node.args
        .map((arg) => extractSemanticKind(arg))
        .filter((k): k is string => k !== null);

      for (let i = 0; i < kinds.length; i++) {
        for (let j = i + 1; j < kinds.length; j++) {
          const ki = kinds[i]!;
          const kj = kinds[j]!;
          if (areKindsIncompatible(ki, kj)) {
            report(
              "semantic-kind-conflict",
              `Incompatible semantic kinds in sum: '${ki}' and '${kj}'.`,
              nodeId(node),
            );
          }
        }
      }
    }
  }
}

function extractSemanticKind(node: Expression): string | null {
  if (node.kind === "symbol") {
    const qRes = resolveQuantityId(node.quantityId);
    if (qRes.ok) {
      if (qRes.quantity.frequencyKind) return qRes.quantity.frequencyKind;
      if (qRes.quantity.timeKind) return qRes.quantity.timeKind;
      if (qRes.quantity.densityKind) return qRes.quantity.densityKind;
    }
  }
  if (node.kind === "negate" || node.kind === "average" || node.kind === "group") {
    return extractSemanticKind(node.argument);
  }
  return null;
}

function areKindsIncompatible(a: string, b: string): boolean {
  if (a === b) return false;
  for (const [x, y] of INCOMPATIBLE_SEMANTIC_KINDS) {
    if ((a === x && b === y) || (a === y && b === x)) return true;
  }
  return false;
}
