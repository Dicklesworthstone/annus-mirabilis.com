/**
 * Apply a registered mathematical or physical identity with cited premises.
 * Identities include kernel normalization, vanishing odd moments of symmetric kernels,
 * vanishing cross-terms of independent zero-mean variables, cosh/sinh identities, etc.
 */

import type { Expression } from "../../ast.ts";
import { nodeId } from "../../ast.ts";
import { structurallyEqual } from "../treeUtils.ts";
import type { RuleCheckArgs, RuleCheckResult, RuleDefinition } from "./types.ts";

export const REGISTERED_IDENTITY_IDS = [
  "kernel-normalization",
  "odd-moments-symmetric-kernel",
  "independent-zero-mean-product-vanishes",
  "cosh-sinh-identity",
  "linearity-of-average",
  "spatial-isotropy",
  "velocity-addition",
] as const;

export type RegisteredIdentityId = (typeof REGISTERED_IDENTITY_IDS)[number];

export interface RegisteredIdentityParams {
  readonly identityId: RegisteredIdentityId | string;
  readonly citedPremises?: readonly string[];
  readonly premises?: readonly string[];
  readonly vanishingTermIds?: readonly string[];
}

/**
 * Two expressions compared AS MATHEMATICS (am-1lds): presentation-only `group` wrappers are
 * dropped and associative operators are flattened first. `structurallyEqual` is deliberately
 * strict about authored shape, which is right for a tape and wrong for asking whether an identity
 * was applied: the content chain's linearity step wraps its middle term in a `group` so the
 * renderer can colour it, and sr-ped-step-4 writes one product flat and its result nested.
 */
function withoutGroups(e: Expression): Expression {
  const walk = (n: Expression): Expression => {
    if (n.kind === "group") return walk(n.argument);
    switch (n.kind) {
      case "sum":
      case "product": {
        const args = n.args.flatMap((a) => {
          const w = walk(a);
          return w.kind === n.kind ? [...w.args] : [w];
        });
        return { ...n, args };
      }
      case "quotient":
        return { ...n, numerator: walk(n.numerator), denominator: walk(n.denominator) };
      case "power":
        return { ...n, base: walk(n.base) };
      case "negate":
      case "average":
      case "function":
        return { ...n, argument: walk(n.argument) };
      case "relation":
        return { ...n, left: walk(n.left), right: walk(n.right) };
      default:
        return n;
    }
  };
  return walk(e);
}

function sameMath(a: Expression, b: Expression): boolean {
  return structurallyEqual(withoutGroups(a), withoutGroups(b));
}

const isNumber = (e: Expression, value: string): boolean =>
  e.kind === "number" && e.value === value;

/**
 * Drop the factors of 1 and the terms of 0 a substitution leaves behind, so that
 * `f * 1 + df_dx * int_Delta_phi` reduces to the sum the step actually prints.
 */
function simplifyUnits(e: Expression): Expression {
  const walk = (n: Expression): Expression => {
    switch (n.kind) {
      case "product": {
        const args = n.args.map(walk);
        if (args.some((a) => isNumber(a, "0"))) return { kind: "number", value: "0" };
        const kept = args.filter((a) => !isNumber(a, "1"));
        if (kept.length === 0) return { kind: "number", value: "1" };
        return kept.length === 1 ? (kept[0] as Expression) : { ...n, args: kept };
      }
      case "sum": {
        const args = n.args.map(walk).filter((a) => !isNumber(a, "0"));
        if (args.length === 0) return { kind: "number", value: "0" };
        return args.length === 1 ? (args[0] as Expression) : { ...n, args };
      }
      case "quotient":
        return { ...n, numerator: walk(n.numerator), denominator: walk(n.denominator) };
      case "power":
        return { ...n, base: walk(n.base) };
      case "negate":
      case "average":
      case "group":
      case "function":
        return { ...n, argument: walk(n.argument) };
      case "relation":
        return { ...n, left: walk(n.left), right: walk(n.right) };
      default:
        return n;
    }
  };
  return walk(e);
}

/** Walk every symbol of a tree. */
function eachSymbol(e: Expression, visit: (n: Extract<Expression, { kind: "symbol" }>) => void) {
  const walk = (n: Expression): void => {
    if (n.kind === "symbol") visit(n);
    switch (n.kind) {
      case "sum":
      case "product":
        for (const a of n.args) walk(a);
        break;
      case "quotient":
        walk(n.numerator);
        walk(n.denominator);
        break;
      case "power":
        walk(n.base);
        break;
      case "negate":
      case "average":
      case "group":
      case "function":
        walk(n.argument);
        break;
      case "relation":
        walk(n.left);
        walk(n.right);
        break;
      default:
        break;
    }
  };
  walk(e);
}

function symbolIds(e: Expression): Set<string> {
  const out = new Set<string>();
  eachSymbol(e, (n) => out.add(n.termId));
  return out;
}

/** The first symbol node with this termId, so a replacement carries the bindings it was authored with. */
function findSymbol(e: Expression, termId: string): Expression | undefined {
  let found: Expression | undefined;
  eachSymbol(e, (n) => {
    if (!found && n.termId === termId) found = n;
  });
  return found;
}

/** Replace every symbol with this termId by `value`. */
function replaceSymbol(e: Expression, termId: string, value: Expression): Expression {
  const walk = (n: Expression): Expression => {
    if (n.kind === "symbol") return n.termId === termId ? value : n;
    switch (n.kind) {
      case "sum":
      case "product":
        return { ...n, args: n.args.map(walk) };
      case "quotient":
        return { ...n, numerator: walk(n.numerator), denominator: walk(n.denominator) };
      case "power":
        return { ...n, base: walk(n.base) };
      case "negate":
      case "average":
      case "group":
      case "function":
        return { ...n, argument: walk(n.argument) };
      case "relation":
        return { ...n, left: walk(n.left), right: walk(n.right) };
      default:
        return n;
    }
  };
  return walk(e);
}

/**
 * "One declared quantity took a known value and nothing else moved": the symbol the step DECLARED
 * it changed disappears from the result, and putting `value` in its place in the step's input
 * reproduces that result exactly.
 *
 * Reading the declaration is what makes this a check rather than a hand-wave. Without it, zeroing
 * whichever symbol happens to disappear accepts a step that dropped an unrelated term, which is
 * planted in registeredIdentity.test.ts.
 */
function vanishingSubstitutionHolds(
  from: Expression,
  to: Expression,
  value: Expression,
  declared: readonly string[],
): { ok: boolean; vanished: readonly string[]; used?: string } {
  const after = symbolIds(to);
  const vanished = [...symbolIds(from)].filter((id) => !after.has(id));
  for (const id of vanished.filter((v) => declared.includes(v))) {
    if (sameMath(simplifyUnits(replaceSymbol(from, id, value)), to)) {
      return { ok: true, vanished, used: id };
    }
  }
  return { ok: false, vanished };
}

function check({ from, to, params, changed }: RuleCheckArgs): RuleCheckResult {
  const p = params as unknown as RegisteredIdentityParams;
  if (!p?.identityId || typeof p.identityId !== "string" || !p.identityId.trim()) {
    return { outcome: "fail", reason: "registered-identity requires a valid identityId." };
  }

  if (!REGISTERED_IDENTITY_IDS.includes(p.identityId as RegisteredIdentityId)) {
    return {
      outcome: "fail",
      reason: `Unregistered identity id "${p.identityId}". Registered identities are: ${REGISTERED_IDENTITY_IDS.join(", ")}.`,
    };
  }

  const premises = p.premises ?? p.citedPremises;
  if (
    p.identityId === "independent-zero-mean-product-vanishes" &&
    (!premises ||
      premises.length === 0 ||
      !premises.some((pr) => pr.toLowerCase().includes("independen")) ||
      !premises.some(
        (pr) =>
          pr.toLowerCase().includes("zero-mean") ||
          pr.toLowerCase().includes("zero_mean") ||
          pr.toLowerCase().includes("zeromean"),
      ))
  ) {
    if (from.kind === "sum" && to.kind !== "number") {
      if (
        !p.vanishingTermIds ||
        !Array.isArray(p.vanishingTermIds) ||
        p.vanishingTermIds.length === 0
      ) {
        return {
          outcome: "fail",
          reason:
            "independent-zero-mean-product-vanishes requires vanishing term ids (vanishingTermIds) when eliminating cross terms from a sum.",
        };
      }
    }
    return {
      outcome: "fail",
      reason:
        "independent-zero-mean-product-vanishes requires cited independence and zero-mean premises.",
    };
  }

  if (premises !== undefined && Array.isArray(premises) && premises.length === 0) {
    return {
      outcome: "fail",
      reason: `Registered identity "${p.identityId}" requires at least one cited premise.`,
    };
  }

  switch (p.identityId) {
    case "independent-zero-mean-product-vanishes": {
      // If eliminating terms from a sum, vanishingTermIds is strictly required
      if (from.kind === "sum" && to.kind !== "number") {
        if (
          !p.vanishingTermIds ||
          !Array.isArray(p.vanishingTermIds) ||
          p.vanishingTermIds.length === 0
        ) {
          return {
            outcome: "fail",
            reason:
              "independent-zero-mean-product-vanishes requires vanishing term ids (vanishingTermIds) when eliminating cross terms from a sum.",
          };
        }
      }

      // Check cited premises: must have both independence and zero-mean premises
      if (premises !== undefined) {
        const hasIndep = premises.some((pr) => pr.toLowerCase().includes("independen"));
        const hasZeroMean = premises.some(
          (pr) =>
            pr.toLowerCase().includes("zero-mean") ||
            pr.toLowerCase().includes("zero_mean") ||
            pr.toLowerCase().includes("zeromean"),
        );
        if (!hasIndep || !hasZeroMean) {
          return {
            outcome: "fail",
            reason:
              "independent-zero-mean-product-vanishes requires cited independence and zero-mean premises.",
          };
        }
      }

      if (
        p.vanishingTermIds &&
        Array.isArray(p.vanishingTermIds) &&
        p.vanishingTermIds.length > 0
      ) {
        if (from.kind !== "sum") {
          return {
            outcome: "fail",
            reason: "vanishingTermIds can only be applied to a sum expression.",
          };
        }

        const vanishingSet = new Set(p.vanishingTermIds);
        // Verify all vanishingTermIds exist in from.args
        for (const vId of vanishingSet) {
          const exists = from.args.some((arg) => nodeId(arg) === vId);
          if (!exists) {
            return {
              outcome: "fail",
              reason: `vanishing term id "${vId}" not found in source sum.`,
            };
          }
        }

        const surviving = from.args.filter((arg) => {
          const id = nodeId(arg);
          return !id || !vanishingSet.has(id);
        });

        /*
          A VANISHING TERM MAY BE ZEROED IN PLACE, NOT ONLY REMOVED (am-s1xa).

          This rule required the destination sum to hold exactly the surviving terms, so a step
          that writes the cross term as an explicit zero failed with "destination sum must contain
          exactly the non-vanishing terms". That is the authored form of the project's one content
          chain: content/equations/derivations/bm-variance.yaml keeps `group(0, opId crossTerm)`
          in the sum so a reader SEES the cross term go to zero rather than finding it gone
          between two lines, and the renderer colours it by that opId. Measured before the change:
          chain-bm-variance-of-sum verified 3 of its 4 steps and failed this one, so the chain was
          not publication-ready and the result card's support layer could not be built on it.

          The claim is identical either way -- the declared term is zero -- so accepting it costs
          nothing, and the check stays exactly as strict in the two directions that matter. The
          same-arity branch requires, position by position, that a declared term be mathematically
          zero AND keep its own id, and that every term NOT declared to vanish be structurally
          unchanged. So zeroing an undeclared term, zeroing the declared one while also altering a
          neighbour, or replacing the declared term with anything that is not zero all still fail,
          and each is planted in registeredIdentity.test.ts. The existing case where the term is
          left untouched also still fails, because an unchanged term is not zero.
        */
        const isZero = (node: Expression): boolean => {
          const bare = withoutGroups(node);
          return bare.kind === "number" && Number.parseFloat(String(bare.value)) === 0;
        };
        if (to.kind === "sum" && to.args.length === from.args.length) {
          for (let i = 0; i < from.args.length; i++) {
            const before = from.args[i];
            const after = to.args[i];
            if (!before || !after) {
              return { outcome: "fail", reason: "the sums could not be compared term by term." };
            }
            const id = nodeId(before);
            if (id !== null && vanishingSet.has(id)) {
              if (nodeId(after) !== id) {
                return {
                  outcome: "fail",
                  reason: `independent-zero-mean-product-vanishes: the vanishing term "${id}" must keep its own id where it is zeroed in place, so a reader and this check are looking at the same term.`,
                };
              }
              if (!isZero(after)) {
                return {
                  outcome: "fail",
                  reason: `independent-zero-mean-product-vanishes: the declared vanishing term "${id}" is not zero in the destination.`,
                };
              }
            } else if (!structurallyEqual(after, before)) {
              return {
                outcome: "fail",
                reason: `independent-zero-mean-product-vanishes: term ${i + 1}${id === null ? "" : ` ("${id}")`} was not declared to vanish and changed.`,
              };
            }
          }
          return { outcome: "pass" };
        }

        // Ensure exactly the surviving terms appear in destination
        if (to.kind === "sum") {
          if (to.args.length !== surviving.length) {
            return {
              outcome: "fail",
              reason:
                "independent-zero-mean-product-vanishes destination sum must contain exactly the non-vanishing terms.",
            };
          }
          const allMatch = to.args.every((tArg, idx) => {
            const sArg = surviving[idx];
            return sArg !== undefined && structurallyEqual(tArg, sArg);
          });
          if (!allMatch) {
            return {
              outcome: "fail",
              reason:
                "independent-zero-mean-product-vanishes destination terms do not match the expected surviving terms.",
            };
          }
          return { outcome: "pass" };
        }
        if (surviving.length === 1) {
          const sole = surviving[0];
          if (sole && structurallyEqual(to, sole)) {
            return { outcome: "pass" };
          }
          return {
            outcome: "fail",
            reason:
              "independent-zero-mean-product-vanishes destination expression does not match the single surviving term.",
          };
        }
        if (surviving.length === 0) {
          if (to.kind === "number" && to.value === "0") {
            return { outcome: "pass" };
          }
          return {
            outcome: "fail",
            reason:
              "independent-zero-mean-product-vanishes all terms vanish, expected destination 0.",
          };
        }
        return {
          outcome: "fail",
          reason:
            "independent-zero-mean-product-vanishes destination must be a sum containing surviving terms.",
        };
      }

      if (to.kind === "number" && to.value === "0") {
        return { outcome: "pass" };
      }

      // The identity applied to ONE SIDE of an equation (am-1lds). bm-ped-step-3 takes
      // <x2> = <x_sum x_sum> to <x2> = n <Delta2>: the n-step generalisation of a mean square,
      // which no substitution of a symbol by a constant reproduces, so this check is weaker than
      // the other three in this file and is written to say so.
      //
      // What it establishes: the other side of the equation is untouched, the subexpression the
      // step DECLARED is what left the rewritten side, and that side really changed. What it does
      // not establish is that the rewrite is this identity's own, which would need the n-step
      // expansion. The residue is asserted in registeredIdentity.test.ts rather than implied away.
      if (from.kind === "relation" && to.kind === "relation" && from.operator === to.operator) {
        const otherSideHeld = sameMath(from.left, to.left);
        const rewrittenSideChanged = !sameMath(from.right, to.right);
        const declared = changed ?? [];
        const leftTheRewrittenSide = declared.some(
          (id) => symbolIds(from.right).has(id) && !symbolIds(to.right).has(id),
        );
        if (otherSideHeld && rewrittenSideChanged && leftTheRewrittenSide) {
          return { outcome: "pass" };
        }
        return {
          outcome: "unverifiable",
          reason:
            `independent-zero-mean-product-vanishes on one side of an equation is checked by three things: ` +
            `the other side unchanged (${otherSideHeld}), the rewritten side changed (${rewrittenSideChanged}), ` +
            `and the declared subexpression gone from it (${leftTheRewrittenSide}). The step declares ${declared.join(", ") || "nothing"}.`,
        };
      }

      return {
        outcome: "unverifiable",
        reason:
          "independent-zero-mean-product-vanishes is checked for a sum whose vanishing terms are named, for a destination of zero, and for a rewrite of one side of an equation; this step is none of them.",
      };
    }

    case "linearity-of-average": {
      // FORM ONE, the identity itself: the average of a sum is the sum of the averages, term by
      // term. Compared through `sameMath` so a term wrapped in a `group` for colouring still
      // matches, which is why the content chain's own step used to fall through to `pass`.
      if (from.kind === "average" && from.argument.kind === "sum") {
        const summands = from.argument.args;
        const target = withoutGroups(to);
        if (target.kind === "sum" && target.args.length === summands.length) {
          const matches = target.args.every((toArg, idx) => {
            const summand = summands[idx];
            if (!summand) return false;
            return sameMath(toArg, { kind: "average", argument: summand });
          });
          if (matches) return { outcome: "pass" };
        }
      }
      // FORM TWO, the step that takes the average of BOTH SIDES of a relation, which is how
      // bm-ped-step-2 uses this identity. Averaging an equality is licensed by the same linearity.
      if (from.kind === "relation" && to.kind === "relation" && to.operator === from.operator) {
        const left = sameMath(to.left, { kind: "average", argument: from.left });
        const right = sameMath(to.right, { kind: "average", argument: from.right });
        if (left && right) return { outcome: "pass" };
      }
      return {
        outcome: "unverifiable",
        reason:
          "linearity-of-average is checked in two forms, the average of a sum against the sum of the averages term by term, and the average taken of both sides of a relation; this step is neither.",
      };
    }

    case "kernel-normalization": {
      // Direct normalization: \int \phi d\Delta = 1 or int_phi = 1
      if (from.kind === "symbol" && (from.termId === "int_phi" || from.quantityId === "int_phi")) {
        if (to.kind === "number" && to.value === "1") {
          return { outcome: "pass" };
        }
      }
      if (from.kind === "integral" && to.kind === "number" && to.value === "1") {
        return { outcome: "pass" };
      }
      // The normalisation used INSIDE a larger expression (am-1lds). The identity says one
      // integral is 1, so the step must be its input with that one declared symbol set to 1 and
      // nothing else touched: on bm-src-step-3, f * int_phi + df_dx * int_Delta_phi becomes
      // f + df_dx * int_Delta_phi. This branch returned `pass` for any sum or relation, so it
      // could not tell that step from one whose result is its own input.
      if (from.kind === "sum" || from.kind === "relation") {
        const unit = vanishingSubstitutionHolds(
          from,
          to,
          { kind: "number", value: "1" },
          changed ?? [],
        );
        if (unit.ok) return { outcome: "pass" };
        return {
          outcome: "unverifiable",
          reason:
            unit.vanished.length > 0
              ? `kernel-normalization: setting the declared symbol to 1 in the step's input does not give its result; the symbols that disappear are ${unit.vanished.join(", ")} and the step declares ${(changed ?? []).join(", ") || "none of them"}.`
              : "kernel-normalization is checked by setting the integral the step DECLARES it changed to 1; this step makes no symbol disappear, so its result is not a normalisation of its input.",
        };
      }
      return {
        outcome: "unverifiable",
        reason:
          "kernel-normalization is checked only for its cited premise today and reports unverifiable.",
      };
    }

    case "odd-moments-symmetric-kernel": {
      // The odd moment of a symmetric kernel is zero (am-1lds), so the step must be its input with
      // that one declared symbol set to 0 and the term it stood in gone: on bm-src-step-4,
      // f + df_dx * int_Delta_phi becomes f. This case returned `pass` unconditionally.
      const zero = vanishingSubstitutionHolds(
        from,
        to,
        { kind: "number", value: "0" },
        changed ?? [],
      );
      if (zero.ok) return { outcome: "pass" };
      return {
        outcome: "unverifiable",
        reason:
          zero.vanished.length > 0
            ? `odd-moments-symmetric-kernel: setting the declared symbol to 0 in the step's input does not give its result; the symbols that disappear are ${zero.vanished.join(", ")} and the step declares ${(changed ?? []).join(", ") || "none of them"}.`
            : "odd-moments-symmetric-kernel is checked by setting the odd moment the step DECLARES it changed to 0; this step makes no symbol disappear.",
      };
    }

    case "spatial-isotropy": {
      // Isotropy says a coefficient cannot depend on the SIGN of the direction, so the step it
      // licenses replaces one declared symbol by its mirror and changes nothing else:
      // sr-ped-step-4 takes a_v * a_minus_v * (1 - v^2/c^2) = 1 to a_v * a_v * (1 - v^2/c^2) = 1.
      // This case returned `pass` unconditionally (am-1lds).
      //
      // The mirror is recognised by the sign marker in the termId, which is a convention and is
      // treated as one: a step that does not follow it reports unverifiable rather than passing.
      const after = symbolIds(to);
      const vanished = [...symbolIds(from)].filter((id) => !after.has(id));
      const unsigned = (id: string) => id.replace(/_?minus_?|_?neg_?/gi, "_").replace(/__+/g, "_");
      for (const gone of vanished.filter((v) => (changed ?? []).includes(v))) {
        for (const kept of after) {
          if (unsigned(gone) !== unsigned(kept)) continue;
          // The REAL node, taken from the step's own result: a symbol synthesised here would carry
          // no quantityId and would fail for a reason that has nothing to do with the identity.
          const replacement = findSymbol(to, kept);
          if (replacement && sameMath(replaceSymbol(from, gone, replacement), to)) {
            return { outcome: "pass" };
          }
        }
      }
      return {
        outcome: "unverifiable",
        reason:
          vanished.length > 0
            ? `spatial-isotropy is checked by replacing the declared symbol with its mirror, the same name without the sign marker; no such replacement gives this step's result. The symbols that disappear are ${vanished.join(", ")}.`
            : "spatial-isotropy is checked by replacing the symbol the step DECLARES it changed with its mirror; this step makes no symbol disappear.",
      };
    }

    case "cosh-sinh-identity":
    case "velocity-addition":
      return { outcome: "pass" };
  }
  return { outcome: "pass" };
}

export const registeredIdentityRule: RuleDefinition = { kind: "registered-identity", check };
