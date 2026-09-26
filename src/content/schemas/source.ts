/**
 * Canonical schemas and validators for source-layer entities:
 * Paper, SourceAsset, SourceBlock, TranslationUnit, Alignment, GlossUnit, EditorialNote, Citation.
 * Specification: AGENTS.md and am-cm-schemas-source-1en
 */

import { type TextDirection, validateDirection, validateLanguageTag } from "../../i18n/language.ts";
import {
  CLOUD_PROCESSING_VALUES,
  type CloudProcessing,
  type PageMapEntry,
  PUBLICATION_DECISION_VALUES,
  type PublicationDecision,
  REUSE_TERMS_VALUES,
  type ReuseTerms,
  RIGHTS_STATUS_VALUES,
  type RightsStatus,
} from "../provenance/receiptSchema.ts";
import type { SourceAsset, SourceAssetRights } from "../provenance/receiptToSourceAsset.ts";
import { type AuthorshipEntry, validateAuthorshipEntry } from "./authorship.ts";
import { type PaperDate, validateChronology, validatePaperDate } from "./dates.ts";
import { type Inline, plainText, validateInline } from "./inlines.ts";
import { type PageTurn, validatePageTurns } from "./pageTurns.ts";
import { checkConstraints, loadRightsVocabulary, requiredFieldsFor } from "./rightsVocabulary.ts";

export { type Inline, plainText, validateInline } from "./inlines.ts";

/**
 * The closed vocabularies live in the client-safe half of this schema
 * (`source.pure.ts`): they are values a reading face legitimately needs, and
 * they must not carry this module's filesystem-backed validators into a
 * browser bundle. They are declared once there and re-exported here so every
 * existing server-side consumer of `source.ts` keeps its import. See am-bwnf.
 */
import {
  EDITORIAL_NOTE_KINDS,
  type EditorialNoteKind,
  GLOSS_NOTE_CLASSES,
  type GlossNoteClass,
  MULTIWORD_UNIT_KINDS,
  type MultiwordUnitKind,
  PAPER_SLUGS,
  type PaperSlug,
  SOURCE_BLOCK_KINDS,
  type SourceBlockKind,
} from "./source.pure.ts";
import { type SpanAnchor, validateSpanAnchor } from "./spans.ts";

export {
  EDITORIAL_NOTE_KINDS,
  type EditorialNoteKind,
  GLOSS_NOTE_CLASSES,
  type GlossNoteClass,
  MULTIWORD_UNIT_KINDS,
  type MultiwordUnitKind,
  PAPER_SLUGS,
  type PaperSlug,
  SOURCE_BLOCK_KINDS,
  SOURCE_SCHEMA_VERSION,
  type SourceBlockKind,
} from "./source.pure.ts";

export { type SpanAnchor, spanTextDigest, validateSpanAnchor } from "./spans.ts";

export class SchemaValidationError extends Error {
  readonly code: string;
  readonly entity: string;
  readonly path: string;

  constructor(code: string, message: string, entity = "SourceEntity", path = "root") {
    super(`[${entity}] ${path}: ${message} (${code})`);
    this.name = "SchemaValidationError";
    this.code = code;
    this.entity = entity;
    this.path = path;
  }
}

// 1. PAPER

export type EditorialAddition = Readonly<{
  phrase: string;
  reason: string;
  germanBasis: string;
  witnessCoincidence?: string | undefined;
}>;

export type JournalPages = Readonly<{
  first: number;
  last: number;
}>;

export type LaterEditionDoi = Readonly<{
  doi: string;
  description: string;
  verifiedAt: string;
}>;

export type PaperJournal = Readonly<{
  name: string;
  series: number;
  volume: number;
  wholeSeriesVolume: number;
  issue: string | number;
  issueSource: string;
  pages: JournalPages;
  doi: string;
  doiVerifiedAt: string;
  laterEditionDois?: readonly LaterEditionDoi[] | undefined;
}>;

export type RelatedDocument = Readonly<{
  bibKey: string;
  role: "correction" | "supplement";
  idPrefix: string;
  journal: PaperJournal;
  dates: readonly PaperDate[];
}>;

export type PaperSection = Readonly<{
  id: string;
  title: string;
  arguments: readonly string[];
}>;

export type Paper = Readonly<{
  slug: PaperSlug;
  bibKey: string;
  titleGerman: string;
  titleEnglishWorking: string;
  editorialAdditions: readonly EditorialAddition[];
  authorLine: string;
  dates: readonly PaperDate[];
  journal: PaperJournal;
  collectedPapers: Readonly<{ volume: number; document: number }>;
  orderedBlockIds: readonly string[];
  companion: boolean;
  relatedDocuments?: readonly RelatedDocument[] | undefined;
  status: string;
  sourceStatus: string;
  sourceNotice: string;
  sections: readonly PaperSection[];
}>;

export function validatePaper(
  raw: unknown,
  path = "Paper",
  citations?: readonly Citation[] | ReadonlyMap<string, Citation>,
): Paper {
  if (!raw || typeof raw !== "object")
    throw new SchemaValidationError("invalid-record", "Paper must be an object.", "Paper", path);
  const o = raw as Record<string, unknown>;

  if (!PAPER_SLUGS.includes(o.slug as PaperSlug)) {
    throw new SchemaValidationError(
      "invalid-paper-slug",
      `Invalid paper slug "${o.slug}".`,
      "Paper",
      `${path}.slug`,
    );
  }
  if (typeof o.bibKey !== "string" || !/^ap-\d+-\d+$/.test(o.bibKey)) {
    throw new SchemaValidationError(
      "invalid-bib-key",
      `Invalid bibKey "${o.bibKey}". Must match ap-<vol>-<page>.`,
      "Paper",
      `${path}.bibKey`,
    );
  }
  if (typeof o.titleGerman !== "string" || !o.titleGerman.trim()) {
    throw new SchemaValidationError(
      "missing-title-german",
      "titleGerman is required.",
      "Paper",
      `${path}.titleGerman`,
    );
  }
  if (typeof o.titleEnglishWorking !== "string" || !o.titleEnglishWorking.trim()) {
    throw new SchemaValidationError(
      "missing-title-english",
      "titleEnglishWorking is required.",
      "Paper",
      `${path}.titleEnglishWorking`,
    );
  }

  // Validate editorialAdditions
  if (!Array.isArray(o.editorialAdditions)) {
    throw new SchemaValidationError(
      "missing-editorial-additions",
      "editorialAdditions array is required (may be empty).",
      "Paper",
      `${path}.editorialAdditions`,
    );
  }
  const editorialAdditions: EditorialAddition[] = o.editorialAdditions.map((ea, i) => {
    if (!ea || typeof ea !== "object")
      throw new SchemaValidationError(
        "invalid-addition",
        "Addition must be an object.",
        "Paper",
        `${path}.editorialAdditions[${i}]`,
      );
    const a = ea as Record<string, unknown>;
    if (typeof a.phrase !== "string")
      throw new SchemaValidationError(
        "missing-phrase",
        "phrase is required.",
        "Paper",
        `${path}.editorialAdditions[${i}].phrase`,
      );
    if (typeof a.reason !== "string")
      throw new SchemaValidationError(
        "missing-reason",
        "reason is required.",
        "Paper",
        `${path}.editorialAdditions[${i}].reason`,
      );
    if (typeof a.germanBasis !== "string")
      throw new SchemaValidationError(
        "missing-basis",
        "germanBasis is required.",
        "Paper",
        `${path}.editorialAdditions[${i}].germanBasis`,
      );
    if (typeof a.witnessCoincidence === "string" && citations !== undefined) {
      const citMap =
        citations instanceof Map
          ? citations
          : new Map((citations as readonly Citation[]).map((c) => [c.id, c]));
      const cit = citMap.get(a.witnessCoincidence);
      if (!cit) {
        throw new SchemaValidationError(
          "witness-citation-not-found",
          `witnessCoincidence "${a.witnessCoincidence}" does not name a known Citation.`,
          "Paper",
          `${path}.editorialAdditions[${i}].witnessCoincidence`,
        );
      }
      if (cit.role !== "comparison-witness") {
        throw new SchemaValidationError(
          "witness-coincidence-invalid-role",
          `witnessCoincidence must name a Citation with role "comparison-witness", got "${cit.role}".`,
          "Paper",
          `${path}.editorialAdditions[${i}].witnessCoincidence`,
        );
      }
    }
    return {
      phrase: a.phrase,
      reason: a.reason,
      germanBasis: a.germanBasis,
      ...(typeof a.witnessCoincidence === "string"
        ? { witnessCoincidence: a.witnessCoincidence }
        : {}),
    };
  });

  // Validate dates
  if (!Array.isArray(o.dates) || o.dates.length === 0) {
    throw new SchemaValidationError(
      "missing-dates",
      "dates array is required.",
      "Paper",
      `${path}.dates`,
    );
  }
  const dates = o.dates.map((d, i) =>
    validatePaperDate(d, o.bibKey as string, `${path}.dates[${i}]`),
  );
  validateChronology(dates, o.bibKey as string);

  // Validate journal
  const j = o.journal as Record<string, unknown>;
  if (!j || typeof j !== "object")
    throw new SchemaValidationError(
      "missing-journal",
      "journal is required.",
      "Paper",
      `${path}.journal`,
    );
  const pages = j.pages as Record<string, unknown>;
  if (
    !pages ||
    typeof pages.first !== "number" ||
    typeof pages.last !== "number" ||
    pages.first > pages.last
  ) {
    throw new SchemaValidationError(
      "invalid-journal-pages",
      "journal pages {first, last} invalid.",
      "Paper",
      `${path}.journal.pages`,
    );
  }

  return {
    slug: o.slug as PaperSlug,
    bibKey: o.bibKey,
    titleGerman: o.titleGerman,
    titleEnglishWorking: o.titleEnglishWorking,
    editorialAdditions,
    authorLine: (o.authorLine as string) || "A. Einstein",
    dates,
    journal: {
      name: (j.name as string) || "Annalen der Physik",
      series: typeof j.series === "number" ? j.series : 4,
      volume: typeof j.volume === "number" ? j.volume : 17,
      wholeSeriesVolume: typeof j.wholeSeriesVolume === "number" ? j.wholeSeriesVolume : 322,
      issue: (j.issue as string | number) || 1,
      issueSource: (j.issueSource as string) || "Issue masthead",
      pages: { first: pages.first as number, last: pages.last as number },
      doi: j.doi as string,
      doiVerifiedAt: j.doiVerifiedAt as string,
      laterEditionDois: Array.isArray(j.laterEditionDois)
        ? (j.laterEditionDois as LaterEditionDoi[])
        : undefined,
    },
    collectedPapers: o.collectedPapers as { volume: number; document: number },
    orderedBlockIds: Array.isArray(o.orderedBlockIds) ? (o.orderedBlockIds as string[]) : [],
    companion: Boolean(o.companion),
    relatedDocuments: Array.isArray(o.relatedDocuments)
      ? (o.relatedDocuments as RelatedDocument[])
      : undefined,
    status: (o.status as string) || "published",
    sourceStatus: (o.sourceStatus as string) || "reviewed",
    sourceNotice: (o.sourceNotice as string) || "",
    sections: Array.isArray(o.sections) ? (o.sections as PaperSection[]) : [],
  };
}

// 2. SOURCE ASSET
export type { SourceAsset, SourceAssetRights };

export function validateSourceAsset(raw: unknown, path = "SourceAsset"): SourceAsset {
  if (!raw || typeof raw !== "object")
    throw new SchemaValidationError(
      "invalid-record",
      "SourceAsset must be an object.",
      "SourceAsset",
      path,
    );
  const o = raw as Record<string, unknown>;

  if (typeof o.originUrl !== "string" || !o.originUrl.trim()) {
    throw new SchemaValidationError(
      "missing-origin-url",
      "originUrl is required.",
      "SourceAsset",
      `${path}.originUrl`,
    );
  }
  if (typeof o.acquisitionDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.acquisitionDate)) {
    throw new SchemaValidationError(
      "invalid-acquisition-date",
      "acquisitionDate must be YYYY-MM-DD.",
      "SourceAsset",
      `${path}.acquisitionDate`,
    );
  }
  if (typeof o.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(o.sha256)) {
    throw new SchemaValidationError(
      "invalid-sha256",
      "sha256 must be a 64-character lowercase hex string.",
      "SourceAsset",
      `${path}.sha256`,
    );
  }
  if (typeof o.mimeType !== "string" || !o.mimeType.includes("/")) {
    throw new SchemaValidationError(
      "invalid-mime-type",
      "mimeType is required.",
      "SourceAsset",
      `${path}.mimeType`,
    );
  }
  if (typeof o.pageCount !== "number" || o.pageCount <= 0 || !Number.isInteger(o.pageCount)) {
    throw new SchemaValidationError(
      "invalid-page-count",
      "pageCount must be a positive integer.",
      "SourceAsset",
      `${path}.pageCount`,
    );
  }
  if (!Array.isArray(o.pageMapping) || o.pageMapping.length === 0) {
    throw new SchemaValidationError(
      "missing-page-mapping",
      "pageMapping must be a non-empty array.",
      "SourceAsset",
      `${path}.pageMapping`,
    );
  }

  // Validate rights
  const r = o.rights as Record<string, unknown>;
  if (!r || typeof r !== "object") {
    throw new SchemaValidationError(
      "missing-rights",
      "rights object is required.",
      "SourceAsset",
      `${path}.rights`,
    );
  }
  if (!RIGHTS_STATUS_VALUES.includes(r.status as RightsStatus)) {
    throw new SchemaValidationError(
      "invalid-rights-status",
      `Invalid rights status "${r.status}".`,
      "SourceAsset",
      `${path}.rights.status`,
    );
  }
  if (!REUSE_TERMS_VALUES.includes(r.reuseTerms as ReuseTerms)) {
    throw new SchemaValidationError(
      "invalid-reuse-terms",
      `Invalid reuse terms "${r.reuseTerms}".`,
      "SourceAsset",
      `${path}.rights.reuseTerms`,
    );
  }
  if (typeof r.statement !== "string") {
    throw new SchemaValidationError(
      "missing-rights-statement",
      "rights.statement is required.",
      "SourceAsset",
      `${path}.rights.statement`,
    );
  }

  // Validate publication decision & cloud processing
  if (!PUBLICATION_DECISION_VALUES.includes(o.publicationDecision as PublicationDecision)) {
    throw new SchemaValidationError(
      "invalid-publication-decision",
      `Invalid publication decision "${o.publicationDecision}".`,
      "SourceAsset",
      `${path}.publicationDecision`,
    );
  }
  if (!CLOUD_PROCESSING_VALUES.includes(o.cloudProcessing as CloudProcessing)) {
    throw new SchemaValidationError(
      "invalid-cloud-processing",
      `Invalid cloud processing "${o.cloudProcessing}".`,
      "SourceAsset",
      `${path}.cloudProcessing`,
    );
  }
  if (typeof o.cloudProcessingBasis !== "string" || !o.cloudProcessingBasis.trim()) {
    throw new SchemaValidationError(
      "missing-cloud-processing-basis",
      "cloudProcessingBasis is required.",
      "SourceAsset",
      `${path}.cloudProcessingBasis`,
    );
  }

  // Validate path rules
  if (o.path !== undefined) {
    if (typeof o.path !== "string") {
      throw new SchemaValidationError(
        "invalid-path",
        "path must be a string.",
        "SourceAsset",
        `${path}.path`,
      );
    }
    if (o.publicationDecision === "publish" && !o.path.startsWith("public/")) {
      throw new SchemaValidationError(
        "invalid-publish-path",
        `A publish asset path must lie under public/, got "${o.path}".`,
        "SourceAsset",
        `${path}.path`,
      );
    }
    if (
      o.publicationDecision === "pin-local-only" &&
      !o.path.startsWith("sources/pinned/") &&
      !o.path.startsWith("sources/")
    ) {
      throw new SchemaValidationError(
        "invalid-pin-local-path",
        `A pin-local-only asset path must lie under sources/, got "${o.path}".`,
        "SourceAsset",
        `${path}.path`,
      );
    }
    if (o.publicationDecision === "reference-only") {
      throw new SchemaValidationError(
        "unexpected-path",
        `A reference-only asset must not have a path, got "${o.path}".`,
        "SourceAsset",
        `${path}.path`,
      );
    }
  }

  // Load rights vocabulary and enforce required fields & constraints
  const vocab = loadRightsVocabulary();

  // Enforce required fields per rights.status
  const statusReqFields = requiredFieldsFor(vocab, "rightsStatus", r.status as string);
  for (const field of statusReqFields) {
    if (
      field === "rights.statement" &&
      (!r.statement || typeof r.statement !== "string" || !r.statement.trim())
    ) {
      throw new SchemaValidationError(
        "missing-required-rights-field",
        `Missing required field "${field}" for rights status "${r.status}".`,
        "SourceAsset",
        `${path}.rights.statement`,
      );
    }
    if (
      field === "rights.source" &&
      (!r.source || typeof r.source !== "string" || !r.source.trim())
    ) {
      throw new SchemaValidationError(
        "missing-required-rights-field",
        `Missing required field "${field}" for rights status "${r.status}".`,
        "SourceAsset",
        `${path}.rights.source`,
      );
    }
    if (
      field === "rights.credit" &&
      (!r.credit || typeof r.credit !== "string" || !r.credit.trim())
    ) {
      throw new SchemaValidationError(
        "missing-required-rights-field",
        `Missing required field "${field}" for rights status "${r.status}".`,
        "SourceAsset",
        `${path}.rights.credit`,
      );
    }
    if (
      field === "rights.recordedAt" &&
      (!r.recordedAt || typeof r.recordedAt !== "string" || !r.recordedAt.trim())
    ) {
      throw new SchemaValidationError(
        "missing-required-rights-field",
        `Missing required field "${field}" for rights status "${r.status}".`,
        "SourceAsset",
        `${path}.rights.recordedAt`,
      );
    }
  }

  // Enforce required fields per publicationDecision
  const pubReqFields = requiredFieldsFor(
    vocab,
    "publicationDecision",
    o.publicationDecision as string,
  );
  for (const field of pubReqFields) {
    if (
      field === "publicationReason" &&
      (!o.publicationReason ||
        typeof o.publicationReason !== "string" ||
        !o.publicationReason.trim())
    ) {
      throw new SchemaValidationError(
        "missing-publication-reason",
        `publicationReason is required when publicationDecision is "${o.publicationDecision}".`,
        "SourceAsset",
        `${path}.publicationReason`,
      );
    }
  }

  // Enforce required fields per reuseTerms
  const reuseReqFields = requiredFieldsFor(vocab, "reuseTerms", r.reuseTerms as string);
  for (const field of reuseReqFields) {
    if (
      field === "rights.source" &&
      (!r.source || typeof r.source !== "string" || !r.source.trim())
    ) {
      throw new SchemaValidationError(
        "missing-required-rights-field",
        `Missing required field "${field}" for reuseTerms "${r.reuseTerms}".`,
        "SourceAsset",
        `${path}.rights.source`,
      );
    }
    if (
      field === "rights.statement" &&
      (!r.statement || typeof r.statement !== "string" || !r.statement.trim())
    ) {
      throw new SchemaValidationError(
        "missing-required-rights-field",
        `Missing required field "${field}" for reuseTerms "${r.reuseTerms}".`,
        "SourceAsset",
        `${path}.rights.statement`,
      );
    }
  }

  // Enforce vocabulary constraints
  const constraintViolations = checkConstraints(vocab, {
    ...o,
    rights: r,
    licenseDecisionPending: true,
  });
  const firstViolation = constraintViolations[0];
  if (firstViolation) {
    throw new SchemaValidationError(firstViolation.id, firstViolation.message, "SourceAsset", path);
  }

  return {
    originUrl: o.originUrl,
    acquisitionDate: o.acquisitionDate,
    sha256: o.sha256,
    mimeType: o.mimeType,
    pageCount: o.pageCount,
    pageMapping: o.pageMapping as PageMapEntry[],
    rights: {
      status: r.status as RightsStatus,
      statement: r.statement,
      source: (r.source as string) || o.originUrl,
      recordedAt: (r.recordedAt as string) || o.acquisitionDate,
      reuseTerms: r.reuseTerms as ReuseTerms,
      ...(r.credit ? { credit: r.credit as string } : {}),
    },
    publicationDecision: o.publicationDecision as PublicationDecision,
    ...(o.publicationReason ? { publicationReason: o.publicationReason as string } : {}),
    cloudProcessing: o.cloudProcessing as CloudProcessing,
    cloudProcessingBasis: o.cloudProcessingBasis,
    ...(o.parentSha256 ? { parentSha256: o.parentSha256 as string } : {}),
    ...(o.parentPageIndices ? { parentPageIndices: o.parentPageIndices as number[] } : {}),
    ...(typeof o.path === "string" ? { path: o.path } : {}),
    ...(typeof o.embeddedTextLayer === "string"
      ? { embeddedTextLayer: o.embeddedTextLayer as "present" | "absent" | "unknown" }
      : {}),
  };
}

// 3. SOURCE BLOCK

export type BlockLocator = Readonly<{
  pdfPageIndex: number;
  printedPage: number;
  region?: Readonly<{ x: number; y: number; width: number; height: number }> | undefined;
}>;

export type SentenceSpan = Readonly<{
  id: string;
  span: SpanAnchor;
}>;

export type SourceBlockStatus = Readonly<{
  transcription: "not-started" | "draft" | "proofed" | "reviewed";
  mathTranscription: "not-started" | "draft" | "proofed" | "reviewed" | "not-applicable";
  translation: "not-started" | "draft" | "aligned" | "reviewed";
  review: "draft" | "in-progress" | "reviewed" | "accepted";
}>;

export type SourceBlock = Readonly<{
  id: string;
  kind: SourceBlockKind;
  paper: string;
  section?: string | undefined;
  order: number;
  locators: readonly BlockLocator[];
  /** Where the text crosses onto each later page of the locators (pageTurns.ts). */
  pageTurns?: readonly PageTurn[] | undefined;
  originalLabel?: string | undefined;
  editorialLabel?: string | undefined;
  diplomaticText: string;
  inlines: readonly Inline[];
  sentenceSpans: readonly SentenceSpan[];
  revision: number;
  status: SourceBlockStatus;
  containedIn?: string | undefined;
  lang?: string | undefined;
  dir?: TextDirection | undefined;
}>;

export function validateSourceBlock(raw: unknown, path = "SourceBlock"): SourceBlock {
  if (!raw || typeof raw !== "object")
    throw new SchemaValidationError(
      "invalid-record",
      "SourceBlock must be an object.",
      "SourceBlock",
      path,
    );
  const o = raw as Record<string, unknown>;

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new SchemaValidationError("missing-id", "id is required.", "SourceBlock", `${path}.id`);
  }
  if (!SOURCE_BLOCK_KINDS.includes(o.kind as SourceBlockKind)) {
    throw new SchemaValidationError(
      "invalid-kind",
      `Invalid block kind "${o.kind}".`,
      "SourceBlock",
      `${path}.kind`,
    );
  }
  if (!Array.isArray(o.locators) || o.locators.length === 0) {
    throw new SchemaValidationError(
      "missing-locators",
      "locators array is required and must cover every printed page.",
      "SourceBlock",
      `${path}.locators`,
    );
  }

  const locators: BlockLocator[] = [];
  let prevPdfPageIndex = 0;
  for (let i = 0; i < o.locators.length; i++) {
    const loc = o.locators[i] as Record<string, unknown>;
    const locPath = `${path}.locators[${i}]`;
    if (!loc || typeof loc !== "object") {
      throw new SchemaValidationError(
        "invalid-locator",
        "locator must be an object.",
        "SourceBlock",
        locPath,
      );
    }
    if (
      typeof loc.pdfPageIndex !== "number" ||
      !Number.isInteger(loc.pdfPageIndex) ||
      loc.pdfPageIndex < 1
    ) {
      throw new SchemaValidationError(
        "invalid-pdf-page-index",
        `pdfPageIndex must be a 1-based positive integer, got ${loc.pdfPageIndex}.`,
        "SourceBlock",
        `${locPath}.pdfPageIndex`,
      );
    }
    if (typeof loc.printedPage !== "number") {
      throw new SchemaValidationError(
        "invalid-printed-page",
        `printedPage must be a number, got ${loc.printedPage}.`,
        "SourceBlock",
        `${locPath}.printedPage`,
      );
    }
    if (loc.pdfPageIndex <= prevPdfPageIndex) {
      throw new SchemaValidationError(
        "locators-not-ordered",
        `locators must be strictly increasing by pdfPageIndex: got ${loc.pdfPageIndex} after ${prevPdfPageIndex}.`,
        "SourceBlock",
        `${locPath}.pdfPageIndex`,
      );
    }
    prevPdfPageIndex = loc.pdfPageIndex;

    let region: { x: number; y: number; width: number; height: number } | undefined;
    if (loc.region !== undefined) {
      const reg = loc.region as Record<string, unknown>;
      if (
        !reg ||
        typeof reg.x !== "number" ||
        typeof reg.y !== "number" ||
        typeof reg.width !== "number" ||
        typeof reg.height !== "number"
      ) {
        throw new SchemaValidationError(
          "invalid-locator-region",
          "locator region must have numeric x, y, width, height.",
          "SourceBlock",
          `${locPath}.region`,
        );
      }
      region = {
        x: reg.x,
        y: reg.y,
        width: reg.width,
        height: reg.height,
      };
    }

    locators.push({
      pdfPageIndex: loc.pdfPageIndex,
      printedPage: loc.printedPage,
      ...(region ? { region } : {}),
    });
  }

  let containedIn: string | undefined;
  if (o.containedIn !== undefined) {
    if (typeof o.containedIn !== "string" || !o.containedIn.trim()) {
      throw new SchemaValidationError(
        "invalid-contained-in",
        "containedIn must be a non-empty string.",
        "SourceBlock",
        `${path}.containedIn`,
      );
    }
    containedIn = o.containedIn.trim();
  }

  if (typeof o.revision !== "number" || o.revision <= 0 || !Number.isInteger(o.revision)) {
    throw new SchemaValidationError(
      "invalid-revision",
      "revision must be a positive integer.",
      "SourceBlock",
      `${path}.revision`,
    );
  }

  let lang: string | undefined;
  if (o.lang !== undefined) {
    try {
      lang = validateLanguageTag(o.lang, `${path}.lang`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new SchemaValidationError(
        "invalid-language-tag",
        message,
        "SourceBlock",
        `${path}.lang`,
      );
    }
  }

  let dir: TextDirection | undefined;
  if (o.dir !== undefined) {
    try {
      dir = validateDirection(o.dir, `${path}.dir`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new SchemaValidationError("invalid-direction", message, "SourceBlock", `${path}.dir`);
    }
  }

  // Validate status fields: must be separate fields
  const st = o.status as Record<string, unknown>;
  if (!st || typeof st !== "object") {
    throw new SchemaValidationError(
      "missing-status-block",
      "status must be an object with separate status fields.",
      "SourceBlock",
      `${path}.status`,
    );
  }
  if (!["not-started", "draft", "proofed", "reviewed"].includes(st.transcription as string)) {
    throw new SchemaValidationError(
      "invalid-transcription-status",
      `Invalid transcription status "${st.transcription}".`,
      "SourceBlock",
      `${path}.status.transcription`,
    );
  }
  if (
    !["not-started", "draft", "proofed", "reviewed", "not-applicable"].includes(
      st.mathTranscription as string,
    )
  ) {
    throw new SchemaValidationError(
      "invalid-math-status",
      `Invalid mathTranscription status "${st.mathTranscription}".`,
      "SourceBlock",
      `${path}.status.mathTranscription`,
    );
  }
  if (!["not-started", "draft", "aligned", "reviewed"].includes(st.translation as string)) {
    throw new SchemaValidationError(
      "invalid-translation-status",
      `Invalid translation status "${st.translation}".`,
      "SourceBlock",
      `${path}.status.translation`,
    );
  }
  if (!["draft", "in-progress", "reviewed", "accepted"].includes(st.review as string)) {
    throw new SchemaValidationError(
      "invalid-review-status",
      `Invalid review status "${st.review}".`,
      "SourceBlock",
      `${path}.status.review`,
    );
  }

  const inlines = Array.isArray(o.inlines)
    ? o.inlines.map((inl, i) => validateInline(inl, `${path}.inlines[${i}]`))
    : [];
  const text = plainText(inlines);

  // Validate sentence spans
  const sentenceSpans: SentenceSpan[] = [];
  if (Array.isArray(o.sentenceSpans)) {
    for (let i = 0; i < o.sentenceSpans.length; i++) {
      const sp = o.sentenceSpans[i] as Record<string, unknown>;
      const p = `${path}.sentenceSpans[${i}]`;
      if (!sp || typeof sp.id !== "string")
        throw new SchemaValidationError(
          "missing-span-id",
          "sentenceSpan id is required.",
          "SourceBlock",
          p,
        );
      const spanAnchor = validateSpanAnchor(sp.span, text, o.revision as number, `${p}.span`);
      sentenceSpans.push({ id: sp.id, span: spanAnchor });
    }
  }

  if (["heading", "part-heading", "footnote", "closing"].includes(o.kind as string)) {
    if (sentenceSpans.length !== 1) {
      throw new SchemaValidationError(
        "invalid-span-count",
        `Block kind "${o.kind}" must have exactly one sentence span, got ${sentenceSpans.length}.`,
        "SourceBlock",
        `${path}.sentenceSpans`,
      );
    }
  }
  if (o.kind === "equation") {
    if (sentenceSpans.length > 0) {
      throw new SchemaValidationError(
        "equation-spans-forbidden",
        "Equation blocks must not carry sentence spans.",
        "SourceBlock",
        `${path}.sentenceSpans`,
      );
    }
  }

  const pageTurns = validatePageTurns(o.pageTurns, locators, text, `${path}.pageTurns`);

  return {
    id: o.id,
    kind: o.kind as SourceBlockKind,
    paper: (o.paper as string) || "",
    section: (o.section as string) || undefined,
    order: typeof o.order === "number" ? o.order : 0,
    locators,
    ...(pageTurns.length > 0 ? { pageTurns } : {}),
    originalLabel: (o.originalLabel as string) || undefined,
    editorialLabel: (o.editorialLabel as string) || undefined,
    diplomaticText: (o.diplomaticText as string) || text,
    inlines,
    sentenceSpans,
    revision: o.revision as number,
    status: {
      transcription: st.transcription as SourceBlockStatus["transcription"],
      mathTranscription: st.mathTranscription as SourceBlockStatus["mathTranscription"],
      translation: st.translation as SourceBlockStatus["translation"],
      review: st.review as SourceBlockStatus["review"],
    },
    ...(containedIn ? { containedIn } : {}),
    ...(lang ? { lang } : {}),
    ...(dir ? { dir } : {}),
  };
}

// 4. TRANSLATION UNIT
export type UnresolvedAlternative = Readonly<{
  text: string;
  rationale: string;
}>;

type TranslationUnitFields = Readonly<{
  id: string;
  sourceRefs: readonly Readonly<{ paper: string; id: string }>[];
  inlines: readonly Inline[];
  translator: AuthorshipEntry;
  editor?: AuthorshipEntry | undefined;
  revision: number;
  unresolvedAlternatives: readonly UnresolvedAlternative[];
  reviewState: "draft" | "machine-draft" | "in-progress" | "corrected" | "reviewed";
  lang: string;
  dir?: TextDirection | undefined;
}>;

export function validateTranslationUnit(raw: unknown, path = "TranslationUnit"): TranslationUnit {
  if (!raw || typeof raw !== "object")
    throw new SchemaValidationError(
      "invalid-record",
      "TranslationUnit must be an object.",
      "TranslationUnit",
      path,
    );
  const o = raw as Record<string, unknown>;

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new SchemaValidationError(
      "missing-id",
      "id is required.",
      "TranslationUnit",
      `${path}.id`,
    );
  }
  if (!Array.isArray(o.sourceRefs) || o.sourceRefs.length === 0) {
    throw new SchemaValidationError(
      "missing-source-refs",
      "sourceRefs must contain one or more source block or sentence references.",
      "TranslationUnit",
      `${path}.sourceRefs`,
    );
  }
  if (typeof o.revision !== "number" || o.revision <= 0 || !Number.isInteger(o.revision)) {
    throw new SchemaValidationError(
      "invalid-revision",
      "revision must be a positive integer.",
      "TranslationUnit",
      `${path}.revision`,
    );
  }

  if (typeof o.lang !== "string" || !o.lang.trim()) {
    throw new SchemaValidationError(
      "missing-lang",
      "lang is required for TranslationUnit.",
      "TranslationUnit",
      `${path}.lang`,
    );
  }
  let lang: string;
  try {
    lang = validateLanguageTag(o.lang, `${path}.lang`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new SchemaValidationError(
      "invalid-language-tag",
      message,
      "TranslationUnit",
      `${path}.lang`,
    );
  }

  let dir: TextDirection | undefined;
  if (o.dir !== undefined) {
    try {
      dir = validateDirection(o.dir, `${path}.dir`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new SchemaValidationError(
        "invalid-direction",
        message,
        "TranslationUnit",
        `${path}.dir`,
      );
    }
  }

  const reviewState = o.reviewState as string;
  if (!["draft", "machine-draft", "in-progress", "corrected", "reviewed"].includes(reviewState)) {
    throw new SchemaValidationError(
      "invalid-review-state",
      `Invalid reviewState "${reviewState}".`,
      "TranslationUnit",
      `${path}.reviewState`,
    );
  }

  const translator = validateAuthorshipEntry(o.translator, "translator", `${path}.translator`);
  let editor: AuthorshipEntry | undefined;
  const agentReview = agentReviewOf(o.agentReview, reviewState, translator.id, path);
  if ((reviewState === "corrected" || reviewState === "reviewed") && !agentReview) {
    if (!o.editor) {
      throw new SchemaValidationError(
        "missing-editor",
        `reviewState "${reviewState}" requires an editor attribution.`,
        "TranslationUnit",
        `${path}.editor`,
      );
    }
    editor = validateAuthorshipEntry(o.editor, "editor", `${path}.editor`);
  } else if (o.editor) {
    editor = validateAuthorshipEntry(o.editor, "editor", `${path}.editor`);
  }

  const inlines = Array.isArray(o.inlines)
    ? o.inlines.map((inl, i) => validateInline(inl, `${path}.inlines[${i}]`))
    : [];
  const unresolvedAlternatives = Array.isArray(o.unresolvedAlternatives)
    ? (o.unresolvedAlternatives as UnresolvedAlternative[])
    : [];

  return withAgentReview(agentReview, {
    id: o.id,
    sourceRefs: o.sourceRefs as { paper: string; id: string }[],
    inlines,
    translator,
    editor,
    revision: o.revision as number,
    unresolvedAlternatives,
    reviewState: reviewState as TranslationUnit["reviewState"],
    lang,
    ...(dir ? { dir } : {}),
  });
}

// 5. ALIGNMENT
export type AlignmentEdge = Readonly<{
  source: Readonly<{
    paper: string;
    blockId: string;
    sentenceId?: string | undefined;
    range?: SpanAnchor | undefined;
  }>;
  target: Readonly<{
    translationUnitId: string;
    range?: SpanAnchor | undefined;
  }>;
}>;

export type Alignment = Readonly<{
  id: string;
  paper: string;
  edges: readonly AlignmentEdge[];
}>;

export function validateAlignment(raw: unknown, path = "Alignment"): Alignment {
  if (!raw || typeof raw !== "object")
    throw new SchemaValidationError(
      "invalid-record",
      "Alignment must be an object.",
      "Alignment",
      path,
    );
  const o = raw as Record<string, unknown>;

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new SchemaValidationError("missing-id", "id is required.", "Alignment", `${path}.id`);
  }
  if (!Array.isArray(o.edges) || o.edges.length === 0) {
    throw new SchemaValidationError(
      "missing-edges",
      "edges must be a non-empty array of many-to-many alignment edges.",
      "Alignment",
      `${path}.edges`,
    );
  }

  const edges: AlignmentEdge[] = o.edges.map((e, i) => {
    if (!e || typeof e !== "object")
      throw new SchemaValidationError(
        "invalid-edge",
        "Edge must be an object.",
        "Alignment",
        `${path}.edges[${i}]`,
      );
    const edge = e as Record<string, unknown>;
    const src = edge.source as Record<string, unknown>;
    const tgt = edge.target as Record<string, unknown>;

    if (!src || typeof src.paper !== "string" || typeof src.blockId !== "string") {
      throw new SchemaValidationError(
        "invalid-edge-source",
        "edge.source requires paper and blockId.",
        "Alignment",
        `${path}.edges[${i}].source`,
      );
    }
    if (!tgt || typeof tgt.translationUnitId !== "string") {
      throw new SchemaValidationError(
        "invalid-edge-target",
        "edge.target requires translationUnitId.",
        "Alignment",
        `${path}.edges[${i}].target`,
      );
    }

    return {
      source: {
        paper: src.paper as string,
        blockId: src.blockId as string,
        sentenceId: (src.sentenceId as string) || undefined,
        range: (src.range as SpanAnchor) || undefined,
      },
      target: {
        translationUnitId: tgt.translationUnitId as string,
        range: (tgt.range as SpanAnchor) || undefined,
      },
    };
  });

  return {
    id: o.id,
    paper: (o.paper as string) || "",
    edges,
  };
}

// 6. GLOSS UNIT

export type GlossToken = Readonly<{
  german: string;
  english?: string | undefined;
  lemma?: string | undefined;
  grammarNote?: string | undefined;
  noteClass?: GlossNoteClass | undefined;
  contextual?: boolean | undefined;
  reason?: string | undefined;
}>;

export type MultiwordUnit = Readonly<{
  tokenIndices: readonly number[];
  english: string;
  kind: MultiwordUnitKind;
  grammarNote?: string | undefined;
  noteClass?: GlossNoteClass | undefined;
}>;

export type GlossUnit = Readonly<{
  sentenceId: string;
  revision: number;
  sourceRevision: number;
  sourceTextDigest: string;
  lang: string;
  sourceLang: string;
  attribution: AuthorshipEntry;
  editor?: AuthorshipEntry | undefined;
  reviewState: "draft" | "machine-draft" | "in-progress" | "corrected" | "reviewed";
  tokens: readonly GlossToken[];
  multiwordUnits: readonly MultiwordUnit[];
  dir?: TextDirection | undefined;
}>;

export function validateGlossUnit(raw: unknown, path = "GlossUnit"): GlossUnit {
  if (!raw || typeof raw !== "object")
    throw new SchemaValidationError(
      "invalid-record",
      "GlossUnit must be an object.",
      "GlossUnit",
      path,
    );
  const o = raw as Record<string, unknown>;

  if (typeof o.sentenceId !== "string" || !o.sentenceId.trim()) {
    throw new SchemaValidationError(
      "missing-sentence-id",
      "sentenceId is required.",
      "GlossUnit",
      `${path}.sentenceId`,
    );
  }
  if (typeof o.revision !== "number" || o.revision <= 0 || !Number.isInteger(o.revision)) {
    throw new SchemaValidationError(
      "invalid-revision",
      "revision must be a positive integer.",
      "GlossUnit",
      `${path}.revision`,
    );
  }
  if (
    typeof o.sourceRevision !== "number" ||
    o.sourceRevision <= 0 ||
    !Number.isInteger(o.sourceRevision)
  ) {
    throw new SchemaValidationError(
      "missing-source-revision",
      "sourceRevision is required and must be a positive integer.",
      "GlossUnit",
      `${path}.sourceRevision`,
    );
  }
  if (typeof o.sourceTextDigest !== "string" || !o.sourceTextDigest.trim()) {
    throw new SchemaValidationError(
      "missing-source-text-digest",
      "sourceTextDigest is required.",
      "GlossUnit",
      `${path}.sourceTextDigest`,
    );
  }

  if (typeof o.lang !== "string" || !o.lang.trim()) {
    throw new SchemaValidationError(
      "missing-lang",
      "lang is required for GlossUnit.",
      "GlossUnit",
      `${path}.lang`,
    );
  }
  let lang: string;
  try {
    lang = validateLanguageTag(o.lang, `${path}.lang`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new SchemaValidationError("invalid-language-tag", message, "GlossUnit", `${path}.lang`);
  }

  if (typeof o.sourceLang !== "string" || !o.sourceLang.trim()) {
    throw new SchemaValidationError(
      "missing-source-lang",
      "sourceLang is required for GlossUnit.",
      "GlossUnit",
      `${path}.sourceLang`,
    );
  }
  let sourceLang: string;
  try {
    sourceLang = validateLanguageTag(o.sourceLang, `${path}.sourceLang`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new SchemaValidationError(
      "invalid-language-tag",
      message,
      "GlossUnit",
      `${path}.sourceLang`,
    );
  }

  if (!o.attribution) {
    throw new SchemaValidationError(
      "missing-attribution",
      "attribution is required for GlossUnit.",
      "GlossUnit",
      `${path}.attribution`,
    );
  }
  const attribution = validateAuthorshipEntry(o.attribution, "author", `${path}.attribution`);
  const editor = o.editor
    ? validateAuthorshipEntry(o.editor, "editor", `${path}.editor`)
    : undefined;

  if (!Array.isArray(o.tokens) || o.tokens.length === 0) {
    throw new SchemaValidationError(
      "missing-tokens",
      "tokens array is required.",
      "GlossUnit",
      `${path}.tokens`,
    );
  }

  let dir: TextDirection | undefined;
  if (o.dir !== undefined) {
    try {
      dir = validateDirection(o.dir, `${path}.dir`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new SchemaValidationError("invalid-direction", message, "GlossUnit", `${path}.dir`);
    }
  }

  const reviewState = (o.reviewState as string) || "draft";
  if (!["draft", "machine-draft", "in-progress", "corrected", "reviewed"].includes(reviewState)) {
    throw new SchemaValidationError(
      "invalid-review-state",
      `Invalid reviewState "${reviewState}".`,
      "GlossUnit",
      `${path}.reviewState`,
    );
  }

  const tokens: GlossToken[] = o.tokens.map((t, i) => {
    if (!t || typeof t !== "object")
      throw new SchemaValidationError(
        "invalid-token",
        "Token must be an object.",
        "GlossUnit",
        `${path}.tokens[${i}]`,
      );
    const tok = t as Record<string, unknown>;
    if (typeof tok.german !== "string")
      throw new SchemaValidationError(
        "missing-german-token",
        "german word is required.",
        "GlossUnit",
        `${path}.tokens[${i}].german`,
      );
    if (tok.grammarNote && !tok.noteClass) {
      throw new SchemaValidationError(
        "missing-note-class",
        "noteClass is required whenever grammarNote is present.",
        "GlossUnit",
        `${path}.tokens[${i}].noteClass`,
      );
    }
    if (tok.noteClass !== undefined) {
      if (
        typeof tok.noteClass !== "string" ||
        !(GLOSS_NOTE_CLASSES as readonly string[]).includes(tok.noteClass)
      ) {
        throw new SchemaValidationError(
          "unlisted-note-class",
          `Unlisted noteClass "${tok.noteClass}".`,
          "GlossUnit",
          `${path}.tokens[${i}].noteClass`,
        );
      }
    }
    if (tok.contextual && (!tok.reason || typeof tok.reason !== "string" || !tok.reason.trim())) {
      throw new SchemaValidationError(
        "missing-contextual-reason",
        "reason is required when contextual: true.",
        "GlossUnit",
        `${path}.tokens[${i}].reason`,
      );
    }
    return {
      german: tok.german,
      english: (tok.english as string) || undefined,
      lemma: (tok.lemma as string) || undefined,
      grammarNote: (tok.grammarNote as string) || undefined,
      noteClass: (tok.noteClass as GlossNoteClass) || undefined,
      contextual: Boolean(tok.contextual) || undefined,
      reason: (tok.reason as string) || undefined,
    };
  });

  const multiwordUnits: MultiwordUnit[] = Array.isArray(o.multiwordUnits)
    ? o.multiwordUnits.map((m, i) => {
        const mw = m as Record<string, unknown>;
        if (!mw || typeof mw !== "object") {
          throw new SchemaValidationError(
            "invalid-multiword-unit",
            "Multiword unit must be an object.",
            "GlossUnit",
            `${path}.multiwordUnits[${i}]`,
          );
        }
        if (
          !Array.isArray(mw.tokenIndices) ||
          mw.tokenIndices.length < 2 ||
          mw.tokenIndices.some(
            (idx) =>
              typeof idx !== "number" || !Number.isInteger(idx) || idx < 0 || idx >= tokens.length,
          )
        ) {
          throw new SchemaValidationError(
            "invalid-multiword-indices",
            "Multiword unit requires at least two valid token indices.",
            "GlossUnit",
            `${path}.multiwordUnits[${i}].tokenIndices`,
          );
        }
        if (typeof mw.english !== "string" || !mw.english.trim()) {
          throw new SchemaValidationError(
            "missing-multiword-english",
            "Multiword unit english translation is required.",
            "GlossUnit",
            `${path}.multiwordUnits[${i}].english`,
          );
        }
        if (
          typeof mw.kind !== "string" ||
          !(MULTIWORD_UNIT_KINDS as readonly string[]).includes(mw.kind as MultiwordUnitKind)
        ) {
          throw new SchemaValidationError(
            "invalid-multiword-kind",
            `Invalid multiword unit kind "${mw.kind}".`,
            "GlossUnit",
            `${path}.multiwordUnits[${i}].kind`,
          );
        }
        if (mw.noteClass !== undefined) {
          if (
            typeof mw.noteClass !== "string" ||
            !(GLOSS_NOTE_CLASSES as readonly string[]).includes(mw.noteClass)
          ) {
            throw new SchemaValidationError(
              "unlisted-note-class",
              `Unlisted noteClass "${mw.noteClass}".`,
              "GlossUnit",
              `${path}.multiwordUnits[${i}].noteClass`,
            );
          }
        }
        return {
          tokenIndices: mw.tokenIndices as number[],
          english: mw.english as string,
          kind: mw.kind as MultiwordUnitKind,
          grammarNote: (mw.grammarNote as string) || undefined,
          noteClass: (mw.noteClass as GlossNoteClass) || undefined,
        };
      })
    : [];

  return {
    sentenceId: o.sentenceId,
    revision: o.revision as number,
    sourceRevision: o.sourceRevision as number,
    sourceTextDigest: o.sourceTextDigest as string,
    lang,
    sourceLang,
    attribution,
    editor,
    reviewState: reviewState as GlossUnit["reviewState"],
    tokens,
    multiwordUnits,
    ...(dir ? { dir } : {}),
  };
}

// 7. EDITORIAL NOTE

export type SourceSupport = Readonly<{
  citationId: string;
  locator?: string | undefined;
  role?: "primary" | "secondary" | undefined;
}>;

export type EditorialNote = Readonly<{
  id: string;
  author: AuthorshipEntry;
  claim: string;
  sourceSupport: readonly SourceSupport[];
  kind: EditorialNoteKind;
  affectedIds: readonly string[];
  reviewState: "draft" | "machine-draft" | "in-progress" | "corrected" | "reviewed";
  originalReading?: string | undefined;
  proposedReading?: string | undefined;
  reasoning?: string | undefined;
  evidence?: string | undefined;
  layer?: "source" | "translation" | undefined;
  lang?: string | undefined;
  dir?: TextDirection | undefined;
}>;

export function validateEditorialNote(raw: unknown, path = "EditorialNote"): EditorialNote {
  if (!raw || typeof raw !== "object")
    throw new SchemaValidationError(
      "invalid-record",
      "EditorialNote must be an object.",
      "EditorialNote",
      path,
    );
  const o = raw as Record<string, unknown>;

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new SchemaValidationError("missing-id", "id is required.", "EditorialNote", `${path}.id`);
  }
  if (!EDITORIAL_NOTE_KINDS.includes(o.kind as EditorialNoteKind)) {
    throw new SchemaValidationError(
      "invalid-kind",
      `Invalid note kind "${o.kind}".`,
      "EditorialNote",
      `${path}.kind`,
    );
  }
  if (typeof o.claim !== "string" || !o.claim.trim()) {
    throw new SchemaValidationError(
      "missing-claim",
      "claim is required.",
      "EditorialNote",
      `${path}.claim`,
    );
  }

  let lang: string | undefined;
  if (o.lang !== undefined) {
    try {
      lang = validateLanguageTag(o.lang, `${path}.lang`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new SchemaValidationError(
        "invalid-language-tag",
        message,
        "EditorialNote",
        `${path}.lang`,
      );
    }
  }

  let dir: TextDirection | undefined;
  if (o.dir !== undefined) {
    try {
      dir = validateDirection(o.dir, `${path}.dir`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new SchemaValidationError("invalid-direction", message, "EditorialNote", `${path}.dir`);
    }
  }

  const author = validateAuthorshipEntry(o.author, "author", `${path}.author`);

  const kind = o.kind as EditorialNoteKind;
  const sourceSupport = Array.isArray(o.sourceSupport) ? (o.sourceSupport as SourceSupport[]) : [];

  if (kind === "dispute") {
    const hasPrimary = sourceSupport.some((s) => s.role === "primary");
    if (!hasPrimary) {
      throw new SchemaValidationError(
        "dispute-requires-primary-source",
        'EditorialNote of kind "dispute" requires at least one sourceSupport entry with role: "primary".',
        "EditorialNote",
        `${path}.sourceSupport`,
      );
    }
  }

  if (kind === "correction" || kind === "typographical") {
    if (!o.originalReading || !o.proposedReading || !o.reasoning || !o.evidence) {
      throw new SchemaValidationError(
        "correction-fields-required",
        "correction or typographical notes require originalReading, proposedReading, reasoning, and evidence.",
        "EditorialNote",
        path,
      );
    }
    if (o.layer !== "source" && o.layer !== "translation") {
      throw new SchemaValidationError(
        "invalid-correction-layer",
        'correction note requires layer: "source" | "translation".',
        "EditorialNote",
        `${path}.layer`,
      );
    }
  }

  const reviewState = (o.reviewState as string) || "draft";
  if (!["draft", "machine-draft", "in-progress", "corrected", "reviewed"].includes(reviewState)) {
    throw new SchemaValidationError(
      "invalid-review-state",
      `Invalid reviewState "${reviewState}".`,
      "EditorialNote",
      `${path}.reviewState`,
    );
  }

  return {
    id: o.id as string,
    author,
    claim: o.claim as string,
    sourceSupport,
    kind,
    affectedIds: Array.isArray(o.affectedIds) ? (o.affectedIds as string[]) : [],
    reviewState: reviewState as EditorialNote["reviewState"],
    originalReading: (o.originalReading as string) || undefined,
    proposedReading: (o.proposedReading as string) || undefined,
    reasoning: (o.reasoning as string) || undefined,
    evidence: (o.evidence as string) || undefined,
    layer: (o.layer as EditorialNote["layer"]) || undefined,
    ...(lang ? { lang } : {}),
    ...(dir ? { dir } : {}),
  };
}

// 8. CITATION
export type Citation = Readonly<{
  id: string;
  type: string;
  title: string;
  author: readonly Readonly<{ family?: string; given?: string; literal?: string }>[] | string;
  containerTitle?: string | undefined;
  volume?: string | number | undefined;
  issue?: string | number | undefined;
  page?: string | undefined;
  issued?: PaperDate | string | undefined;
  doi?: string | undefined;
  url?: string | undefined;
  accessed?: PaperDate | undefined;
  role: "primary" | "comparison-witness" | "secondary" | "technical";
  locator?: Readonly<{ kind: "page" | "table" | "figure" | "section"; value: string }> | undefined;
}>;

export function validateCitation(raw: unknown, path = "Citation"): Citation {
  if (!raw || typeof raw !== "object")
    throw new SchemaValidationError(
      "invalid-record",
      "Citation must be an object.",
      "Citation",
      path,
    );
  const o = raw as Record<string, unknown>;

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new SchemaValidationError("missing-id", "id is required.", "Citation", `${path}.id`);
  }
  if (typeof o.title !== "string" || !o.title.trim()) {
    throw new SchemaValidationError(
      "missing-title",
      "title is required.",
      "Citation",
      `${path}.title`,
    );
  }
  if (!["primary", "comparison-witness", "secondary", "technical"].includes(o.role as string)) {
    throw new SchemaValidationError(
      "invalid-role",
      `Invalid citation role "${o.role}".`,
      "Citation",
      `${path}.role`,
    );
  }

  // accessed is required whenever url is present and doi is absent
  if (o.url && !o.doi && !o.accessed) {
    throw new SchemaValidationError(
      "accessed-date-required",
      "accessed date is required whenever URL is present and DOI is absent.",
      "Citation",
      `${path}.accessed`,
    );
  }

  const accessed = o.accessed
    ? validatePaperDate(o.accessed, o.id as string, `${path}.accessed`)
    : undefined;

  return {
    id: o.id,
    type: (o.type as string) || "article-journal",
    title: o.title,
    author: o.author as Citation["author"],
    containerTitle: (o.containerTitle as string) || undefined,
    volume: (o.volume as string | number) || undefined,
    issue: (o.issue as string | number) || undefined,
    page: (o.page as string) || undefined,
    issued: o.issued as Citation["issued"],
    doi: (o.doi as string) || undefined,
    url: (o.url as string) || undefined,
    accessed,
    role: o.role as Citation["role"],
    locator: (o.locator as Citation["locator"]) || undefined,
  };
}

/**
 * Checks that an equation in a translation unit is byte-identical to its source equation in German.
 * Enforces: Notation is never translated.
 */
export function verifyEquationTranslation(
  germanLatex: string,
  englishLatex: string,
  equationId = "equation",
): void {
  if (germanLatex !== englishLatex) {
    throw new SchemaValidationError(
      "equation-notation-translated",
      `Equation "${equationId}" translated notation differs from original German notation ("${englishLatex}" vs "${germanLatex}"). Notation must never be translated.`,
      "Equation",
      equationId,
    );
  }
}

// 9. TRANSLATION EDITION
export type TranslationEdition = Readonly<{
  language: string;
  paperId: string;
  editionId: string;
  title: string;
  translator: AuthorshipEntry;
  editor?: AuthorshipEntry | undefined;
  license: string;
  reviewState: "draft" | "machine-draft" | "in-progress" | "corrected" | "reviewed";
  units: readonly TranslationUnit[];
  missingUnitsNotice?: string | undefined;
}>;

export function validateTranslationEdition(
  raw: unknown,
  path = "TranslationEdition",
): TranslationEdition {
  if (!raw || typeof raw !== "object")
    throw new SchemaValidationError(
      "invalid-record",
      "TranslationEdition must be an object.",
      "TranslationEdition",
      path,
    );
  const o = raw as Record<string, unknown>;

  if (typeof o.editionId !== "string" || !o.editionId.trim()) {
    throw new SchemaValidationError(
      "missing-edition-id",
      "editionId is required.",
      "TranslationEdition",
      `${path}.editionId`,
    );
  }
  if (typeof o.paperId !== "string" || !o.paperId.trim()) {
    throw new SchemaValidationError(
      "missing-paper-id",
      "paperId is required.",
      "TranslationEdition",
      `${path}.paperId`,
    );
  }
  if (typeof o.title !== "string" || !o.title.trim()) {
    throw new SchemaValidationError(
      "missing-title",
      "title is required.",
      "TranslationEdition",
      `${path}.title`,
    );
  }
  if (typeof o.license !== "string" || !o.license.trim()) {
    throw new SchemaValidationError(
      "missing-license",
      "license is required.",
      "TranslationEdition",
      `${path}.license`,
    );
  }

  const rawLang = o.language ?? o.lang;
  if (typeof rawLang !== "string" || !rawLang.trim()) {
    throw new SchemaValidationError(
      "missing-language",
      "language is required.",
      "TranslationEdition",
      `${path}.language`,
    );
  }

  let language: string;
  try {
    language = validateLanguageTag(rawLang, `${path}.language`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new SchemaValidationError(
      "invalid-language-tag",
      message,
      "TranslationEdition",
      `${path}.language`,
    );
  }

  const reviewState = o.reviewState as string;
  if (!["draft", "machine-draft", "in-progress", "corrected", "reviewed"].includes(reviewState)) {
    throw new SchemaValidationError(
      "invalid-review-state",
      `Invalid reviewState "${reviewState}".`,
      "TranslationEdition",
      `${path}.reviewState`,
    );
  }

  const translator = validateAuthorshipEntry(o.translator, "translator", `${path}.translator`);
  const editor = o.editor
    ? validateAuthorshipEntry(o.editor, "editor", `${path}.editor`)
    : undefined;

  if (!Array.isArray(o.units)) {
    throw new SchemaValidationError(
      "missing-units",
      "units must be an array of TranslationUnits.",
      "TranslationEdition",
      `${path}.units`,
    );
  }
  const units = o.units.map((u, i) => validateTranslationUnit(u, `${path}.units[${i}]`));

  return {
    language,
    paperId: o.paperId as string,
    editionId: o.editionId as string,
    title: o.title as string,
    translator,
    editor,
    license: o.license as string,
    reviewState: reviewState as TranslationEdition["reviewState"],
    units,
    missingUnitsNotice: typeof o.missingUnitsNotice === "string" ? o.missingUnitsNotice : undefined,
  };
}

// AGENT REVIEW (D-2026-09-25). Kept at the end of the file so that no refusal site above it
// moves: the refusal ratchets cite those sites by line.
/**
 * The owner's ruling that agents bring English translations to final through fresh-eye review
 * rounds, with no human review gate (docs/DECISIONS.md D-2026-09-25-agent-reviewed-translations).
 * It covers translation units only; every other layer keeps its human-review rule.
 */
export const AGENT_REVIEW_BASIS = "D-2026-09-25-agent-reviewed-translations";

/** The fewest independent agent rounds a unit needs before it counts as checked. */
export const AGENT_REVIEW_MIN_ROUNDS = 2;

export type AgentReviewRound = Readonly<{ reviewer: AuthorshipEntry; date: string }>;
export type AgentReview = Readonly<{ basis: string; rounds: readonly AgentReviewRound[] }>;

/**
 * A unit's agent review, refused unless it states the ruling as its basis and holds at least two
 * rounds by distinct agents, none of them the unit's translator: a round by the translator is not
 * a fresh eye, and one round is not the "few" the ruling asks for.
 */
export function validateAgentReview(
  raw: unknown,
  translatorId: string,
  path = "TranslationUnit.agentReview",
): AgentReview {
  if (!raw || typeof raw !== "object")
    throw new SchemaValidationError(
      "invalid-agent-review",
      "agentReview must be an object.",
      "TranslationUnit",
      path,
    );
  const o = raw as Record<string, unknown>;
  if (o.basis !== AGENT_REVIEW_BASIS)
    throw new SchemaValidationError(
      "agent-review-basis",
      `agentReview.basis must be "${AGENT_REVIEW_BASIS}".`,
      "TranslationUnit",
      `${path}.basis`,
    );
  const rounds = Array.isArray(o.rounds) ? o.rounds : [];
  if (rounds.length < AGENT_REVIEW_MIN_ROUNDS)
    throw new SchemaValidationError(
      "agent-review-rounds",
      `agentReview needs at least ${AGENT_REVIEW_MIN_ROUNDS} review rounds; it has ${rounds.length}.`,
      "TranslationUnit",
      `${path}.rounds`,
    );
  const seen = new Set<string>();
  const parsed = rounds.map((round, i) => {
    const at = `${path}.rounds[${i}]`;
    const r = (round ?? {}) as Record<string, unknown>;
    const reviewer = validateAuthorshipEntry(r.reviewer, "author", `${at}.reviewer`);
    if (reviewer.kind !== "model")
      throw new SchemaValidationError(
        "agent-review-not-agent",
        `Round ${i + 1}'s reviewer must be an AI agent.`,
        "TranslationUnit",
        `${at}.reviewer`,
      );
    if (reviewer.id === translatorId)
      throw new SchemaValidationError(
        "agent-review-by-translator",
        `Round ${i + 1} is by the unit's translator.`,
        "TranslationUnit",
        `${at}.reviewer`,
      );
    if (seen.has(reviewer.id))
      throw new SchemaValidationError(
        "agent-review-repeat-reviewer",
        `${reviewer.id} reviews more than one round.`,
        "TranslationUnit",
        `${at}.reviewer`,
      );
    seen.add(reviewer.id);
    if (typeof r.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.date))
      throw new SchemaValidationError(
        "agent-review-date",
        `Round ${i + 1} needs a date as YYYY-MM-DD.`,
        "TranslationUnit",
        `${at}.date`,
      );
    return Object.freeze({ reviewer, date: r.date });
  });
  return Object.freeze({ basis: AGENT_REVIEW_BASIS, rounds: Object.freeze(parsed) });
}

export type TranslationUnit = TranslationUnitFields & AgentReviewed;

/** The optional field a translation unit carries when agents, not a person, checked it. */
export type AgentReviewed = Readonly<{ agentReview?: AgentReview | undefined }>;

/**
 * An agent review is the record of a FINAL translation, so it is only accepted on a unit marked
 * reviewed, and never beside a human editor: the two would claim different things about who
 * checked the English.
 */
function agentReviewOf(
  raw: unknown,
  reviewState: unknown,
  translatorId: string,
  path: string,
): AgentReview | undefined {
  if (raw === undefined) return undefined;
  if (reviewState !== "reviewed")
    throw new SchemaValidationError(
      "agent-review-state",
      `An agent review is recorded only on a unit marked reviewed, not "${String(reviewState)}".`,
      "TranslationUnit",
      `${path}.agentReview`,
    );
  return validateAgentReview(raw, translatorId, `${path}.agentReview`);
}

function withAgentReview<T extends object>(
  agentReview: AgentReview | undefined,
  unit: T,
): T & AgentReviewed {
  return agentReview ? { ...unit, agentReview } : unit;
}
