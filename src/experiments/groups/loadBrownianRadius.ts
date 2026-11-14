import { readFileSync } from "node:fs";
import { parseContentYaml } from "../../content/compiler/loaders.ts";
import { getQuantityRegistry } from "../../content/quantities/registry.ts";
import { validateExperiment } from "../../content/schemas/experiment.ts";
import { compileExperimentGroup } from "./schema.ts";

/** The route consumes this authored declaration at build time; no filesystem code enters the client. */
export function loadBrownianRadiusGroup() {
  const path = "content/experiments/groups/brownian-radius.yaml";
  const experiments = ["bm-01", "bm-06"].map((id) => {
    const manifest = "content/experiments/" + id + ".yaml";
    return validateExperiment(parseContentYaml(readFileSync(manifest, "utf8"), manifest), manifest);
  });
  return compileExperimentGroup(
    parseContentYaml(readFileSync(path, "utf8"), path),
    new Map(experiments.map((experiment) => [experiment.id, experiment])),
    new Set(getQuantityRegistry().ids),
  );
}
