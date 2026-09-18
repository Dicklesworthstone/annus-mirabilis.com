/**
 * Validation schema and type guards for semantic equation trees.
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md (§4.7, §11.2, §11.3).
 * Epic: am-ep-equations-y76
 * Bead: am-eq-expression-tree-8kl
 */

import { parseAlternateFormId, parseOperationId, parseTermId } from "../../content/ids.ts";
import type {
  AlternateForm,
  CompositeGroup,
  EquationTree,
  ExactScale,
  Expression,
  LayoutHints,
} from "./types.ts";
import { TREE_SCHEMA_VERSION } from "./types.ts";

export type { AlternateForm, CompositeGroup, EquationTree, ExactScale, Expression, LayoutHints };

export class TreeSchemaError extends Error {
  readonly code: string;
  readonly path: string;

  constructor(code: string, message: string, path = "root") {
    super(`[TreeSchema] ${path}: ${message} (${code})`);
    this.name = "TreeSchemaError";
    this.code = code;
    this.path = path;
  }
}

export function validateExactScale(raw: unknown, path = "scale", nonzero = true): ExactScale {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new TreeSchemaError("invalid-scale", "Scale must be an object with num and den.", path);
  }
  const o = raw as Record<string, unknown>;
  const num = Number(o.num);
  const den = Number(o.den);

  if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den)) {
    throw new TreeSchemaError("invalid-scale", "num and den must be safe integers.", path);
  }
  if (den <= 0) {
    throw new TreeSchemaError(
      "invalid-scale-denominator",
      "Scale denominator must be positive (> 0).",
      path,
    );
  }
  if (nonzero && num === 0) {
    throw new TreeSchemaError("zero-scale", "Scale numerator cannot be zero.", path);
  }

  // Greatest common divisor
  const gcd = (a: number, b: number): number => {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x;
  };

  if (gcd(num, den) !== 1) {
    throw new TreeSchemaError(
      "non-reduced-scale",
      `Scale { num: ${num}, den: ${den} } must be reduced to lowest terms.`,
      path,
    );
  }

  return { num, den };
}

export function validateExpressionNode(raw: unknown, path = "tree"): Expression {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new TreeSchemaError("invalid-node", "Expression node must be an object.", path);
  }
  const o = raw as Record<string, unknown>;
  const kind = o.kind;

  if (typeof kind !== "string") {
    throw new TreeSchemaError("missing-kind", "Node is missing kind.", path);
  }

  if ("opId" in o && o.opId !== undefined) {
    if (typeof o.opId !== "string" || !o.opId.trim()) {
      throw new TreeSchemaError(
        "invalid-op-id",
        "opId must be a non-empty string.",
        `${path}.opId`,
      );
    }
    const opRes = parseOperationId(o.opId);
    if (!opRes.ok) {
      throw new TreeSchemaError("invalid-op-id", opRes.error, `${path}.opId`);
    }
  }

  switch (kind) {
    case "symbol": {
      if (typeof o.termId !== "string" || !o.termId.trim()) {
        throw new TreeSchemaError(
          "missing-term-id",
          "termId is required on symbol node.",
          `${path}.termId`,
        );
      }
      const termRes = parseTermId(o.termId);
      if (!termRes.ok) {
        throw new TreeSchemaError("invalid-term-id", termRes.error, `${path}.termId`);
      }
      if (typeof o.quantityId !== "string" || !o.quantityId.trim()) {
        throw new TreeSchemaError(
          "missing-quantity-id",
          "quantityId is required on symbol node.",
          `${path}.quantityId`,
        );
      }
      let scale: ExactScale | undefined;
      if (o.scale !== undefined) {
        scale = validateExactScale(o.scale, `${path}.scale`, true);
      }
      return {
        kind: "symbol",
        termId: o.termId,
        quantityId: o.quantityId,
        scale,
        component: o.component as "x" | "y" | "z" | undefined,
        role: typeof o.role === "string" ? o.role : undefined,
      };
    }
    case "constant": {
      if (typeof o.name !== "string" || !o.name.trim()) {
        throw new TreeSchemaError(
          "missing-constant-name",
          "name is required on constant node.",
          `${path}.name`,
        );
      }
      return { kind: "constant", name: o.name };
    }
    case "number": {
      if (typeof o.value !== "string" || !o.value.trim()) {
        throw new TreeSchemaError(
          "missing-number-value",
          "value is required on number node.",
          `${path}.value`,
        );
      }
      if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(o.value)) {
        throw new TreeSchemaError(
          "invalid-number-value",
          `Invalid decimal string: '${o.value}'`,
          `${path}.value`,
        );
      }
      return {
        kind: "number",
        value: o.value,
        unit: typeof o.unit === "string" ? o.unit : undefined,
      };
    }
    case "sum": {
      if (!Array.isArray(o.args) || o.args.length < 2) {
        throw new TreeSchemaError(
          "invalid-args",
          "sum requires at least 2 arguments.",
          `${path}.args`,
        );
      }
      const args = o.args.map((a, i) => validateExpressionNode(a, `${path}.args[${i}]`));
      return {
        kind: "sum",
        opId: o.opId as string | undefined,
        args,
      };
    }
    case "product": {
      if (!Array.isArray(o.args) || o.args.length < 2) {
        throw new TreeSchemaError(
          "invalid-args",
          "product requires at least 2 arguments.",
          `${path}.args`,
        );
      }
      const args = o.args.map((a, i) => validateExpressionNode(a, `${path}.args[${i}]`));
      return {
        kind: "product",
        opId: o.opId as string | undefined,
        args,
        style: o.style as "explicit" | "juxtaposed" | undefined,
      };
    }
    case "quotient": {
      if (!o.numerator || !o.denominator) {
        throw new TreeSchemaError(
          "invalid-quotient",
          "quotient requires numerator and denominator.",
          path,
        );
      }
      return {
        kind: "quotient",
        opId: o.opId as string | undefined,
        numerator: validateExpressionNode(o.numerator, `${path}.numerator`),
        denominator: validateExpressionNode(o.denominator, `${path}.denominator`),
        style: o.style as "fraction" | "solidus" | undefined,
      };
    }
    case "power": {
      if (!o.base || !o.exponent) {
        throw new TreeSchemaError("invalid-power", "power requires base and exponent.", path);
      }
      const base = validateExpressionNode(o.base, `${path}.base`);
      let exponent: ExactScale | Expression;
      if (
        typeof o.exponent === "object" &&
        o.exponent !== null &&
        "num" in o.exponent &&
        "den" in o.exponent &&
        !("kind" in o.exponent)
      ) {
        exponent = validateExactScale(o.exponent, `${path}.exponent`, false);
      } else {
        exponent = validateExpressionNode(o.exponent, `${path}.exponent`);
      }
      return {
        kind: "power",
        opId: o.opId as string | undefined,
        base,
        exponent,
      };
    }
    case "root": {
      if (!o.radicand) {
        throw new TreeSchemaError("invalid-root", "root requires radicand.", path);
      }
      const degree = o.degree !== undefined ? Number(o.degree) : 2;
      if (!Number.isSafeInteger(degree) || degree < 2) {
        throw new TreeSchemaError(
          "invalid-degree",
          "root degree must be integer >= 2.",
          `${path}.degree`,
        );
      }
      return {
        kind: "root",
        opId: o.opId as string | undefined,
        radicand: validateExpressionNode(o.radicand, `${path}.radicand`),
        degree,
      };
    }
    case "negate":
    case "average":
    case "norm":
    case "group": {
      if (!o.argument) {
        throw new TreeSchemaError(
          "invalid-argument",
          `${kind} requires argument.`,
          `${path}.argument`,
        );
      }
      return {
        kind,
        opId: o.opId as string | undefined,
        argument: validateExpressionNode(o.argument, `${path}.argument`),
      };
    }
    case "function": {
      const allowedFns = ["ln", "exp", "sin", "cos", "sinh", "cosh", "tanh", "sqrt"];
      if (typeof o.name !== "string" || !allowedFns.includes(o.name)) {
        throw new TreeSchemaError(
          "invalid-function-name",
          `Invalid function name '${String(o.name)}'. Expected one of ${allowedFns.join(", ")}`,
          `${path}.name`,
        );
      }
      if (!o.argument) {
        throw new TreeSchemaError(
          "missing-argument",
          "function requires argument.",
          `${path}.argument`,
        );
      }
      return {
        kind: "function",
        opId: o.opId as string | undefined,
        name: o.name as Expression & { kind: "function" } extends infer F
          ? F extends { name: infer N }
            ? N
            : never
          : never,
        argument: validateExpressionNode(o.argument, `${path}.argument`),
      };
    }
    case "relation": {
      const allowedOps = [
        "=",
        "approx",
        "<",
        "<=",
        ">",
        ">=",
        "propto",
        "equiv",
        "define",
        "maps-to",
      ];
      if (typeof o.operator !== "string" || !allowedOps.includes(o.operator)) {
        throw new TreeSchemaError(
          "invalid-relation-operator",
          `Invalid relation operator '${String(o.operator)}'. Expected one of ${allowedOps.join(", ")}`,
          `${path}.operator`,
        );
      }
      if (!o.left || !o.right) {
        throw new TreeSchemaError(
          "invalid-relation",
          "relation requires left and right sides.",
          path,
        );
      }
      return {
        kind: "relation",
        opId: o.opId as string | undefined,
        operator: o.operator as Expression & { kind: "relation" } extends infer R
          ? R extends { operator: infer OP }
            ? OP
            : never
          : never,
        left: validateExpressionNode(o.left, `${path}.left`),
        right: validateExpressionNode(o.right, `${path}.right`),
      };
    }
    case "derivative": {
      if (!o.expression || !o.variable) {
        throw new TreeSchemaError(
          "invalid-derivative",
          "derivative requires expression and variable.",
          path,
        );
      }
      const order = o.order !== undefined ? Number(o.order) : 1;
      if (!Number.isSafeInteger(order) || order < 1 || order > 8) {
        throw new TreeSchemaError(
          "invalid-order",
          "derivative order must be 1–8.",
          `${path}.order`,
        );
      }
      return {
        kind: "derivative",
        opId: o.opId as string | undefined,
        expression: validateExpressionNode(o.expression, `${path}.expression`),
        variable: validateExpressionNode(o.variable, `${path}.variable`),
        order,
        partial: Boolean(o.partial),
        heldFixed:
          typeof o.heldFixed === "object" && o.heldFixed !== null
            ? validateExpressionNode(o.heldFixed, `${path}.heldFixed`)
            : typeof o.heldFixed === "string"
              ? o.heldFixed
              : undefined,
      };
    }
    case "integral": {
      if (!o.expression || !o.variable) {
        throw new TreeSchemaError(
          "invalid-integral",
          "integral requires expression and variable.",
          path,
        );
      }
      return {
        kind: "integral",
        opId: o.opId as string | undefined,
        expression: validateExpressionNode(o.expression, `${path}.expression`),
        variable: validateExpressionNode(o.variable, `${path}.variable`),
        lowerBound: o.lowerBound
          ? validateExpressionNode(o.lowerBound, `${path}.lowerBound`)
          : undefined,
        upperBound: o.upperBound
          ? validateExpressionNode(o.upperBound, `${path}.upperBound`)
          : undefined,
      };
    }
    case "seriesSum":
    case "seriesProduct": {
      if (!o.index || !o.body) {
        throw new TreeSchemaError("invalid-series", `${kind} requires index and body.`, path);
      }
      return {
        kind,
        opId: o.opId as string | undefined,
        index:
          typeof o.index === "object" && o.index !== null
            ? validateExpressionNode(o.index, `${path}.index`)
            : String(o.index),
        lowerBound: o.lowerBound
          ? validateExpressionNode(o.lowerBound, `${path}.lowerBound`)
          : undefined,
        upperBound: o.upperBound
          ? validateExpressionNode(o.upperBound, `${path}.upperBound`)
          : undefined,
        body: validateExpressionNode(o.body, `${path}.body`),
      };
    }
    case "limit": {
      if (!o.variable || !o.target || !o.body) {
        throw new TreeSchemaError(
          "invalid-limit",
          "limit requires variable, target, and body.",
          path,
        );
      }
      return {
        kind: "limit",
        opId: o.opId as string | undefined,
        variable: validateExpressionNode(o.variable, `${path}.variable`),
        target: validateExpressionNode(o.target, `${path}.target`),
        body: validateExpressionNode(o.body, `${path}.body`),
      };
    }
    case "dotProduct":
    case "crossProduct": {
      if (!o.left || !o.right) {
        throw new TreeSchemaError(
          "invalid-product",
          `${kind} requires left and right arguments.`,
          path,
        );
      }
      return {
        kind,
        opId: o.opId as string | undefined,
        left: validateExpressionNode(o.left, `${path}.left`),
        right: validateExpressionNode(o.right, `${path}.right`),
      };
    }
    case "vector": {
      if (!Array.isArray(o.elements)) {
        throw new TreeSchemaError(
          "invalid-vector",
          "vector requires elements array.",
          `${path}.elements`,
        );
      }
      return {
        kind: "vector",
        opId: o.opId as string | undefined,
        elements: o.elements.map((el, i) => validateExpressionNode(el, `${path}.elements[${i}]`)),
      };
    }
    case "matrix": {
      if (!Array.isArray(o.rows) || o.rows.length === 0) {
        throw new TreeSchemaError(
          "invalid-matrix",
          "matrix requires non-empty rows array.",
          `${path}.rows`,
        );
      }
      const numCols = Array.isArray(o.rows[0]) ? o.rows[0].length : 0;
      if (numCols === 0) {
        throw new TreeSchemaError(
          "invalid-matrix",
          "matrix rows cannot be empty.",
          `${path}.rows[0]`,
        );
      }
      const rows = o.rows.map((row, r) => {
        if (!Array.isArray(row) || row.length !== numCols) {
          throw new TreeSchemaError(
            "ragged-matrix",
            `matrix row ${r} length (${Array.isArray(row) ? row.length : 0}) does not match first row length (${numCols}).`,
            `${path}.rows[${r}]`,
          );
        }
        return row.map((cell, c) => validateExpressionNode(cell, `${path}.rows[${r}][${c}]`));
      });
      return {
        kind: "matrix",
        opId: o.opId as string | undefined,
        rows,
        targetDimensions: Array.isArray(o.targetDimensions) ? o.targetDimensions : undefined,
      };
    }
    case "piecewise": {
      if (!Array.isArray(o.cases) || o.cases.length === 0) {
        throw new TreeSchemaError(
          "invalid-piecewise",
          "piecewise requires non-empty cases array.",
          `${path}.cases`,
        );
      }
      const cases = o.cases.map((c, i) => {
        if (!c || typeof c !== "object" || !("condition" in c) || !("value" in c)) {
          throw new TreeSchemaError(
            "invalid-case",
            "piecewise case requires condition and value.",
            `${path}.cases[${i}]`,
          );
        }
        return {
          condition: validateExpressionNode(
            (c as Record<string, unknown>).condition,
            `${path}.cases[${i}].condition`,
          ),
          value: validateExpressionNode(
            (c as Record<string, unknown>).value,
            `${path}.cases[${i}].value`,
          ),
        };
      });
      return {
        kind: "piecewise",
        opId: o.opId as string | undefined,
        cases,
        otherwise: o.otherwise
          ? validateExpressionNode(o.otherwise, `${path}.otherwise`)
          : undefined,
      };
    }
    case "seriesTruncation": {
      return {
        kind: "seriesTruncation",
        opId: o.opId as string | undefined,
        order: typeof o.order === "string" ? o.order : undefined,
      };
    }
    case "textAnnotation": {
      if (typeof o.text !== "string") {
        throw new TreeSchemaError(
          "missing-text",
          "textAnnotation requires text field.",
          `${path}.text`,
        );
      }
      return {
        kind: "textAnnotation",
        opId: o.opId as string | undefined,
        text: o.text,
      };
    }
    default:
      throw new TreeSchemaError(
        "unknown-node-kind",
        `Unknown node kind '${kind}'.`,
        `${path}.kind`,
      );
  }
}

export function validateLayoutHints(raw: unknown, path = "layout"): LayoutHints {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new TreeSchemaError("invalid-layout", "Layout hints must be an object.", path);
  }
  const o = raw as Record<string, unknown>;
  const breaks = Array.isArray(o.breaks)
    ? o.breaks.map((b, i) => {
        if (typeof b !== "string")
          throw new TreeSchemaError(
            "invalid-break-id",
            "break id must be string.",
            `${path}.breaks[${i}]`,
          );
        return b;
      })
    : undefined;

  const alignAt = Array.isArray(o.alignAt)
    ? o.alignAt.map((a, i) => {
        if (typeof a !== "string")
          throw new TreeSchemaError(
            "invalid-align-id",
            "alignAt id must be string.",
            `${path}.alignAt[${i}]`,
          );
        return a;
      })
    : undefined;

  return { breaks, alignAt };
}

export function validateCompositeGroup(raw: unknown, path = "group"): CompositeGroup {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new TreeSchemaError("invalid-group", "Composite group must be an object.", path);
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new TreeSchemaError(
      "missing-group-id",
      "id is required on CompositeGroup.",
      `${path}.id`,
    );
  }
  if (!Array.isArray(o.memberTermIds) || o.memberTermIds.length < 2) {
    throw new TreeSchemaError(
      "invalid-group-members",
      "memberTermIds must contain at least 2 term IDs.",
      `${path}.memberTermIds`,
    );
  }
  for (const m of o.memberTermIds) {
    if (typeof m !== "string" || !m.trim()) {
      throw new TreeSchemaError(
        "invalid-group-member",
        "member term ID must be non-empty string.",
        `${path}.memberTermIds`,
      );
    }
  }
  if (typeof o.quantityId !== "string" || !o.quantityId.trim()) {
    throw new TreeSchemaError(
      "missing-group-quantity-id",
      "quantityId is required on CompositeGroup.",
      `${path}.quantityId`,
    );
  }

  return {
    id: o.id,
    memberTermIds: o.memberTermIds as string[],
    quantityId: o.quantityId,
    role: typeof o.role === "string" ? o.role : undefined,
    modernSymbol: typeof o.modernSymbol === "string" ? o.modernSymbol : undefined,
  };
}

export function validateAlternateForm(raw: unknown, path = "alternateForm"): AlternateForm {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new TreeSchemaError("invalid-alternate-form", "Alternate form must be an object.", path);
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new TreeSchemaError("missing-id", "id is required on alternate form.", `${path}.id`);
  }
  const altRes = parseAlternateFormId(o.id);
  if (!altRes.ok) {
    throw new TreeSchemaError("invalid-alternate-id", altRes.error, `${path}.id`);
  }

  if (o.relation !== "unit-conversion" && o.relation !== "modernization") {
    throw new TreeSchemaError(
      "invalid-alternate-relation",
      "relation must be 'unit-conversion' or 'modernization'.",
      `${path}.relation`,
    );
  }

  if (typeof o.label !== "string" || !o.label.trim()) {
    throw new TreeSchemaError(
      "missing-label",
      "label is required on alternate form.",
      `${path}.label`,
    );
  }

  if (!o.tree) {
    throw new TreeSchemaError(
      "missing-tree",
      "tree is required on alternate form.",
      `${path}.tree`,
    );
  }
  const tree = validateExpressionNode(o.tree, `${path}.tree`);

  if (o.relation === "unit-conversion") {
    if (!o.unitSystem || typeof o.unitSystem !== "object") {
      throw new TreeSchemaError(
        "missing-unit-system",
        "unit-conversion requires unitSystem: { from, to }.",
        `${path}.unitSystem`,
      );
    }
    const us = o.unitSystem as Record<string, unknown>;
    if (typeof us.from !== "string" || typeof us.to !== "string") {
      throw new TreeSchemaError(
        "invalid-unit-system",
        "unitSystem requires string from and to fields.",
        `${path}.unitSystem`,
      );
    }
    if (typeof o.derivationChainId !== "string" || !o.derivationChainId.trim()) {
      throw new TreeSchemaError(
        "missing-derivation-chain-id",
        "unit-conversion requires derivationChainId.",
        `${path}.derivationChainId`,
      );
    }
  }

  if (o.relation === "modernization") {
    if (typeof o.modernLensId !== "string" || !o.modernLensId.trim()) {
      throw new TreeSchemaError(
        "missing-modern-lens-id",
        "modernization requires modernLensId.",
        `${path}.modernLensId`,
      );
    }
    if (o.historicalStatus !== "later-development") {
      throw new TreeSchemaError(
        "invalid-historical-status",
        "modernization requires historicalStatus: 'later-development'.",
        `${path}.historicalStatus`,
      );
    }
  }

  return {
    id: o.id,
    relation: o.relation,
    label: o.label,
    tree,
    unitSystem: o.unitSystem as { from: string; to: string } | undefined,
    derivationChainId: typeof o.derivationChainId === "string" ? o.derivationChainId : undefined,
    modernLensId: typeof o.modernLensId === "string" ? o.modernLensId : undefined,
    historicalStatus: o.historicalStatus as "later-development" | undefined,
  };
}

export function validateEquationTree(raw: unknown, path = "EquationTree"): EquationTree {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new TreeSchemaError(
      "invalid-tree-record",
      "Equation tree record must be an object.",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  if (o.treeSchemaVersion !== TREE_SCHEMA_VERSION) {
    throw new TreeSchemaError(
      "unsupported-schema-version",
      `Expected treeSchemaVersion ${TREE_SCHEMA_VERSION}, got ${String(o.treeSchemaVersion)}.`,
      `${path}.treeSchemaVersion`,
    );
  }

  if (!o.root) {
    throw new TreeSchemaError("missing-root", "root expression is required.", `${path}.root`);
  }
  const root = validateExpressionNode(o.root, `${path}.root`);

  const layout =
    o.layout !== undefined ? validateLayoutHints(o.layout, `${path}.layout`) : undefined;

  let groups: CompositeGroup[] | undefined;
  if (Array.isArray(o.groups)) {
    groups = o.groups.map((g, i) => validateCompositeGroup(g, `${path}.groups[${i}]`));
  }

  let alternateForms: AlternateForm[] | undefined;
  if (Array.isArray(o.alternateForms)) {
    alternateForms = o.alternateForms.map((af, i) =>
      validateAlternateForm(af, `${path}.alternateForms[${i}]`),
    );
  }

  return {
    treeSchemaVersion: TREE_SCHEMA_VERSION,
    root,
    layout,
    groups,
    alternateForms,
  };
}
