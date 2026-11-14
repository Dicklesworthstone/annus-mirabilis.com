/** Server-only content adapter. The public route validates its authored group on every build. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseContentYaml } from "../../content/compiler/loaders.ts";
import { loadQuantityRegistry } from "../../content/quantities/registry.ts";
import { validateExperiment } from "../../content/schemas/experiment.ts";
import { compileExperimentGroup } from "./schema.ts";

export function loadRelativityObserverGroup() {
  const root = join("content", "experiments");
  const groupFile = join(root, "groups", "relativity-observer.yaml");
  const manifests = new Map(
    ["sr-09", "sr-10"].map((id) => {
      const path = join(root, `${id}.yaml`);
      return [
        id,
        validateExperiment(parseContentYaml(readFileSync(path, "utf8"), path), path),
      ] as const;
    }),
  );
  return compileExperimentGroup(
    parseContentYaml(readFileSync(groupFile, "utf8"), groupFile),
    manifests,
    new Set(loadQuantityRegistry().ids),
  );
}
