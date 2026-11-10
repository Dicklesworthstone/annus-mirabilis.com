/** Canonical measurements and their publication details for the results face. */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadHistoricalDataset } from "../datasets/loader.ts";
import { datasetCitationText } from "../datasets/loadPlotVerdict.ts";
import { formatDate } from "../dates.ts";
import { datasetValuesMayBeShown, type HistoricalDataset } from "../schemas/experiment.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards } from "./resultCards.ts";

/** A dangling result reference must not silently hide a measurement from every card. */
export function checkReceptionTargets(
  datasets: readonly HistoricalDataset[],
  resultIds: ReadonlySet<string>,
): void {
  for (const dataset of datasets) {
    if (!datasetValuesMayBeShown(dataset)) continue;
    for (const address of dataset.addressesResults ?? []) {
      if (!resultIds.has(address.resultId))
        throw new ResultCardsError(
          "result-reception-target-missing",
          `${dataset.id}: later evidence names no result card: ${address.resultId}.`,
        );
    }
  }
}

/** Read records at build time. Withdrawn or synthetic rows never enter a reader payload. */
export function loadReceptionDatasets(root: string): readonly HistoricalDataset[] {
  const directory = join(root, "content", "datasets");
  if (!existsSync(directory)) return [];
  const datasets = readdirSync(directory)
    .filter((name) => name.endsWith(".yaml"))
    .sort()
    .map((name) => loadHistoricalDataset(join(directory, name)))
    .filter((dataset) => datasetValuesMayBeShown(dataset));
  const resultDirectory = join(root, "content", "results");
  const resultIds = new Set<string>();
  if (existsSync(resultDirectory)) {
    for (const name of readdirSync(resultDirectory).filter((file) => file.endsWith(".yaml"))) {
      const loaded = loadResultCards(root, name.slice(0, -5));
      for (const card of loaded?.cards ?? []) resultIds.add(card.id);
    }
  }
  checkReceptionTargets(datasets, resultIds);
  return Object.freeze(datasets);
}

/** Publication precision is kept as authored; a digitization date is never evidence's date. */
export function receptionPublication(dataset: HistoricalDataset, root: string) {
  const publication = dataset.publications.find((p) => p.id === dataset.primaryPublicationId);
  if (!publication)
    throw new ResultCardsError(
      "result-reception-publication-missing",
      `${dataset.id}: its primary publication does not resolve.`,
    );
  const locator = publication.locator;
  const sourceLocator =
    locator.kind === "figure"
      ? `Figure ${locator.number}`
      : locator.kind === "table"
        ? `Table ${locator.number}`
        : locator.kind === "unnumbered-table"
          ? `Table on page ${locator.page}`
          : `Page ${locator.page}, sentence ${locator.sentence}`;
  // A rights source can also be a plain description. Only an ordinary web URL becomes a link.
  const sourceUrl = URL.canParse(dataset.rights.source) ? new URL(dataset.rights.source) : null;
  const sourceHref =
    sourceUrl && ["https:", "http:"].includes(sourceUrl.protocol) ? sourceUrl.href : undefined;
  const publicationDate = publication.publicationDate;
  const date =
    publicationDate.text ??
    (publicationDate.precision === "range"
      ? `${publicationDate.earliest} to ${publicationDate.latest}`
      : formatDate(publicationDate));
  return {
    date,
    precision: publicationDate.precision,
    citation: datasetCitationText(dataset, root),
    sourceLocator,
    ...(sourceHref ? { sourceHref } : {}),
  };
}
