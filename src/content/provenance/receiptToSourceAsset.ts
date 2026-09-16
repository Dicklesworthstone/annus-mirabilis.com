/**
 * Maps a provenance receipt to a SourceAsset record for use by the content compiler and /sources.
 */

import type {
  CloudProcessing,
  PageMapEntry,
  PublicationDecision,
  Receipt,
  ReceiptFrontMatter,
  ReuseTerms,
  RightsStatus,
} from "./receiptSchema.ts";

export type SourceAssetRights = Readonly<{
  status: RightsStatus;
  statement: string;
  source: string;
  recordedAt: string;
  reuseTerms: ReuseTerms;
  credit?: string;
}>;

export type SourceAsset = Readonly<{
  originUrl: string;
  acquisitionDate: string;
  sha256: string;
  mimeType: string;
  pageCount: number;
  pageMapping: readonly PageMapEntry[];
  rights: SourceAssetRights;
  publicationDecision: PublicationDecision;
  publicationReason?: string;
  cloudProcessing: CloudProcessing;
  cloudProcessingBasis: string;
  parentSha256?: string;
  parentPageIndices?: readonly number[];
}>;

export function receiptToSourceAsset(receiptOrFm: Receipt | ReceiptFrontMatter): SourceAsset {
  const fm = "frontMatter" in receiptOrFm ? receiptOrFm.frontMatter : receiptOrFm;
  const scan = fm.scan;

  // Build rights.statement from termsStatements
  let statement = "";
  if (Array.isArray(scan.termsStatements) && scan.termsStatements.length > 0) {
    statement = scan.termsStatements.map((ts) => ts.text).join("\n\n");
  }

  const rights: SourceAssetRights = {
    status: scan.rightsStatus,
    statement,
    source: scan.originUrl,
    recordedAt: scan.acquisitionDate,
    reuseTerms: scan.reuseTerms,
    ...(scan.credit ? { credit: scan.credit } : {}),
  };

  const asset: SourceAsset = {
    originUrl: scan.originUrl,
    acquisitionDate: scan.acquisitionDate,
    sha256: scan.sha256,
    mimeType: scan.mimeType,
    pageCount: scan.pageCount,
    pageMapping: fm.pageMap,
    rights,
    publicationDecision: scan.publicationDecision,
    ...(scan.publicationReason ? { publicationReason: scan.publicationReason } : {}),
    cloudProcessing: scan.cloudProcessing,
    cloudProcessingBasis: scan.cloudProcessingBasis,
    ...(scan.parent?.sha256 ? { parentSha256: scan.parent.sha256 } : {}),
    ...(scan.parent?.parentPageIndices ? { parentPageIndices: scan.parent.parentPageIndices } : {}),
  };

  return asset;
}
