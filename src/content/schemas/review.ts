/**
 * Schemas and validation for review records, cross-projection audits, and review states.
 * Specification: am-edit-review-records-hofz (§17.2, §17.7, §4.3, §10.4)
 */

import { type OwnersRegistry, ROLE_TO_REVIEW_TYPE } from "../owners/parseOwners.ts";

export const REVIEW_SCHEMA_VERSION = 1;

export const REVIEW_TYPES = [
  "german-source",
  "physics-math",
  "r2-readability",
  "tour-completion",
  "history",
  "transfer-task",
  "accessibility-codesign",
  "comprehension-round",
  "cross-projection",
] as const;

export type ReviewType = (typeof REVIEW_TYPES)[number];

export const REVIEW_RESULTS = [
  "accepted",
  "accepted-with-changes",
  "rejected",
  "needs-rereview",
] as const;

export type ReviewResult = (typeof REVIEW_RESULTS)[number];

export const CROSS_PROJECTION_PROJECTIONS = [
  "source-german",
  "translation-english",
  "reading-r0",
  "reading-r2",
  "reading-r3",
  "equation",
  "instrument",
  "results-card",
  "print",
  "accessible",
  "tour",
] as const;

export type CrossProjectionProjection = (typeof CROSS_PROJECTION_PROJECTIONS)[number];

export const CROSS_PROJECTION_VERDICTS = [
  "unchanged",
  "weakened",
  "strengthened",
  "absent",
] as const;

export type CrossProjectionVerdict = (typeof CROSS_PROJECTION_VERDICTS)[number];

export const CROSS_PROJECTION_FINDING_KINDS = [
  "qualification-dropped",
  "scope-widened",
  "approximation-stated-as-exact",
  "constant-set-changed",
  "frame-or-unit-changed",
  "premise-hidden",
  "number-differs",
] as const;

export type CrossProjectionFindingKind = (typeof CROSS_PROJECTION_FINDING_KINDS)[number];

export type ReviewScopeEntry = Readonly<{
  recordId: string;
  contentRevision?: number | string | undefined;
  translationRevision?: number | string | undefined;
  modelVersion?: number | string | undefined;
  unitHash?: string | undefined;
}>;

export type CrossProjectionItem = Readonly<{
  projection: CrossProjectionProjection;
  anchor: string;
  verdict: CrossProjectionVerdict;
  note?: string | undefined;
}>;

export type CrossProjectionFinding = Readonly<{
  projection: CrossProjectionProjection;
  anchor: string;
  kind: CrossProjectionFindingKind;
  description: string;
  owningBeadId: string;
}>;

export type CrossProjectionReviewRecord = Readonly<{
  id: string;
  reviewType: "cross-projection";
  reviewer: string;
  reviewerId?: string | undefined;
  date: string;
  result: ReviewResult;
  claimId: string;
  paper: string;
  claimStatement: string;
  resultCardId: string;
  contentRevision: number | string;
  translationRevision: number | string;
  projections: readonly CrossProjectionItem[];
  findings: readonly CrossProjectionFinding[];
  outcome: "accepted" | "findings-open";
  scope: readonly ReviewScopeEntry[];
  acceptedRevisions?: Readonly<Record<string, number | string>> | undefined;
  notes?: string | undefined;
  evidenceLocation?: string | Record<string, unknown> | undefined;
  sessionRef?: string | undefined;
}>;

export type StandardReviewRecord = Readonly<{
  id: string;
  reviewType: Exclude<ReviewType, "cross-projection">;
  reviewer: string;
  scope: readonly ReviewScopeEntry[];
  date: string;
  result: ReviewResult;
  acceptedRevisions?: Readonly<Record<string, number | string>> | undefined;
  notes?: string | undefined;
  evidenceLocation?: string | Record<string, unknown> | undefined;
  sessionRef?: string | undefined;
}>;

export type ReviewRecord = StandardReviewRecord | CrossProjectionReviewRecord;

export class ReviewValidationError extends Error {
  readonly code: string;
  readonly path: string;

  constructor(code: string, message: string, path = "reviewRecord") {
    super(`${path}: ${message} (${code})`);
    this.name = "ReviewValidationError";
    this.code = code;
    this.path = path;
  }
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const BEAD_ID_REGEX = /^am-[a-z0-9-]+$/;

export type ValidateReviewOptions = {
  ownersRegistry?: OwnersRegistry | undefined;
  skipOwnerRoleCheck?: boolean | undefined;
};

/**
 * Validates a scope entry object.
 */
export function validateReviewScopeEntry(raw: unknown, path = "scope"): ReviewScopeEntry {
  if (!raw || typeof raw !== "object") {
    throw new ReviewValidationError("invalid-scope-entry", "Scope entry must be an object.", path);
  }
  const o = raw as Record<string, unknown>;
  const recordId = typeof o.recordId === "string" ? o.recordId.trim() : "";
  if (!recordId) {
    throw new ReviewValidationError(
      "missing-scope-record-id",
      "Scope entry requires recordId.",
      `${path}.recordId`,
    );
  }

  return {
    recordId,
    contentRevision:
      typeof o.contentRevision === "number" || typeof o.contentRevision === "string"
        ? o.contentRevision
        : undefined,
    translationRevision:
      typeof o.translationRevision === "number" || typeof o.translationRevision === "string"
        ? o.translationRevision
        : undefined,
    modelVersion:
      typeof o.modelVersion === "number" || typeof o.modelVersion === "string"
        ? o.modelVersion
        : undefined,
    unitHash: typeof o.unitHash === "string" && o.unitHash.trim() ? o.unitHash.trim() : undefined,
  };
}

/**
 * Validates a cross-projection review record.
 */
export function validateCrossProjectionRecord(
  raw: unknown,
  options?: ValidateReviewOptions,
  path = "crossProjectionRecord",
): CrossProjectionReviewRecord {
  if (!raw || typeof raw !== "object") {
    throw new ReviewValidationError("invalid-record", "Review record must be an object.", path);
  }
  const o = raw as Record<string, unknown>;

  const id = typeof o.id === "string" ? o.id.trim() : "";
  if (!id) {
    throw new ReviewValidationError("missing-id", "Review record requires id.", `${path}.id`);
  }

  const reviewType = o.reviewType as ReviewType;
  if (reviewType !== "cross-projection") {
    throw new ReviewValidationError(
      "invalid-review-type",
      `Expected reviewType "cross-projection", got "${reviewType}".`,
      `${path}.reviewType`,
    );
  }

  const reviewer = (
    typeof o.reviewer === "string"
      ? o.reviewer
      : typeof o.reviewerId === "string"
        ? o.reviewerId
        : ""
  ).trim();

  if (!reviewer) {
    throw new ReviewValidationError(
      "missing-reviewer",
      "Reviewer id is required.",
      `${path}.reviewer`,
    );
  }

  if (reviewer.startsWith("model:") || reviewer.startsWith("agent:")) {
    throw new ReviewValidationError(
      "model-reviewer",
      `Reviewer "${reviewer}" is a model/agent. Review records must be signed by qualified human reviewers.`,
      `${path}.reviewer`,
    );
  }

  // Check reviewer in registry if provided
  if (options?.ownersRegistry && !options.skipOwnerRoleCheck) {
    const registry = options.ownersRegistry;
    const owner = registry.getOwner(reviewer);
    if (!owner) {
      throw new ReviewValidationError(
        "unknown-reviewer",
        `Reviewer "${reviewer}" is not found in docs/OWNERS.md.`,
        `${path}.reviewer`,
      );
    }
    if (!registry.hasRole(reviewer, "cross-projection-reviewer")) {
      throw new ReviewValidationError(
        "invalid-reviewer-role",
        `Reviewer "${reviewer}" does not hold role "cross-projection-reviewer".`,
        `${path}.reviewer`,
      );
    }
  }

  const date = typeof o.date === "string" ? o.date.trim() : "";
  if (!ISO_DATE_REGEX.test(date)) {
    throw new ReviewValidationError(
      "invalid-date",
      `Date "${date}" must be in YYYY-MM-DD format.`,
      `${path}.date`,
    );
  }

  const result = o.result as ReviewResult;
  if (!REVIEW_RESULTS.includes(result)) {
    throw new ReviewValidationError(
      "invalid-result",
      `Invalid review result "${result}". Expected one of: ${REVIEW_RESULTS.join(", ")}.`,
      `${path}.result`,
    );
  }

  const claimId = typeof o.claimId === "string" ? o.claimId.trim() : "";
  if (!claimId) {
    throw new ReviewValidationError(
      "missing-claim-id",
      "Cross-projection record requires claimId.",
      `${path}.claimId`,
    );
  }

  const paper = typeof o.paper === "string" ? o.paper.trim() : "";
  if (!paper) {
    throw new ReviewValidationError(
      "missing-paper",
      "Cross-projection record requires paper.",
      `${path}.paper`,
    );
  }

  const claimStatement = typeof o.claimStatement === "string" ? o.claimStatement.trim() : "";
  if (!claimStatement) {
    throw new ReviewValidationError(
      "missing-claim-statement",
      "Cross-projection record requires claimStatement.",
      `${path}.claimStatement`,
    );
  }

  const resultCardId = typeof o.resultCardId === "string" ? o.resultCardId.trim() : "";
  if (!resultCardId) {
    throw new ReviewValidationError(
      "missing-result-card-id",
      "Cross-projection record requires resultCardId.",
      `${path}.resultCardId`,
    );
  }

  const contentRevision = o.contentRevision as number | string;
  if (contentRevision === undefined || contentRevision === "") {
    throw new ReviewValidationError(
      "missing-content-revision",
      "Cross-projection record requires contentRevision.",
      `${path}.contentRevision`,
    );
  }

  const translationRevision = o.translationRevision as number | string;
  if (translationRevision === undefined || translationRevision === "") {
    throw new ReviewValidationError(
      "missing-translation-revision",
      "Cross-projection record requires translationRevision.",
      `${path}.translationRevision`,
    );
  }

  // Validate 11 projections
  if (!Array.isArray(o.projections)) {
    throw new ReviewValidationError(
      "missing-projections",
      "Cross-projection record requires projections array.",
      `${path}.projections`,
    );
  }

  const projectionMap = new Map<CrossProjectionProjection, CrossProjectionItem>();
  const validatedProjections: CrossProjectionItem[] = [];

  for (let i = 0; i < o.projections.length; i++) {
    const pRaw = o.projections[i] as Record<string, unknown>;
    const pName = pRaw.projection as CrossProjectionProjection;
    const pPath = `${path}.projections[${i}]`;

    if (!CROSS_PROJECTION_PROJECTIONS.includes(pName)) {
      throw new ReviewValidationError(
        "unknown-projection",
        `Unknown projection "${pName}". Expected one of: ${CROSS_PROJECTION_PROJECTIONS.join(", ")}.`,
        `${pPath}.projection`,
      );
    }

    if (projectionMap.has(pName)) {
      throw new ReviewValidationError(
        "duplicate-projection",
        `Duplicate projection "${pName}" in projections list.`,
        `${pPath}.projection`,
      );
    }

    const anchor = typeof pRaw.anchor === "string" ? pRaw.anchor.trim() : "";
    if (!anchor) {
      throw new ReviewValidationError(
        "missing-anchor",
        `Projection "${pName}" requires anchor.`,
        `${pPath}.anchor`,
      );
    }

    const verdict = pRaw.verdict as CrossProjectionVerdict;
    if (!CROSS_PROJECTION_VERDICTS.includes(verdict)) {
      throw new ReviewValidationError(
        "invalid-verdict",
        `Invalid verdict "${verdict}" for projection "${pName}". Expected one of: ${CROSS_PROJECTION_VERDICTS.join(", ")}.`,
        `${pPath}.verdict`,
      );
    }

    // absent is allowed ONLY for reading-r3 and tour
    if (verdict === "absent" && pName !== "reading-r3" && pName !== "tour") {
      throw new ReviewValidationError(
        "invalid-absent-verdict",
        `Verdict "absent" is not permitted for projection "${pName}". Only reading-r3 and tour may be absent.`,
        `${pPath}.verdict`,
      );
    }

    const item: CrossProjectionItem = {
      projection: pName,
      anchor,
      verdict,
      note: typeof pRaw.note === "string" ? pRaw.note : undefined,
    };

    projectionMap.set(pName, item);
    validatedProjections.push(item);
  }

  // Check all 11 projections exist
  for (const reqP of CROSS_PROJECTION_PROJECTIONS) {
    if (!projectionMap.has(reqP)) {
      throw new ReviewValidationError(
        "missing-required-projection",
        `Projections list missing required projection "${reqP}". All 11 projections must be evaluated.`,
        `${path}.projections`,
      );
    }
  }

  // Validate findings
  const findings: CrossProjectionFinding[] = [];
  const findingsArray = Array.isArray(o.findings) ? o.findings : [];

  for (let i = 0; i < findingsArray.length; i++) {
    const fRaw = findingsArray[i] as Record<string, unknown>;
    const fPath = `${path}.findings[${i}]`;

    const fProj = fRaw.projection as CrossProjectionProjection;
    if (!CROSS_PROJECTION_PROJECTIONS.includes(fProj)) {
      throw new ReviewValidationError(
        "invalid-finding-projection",
        `Finding specifies unknown projection "${fProj}".`,
        `${fPath}.projection`,
      );
    }

    const anchor = typeof fRaw.anchor === "string" ? fRaw.anchor.trim() : "";
    if (!anchor) {
      throw new ReviewValidationError(
        "missing-finding-anchor",
        "Finding requires anchor.",
        `${fPath}.anchor`,
      );
    }

    const kind = fRaw.kind as CrossProjectionFindingKind;
    if (!CROSS_PROJECTION_FINDING_KINDS.includes(kind)) {
      throw new ReviewValidationError(
        "invalid-finding-kind",
        `Finding kind "${kind}" is invalid. Expected one of: ${CROSS_PROJECTION_FINDING_KINDS.join(", ")}.`,
        `${fPath}.kind`,
      );
    }

    const description = typeof fRaw.description === "string" ? fRaw.description.trim() : "";
    if (!description) {
      throw new ReviewValidationError(
        "missing-finding-description",
        "Finding requires description.",
        `${fPath}.description`,
      );
    }

    const owningBeadId = typeof fRaw.owningBeadId === "string" ? fRaw.owningBeadId.trim() : "";
    if (!owningBeadId || !BEAD_ID_REGEX.test(owningBeadId)) {
      throw new ReviewValidationError(
        "invalid-owning-bead-id",
        `Finding owningBeadId "${owningBeadId}" must be a valid bead ID (pattern am-...).`,
        `${fPath}.owningBeadId`,
      );
    }

    findings.push({
      projection: fProj,
      anchor,
      kind,
      description,
      owningBeadId,
    });
  }

  // Rule: A weakened or strengthened verdict requires a matching finding
  for (const pItem of validatedProjections) {
    if (pItem.verdict === "weakened" || pItem.verdict === "strengthened") {
      const hasMatchingFinding = findings.some((f) => f.projection === pItem.projection);
      if (!hasMatchingFinding) {
        throw new ReviewValidationError(
          "missing-verdict-finding",
          `Projection "${pItem.projection}" has verdict "${pItem.verdict}" but no finding is recorded for it in findings[].`,
          `${path}.projections`,
        );
      }
    }
  }

  const outcome = o.outcome as "accepted" | "findings-open";
  if (outcome !== "accepted" && outcome !== "findings-open") {
    throw new ReviewValidationError(
      "invalid-outcome",
      `Invalid outcome "${outcome}". Expected "accepted" or "findings-open".`,
      `${path}.outcome`,
    );
  }

  // Build scope
  const scope: ReviewScopeEntry[] = Array.isArray(o.scope)
    ? o.scope.map((s, i) => validateReviewScopeEntry(s, `${path}.scope[${i}]`))
    : [
        {
          recordId: claimId,
          contentRevision,
          translationRevision,
        },
      ];

  return {
    id,
    reviewType: "cross-projection",
    reviewer,
    reviewerId: typeof o.reviewerId === "string" ? o.reviewerId : reviewer,
    date,
    result,
    claimId,
    paper,
    claimStatement,
    resultCardId,
    contentRevision,
    translationRevision,
    projections: Object.freeze(validatedProjections),
    findings: Object.freeze(findings),
    outcome,
    scope: Object.freeze(scope),
    acceptedRevisions: o.acceptedRevisions as Record<string, number | string> | undefined,
    notes: typeof o.notes === "string" ? o.notes : undefined,
    evidenceLocation: o.evidenceLocation as string | Record<string, unknown> | undefined,
    sessionRef: typeof o.sessionRef === "string" ? o.sessionRef : undefined,
  };
}

/**
 * Validates any review record.
 */
export function validateReviewRecord(
  raw: unknown,
  options?: ValidateReviewOptions,
  path = "reviewRecord",
): ReviewRecord {
  if (!raw || typeof raw !== "object") {
    throw new ReviewValidationError("invalid-record", "Review record must be an object.", path);
  }
  const o = raw as Record<string, unknown>;

  const reviewType = o.reviewType as ReviewType;
  if (!REVIEW_TYPES.includes(reviewType)) {
    throw new ReviewValidationError(
      "invalid-review-type",
      `Invalid reviewType "${reviewType}". Expected one of: ${REVIEW_TYPES.join(", ")}.`,
      `${path}.reviewType`,
    );
  }

  if (reviewType === "cross-projection") {
    return validateCrossProjectionRecord(raw, options, path);
  }

  const id = typeof o.id === "string" ? o.id.trim() : "";
  if (!id) {
    throw new ReviewValidationError("missing-id", "Review record requires id.", `${path}.id`);
  }

  const reviewer = (typeof o.reviewer === "string" ? o.reviewer : "").trim();
  if (!reviewer) {
    throw new ReviewValidationError(
      "missing-reviewer",
      "Reviewer id is required.",
      `${path}.reviewer`,
    );
  }

  if (reviewer.startsWith("model:") || reviewer.startsWith("agent:")) {
    throw new ReviewValidationError(
      "model-reviewer",
      `Reviewer "${reviewer}" is a model/agent. Review records must be signed by qualified human reviewers.`,
      `${path}.reviewer`,
    );
  }

  // Check reviewer in registry if provided
  if (options?.ownersRegistry && !options.skipOwnerRoleCheck) {
    const registry = options.ownersRegistry;
    const owner = registry.getOwner(reviewer);
    if (!owner) {
      throw new ReviewValidationError(
        "unknown-reviewer",
        `Reviewer "${reviewer}" is not found in docs/OWNERS.md.`,
        `${path}.reviewer`,
      );
    }
    const roles = registry.rolesOf(reviewer);
    const allowedReviewTypes = roles
      .map((r) => ROLE_TO_REVIEW_TYPE[r as keyof typeof ROLE_TO_REVIEW_TYPE])
      .filter(Boolean);

    if (!allowedReviewTypes.includes(reviewType)) {
      throw new ReviewValidationError(
        "invalid-reviewer-role",
        `Reviewer "${reviewer}" has roles [${roles.join(", ")}] which do not permit reviewType "${reviewType}".`,
        `${path}.reviewer`,
      );
    }
  }

  const date = typeof o.date === "string" ? o.date.trim() : "";
  if (!ISO_DATE_REGEX.test(date)) {
    throw new ReviewValidationError(
      "invalid-date",
      `Date "${date}" must be in YYYY-MM-DD format.`,
      `${path}.date`,
    );
  }

  const result = o.result as ReviewResult;
  if (!REVIEW_RESULTS.includes(result)) {
    throw new ReviewValidationError(
      "invalid-result",
      `Invalid review result "${result}". Expected one of: ${REVIEW_RESULTS.join(", ")}.`,
      `${path}.result`,
    );
  }

  if (!Array.isArray(o.scope) || o.scope.length === 0) {
    throw new ReviewValidationError(
      "missing-scope",
      "Review record must have non-empty scope list.",
      `${path}.scope`,
    );
  }

  const scope = o.scope.map((s, i) => validateReviewScopeEntry(s, `${path}.scope[${i}]`));

  return {
    id,
    reviewType,
    reviewer,
    scope: Object.freeze(scope),
    date,
    result,
    acceptedRevisions: o.acceptedRevisions as Record<string, number | string> | undefined,
    notes: typeof o.notes === "string" ? o.notes : undefined,
    evidenceLocation: o.evidenceLocation as string | Record<string, unknown> | undefined,
    sessionRef: typeof o.sessionRef === "string" ? o.sessionRef : undefined,
  };
}
