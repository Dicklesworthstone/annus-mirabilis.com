import { describe, expect, test } from "bun:test";
import { loadFirstPages } from "../../components/home/firstPages.ts";
import { loadProvenanceReceipts } from "../../content/provenance/loadReceipts.ts";
import {
  articleId,
  commentary,
  historicalArticle,
  type ScholarlyEntity,
  ScholarlyError,
  type TaggedEntity,
  validateScholarly,
} from "./scholarly.ts";

/** The four papers' receipts, real ones; the guard below keeps every loop from passing on none. */
const PAPER_KEYS = new Set(loadFirstPages().map((p) => p.key));
const receipts = loadProvenanceReceipts().receipts.flatMap(({ key, receipt }) =>
  receipt && PAPER_KEYS.has(key) ? [receipt.frontMatter] : [],
);

function codeOf(entities: readonly TaggedEntity[]): string | undefined {
  try {
    validateScholarly(entities);
  } catch (error) {
    return error instanceof ScholarlyError ? error.code : `not a ScholarlyError: ${String(error)}`;
  }
  return undefined;
}

const first = receipts[0];
const article = (): TaggedEntity => ({
  role: "historical-article",
  entity: historicalArticle(first as NonNullable<typeof first>),
});
const note = (extra: Record<string, unknown> = {}, drop?: string): TaggedEntity => {
  const entity: Record<string, unknown> = {
    ...commentary(first as NonNullable<typeof first>, "Fixture, explained", "rev-1"),
    ...extra,
  };
  if (drop) delete entity[drop];
  return { role: "commentary", entity: entity as ScholarlyEntity };
};

describe("the historical article", () => {
  test("each paper's article is read from its receipt, with Einstein as sole author", () => {
    expect(receipts.length).toBe(PAPER_KEYS.size);
    expect(receipts.length).toBeGreaterThan(0);
    for (const fm of receipts) {
      const a = historicalArticle(fm) as Record<string, unknown>;
      expect(a.name).toBe(fm.paper.titleGerman);
      expect(a.author).toEqual({ "@type": "Person", name: "Albert Einstein" });
      expect(a.inLanguage).toBe("de");
      expect(a.datePublished).toBe(
        fm.paper.dates.find((d) => d.type === "issue-publication")?.iso as string,
      );
      expect(a.pageStart).toBe(fm.paper.journal.pages.first);
      expect(a.pageEnd).toBe(fm.paper.journal.pages.last);
      expect(a.identifier).toEqual({
        "@type": "PropertyValue",
        propertyID: "DOI",
        value: fm.paper.journal.doi,
      });
      // The whole-series volume is an additional property, never the volume number.
      const volume = (a.isPartOf as { isPartOf: Record<string, unknown> }).isPartOf;
      expect(volume.volumeNumber).toBe(String(fm.paper.journal.volume));
      expect(JSON.stringify(volume.additionalProperty)).toContain(
        `"wholeSeriesVolume","value":${fm.paper.journal.wholeSeriesVolume}`,
      );
      for (const field of ["translator", "version", "license"]) expect(field in a).toBe(false);
    }
  });

  test("later-edition DOIs are labelled as later editions and never replace the citation DOI", () => {
    const withLater = receipts.filter((fm) => (fm.paper.journal.laterEditionDois ?? []).length > 0);
    expect(withLater.length).toBeGreaterThan(0);
    for (const fm of withLater) {
      const a = historicalArticle(fm) as { workExample: { name: string }[]; identifier: unknown };
      expect(a.workExample.every((w) => w.name.startsWith("Later edition: "))).toBe(true);
      expect(JSON.stringify(a.identifier)).toContain(fm.paper.journal.doi);
    }
  });

  test("the article and its commentary pass together, and the commentary points at the article", () => {
    expect(codeOf([article(), note()])).toBeUndefined();
    const c = note().entity as { isBasedOn: { "@id": string } };
    expect(c.isBasedOn["@id"]).toBe(articleId((first as NonNullable<typeof first>).slug));
  });
});

describe("each attribution rule refuses its violation", () => {
  test('Einstein as translator of the commentary: "scholarly-einstein-misattributed"', () => {
    expect(codeOf([article(), note({ translator: { name: "Albert Einstein" } })])).toBe(
      "scholarly-einstein-misattributed",
    );
  });

  test('a 1905 datePublished on the commentary: "scholarly-historical-date-on-edition"', () => {
    expect(codeOf([article(), note({ datePublished: "1905-07-18" })])).toBe(
      "scholarly-historical-date-on-edition",
    );
  });

  test('a translation with no translationOfWork: "scholarly-missing-translation-of-work"', () => {
    const translation: TaggedEntity = {
      role: "translation",
      entity: { "@type": "ScholarlyArticle", "@id": "x#translation", inLanguage: "en" },
    };
    expect(codeOf([article(), translation])).toBe("scholarly-missing-translation-of-work");
  });

  test('a commentary with no isBasedOn: "scholarly-missing-is-based-on"', () => {
    expect(codeOf([article(), note({}, "isBasedOn")])).toBe("scholarly-missing-is-based-on");
  });

  test('a license on the historical article: "scholarly-article-carries-edition-field"', () => {
    const licensed: TaggedEntity = {
      role: "historical-article",
      entity: { ...article().entity, license: "https://example.org/LICENSE" },
    };
    expect(codeOf([licensed, note()])).toBe("scholarly-article-carries-edition-field");
  });

  test('a DOI on the commentary: "scholarly-doi-off-article"', () => {
    expect(
      codeOf([
        article(),
        note({ identifier: { "@type": "PropertyValue", propertyID: "DOI", value: "10.1/x" } }),
      ]),
    ).toBe("scholarly-doi-off-article");
  });
});
