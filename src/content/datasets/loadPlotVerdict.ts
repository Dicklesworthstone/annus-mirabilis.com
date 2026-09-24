/**
 * Server side: read a canonical HistoricalDataset from content/datasets/ and decide what a view may
 * draw from it (am-data-millikan-1916-zh2q). Pages call this at build time and pass the verdict,
 * never the record, to client components.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { HistoricalDataset } from "../schemas/experiment.ts";
import { loadHistoricalDataset } from "./loader.ts";
import { type DatasetPlotVerdict, datasetPlotVerdict, type PlotAxis } from "./plotVerdict.ts";

export function loadDatasetPlotVerdict(
  datasetId: string,
  axes: Readonly<{ x: PlotAxis; y: PlotAxis }>,
  rootDir = process.cwd(),
): DatasetPlotVerdict {
  const dataset = loadHistoricalDataset(resolve(rootDir, "content/datasets", `${datasetId}.yaml`));
  return datasetPlotVerdict(dataset, axes.x, axes.y, datasetCitationText(dataset, rootDir));
}

/**
 * The primary publication's citation as a reader sees it. A bibliography id (cit-…) resolves to that
 * record's title and locator; a full citation string is used as written.
 */
export function datasetCitationText(dataset: HistoricalDataset, rootDir = process.cwd()): string {
  const publication =
    dataset.publications.find((p) => p.id === dataset.primaryPublicationId) ??
    dataset.publications[0];
  const citation = publication?.citation;
  if (citation === undefined) return dataset.title;
  if (typeof citation !== "string") return citation.title;
  const path = resolve(rootDir, "content/bibliography", `${citation}.json`);
  if (!/^cit-[a-z0-9-]+$/.test(citation) || !existsSync(path)) return citation;
  const record = JSON.parse(readFileSync(path, "utf8")) as { title?: string; locator?: string };
  return [record.title, record.locator].filter(Boolean).join(", ");
}
