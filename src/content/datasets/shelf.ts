import type { PaperDate } from "../schemas/dates.ts";
import type { HistoricalDataset } from "../schemas/experiment.ts";

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

export class ShelfIneligibilityError extends Error {
  readonly code = "shelf-dataset-ineligible";
  readonly datasetId: string;
  readonly seriesId?: string | undefined;
  readonly publicationId?: string | undefined;
  readonly publicationYear: string;

  constructor(
    datasetId: string,
    publicationYear: string,
    options?: { seriesId?: string | undefined; publicationId?: string | undefined },
  ) {
    const target = options?.seriesId
      ? ` series "${options.seriesId}"`
      : options?.publicationId
        ? ` publication "${options.publicationId}"`
        : "";
    super(
      `Dataset "${datasetId}"${target} published in ${publicationYear} is after 1904-12-31 cutoff and ineligible for shelf display. (shelf-dataset-ineligible)`,
    );
    this.name = "ShelfIneligibilityError";
    this.datasetId = datasetId;
    this.publicationYear = publicationYear;
    this.seriesId = options?.seriesId;
    this.publicationId = options?.publicationId;
  }
}

/**
 * Evaluates shelf eligibility for a dataset, a specific series, or a specific cited publication.
 */
export function getDatasetShelfStatus(
  dataset: HistoricalDataset,
  seriesId?: string,
  publicationId?: string,
): ShelfEligibilityResult {
  let pub = publicationId
    ? dataset.publications.find((p) => p.id === publicationId)
    : dataset.publications.find((p) => p.id === dataset.primaryPublicationId);

  if (!publicationId && seriesId && dataset.series) {
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
  let eligible = isPublicationShelfEligible(pubDate);

  // If a specific publication is cited and an earlier publication exists for this dataset/series,
  // shelf use must cite the earlier report.
  if (eligible && publicationId && dataset.publications.length > 1) {
    const citedDate = pubDate.earliest ?? pubDate.latest ?? "";
    const earlierPub = dataset.publications.find((p) => {
      const pDate = p.publicationDate.earliest ?? p.publicationDate.latest ?? "";
      return pDate && citedDate && pDate < citedDate;
    });
    if (earlierPub) {
      eligible = false;
      return {
        eligible: false,
        publicationYear: year,
        badgeLabel: `shelf must cite earlier report (${earlierPub.id})`,
      };
    }
  }

  return {
    eligible,
    publicationYear: year,
    badgeLabel: eligible ? undefined : `later evidence, published ${year}`,
  };
}

/**
 * Asserts that a dataset, series, or cited publication is shelf-eligible, throwing ShelfIneligibilityError if not.
 */
export function assertDatasetShelfEligible(
  dataset: HistoricalDataset,
  seriesId?: string,
  publicationId?: string,
): ShelfEligibilityResult {
  const status = getDatasetShelfStatus(dataset, seriesId, publicationId);
  if (!status.eligible) {
    throw new ShelfIneligibilityError(dataset.id, status.publicationYear, {
      seriesId,
      publicationId,
    });
  }
  return status;
}
