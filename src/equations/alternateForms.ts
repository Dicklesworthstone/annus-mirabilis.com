/**
 * Alternate forms validation and rename-equivalence checking for equations.
 *
 * Specified in am-eq-expression-tree-8kl:
 * - "The modern notation form is generated from the primary tree by renames only.
 *    Unit conversions and modernizations exist only as alternate forms with their
 *    required fields, and an alternate that is only a rename is rejected."
 * - Rejection rule: 'alternate-is-rename' ("renames belong in the notation concordance,
 *    not alternate forms").
 * - Required fields check:
 *   - 'unit-conversion' requires 'unitSystem' { from, to } and 'derivationChainId'
 *   - 'modernization' requires 'modernLensRef' and historicalStatus: 'later-development'
 */

import { ContentError } from "../content/compiler/json.ts";
import { type AlternateFormId, parseAlternateFormId } from "../content/ids.ts";
import { type ExactScale, type Expression, walk } from "./ast.ts";
import type { CompositeGroup } from "./monomial.ts";

export type AlternateFormRelation = "unit-conversion" | "modernization";

export interface UnitConversionSystem {
  readonly from: string;
  readonly to: string;
}

export interface AlternateFormBase {
  readonly id: AlternateFormId;
  readonly relation: AlternateFormRelation;
  readonly label: string;
  readonly tree: Expression;
  readonly unitSystem?: UnitConversionSystem | undefined;
  readonly derivationChainId?: string | undefined;
  readonly modernLensRef?: string | undefined;
  readonly historicalStatus?: "later-development" | undefined;
}

export interface AlternateFormUnitConversion extends AlternateFormBase {
  readonly relation: "unit-conversion";
  readonly unitSystem: UnitConversionSystem;
  readonly derivationChainId: string;
}

export interface AlternateFormModernization extends AlternateFormBase {
  readonly relation: "modernization";
  readonly modernLensRef: string;
  readonly historicalStatus: "later-development";
}

export type AlternateForm = AlternateFormUnitConversion | AlternateFormModernization;

export type AlternateFormValidationResult =
  | {
      readonly valid: true;
      readonly form: AlternateForm;
    }
  | {
      readonly valid: false;
      readonly error: string;
      readonly rule: string;
      readonly equationId: string;
      readonly formId?: string;
    };

export interface EquivalentUpToRenamesOptions {
  readonly compositeGroups?: readonly CompositeGroup[] | undefined;
}

export interface AlternateFormValidationOptions {
  readonly compositeGroups?: readonly CompositeGroup[] | undefined;
  readonly checkRename?: boolean | undefined;
  readonly checkRequiredFields?: boolean | undefined;
}

function scaleEqual(a: ExactScale | undefined, b: ExactScale | undefined): boolean {
  const an = a ?? { num: 1, den: 1 };
  const bn = b ?? { num: 1, den: 1 };
  return an.num === bn.num && an.den === bn.den;
}

function unwrapGroups(expr: Expression): Expression {
  let curr = expr;
  while (curr.kind === "group") {
    curr = curr.argument;
  }
  return curr;
}

function matchesCompositeGroup(
  node: Expression,
  symbolNode: Extract<Expression, { kind: "symbol" }>,
  compositeGroups: readonly CompositeGroup[],
): boolean {
  for (const group of compositeGroups) {
    if (group.quantityId === symbolNode.quantityId) {
      const nodeTermIds = new Set(
        walk(node)
          .filter((n): n is Extract<Expression, { kind: "symbol" }> => n.kind === "symbol")
          .map((n) => n.termId),
      );
      if (
        group.termIds.length === nodeTermIds.size &&
        group.termIds.every((id) => nodeTermIds.has(id))
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks whether two expression trees are structurally and semantically equivalent
 * up to symbol renames (and composite-group renames).
 *
 * If this returns true, the alternate tree expresses the exact same mathematical
 * relationship among the exact same physical quantities in the exact same unit system,
 * merely renaming symbols (e.g. V -> c, beta -> gamma, k -> eta) or substituting
 * composite groups (e.g. R/N -> k_B).
 *
 * Renames belong in the notation concordance, not as separate alternate forms.
 */
export function isTreeEquivalentUpToRenames(
  primary: Expression,
  alternate: Expression,
  options: EquivalentUpToRenamesOptions = {},
): boolean {
  const a = unwrapGroups(primary);
  const b = unwrapGroups(alternate);

  // Check composite group substitution if compositeGroups are declared
  if (options.compositeGroups && options.compositeGroups.length > 0) {
    if (b.kind === "symbol" && matchesCompositeGroup(a, b, options.compositeGroups)) {
      return true;
    }
    if (a.kind === "symbol" && matchesCompositeGroup(b, a, options.compositeGroups)) {
      return true;
    }
  }

  if (a.kind !== b.kind) {
    return false;
  }

  switch (a.kind) {
    case "symbol": {
      return (
        b.kind === "symbol" &&
        a.quantityId === b.quantityId &&
        scaleEqual(a.scale, b.scale) &&
        a.index === b.index &&
        (a.at === undefined || b.at === undefined
          ? a.at === b.at
          : isTreeEquivalentUpToRenames(a.at, b.at, options))
      );
    }
    case "constant": {
      return b.kind === "constant" && a.name === b.name;
    }
    case "number": {
      return b.kind === "number" && (a.value === b.value || Number(a.value) === Number(b.value));
    }
    case "sum":
    case "product": {
      return (
        b.kind === a.kind &&
        a.args.length === b.args.length &&
        a.args.every((arg, idx) => {
          const bArg = b.args[idx];
          return bArg !== undefined && isTreeEquivalentUpToRenames(arg, bArg, options);
        })
      );
    }
    case "quotient": {
      return (
        b.kind === "quotient" &&
        isTreeEquivalentUpToRenames(a.numerator, b.numerator, options) &&
        isTreeEquivalentUpToRenames(a.denominator, b.denominator, options)
      );
    }
    case "power": {
      return (
        b.kind === "power" &&
        scaleEqual(a.exponent, b.exponent) &&
        isTreeEquivalentUpToRenames(a.base, b.base, options)
      );
    }
    case "symbolPower": {
      return (
        b.kind === "symbolPower" &&
        isTreeEquivalentUpToRenames(a.exponent, b.exponent, options) &&
        isTreeEquivalentUpToRenames(a.base, b.base, options)
      );
    }
    case "root": {
      return (
        b.kind === "root" &&
        a.degree === b.degree &&
        isTreeEquivalentUpToRenames(a.radicand, b.radicand, options)
      );
    }
    case "negate":
    case "average":
    case "group": {
      return b.kind === a.kind && isTreeEquivalentUpToRenames(a.argument, b.argument, options);
    }
    case "function": {
      return (
        b.kind === "function" &&
        a.name === b.name &&
        isTreeEquivalentUpToRenames(a.argument, b.argument, options)
      );
    }
    case "relation": {
      return (
        b.kind === "relation" &&
        a.operator === b.operator &&
        isTreeEquivalentUpToRenames(a.left, b.left, options) &&
        isTreeEquivalentUpToRenames(a.right, b.right, options)
      );
    }
    case "derivative": {
      return (
        b.kind === "derivative" &&
        a.order === b.order &&
        a.partial === b.partial &&
        isTreeEquivalentUpToRenames(a.expression, b.expression, options) &&
        isTreeEquivalentUpToRenames(a.variable, b.variable, options) &&
        (a.heldFixed ?? []).length === (b.heldFixed ?? []).length &&
        (a.heldFixed ?? []).every((h, i) => {
          const bh = b.heldFixed?.[i];
          return bh !== undefined && isTreeEquivalentUpToRenames(h, bh, options);
        })
      );
    }
    case "integral": {
      const bounds = (x: Expression | undefined, y: Expression | undefined) =>
        x === undefined || y === undefined ? x === y : isTreeEquivalentUpToRenames(x, y, options);
      return (
        b.kind === "integral" &&
        isTreeEquivalentUpToRenames(a.expression, b.expression, options) &&
        isTreeEquivalentUpToRenames(a.variable, b.variable, options) &&
        bounds(a.lower, b.lower) &&
        bounds(a.upper, b.upper)
      );
    }
    case "partialOperator": {
      return (
        b.kind === "partialOperator" && isTreeEquivalentUpToRenames(a.variable, b.variable, options)
      );
    }
  }
}

/**
 * Validates an authored alternate form against its primary equation tree.
 *
 * Enforces:
 * 1. ID grammar and matching equation base ID (<equation>.alt.<name>).
 * 2. Authored non-empty label.
 * 3. Relation must be 'unit-conversion' or 'modernization'.
 * 4. Required fields:
 *    - 'unit-conversion' requires 'unitSystem' { from, to } and 'derivationChainId'.
 *    - 'modernization' requires 'modernLensRef' and historicalStatus: 'later-development'.
 * 5. Rejection of rename-only alternates ('alternate-is-rename').
 */
export function validateAlternateForm(
  input: unknown,
  primaryTree: Expression,
  equationId: string,
  options: AlternateFormValidationOptions = {},
): AlternateFormValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      valid: false,
      rule: "invalid-alternate-form",
      equationId,
      error: `Equation '${equationId}': alternate form must be a non-null object.`,
    };
  }

  const o = input as Record<string, unknown>;

  // 1. Validate ID
  if (typeof o.id !== "string" || !o.id) {
    return {
      valid: false,
      rule: "alternate-form-id-grammar",
      equationId,
      error: `Equation '${equationId}': alternate form ID must be a non-empty string.`,
    };
  }

  const idRes = parseAlternateFormId(o.id);
  if (!idRes.ok) {
    return {
      valid: false,
      rule: idRes.rule ?? "alternate-form-id-grammar",
      equationId,
      formId: o.id,
      error: `Equation '${equationId}': ${idRes.error}`,
    };
  }

  if (!o.id.startsWith(`${equationId}.alt.`)) {
    return {
      valid: false,
      rule: "alternate-form-equation-mismatch",
      equationId,
      formId: o.id,
      error: `Equation '${equationId}': alternate form ID '${o.id}' does not match equation base ID '${equationId}'.`,
    };
  }

  // 2. Validate Label
  if (typeof o.label !== "string" || !o.label.trim()) {
    return {
      valid: false,
      rule: "alternate-missing-label",
      equationId,
      formId: o.id,
      error: `Equation '${equationId}': alternate form '${o.id}' requires a non-empty authored 'label'.`,
    };
  }

  // 3. Validate Relation
  if (o.relation !== "unit-conversion" && o.relation !== "modernization") {
    return {
      valid: false,
      rule: "invalid-alternate-relation",
      equationId,
      formId: o.id,
      error: `Equation '${equationId}': alternate form '${o.id}' relation must be 'unit-conversion' or 'modernization'; renames belong in the notation concordance, not alternate forms.`,
    };
  }

  // 4. Validate Relation-Specific Required Fields
  if (options.checkRequiredFields !== false) {
    if (o.relation === "unit-conversion") {
      if (
        !o.unitSystem ||
        typeof o.unitSystem !== "object" ||
        Array.isArray(o.unitSystem) ||
        typeof (o.unitSystem as Record<string, unknown>).from !== "string" ||
        !(o.unitSystem as Record<string, unknown>).from ||
        typeof (o.unitSystem as Record<string, unknown>).to !== "string" ||
        !(o.unitSystem as Record<string, unknown>).to
      ) {
        return {
          valid: false,
          rule: "unit-conversion-missing-fields",
          equationId,
          formId: o.id,
          error: `Equation '${equationId}': unit-conversion alternate form '${o.id}' requires 'unitSystem' with non-empty 'from' and 'to' fields.`,
        };
      }

      if (typeof o.derivationChainId !== "string" || !o.derivationChainId.trim()) {
        return {
          valid: false,
          rule: "unit-conversion-missing-fields",
          equationId,
          formId: o.id,
          error: `Equation '${equationId}': unit-conversion alternate form '${o.id}' requires non-empty 'derivationChainId'.`,
        };
      }
    } else if (o.relation === "modernization") {
      if (typeof o.modernLensRef !== "string" || !o.modernLensRef.trim()) {
        return {
          valid: false,
          rule: "modernization-missing-fields",
          equationId,
          formId: o.id,
          error: `Equation '${equationId}': modernization alternate form '${o.id}' requires non-empty 'modernLensRef'.`,
        };
      }

      if (o.historicalStatus !== "later-development") {
        return {
          valid: false,
          rule: "modernization-missing-fields",
          equationId,
          formId: o.id,
          error: `Equation '${equationId}': modernization alternate form '${o.id}' requires 'historicalStatus' to be 'later-development'.`,
        };
      }
    }
  }

  // 5. Validate Tree
  if (!o.tree || typeof o.tree !== "object") {
    return {
      valid: false,
      rule: "alternate-missing-tree",
      equationId,
      formId: o.id,
      error: `Equation '${equationId}': alternate form '${o.id}' requires a valid 'tree' Expression.`,
    };
  }
  const altTree = o.tree as Expression;

  // 6. Rejection of Rename-Only Alternates
  if (options.checkRename !== false) {
    if (
      isTreeEquivalentUpToRenames(primaryTree, altTree, {
        compositeGroups: options.compositeGroups,
      })
    ) {
      return {
        valid: false,
        rule: "alternate-is-rename",
        equationId,
        formId: o.id,
        error: `Equation '${equationId}': alternate form '${o.id}' is only a rename of primary tree; renames belong in the notation concordance, not alternate forms.`,
      };
    }
  }

  // 7. Success
  if (o.relation === "unit-conversion") {
    const us = (o.unitSystem as Record<string, unknown>) ?? { from: "", to: "" };
    const form: AlternateFormUnitConversion = {
      id: o.id as AlternateFormId,
      relation: "unit-conversion",
      label: o.label as string,
      tree: altTree,
      unitSystem: {
        from: String(us.from ?? ""),
        to: String(us.to ?? ""),
      },
      derivationChainId: String(o.derivationChainId ?? ""),
    };
    return { valid: true, form };
  }

  const form: AlternateFormModernization = {
    id: o.id as AlternateFormId,
    relation: "modernization",
    label: o.label as string,
    tree: altTree,
    modernLensRef: String(o.modernLensRef ?? ""),
    historicalStatus: "later-development",
  };
  return { valid: true, form };
}

/**
 * Validates an array of alternate forms for an equation.
 */
export function validateAlternateForms(
  input: unknown,
  primaryTree: Expression,
  equationId: string,
  options: AlternateFormValidationOptions = {},
):
  | { readonly valid: true; readonly forms: readonly AlternateForm[] }
  | {
      readonly valid: false;
      readonly error: string;
      readonly rule: string;
      readonly equationId: string;
      readonly formId?: string;
    } {
  if (input === undefined || input === null) {
    return { valid: true, forms: [] };
  }
  if (!Array.isArray(input)) {
    return {
      valid: false,
      rule: "invalid-alternate-forms-list",
      equationId,
      error: `Equation '${equationId}': 'alternateForms' must be an array.`,
    };
  }

  const forms: AlternateForm[] = [];
  const seenIds = new Set<string>();

  for (const item of input) {
    const res = validateAlternateForm(item, primaryTree, equationId, options);
    if (!res.valid) {
      return res;
    }
    if (seenIds.has(res.form.id)) {
      return {
        valid: false,
        rule: "duplicate-alternate-id",
        equationId,
        formId: res.form.id,
        error: `Equation '${equationId}': duplicate alternate form ID '${res.form.id}'.`,
      };
    }
    seenIds.add(res.form.id);
    forms.push(res.form);
  }

  return { valid: true, forms };
}

/**
 * Parses and asserts validity of an authored alternate form, throwing ContentError on rejection.
 */
export function parseAlternateForm(
  input: unknown,
  primaryTree: Expression,
  equationId: string,
  options?: AlternateFormValidationOptions,
): AlternateForm {
  const result = validateAlternateForm(input, primaryTree, equationId, options);
  if (!result.valid) {
    throw new ContentError(result.rule, `${equationId}.${result.formId ?? "alt"}`, result.error);
  }
  return result.form;
}

/**
 * Parses and asserts validity of an array of alternate forms, throwing ContentError on rejection.
 */
export function parseAlternateForms(
  input: unknown,
  primaryTree: Expression,
  equationId: string,
  options?: AlternateFormValidationOptions,
): readonly AlternateForm[] {
  const res = validateAlternateForms(input, primaryTree, equationId, options);
  if (!res.valid) {
    throw new ContentError(res.rule, `${equationId}.${res.formId ?? "alt"}`, res.error);
  }
  return res.forms;
}
