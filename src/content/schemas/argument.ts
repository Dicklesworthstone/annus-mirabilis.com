/**
 * Canonical schemas and validators for Argument, Knowledge Cards (HistoricalPremise),
 * Quantities, Equations, Foundations, Bridges, Misconceptions, Readings, and the Four Meanings.
 * Specification: AGENTS.md (§5.1, §5.2, §6.2–6.6, §7.5, §7.6, §9.1, §11.2, §11.4, §11.5, §11.6)
 * and am-cm-schemas-argument-llm
 */

import {
  type AlternateForm,
  type CompositeGroup,
  type LayoutHints,
  validateAlternateForm,
  validateCompositeGroup,
  validateLayoutHints,
} from "../../equations/tree/schema.ts";
import { type TextDirection, validateDirection, validateLanguageTag } from "../../i18n/language.ts";
import {
  parseClosingId,
  parseEquationRecordId,
  parseFootnoteId,
  parseHeadingId,
  parseParagraphId,
  parsePremiseId,
  parseQuantityId,
} from "../ids.ts";
import { type AuthorshipBlock, validateAuthorshipBlock } from "./authorship.ts";
import {
  isDimensionless,
  type RationalDimension,
  type RationalScale,
  validateRationalDimension,
  validateRationalScale,
} from "./dimensionBasis.ts";

export type { TextDirection } from "../../i18n/language.ts";
export type { AuthorshipBlock } from "./authorship.ts";
export type { PremiseStatus } from "./meanings.ts";
export type { AlternateForm, CompositeGroup, LayoutHints };

export type VerificationMethod =
  | "library scan"
  | "bound volume"
  | "publisher facsimile"
  | "comparison edition";

export const ARGUMENT_SCHEMA_VERSION = 1;

import {
  COLOR_ROLES,
  CONTINUE_WITH_ROUTES,
  type ColorRole,
  type ContinueWithRoute,
  DENSITY_KINDS,
  DENSITY_PER_KINDS,
  type DensityKind,
  type DensityPerKind,
  DIMENSION_STATUSES,
  DIMENSIONLESS_KINDS,
  type DimensionlessKind,
  type DimensionStatus,
  EVIDENCE_RELATIONS,
  type EvidenceRelation,
  EXECUTION_STATUSES,
  type ExecutionStatus,
  FOUNDATION_KINDS,
  type FoundationKind,
  type FourMeanings,
  FRAMES,
  FREQUENCY_KINDS,
  type Frame,
  type FrequencyKind,
  HISTORICAL_STATUSES,
  type HistoricalStatus,
  LOGICAL_ROLES,
  type LogicalRole,
  MATHEMATICAL_KINDS,
  type MathematicalKind,
  MODEL_STATUSES,
  MODERN_RELATIONS,
  type ModelStatus,
  type ModernRelation,
  NOTATION_MODES,
  type NotationMode,
  OBSERVATION_KINDS,
  OBSTACLE_KIND_IDS,
  type ObservationKind,
  PREMISE_EDGE_TYPES,
  PREMISE_STATUSES,
  PROOF_EDGE_KINDS,
  PROOF_ROUTES,
  type PremiseEdgeType,
  type PremiseStatus,
  type ProofEdgeKind,
  type ProofRoute,
  READING_TARGET_KINDS,
  type ReadingTargetKind,
  SPECTRAL_BASES,
  type SpectralBasis,
  STATISTICS,
  type Statistic,
  TIME_KINDS,
  type TimeKind,
  UNIT_SYSTEMS,
  type UnitSystem,
} from "./meanings.ts";

export class ArgumentSchemaError extends Error {
  readonly code: string;
  readonly entity: string;
  readonly path: string;

  constructor(code: string, message: string, entity = "ArgumentEntity", path = "root") {
    super(`[${entity}] ${path}: ${message} (${code})`);
    this.name = "ArgumentSchemaError";
    this.code = code;
    this.entity = entity;
    this.path = path;
  }
}

// ============================================================================
// 1. Four Meanings Validator
// ============================================================================

export function validateMeanings(
  raw: unknown,
  path = "meanings",
  entity = "Meanings",
): FourMeanings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ArgumentSchemaError(
      "invalid-meanings-record",
      "Meanings must be an object with four required fields.",
      entity,
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  if ("essentialForPrint" in o && o.essentialForPrint !== undefined) {
    throw new ArgumentSchemaError(
      "essential-for-print-rejected",
      "essentialForPrint is rejected on Meanings; it is only allowed on ReadingSet and Misconception.",
      entity,
      `${path}.essentialForPrint`,
    );
  }

  if (!o.logicalRole || typeof o.logicalRole !== "string") {
    throw new ArgumentSchemaError(
      "missing-meaning-field",
      "meanings.logicalRole is required.",
      entity,
      `${path}.logicalRole`,
    );
  }
  if (!LOGICAL_ROLES.includes(o.logicalRole as LogicalRole)) {
    throw new ArgumentSchemaError(
      "invalid-logical-role",
      `Invalid logicalRole "${o.logicalRole}". Expected one of: ${LOGICAL_ROLES.join(", ")}`,
      entity,
      `${path}.logicalRole`,
    );
  }

  if (!o.historicalStatus || typeof o.historicalStatus !== "string") {
    throw new ArgumentSchemaError(
      "missing-meaning-field",
      "meanings.historicalStatus is required.",
      entity,
      `${path}.historicalStatus`,
    );
  }
  if (!HISTORICAL_STATUSES.includes(o.historicalStatus as HistoricalStatus)) {
    throw new ArgumentSchemaError(
      "invalid-historical-status",
      `Invalid historicalStatus "${o.historicalStatus}". Expected one of: ${HISTORICAL_STATUSES.join(", ")}`,
      entity,
      `${path}.historicalStatus`,
    );
  }

  if (!o.modelStatus || typeof o.modelStatus !== "string") {
    throw new ArgumentSchemaError(
      "missing-meaning-field",
      "meanings.modelStatus is required.",
      entity,
      `${path}.modelStatus`,
    );
  }
  if (!MODEL_STATUSES.includes(o.modelStatus as ModelStatus)) {
    throw new ArgumentSchemaError(
      "invalid-model-status",
      `Invalid modelStatus "${o.modelStatus}". Expected one of: ${MODEL_STATUSES.join(", ")}`,
      entity,
      `${path}.modelStatus`,
    );
  }

  if (!o.executionStatus || typeof o.executionStatus !== "string") {
    throw new ArgumentSchemaError(
      "missing-meaning-field",
      "meanings.executionStatus is required.",
      entity,
      `${path}.executionStatus`,
    );
  }
  if (!EXECUTION_STATUSES.includes(o.executionStatus as ExecutionStatus)) {
    throw new ArgumentSchemaError(
      "invalid-execution-status",
      `Invalid executionStatus "${o.executionStatus}". Expected one of: ${EXECUTION_STATUSES.join(", ")}`,
      entity,
      `${path}.executionStatus`,
    );
  }

  return {
    logicalRole: o.logicalRole as LogicalRole,
    historicalStatus: o.historicalStatus as HistoricalStatus,
    modelStatus: o.modelStatus as ModelStatus,
    executionStatus: o.executionStatus as ExecutionStatus,
  };
}

// ============================================================================
export type PremiseEventKind = "presented" | "published" | "performed";

export type PriorEvent = Readonly<{
  eventKind: PremiseEventKind;
  earliest: string;
  latest: string;
  precision: "day" | "month" | "year" | "range";
  sources?: readonly unknown[] | undefined;
}>;

export type PremiseVerification = Readonly<{
  verifiedBy: string;
  verifierKind: "human" | "agent";
  date: string;
  method: "library scan" | "bound volume" | "publisher facsimile" | "comparison edition";
  evidenceLocator: string;
  printedCitation?: string | undefined;
  discrepancies?: readonly string[] | undefined;
  reviewRecordId?: string | undefined;
}>;

export type AdmittedImportInfo = Readonly<{
  declaringJourney: string;
  sourceKey?: string | undefined;
  anchor?: string | undefined;
  provenance?: string | undefined;
}>;

export type PremiseDate = Readonly<{
  earliest: string;
  latest: string;
  precision: "day" | "month" | "year" | "range";
  latestYear: number;
  eventKind?: PremiseEventKind | undefined;
}>;

export type PaperCitationRef = Readonly<{
  paper: string;
  ids?: readonly string[] | undefined;
  anchor?: string | undefined;
  note?: string | undefined;
}>;

export type HistoricalPremise = Readonly<{
  id: string;
  proposition: string;
  status: PremiseStatus;
  sources: readonly unknown[];
  date: PremiseDate;
  claimsEinsteinKnew: boolean;
  limits?: string | undefined;
  priorEvent?: PriorEvent | undefined;
  relatedCardId?: string | undefined;
  parallelWorkBasis?: string | undefined;
  einsteinKnowledgeEvidence?: readonly unknown[] | undefined;
  paperCitesOrAsserts?: readonly PaperCitationRef[] | undefined;
  admittedStages?: readonly string[] | undefined;
  admittedImport?: boolean | AdmittedImportInfo | undefined;
  verification?: PremiseVerification | undefined;
  verifier?: string | undefined;
  dateVerified?: string | undefined;
  evidenceLocator?: string | undefined;
  authorship: AuthorshipBlock;
  reviewState: string;
  lang?: string | undefined;
  dir?: TextDirection | undefined;
}>;

export function validateHistoricalPremise(
  raw: unknown,
  path = "HistoricalPremise",
): HistoricalPremise {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ArgumentSchemaError(
      "invalid-record",
      "HistoricalPremise must be an object.",
      "HistoricalPremise",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  if ("essentialForPrint" in o && o.essentialForPrint !== undefined) {
    throw new ArgumentSchemaError(
      "essential-for-print-rejected",
      "essentialForPrint is rejected on HistoricalPremise; it is only allowed on ReadingSet and Misconception.",
      "HistoricalPremise",
      `${path}.essentialForPrint`,
    );
  }

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new ArgumentSchemaError(
      "missing-id",
      "HistoricalPremise id is required.",
      "HistoricalPremise",
      `${path}.id`,
    );
  }
  const idResult = parsePremiseId(o.id);
  if (!idResult.ok) {
    throw new ArgumentSchemaError(
      idResult.rule || "invalid-id",
      idResult.error,
      "HistoricalPremise",
      `${path}.id`,
    );
  }

  if (typeof o.proposition !== "string" || !o.proposition.trim()) {
    throw new ArgumentSchemaError(
      "missing-proposition",
      "proposition is required.",
      "HistoricalPremise",
      `${path}.proposition`,
    );
  }

  if (o.status === "later-confirmation") {
    throw new ArgumentSchemaError(
      "invalid-premise-status",
      "'later-confirmation' is rejected in favor of 'later'.",
      "HistoricalPremise",
      `${path}.status`,
    );
  }
  if (!PREMISE_STATUSES.includes(o.status as PremiseStatus)) {
    throw new ArgumentSchemaError(
      "invalid-premise-status",
      `Invalid status "${o.status}". Expected one of: ${PREMISE_STATUSES.join(", ")}`,
      "HistoricalPremise",
      `${path}.status`,
    );
  }

  if (!Array.isArray(o.sources) || o.sources.length === 0) {
    throw new ArgumentSchemaError(
      "missing-sources",
      "sources array is required and must contain original evidence citations.",
      "HistoricalPremise",
      `${path}.sources`,
    );
  }

  // Date validation
  const d = o.date as Record<string, unknown>;
  if (!d || typeof d !== "object") {
    throw new ArgumentSchemaError(
      "missing-date",
      "date object is required.",
      "HistoricalPremise",
      `${path}.date`,
    );
  }
  if (!["day", "month", "year", "range"].includes(d.precision as string)) {
    throw new ArgumentSchemaError(
      "invalid-date-precision",
      `Invalid date precision "${d.precision}". Expected day, month, year, or range.`,
      "HistoricalPremise",
      `${path}.date.precision`,
    );
  }
  const precision = d.precision as "day" | "month" | "year" | "range";
  const earliest = typeof d.earliest === "string" ? d.earliest : "";
  const latest = typeof d.latest === "string" ? d.latest : "";

  if (precision === "day") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(earliest) || !/^\d{4}-\d{2}-\d{2}$/.test(latest)) {
      throw new ArgumentSchemaError(
        "invalid-date-precision-format",
        `Precision "day" requires ISO YYYY-MM-DD for earliest and latest.`,
        "HistoricalPremise",
        `${path}.date`,
      );
    }
  } else if (precision === "month") {
    if (!/^\d{4}-\d{2}$/.test(earliest) || !/^\d{4}-\d{2}$/.test(latest)) {
      throw new ArgumentSchemaError(
        "invalid-date-precision-format",
        `Precision "month" requires ISO YYYY-MM for earliest and latest.`,
        "HistoricalPremise",
        `${path}.date`,
      );
    }
  } else if (precision === "year") {
    if (!/^\d{4}$/.test(earliest) || !/^\d{4}$/.test(latest)) {
      throw new ArgumentSchemaError(
        "invalid-date-precision-format",
        `Precision "year" requires ISO YYYY for earliest and latest.`,
        "HistoricalPremise",
        `${path}.date`,
      );
    }
  }

  let eventKind: PremiseEventKind | undefined;
  if (d.eventKind !== undefined) {
    if (
      typeof d.eventKind !== "string" ||
      !["presented", "published", "performed"].includes(d.eventKind)
    ) {
      throw new ArgumentSchemaError(
        "invalid-event-kind",
        `Invalid eventKind "${d.eventKind}". Expected presented, published, or performed.`,
        "HistoricalPremise",
        `${path}.date.eventKind`,
      );
    }
    eventKind = d.eventKind as PremiseEventKind;
  }

  if (typeof d.latestYear !== "number" || !Number.isInteger(d.latestYear)) {
    throw new ArgumentSchemaError(
      "missing-latest-year",
      "latestYear integer is required.",
      "HistoricalPremise",
      `${path}.date.latestYear`,
    );
  }
  const expectedYear = parseInt(latest.slice(0, 4), 10);
  if (d.latestYear !== expectedYear) {
    throw new ArgumentSchemaError(
      "latest-year-mismatch",
      `latestYear (${d.latestYear}) must equal the year of latest date (${expectedYear}).`,
      "HistoricalPremise",
      `${path}.date.latestYear`,
    );
  }

  // Prior event validation
  let priorEvent: PriorEvent | undefined;
  if (o.priorEvent !== undefined && o.priorEvent !== null) {
    if (typeof o.priorEvent !== "object" || Array.isArray(o.priorEvent)) {
      throw new ArgumentSchemaError(
        "invalid-prior-event",
        "priorEvent must be an object.",
        "HistoricalPremise",
        `${path}.priorEvent`,
      );
    }
    const pe = o.priorEvent as Record<string, unknown>;
    if (
      typeof pe.eventKind !== "string" ||
      !["presented", "published", "performed"].includes(pe.eventKind)
    ) {
      throw new ArgumentSchemaError(
        "invalid-prior-event-kind",
        `priorEvent.eventKind must be presented, published, or performed (got "${pe.eventKind}").`,
        "HistoricalPremise",
        `${path}.priorEvent.eventKind`,
      );
    }
    if (typeof pe.latest === "string" && pe.latest > latest) {
      throw new ArgumentSchemaError(
        "card-prior-event-not-prior",
        `priorEvent latest (${pe.latest}) must not be after date latest (${latest}).`,
        "HistoricalPremise",
        `${path}.priorEvent.latest`,
      );
    }
    priorEvent = {
      eventKind: pe.eventKind as PremiseEventKind,
      earliest: String(pe.earliest ?? ""),
      latest: String(pe.latest ?? ""),
      precision: (pe.precision as "day" | "month" | "year" | "range") || "year",
      sources: Array.isArray(pe.sources) ? (pe.sources as readonly unknown[]) : undefined,
    };
  }

  // Category 2: Einstein Knowledge
  const claimsEinsteinKnew = Boolean(o.claimsEinsteinKnew);
  let einsteinKnowledgeEvidence: unknown[] | undefined;
  if (claimsEinsteinKnew) {
    if (!Array.isArray(o.einsteinKnowledgeEvidence) || o.einsteinKnowledgeEvidence.length === 0) {
      throw new ArgumentSchemaError(
        "missing-einstein-knowledge-evidence",
        "claimsEinsteinKnew: true requires non-empty einsteinKnowledgeEvidence array.",
        "HistoricalPremise",
        `${path}.einsteinKnowledgeEvidence`,
      );
    }
    einsteinKnowledgeEvidence = o.einsteinKnowledgeEvidence;
  }

  // Admitted Import validation
  let admittedImport: boolean | AdmittedImportInfo | undefined;
  if (typeof o.admittedImport === "boolean") {
    admittedImport = o.admittedImport;
  } else if (
    o.admittedImport &&
    typeof o.admittedImport === "object" &&
    !Array.isArray(o.admittedImport)
  ) {
    const ai = o.admittedImport as Record<string, unknown>;
    if (typeof ai.declaringJourney !== "string" || !ai.declaringJourney.trim()) {
      throw new ArgumentSchemaError(
        "admitted-import-missing-declaring-journey",
        "admittedImport object requires declaringJourney.",
        "HistoricalPremise",
        `${path}.admittedImport.declaringJourney`,
      );
    }
    admittedImport = {
      declaringJourney: ai.declaringJourney,
      sourceKey: typeof ai.sourceKey === "string" ? ai.sourceKey : undefined,
      anchor: typeof ai.anchor === "string" ? ai.anchor : undefined,
      provenance: typeof ai.provenance === "string" ? ai.provenance : undefined,
    };
  }

  if (admittedImport) {
    if (o.status !== "available") {
      throw new ArgumentSchemaError(
        "admitted-import-invalid-status",
        `Admitted import premise must have status: "available" (got "${o.status}").`,
        "HistoricalPremise",
        `${path}.status`,
      );
    }
    if (d.latestYear !== 1905) {
      throw new ArgumentSchemaError(
        "admitted-import-invalid-year",
        `Admitted import premise must have latestYear: 1905 (got ${d.latestYear}).`,
        "HistoricalPremise",
        `${path}.date.latestYear`,
      );
    }
  }

  // Verification validation
  let verification: PremiseVerification | undefined;
  if (o.verification && typeof o.verification === "object" && !Array.isArray(o.verification)) {
    const v = o.verification as Record<string, unknown>;
    if (typeof v.verifiedBy !== "string" || !v.verifiedBy.trim()) {
      throw new ArgumentSchemaError(
        "verified-premise-missing-verifier",
        "verification requires verifiedBy.",
        "HistoricalPremise",
        `${path}.verification.verifiedBy`,
      );
    }
    if (v.verifierKind !== "human" && v.verifierKind !== "agent") {
      throw new ArgumentSchemaError(
        "verified-premise-invalid-verifier-kind",
        `verifierKind must be "human" or "agent" (got "${v.verifierKind}").`,
        "HistoricalPremise",
        `${path}.verification.verifierKind`,
      );
    }
    if (typeof v.date !== "string" || !v.date.trim()) {
      throw new ArgumentSchemaError(
        "verified-premise-missing-date",
        "verification requires date.",
        "HistoricalPremise",
        `${path}.verification.date`,
      );
    }
    if (
      typeof v.method !== "string" ||
      !["library scan", "bound volume", "publisher facsimile", "comparison edition"].includes(
        v.method,
      )
    ) {
      throw new ArgumentSchemaError(
        "verified-premise-invalid-method",
        `verification method must be one of: "library scan", "bound volume", "publisher facsimile", "comparison edition".`,
        "HistoricalPremise",
        `${path}.verification.method`,
      );
    }
    if (typeof v.evidenceLocator !== "string" || !v.evidenceLocator.trim()) {
      throw new ArgumentSchemaError(
        "verified-premise-missing-locator",
        "verification requires evidenceLocator.",
        "HistoricalPremise",
        `${path}.verification.evidenceLocator`,
      );
    }
    verification = {
      verifiedBy: v.verifiedBy,
      verifierKind: v.verifierKind,
      date: v.date,
      method: v.method as VerificationMethod,
      evidenceLocator: v.evidenceLocator,
      printedCitation: typeof v.printedCitation === "string" ? v.printedCitation : undefined,
      discrepancies: Array.isArray(v.discrepancies) ? (v.discrepancies as string[]) : undefined,
      reviewRecordId: typeof v.reviewRecordId === "string" ? v.reviewRecordId : undefined,
    };
  }

  const verifier = typeof o.verifier === "string" ? o.verifier : undefined;
  const dateVerified =
    typeof o.dateVerified === "string"
      ? o.dateVerified
      : typeof o.dateVerifiedAt === "string"
        ? o.dateVerifiedAt
        : undefined;
  const evidenceLocator = typeof o.evidenceLocator === "string" ? o.evidenceLocator : undefined;

  if (verifier || dateVerified || evidenceLocator) {
    if (!verifier || (!dateVerified && !o.date) || !evidenceLocator) {
      throw new ArgumentSchemaError(
        "verified-premise-missing-locator",
        "Verified card requires verifier, date, and evidenceLocator.",
        "HistoricalPremise",
        `${path}.evidenceLocator`,
      );
    }
  }

  const authorship = validateAuthorshipBlock(o.authorship, `${path}.authorship`);
  let lang: string | undefined;
  if (o.lang !== undefined) {
    try {
      lang = validateLanguageTag(o.lang, `${path}.lang`);
    } catch (err) {
      throw new ArgumentSchemaError(
        "invalid-language-tag",
        err instanceof Error ? err.message : String(err),
        "HistoricalPremise",
        `${path}.lang`,
      );
    }
  }

  let dir: TextDirection | undefined;
  if (o.dir !== undefined) {
    try {
      dir = validateDirection(o.dir, `${path}.dir`);
    } catch (err) {
      throw new ArgumentSchemaError(
        "invalid-direction",
        err instanceof Error ? err.message : String(err),
        "HistoricalPremise",
        `${path}.dir`,
      );
    }
  }

  const reviewState = (o.reviewState as string) || "draft";

  return {
    id: o.id as string,
    proposition: o.proposition as string,
    status: o.status as PremiseStatus,
    sources: o.sources as unknown[],
    date: {
      earliest,
      latest,
      precision,
      latestYear: d.latestYear as number,
      ...(eventKind ? { eventKind } : {}),
    },
    claimsEinsteinKnew,
    limits: typeof o.limits === "string" ? o.limits : undefined,
    priorEvent,
    relatedCardId: typeof o.relatedCardId === "string" ? o.relatedCardId : undefined,
    parallelWorkBasis: typeof o.parallelWorkBasis === "string" ? o.parallelWorkBasis : undefined,
    einsteinKnowledgeEvidence,
    paperCitesOrAsserts: Array.isArray(o.paperCitesOrAsserts)
      ? (o.paperCitesOrAsserts as PaperCitationRef[])
      : undefined,
    admittedStages: Array.isArray(o.admittedStages) ? (o.admittedStages as string[]) : undefined,
    admittedImport,
    verification,
    verifier,
    dateVerified,
    evidenceLocator,
    authorship,
    reviewState,
    ...(lang ? { lang } : {}),
    ...(dir ? { dir } : {}),
  };
}

// ============================================================================
// 3. ArgumentNode & Proof
// ============================================================================

export type PremiseRef = Readonly<{
  kind: "argument" | "premise" | "equation" | "foundation";
  id: string;
}>;

export type PremiseEdge = Readonly<{
  ref: PremiseRef;
  edgeType: PremiseEdgeType;
}>;

export type EvidenceRef = Readonly<{
  kind: "dataset" | "premise" | "citation";
  id: string;
}>;

export type EvidenceEdge = Readonly<{
  ref: EvidenceRef;
  relation: EvidenceRelation;
  dateLabel?: string | undefined;
}>;

export type PrerequisiteRef = Readonly<{
  foundationId: string;
  kind: ProofEdgeKind;
}>;

export type CoverageTreatment =
  | Readonly<{
      kind: "instrument";
      experimentIds: readonly string[];
      correspondenceNote?: string | undefined;
    }>
  | Readonly<{ kind: "static"; description: string }>
  | Readonly<{ kind: "omitted"; reason: string }>;

export type CoverageObligation = Readonly<{
  question: string;
  observableResponse: string;
  mathematicalOwner: string;
  nonvisualEquivalent: string;
  treatment: CoverageTreatment;
}>;

export type ArgumentNode = Readonly<{
  id: string;
  paper: string;
  question: string;
  conclusion: string;
  logicalRole: LogicalRole;
  derivationChainId?: string | undefined;
  limitations: readonly string[];
  meanings: FourMeanings;
  premises: readonly PremiseEdge[];
  evidence: readonly EvidenceEdge[];
  sourceSupport: readonly Readonly<{ paper: string; id: string }>[];
  prerequisites: readonly PrerequisiteRef[];
  coverageObligation: CoverageObligation;
  recap?: string | undefined;
  authorship: AuthorshipBlock;
  reviewState: string;
}>;

export function validateArgumentNode(raw: unknown, path = "ArgumentNode"): ArgumentNode {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ArgumentSchemaError(
      "invalid-record",
      "ArgumentNode must be an object.",
      "ArgumentNode",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  if ("essentialForPrint" in o && o.essentialForPrint !== undefined) {
    throw new ArgumentSchemaError(
      "essential-for-print-rejected",
      "essentialForPrint is rejected on ArgumentNode; it is only allowed on ReadingSet and Misconception.",
      "ArgumentNode",
      `${path}.essentialForPrint`,
    );
  }

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new ArgumentSchemaError("missing-id", "id is required.", "ArgumentNode", `${path}.id`);
  }
  if (!o.id.startsWith("arg-")) {
    throw new ArgumentSchemaError(
      "invalid-argument-id",
      `Argument ID "${o.id}" must start with "arg-".`,
      "ArgumentNode",
      `${path}.id`,
    );
  }

  if (typeof o.paper !== "string" || !o.paper.trim()) {
    throw new ArgumentSchemaError(
      "missing-paper",
      "paper is required.",
      "ArgumentNode",
      `${path}.paper`,
    );
  }
  if (typeof o.question !== "string" || !o.question.trim()) {
    throw new ArgumentSchemaError(
      "missing-question",
      "question is required.",
      "ArgumentNode",
      `${path}.question`,
    );
  }
  if (typeof o.conclusion !== "string" || !o.conclusion.trim()) {
    throw new ArgumentSchemaError(
      "missing-conclusion",
      "conclusion is required.",
      "ArgumentNode",
      `${path}.conclusion`,
    );
  }

  if (!LOGICAL_ROLES.includes(o.logicalRole as LogicalRole)) {
    throw new ArgumentSchemaError(
      "invalid-logical-role",
      `Invalid logicalRole "${o.logicalRole}".`,
      "ArgumentNode",
      `${path}.logicalRole`,
    );
  }

  const meanings = validateMeanings(o.meanings, `${path}.meanings`, "ArgumentNode");

  // Validate premises
  const premises: PremiseEdge[] = [];
  if (Array.isArray(o.premises)) {
    for (let i = 0; i < o.premises.length; i++) {
      const p = o.premises[i] as Record<string, unknown>;
      const pPath = `${path}.premises[${i}]`;
      if (!p || typeof p !== "object")
        throw new ArgumentSchemaError(
          "invalid-premise",
          "Premise entry must be an object.",
          "ArgumentNode",
          pPath,
        );
      const ref = p.ref as Record<string, unknown>;
      if (
        !ref ||
        typeof ref.id !== "string" ||
        !["argument", "premise", "equation", "foundation"].includes(ref.kind as string)
      ) {
        throw new ArgumentSchemaError(
          "invalid-premise-ref",
          "Premise ref requires kind ('argument' | 'premise' | 'equation' | 'foundation') and id.",
          "ArgumentNode",
          `${pPath}.ref`,
        );
      }
      if (!PREMISE_EDGE_TYPES.includes(p.edgeType as PremiseEdgeType)) {
        throw new ArgumentSchemaError(
          "invalid-edge-type",
          `Invalid edgeType "${p.edgeType}". Expected one of: ${PREMISE_EDGE_TYPES.join(", ")}`,
          "ArgumentNode",
          `${pPath}.edgeType`,
        );
      }
      premises.push({
        ref: { kind: ref.kind as PremiseRef["kind"], id: ref.id as string },
        edgeType: p.edgeType as PremiseEdgeType,
      });
    }
  }

  // Validate evidence
  const evidence: EvidenceEdge[] = [];
  if (Array.isArray(o.evidence)) {
    for (let i = 0; i < o.evidence.length; i++) {
      const e = o.evidence[i] as Record<string, unknown>;
      const ePath = `${path}.evidence[${i}]`;
      if (!e || typeof e !== "object")
        throw new ArgumentSchemaError(
          "invalid-evidence",
          "Evidence entry must be an object.",
          "ArgumentNode",
          ePath,
        );
      const ref = e.ref as Record<string, unknown>;
      if (
        !ref ||
        typeof ref.id !== "string" ||
        !["dataset", "premise", "citation"].includes(ref.kind as string)
      ) {
        throw new ArgumentSchemaError(
          "invalid-evidence-ref",
          "Evidence ref requires kind ('dataset' | 'premise' | 'citation') and id.",
          "ArgumentNode",
          `${ePath}.ref`,
        );
      }
      if (!EVIDENCE_RELATIONS.includes(e.relation as EvidenceRelation)) {
        throw new ArgumentSchemaError(
          "invalid-evidence-relation",
          `Invalid evidence relation "${e.relation}".`,
          "ArgumentNode",
          `${ePath}.relation`,
        );
      }
      evidence.push({
        ref: { kind: ref.kind as EvidenceRef["kind"], id: ref.id as string },
        relation: e.relation as EvidenceRelation,
        dateLabel: typeof e.dateLabel === "string" ? e.dateLabel : undefined,
      });
    }
  }

  // Validate prerequisites
  const prerequisites: PrerequisiteRef[] = [];
  if (Array.isArray(o.prerequisites)) {
    for (let i = 0; i < o.prerequisites.length; i++) {
      const pr = o.prerequisites[i] as Record<string, unknown>;
      const prPath = `${path}.prerequisites[${i}]`;
      if (typeof pr === "string" || !pr || typeof pr !== "object") {
        throw new ArgumentSchemaError(
          "invalid-prerequisite-shape",
          "Prerequisite must be { foundationId, kind: 'proof-edge' | 'cross-link' }.",
          "ArgumentNode",
          prPath,
        );
      }
      if (typeof pr.foundationId !== "string" || !pr.foundationId.trim()) {
        throw new ArgumentSchemaError(
          "missing-prerequisite-foundation-id",
          "prerequisite requires foundationId.",
          "ArgumentNode",
          `${prPath}.foundationId`,
        );
      }
      if (!PROOF_EDGE_KINDS.includes(pr.kind as ProofEdgeKind)) {
        throw new ArgumentSchemaError(
          "invalid-prerequisite-kind",
          `Invalid prerequisite kind "${pr.kind}". Expected "proof-edge" or "cross-link".`,
          "ArgumentNode",
          `${prPath}.kind`,
        );
      }
      prerequisites.push({
        foundationId: pr.foundationId,
        kind: pr.kind as ProofEdgeKind,
      });
    }
  }

  // Validate coverage obligation
  const cov = o.coverageObligation as Record<string, unknown>;
  if (!cov || typeof cov !== "object") {
    throw new ArgumentSchemaError(
      "missing-coverage-obligation",
      "coverageObligation object is required.",
      "ArgumentNode",
      `${path}.coverageObligation`,
    );
  }
  const treat = cov.treatment as Record<string, unknown>;
  if (!treat || typeof treat !== "object") {
    throw new ArgumentSchemaError(
      "missing-coverage-treatment",
      "coverageObligation.treatment object is required.",
      "ArgumentNode",
      `${path}.coverageObligation.treatment`,
    );
  }

  let treatment: CoverageTreatment;
  if (treat.kind === "instrument") {
    if (!Array.isArray(treat.experimentIds) || treat.experimentIds.length === 0) {
      throw new ArgumentSchemaError(
        "missing-experiment-ids",
        "treatment of kind 'instrument' requires non-empty experimentIds.",
        "ArgumentNode",
        `${path}.coverageObligation.treatment.experimentIds`,
      );
    }
    treatment = {
      kind: "instrument",
      experimentIds: treat.experimentIds as string[],
      correspondenceNote:
        typeof treat.correspondenceNote === "string" ? treat.correspondenceNote : undefined,
    };
  } else if (treat.kind === "static") {
    if (typeof treat.description !== "string" || !treat.description.trim()) {
      throw new ArgumentSchemaError(
        "missing-static-description",
        "treatment of kind 'static' requires description.",
        "ArgumentNode",
        `${path}.coverageObligation.treatment.description`,
      );
    }
    treatment = { kind: "static", description: treat.description };
  } else if (treat.kind === "omitted") {
    if (typeof treat.reason !== "string" || !treat.reason.trim()) {
      throw new ArgumentSchemaError(
        "omitted-treatment-missing-reason",
        "Coverage treatment of kind 'omitted' requires a non-empty reason.",
        "ArgumentNode",
        `${path}.coverageObligation.treatment.reason`,
      );
    }
    treatment = { kind: "omitted", reason: treat.reason };
  } else {
    throw new ArgumentSchemaError(
      "invalid-treatment-kind",
      `Invalid treatment kind "${treat.kind}".`,
      "ArgumentNode",
      `${path}.coverageObligation.treatment.kind`,
    );
  }

  const coverageObligation: CoverageObligation = {
    question: (cov.question as string) || (o.question as string),
    observableResponse: (cov.observableResponse as string) || "",
    mathematicalOwner: (cov.mathematicalOwner as string) || "",
    nonvisualEquivalent: (cov.nonvisualEquivalent as string) || "",
    treatment,
  };

  // Recap validation
  let recap: string | undefined;
  if (o.recap !== undefined) {
    if (typeof o.recap !== "string") {
      throw new ArgumentSchemaError(
        "invalid-recap-type",
        "recap must be a string.",
        "ArgumentNode",
        `${path}.recap`,
      );
    }
    if (o.recap.trim().length === 0) {
      throw new ArgumentSchemaError(
        "empty-recap",
        "Authored recap cannot be an empty string.",
        "ArgumentNode",
        `${path}.recap`,
      );
    }
    recap = o.recap;
  }

  const authorship = validateAuthorshipBlock(o.authorship, `${path}.authorship`);
  const reviewState = (o.reviewState as string) || "draft";

  return {
    id: o.id,
    paper: o.paper,
    question: o.question,
    conclusion: o.conclusion,
    logicalRole: o.logicalRole as LogicalRole,
    derivationChainId: typeof o.derivationChainId === "string" ? o.derivationChainId : undefined,
    limitations: Array.isArray(o.limitations) ? (o.limitations as string[]) : [],
    meanings,
    premises,
    evidence,
    sourceSupport: Array.isArray(o.sourceSupport)
      ? (o.sourceSupport as { paper: string; id: string }[])
      : [],
    prerequisites,
    coverageObligation,
    recap,
    authorship,
    reviewState,
  };
}

export type Proof = Readonly<{
  id: string;
  argumentNodeIds: readonly string[];
  orderedSteps: readonly string[];
  entryAssumptions: readonly string[];
  moveTypes: readonly string[];
  sourceMapping: readonly Readonly<{ paper: string; id: string }>[];
  route: ProofRoute;
}>;

export function validateProof(raw: unknown, path = "Proof"): Proof {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ArgumentSchemaError("invalid-record", "Proof must be an object.", "Proof", path);
  }
  const o = raw as Record<string, unknown>;

  if ("essentialForPrint" in o && o.essentialForPrint !== undefined) {
    throw new ArgumentSchemaError(
      "essential-for-print-rejected",
      "essentialForPrint is rejected on Proof; it is only allowed on ReadingSet and Misconception.",
      "Proof",
      `${path}.essentialForPrint`,
    );
  }

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new ArgumentSchemaError("missing-id", "Proof id is required.", "Proof", `${path}.id`);
  }
  if (!PROOF_ROUTES.includes(o.route as ProofRoute)) {
    throw new ArgumentSchemaError(
      "invalid-proof-route",
      `Invalid proof route "${o.route}". Expected one of: ${PROOF_ROUTES.join(", ")}`,
      "Proof",
      `${path}.route`,
    );
  }

  if (
    !Array.isArray(o.argumentNodeIds) ||
    !o.argumentNodeIds.every((id) => typeof id === "string" && id.trim().length > 0)
  ) {
    throw new ArgumentSchemaError(
      "invalid-argument-nodes",
      "Proof argumentNodeIds must be an array of non-empty strings.",
      "Proof",
      `${path}.argumentNodeIds`,
    );
  }

  return {
    id: o.id.trim(),
    argumentNodeIds: o.argumentNodeIds as string[],
    orderedSteps: Array.isArray(o.orderedSteps) ? (o.orderedSteps as string[]) : [],
    entryAssumptions: Array.isArray(o.entryAssumptions) ? (o.entryAssumptions as string[]) : [],
    moveTypes: Array.isArray(o.moveTypes) ? (o.moveTypes as string[]) : [],
    sourceMapping: Array.isArray(o.sourceMapping)
      ? (o.sourceMapping as { paper: string; id: string }[])
      : [],
    route: o.route as ProofRoute,
  };
}

// ============================================================================
// 4. Quantity
// ============================================================================

export type PermittedUnit = Readonly<{
  unit: string;
  factor?: RationalScale | number | undefined;
}>;

export type Quantity = Readonly<{
  id: string;
  name: string;
  description: string;
  dimensionStatus: DimensionStatus;
  dimension?: RationalDimension | undefined;
  dimensionNote?: string | undefined;
  isConstant?: boolean | undefined;
  gaussianDimension?: RationalDimension | undefined;
  emuDimension?: RationalDimension | undefined;
  mathematicalKind: MathematicalKind;
  densityKind: DensityKind;
  densityPer?: readonly DensityPerKind[] | undefined;
  spectralBasis?: SpectralBasis | undefined;
  frequencyKind?: FrequencyKind | undefined;
  timeKind?: TimeKind | undefined;
  frame?: Frame | undefined;
  observation?: ObservationKind | undefined;
  modelArtifact?: boolean | undefined;
  artifactNote?: string | undefined;
  statistic?: Statistic | undefined;
  dimensionlessKind?: DimensionlessKind | undefined;
  representationFields?: readonly string[] | undefined;
  referenceConditions?: string | undefined;
  permittedUnits?: readonly PermittedUnit[] | undefined;
  formatting?: string | undefined;
  colorRole?: ColorRole | undefined;
}>;

export function validateQuantity(
  raw: unknown,
  path = "Quantity",
  registeredQuantityIds: readonly string[] = [],
): Quantity {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ArgumentSchemaError(
      "invalid-record",
      "Quantity must be an object.",
      "Quantity",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  if ("essentialForPrint" in o && o.essentialForPrint !== undefined) {
    throw new ArgumentSchemaError(
      "essential-for-print-rejected",
      "essentialForPrint is rejected on Quantity; it is only allowed on ReadingSet and Misconception.",
      "Quantity",
      `${path}.essentialForPrint`,
    );
  }

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new ArgumentSchemaError("missing-id", "id is required.", "Quantity", `${path}.id`);
  }
  const idResult = parseQuantityId(o.id);
  if (!idResult.ok) {
    throw new ArgumentSchemaError(
      idResult.rule || "invalid-quantity-id",
      idResult.error,
      "Quantity",
      `${path}.id`,
    );
  }

  if (typeof o.name !== "string" || !o.name.trim()) {
    throw new ArgumentSchemaError("missing-name", "name is required.", "Quantity", `${path}.name`);
  }
  if (typeof o.description !== "string" || !o.description.trim()) {
    throw new ArgumentSchemaError(
      "missing-description",
      "description is required.",
      "Quantity",
      `${path}.description`,
    );
  }

  const dimensionStatus = (o.dimensionStatus as DimensionStatus) || "declared";
  if (!DIMENSION_STATUSES.includes(dimensionStatus)) {
    throw new ArgumentSchemaError(
      "invalid-dimension-status",
      `Invalid dimensionStatus "${o.dimensionStatus}".`,
      "Quantity",
      `${path}.dimensionStatus`,
    );
  }

  let dimension: RationalDimension | undefined;
  let dimensionNote: string | undefined = sourceUndefinedDimensionNote(o, dimensionStatus, path);
  const isConstant = typeof o.isConstant === "boolean" ? o.isConstant : undefined;

  if (dimensionStatus === "state-dependent") {
    if (o.dimension !== undefined) {
      throw new ArgumentSchemaError(
        "state-dependent-dimension-declared",
        "A state-dependent quantity must not declare a dimension vector.",
        "Quantity",
        `${path}.dimension`,
      );
    }
    if (typeof o.dimensionNote !== "string" || !o.dimensionNote.trim()) {
      throw new ArgumentSchemaError(
        "missing-dimension-note",
        "A state-dependent quantity requires a non-empty dimensionNote.",
        "Quantity",
        `${path}.dimensionNote`,
      );
    }
    dimensionNote = o.dimensionNote;
    if (isConstant === true) {
      throw new ArgumentSchemaError(
        "state-dependent-cannot-be-constant",
        "A state-dependent quantity cannot have isConstant: true.",
        "Quantity",
        `${path}.isConstant`,
      );
    }
  } else if (dimensionStatus !== "undefined-in-source") {
    // Declared dimension
    if (o.dimension === undefined) {
      throw new ArgumentSchemaError(
        "missing-dimension",
        "dimension is required for declared quantities.",
        "Quantity",
        `${path}.dimension`,
      );
    }
    dimension = validateRationalDimension(o.dimension, `${path}.dimension`, false);
  }

  // Gaussian & EMU CGS dimensions
  let gaussianDimension: RationalDimension | undefined;
  if (o.gaussianDimension !== undefined) {
    gaussianDimension = validateRationalDimension(
      o.gaussianDimension,
      `${path}.gaussianDimension`,
      true,
    );
  }

  let emuDimension: RationalDimension | undefined;
  if (o.emuDimension !== undefined) {
    emuDimension = validateRationalDimension(o.emuDimension, `${path}.emuDimension`, true);
  }

  // Mathematical & density kinds
  if (!MATHEMATICAL_KINDS.includes(o.mathematicalKind as MathematicalKind)) {
    throw new ArgumentSchemaError(
      "invalid-mathematical-kind",
      `Invalid mathematicalKind "${o.mathematicalKind}".`,
      "Quantity",
      `${path}.mathematicalKind`,
    );
  }
  const mathematicalKind = o.mathematicalKind as MathematicalKind;

  const densityKind = (o.densityKind as DensityKind) || "not-applicable";
  if (!DENSITY_KINDS.includes(densityKind)) {
    throw new ArgumentSchemaError(
      "invalid-density-kind",
      `Invalid densityKind "${o.densityKind}".`,
      "Quantity",
      `${path}.densityKind`,
    );
  }

  let densityPer: DensityPerKind[] | undefined;
  if (densityKind === "density") {
    if (!Array.isArray(o.densityPer) || o.densityPer.length === 0) {
      throw new ArgumentSchemaError(
        "missing-density-per",
        "densityKind: 'density' requires non-empty densityPer array.",
        "Quantity",
        `${path}.densityPer`,
      );
    }
    densityPer = o.densityPer.map((dp, i) => {
      if (!DENSITY_PER_KINDS.includes(dp as DensityPerKind)) {
        throw new ArgumentSchemaError(
          "invalid-density-per-item",
          `Invalid densityPer item "${dp}".`,
          "Quantity",
          `${path}.densityPer[${i}]`,
        );
      }
      return dp as DensityPerKind;
    });
  }

  // Semantic distinctions
  const spectralBasis = o.spectralBasis as SpectralBasis | undefined;
  if (spectralBasis && !SPECTRAL_BASES.includes(spectralBasis)) {
    throw new ArgumentSchemaError(
      "invalid-spectral-basis",
      `Invalid spectralBasis "${spectralBasis}".`,
      "Quantity",
      `${path}.spectralBasis`,
    );
  }

  const frequencyKind = o.frequencyKind as FrequencyKind | undefined;
  if (frequencyKind && !FREQUENCY_KINDS.includes(frequencyKind)) {
    throw new ArgumentSchemaError(
      "invalid-frequency-kind",
      `Invalid frequencyKind "${frequencyKind}".`,
      "Quantity",
      `${path}.frequencyKind`,
    );
  }

  const timeKind = o.timeKind as TimeKind | undefined;
  if (timeKind && !TIME_KINDS.includes(timeKind)) {
    throw new ArgumentSchemaError(
      "invalid-time-kind",
      `Invalid timeKind "${timeKind}".`,
      "Quantity",
      `${path}.timeKind`,
    );
  }

  const frame = o.frame as Frame | undefined;
  if (frame && !FRAMES.includes(frame)) {
    throw new ArgumentSchemaError(
      "invalid-frame",
      `Invalid frame "${frame}". Expected one of: ${FRAMES.join(", ")}`,
      "Quantity",
      `${path}.frame`,
    );
  }

  const observation = o.observation as ObservationKind | undefined;
  if (observation && !OBSERVATION_KINDS.includes(observation)) {
    throw new ArgumentSchemaError(
      "invalid-observation",
      `Invalid observation "${observation}".`,
      "Quantity",
      `${path}.observation`,
    );
  }

  const modelArtifact = typeof o.modelArtifact === "boolean" ? o.modelArtifact : undefined;
  let artifactNote: string | undefined;
  if (modelArtifact) {
    if (typeof o.artifactNote !== "string" || !o.artifactNote.trim()) {
      throw new ArgumentSchemaError(
        "missing-artifact-note",
        "modelArtifact: true requires artifactNote.",
        "Quantity",
        `${path}.artifactNote`,
      );
    }
    artifactNote = o.artifactNote;
  }

  const statistic = o.statistic as Statistic | undefined;
  if (statistic) {
    if (!STATISTICS.includes(statistic)) {
      throw new ArgumentSchemaError(
        "invalid-statistic",
        `Invalid statistic "${statistic}". Enum values must be kebab-case.`,
        "Quantity",
        `${path}.statistic`,
      );
    }
  }

  // Dimensionless check
  const dimensionlessKind = o.dimensionlessKind as DimensionlessKind | undefined;
  if (dimension && isDimensionless(dimension)) {
    if (!dimensionlessKind || !DIMENSIONLESS_KINDS.includes(dimensionlessKind)) {
      throw new ArgumentSchemaError(
        "missing-dimensionless-kind",
        `Dimensionless quantity requires dimensionlessKind. Expected one of: ${DIMENSIONLESS_KINDS.join(", ")}`,
        "Quantity",
        `${path}.dimensionlessKind`,
      );
    }
  }

  // Representation fields
  let representationFields: string[] | undefined;
  if (Array.isArray(o.representationFields)) {
    representationFields = [];
    for (let i = 0; i < o.representationFields.length; i++) {
      const rep = o.representationFields[i];
      if (typeof rep !== "string")
        throw new ArgumentSchemaError(
          "invalid-representation-field",
          "Representation field must be a string.",
          "Quantity",
          `${path}.representationFields[${i}]`,
        );
      if (rep === o.id || registeredQuantityIds.includes(rep)) {
        throw new ArgumentSchemaError(
          "representation-field-shadows-id",
          `Representation field "${rep}" shadows an existing quantity ID.`,
          "Quantity",
          `${path}.representationFields[${i}]`,
        );
      }
      representationFields.push(rep);
    }
  }

  const colorRole = o.colorRole as ColorRole | undefined;
  if (colorRole && !COLOR_ROLES.includes(colorRole)) {
    throw new ArgumentSchemaError(
      "invalid-color-role",
      `Invalid colorRole "${colorRole}".`,
      "Quantity",
      `${path}.colorRole`,
    );
  }

  return {
    id: o.id as string,
    name: o.name as string,
    description: o.description as string,
    dimensionStatus,
    dimension,
    dimensionNote,
    isConstant,
    gaussianDimension,
    emuDimension,
    mathematicalKind,
    densityKind,
    densityPer,
    spectralBasis,
    frequencyKind,
    timeKind,
    frame,
    observation,
    modelArtifact,
    artifactNote,
    statistic,
    dimensionlessKind,
    representationFields,
    referenceConditions:
      typeof o.referenceConditions === "string" ? o.referenceConditions : undefined,
    permittedUnits: Array.isArray(o.permittedUnits)
      ? (o.permittedUnits as PermittedUnit[])
      : undefined,
    formatting: typeof o.formatting === "string" ? o.formatting : undefined,
    colorRole,
  };
}

// ============================================================================
// 5. Equation & SemanticEquation
// ============================================================================

export type NotationForm = Readonly<{
  mode: NotationMode;
  unitSystem: UnitSystem;
  latex?: string | undefined;
  termBindings?: readonly string[] | undefined;
}>;

export type EquationTermBinding = Readonly<{
  termId: string;
  quantityId: string;
  scale?: RationalScale | undefined;
  component?: "x" | "y" | "z" | undefined;
  role: string;
  colorRole?: ColorRole | undefined;
}>;

export type EquationOperation = Readonly<{
  opId: string;
  kind: string;
  explanation: string;
}>;

export type SemanticEquation = Readonly<{
  id: string;
  paper: string;
  tree: unknown;
  modernTree?: unknown | undefined;
  modernRelation?: ModernRelation | undefined;
  notationForms: Readonly<{ source: NotationForm; modern: NotationForm }>;
  terms: readonly EquationTermBinding[];
  operations: readonly EquationOperation[];
  derivationLinks?:
    | Readonly<{ chainIds: readonly string[]; usedBy: readonly string[] }>
    | undefined;
  numericalBindings?:
    | readonly Readonly<{ termId: string; experimentId: string; outputId: string }>[]
    | undefined;
  spokenForm: string;
  readings: string;
  meanings: FourMeanings;
  authorship: AuthorshipBlock;
  layout?: LayoutHints | undefined;
  groups?: readonly CompositeGroup[] | undefined;
  alternateForms?: readonly AlternateForm[] | undefined;
}>;

export function validateSemanticEquation(raw: unknown, path = "Equation"): SemanticEquation {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ArgumentSchemaError(
      "invalid-record",
      "Equation must be an object.",
      "Equation",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  if ("essentialForPrint" in o && o.essentialForPrint !== undefined) {
    throw new ArgumentSchemaError(
      "essential-for-print-rejected",
      "essentialForPrint is rejected on Equation; it is only allowed on ReadingSet and Misconception.",
      "Equation",
      `${path}.essentialForPrint`,
    );
  }

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new ArgumentSchemaError("missing-id", "id is required.", "Equation", `${path}.id`);
  }
  const idResult = parseEquationRecordId(o.id);
  if (!idResult.ok) {
    throw new ArgumentSchemaError(
      idResult.rule || "invalid-equation-id",
      idResult.error,
      "Equation",
      `${path}.id`,
    );
  }

  if (typeof o.paper !== "string" || !o.paper.trim()) {
    throw new ArgumentSchemaError(
      "missing-paper",
      "paper is required.",
      "Equation",
      `${path}.paper`,
    );
  }

  // Spoken form is REQUIRED and non-empty
  if (typeof o.spokenForm !== "string" || !o.spokenForm.trim()) {
    throw new ArgumentSchemaError(
      "missing-spoken-form",
      "Authored spokenForm is required and cannot be empty.",
      "Equation",
      `${path}.spokenForm`,
    );
  }

  // Modern relation required if modernTree exists
  if (o.modernTree !== undefined) {
    if (!o.modernRelation || !MODERN_RELATIONS.includes(o.modernRelation as ModernRelation)) {
      throw new ArgumentSchemaError(
        "missing-modern-relation",
        `modernTree is present; modernRelation is required ('rename-only' | 'unit-conversion' | 'modernization').`,
        "Equation",
        `${path}.modernRelation`,
      );
    }
  }

  // Notation forms
  const nf = o.notationForms as Record<string, unknown>;
  if (!nf || typeof nf !== "object") {
    throw new ArgumentSchemaError(
      "missing-notation-forms",
      "notationForms object is required with source and modern entries.",
      "Equation",
      `${path}.notationForms`,
    );
  }

  function validateNotationForm(formRaw: unknown, fPath: string): NotationForm {
    if (!formRaw || typeof formRaw !== "object")
      throw new ArgumentSchemaError(
        "invalid-notation-form",
        "Notation form must be an object.",
        "Equation",
        fPath,
      );
    const form = formRaw as Record<string, unknown>;
    if (!NOTATION_MODES.includes(form.mode as NotationMode)) {
      throw new ArgumentSchemaError(
        "invalid-notation-mode",
        `Invalid mode "${form.mode}".`,
        "Equation",
        `${fPath}.mode`,
      );
    }
    if (!UNIT_SYSTEMS.includes(form.unitSystem as UnitSystem)) {
      throw new ArgumentSchemaError(
        "invalid-unit-system",
        `Invalid unitSystem "${form.unitSystem}".`,
        "Equation",
        `${fPath}.unitSystem`,
      );
    }
    if (form.mode === "authored") {
      if (typeof form.latex !== "string" || !form.latex.trim()) {
        throw new ArgumentSchemaError(
          "authored-notation-missing-latex",
          "Authored notation form requires latex.",
          "Equation",
          `${fPath}.latex`,
        );
      }
      if (!Array.isArray(form.termBindings) || form.termBindings.length === 0) {
        throw new ArgumentSchemaError(
          "authored-notation-missing-bindings",
          "Authored notation form requires termBindings array.",
          "Equation",
          `${fPath}.termBindings`,
        );
      }
    }
    return {
      mode: form.mode as NotationMode,
      unitSystem: form.unitSystem as UnitSystem,
      latex: typeof form.latex === "string" ? form.latex : undefined,
      termBindings: Array.isArray(form.termBindings) ? (form.termBindings as string[]) : undefined,
    };
  }

  const sourceForm = validateNotationForm(nf.source, `${path}.notationForms.source`);
  const modernForm = validateNotationForm(nf.modern, `${path}.notationForms.modern`);

  // Validate terms
  const terms: EquationTermBinding[] = [];
  if (Array.isArray(o.terms)) {
    for (let i = 0; i < o.terms.length; i++) {
      const t = o.terms[i] as Record<string, unknown>;
      const tPath = `${path}.terms[${i}]`;
      if (!t || typeof t !== "object")
        throw new ArgumentSchemaError("invalid-term", "Term must be an object.", "Equation", tPath);
      if (typeof t.termId !== "string" || !t.termId.trim())
        throw new ArgumentSchemaError(
          "missing-term-id",
          "termId is required.",
          "Equation",
          `${tPath}.termId`,
        );
      if (typeof t.quantityId !== "string" || !t.quantityId.trim())
        throw new ArgumentSchemaError(
          "missing-quantity-id",
          "quantityId is required.",
          "Equation",
          `${tPath}.quantityId`,
        );

      let scale: RationalScale | undefined;
      if (t.scale !== undefined) {
        scale = validateRationalScale(t.scale, `${tPath}.scale`, false);
      }

      let component: "x" | "y" | "z" | undefined;
      if (t.component !== undefined) {
        if (!["x", "y", "z"].includes(t.component as string)) {
          throw new ArgumentSchemaError(
            "invalid-component",
            `Invalid component "${t.component}". Expected x, y, or z.`,
            "Equation",
            `${tPath}.component`,
          );
        }
        component = t.component as "x" | "y" | "z";
      }

      terms.push({
        termId: t.termId,
        quantityId: t.quantityId,
        scale,
        component,
        role: (t.role as string) || "symbol",
        colorRole: t.colorRole as ColorRole | undefined,
      });
    }
  }

  // Operations
  const operations: EquationOperation[] = [];
  if (Array.isArray(o.operations)) {
    for (let i = 0; i < o.operations.length; i++) {
      const op = o.operations[i] as Record<string, unknown>;
      const opPath = `${path}.operations[${i}]`;
      if (!op || typeof op !== "object")
        throw new ArgumentSchemaError(
          "invalid-op",
          "Operation must be an object.",
          "Equation",
          opPath,
        );
      operations.push({
        opId: (op.opId as string) || `op-${i + 1}`,
        kind: (op.kind as string) || "step",
        explanation: (op.explanation as string) || "",
      });
    }
  }

  const meanings = validateMeanings(o.meanings, `${path}.meanings`, "Equation");
  const authorship = validateAuthorshipBlock(o.authorship, `${path}.authorship`);

  let alternateForms: AlternateForm[] | undefined;
  if (o.alternateForms !== undefined) {
    if (!Array.isArray(o.alternateForms)) {
      throw new ArgumentSchemaError(
        "invalid-alternate-forms",
        "alternateForms must be an array.",
        "Equation",
        `${path}.alternateForms`,
      );
    }
    alternateForms = o.alternateForms.map((af, i) =>
      validateAlternateForm(af, `${path}.alternateForms[${i}]`),
    );
  }

  let layout: LayoutHints | undefined;
  if (o.layout !== undefined) {
    layout = validateLayoutHints(o.layout, `${path}.layout`);
  }

  let groups: CompositeGroup[] | undefined;
  if (o.groups !== undefined) {
    if (!Array.isArray(o.groups)) {
      throw new ArgumentSchemaError(
        "invalid-groups",
        "groups must be an array.",
        "Equation",
        `${path}.groups`,
      );
    }
    groups = o.groups.map((g, i) => validateCompositeGroup(g, `${path}.groups[${i}]`));
  }

  return {
    id: o.id as string,
    paper: o.paper as string,
    tree: o.tree,
    modernTree: o.modernTree,
    modernRelation: o.modernRelation as ModernRelation | undefined,
    notationForms: { source: sourceForm, modern: modernForm },
    terms,
    operations,
    derivationLinks: o.derivationLinks as SemanticEquation["derivationLinks"],
    numericalBindings: o.numericalBindings as SemanticEquation["numericalBindings"],
    spokenForm: o.spokenForm as string,
    readings: (o.readings as string) || `rs-${o.id}`,
    meanings,
    authorship,
    layout,
    groups,
    alternateForms,
  };
}

// ============================================================================
// 6. FoundationLink, WorkedExample, Foundation, and Bridge
// ============================================================================

export type FoundationLink = Readonly<{
  foundationId: string;
  callingAnchor: string;
  returnCaption?: string | undefined;
}>;

export function validateFoundationLink(raw: unknown, path = "FoundationLink"): FoundationLink {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ArgumentSchemaError(
      "invalid-record",
      "FoundationLink must be an object.",
      "FoundationLink",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  if ("essentialForPrint" in o && o.essentialForPrint !== undefined) {
    throw new ArgumentSchemaError(
      "essential-for-print-rejected",
      "essentialForPrint is rejected on FoundationLink; it is only allowed on ReadingSet and Misconception.",
      "FoundationLink",
      `${path}.essentialForPrint`,
    );
  }

  if (typeof o.foundationId !== "string" || !o.foundationId.trim()) {
    throw new ArgumentSchemaError(
      "missing-foundation-id",
      "foundationId is required.",
      "FoundationLink",
      `${path}.foundationId`,
    );
  }
  if (typeof o.callingAnchor !== "string" || !o.callingAnchor.trim()) {
    throw new ArgumentSchemaError(
      "missing-calling-anchor",
      "callingAnchor is required.",
      "FoundationLink",
      `${path}.callingAnchor`,
    );
  }
  return {
    foundationId: o.foundationId,
    callingAnchor: o.callingAnchor,
    returnCaption: typeof o.returnCaption === "string" ? o.returnCaption : undefined,
  };
}

export type WorkedExample = Readonly<{
  question: string;
  given: string;
  plausibleFirstThought: string;
  decisiveStep: string;
  limitation: string;
}>;

export function validateWorkedExample(raw: unknown, path = "workedExample"): WorkedExample {
  if (typeof raw === "string" || !raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ArgumentSchemaError(
      "worked-example-not-object",
      "WorkedExample must be an object with the 5 required parts: question, given, plausibleFirstThought, decisiveStep, limitation.",
      "WorkedExample",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  if ("essentialForPrint" in o && o.essentialForPrint !== undefined) {
    throw new ArgumentSchemaError(
      "essential-for-print-rejected",
      "essentialForPrint is rejected on WorkedExample; it is only allowed on ReadingSet and Misconception.",
      "WorkedExample",
      `${path}.essentialForPrint`,
    );
  }

  const parts = [
    "question",
    "given",
    "plausibleFirstThought",
    "decisiveStep",
    "limitation",
  ] as const;

  for (const part of parts) {
    if (typeof o[part] !== "string" || !(o[part] as string).trim()) {
      throw new ArgumentSchemaError(
        "missing-worked-example-part",
        `WorkedExample requires non-empty "${part}".`,
        "WorkedExample",
        `${path}.${part}`,
      );
    }
  }

  return {
    question: o.question as string,
    given: o.given as string,
    plausibleFirstThought: o.plausibleFirstThought as string,
    decisiveStep: o.decisiveStep as string,
    limitation: o.limitation as string,
  };
}

export type ReturnCaption = Readonly<{
  callingAnchor: string;
  caption: string;
}>;

export type Foundation = Readonly<{
  id: string;
  kind: "foundation";
  title: string;
  learningObjective: string;
  compactExplanation: string;
  fullExplanation: string;
  workedExample: WorkedExample;
  textualEquivalent: string;
  prerequisites: readonly PrerequisiteRef[];
  stoppingPoint: string;
  returnCaptions: readonly ReturnCaption[];
  instrumentOrConstruction?: string | undefined;
  authorship: AuthorshipBlock;
  reviewState: string;
  lang?: string | undefined;
  dir?: TextDirection | undefined;
}>;

export type BridgeContinueWith = Readonly<{
  route: ContinueWithRoute;
  targetId: string;
}>;

export type Bridge = Readonly<{
  id: string;
  kind: "bridge";
  title: string;
  concreteOperation: string;
  compactExplanation: string;
  textualEquivalent: string;
  stoppingPoint: string;
  readinessSign: string;
  returnCaptions: readonly ReturnCaption[];
  workedExample?: WorkedExample | undefined;
  instrumentOrConstruction?: string | undefined;
  continueWith?: readonly BridgeContinueWith[] | undefined;
  newSkill?: string | undefined;
  whyUsefulHere?: string | undefined;
  authorship: AuthorshipBlock;
  reviewState: string;
  lang?: string | undefined;
  dir?: TextDirection | undefined;
}>;

export function validateFoundationOrBridge(raw: unknown, path = "Foundation"): Foundation | Bridge {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ArgumentSchemaError(
      "invalid-record",
      "Foundation/Bridge must be an object.",
      "Foundation",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  if ("essentialForPrint" in o && o.essentialForPrint !== undefined) {
    throw new ArgumentSchemaError(
      "essential-for-print-rejected",
      "essentialForPrint is rejected on Foundation/Bridge; it is only allowed on ReadingSet and Misconception.",
      "Foundation",
      `${path}.essentialForPrint`,
    );
  }

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new ArgumentSchemaError("missing-id", "id is required.", "Foundation", `${path}.id`);
  }
  if (typeof o.title !== "string" || !o.title.trim()) {
    throw new ArgumentSchemaError(
      "missing-title",
      "title is required.",
      "Foundation",
      `${path}.title`,
    );
  }

  if (o.backlinks !== undefined) {
    throw new ArgumentSchemaError(
      "authored-backlinks-forbidden",
      "Authored backlinks are forbidden; backlinks are computed by the compiler.",
      "Foundation",
      `${path}.backlinks`,
    );
  }

  const kind = o.kind as FoundationKind;
  if (!FOUNDATION_KINDS.includes(kind)) {
    throw new ArgumentSchemaError(
      "invalid-kind",
      `Invalid kind "${o.kind}". Expected "foundation" or "bridge".`,
      "Foundation",
      `${path}.kind`,
    );
  }

  // Return captions
  const returnCaptions: ReturnCaption[] = [];
  if (Array.isArray(o.returnCaptions)) {
    for (let i = 0; i < o.returnCaptions.length; i++) {
      const rc = o.returnCaptions[i] as Record<string, unknown>;
      const rcPath = `${path}.returnCaptions[${i}]`;
      if (!rc || typeof rc.callingAnchor !== "string" || typeof rc.caption !== "string") {
        throw new ArgumentSchemaError(
          "invalid-return-caption",
          "returnCaption requires callingAnchor and caption.",
          "Foundation",
          rcPath,
        );
      }
      returnCaptions.push({ callingAnchor: rc.callingAnchor, caption: rc.caption });
    }
  }

  const authorship = validateAuthorshipBlock(o.authorship, `${path}.authorship`);
  const reviewState = (o.reviewState as string) || "draft";

  if (kind === "foundation") {
    if (typeof o.learningObjective !== "string" || !o.learningObjective.trim()) {
      throw new ArgumentSchemaError(
        "missing-learning-objective",
        "learningObjective is required.",
        "Foundation",
        `${path}.learningObjective`,
      );
    }
    if (typeof o.compactExplanation !== "string" || !o.compactExplanation.trim()) {
      throw new ArgumentSchemaError(
        "missing-compact-explanation",
        "compactExplanation is required.",
        "Foundation",
        `${path}.compactExplanation`,
      );
    }
    if (typeof o.fullExplanation !== "string" || !o.fullExplanation.trim()) {
      throw new ArgumentSchemaError(
        "missing-full-explanation",
        "fullExplanation is required.",
        "Foundation",
        `${path}.fullExplanation`,
      );
    }
    if (typeof o.textualEquivalent !== "string" || !o.textualEquivalent.trim()) {
      throw new ArgumentSchemaError(
        "missing-textual-equivalent",
        "textualEquivalent is required.",
        "Foundation",
        `${path}.textualEquivalent`,
      );
    }
    if (typeof o.stoppingPoint !== "string" || !o.stoppingPoint.trim()) {
      throw new ArgumentSchemaError(
        "missing-stopping-point",
        "stoppingPoint is required.",
        "Foundation",
        `${path}.stoppingPoint`,
      );
    }

    const workedExample = validateWorkedExample(o.workedExample, `${path}.workedExample`);

    const prerequisites: PrerequisiteRef[] = [];
    if (Array.isArray(o.prerequisites)) {
      for (let i = 0; i < o.prerequisites.length; i++) {
        const pr = o.prerequisites[i] as Record<string, unknown>;
        const prPath = `${path}.prerequisites[${i}]`;
        if (typeof pr === "string" || !pr || typeof pr !== "object") {
          throw new ArgumentSchemaError(
            "invalid-prerequisite-shape",
            "Prerequisite must be { foundationId, kind: 'proof-edge' | 'cross-link' }.",
            "Foundation",
            prPath,
          );
        }
        if (!PROOF_EDGE_KINDS.includes(pr.kind as ProofEdgeKind)) {
          throw new ArgumentSchemaError(
            "invalid-prerequisite-kind",
            `Invalid prerequisite kind "${pr.kind}".`,
            "Foundation",
            `${prPath}.kind`,
          );
        }
        prerequisites.push({
          foundationId: pr.foundationId as string,
          kind: pr.kind as ProofEdgeKind,
        });
      }
    }

    let lang: string | undefined;
    if (o.lang !== undefined) {
      try {
        lang = validateLanguageTag(o.lang, `${path}.lang`);
      } catch (err) {
        throw new ArgumentSchemaError(
          "invalid-language-tag",
          err instanceof Error ? err.message : String(err),
          "Foundation",
          `${path}.lang`,
        );
      }
    }

    let dir: TextDirection | undefined;
    if (o.dir !== undefined) {
      try {
        dir = validateDirection(o.dir, `${path}.dir`);
      } catch (err) {
        throw new ArgumentSchemaError(
          "invalid-direction",
          err instanceof Error ? err.message : String(err),
          "Foundation",
          `${path}.dir`,
        );
      }
    }

    return {
      id: o.id,
      kind: "foundation",
      title: o.title,
      learningObjective: o.learningObjective,
      compactExplanation: o.compactExplanation,
      fullExplanation: o.fullExplanation,
      workedExample,
      textualEquivalent: o.textualEquivalent,
      prerequisites,
      stoppingPoint: o.stoppingPoint,
      returnCaptions,
      instrumentOrConstruction:
        typeof o.instrumentOrConstruction === "string" ? o.instrumentOrConstruction : undefined,
      authorship,
      reviewState,
      ...(lang ? { lang } : {}),
      ...(dir ? { dir } : {}),
    };
  } else {
    // Bridge
    if (typeof o.concreteOperation !== "string" || !o.concreteOperation.trim()) {
      throw new ArgumentSchemaError(
        "missing-concrete-operation",
        "concreteOperation is required on Bridge.",
        "Bridge",
        `${path}.concreteOperation`,
      );
    }
    if (typeof o.compactExplanation !== "string" || !o.compactExplanation.trim()) {
      throw new ArgumentSchemaError(
        "missing-compact-explanation",
        "compactExplanation is required.",
        "Bridge",
        `${path}.compactExplanation`,
      );
    }
    if (typeof o.textualEquivalent !== "string" || !o.textualEquivalent.trim()) {
      throw new ArgumentSchemaError(
        "missing-textual-equivalent",
        "textualEquivalent is required.",
        "Bridge",
        `${path}.textualEquivalent`,
      );
    }
    if (typeof o.stoppingPoint !== "string" || !o.stoppingPoint.trim()) {
      throw new ArgumentSchemaError(
        "missing-stopping-point",
        "stoppingPoint is required.",
        "Bridge",
        `${path}.stoppingPoint`,
      );
    }
    if (typeof o.readinessSign !== "string" || !o.readinessSign.trim()) {
      throw new ArgumentSchemaError(
        "missing-readiness-sign",
        "readinessSign is required.",
        "Bridge",
        `${path}.readinessSign`,
      );
    }

    let workedExample: WorkedExample | undefined;
    if (o.workedExample !== undefined) {
      workedExample = validateWorkedExample(o.workedExample, `${path}.workedExample`);
    }

    let continueWith: BridgeContinueWith[] | undefined;
    if (Array.isArray(o.continueWith)) {
      continueWith = [];
      for (let i = 0; i < o.continueWith.length; i++) {
        const cw = o.continueWith[i] as Record<string, unknown>;
        const cwPath = `${path}.continueWith[${i}]`;
        if (!cw || !CONTINUE_WITH_ROUTES.includes(cw.route as ContinueWithRoute)) {
          throw new ArgumentSchemaError(
            "invalid-continue-with-route",
            `Invalid continueWith route "${cw?.route}".`,
            "Bridge",
            `${cwPath}.route`,
          );
        }
        if (typeof cw.targetId !== "string" || !cw.targetId.trim()) {
          throw new ArgumentSchemaError(
            "missing-continue-with-target",
            "continueWith requires targetId.",
            "Bridge",
            `${cwPath}.targetId`,
          );
        }
        continueWith.push({ route: cw.route as ContinueWithRoute, targetId: cw.targetId });
      }

      // If entrance bridge: exactly 2 routes (one more-guidance, one less-guidance)
      if (continueWith.length !== 2) {
        throw new ArgumentSchemaError(
          "invalid-continue-with-routes",
          `continueWith must contain exactly 2 routes (got ${continueWith.length}).`,
          "Bridge",
          `${path}.continueWith`,
        );
      }
      const hasMore = continueWith.some((r) => r.route === "more-guidance");
      const hasLess = continueWith.some((r) => r.route === "less-guidance");
      if (!hasMore || !hasLess) {
        throw new ArgumentSchemaError(
          "invalid-continue-with-routes",
          "continueWith requires one 'more-guidance' and one 'less-guidance' route.",
          "Bridge",
          `${path}.continueWith`,
        );
      }
    }

    let lang: string | undefined;
    if (o.lang !== undefined) {
      try {
        lang = validateLanguageTag(o.lang, `${path}.lang`);
      } catch (err) {
        throw new ArgumentSchemaError(
          "invalid-language-tag",
          err instanceof Error ? err.message : String(err),
          "Bridge",
          `${path}.lang`,
        );
      }
    }

    let dir: TextDirection | undefined;
    if (o.dir !== undefined) {
      try {
        dir = validateDirection(o.dir, `${path}.dir`);
      } catch (err) {
        throw new ArgumentSchemaError(
          "invalid-direction",
          err instanceof Error ? err.message : String(err),
          "Bridge",
          `${path}.dir`,
        );
      }
    }

    return {
      id: o.id,
      kind: "bridge",
      title: o.title,
      concreteOperation: o.concreteOperation,
      compactExplanation: o.compactExplanation,
      textualEquivalent: o.textualEquivalent,
      stoppingPoint: o.stoppingPoint,
      readinessSign: o.readinessSign,
      returnCaptions,
      workedExample,
      instrumentOrConstruction:
        typeof o.instrumentOrConstruction === "string" ? o.instrumentOrConstruction : undefined,
      continueWith,
      newSkill: typeof o.newSkill === "string" ? o.newSkill : undefined,
      whyUsefulHere: typeof o.whyUsefulHere === "string" ? o.whyUsefulHere : undefined,
      authorship,
      reviewState,
      ...(lang ? { lang } : {}),
      ...(dir ? { dir } : {}),
    };
  }
}

// ============================================================================
// 7. Misconception
// ============================================================================

export type MisconceptionIntervention = Readonly<{
  instrumentId?: string | undefined;
  scenarioId?: string | undefined;
  defaultsReviewed: Readonly<{
    model: string;
    labels: string;
    defaultControls: string;
    feedback: string;
  }>;
  reviewRecordId: string;
}>;

export type Misconception = Readonly<{
  id: string;
  paper: string;
  temptingClaims: readonly string[];
  whyTempting: string;
  whereItIsTrue: string;
  whatIsTrue: unknown;
  instrumentIds?: readonly string[] | undefined;
  staticTreatment?: Readonly<{ reason: string }> | undefined;
  anchors: readonly string[];
  resultIds: readonly string[];
  sources: readonly string[];
  intervention: MisconceptionIntervention;
  essentialForPrint?: boolean | undefined;
  authorship: AuthorshipBlock;
  reviewState: string;
  lang?: string | undefined;
  dir?: TextDirection | undefined;
}>;

export function validateMisconception(raw: unknown, path = "Misconception"): Misconception {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ArgumentSchemaError(
      "invalid-record",
      "Misconception must be an object.",
      "Misconception",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  if (o.essentialForPrint !== undefined && typeof o.essentialForPrint !== "boolean") {
    throw new ArgumentSchemaError(
      "invalid-essential-for-print",
      "essentialForPrint must be a boolean when present.",
      "Misconception",
      `${path}.essentialForPrint`,
    );
  }

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new ArgumentSchemaError("missing-id", "id is required.", "Misconception", `${path}.id`);
  }
  // Bound here rather than read again at the return. `o` is Record<string, unknown>, so the
  // narrowing from the guard above does not survive the four hundred lines and the intervening
  // calls between it and the object literal, and `next build` rejected `id: o.id` as unknown while
  // `tsc --noEmit` accepted it. Binding is the repair that keeps the validation: a cast would have
  // compiled while asserting the very thing this function exists to establish.
  const id = o.id;
  if (typeof o.paper !== "string" || !o.paper.trim()) {
    throw new ArgumentSchemaError(
      "missing-paper",
      "paper is required.",
      "Misconception",
      `${path}.paper`,
    );
  }
  const paper = o.paper;

  // Plural temptingClaims validation
  if ("temptingClaim" in o) {
    throw new ArgumentSchemaError(
      "singular-tempting-claim-rejected",
      "'temptingClaim' is retired. Use plural 'temptingClaims' array (1-2 entries).",
      "Misconception",
      `${path}.temptingClaim`,
    );
  }
  if (
    !Array.isArray(o.temptingClaims) ||
    o.temptingClaims.length < 1 ||
    o.temptingClaims.length > 2
  ) {
    throw new ArgumentSchemaError(
      "invalid-tempting-claims-count",
      "temptingClaims array must contain 1-2 entries.",
      "Misconception",
      `${path}.temptingClaims`,
    );
  }
  const temptingClaims = o.temptingClaims.map((tc, i) => {
    if (typeof tc !== "string" || !tc.trim())
      throw new ArgumentSchemaError(
        "invalid-tempting-claim",
        "temptingClaim must be a non-empty string.",
        "Misconception",
        `${path}.temptingClaims[${i}]`,
      );
    return tc;
  });

  if (typeof o.whyTempting !== "string" || !o.whyTempting.trim()) {
    throw new ArgumentSchemaError(
      "missing-why-tempting",
      "whyTempting is required.",
      "Misconception",
      `${path}.whyTempting`,
    );
  }

  const whyTempting = o.whyTempting;

  if (typeof o.whereItIsTrue !== "string" || !o.whereItIsTrue.trim()) {
    throw new ArgumentSchemaError(
      "missing-where-it-is-true",
      "whereItIsTrue is required.",
      "Misconception",
      `${path}.whereItIsTrue`,
    );
  }
  const whereItIsTrue = o.whereItIsTrue;

  if (!o.whatIsTrue) {
    throw new ArgumentSchemaError(
      "missing-what-is-true",
      "whatIsTrue is required.",
      "Misconception",
      `${path}.whatIsTrue`,
    );
  }

  // Treatment validation
  const hasInstruments = Array.isArray(o.instrumentIds) && o.instrumentIds.length > 0;
  const hasStatic = o.staticTreatment && typeof o.staticTreatment === "object";
  if (!hasInstruments && !hasStatic) {
    throw new ArgumentSchemaError(
      "missing-misconception-treatment",
      "Misconception requires either instrumentIds (at least 1) or staticTreatment.",
      "Misconception",
      path,
    );
  }

  // Intervention validation
  const inv = o.intervention as Record<string, unknown>;
  if (!inv || typeof inv !== "object") {
    throw new ArgumentSchemaError(
      "missing-intervention",
      "intervention object is required.",
      "Misconception",
      `${path}.intervention`,
    );
  }
  const defs = inv.defaultsReviewed as Record<string, unknown>;
  if (!defs || typeof defs !== "object") {
    throw new ArgumentSchemaError(
      "missing-defaults-reviewed",
      "intervention.defaultsReviewed object is required.",
      "Misconception",
      `${path}.intervention.defaultsReviewed`,
    );
  }

  const requiredJudgments = ["model", "labels", "defaultControls", "feedback"] as const;
  for (const j of requiredJudgments) {
    if (typeof defs[j] !== "string" || !(defs[j] as string).trim()) {
      throw new ArgumentSchemaError(
        "missing-defaults-reviewed-judgment",
        `defaultsReviewed requires judgment "${j}".`,
        "Misconception",
        `${path}.intervention.defaultsReviewed.${j}`,
      );
    }
  }

  if (typeof inv.reviewRecordId !== "string" || !inv.reviewRecordId.trim()) {
    throw new ArgumentSchemaError(
      "missing-review-record-id",
      "intervention requires reviewRecordId.",
      "Misconception",
      `${path}.intervention.reviewRecordId`,
    );
  }

  let lang: string | undefined;
  if (o.lang !== undefined) {
    try {
      lang = validateLanguageTag(o.lang, `${path}.lang`);
    } catch (err) {
      throw new ArgumentSchemaError(
        "invalid-language-tag",
        err instanceof Error ? err.message : String(err),
        "Misconception",
        `${path}.lang`,
      );
    }
  }

  let dir: TextDirection | undefined;
  if (o.dir !== undefined) {
    try {
      dir = validateDirection(o.dir, `${path}.dir`);
    } catch (err) {
      throw new ArgumentSchemaError(
        "invalid-direction",
        err instanceof Error ? err.message : String(err),
        "Misconception",
        `${path}.dir`,
      );
    }
  }

  const authorship = validateAuthorshipBlock(o.authorship, `${path}.authorship`);
  const reviewState = (o.reviewState as string) || "draft";

  return {
    id,
    paper,
    temptingClaims,
    whyTempting,
    whereItIsTrue,
    // whatIsTrue is declared `unknown` on Misconception, so it passes through as it always has.
    whatIsTrue: o.whatIsTrue,
    instrumentIds: hasInstruments ? (o.instrumentIds as string[]) : undefined,
    staticTreatment: hasStatic ? (o.staticTreatment as { reason: string }) : undefined,
    anchors: Array.isArray(o.anchors) ? (o.anchors as string[]) : [],
    resultIds: Array.isArray(o.resultIds) ? (o.resultIds as string[]) : [],
    sources: Array.isArray(o.sources) ? (o.sources as string[]) : [],
    intervention: {
      instrumentId: typeof inv.instrumentId === "string" ? inv.instrumentId : undefined,
      scenarioId: typeof inv.scenarioId === "string" ? inv.scenarioId : undefined,
      defaultsReviewed: {
        model: defs.model as string,
        labels: defs.labels as string,
        defaultControls: defs.defaultControls as string,
        feedback: defs.feedback as string,
      },
      reviewRecordId: inv.reviewRecordId as string,
    },
    essentialForPrint: typeof o.essentialForPrint === "boolean" ? o.essentialForPrint : undefined,
    authorship,
    reviewState,
    ...(lang ? { lang } : {}),
    ...(dir ? { dir } : {}),
  };
}

// ============================================================================
// 8. ReadingSet & AuthoringContract
// ============================================================================

export type ReadingSet = Readonly<{
  targetId: string;
  targetKind: ReadingTargetKind;
  r0: unknown;
  r1: unknown;
  r2: unknown;
  r3: unknown;
  foundationLinks?: readonly FoundationLink[] | undefined;
  essentialForPrint?: boolean | undefined;
  authorship: AuthorshipBlock;
  reviewState: string;
  lang?: string | undefined;
  dir?: TextDirection | undefined;
}>;

export function validateReadingSet(raw: unknown, path = "ReadingSet"): ReadingSet {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ArgumentSchemaError(
      "invalid-record",
      "ReadingSet must be an object.",
      "ReadingSet",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  if (o.essentialForPrint !== undefined && typeof o.essentialForPrint !== "boolean") {
    throw new ArgumentSchemaError(
      "invalid-essential-for-print",
      "essentialForPrint must be a boolean when present.",
      "ReadingSet",
      `${path}.essentialForPrint`,
    );
  }

  if (typeof o.targetId !== "string" || !o.targetId.trim()) {
    throw new ArgumentSchemaError(
      "missing-target-id",
      "targetId is required.",
      "ReadingSet",
      `${path}.targetId`,
    );
  }

  const targetKind = o.targetKind as ReadingTargetKind;
  if (o.targetKind === "caption") {
    throw new ArgumentSchemaError(
      "invalid-reading-target-kind",
      `targetKind "caption" is invalid; use "instrument-caption".`,
      "ReadingSet",
      `${path}.targetKind`,
    );
  }
  if (!READING_TARGET_KINDS.includes(targetKind)) {
    throw new ArgumentSchemaError(
      "invalid-reading-target-kind",
      `Invalid targetKind "${o.targetKind}". Expected one of: ${READING_TARGET_KINDS.join(", ")}`,
      "ReadingSet",
      `${path}.targetKind`,
    );
  }

  // Validate targetId grammar for targetKind
  if (targetKind === "paragraph") {
    const pResult = parseParagraphId(o.targetId);
    if (!pResult.ok)
      throw new ArgumentSchemaError(
        "invalid-target-id-for-kind",
        pResult.error,
        "ReadingSet",
        `${path}.targetId`,
      );
  } else if (targetKind === "heading") {
    const hResult = parseHeadingId(o.targetId);
    if (!hResult.ok)
      throw new ArgumentSchemaError(
        "invalid-target-id-for-kind",
        hResult.error,
        "ReadingSet",
        `${path}.targetId`,
      );
  } else if (targetKind === "footnote") {
    const fnResult = parseFootnoteId(o.targetId);
    if (!fnResult.ok)
      throw new ArgumentSchemaError(
        "invalid-target-id-for-kind",
        fnResult.error,
        "ReadingSet",
        `${path}.targetId`,
      );
  } else if (targetKind === "closing") {
    const clResult = parseClosingId(o.targetId);
    if (!clResult.ok)
      throw new ArgumentSchemaError(
        "invalid-target-id-for-kind",
        clResult.error,
        "ReadingSet",
        `${path}.targetId`,
      );
  } else if (targetKind === "equation") {
    const eqResult = parseEquationRecordId(o.targetId);
    if (!eqResult.ok)
      throw new ArgumentSchemaError(
        "invalid-target-id-for-kind",
        eqResult.error,
        "ReadingSet",
        `${path}.targetId`,
      );
  } else if (targetKind === "derivation-step") {
    const stepPattern =
      /^(?:derivation-step:)?[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/;
    if (!stepPattern.test(o.targetId)) {
      throw new ArgumentSchemaError(
        "invalid-target-id-for-kind",
        `Invalid targetId "${o.targetId}" for derivation-step: must be lowercase kebab-case or '<chainId>/<stepId>'.`,
        "ReadingSet",
        `${path}.targetId`,
      );
    }
  } else if (targetKind === "instrument-caption") {
    const captionPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!captionPattern.test(o.targetId)) {
      throw new ArgumentSchemaError(
        "invalid-target-id-for-kind",
        `Invalid targetId "${o.targetId}" for instrument-caption: must be lowercase kebab-case.`,
        "ReadingSet",
        `${path}.targetId`,
      );
    }
  }

  let foundationLinks: FoundationLink[] | undefined;
  if (Array.isArray(o.foundationLinks)) {
    foundationLinks = o.foundationLinks.map((fl, i) =>
      validateFoundationLink(fl, `${path}.foundationLinks[${i}]`),
    );
  }

  let lang: string | undefined;
  if (o.lang !== undefined) {
    try {
      lang = validateLanguageTag(o.lang, `${path}.lang`);
    } catch (err) {
      throw new ArgumentSchemaError(
        "invalid-language-tag",
        err instanceof Error ? err.message : String(err),
        "ReadingSet",
        `${path}.lang`,
      );
    }
  }

  let dir: TextDirection | undefined;
  if (o.dir !== undefined) {
    try {
      dir = validateDirection(o.dir, `${path}.dir`);
    } catch (err) {
      throw new ArgumentSchemaError(
        "invalid-direction",
        err instanceof Error ? err.message : String(err),
        "ReadingSet",
        `${path}.dir`,
      );
    }
  }

  const authorship = validateAuthorshipBlock(o.authorship, `${path}.authorship`);
  const reviewState = (o.reviewState as string) || "draft";

  return {
    targetId: o.targetId,
    targetKind,
    r0: o.r0,
    r1: o.r1,
    r2: o.r2,
    r3: o.r3,
    foundationLinks,
    essentialForPrint: typeof o.essentialForPrint === "boolean" ? o.essentialForPrint : undefined,
    authorship,
    reviewState,
    ...(lang ? { lang } : {}),
    ...(dir ? { dir } : {}),
  };
}

export type QualificationRecord = Readonly<{
  qualificationId: string;
  statement: string;
  restricts: string;
  scopeCritical: boolean;
}>;

export type AuthoringContract = Readonly<{
  question: string;
  premisesRetained: readonly string[];
  conclusionSupported: string;
  approximationsIntroduced: readonly QualificationRecord[];
  omissionsAcknowledged: readonly QualificationRecord[];
  bridge: string;
}>;

export function validateAuthoringContract(
  raw: unknown,
  path = "AuthoringContract",
): AuthoringContract {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ArgumentSchemaError(
      "invalid-record",
      "AuthoringContract must be an object.",
      "AuthoringContract",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  if ("essentialForPrint" in o && o.essentialForPrint !== undefined) {
    throw new ArgumentSchemaError(
      "essential-for-print-rejected",
      "essentialForPrint is rejected on AuthoringContract; it is only allowed on ReadingSet and Misconception.",
      "AuthoringContract",
      `${path}.essentialForPrint`,
    );
  }

  if (typeof o.question !== "string" || !o.question.trim())
    throw new ArgumentSchemaError(
      "missing-question",
      "question is required.",
      "AuthoringContract",
      `${path}.question`,
    );
  if (typeof o.conclusionSupported !== "string" || !o.conclusionSupported.trim())
    throw new ArgumentSchemaError(
      "missing-conclusion",
      "conclusionSupported is required.",
      "AuthoringContract",
      `${path}.conclusionSupported`,
    );
  if (typeof o.bridge !== "string" || !o.bridge.trim())
    throw new ArgumentSchemaError(
      "missing-bridge",
      "bridge is required.",
      "AuthoringContract",
      `${path}.bridge`,
    );

  function validateQualifications(list: unknown, qPath: string): QualificationRecord[] {
    if (!Array.isArray(list)) return [];
    return list.map((item, i) => {
      const q = item as Record<string, unknown>;
      const itemPath = `${qPath}[${i}]`;
      if (
        !q ||
        typeof q.qualificationId !== "string" ||
        typeof q.statement !== "string" ||
        typeof q.restricts !== "string"
      ) {
        throw new ArgumentSchemaError(
          "invalid-qualification",
          "Qualification requires qualificationId, statement, and restricts.",
          "AuthoringContract",
          itemPath,
        );
      }
      return {
        qualificationId: q.qualificationId,
        statement: q.statement,
        restricts: q.restricts,
        scopeCritical: Boolean(q.scopeCritical),
      };
    });
  }

  const approximationsIntroduced = validateQualifications(
    o.approximationsIntroduced,
    `${path}.approximationsIntroduced`,
  );
  const omissionsAcknowledged = validateQualifications(
    o.omissionsAcknowledged,
    `${path}.omissionsAcknowledged`,
  );

  return {
    question: o.question,
    premisesRetained: Array.isArray(o.premisesRetained) ? (o.premisesRetained as string[]) : [],
    conclusionSupported: o.conclusionSupported,
    approximationsIntroduced,
    omissionsAcknowledged,
    bridge: o.bridge,
  };
}

// ============================================================================
// 9. ObstacleResponses
// ============================================================================

export type ObstacleResponseDetail = Readonly<{
  explanation: string;
  foundationLinks?: readonly FoundationLink[] | undefined;
}>;

export type ObstacleResponses = Readonly<{
  unfamiliarWordOrSymbol?: ObstacleResponseDetail | undefined;
  algebraicMove?: ObstacleResponseDetail | undefined;
  physicalReason?: ObstacleResponseDetail | undefined;
  connectionToPicture?: ObstacleResponseDetail | undefined;
  purposeOfCalculation?: ObstacleResponseDetail | undefined;
  tooMuchAtOnce?: ObstacleResponseDetail | undefined;
  exampleFirst?: Readonly<{ workedExampleRef: string }> | undefined;
}>;

export function validateObstacleResponses(
  raw: unknown,
  path = "ObstacleResponses",
): ObstacleResponses {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ArgumentSchemaError(
      "invalid-record",
      "ObstacleResponses must be an object.",
      "ObstacleResponses",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  if ("essentialForPrint" in o && o.essentialForPrint !== undefined) {
    throw new ArgumentSchemaError(
      "essential-for-print-rejected",
      "essentialForPrint is rejected on ObstacleResponses; it is only allowed on ReadingSet and Misconception.",
      "ObstacleResponses",
      `${path}.essentialForPrint`,
    );
  }

  const kebabToCamel: Record<string, string> = {
    "unfamiliar-word-or-symbol": "unfamiliarWordOrSymbol",
    "algebraic-move": "algebraicMove",
    "physical-reason": "physicalReason",
    "connection-to-picture": "connectionToPicture",
    "purpose-of-calculation": "purposeOfCalculation",
    "too-much-at-once": "tooMuchAtOnce",
  };

  for (const key of Object.keys(o)) {
    if (kebabToCamel[key]) {
      throw new ArgumentSchemaError(
        "invalid-obstacle-key",
        `Obstacle response key "${key}" is invalid. Use camelCase "${kebabToCamel[key]}".`,
        "ObstacleResponses",
        `${path}.${key}`,
      );
    }
  }

  const result: Record<string, unknown> = {};

  for (const kind of OBSTACLE_KIND_IDS) {
    if (o[kind] !== undefined) {
      const resp = o[kind] as Record<string, unknown>;
      if (typeof resp === "string") {
        result[kind] = { explanation: resp };
      } else if (resp && typeof resp === "object") {
        result[kind] = {
          explanation: (resp.explanation as string) || "",
          foundationLinks: Array.isArray(resp.foundationLinks)
            ? resp.foundationLinks.map((fl, i) =>
                validateFoundationLink(fl, `${path}.${kind}.foundationLinks[${i}]`),
              )
            : undefined,
        };
      }
    }
  }

  if (o.exampleFirst !== undefined) {
    const ef = o.exampleFirst as Record<string, unknown>;
    result.exampleFirst = {
      workedExampleRef:
        (ef?.workedExampleRef as string) ||
        (typeof o.exampleFirst === "string" ? o.exampleFirst : ""),
    };
  }

  return result as ObstacleResponses;
}

// ============================================================================
// 10. Proof Route Acyclicity Pure Validator
// ============================================================================

export function checkProofRouteAcyclicity(nodes: readonly ArgumentNode[]): void {
  const nodeMap = new Map<string, ArgumentNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const currentPath: string[] = [];

  function dfs(nodeId: string): void {
    if (inStack.has(nodeId)) {
      const cycleStart = currentPath.indexOf(nodeId);
      const cycle = [...currentPath.slice(cycleStart), nodeId];
      throw new ArgumentSchemaError(
        "proof-route-cycle-detected",
        `Proof route contains a cyclic dependency: ${cycle.join(" -> ")}`,
        "ProofRoute",
        nodeId,
      );
    }
    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    inStack.add(nodeId);
    currentPath.push(nodeId);

    const node = nodeMap.get(nodeId);
    if (node) {
      // 1. Check historical-derivation and pedagogical-reconstruction premise edges
      for (const p of node.premises) {
        if (p.edgeType === "historical-derivation" || p.edgeType === "pedagogical-reconstruction") {
          if (p.ref.kind === "argument" && nodeMap.has(p.ref.id)) {
            dfs(p.ref.id);
          }
        }
      }

      // 2. Check proof-edge prerequisites
      for (const pr of node.prerequisites) {
        if (pr.kind === "proof-edge" && nodeMap.has(pr.foundationId)) {
          dfs(pr.foundationId);
        }
      }
    }

    currentPath.pop();
    inStack.delete(nodeId);
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  }
}

/**
 * A quantity the source NAMES but never DEFINES (dispatch 236). Einstein's A_m and A_e, the
 * magnetic and electric deflectability of p. 920 of the 1905 electrodynamics paper, are named and
 * tied by the law A_m/A_e = v/V, which fixes only that the two share a dimension, not what it is.
 * Such a record declares no dimension in any unit system (a guessed one would be checked as if it
 * were known), says in its dimensionNote where it is named and what the source does fix, and is
 * never a constant. The dimension checker reports it as an unsupported check
 * (dimensions/unitSystems.ts), never as consistent.
 *
 * Returns the note for this status and undefined for every other. It sits here, below every other
 * throw site in this file, because tests cite those sites by line and an insertion inside
 * validateQuantity would move them all.
 */
function sourceUndefinedDimensionNote(
  o: Record<string, unknown>,
  dimensionStatus: DimensionStatus,
  path: string,
): string | undefined {
  if (dimensionStatus !== "undefined-in-source") return undefined;
  for (const key of ["dimension", "gaussianDimension", "emuDimension"] as const) {
    if (o[key] !== undefined) {
      throw new ArgumentSchemaError(
        "undefined-in-source-dimension-declared",
        `A quantity whose dimension the source leaves undefined must not declare ${key}.`,
        "Quantity",
        `${path}.${key}`,
      );
    }
  }
  if (typeof o.dimensionNote !== "string" || !o.dimensionNote.trim()) {
    throw new ArgumentSchemaError(
      "undefined-in-source-missing-dimension-note",
      "A quantity whose dimension the source leaves undefined requires a dimensionNote saying where it is named and what the source fixes.",
      "Quantity",
      `${path}.dimensionNote`,
    );
  }
  if (o.isConstant === true) {
    throw new ArgumentSchemaError(
      "undefined-in-source-cannot-be-constant",
      "A quantity whose dimension the source leaves undefined cannot have isConstant: true.",
      "Quantity",
      `${path}.isConstant`,
    );
  }
  return o.dimensionNote;
}
