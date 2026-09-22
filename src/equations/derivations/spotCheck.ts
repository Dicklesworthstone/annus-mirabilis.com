/**
 * Numerical spot checks for a derivation step: supporting evidence, never
 * proof ("numerical spot checks help but cannot prove arbitrary symbolic
 * equivalence"). `am-eq-expression-tree-8kl` (this bead's blocker) is
 * specified to eventually provide `sampleAdmissiblePoint` and
 * `evaluateForSpotCheck`; neither exists anywhere in the repo yet (checked
 * before writing this). This module is this bead's own, narrowly-scoped
 * implementation of the same idea — evaluating an authored `Expression`
 * tree at sampled points — so `verifyChain.ts` has something real to call
 * today; it is not a claim to have delivered am-eq-expression-tree-8kl's
 * own deliverable.
 */

import type { ToleranceSpec, ToleranceVerdictKind } from "../../units/tolerance.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import type { Expression } from "../ast.ts";

// ---------------------------------------------------------------------------
// Deterministic seeded sampling (mulberry32), logged as a decimal string
// per the bead's structured-logging requirement.
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface AdmissiblePoint {
  readonly seed: string;
  readonly bindings: Readonly<Record<string, number>>;
}

/**
 * Draws one value per term id, uniformly in `[range.min, range.max]`
 * (default a comfortably nonzero, positive range that avoids the most
 * common domain edges — zero denominators, negative radicands — by
 * construction; a step whose domain is still violated is reported
 * `outside-domain` and redrawn by the caller, never silently accepted).
 */
export function sampleAdmissiblePoint(
  termIds: readonly string[],
  seed: bigint,
  range: { readonly min: number; readonly max: number } = { min: 0.5, max: 5 },
): AdmissiblePoint {
  const rand = mulberry32(Number(seed % 0xffffffffn));
  const bindings: Record<string, number> = {};
  for (const id of termIds) {
    bindings[id] = range.min + rand() * (range.max - range.min);
  }
  return { seed: seed.toString(), bindings: Object.freeze(bindings) };
}

// ---------------------------------------------------------------------------
// Evaluation: arithmetic node kinds only. `relation`, `derivative`, and
// `integral` are not single numeric values; a caller decomposes a relation
// into its two sides and evaluates each, and this bead's fixtures never
// need to numerically evaluate a derivative or an integral node (their
// spot checks sample the algebraic result of applying one, not the
// operator itself).
// ---------------------------------------------------------------------------

export class SpotCheckDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpotCheckDomainError";
  }
}

export function evaluateExpression(
  tree: Expression,
  bindings: Readonly<Record<string, number>>,
): number {
  switch (tree.kind) {
    case "symbol": {
      const value = bindings[tree.termId];
      if (value === undefined)
        throw new SpotCheckDomainError(`no admissible value bound for term "${tree.termId}".`);
      const scale = tree.scale ?? { num: 1, den: 1 };
      return (value * scale.num) / scale.den;
    }
    case "constant":
      return Math.PI;
    case "number":
      return Number(tree.value);
    case "sum":
      return tree.args.reduce((total, arg) => total + evaluateExpression(arg, bindings), 0);
    case "product":
      return tree.args.reduce((total, arg) => total * evaluateExpression(arg, bindings), 1);
    case "quotient": {
      const denominator = evaluateExpression(tree.denominator, bindings);
      if (denominator === 0) throw new SpotCheckDomainError("division by zero.");
      return evaluateExpression(tree.numerator, bindings) / denominator;
    }
    case "power": {
      const base = evaluateExpression(tree.base, bindings);
      const exponent = tree.exponent.num / tree.exponent.den;
      const value = base ** exponent;
      if (!Number.isFinite(value))
        throw new SpotCheckDomainError(`${base} ** ${exponent} is not finite.`);
      return value;
    }
    case "root": {
      const radicand = evaluateExpression(tree.radicand, bindings);
      if (tree.degree % 2 === 0 && radicand < 0) {
        throw new SpotCheckDomainError(
          `degree-${tree.degree} root of a negative radicand (${radicand}).`,
        );
      }
      const magnitude = Math.abs(radicand) ** (1 / tree.degree);
      return radicand < 0 ? -magnitude : magnitude;
    }
    case "negate":
      return -evaluateExpression(tree.argument, bindings);
    case "average":
    case "group":
      return evaluateExpression(tree.argument, bindings);
    case "function": {
      const argument = evaluateExpression(tree.argument, bindings);
      if (tree.name === "exp") return Math.exp(argument);
      if (tree.name === "ln") {
        if (argument <= 0)
          throw new SpotCheckDomainError(`ln of a nonpositive argument (${argument}).`);
        return Math.log(argument);
      }
      if (tree.name === "sin") return Math.sin(argument);
      return Math.cos(argument);
    }
    case "relation":
      throw new SpotCheckDomainError(
        "a relation is not a single numeric value; evaluate its two sides separately.",
      );
    case "derivative":
    case "integral":
    case "partialOperator":
      throw new SpotCheckDomainError(
        `a ${tree.kind} node is not directly evaluable; spot-check its algebraic result instead.`,
      );
  }
}

// ---------------------------------------------------------------------------
// The check itself, with bounded redraw on an outside-domain sample.
// ---------------------------------------------------------------------------

export interface SpotCheckResult {
  readonly ok: boolean;
  readonly kind: ToleranceVerdictKind | "outside-domain";
  readonly seed: string;
  readonly attempts: number;
  readonly diff?: number;
  readonly allowed?: number;
}

const MAX_REDRAWS = 8;

/** Evaluates `left` and `right` at a sampled admissible point and compares them within `tolerance`. */
export function spotCheckEquivalence(
  left: Expression,
  right: Expression,
  termIds: readonly string[],
  seed: bigint,
  tolerance: ToleranceSpec,
): SpotCheckResult {
  for (let attempt = 0; attempt < MAX_REDRAWS; attempt += 1) {
    const point = sampleAdmissiblePoint(termIds, seed + BigInt(attempt));
    try {
      const leftValue = evaluateExpression(left, point.bindings);
      const rightValue = evaluateExpression(right, point.bindings);
      if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) continue;
      const verdict = withinTolerance(leftValue, rightValue, tolerance);
      return {
        ok: verdict.ok,
        kind: verdict.kind,
        seed: point.seed,
        attempts: attempt + 1,
        diff: verdict.diff,
        allowed: verdict.allowed,
      };
    } catch (error) {
      if (error instanceof SpotCheckDomainError) continue;
      throw error;
    }
  }
  return { ok: false, kind: "outside-domain", seed: seed.toString(), attempts: MAX_REDRAWS };
}

/** The default spot-check tolerance: relative 1e-10 with an absolute floor near zero. */
export const DEFAULT_SPOT_CHECK_TOLERANCE: ToleranceSpec = { relative: 1e-10, absolute: 1e-12 };
