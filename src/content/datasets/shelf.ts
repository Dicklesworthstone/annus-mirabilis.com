import type { HistoricalDataset, PaperDate } from "../schemas/experiment.ts";

export const HISTORICAL_SHELF_CUTOFF = "1904-12-31";

/**
 * Checks whether a publication is eligible for discovery shelf display (pre-1905 cutoff).
 */
export function isPublicationShelfEligible(publicationDate: PaperDate): boolean {
  if (publicationDate.latest) {
    return publicationDate.latest <= HISTORICAL_SHELF_CUTOFF;
  }
  if (publicationDate.earliest) {
    return publicationDate.earliest <= HISTORICAL_SHELF_CUTOFF;
  }
  return false;
}

export type ShelfEligibilityResult = Readonly<{
  eligible: boolean;
  publicationYear: string;
  badgeLabel?: string | undefined;
}>;

/**
 * Evaluates shelf eligibility for a dataset or a specific series within a dataset.
 */
export function getDatasetShelfStatus(
  dataset: HistoricalDataset,
  seriesId?: string,
): ShelfEligibilityResult {
  let pub = dataset.publications.find((p) => p.id === dataset.primaryPublicationId);
  if (seriesId && dataset.series) {
    const s = dataset.series.find((ser) => ser.id === seriesId);
    if (s) {
      const seriesPub = dataset.publications.find((p) => p.id === s.publicationId);
      if (seriesPub) pub = seriesPub;
    }
  }

  const pubDate = pub?.publicationDate ?? dataset.publications[0]?.publicationDate;
  if (!pubDate) {
    return {
      eligible: false,
      publicationYear: "unknown",
      badgeLabel: "later evidence, published unknown",
    };
  }

  const year =
    pubDate.earliest?.slice(0, 4) ?? pubDate.latest?.slice(0, 4) ?? pubDate.text ?? "unknown";
  const eligible = isPublicationShelfEligible(pubDate);

  return {
    eligible,
    publicationYear: year,
    badgeLabel: eligible ? undefined : `later evidence, published ${year}`,
  };
}
