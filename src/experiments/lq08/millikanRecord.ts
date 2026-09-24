/**
 * Server side: the Millikan 1916 overlay as LQ-08's page and embed build it
 * (am-data-millikan-1916-zh2q). The record is read and judged here, at build time; the client
 * receives only the result, so a withheld record's rows never reach a page.
 */
import { loadDatasetPlotVerdict } from "../../content/datasets/loadPlotVerdict.ts";
import {
  evaluateMillikanOverlay,
  MILLIKAN_1916_DATASET_ID,
  type MillikanOverlayResult,
  STOPPING_LINE_AXES,
} from "./millikan.ts";

export function loadMillikanOverlay(rootDir = process.cwd()): MillikanOverlayResult {
  return evaluateMillikanOverlay(
    loadDatasetPlotVerdict(MILLIKAN_1916_DATASET_ID, STOPPING_LINE_AXES, rootDir),
  );
}
