import { historicalArticle } from "../../content/exports/scholarly.ts";
import type { ReceiptFrontMatter } from "../../content/provenance/receiptSchema.ts";

type Article = {
  name: string;
  author: { name: string };
  datePublished?: string;
  pageStart: number;
  pageEnd: number;
  isPartOf: {
    issueNumber: string;
    isPartOf: {
      volumeNumber: string;
      additionalProperty: { name: string; value: number }[];
      isPartOf: { name: string };
    };
  };
  identifier: { value: string };
};

/**
 * The human citation for a paper, read from the same projection as the page's machine-readable
 * record (historicalArticle), so the two cannot disagree on title, author, journal, volume, issue,
 * pages, year or DOI (am-scholarly-metadata-mjrx).
 */
export function citationOf(fm: ReceiptFrontMatter): string {
  const a = historicalArticle(fm) as unknown as Article;
  const volume = a.isPartOf.isPartOf;
  const series = volume.additionalProperty.find((p) => p.name === "series")?.value;
  const year = (a.datePublished ?? "").slice(0, 4);
  return (
    `${a.author.name}, „${a.name}“, ${volume.isPartOf.name} (${series}) ${volume.volumeNumber}, ` +
    `no. ${a.isPartOf.issueNumber}, ${a.pageStart}–${a.pageEnd} (${year}). doi:${a.identifier.value}`
  );
}
