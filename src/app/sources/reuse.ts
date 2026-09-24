import type {
  PublicationDecision,
  ReceiptFrontMatter,
  ReuseTerms,
} from "../../content/provenance/receiptSchema.ts";
import { receiptToSourceAsset } from "../../content/provenance/receiptToSourceAsset.ts";

/*
 * WHAT A READER MAY DO WITH A SCAN, read from that scan's own rights record (the receipt's
 * reuseTerms and publicationDecision, in the vocabulary of docs/rights-vocabulary.yaml) and never
 * from the site's license. Publishing a file is not permission to reuse it, so /sources/ and the
 * how-to-cite section of /about/ both render these records, from this one module, and neither
 * states a reuse answer of its own.
 *
 * Both tables are total over the vocabulary's types, so a value the vocabulary adds is a type error
 * here until someone who has read its definition words it.
 */

/** What each recorded reuse status offers, in the vocabulary's own terms. */
export const REUSE_WORDS: Readonly<Record<ReuseTerms, string>> = {
  "pending-decision": "Pending a license decision: no reuse terms are offered for it yet.",
  "named-license": "Offered for reuse under a named license.",
  "source-terms": "Reuse is governed by its host's own terms, as recorded.",
  "no-reuse-offered": "Not offered for reuse.",
};

/** Whether the scan is published here, as the receipt decides. */
export const PUBLICATION_WORDS: Readonly<Record<PublicationDecision, string>> = {
  publish: "Published here.",
  "pin-local-only": "Held by the editors and not published.",
  "reference-only": "Consulted and cited only; no copy is kept.",
};

export type TermsRecord = Readonly<{ text: string; url: string; retrievedAt: string }>;

export type Reuse = Readonly<{
  terms: ReuseTerms;
  publication: PublicationDecision;
  /** The sentence a reader sees, built from the two records above and nothing else. */
  words: string;
  /** The host's terms as the receipt records them, quoted, with where and when they were read. */
  statements: readonly TermsRecord[];
  /** True only for a published scan whose record offers terms. Never inferred from the site. */
  offered: boolean;
}>;

export function reuseOf(fm: ReceiptFrontMatter): Reuse {
  const asset = receiptToSourceAsset(fm);
  const terms = asset.rights.reuseTerms;
  const publication = asset.publicationDecision;
  // An unpublished scan is described with its recorded terms and never offered for reuse, whatever
  // its reuse field says (the vocabulary requires no-reuse-offered for it anyway).
  const published = publication === "publish";
  const offered = published && (terms === "source-terms" || terms === "named-license");
  const reason = asset.publicationReason ? ` ${asset.publicationReason}` : "";
  return {
    terms,
    publication,
    words: published
      ? `${PUBLICATION_WORDS[publication]} ${REUSE_WORDS[terms]}`
      : `${PUBLICATION_WORDS[publication]}${reason} ${REUSE_WORDS["no-reuse-offered"]}`,
    statements: fm.scan.termsStatements ?? [],
    offered,
  };
}

/** The sentence for a scan that carries its host's machine-read text, or null when it has none. */
export function textLayerWords(fm: ReceiptFrontMatter): string | null {
  const layer = fm.scan.embeddedTextLayer;
  if (layer === "present") return "The scan carries its host's machine-read text layer.";
  if (layer === "unknown")
    return "The scan may carry its host's machine-read text layer; the receipt does not say.";
  return null;
}
