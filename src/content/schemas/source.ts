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
import {
  type AuthorshipBlock,
  type AuthorshipEntry,
  validateAuthorshipBlock,
  validateAuthorshipEntry,
} from "./authorship.ts";
import { type PaperDate, validateChronology, validatePaperDate } from "./dates.ts";
import { type Inline, plainText, validateInline } from "./inlines.ts";
import { type SpanAnchor, spanTextDigest, validateSpanAnchor } from "./spans.ts";

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

export const SOURCE_SCHEMA_VERSION = 1;

// 1. PAPER
export const PAPER_SLUGS = [
  "light-quanta",
  "brownian-motion",
  "special-relativity",
  "mass-energy",
  "molecular-dimensions",
] as const;
export type PaperSlug = (typeof PAPER_SLUGS)[number];

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

export function validatePaper(raw: unknown, path = "Paper"): Paper {
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
  };
}

// 3. SOURCE BLOCK
export const SOURCE_BLOCK_KINDS = [
  "masthead",
  "heading",
  "part-heading",
  "paragraph",
  "equation",
  "footnote",
  "closing",
] as const;
export type SourceBlockKind = (typeof SOURCE_BLOCK_KINDS)[number];

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
  originalLabel?: string | undefined;
  editorialLabel?: string | undefined;
  diplomaticText: string;
  inlines: readonly Inline[];
  sentenceSpans: readonly SentenceSpan[];
  revision: number;
  status: SourceBlockStatus;
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
    } catch (err: any) {
      throw new SchemaValidationError(
        "invalid-language-tag",
        err.message,
        "SourceBlock",
        `${path}.lang`,
      );
    }
  }

  let dir: TextDirection | undefined;
  if (o.dir !== undefined) {
    try {
      dir = validateDirection(o.dir, `${path}.dir`);
    } catch (err: any) {
      throw new SchemaValidationError(
        "invalid-direction",
        err.message,
        "SourceBlock",
        `${path}.dir`,
      );
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

  return {
    id: o.id,
    kind: o.kind as SourceBlockKind,
    paper: (o.paper as string) || "",
    section: (o.section as string) || undefined,
    order: typeof o.order === "number" ? o.order : 0,
    locators: o.locators as BlockLocator[],
    originalLabel: (o.originalLabel as string) || undefined,
    editorialLabel: (o.editorialLabel as string) || undefined,
    diplomaticText: (o.diplomaticText as string) || text,
    inlines,
    sentenceSpans,
    revision: o.revision as number,
    status: {
      transcription: st.transcription as any,
      mathTranscription: st.mathTranscription as any,
      translation: st.translation as any,
      review: st.review as any,
    },
    ...(lang ? { lang } : {}),
    ...(dir ? { dir } : {}),
  };
}

// 4. TRANSLATION UNIT
export type UnresolvedAlternative = Readonly<{
  text: string;
  rationale: string;
}>;

export type TranslationUnit = Readonly<{
  id: string;
  sourceRefs: readonly Readonly<{ paper: string; id: string }>[];
  inlines: readonly Inline[];
  translator: AuthorshipEntry;
  editor?: AuthorshipEntry | undefined;
  revision: number;
  unresolvedAlternatives: readonly UnresolvedAlternative[];
  reviewState: "draft" | "in-progress" | "corrected" | "reviewed";
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
  } catch (err: any) {
    throw new SchemaValidationError(
      "invalid-language-tag",
      err.message,
      "TranslationUnit",
      `${path}.lang`,
    );
  }

  let dir: TextDirection | undefined;
  if (o.dir !== undefined) {
    try {
      dir = validateDirection(o.dir, `${path}.dir`);
    } catch (err: any) {
      throw new SchemaValidationError(
        "invalid-direction",
        err.message,
        "TranslationUnit",
        `${path}.dir`,
      );
    }
  }

  const reviewState = o.reviewState as string;
  if (!["draft", "in-progress", "corrected", "reviewed"].includes(reviewState)) {
    throw new SchemaValidationError(
      "invalid-review-state",
      `Invalid reviewState "${reviewState}".`,
      "TranslationUnit",
      `${path}.reviewState`,
    );
  }

  const translator = validateAuthorshipEntry(o.translator, "translator", `${path}.translator`);
  let editor: AuthorshipEntry | undefined;

  if (reviewState === "corrected" || reviewState === "reviewed") {
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

  return {
    id: o.id,
    sourceRefs: o.sourceRefs as { paper: string; id: string }[],
    inlines,
    translator,
    editor,
    revision: o.revision as number,
    unresolvedAlternatives,
    reviewState: reviewState as any,
    lang,
    ...(dir ? { dir } : {}),
  };
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
export const GLOSS_NOTE_CLASSES = [
  "konjunktiv-i",
  "konjunktiv-ii",
  "separable-verb",
  "genitive-construction",
  "compound",
  "attributive-phrase",
  "formula-phrase",
  "archaic-spelling",
  "abbreviation",
  "ordinal",
  "unit",
  "term",
] as const;
export type GlossNoteClass = (typeof GLOSS_NOTE_CLASSES)[number];

export type GlossToken = Readonly<{
  german: string;
  english?: string | undefined;
  lemma?: string | undefined;
  grammarNote?: string | undefined;
  noteClass?: GlossNoteClass | string | undefined;
  contextual?: boolean | undefined;
  reason?: string | undefined;
}>;

export type MultiwordUnit = Readonly<{
  tokenIndices: readonly number[];
  english: string;
  kind: "separable-verb" | "fixed-phrase" | "reflexive" | "split-construction";
  grammarNote?: string | undefined;
  noteClass?: GlossNoteClass | string | undefined;
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
  reviewState: "draft" | "in-progress" | "corrected" | "reviewed";
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
  if (typeof o.revision !== "number" || o.revision <= 0) {
    throw new SchemaValidationError(
      "invalid-revision",
      "revision must be a positive integer.",
      "GlossUnit",
      `${path}.revision`,
    );
  }
  if (!Array.isArray(o.tokens) || o.tokens.length === 0) {
    throw new SchemaValidationError(
      "missing-tokens",
      "tokens array is required.",
      "GlossUnit",
      `${path}.tokens`,
    );
  }

  let lang = "en";
  if (o.lang !== undefined) {
    try {
      lang = validateLanguageTag(o.lang, `${path}.lang`);
    } catch (err: any) {
      throw new SchemaValidationError(
        "invalid-language-tag",
        err.message,
        "GlossUnit",
        `${path}.lang`,
      );
    }
  }

  let sourceLang = "de";
  if (o.sourceLang !== undefined) {
    try {
      sourceLang = validateLanguageTag(o.sourceLang, `${path}.sourceLang`);
    } catch (err: any) {
      throw new SchemaValidationError(
        "invalid-language-tag",
        err.message,
        "GlossUnit",
        `${path}.sourceLang`,
      );
    }
  }

  let dir: TextDirection | undefined;
  if (o.dir !== undefined) {
    try {
      dir = validateDirection(o.dir, `${path}.dir`);
    } catch (err: any) {
      throw new SchemaValidationError("invalid-direction", err.message, "GlossUnit", `${path}.dir`);
    }
  }

  const attribution = validateAuthorshipEntry(o.attribution, "author", `${path}.attribution`);
  const editor = o.editor
    ? validateAuthorshipEntry(o.editor, "editor", `${path}.editor`)
    : undefined;

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
    if (tok.contextual && !tok.reason) {
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
      noteClass: (tok.noteClass as string) || undefined,
      contextual: Boolean(tok.contextual) || undefined,
      reason: (tok.reason as string) || undefined,
    };
  });

  const multiwordUnits: MultiwordUnit[] = Array.isArray(o.multiwordUnits)
    ? o.multiwordUnits.map((m, i) => {
        const mw = m as Record<string, unknown>;
        if (!Array.isArray(mw.tokenIndices) || mw.tokenIndices.length < 2) {
          throw new SchemaValidationError(
            "invalid-multiword-indices",
            "Multiword unit requires at least two token indices.",
            "GlossUnit",
            `${path}.multiwordUnits[${i}].tokenIndices`,
          );
        }
        return {
          tokenIndices: mw.tokenIndices as number[],
          english: mw.english as string,
          kind: mw.kind as any,
          grammarNote: (mw.grammarNote as string) || undefined,
          noteClass: (mw.noteClass as string) || undefined,
        };
      })
    : [];

  return {
    sentenceId: o.sentenceId,
    revision: o.revision as number,
    sourceRevision: (o.sourceRevision as number) || 1,
    sourceTextDigest: (o.sourceTextDigest as string) || "",
    lang,
    sourceLang,
    attribution,
    editor,
    reviewState: (o.reviewState as any) || "draft",
    tokens,
    multiwordUnits,
    ...(dir ? { dir } : {}),
  };
}

// 7. EDITORIAL NOTE
export const EDITORIAL_NOTE_KINDS = [
  "historian-margin",
  "correction",
  "typographical",
  "dispute",
  "side-note",
] as const;
export type EditorialNoteKind = (typeof EDITORIAL_NOTE_KINDS)[number];

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
  reviewState: "draft" | "in-progress" | "corrected" | "reviewed";
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
    } catch (err: any) {
      throw new SchemaValidationError(
        "invalid-language-tag",
        err.message,
        "EditorialNote",
        `${path}.lang`,
      );
    }
  }

  let dir: TextDirection | undefined;
  if (o.dir !== undefined) {
    try {
      dir = validateDirection(o.dir, `${path}.dir`);
    } catch (err: any) {
      throw new SchemaValidationError(
        "invalid-direction",
        err.message,
        "EditorialNote",
        `${path}.dir`,
      );
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

  return {
    id: o.id,
    author,
    claim: o.claim,
    sourceSupport,
    kind,
    affectedIds: Array.isArray(o.affectedIds) ? (o.affectedIds as string[]) : [],
    reviewState: (o.reviewState as any) || "draft",
    originalReading: (o.originalReading as string) || undefined,
    proposedReading: (o.proposedReading as string) || undefined,
    reasoning: (o.reasoning as string) || undefined,
    evidence: (o.evidence as string) || undefined,
    layer: (o.layer as any) || undefined,
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
    author: o.author as any,
    containerTitle: (o.containerTitle as string) || undefined,
    volume: (o.volume as string | number) || undefined,
    issue: (o.issue as string | number) || undefined,
    page: (o.page as string) || undefined,
    issued: o.issued as any,
    doi: (o.doi as string) || undefined,
    url: (o.url as string) || undefined,
    accessed,
    role: o.role as any,
    locator: (o.locator as any) || undefined,
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
  reviewState: "draft" | "in-progress" | "corrected" | "reviewed";
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
  } catch (err: any) {
    throw new SchemaValidationError(
      "invalid-language-tag",
      err.message,
      "TranslationEdition",
      `${path}.language`,
    );
  }

  const reviewState = o.reviewState as string;
  if (!["draft", "in-progress", "corrected", "reviewed"].includes(reviewState)) {
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
    reviewState: reviewState as any,
    units,
    missingUnitsNotice: typeof o.missingUnitsNotice === "string" ? o.missingUnitsNotice : undefined,
  };
}
