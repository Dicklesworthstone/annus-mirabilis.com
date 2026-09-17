/**
 * JSON-LD (Schema.org ScholarlyArticle) exporter for papers.
 */

import type { PaperExport } from "./types.ts";

export interface JsonLdScholarlyArticle {
  readonly "@context": "https://schema.org";
  readonly "@type": "ScholarlyArticle";
  readonly name: string;
  readonly alternateName: string;
  readonly headline: string;
  readonly inLanguage: readonly string[];
  readonly author: {
    readonly "@type": "Person";
    readonly name: string;
  };
  readonly editor?: {
    readonly "@type": "Person";
    readonly name: string;
  };
  readonly translator?: {
    readonly "@type": "Person";
    readonly name: string;
  };
  readonly publisher: {
    readonly "@type": "Organization";
    readonly name: string;
    readonly url: string;
  };
  readonly isPartOf: {
    readonly "@type": "PublicationIssue";
    readonly issueNumber: string;
    readonly isPartOf: {
      readonly "@type": "Periodical";
      readonly name: string;
      readonly volumeNumber: number;
    };
  };
  readonly pageStart: number;
  readonly pageEnd: number;
  readonly pagination: string;
  readonly identifier?: {
    readonly "@type": "PropertyValue";
    readonly propertyID: "DOI";
    readonly value: string;
  };
  readonly license: string;
  readonly url: string;
  readonly isAccessibleForFree: boolean;
}

export function generateJsonLd(paper: PaperExport): JsonLdScholarlyArticle {
  return {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    name: paper.titleEnglishWorking,
    alternateName: paper.titleGerman,
    headline: paper.titleEnglishWorking,
    inLanguage: ["de", "en"],
    author: {
      "@type": "Person",
      name: paper.authorLine,
    },
    editor: {
      "@type": "Person",
      name: "Jeffrey Emanuel and contributors",
    },
    translator: {
      "@type": "Person",
      name: "Jeffrey Emanuel and contributors",
    },
    publisher: {
      "@type": "Organization",
      name: "Annus Mirabilis",
      url: "https://annus-mirabilis.com",
    },
    isPartOf: {
      "@type": "PublicationIssue",
      issueNumber: String(paper.journal.issue),
      isPartOf: {
        "@type": "Periodical",
        name: paper.journal.name,
        volumeNumber: paper.journal.volume,
      },
    },
    pageStart: paper.journal.pages.first,
    pageEnd: paper.journal.pages.last,
    pagination: `${paper.journal.pages.first}–${paper.journal.pages.last}`,
    ...(paper.journal.doi
      ? {
          identifier: {
            "@type": "PropertyValue" as const,
            propertyID: "DOI" as const,
            value: paper.journal.doi,
          },
        }
      : {}),
    license: "https://annus-mirabilis.com/NOTICE",
    url: `https://annus-mirabilis.com/paper/${paper.slug}`,
    isAccessibleForFree: true,
  };
}
