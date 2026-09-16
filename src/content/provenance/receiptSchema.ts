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

export type TypographicalError = Readonly<{
  id: string;
  locator: Readonly<{ pdfPageIndex: number; printedPage: number; line?: number | undefined }>;
  originalReading: string;
  proposedReading: string;
  reasoning: string;
  evidence: string;
  layer: "source" | "translation";
  recordedBy: string;
  recordedAt: string;
}>;

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
