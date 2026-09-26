/**
 * Types and interfaces for Knowledge Cards (HistoricalPremise), Shelf Rules,
 * Verification Queue, and Backlinks.
 *
 * Specification: am-disc-knowledge-cards-iw8j, am-ep-discovery-33u
 */

import type {
  AuthorshipBlock,
  PremiseStatus,
  TextDirection,
} from "../../content/schemas/argument.ts";

export type { AuthorshipBlock, PremiseStatus, TextDirection };

export type PremiseEventKind = "presented" | "published" | "performed";

export const PREMISE_EVENT_KINDS: readonly PremiseEventKind[] = [
  "presented",
  "published",
  "performed",
] as const;

export const FORBIDDEN_TIMELINE_KINDS_ON_PREMISE = [
  "dated-letter",
  "awarded",
  "appointed",
] as const;

export type PriorEvent = Readonly<{
  eventKind: PremiseEventKind;
  earliest: string;
  latest: string;
  precision: "day" | "month" | "year" | "range";
  sources?: readonly unknown[] | undefined;
}>;

export type VerifierKind = "human" | "agent";

export type VerificationMethod =
  | "library scan"
  | "bound volume"
  | "publisher facsimile"
  | "comparison edition";

export type PremiseVerification = Readonly<{
  verifiedBy: string;
  verifierKind: VerifierKind;
  date: string;
  method: VerificationMethod;
  evidenceLocator: string;
  printedCitation?: string | undefined;
  discrepancies?: readonly string[] | undefined;
  reviewRecordId?: string | undefined;
}>;

/** What was read to check a card's source: a scan's page image, or a catalog or DOI record. */
export type SourceCheckRead = "page-image" | "catalog-record";

export const SOURCE_CHECK_READS: readonly SourceCheckRead[] = ["page-image", "catalog-record"];

/**
 * The evidence that one of a card's sources was checked (dispatches 251 and 252): the URL read,
 * when, and what matched. It is evidence, not a verification record: isCardVerified ignores it,
 * so the publication gate still asks for `verification`, which AGENTS.md reserves for a named
 * reviewer, and only an agent may record one. It lives in the data and is never rendered.
 * Validated by sourceChecks.ts.
 */
export type SourceCheck = Readonly<{
  /** The card's source this check concerns: its index in `sources`. */
  source: number;
  /** The agent who read it, for example "agent:SapphireCastle". */
  checkedBy: string;
  /** The day it was read, YYYY-MM-DD. */
  checkedOn: string;
  /** The https URL that was read. */
  url: string;
  read: SourceCheckRead;
  /** What matched, in words: title, author, journal, volume, first page, year, and the claim. */
  matched: string;
  /** What did not match, each with what the card now says. */
  differs?: readonly string[] | undefined;
}>;

export type AdmittedImport = Readonly<{
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

export type KnowledgeCard = Readonly<{
  id: string;
  proposition: string;
  status: PremiseStatus;
  sources: readonly unknown[];
  date: PremiseDate;
  claimsEinsteinKnew?: boolean | undefined;
  limits?: string | undefined;
  priorEvent?: PriorEvent | undefined;
  relatedCardId?: string | undefined;
  parallelWorkBasis?: string | undefined;
  admittedImport?: boolean | AdmittedImport | undefined;
  paperCitesOrAsserts?: readonly PaperCitationRef[] | undefined;
  einsteinKnowledgeEvidence?: readonly unknown[] | undefined;
  admittedStages?: readonly string[] | undefined;
  verification?: PremiseVerification | undefined;
  verifier?: string | undefined;
  dateVerified?: string | undefined;
  evidenceLocator?: string | undefined;
  /** Where each source was checked, and what matched (sourceChecks.ts). Never rendered. */
  sourceChecks?: readonly SourceCheck[] | undefined;
  authorship?: AuthorshipBlock | undefined;
  reviewState?: string | undefined;
  lang?: string | undefined;
  dir?: TextDirection | undefined;
}>;

export type QueueItemStatus = "open" | "resolved" | "narrowed";

export type VerificationQueueItem = Readonly<{
  id: string;
  question: string;
  cards: readonly string[];
  sourceToConsult: string;
  landsIn: string;
  status: QueueItemStatus;
  explanation?: string | undefined;
}>;

export type VerificationQueueFile = Readonly<{
  group: string;
  items: readonly VerificationQueueItem[];
}>;

export type CardBacklinks = Readonly<{
  stageIds: readonly string[];
  deskObjectIds: readonly string[];
  timelineEntryIds: readonly string[];
  worldCheckIds: readonly string[];
}>;

export type BuildProfile = "production" | "preview" | "draft";

export type CardRuleId =
  | "shelf-date-violation"
  | "card-event-kind-missing"
  | "card-invalid-event-kind"
  | "card-prior-event-not-prior"
  | "card-parallel-basis-missing"
  | "card-parallel-work-unacknowledged"
  | "card-admitted-import-invalid-journey"
  | "card-admitted-import-undeclared"
  | "card-admitted-import-desk-forbidden"
  | "card-later-on-shelf"
  | "card-einstein-knowledge-missing-citation"
  | "card-einstein-knowledge-in-proposition"
  | "card-missing-citing-stage"
  | "card-unknown-admitted-stage"
  | "card-date-earliest-after-latest"
  | "card-latest-year-mismatch"
  | "card-available-year-exceeded"
  | "card-parallel-work-too-early"
  | "card-duplicate-premise"
  | "card-open-queue-blocks-verification"
  | "card-queue-unknown-card"
  | "card-queue-narrowed-missing-explanation"
  | "card-queue-lands-in-empty-field"
  | "card-related-card-not-found"
  | "card-related-card-not-reciprocal"
  | "card-unverified-in-production";

export type CardRuleDiagnostic = Readonly<{
  severity: "error" | "warning" | "refusal";
  rule: CardRuleId;
  cardId?: string | undefined;
  stageId?: string | undefined;
  page?: string | undefined;
  message: string;
  repair?: string | undefined;
}>;
