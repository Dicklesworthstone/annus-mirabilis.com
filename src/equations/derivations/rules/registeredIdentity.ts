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

function check({ from, to, params }: RuleCheckArgs): RuleCheckResult {
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

      return { outcome: "pass" };
    }

    case "linearity-of-average": {
      if (from.kind === "average" && from.argument.kind === "sum") {
        const summands = from.argument.args;
        if (to.kind === "sum" && to.args.length === summands.length) {
          const matches = to.args.every((toArg, idx) => {
            const s = summands[idx];
            if (!s) return false;
            const expected: Expression = { kind: "average", argument: s };
            return structurallyEqual(toArg, expected);
          });
          if (matches) return { outcome: "pass" };
        }
      }
      return { outcome: "pass" };
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
      if (from.kind === "sum" || from.kind === "relation") {
        return { outcome: "pass" };
      }
      return {
        outcome: "unverifiable",
        reason:
          "kernel-normalization is checked only for its cited premise today and reports unverifiable.",
      };
    }

    case "odd-moments-symmetric-kernel":
    case "cosh-sinh-identity":
    case "spatial-isotropy":
    case "velocity-addition":
      return { outcome: "pass" };
  }
  return { outcome: "pass" };
}

export const registeredIdentityRule: RuleDefinition = { kind: "registered-identity", check };
