#!/usr/bin/env bun
/**
 * Result cards name an experiment and a preset so the reader can interrogate the claim. Resolve
 * those settings at build time through the existing laboratory codecs. The reader receives only
 * the link and whether it fills a form or applies settings, never the numerical owner modules.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadResultCards } from "../src/content/results/resultCards.ts";
import {
  type ExperimentLaunch,
  experimentSelectionKey,
} from "../src/discovery/capstone/experimentLaunch.ts";
import { CAPSTONE_PAPERS, declaredPreset } from "./generate-capstone-links.ts";

export function buildResultProbeLinks(root: string = process.cwd()) {
  const links: Record<string, ExperimentLaunch> = {};
  const problems: string[] = [];
  let probes = 0;
  for (const paper of CAPSTONE_PAPERS) {
    const loaded = loadResultCards(root, paper);
    if (!loaded) {
      problems.push(`${paper}: no result cards could be loaded.`);
      continue;
    }
    problems.push(...loaded.problems.map((problem) => `${paper}: ${problem}`));
    for (const card of loaded.cards) {
      for (const probe of card.probes) {
        probes++;
        if (!probe.preset) continue;
        const selection = { instrumentId: probe.instrumentId, presetId: probe.preset.id };
        const key = experimentSelectionKey(selection);
        if (!Object.hasOwn(links, key)) links[key] = declaredPreset(selection, root);
      }
    }
  }
  return { links, problems, probes };
}

export async function generateResultProbeLinks() {
  const built = buildResultProbeLinks();
  if (built.problems.length === 0) {
    const destination = resolve(process.cwd(), "src/generated/result-probe-links.json");
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, `${JSON.stringify(built.links, null, 2)}\n`);
  }
  const selections = Object.values(built.links);
  return {
    probes: built.probes,
    presetSelections: selections.length,
    linked: selections.filter((link) => link.status === "ready").length,
    unavailable: selections.filter((link) => link.status === "unavailable"),
    problems: built.problems,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await generateResultProbeLinks();
  console.log(JSON.stringify(result));
  if (result.problems.length > 0) process.exitCode = 1;
}
