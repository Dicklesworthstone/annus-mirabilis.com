/**
 * Schema parsing and validation for derivation chains (am-eq-derivation-chains-r4c).
 * Enforces structural integrity, valid enum values, and type conformance.
 */

import { PREMISE_EDGE_TYPES, type PremiseEdgeType } from "../../content/schemas/meanings.ts";
import type { Expression } from "../ast.ts";
import {
  type AdmittedImport,
  type ApproximationInfo,
  type DerivationChain,
  DerivationSchemaError,
  type DerivationStep,
  isWellFormedToolId,
  missingReadingFields,
  type PremiseRef,
  REASON_KINDS,
  type ReasonKind,
  ROUTE_KINDS,
  type RouteKind,
  RULE_KINDS,
  type RuleApplication,
  type RuleKind,
  type ScopeChange,
  type StepReadings,
  type StepVerification,
  validateChainStructure,
} from "./types.ts";

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function fail(path: string, message: string): never {
  throw new DerivationSchemaError(message, path);
}

export function parsePremiseRef(val: unknown, path: string): PremiseRef {
  if (!isObject(val)) fail(path, "premise reference must be an object.");
  const ref = typeof val.ref === "string" ? val.ref.trim() : "";
  if (!ref) fail(`${path}.ref`, "premise ref is required.");

  const edgeType = val.edgeType as PremiseEdgeType;
  if (!PREMISE_EDGE_TYPES.includes(edgeType)) {
    fail(
      `${path}.edgeType`,
      `unknown edgeType "${edgeType}". Expected one of: ${PREMISE_EDGE_TYPES.join(", ")}`,
    );
  }

  let admittedImport: AdmittedImport | undefined;
  if (val.admittedImport !== undefined) {
    if (!isObject(val.admittedImport))
      fail(`${path}.admittedImport`, "admittedImport must be an object.");
    const ai = val.admittedImport;
    if (typeof ai.sourcePaper !== "string" || !ai.sourcePaper.trim()) {
      fail(`${path}.admittedImport.sourcePaper`, "sourcePaper is required.");
    }
    if (typeof ai.sourceSection !== "string" || !ai.sourceSection.trim()) {
      fail(`${path}.admittedImport.sourceSection`, "sourceSection is required.");
    }
    if (typeof ai.sourceEquationId !== "string" || !ai.sourceEquationId.trim()) {
      fail(`${path}.admittedImport.sourceEquationId`, "sourceEquationId is required.");
    }
    if (typeof ai.admissionRule !== "string" || !ai.admissionRule.trim()) {
      fail(`${path}.admittedImport.admissionRule`, "admissionRule is required.");
    }
    admittedImport = {
      sourcePaper: ai.sourcePaper.trim(),
      sourceSection: ai.sourceSection.trim(),
      sourceEquationId: ai.sourceEquationId.trim(),
      admissionRule: ai.admissionRule.trim(),
    };
  }

  return { ref, edgeType, ...(admittedImport ? { admittedImport } : {}) };
}

export function parseStepReadings(val: unknown, path: string): StepReadings {
  if (!isObject(val)) fail(path, "reasons must be an object with r0, r1, r2.");
  if (typeof val.r0 !== "string") fail(`${path}.r0`, "r0 reason text is required.");
  if (typeof val.r1 !== "string") fail(`${path}.r1`, "r1 reason text is required.");
  if (typeof val.r2 !== "string") fail(`${path}.r2`, "r2 reason text is required.");
  return {
    r0: val.r0,
    r1: val.r1,
    r2: val.r2,
  };
}

export function parseRuleApplication(val: unknown, path: string): RuleApplication {
  if (!isObject(val)) fail(path, "rule must be an object with kind and params.");
  const kind = val.kind as RuleKind;
  if (!RULE_KINDS.includes(kind)) {
    fail(`${path}.kind`, `unknown rule kind "${kind}". Expected one of: ${RULE_KINDS.join(", ")}`);
  }
  if (!isObject(val.params)) fail(`${path}.params`, "rule params must be an object.");
  return {
    kind,
    params: Object.freeze({ ...val.params }),
  };
}

export function parseStepVerification(val: unknown, path: string): StepVerification {
  if (!isObject(val)) fail(path, "verification must be an object.");
  const status = val.status;
  if (status === "verified") {
    return Object.freeze({ status: "verified" as const });
  }
  if (status === "authored-unverified") {
    const reviewRecordId =
      typeof val.reviewRecordId === "string" ? val.reviewRecordId.trim() : undefined;
    return Object.freeze({
      status: "authored-unverified" as const,
      ...(reviewRecordId ? { reviewRecordId } : {}),
    });
  }
  fail(
    `${path}.status`,
    `unknown verification status "${status}". Expected "verified" or "authored-unverified".`,
  );
}

export function parseDerivationStep(val: unknown, path: string): DerivationStep {
  if (!isObject(val)) fail(path, "derivation step must be an object.");
  const id = typeof val.id === "string" ? val.id.trim() : "";
  if (!id) fail(`${path}.id`, "step id is required.");

  if (!isObject(val.from)) fail(`${path}.from`, "from expression tree is required.");
  if (!isObject(val.to)) fail(`${path}.to`, "to expression tree is required.");
  const from = val.from as Expression;
  const to = val.to as Expression;

  if (!Array.isArray(val.changedSubexpressionIds)) {
    fail(`${path}.changedSubexpressionIds`, "changedSubexpressionIds must be an array of strings.");
  }
  const changedSubexpressionIds = Object.freeze(
    val.changedSubexpressionIds.map((s, i) => {
      if (typeof s !== "string") fail(`${path}.changedSubexpressionIds[${i}]`, "must be a string.");
      return s;
    }),
  );

  const rule = parseRuleApplication(val.rule, `${path}.rule`);
  const reasonKind = val.reasonKind as ReasonKind;
  if (!REASON_KINDS.includes(reasonKind)) {
    fail(`${path}.reasonKind`, `unknown reasonKind "${reasonKind}".`);
  }

  const reasons = parseStepReadings(val.reasons, `${path}.reasons`);

  let tool: DerivationStep["tool"];
  if (val.tool !== undefined) {
    if (typeof val.tool !== "string" || !isWellFormedToolId(val.tool)) {
      fail(`${path}.tool`, `malformed tool id "${val.tool}"; expected foundation:<slug>.`);
    }
    tool = val.tool;
  }

  if (!Array.isArray(val.premiseRefs)) fail(`${path}.premiseRefs`, "premiseRefs must be an array.");
  const premiseRefs = Object.freeze(
    val.premiseRefs.map((p, i) => parsePremiseRef(p, `${path}.premiseRefs[${i}]`)),
  );

  const isMove = Boolean(val.isMove);
  let moveLabel: string | undefined;
  if (isMove) {
    if (typeof val.moveLabel !== "string" || !val.moveLabel.trim()) {
      fail(`${path}.moveLabel`, "a step marked isMove requires a non-empty moveLabel.");
    }
    moveLabel = val.moveLabel.trim();
  } else if (val.moveLabel !== undefined) {
    fail(
      `${path}.moveLabel`,
      "moveLabel is set but isMove is false; a label only belongs to the marked move.",
    );
  }

  let approximation: ApproximationInfo | undefined;
  if (val.approximation !== undefined) {
    if (!isObject(val.approximation))
      fail(`${path}.approximation`, "approximation must be an object.");
    const a = val.approximation;
    if (typeof a.variable !== "string" || !a.variable.trim())
      fail(`${path}.approximation.variable`, "variable required.");
    if (typeof a.order !== "number" || !Number.isInteger(a.order) || a.order < 0) {
      fail(`${path}.approximation.order`, "order must be a non-negative integer.");
    }
    if (typeof a.domain !== "string" || !a.domain.trim())
      fail(`${path}.approximation.domain`, "domain required.");
    if (typeof a.neglected !== "string" || !a.neglected.trim())
      fail(`${path}.approximation.neglected`, "neglected required.");
    approximation = {
      variable: a.variable.trim(),
      order: a.order,
      domain: a.domain.trim(),
      neglected: a.neglected.trim(),
    };
  }

  const sourceAnchor = typeof val.sourceAnchor === "string" ? val.sourceAnchor.trim() : undefined;
  const historicalStatus =
    typeof val.historicalStatus === "string" ? val.historicalStatus.trim() : undefined;
  const modelStatus = typeof val.modelStatus === "string" ? val.modelStatus.trim() : undefined;

  const verification = parseStepVerification(val.verification, `${path}.verification`);

  let scopeChange: ScopeChange | undefined;
  if (val.scopeChange !== undefined) {
    if (!isObject(val.scopeChange)) fail(`${path}.scopeChange`, "scopeChange must be an object.");
    const sc = val.scopeChange;
    if (typeof sc.from !== "string" || !sc.from.trim())
      fail(`${path}.scopeChange.from`, "from is required.");
    if (typeof sc.to !== "string" || !sc.to.trim())
      fail(`${path}.scopeChange.to`, "to is required.");
    if (typeof sc.bridgeId !== "string" || !sc.bridgeId.trim())
      fail(`${path}.scopeChange.bridgeId`, "bridgeId is required.");
    scopeChange = { from: sc.from.trim(), to: sc.to.trim(), bridgeId: sc.bridgeId.trim() };
  }

  return Object.freeze({
    id,
    from,
    to,
    changedSubexpressionIds,
    rule,
    reasonKind,
    reasons,
    ...(tool ? { tool } : {}),
    premiseRefs,
    isMove,
    ...(moveLabel ? { moveLabel } : {}),
    ...(approximation ? { approximation } : {}),
    ...(sourceAnchor ? { sourceAnchor } : {}),
    ...(historicalStatus ? { historicalStatus } : {}),
    ...(modelStatus ? { modelStatus } : {}),
    verification,
    ...(scopeChange ? { scopeChange } : {}),
  });
}

export function parseDerivationChain(val: unknown): DerivationChain {
  if (!isObject(val)) fail("chain", "derivation chain must be an object.");
  const id = typeof val.id === "string" ? val.id.trim() : "";
  if (!id) fail("chain.id", "chain id is required.");

  const proofRouteId = typeof val.proofRouteId === "string" ? val.proofRouteId.trim() : "";
  if (!proofRouteId) fail("chain.proofRouteId", "proofRouteId is required.");

  const routeKind = val.routeKind as RouteKind;
  if (!ROUTE_KINDS.includes(routeKind)) {
    fail(
      "chain.routeKind",
      `unknown routeKind "${routeKind}". Expected one of: ${ROUTE_KINDS.join(", ")}`,
    );
  }

  if (!Array.isArray(val.entryAssumptions))
    fail("chain.entryAssumptions", "entryAssumptions must be an array.");
  const entryAssumptions = Object.freeze(
    val.entryAssumptions.map((p, i) => parsePremiseRef(p, `chain.entryAssumptions[${i}]`)),
  );

  const target = typeof val.target === "string" ? val.target.trim() : "";
  if (!target) fail("chain.target", "target is required.");

  const essentialForPrint =
    typeof val.essentialForPrint === "boolean" ? val.essentialForPrint : undefined;

  if (!Array.isArray(val.steps)) fail("chain.steps", "steps must be an array.");
  if (val.steps.length === 0) fail("chain.steps", "a chain must have at least one step.");

  const steps = Object.freeze(val.steps.map((s, i) => parseDerivationStep(s, `chain.steps[${i}]`)));

  const chain: DerivationChain = Object.freeze({
    id,
    proofRouteId,
    routeKind,
    entryAssumptions,
    target,
    ...(essentialForPrint !== undefined ? { essentialForPrint } : {}),
    steps,
  });

  validateChainStructure(chain);
  return chain;
}

export { missingReadingFields };
