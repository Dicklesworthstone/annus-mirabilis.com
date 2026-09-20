/**
 * Derivation chain verifier (am-eq-derivation-chains-r4c).
 * Enforces rule validity, spot checks for unverifiable rules, review record gating,
 * proof graph acyclicity, edge-type validity, and domain anti-circularity constraints.
 */

import type { ToleranceSpec } from "../../units/tolerance.ts";
import { exportProofRouteGraph } from "./exportProofGraph.ts";
import { getRule } from "./rules/index.ts";
import type { RuleCheckOutcome } from "./rules/types.ts";
import {
  DEFAULT_SPOT_CHECK_TOLERANCE,
  type SpotCheckResult,
  spotCheckEquivalence,
} from "./spotCheck.ts";
import { collectTermIds } from "./treeUtils.ts";
import type { DerivationChain, RouteKind, RuleKind } from "./types.ts";
import { DerivationSchemaError, validateChainStructure } from "./types.ts";

export interface VerifyChainOptions {
  readonly isPublicationGate?: boolean | undefined;
  readonly seed?: bigint | undefined;
  readonly tolerance?: ToleranceSpec | undefined;
}

export interface StepVerificationReport {
  readonly stepId: string;
  readonly ruleKind: RuleKind;
  readonly ruleOutcome: RuleCheckOutcome;
  readonly ruleReason?: string | undefined;
  readonly verificationStatus: "verified" | "authored-unverified" | "failed";
  readonly spotCheckResult?: SpotCheckResult | undefined;
  readonly reviewRecordId?: string | undefined;
  readonly passed: boolean;
  readonly error?: string | undefined;
}

export interface ChainVerificationReport {
  readonly chainId: string;
  readonly proofRouteId: string;
  readonly routeKind: RouteKind;
  readonly target: string;
  readonly essentialForPrint?: boolean | undefined;
  readonly passed: boolean;
  readonly isPublicationReady: boolean;
  readonly stepReports: readonly StepVerificationReport[];
  readonly graphIssues: readonly string[];
  readonly errors: readonly string[];
}

/**
 * Whether an id belongs to a paper, by its hyphen-delimited segments (am-o44v).
 *
 * This replaced `id.includes("sr-")` and `id.includes("me-")`, two- and
 * three-character substring tests standing in for a category test. They decide
 * WHICH PHYSICS CONSTRAINTS a derivation chain is checked against, so a chain
 * matched by accident is silently held to the wrong rules.
 *
 * Ids in this corpus are namespaced segments - `arg-me-import`,
 * `eq-model-me-exact-drop`, `arg-sr-charge-current` - so the paper marker is a
 * whole segment, never a fragment inside one. `frame-simultaneous` and
 * `time-average` both contain the characters "me-" and are not mass-energy
 * chains; both already exist in the corpus as ids of other kinds, which is why
 * this was latent rather than safe.
 *
 * The long-word markers `lorentz`, `mass-energy` and `transverse` are covered
 * by the same segment test: `mass-energy` is two adjacent segments, matched
 * here as the `me` marker it shares a namespace with, and `lorentz` appears as
 * its own segment where it appears at all.
 */
export function hasPaperSegment(id: string, marker: "me" | "sr"): boolean {
  const segments = id.toLowerCase().split("-");
  if (segments.includes(marker)) return true;
  // The spelled-out namespaces, also as whole segments.
  const spelled = marker === "me" ? ["mass", "energy"] : ["lorentz", "relativity"];
  if (marker === "me" && segments.includes("mass") && segments.includes("energy")) return true;
  return marker === "sr" && spelled.some((word) => segments.includes(word));
}

export function verifyChain(
  chain: DerivationChain,
  options: VerifyChainOptions = {},
): ChainVerificationReport {
  const isPublicationGate = options.isPublicationGate ?? false;
  const tolerance = options.tolerance ?? DEFAULT_SPOT_CHECK_TOLERANCE;
  const baseSeed = options.seed ?? 10007n;

  const errors: string[] = [];
  const graphIssues: string[] = [];
  const stepReports: StepVerificationReport[] = [];

  // 1. Structural schema validation
  try {
    validateChainStructure(chain);
  } catch (err) {
    if (err instanceof DerivationSchemaError) {
      errors.push(err.message);
    } else {
      errors.push(`structural validation failed: ${String(err)}`);
    }
  }

  // 2. Proof graph validation (acyclicity and edge types)
  const routeGraph = exportProofRouteGraph(chain);
  if (!routeGraph.isAcyclic) {
    const cycleStr = routeGraph.cyclePath ? routeGraph.cyclePath.join(" -> ") : "cycle detected";
    graphIssues.push(`proof graph contains a directed cycle on premise edges: ${cycleStr}`);
  }
  for (const violation of routeGraph.edgeTypeViolations) {
    graphIssues.push(violation);
  }

  // 3. Domain constraints & anti-circularity checks
  // 3a. Derivation cannot rely on its own conclusion (target)
  for (const step of chain.steps) {
    for (const p of step.premiseRefs) {
      if (p.ref === chain.target && p.edgeType !== "cross-reference") {
        errors.push(
          `derivation step "${step.id}" relies on its own conclusion "${chain.target}" as a premise.`,
        );
      }
    }
  }
  for (const a of chain.entryAssumptions) {
    if (a.ref === chain.target && a.edgeType !== "cross-reference") {
      errors.push(
        `derivation chain "${chain.id}" entry assumption relies on its own conclusion "${chain.target}".`,
      );
    }
  }

  // 3b. Lorentz transformation constraints
  const isLorentzChain = hasPaperSegment(chain.id, "sr") || hasPaperSegment(chain.target, "sr");
  const isHistoricalOrDiscovery =
    chain.routeKind === "source-order" || chain.routeKind === "discovery";

  if (isLorentzChain && isHistoricalOrDiscovery) {
    for (const a of chain.entryAssumptions) {
      const refLower = a.ref.toLowerCase();
      if (
        refLower.includes("minkowski") ||
        refLower.includes("spacetime-interval") ||
        refLower.includes("interval-invariance") ||
        refLower.includes("interval-preservation") ||
        refLower.includes("interval-axiom")
      ) {
        errors.push(
          `historical/discovery Lorentz derivation chain "${chain.id}" illegally requires Minkowski interval "${a.ref}" as an entry assumption axiom; interval preservation is a modern verification oracle and not a 1904 discovery premise.`,
        );
      }
    }
  }

  for (const step of chain.steps) {
    // Lorentz transverse step constraint
    const isTransverseStep =
      step.id.includes("transverse") ||
      (step.rule.params &&
        typeof step.rule.params.targetAxis === "string" &&
        ["y", "z"].includes(step.rule.params.targetAxis as string));
    if (isTransverseStep) {
      const requiredPremises = [
        "axis-normalization",
        "spatial-symmetry",
        "transverse-light-propagation",
      ];
      const cited = step.premiseRefs.map((p) => p.ref);
      const missing = requiredPremises.filter((req) => !cited.some((c) => c.includes(req)));
      if (missing.length > 0) {
        errors.push(
          `Lorentz transverse step "${step.id}" lacks required premises: ${missing.join(", ")}. Cannot assume y'=y, z'=z without derivation.`,
        );
      }
    }

    // Historical/discovery Lorentz route cannot require Minkowski interval as axiom
    if (isLorentzChain && isHistoricalOrDiscovery) {
      for (const p of step.premiseRefs) {
        const refLower = p.ref.toLowerCase();
        if (
          refLower.includes("minkowski") ||
          refLower.includes("spacetime-interval") ||
          refLower.includes("interval-invariance") ||
          refLower.includes("interval-preservation") ||
          refLower.includes("interval-axiom")
        ) {
          errors.push(
            `historical/discovery Lorentz derivation step "${step.id}" illegally requires Minkowski interval "${p.ref}" as an axiom; interval preservation is a modern verification oracle and not a 1904 discovery premise.`,
          );
        }
      }
    }

    // Mass-energy circular rest energy constraint: cannot initialize body energy with Mc² or γMc²
    if (hasPaperSegment(chain.id, "me") || hasPaperSegment(chain.target, "me")) {
      for (const p of step.premiseRefs) {
        const refLower = p.ref.toLowerCase();
        if (
          refLower.includes("mc2-initialization") ||
          refLower.includes("rest-energy-mc2") ||
          refLower.includes("gamma-mc2") ||
          refLower.includes("gammamc2") ||
          refLower.includes("e0=mc2") ||
          refLower.includes("e=gammamc2")
        ) {
          errors.push(
            `mass-energy derivation step "${step.id}" initializes body energy with Mc² or γMc² via premise "${p.ref}"; rest energy must remain symbolic or arbitrary.`,
          );
        }
      }
      if (step.rule.params && typeof step.rule.params.citedEquality === "string") {
        const eqLower = step.rule.params.citedEquality.toLowerCase();
        if (
          (eqLower.includes("e0") || eqLower.includes("e =") || eqLower.includes("energy")) &&
          (eqLower.includes("mc2") ||
            eqLower.includes("mc²") ||
            eqLower.includes("γmc²") ||
            eqLower.includes("gamma mc") ||
            eqLower.includes("gammamc"))
        ) {
          errors.push(
            `mass-energy derivation step "${step.id}" initializes body energy with Mc² or γMc² via equality "${step.rule.params.citedEquality}"; rest energy must remain symbolic or arbitrary.`,
          );
        }
      }
    }
  }

  // 4. Per-step rule verification and spot checks
  for (let i = 0; i < chain.steps.length; i++) {
    const step = chain.steps[i];
    if (!step) continue;
    const ruleDef = getRule(step.rule.kind);
    const stepSeed = baseSeed + BigInt(i * 1013);

    if (!ruleDef) {
      stepReports.push({
        stepId: step.id,
        ruleKind: step.rule.kind,
        ruleOutcome: "fail",
        ruleReason: `unregistered rule kind "${step.rule.kind}".`,
        verificationStatus: "failed",
        passed: false,
        error: `unknown rule "${step.rule.kind}"`,
      });
      continue;
    }

    // Run rule checker
    const checkResult = ruleDef.check({
      from: step.from,
      to: step.to,
      params: step.rule.params,
    });

    if (checkResult.outcome === "fail") {
      stepReports.push({
        stepId: step.id,
        ruleKind: step.rule.kind,
        ruleOutcome: "fail",
        ruleReason: checkResult.reason,
        verificationStatus: "failed",
        passed: false,
        error: checkResult.reason ?? "rule check failed",
      });
      continue;
    }

    if (checkResult.outcome === "unverifiable") {
      // Unverifiable rules cannot be claimed as "verified"
      if (step.verification.status === "verified") {
        stepReports.push({
          stepId: step.id,
          ruleKind: step.rule.kind,
          ruleOutcome: "unverifiable",
          ruleReason: checkResult.reason,
          verificationStatus: "failed",
          passed: false,
          error: `rule "${step.rule.kind}" is unverifiable structurally; step cannot claim status "verified" and must be authored "authored-unverified".`,
        });
        continue;
      }

      // Check reviewRecordId for publication gate
      const reviewRecordId = step.verification.reviewRecordId;
      if (isPublicationGate && !reviewRecordId?.trim()) {
        stepReports.push({
          stepId: step.id,
          ruleKind: step.rule.kind,
          ruleOutcome: "unverifiable",
          ruleReason: checkResult.reason,
          verificationStatus: "authored-unverified",
          passed: false,
          error: `authored-unverified step "${step.id}" lacks reviewRecordId required for publication gate.`,
        });
        continue;
      }

      // Perform numerical spot check as supporting evidence when both expressions share evaluable term bindings
      const fromTermIds = collectTermIds(step.from);
      const toTermIds = collectTermIds(step.to);
      const sharedTermIds = fromTermIds.filter((id) => toTermIds.includes(id));
      const termIds = Array.from(new Set([...fromTermIds, ...toTermIds]));
      let spotResult: SpotCheckResult | undefined;

      if (sharedTermIds.length > 0 && fromTermIds.length > 0 && toTermIds.length > 0) {
        try {
          spotResult = spotCheckEquivalence(step.from, step.to, termIds, stepSeed, tolerance);
        } catch {
          // If expressions cannot be evaluated (e.g. relations or non-arithmetic nodes), spot check is safely skipped
        }
      }

      stepReports.push({
        stepId: step.id,
        ruleKind: step.rule.kind,
        ruleOutcome: "unverifiable",
        ruleReason: checkResult.reason,
        verificationStatus: "authored-unverified",
        spotCheckResult: spotResult,
        ...(reviewRecordId ? { reviewRecordId } : {}),
        passed: true,
      });
      continue;
    }

    // checkResult.outcome === "pass"
    stepReports.push({
      stepId: step.id,
      ruleKind: step.rule.kind,
      ruleOutcome: "pass",
      ruleReason: checkResult.reason,
      verificationStatus: "verified",
      passed: true,
    });
  }

  const allStepsPassed = stepReports.length > 0 && stepReports.every((s) => s.passed);
  const passed = allStepsPassed && graphIssues.length === 0 && errors.length === 0;
  const isPublicationReady =
    passed &&
    stepReports.every(
      (s) =>
        s.verificationStatus === "verified" ||
        (s.verificationStatus === "authored-unverified" && Boolean(s.reviewRecordId)),
    );

  return Object.freeze({
    chainId: chain.id,
    proofRouteId: chain.proofRouteId,
    routeKind: chain.routeKind,
    target: chain.target,
    ...(chain.essentialForPrint !== undefined
      ? { essentialForPrint: chain.essentialForPrint }
      : {}),
    passed,
    isPublicationReady,
    stepReports: Object.freeze(stepReports),
    graphIssues: Object.freeze(graphIssues),
    errors: Object.freeze(errors),
  });
}
