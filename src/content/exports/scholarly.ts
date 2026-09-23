import type { ReceiptFrontMatter } from "../../content/provenance/receiptSchema.ts";

/**
 * STRUCTURED CITATION DATA FOR A PAPER PAGE, AS TWO ENTITIES THAT NEVER MERGE (am-scholarly-metadata-mjrx).
 *
 * The historical article is what Einstein published: its printed German title, Einstein as sole
 * author, the Annalen der Physik record and the verified DOI, all read from the provenance receipt.
 * The commentary is what this site publishes about it: its own authors, its content revision, its
 * license, and `isBasedOn` pointing at the article. src/content/exports/jsonld.ts folds both into
 * one ScholarlyArticle with a translator and a license on Einstein's paper; that is the confusion
 * this module exists to prevent, and validateScholarly refuses it.
 *
 * No translation entity yet: the English translation has not been started, and an entity for a
 * translation that does not exist would be a claim the page cannot back.
 */

const SITE = "https://annus-mirabilis.com";
const REPOSITORY_LICENSE =
  "https://github.com/Dicklesworthstone/annus-mirabilis.com/blob/main/LICENSE";

type Json = string | number | boolean | null | readonly Json[] | { readonly [key: string]: Json };
export type ScholarlyEntity = { readonly [key: string]: Json };

/** Which of the entities this is; used by the validator, never emitted. */
export type ScholarlyRole = "historical-article" | "commentary" | "translation";
export type TaggedEntity = Readonly<{ role: ScholarlyRole; entity: ScholarlyEntity }>;

export type ScholarlyErrorCode =
  | "scholarly-einstein-misattributed"
  | "scholarly-historical-date-on-edition"
  | "scholarly-missing-translation-of-work"
  | "scholarly-missing-is-based-on"
  | "scholarly-article-carries-edition-field"
  | "scholarly-doi-off-article";

export class ScholarlyError extends Error {
  readonly code: ScholarlyErrorCode;
  constructor(code: ScholarlyErrorCode, message: string) {
    super(message);
    this.name = "ScholarlyError";
    this.code = code;
  }
}

/** The JSON-LD document for a set of entities; schema.org's context lives here, with the other exports. */
export function scholarlyGraph(entities: readonly TaggedEntity[]): ScholarlyEntity {
  return { "@context": "https://schema.org", "@graph": entities.map((e) => e.entity) };
}

export function articleId(slug: string): string {
  return `${SITE}/papers/${slug}/#article`;
}

/** The document Einstein published, from its receipt and nothing else. */
export function historicalArticle(fm: ReceiptFrontMatter): ScholarlyEntity {
  const { paper, slug } = fm;
  const journal = paper.journal;
  const received = paper.dates.find((d) => d.type === "received");
  const published = paper.dates.find((d) => d.type === "issue-publication");
  return {
    "@type": "ScholarlyArticle",
    "@id": articleId(slug),
    name: paper.titleGerman,
    author: { "@type": "Person", name: "Albert Einstein" },
    inLanguage: "de",
    ...(published ? { datePublished: published.iso } : {}),
    ...(received ? { dateReceived: received.iso } : {}),
    pageStart: journal.pages.first,
    pageEnd: journal.pages.last,
    isPartOf: {
      "@type": "PublicationIssue",
      issueNumber: String(journal.issue),
      isPartOf: {
        "@type": "PublicationVolume",
        volumeNumber: String(journal.volume),
        additionalProperty: [
          { "@type": "PropertyValue", name: "series", value: journal.series },
          {
            "@type": "PropertyValue",
            name: "wholeSeriesVolume",
            value: journal.wholeSeriesVolume,
          },
        ],
        isPartOf: { "@type": "Periodical", name: journal.name },
      },
    },
    identifier: { "@type": "PropertyValue", propertyID: "DOI", value: journal.doi },
    // Only an identifier the receipt verified is claimed as the same thing.
    ...(journal.doiVerifiedAt ? { sameAs: `https://doi.org/${journal.doi}` } : {}),
    ...(journal.laterEditionDois && journal.laterEditionDois.length > 0
      ? {
          workExample: journal.laterEditionDois.map((later) => ({
            "@type": "ScholarlyArticle",
            name: `Later edition: ${later.description}`,
            identifier: { "@type": "PropertyValue", propertyID: "DOI", value: later.doi },
          })),
        }
      : {}),
  };
}

/** What this site publishes about the paper: new writing, with its own authors and license. */
export function commentary(
  fm: ReceiptFrontMatter,
  name: string,
  contentRevision: string,
): ScholarlyEntity {
  return {
    "@type": "CreativeWork",
    "@id": `${SITE}/papers/${fm.slug}/#commentary`,
    name,
    url: `${SITE}/papers/${fm.slug}/`,
    inLanguage: "en",
    author: { "@type": "Organization", name: "Jeffrey Emanuel and contributors" },
    publisher: { "@type": "Organization", name: "Annus Mirabilis", url: SITE },
    isBasedOn: { "@id": articleId(fm.slug) },
    version: contentRevision,
    license: REPOSITORY_LICENSE,
  };
}

function names(value: Json | undefined): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.flatMap((v) => names(v as Json));
  if (typeof value === "object") {
    const name = (value as { name?: Json }).name;
    return typeof name === "string" ? [name] : [];
  }
  return typeof value === "string" ? [value] : [];
}

function mentionsDoi(value: Json | undefined): boolean {
  return (
    JSON.stringify(value ?? null).includes('"DOI"') ||
    /doi\.org\//.test(JSON.stringify(value ?? null))
  );
}

/**
 * The attribution rules, as a build failure. Each names the entity and the field. The historical
 * article is Einstein's; every other entity is the site's, dated after 1906 or not at all, and
 * points back at the article.
 */
export function validateScholarly(entities: readonly TaggedEntity[]): void {
  for (const { role, entity } of entities) {
    const id = String(entity["@id"] ?? role);
    if (role === "historical-article") {
      for (const field of ["translator", "version", "license"] as const) {
        if (field in entity) {
          throw new ScholarlyError(
            "scholarly-article-carries-edition-field",
            `${id}: the historical article carries "${field}"; the German text is public domain and the site grants nothing over it.`,
          );
        }
      }
      continue;
    }
    for (const field of ["author", "translator"] as const) {
      if (names(entity[field]).some((n) => /einstein/i.test(n))) {
        throw new ScholarlyError(
          "scholarly-einstein-misattributed",
          `${id}: Einstein appears as "${field}" of an entity that is not his article.`,
        );
      }
    }
    const date = entity.datePublished;
    if (typeof date === "string" && /^190[56]/.test(date)) {
      throw new ScholarlyError(
        "scholarly-historical-date-on-edition",
        `${id}: "datePublished" ${date} belongs to the historical article, not the site's edition.`,
      );
    }
    if (role === "translation" && !("translationOfWork" in entity)) {
      throw new ScholarlyError(
        "scholarly-missing-translation-of-work",
        `${id}: a translation entity must name its original in "translationOfWork".`,
      );
    }
    if (role === "commentary" && !("isBasedOn" in entity)) {
      throw new ScholarlyError(
        "scholarly-missing-is-based-on",
        `${id}: a commentary entity must name the article in "isBasedOn".`,
      );
    }
    for (const field of ["identifier", "sameAs", "workExample"] as const) {
      if (mentionsDoi(entity[field])) {
        throw new ScholarlyError(
          "scholarly-doi-off-article",
          `${id}: "${field}" carries a DOI, which belongs to the historical article only.`,
        );
      }
    }
  }
}
