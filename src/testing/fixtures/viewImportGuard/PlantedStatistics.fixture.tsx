/** Deliberate violation: view importing sample statistics function. */
import { computeSeriesMean } from "../../../content/datasets/statistics.ts";

export function PlantedStatistics() {
  const res = computeSeriesMean([]);
  return <span>{res.status}</span>;
}
