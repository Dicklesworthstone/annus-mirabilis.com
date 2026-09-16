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
  dimension,
  dimensionText,
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
      readonly lhsDimension?: Dimension;
      readonly rhsDimension?: Dimension;
      readonly subexpression?: string;
    }
  | {
      readonly status: "semantic-mismatch";
      readonly nodeId: string | null;
      readonly reason: string;
      readonly kinds: readonly [string, string];
      readonly subexpression?: string;
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

function areSemanticKindsIncompatible(a: string, b: string): boolean {
  if (a === b) return false;
  for (const [k1, k2] of INCOMPATIBLE_SEMANTIC_KINDS) {
    if ((a === k1 && b === k2) || (a === k2 && b === k1)) {
      return true;
    }
  }
  return a !== b;
}

/**
 * Checks dimensions and semantic kinds of an expression tree against a quantity registry.
 */
export function checkDimensions(
  root: any,
  registry: QuantityRegistryMap,
  options: DimensionCheckOptions = {},
): DimensionCheckResult {
  const context = options.context ?? "si";

  function extractNodeId(n: any): string | null {
    if (!n || typeof n !== "object") return null;
    return n.termId ?? n.opId ?? n.id ?? n.nodeId ?? null;
  }

  const stop = (
    n: any,
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

  function extractSemanticKind(n: any): string | null {
    if (!n || typeof n !== "object") return null;
    if (n.kind === "symbol") {
      const q = registry[n.quantityId];
      return q?.semanticKind ?? null;
    }
    if (n.kind === "group" || n.kind === "negate" || n.kind === "average") {
      return extractSemanticKind(n.argument);
    }
    if (n.semanticKind) {
      return n.semanticKind;
    }
    return null;
  }

  function equal(n: any, a: any, b: any): Dimension {
    const da = visit(a);
    const db = visit(b);
    if (!sameDimension(da, db)) {
      stop(
        n,
        "inconsistent",
        `Different dimensions: [${dimensionText(da)}] and [${dimensionText(db)}].`,
        { lhsDimension: da, rhsDimension: db },
      );
    }
    const ka = extractSemanticKind(a);
    const kb = extractSemanticKind(b);
    if (ka && kb && areSemanticKindsIncompatible(ka, kb)) {
      stop(
        n,
        "semantic-mismatch",
        `Directly related quantities have incompatible meanings: '${ka}' and '${kb}'. An explicit conversion is required.`,
        { kinds: [ka, kb] },
      );
    }
    return da;
  }

  function visit(n: any): Dimension {
    if (!n || typeof n !== "object") {
      return stop(n, "unsupported-check", "Invalid AST node.");
    }

    switch (n.kind) {
      case "symbol": {
        const q = registry[n.quantityId];
        if (!q) {
          return stop(n, "unsupported-check", `Unknown quantity '${n.quantityId}'.`);
        }
        const res = resolveQuantityDimension(q, context);
        if (!res.ok) {
          return stop(n, res.status, res.reason);
        }
        return res.dimension;
      }

      case "number":
      case "constant":
        return DIMENSIONLESS;

      case "sum": {
        if (!Array.isArray(n.args) || n.args.length === 0) {
          return stop(n, "unsupported-check", "Sum requires at least one argument.");
        }
        const first = n.args[0]!;
        for (const arg of n.args.slice(1)) {
          equal(n, first, arg);
        }
        return visit(first);
      }

      case "product": {
        if (!Array.isArray(n.args)) {
          return stop(n, "unsupported-check", "Product args must be an array.");
        }
        let acc: Dimension = DIMENSIONLESS;
        for (const arg of n.args) {
          acc = combine(acc, visit(arg));
        }
        return acc;
      }

      case "quotient": {
        return combine(visit(n.numerator), visit(n.denominator), -1);
      }

      case "power": {
        const baseDim = visit(n.base);

        // Constant rational exponent
        if (
          n.exponent &&
          typeof n.exponent === "object" &&
          "num" in n.exponent &&
          "den" in n.exponent
        ) {
          const expRat = rational(BigInt(n.exponent.num), BigInt(n.exponent.den));
          return power(baseDim, expRat);
        }

        // Exponent as a numeric literal node
        if (n.exponent && typeof n.exponent === "object" && n.exponent.kind === "number") {
          const expVal = parseRational(String(n.exponent.value));
          return power(baseDim, expVal);
        }

        // Non-constant / symbolic exponent (e.g. n, NE/(R*beta*nu))
        const expDim = visit(n.exponent);
        if (!isDimensionless(expDim)) {
          return stop(
            n,
            "inconsistent",
            `Power exponent must be dimensionless, got [${dimensionText(expDim)}].`,
          );
        }

        // Non-constant power requires dimensionless base
        if (!isDimensionless(baseDim)) {
          return stop(
            n,
            "inconsistent",
            `Non-constant power requires a dimensionless base, got [${dimensionText(baseDim)}].`,
          );
        }

        return DIMENSIONLESS;
      }

      case "root": {
        const degree = BigInt(n.degree ?? 2);
        if (degree === 0n) {
          return stop(n, "unsupported-check", "Root degree cannot be zero.");
        }
        return power(visit(n.radicand), rational(1n, degree));
      }

      case "negate":
      case "average":
      case "group": {
        return visit(n.argument);
      }

      case "function": {
        const argDim = visit(n.argument);
        if (!isDimensionless(argDim)) {
          return stop(
            n,
            "inconsistent",
            `Function '${n.name}' requires a dimensionless argument, got [${dimensionText(argDim)}].`,
          );
        }
        return DIMENSIONLESS;
      }

      case "relation": {
        return equal(n, n.left, n.right);
      }

      case "derivative": {
        const exprDim = visit(n.expression);
        const varDim = visit(n.variable);
        const order = BigInt(n.order ?? 1);
        return combine(exprDim, power(varDim, rational(order)), -1);
      }

      case "integral": {
        const exprDim = visit(n.expression);
        const varDim = visit(n.variable);
        return combine(exprDim, varDim);
      }

      case "matrix": {
        // Heterogeneous matrix acting on vectors
        if (n.targetDimensions && Array.isArray(n.targetDimensions)) {
          // Component by component target vector dimensions
          return dimension(n.targetDimensions);
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
          `Expression kind '${String(n.kind)}' has no dimensional rule.`,
        );
      }
    }
  }

  try {
    const dim = visit(root);
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
