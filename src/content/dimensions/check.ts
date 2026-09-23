/**
 * Exact rational-exponent dimension checking and semantic-kind validation tree walker.
 *
 * Implements operation rules, unit-system contexts, non-constant exponent checks,
 * state-dependent quantity handling, and semantic-kind distinctions.
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md (§4.7, §8.1, §11.2, §11.5, §17.3, §17.7).
 * Epic: am-ep-content-model-9e3
 * Bead: am-cm-dimension-validator-aoz
 */

import {
  combine,
  DIMENSIONLESS,
  type Dimension,
  type DimensionSlotMismatch,
  dimension,
  dimensionMismatches,
  formatDimensionMismatch,
  isDimensionless,
  parseRational,
  power,
  rational,
  sameDimension,
} from "./rational.ts";
import {
  type QuantityDescriptor,
  resolveQuantityDimension,
  type UnitSystemContext,
} from "./unitSystems.ts";

export type DimensionCheckStatus =
  | "consistent"
  | "inconsistent"
  | "semantic-mismatch"
  | "unsupported-check";

export type DimensionCheckResult =
  | {
      readonly status: "consistent";
      readonly dimension: Dimension;
    }
  | {
      readonly status: "inconsistent";
      readonly nodeId: string | null;
      readonly reason: string;
      readonly lhsDimension: Dimension;
      readonly rhsDimension: Dimension;
      readonly offendingBases: readonly DimensionSlotMismatch[];
      readonly subexpression: string;
    }
  | {
      readonly status: "semantic-mismatch";
      readonly nodeId: string | null;
      readonly reason: string;
      readonly kinds: readonly [string, string];
      readonly subexpression: string;
    }
  | {
      readonly status: "unsupported-check";
      readonly nodeId: string | null;
      readonly reason: string;
    };

export type QuantityRegistryMap = Record<string, QuantityDescriptor>;

export interface DimensionCheckOptions {
  readonly context?: UnitSystemContext;
  readonly maxDepth?: number;
}

/**
 * Incompatible semantic kind pairings that fail validation unless an explicit conversion is declared.
 */
const INCOMPATIBLE_SEMANTIC_KINDS: ReadonlyArray<readonly [string, string]> = [
  ["cyclic-frequency", "angular-frequency"],
  ["spectral-density-frequency", "spectral-density-wavelength"],
  ["spectral-density-frequency", "total-density"],
  ["spectral-density-wavelength", "total-density"],
  ["coordinate-time", "proper-time"],
  ["laboratory-force", "comoving-force"],
  ["mean-square", "variance"],
  ["measured-position", "latent-position"],
  ["angle", "count"],
  ["angle", "probability"],
];

/**
 * Cancelled-units (`ratio`, e.g. V/V0) versus intrinsically dimensionless
 * quantities. They share the all-zero exponent vector; the distinction lives
 * on `dimensionlessKind`, not on a seventh basis slot, because AGENTS.md
 * forbids inventing a dimension for distinctions dimensions cannot settle.
 */
const INCOMPATIBLE_DIMENSIONLESS_KINDS: ReadonlyArray<readonly [string, string]> = [
  ["angle", "count"],
  ["angle", "probability"],
  ["angle", "ratio"],
  ["angle", "pure-number"],
  ["ratio", "count"],
  ["ratio", "probability"],
  ["ratio", "pure-number"],
];

function pairListed(
  pairs: ReadonlyArray<readonly [string, string]>,
  a: string,
  b: string,
): boolean {
  for (const [k1, k2] of pairs) {
    if ((a === k1 && b === k2) || (a === k2 && b === k1)) {
      return true;
    }
  }
  return false;
}

function areSemanticKindsIncompatible(a: string, b: string): boolean {
  if (a === b) return false;
  if (pairListed(INCOMPATIBLE_SEMANTIC_KINDS, a, b)) return true;
  // Flattened kinds on bound terms (the Brownian teaching slice) still refuse
  // any two different authored meanings; listed pairs above are the corpus
  // obligations. Conversion nodes skip this check.
  return a !== b;
}

function areDimensionlessKindsIncompatible(a: string, b: string): boolean {
  if (a === b) return false;
  return pairListed(INCOMPATIBLE_DIMENSIONLESS_KINDS, a, b);
}

/**
 * Checks dimensions and semantic kinds of an expression tree against a quantity registry.
 */
export function checkDimensions(
  root: unknown,
  registry: QuantityRegistryMap,
  options: DimensionCheckOptions = {},
): DimensionCheckResult {
  const context = options.context ?? "si";
  const maxDepth = options.maxDepth ?? 32;

  function extractNodeId(n: unknown): string | null {
    if (!n || typeof n !== "object") return null;
    const o = n as Record<string, unknown>;
    for (const key of ["termId", "opId", "id", "nodeId"] as const) {
      const v = o[key];
      if (typeof v === "string") return v;
    }
    return null;
  }

  function describeSubexpression(n: unknown): string {
    const id = extractNodeId(n);
    if (id) return id;
    if (!n || typeof n !== "object") return "unknown";
    const o = n as Record<string, unknown>;
    if (o.kind === "symbol" && typeof o.quantityId === "string") return o.quantityId;
    if (typeof o.kind === "string") return o.kind;
    return "unknown";
  }

  const stop = (
    n: unknown,
    status: Exclude<DimensionCheckStatus, "consistent">,
    reason: string,
    extra?: Record<string, unknown>,
  ): never => {
    throw {
      status,
      nodeId: extractNodeId(n),
      reason,
      ...extra,
    };
  };

  function refusePair(n: unknown, da: Dimension, db: Dimension, subexpression: string): never {
    const offendingBases = dimensionMismatches(da, db);
    return stop(n, "inconsistent", formatDimensionMismatch(offendingBases, da, db), {
      lhsDimension: da,
      rhsDimension: db,
      offendingBases,
      subexpression,
    });
  }

  function extractSemanticKind(n: unknown): string | null {
    if (!n || typeof n !== "object") return null;
    const o = n as Record<string, unknown>;
    if (o.kind === "conversion" && typeof o.to === "string") {
      return o.to;
    }
    if (o.kind === "symbol" && typeof o.quantityId === "string") {
      return registry[o.quantityId]?.semanticKind ?? null;
    }
    if (o.kind === "group" || o.kind === "negate" || o.kind === "average") {
      return extractSemanticKind(o.argument);
    }
    if (typeof o.semanticKind === "string") {
      return o.semanticKind;
    }
    return null;
  }

  function extractDimensionlessKind(n: unknown): string | null {
    if (!n || typeof n !== "object") return null;
    const o = n as Record<string, unknown>;
    if (o.kind === "conversion" && typeof o.to === "string") {
      return o.to;
    }
    if (o.kind === "symbol" && typeof o.quantityId === "string") {
      return registry[o.quantityId]?.dimensionlessKind ?? null;
    }
    if (o.kind === "group" || o.kind === "negate" || o.kind === "average") {
      return extractDimensionlessKind(o.argument);
    }
    if (typeof o.dimensionlessKind === "string") {
      return o.dimensionlessKind;
    }
    return null;
  }

  function equal(n: unknown, a: unknown, b: unknown): Dimension {
    const da = visit(a, 0);
    const db = visit(b, 0);
    if (!sameDimension(da, db)) {
      refusePair(n, da, db, describeSubexpression(n));
    }
    const dla = extractDimensionlessKind(a);
    const dlb = extractDimensionlessKind(b);
    if (dla && dlb && areDimensionlessKindsIncompatible(dla, dlb)) {
      stop(
        n,
        "semantic-mismatch",
        `Directly related quantities have incompatible dimensionless kinds: '${dla}' and '${dlb}'. An explicit conversion is required.`,
        { kinds: [dla, dlb], subexpression: describeSubexpression(n) },
      );
    }
    const ka = extractSemanticKind(a);
    const kb = extractSemanticKind(b);
    if (ka && kb && areSemanticKindsIncompatible(ka, kb)) {
      stop(
        n,
        "semantic-mismatch",
        `Directly related quantities have incompatible meanings: '${ka}' and '${kb}'. An explicit conversion is required.`,
        { kinds: [ka, kb], subexpression: describeSubexpression(n) },
      );
    }
    return da;
  }

  function visit(n: unknown, depth: number): Dimension {
    if (depth > maxDepth) {
      return stop(n, "unsupported-check", "Expression exceeded the dimensional walk budget.");
    }
    if (!n || typeof n !== "object") {
      return stop(n, "unsupported-check", "Invalid AST node.");
    }
    const node = n as Record<string, unknown> & { kind?: string };

    switch (node.kind) {
      case "symbol": {
        if (typeof node.quantityId !== "string" || node.quantityId.length === 0) {
          return stop(
            n,
            "unsupported-check",
            "Symbol is bound by registered quantity id, never by a printed glyph.",
          );
        }
        const q = registry[node.quantityId];
        if (!q) {
          return stop(n, "unsupported-check", `Unknown quantity '${node.quantityId}'.`);
        }
        const res = resolveQuantityDimension(q, context);
        if (!res.ok) {
          return stop(n, res.status, res.reason);
        }
        // gamma(u), u(t): the value of the quantity at an argument has the quantity's own
        // dimension. The argument is still checked, so an inconsistent one is not waved through.
        if (node.at) visit(node.at, depth + 1);
        // An exact `scale` (paper 2's κ at 1/2) is a numeric factor. It never
        // changes a dimension; exactness of the number lives on the constant set.
        return res.dimension;
      }

      case "number":
      case "constant":
        return DIMENSIONLESS;

      case "conversion": {
        return visit(node.argument, depth + 1);
      }

      case "sum": {
        if (!Array.isArray(node.args) || node.args.length === 0 || !node.args[0]) {
          return stop(n, "unsupported-check", "Sum requires at least one argument.");
        }
        const first = node.args[0];
        for (const arg of node.args.slice(1)) {
          equal(n, first, arg);
        }
        return visit(first, depth + 1);
      }

      case "product": {
        if (!Array.isArray(node.args)) {
          return stop(n, "unsupported-check", "Product args must be an array.");
        }
        let acc: Dimension = DIMENSIONLESS;
        for (const arg of node.args) {
          acc = combine(acc, visit(arg, depth + 1));
        }
        return acc;
      }

      case "quotient": {
        return combine(visit(node.numerator, depth + 1), visit(node.denominator, depth + 1), -1);
      }

      // A symbolic exponent (W = f^n) takes the expression-exponent path below: the exponent
      // and the base must both be dimensionless.
      case "symbolPower":
      case "power": {
        const baseDim = visit(node.base, depth + 1);
        const exponent = node.exponent;

        if (
          exponent &&
          typeof exponent === "object" &&
          !Array.isArray(exponent) &&
          "num" in exponent &&
          "den" in exponent &&
          !("kind" in exponent)
        ) {
          const expObj = exponent as {
            num: string | number | bigint;
            den: string | number | bigint;
          };
          const expRat = rational(BigInt(expObj.num), BigInt(expObj.den));
          return power(baseDim, expRat);
        }

        if (
          exponent &&
          typeof exponent === "object" &&
          (exponent as { kind?: string }).kind === "number"
        ) {
          const expVal = parseRational(String((exponent as { value?: unknown }).value));
          return power(baseDim, expVal);
        }

        const expDim = visit(exponent, depth + 1);
        if (!isDimensionless(expDim)) {
          return refusePair(
            n,
            expDim,
            DIMENSIONLESS,
            `power exponent (${describeSubexpression(exponent)})`,
          );
        }

        if (!isDimensionless(baseDim)) {
          return refusePair(
            n,
            baseDim,
            DIMENSIONLESS,
            `non-constant power base (${describeSubexpression(node.base)})`,
          );
        }

        return DIMENSIONLESS;
      }

      case "root": {
        const degree = BigInt((node.degree as string | number | bigint | undefined) ?? 2);
        if (degree === 0n) {
          return stop(n, "unsupported-check", "Root degree cannot be zero.");
        }
        return power(visit(node.radicand, depth + 1), rational(1n, degree));
      }

      case "negate":
      case "average":
      case "group": {
        return visit(node.argument, depth + 1);
      }

      case "function": {
        const argDim = visit(node.argument, depth + 1);
        if (!isDimensionless(argDim)) {
          const name = typeof node.name === "string" ? node.name : "fn";
          return refusePair(
            n,
            argDim,
            DIMENSIONLESS,
            `function '${name}' argument (${describeSubexpression(node.argument)})`,
          );
        }
        return DIMENSIONLESS;
      }

      case "relation": {
        return equal(n, node.left, node.right);
      }

      case "derivative": {
        const exprDim = visit(node.expression, depth + 1);
        const varDim = visit(node.variable, depth + 1);
        const order = BigInt((node.order as string | number | bigint | undefined) ?? 1);
        return combine(exprDim, power(varDim, rational(order)), -1);
      }

      case "integral": {
        const exprDim = visit(node.expression, depth + 1);
        const varDim = visit(node.variable, depth + 1);
        // A limit is a value of the variable, so it carries the variable's dimension and kind.
        // Zero and infinity are the exceptions: 0 s and 0 m are both written 0, and an unbounded
        // limit (plus or minus infinity) has no size to carry a dimension.
        for (const bound of [node.lower, node.upper]) {
          if (bound === undefined) continue;
          const b = bound as Record<string, unknown>;
          if (b.kind === "number" && Number(b.value) === 0) continue;
          const unsigned =
            b.kind === "negate" ? ((b.argument ?? {}) as Record<string, unknown>) : b;
          if (unsigned.kind === "constant" && unsigned.name === "infinity") continue;
          equal(n, node.variable, bound);
        }
        return combine(exprDim, varDim);
      }

      case "partialOperator": {
        // The partial derivative with respect to a variable, standing alone, has the inverse
        // of the variable's dimension: an operator identity balances these, per metre or per
        // second.
        const varDim = visit(node.variable, depth + 1);
        return combine(DIMENSIONLESS, varDim, -1);
      }

      case "matrix": {
        if (node.targetDimensions && Array.isArray(node.targetDimensions)) {
          return dimension(
            node.targetDimensions as readonly (string | { num: bigint; den: bigint })[],
          );
        }
        return stop(
          n,
          "unsupported-check",
          "Heterogeneous matrix without declared target vector dimensions.",
        );
      }

      default: {
        return stop(
          n,
          "unsupported-check",
          `Expression kind '${String(node.kind)}' has no dimensional rule.`,
        );
      }
    }
  }

  try {
    const dim = visit(root, 0);
    return { status: "consistent", dimension: dim };
  } catch (err) {
    if (err && typeof err === "object" && "status" in err) {
      return err as DimensionCheckResult;
    }
    return {
      status: "unsupported-check",
      nodeId: extractNodeId(root),
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
