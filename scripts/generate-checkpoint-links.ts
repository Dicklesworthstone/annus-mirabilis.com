#!/usr/bin/env bun
/** Every authored stop gets a current-model settings link or an explicit reason it cannot load. */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadWalkthroughCatalogue } from "../src/content/walkthroughs.ts";
import { buildCheckpointLaunches,
  type CheckpointLaunchCatalogue,
} from "../src/experiments/permalink/checkpointLaunches.ts";
import { settingsFromTape } from "../src/experiments/permalink/sessionTape.ts";
import { buildPresetLaunch } from "./generate-capstone-links.ts";
import { DRAFT_BINDINGS, SESSION_BINDINGS } from "./generate-tape-links.ts";

export function buildCheckpointLinks(root: string = process.cwd()): CheckpointLaunchCatalogue {
  return buildCheckpointLaunches(loadWalkthroughCatalogue(root), (experimentId, recorded) => {
    const binding = SESSION_BINDINGS[experimentId] ?? DRAFT_BINDINGS[experimentId];
    if (!binding) return {
      status: "unavailable", instrumentId: experimentId,
      reason: "This laboratory has no checkpoint player yet.",
    };
    // Booleans cross the tape boundary as strings. Use the same conversion as a live restore,
    // followed by the owner validator and fresh settings checkpoint writer. Unknown keys refuse.
    const settings = settingsFromTape(recorded, binding.defaults);
    return buildPresetLaunch(experimentId, settings);
  });
}

export async function generateCheckpointLinks() {
  const catalogue = buildCheckpointLinks();
  const directory = resolve(process.cwd(), "src/generated");
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, "checkpoint-links.json"), `${JSON.stringify(catalogue, null, 2)}\n`);
  const stops = catalogue.walkthroughs.flatMap((entry) => entry.stops);
  return {
    walkthroughs: catalogue.walkthroughs.length,
    stops: stops.length,
    linked: stops.filter((stop) => stop.launch.status === "ready").length,
    unavailable: stops.filter((stop) => stop.launch.status === "unavailable").length,
    problems: catalogue.problems,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await generateCheckpointLinks()));
}
