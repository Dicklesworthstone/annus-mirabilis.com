/** Loaded on demand by a reader opening the checkpoint player; never imports node:fs in a lab. */
import generated from "../../generated/walkthroughs.json";
import type { WalkthroughCatalogue } from "./walkthroughCheckpoints.ts";

export const WALKTHROUGH_CATALOGUE: WalkthroughCatalogue =
  generated as unknown as WalkthroughCatalogue;
