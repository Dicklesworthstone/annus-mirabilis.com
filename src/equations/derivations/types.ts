/**
 * The derivation-chain data model (am-eq-derivation-chains-r4c): step,
 * reason, tool, with the non-obvious move marked. Pure types and the
 * structural validators every other module in this directory builds on.
 * No executable content: a chain's `from`/`to` are `Expression` trees
 * (`src/equations/ast.ts`), never functions.
 */

import type { PremiseEdgeType } from "../../content/schemas/meanings.ts";
import type { Expression } from "../ast.ts";

export const ROUTE_KINDS = [
  "source-order",
  "discovery",
  "pedagogical-reconstruction",
  "modern-verification",
] as const;
export type RouteKind = (typeof ROUTE_KINDS)[number];

export const REASON_KINDS = [
  "algebra",
  "calculus",
  "probability",
  "physical-premise",
  "approximation",
  "definition",
  "symmetry",
  "limit",
  "identity",
  "boundary-condition",
] as const;
export type ReasonKind = (typeof REASON_KINDS)[number];

/** A foundation registry id, `foundation:<slug>` (content/foundations/registry.yaml, am-found-library-infra-002t). */
export type FoundationToolId = `foundation:${string}`;

export const FOUNDATION_TOOL_ID_PATTERN = /^foundation:[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function isWellFormedToolId(value: string): value is FoundationToolId {
  return FOUNDATION_TOOL_ID_PATTERN.test(value);
}

/** Provenance for a premise imported from another paper (e.g. paper 3 §8's light-energy transformation, used by paper 4). */
export interface AdmittedImport {
  readonly sourcePaper: string;
  readonly sourceSection: string;
  readonly sourceEquationId: string;
  readonly admissionRule: string;
}

export interface PremiseRef {
  readonly ref: string;
  readonly edgeType: PremiseEdgeType;
  /** Present only when `ref` names a premise imported from another paper. */
  readonly admittedImport?: AdmittedImport | undefined;
}

export interface ApproximationInfo {
  readonly variable: string;
  readonly order: number;
  readonly domain: string;
  readonly neglected: string;
}

export interface ScopeChange {
  readonly from: string;
  readonly to: string;
  readonly bridgeId: string;
}

export type StepVerification =
  | Readonly<{ status: "verified" }>
  | Readonly<{ status: "authored-unverified"; reviewRecordId?: string | undefined }>;

/**
 * Readings (R0/R1/R2 reason text) are owned and authored by the equation
 * bead that authors the chain (content/editorial/readings-owners/<beadId>.yaml),
 * exactly like the readings of a displayed equation. This module only
 * validates their presence and structure; it authors no reason text.
 */
export interface StepReadings {
  readonly r0: string;
  readonly r1: string;
  readonly r2: string;
}

export interface DerivationStep {
  readonly id: string;
  readonly from: Expression;
  readonly to: Expression;
  readonly changedSubexpressionIds: readonly string[];
  readonly rule: RuleApplication;
  readonly reasonKind: ReasonKind;
  readonly reasons: StepReadings;
  /** A foundation registry id, or absent while authoring (the tool audit lists absent steps as `pending`). */
  readonly tool?: FoundationToolId | undefined;
  readonly premiseRefs: readonly PremiseRef[];
  readonly isMove: boolean;
  /** Required when `isMove` is true: the one sentence naming the non-obvious leap. */
  readonly moveLabel?: string | undefined;
  readonly approximation?: ApproximationInfo | undefined;
  readonly sourceAnchor?: string | undefined;
  readonly historicalStatus?: string | undefined;
  readonly modelStatus?: string | undefined;
  readonly verification: StepVerification;
  readonly scopeChange?: ScopeChange | undefined;
  /**
   * An authored break for a side too wide for a phone: "terms" sets a sum one term per row.
   * Absent, each side is one line; the renderer never decides to break one (mathRenderer.ts).
   */
  readonly layout?: StepLayout | undefined;
}

/** Which side of a step, before or after, is set one term per row. */
export type StepLayout = Readonly<{ from?: "terms"; to?: "terms" }>;

export interface DerivationChain {
  readonly id: string;
  readonly proofRouteId: string;
  readonly routeKind: RouteKind;
  readonly entryAssumptions: readonly PremiseRef[];
  readonly target: string;
  /** Authored exception to the print policy's route-kind default; absent means the default applies. */
  readonly essentialForPrint?: boolean | undefined;
  readonly steps: readonly DerivationStep[];
}

// ---------------------------------------------------------------------------
// The rule library's application shape (rules/*.ts define the RuleKind
// union's members and their own parameter types; this module only owns the
// closed list of kinds and the generic wrapper every step carries).
// ---------------------------------------------------------------------------

/**
 * Deliberately small and closed: a rule is added only when an authored
 * chain needs it and its checker is tested (this bead's own pitfall list).
 * The five fixture chains and the adversarial chains in this bead's first
 * pass need exactly these six; a later authoring bead adds more here,
 * with its own checker and tests, rather than inventing a seventh
 * elsewhere.
 */
export const RULE_KINDS = [
  "substitute",
  "cancel-common-factor",
  "monotonic-function",
  "integrate",
  "truncate-series",
  "registered-identity",
  "expand",
  "collect",
  "factor",
  "reorder",
  "add-subtract-multiply-divide",
  "differentiate",
  "take-limit",
  "evaluate-numerical-instance",
] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

export interface RuleApplication {
  readonly kind: RuleKind;
  readonly params: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Structural validation (schema.ts wraps this for the content compiler;
// this module's own checks are the ones every consumer, including tests,
// can call without pulling in zod).
// ---------------------------------------------------------------------------

export class DerivationSchemaError extends Error {
  readonly path: string;
  constructor(message: string, path: string) {
    super(`[derivation] ${path}: ${message}`);
    this.name = "DerivationSchemaError";
    this.path = path;
  }
}

function fail(path: string, message: string): never {
  throw new DerivationSchemaError(message, path);
}

export function validateStepStructure(step: DerivationStep, path: string): void {
  if (!step.id.trim()) fail(`${path}.id`, "step id is required.");
  if (step.tool !== undefined && !isWellFormedToolId(step.tool)) {
    fail(`${path}.tool`, `malformed tool id "${step.tool}"; expected foundation:<slug>.`);
  }
  if (!REASON_KINDS.includes(step.reasonKind))
    fail(`${path}.reasonKind`, `unknown reasonKind "${step.reasonKind}".`);
  if (!RULE_KINDS.includes(step.rule.kind))
    fail(`${path}.rule.kind`, `unknown rule kind "${step.rule.kind}".`);
  if (step.isMove && !step.moveLabel?.trim()) {
    fail(`${path}.moveLabel`, "a step marked isMove requires a non-empty moveLabel.");
  }
  if (!step.isMove && step.moveLabel !== undefined) {
    fail(
      `${path}.moveLabel`,
      "moveLabel is set but isMove is false; a label only belongs to the marked move.",
    );
  }
  for (let index = 0; index < step.premiseRefs.length; index++) {
    const premise = step.premiseRefs[index];
    if (premise && !premise.ref.trim()) {
      fail(`${path}.premiseRefs[${index}].ref`, "premise ref is required.");
    }
  }
  if (
    step.verification.status === "authored-unverified" &&
    step.verification.reviewRecordId !== undefined
  ) {
    if (!step.verification.reviewRecordId.trim()) {
      fail(`${path}.verification.reviewRecordId`, "reviewRecordId, if present, must be non-empty.");
    }
  }
}

/** A step reading missing R0/R1/R2 text is reported against the chain and step id; text is never filled in here. */
export function missingReadingFields(step: DerivationStep): readonly ("r0" | "r1" | "r2")[] {
  const missing: ("r0" | "r1" | "r2")[] = [];
  if (!step.reasons.r0.trim()) missing.push("r0");
  if (!step.reasons.r1.trim()) missing.push("r1");
  if (!step.reasons.r2.trim()) missing.push("r2");
  return missing;
}

export function validateChainStructure(chain: DerivationChain): void {
  if (!chain.id.trim()) fail("chain.id", "chain id is required.");
  if (!chain.proofRouteId.trim()) fail("chain.proofRouteId", "proofRouteId is required.");
  if (!ROUTE_KINDS.includes(chain.routeKind))
    fail("chain.routeKind", `unknown routeKind "${chain.routeKind}".`);
  if (!chain.target.trim()) fail("chain.target", "target is required.");
  if (chain.steps.length === 0) fail("chain.steps", "a chain must have at least one step.");
  const seenStepIds = new Set<string>();
  for (let index = 0; index < chain.steps.length; index++) {
    const step = chain.steps[index];
    if (step) {
      const path = `chain.steps[${index}]`;
      validateStepStructure(step, path);
      if (seenStepIds.has(step.id)) fail(path, `duplicate step id "${step.id}" within one chain.`);
      seenStepIds.add(step.id);
    }
  }
  const moveCount = chain.steps.filter((s) => s.isMove).length;
  if (moveCount > 1) {
    fail(
      "chain.steps",
      `a chain marks ${moveCount} steps as the move; exactly one non-obvious move should be marked.`,
    );
  }
}
