/**
 * Loads and caches notation concordance YAML files from content/notation/.
 * Specification: AGENTS.md, am-not-concordance-model-uag, am-not-entries-brownian-1rq.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { type PaperConcordance, validatePaperConcordance } from "../schemas/concordance.ts";
import { strictParse } from "../schemas/strictParse.ts";

export const NOTATION_DIR = join(process.cwd(), "content", "notation");

const concordanceCache = new Map<string, PaperConcordance>();

/**
 * Loads and validates a paper concordance file from content/notation/<paper>.yaml.
 */
export function loadConcordanceForPaper(paper: string, dir = NOTATION_DIR): PaperConcordance {
  const cached = concordanceCache.get(paper);
  if (cached !== undefined) {
    return cached;
  }
  const filePath = join(dir, `${paper}.yaml`);
  if (!existsSync(filePath)) {
    throw new Error(`Concordance file not found: ${filePath}`);
  }
  const content = readFileSync(filePath, "utf8");
  const parsed = strictParse(content, "yaml");
  const validated = validatePaperConcordance(parsed, filePath);
  concordanceCache.set(paper, validated);
  return validated;
}

/**
 * Loads all paper concordance files from the notation directory.
 */
export function loadAllConcordances(dir = NOTATION_DIR): readonly PaperConcordance[] {
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => extname(f) === ".yaml" || extname(f) === ".yml");
  const concordances: PaperConcordance[] = [];
  for (const f of files) {
    const paper = f.replace(/\.ya?ml$/, "");
    concordances.push(loadConcordanceForPaper(paper, dir));
  }
  return concordances;
}

/**
 * Clears the concordance cache (primarily for tests).
 */
export function clearConcordanceCache(): void {
  concordanceCache.clear();
}

/**
 * Registers an in-memory concordance for tests.
 */
export function registerConcordance(concordance: PaperConcordance): void {
  concordanceCache.set(concordance.paper, concordance);
}
