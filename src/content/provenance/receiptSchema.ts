/**
 * Normative schema definitions and front-matter validator for provenance receipts.
 * Specification: docs/editorial/RECEIPT_FORMAT.md
 */

export const RECEIPT_FORMAT_VERSION = 1 as const;

export const PAPER_DATE_TYPES = [
  "date-line",
  "received",
  "issue-publication",
  "submitted",
  "later-edition",
] as const;
export type PaperDateType = (typeof PAPER_DATE_TYPES)[number];

export const DATE_PRECISIONS = ["day", "month", "year"] as const;
export type DatePrecision = (typeof DATE_PRECISIONS)[number];

export type PaperDate = Readonly<{
  type: PaperDateType;
  text?: string | undefined;
  iso: string;
  precision: DatePrecision;
  source: string;
  verifiedAt: string;
  confirmedFromScan?: boolean | undefined;
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

export type Journal = Readonly<{
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

export type CollectedPapersRef = Readonly<{
  volume: number;
  document: number;
}>;

export type PaperIdentity = Readonly<{
  titleGerman: string;
  titleEnglishWorking: string;
  authorLine: string;
  dates: readonly PaperDate[];
  journal: Journal;
  collectedPapers: CollectedPapersRef;
}>;

export const RIGHTS_STATUS_VALUES = [
  "public-domain-text",
  "public-domain-image",
  "scan-open-terms",
  "scan-terms-restrict-redistribution",
  "scan-terms-unknown",
  "site-original-code",
  "site-original-prose",
  "third-party-licensed",
  "in-copyright-witness-only",
  "cleared-image",
] as const;
export type RightsStatus = (typeof RIGHTS_STATUS_VALUES)[number];

export const PUBLICATION_DECISION_VALUES = ["publish", "pin-local-only", "reference-only"] as const;
export type PublicationDecision = (typeof PUBLICATION_DECISION_VALUES)[number];

export const CLOUD_PROCESSING_VALUES = ["permitted", "forbidden", "unknown"] as const;
export type CloudProcessing = (typeof CLOUD_PROCESSING_VALUES)[number];

export const REUSE_TERMS_VALUES = [
  "pending-decision",
  "named-license",
  "source-terms",
  "no-reuse-offered",
] as const;
export type ReuseTerms = (typeof REUSE_TERMS_VALUES)[number];

export type TermsStatement = Readonly<{
  url: string;
  retrievedAt: string;
  text: string;
}>;

export type ScanParent = Readonly<{
  sha256: string;
  pageCount: number;
  path?: string | undefined;
  parentPageIndices: readonly number[];
}>;

export type Scan = Readonly<{
  originUrl: string;
  finalUrl: string;
  institution: string;
  hostItemId: string;
  hostFileName: string;
  hostFileSource: string;
  hostChecksumsVerified: boolean;
  termsStatementUrls: readonly string[];
  acquisitionDate: string;
  sha256: string;
  mimeType: string;
  pageCount: number;
  parent?: ScanParent | undefined;
  embeddedTextLayer: string;
  rightsStatus: RightsStatus;
  publicationDecision: PublicationDecision;
  publicationReason?: string | undefined;
  cloudProcessing: CloudProcessing;
  cloudProcessingBasis: string;
  reuseTerms: ReuseTerms;
  credit?: string | undefined;
  path: string;
  downloadLog: string;
  termsStatements: readonly TermsStatement[];
}>;

export const CONTENTS_VOCABULARY = [
  "front-matter",
  "usage-notice",
  "masthead",
  "article-text",
  "other-article",
  "plate",
  "back-matter",
] as const;
export type ContentsType = (typeof CONTENTS_VOCABULARY)[number];

export type DisplayEquations = Readonly<{
  numbered: readonly string[];
  unnumbered?: number | undefined;
  unnumberedIds?: readonly string[] | undefined;
}>;

export type PageMapEntry = Readonly<{
  pdfPageIndex: number;
  printedPage: number | null;
  contents: readonly ContentsType[];
  sectionIds: readonly string[];
  displayEquations: DisplayEquations;
  footnoteMarks: readonly string[];
  refinedBy?: string | undefined;
}>;

export const WITNESS_KINDS = [
  "collected-papers",
  "augsburg",
  "wikisource",
  "historical-translation",
  "other",
] as const;
export type WitnessKind = (typeof WITNESS_KINDS)[number];

export type Witness = Readonly<{
  kind: WitnessKind;
  identity: string;
  url?: string | undefined;
  revisionId?: string | number | null | undefined;
  availability: "available" | "not-found";
  checkedAt: string;
  rightsStatus: string;
  notes: string;
}>;

export type OcrRun = Readonly<{
  toolRunId: string;
  adapter: string;
  workerIdentity: string;
  model: string;
  jobIds: readonly string[];
  pdfPageRange: Readonly<{ first: number; last: number }>;
  startedAt: string;
  finishedAt: string;
  summaryPath: string;
}>;

export type Editor = Readonly<{
  name: string;
  role: string;
  pages: string | readonly number[];
  dates: string;
}>;

export type PrintingProvenanceEntry = Readonly<{
  item: string;
  kind: "passage" | "numerical-input";
  printing: string;
  pdfPageIndex: number;
  printedPage: number;
  notes: string;
}>;

export const LEDGER_STATUS_VALUES = [
  "not-started",
  "in-progress",
  "corrected",
  "corrected-second-read",
  "reviewed",
] as const;
export type LedgerStatus = (typeof LEDGER_STATUS_VALUES)[number];

export type Transcription = Readonly<{
  ocrRuns: readonly OcrRun[];
  ledgerPath?: string | undefined;
  ledgerSha256?: string | undefined;
  ledgerSourcePdfSha256?: string | undefined;
  ledgerScopePages?: readonly number[] | undefined;
  printingProvenance?: readonly PrintingProvenanceEntry[] | undefined;
  ledgerStatus: LedgerStatus;
  editors: readonly Editor[];
}>;

/**
 * A proposal to read a printed word differently from the plate.
 *
 * `status` exists because a correction can turn out to be wrong, and a record that cannot
 * say so is worse than no record: the retraction becomes prose addressed to a human who
 * reads every entry in order, while every mechanical reader still sees a live correction.
 * That is not hypothetical. Three records on ap-17-891 proposed changing a printed `H` to
 * `Y` on pages 899 and 902; the `H` is capital eta, the axis of the moving system's eta,
 * typeset identically to a Latin H. The retraction was written as free prose in a field
 * the type did not declare, so nothing could distinguish the three retracted records from
 * the ones that are still right.
 *
 * A retracted record is KEPT, never deleted. A typographical record that silently loses
 * its retractions is worth less than one that shows them, because a reviewer cannot tell
 * the difference between a correction nobody proposed and one that was proposed and
 * refuted. Read live corrections through `liveTypographicalErrors`.
 */
export type TypographicalErrorStatus = "active" | "retracted";

export type TypographicalErrorRetraction = Readonly<{
  /** Why the correction does not hold. Carries the evidence, not just the verdict. */
  reason: string;
  /** Who retracted it, which need not be who recorded it. */
  retractedBy: string;
  retractedAt: string;
}>;

export type TypographicalError = Readonly<{
  id: string;
  locator: Readonly<{
    pdfPageIndex: number;
    printedPage: number;
    line?: number | undefined;
    /** The printed display the misprint stands in, by its source-block id (dispatch 266). */
    displayId?: string | undefined;
  }>;
  originalReading: string;
  proposedReading: string;
  reasoning: string;
  evidence: string;
  layer: "source" | "translation";
  recordedBy: string;
  recordedAt: string;
  /** Absent means "active": the overwhelming majority of records, and the safe default. */
  status?: TypographicalErrorStatus | undefined;
  /** Required when status is "retracted", and meaningless otherwise. */
  retraction?: TypographicalErrorRetraction | undefined;
}>;

/**
 * The corrections a consumer should act on. A retracted record is not one of them.
 *
 * Anything that applies, displays, or counts proposed corrections reads them through here,
 * so that retracting a record is a STATE CHANGE rather than a note somebody has to notice.
 */
export function liveTypographicalErrors(
  errors: readonly TypographicalError[] | undefined,
): readonly TypographicalError[] {
  if (!errors) return [];
  return errors.filter((e) => e.status !== "retracted");
}

export type WatchListItem = Readonly<{
  id: string;
  item: string;
  expectedCheck: string;
  result: "pending" | "matches" | "differs" | "not-found";
  notes: string;
  checkedBy?: string | undefined;
  checkedAt?: string | undefined;
}>;

export type PendingSection = Readonly<{
  section: string;
  owner: string;
}>;

export type ReceiptFrontMatter = Readonly<{
  receiptFormatVersion: 1;
  receiptKind: "facsimile-scan" | string;
  key: string;
  slug: string;
  paper: PaperIdentity;
  scan: Scan;
  pageMap: readonly PageMapEntry[];
  witnesses: readonly Witness[];
  transcription: Transcription;
  typographicalErrors: readonly TypographicalError[];
  watchList: readonly WatchListItem[];
  pending: readonly PendingSection[];
}>;

export type ReceiptBodySection = Readonly<{
  title: string;
  level: number;
  content: string;
  startLine: number;
}>;

export type Receipt = Readonly<{
  frontMatter: ReceiptFrontMatter;
  rawFrontMatter: string;
  body: string;
  bodySections: readonly ReceiptBodySection[];
  editorialAcceptanceContent?: string | undefined;
  filePath: string;
}>;

/**
 * Resolves an unnumbered or numbered equation ID / label to its 1-based PDF page index.
 */
export function resolveEquationPage(
  pageMap: readonly PageMapEntry[],
  equationId: string,
): number | null {
  for (const entry of pageMap) {
    if (entry.displayEquations.numbered.includes(equationId)) {
      return entry.pdfPageIndex;
    }
    if (entry.displayEquations.unnumberedIds?.includes(equationId)) {
      return entry.pdfPageIndex;
    }
  }
  return null;
}
