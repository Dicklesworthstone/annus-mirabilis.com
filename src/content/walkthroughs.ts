/** Build-time reading of ALL authored checkpoint stops, including stops that cannot be replayed. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permalinkTapeFromControlTape } from "../experiments/permalink/fromControlTape.ts";
import type { TapeV2 } from "../experiments/permalink/types.ts";
import {
  type CheckpointWalkthrough,
  checkpointPrefixes,
  type WalkthroughCatalogue,
} from "../experiments/permalink/walkthroughCheckpoints.ts";
import { validateControlTape } from "../experiments/tapes/schema.ts";
import { parseYaml } from "./provenance/yaml.ts";

function withoutReference(tape: TapeV2): TapeV2 {
  const { teachingTapeRef: _ref, ...rest } = tape;
  return rest;
}

export function loadWalkthroughCatalogue(root: string = process.cwd()): WalkthroughCatalogue {
  const dir = join(root, "content", "experiments", "tapes");
  const walkthroughs: CheckpointWalkthrough[] = [];
  const problems: string[] = [];
  if (!existsSync(dir))
    return { walkthroughs, problems: ["The walkthrough directory is missing."] };
  for (const file of readdirSync(dir)
    .filter((name) => name.endsWith(".yaml"))
    .sort()) {
    try {
      const record = validateControlTape(parseYaml(readFileSync(join(dir, file), "utf8")), file);
      const checkpoints = checkpointPrefixes(record).map((prefix) => {
        const converted = permalinkTapeFromControlTape(prefix.record);
        // The request already carries its exact event prefix. A self-reference to step zero would
        // replace that prefix at replay time and lose the checkpoint the reader actually selected.
        const tape = converted.kind === "converted" ? converted.tape : null;
        return {
          actionIndex: prefix.actionIndex,
          label: prefix.label,
          ...(prefix.teachingNote ? { teachingNote: prefix.teachingNote } : {}),
          settings: prefix.settings,
          tape: tape ? withoutReference(tape) : null,
          ...(converted.kind === "unconvertible"
            ? { unavailable: `${converted.reason} ${converted.repair}` }
            : {}),
        };
      });
      walkthroughs.push({
        tapeId: record.tapeId,
        experimentId: record.experimentId,
        title: record.title || record.tapeId,
        ...(record.description ? { description: record.description } : {}),
        checkpoints,
      });
    } catch (error) {
      problems.push(`${file}: ${String(error)}`);
    }
  }
  return { walkthroughs, problems };
}
