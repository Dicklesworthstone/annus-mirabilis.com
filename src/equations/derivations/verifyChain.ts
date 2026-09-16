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

    // Mass-energy circular rest energy constraint
    if (
      chain.id.includes("mass-energy") ||
      chain.id.includes("me-") ||
      chain.target.includes("mass-energy")
    ) {
      for (const p of step.premiseRefs) {
        if (
          p.ref.includes("mc2-initialization") ||
          p.ref.includes("rest-energy-mc2") ||
          p.ref === "E0=Mc2"
        ) {
          errors.push(
            `mass-energy derivation step "${step.id}" initializes body energy with Mc² via premise "${p.ref}"; rest energy must remain symbolic or arbitrary.`,
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
