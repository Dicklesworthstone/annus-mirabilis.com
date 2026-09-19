/**
 * Server-side loader for bilingual editions (German source blocks,
 * English translation units, alignment, editorial notes, and review records).
 *
 * Spec: AGENTS.md and am-read-bilingual-faces-pao
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../../content/provenance/yaml.ts";
import type { ReviewRecord } from "../../content/schemas/review.ts";
import type {
  Alignment,
  EditorialNote,
  Paper,
  SourceBlock,
  TranslationUnit,
} from "../../content/schemas/source.ts";
import { loadPaper } from "../../content/server.ts";

export interface BilingualEdition {
  readonly paper: Paper;
  readonly blocks: readonly SourceBlock[];
  readonly units: readonly TranslationUnit[];
  readonly alignment?: Alignment | undefined;
  readonly editorialNotes?: readonly EditorialNote[] | undefined;
  readonly reviewRecords?: readonly ReviewRecord[] | undefined;
}

type TestOverrideFn = (paperId: string) => BilingualEdition | null | undefined;
let testOverride: TestOverrideFn | null = null;

/**
 * Sets a test override for bilingual edition loading. Pass `null` to reset.
 */
export function setBilingualEditionTestOverride(fn: TestOverrideFn | null): void {
  testOverride = fn;
}

/**
 * Checks whether reviewed source blocks and translation units are available
 * for a given paper.
 *
 * Returns the loaded edition if both source blocks and translation units are
 * present, or null if the paper's source layers are in-preparation/empty.
 */
export async function loadBilingualEdition(
  paperId: string,
  rootDir: string = process.cwd(),
): Promise<BilingualEdition | null> {
  if (testOverride) {
    const overridden = testOverride(paperId);
    if (overridden !== undefined) {
      return overridden;
    }
  }

  // 1. Check generated/content/index.json for compiled bilingual payload if present
  try {
    const indexPath = join(rootDir, "generated/content/index.json");
    if (existsSync(indexPath)) {
      const index = JSON.parse(readFileSync(indexPath, "utf8")) as {
        payloads?: Array<{ kind: string; id: string; file: string }>;
      };
      const entry = index.payloads?.find(
        (e) => (e.kind === "bilingual-edition" || e.kind === "edition") && e.id === paperId,
      );
      if (entry) {
        const fullPath = join(rootDir, "generated/content", entry.file);
        if (existsSync(fullPath)) {
          const compiled = JSON.parse(readFileSync(fullPath, "utf8")) as BilingualEdition;
          if (
            compiled.blocks &&
            compiled.blocks.length > 0 &&
            compiled.units &&
            compiled.units.length > 0
          ) {
            return compiled;
          }
        }
      }
    }
  } catch {
    // Proceed to filesystem checks
  }

  // 2. Check source manifest: content/source-blocks/${paperId}/manifest.yaml (or .json)
  const manifestYamlPath = join(rootDir, `content/source-blocks/${paperId}/manifest.yaml`);
  const manifestJsonPath = join(rootDir, `content/source-blocks/${paperId}/manifest.json`);

  let manifestUnits: unknown[] = [];
  if (existsSync(manifestYamlPath)) {
    try {
      const content = readFileSync(manifestYamlPath, "utf8");
      const parsed = parseYaml(content) as { units?: unknown[] } | null;
      if (parsed && Array.isArray(parsed.units)) {
        manifestUnits = parsed.units;
      }
    } catch {
      return null;
    }
  } else if (existsSync(manifestJsonPath)) {
    try {
      const content = readFileSync(manifestJsonPath, "utf8");
      const parsed = JSON.parse(content) as { units?: unknown[] } | null;
      if (parsed && Array.isArray(parsed.units)) {
        manifestUnits = parsed.units;
      }
    } catch {
      return null;
    }
  } else {
    return null;
  }

  // If manifest has empty units (like brownian-motion today: units: []), there are no source blocks
  if (manifestUnits.length === 0) {
    return null;
  }

  // 3. Verify that translation units exist in content/translation-units/${paperId}
  const translationDir = join(rootDir, `content/translation-units/${paperId}`);
  if (!existsSync(translationDir)) {
    return null;
  }

  const translationFiles = readdirSync(translationDir).filter(
    (f) => f.endsWith(".json") || f.endsWith(".yaml") || f.endsWith(".yml"),
  );
  if (translationFiles.length === 0) {
    return null;
  }

  // 4. If both exist on disk, load paper payload to get the canonical paper object
  try {
    const payload = await loadPaper(paperId);
    const paper = payload.paper;

    // Load source blocks from source-blocks directory
    const sourceBlocksDir = join(rootDir, `content/source-blocks/${paperId}`);
    const blockFiles = readdirSync(sourceBlocksDir)
      .filter(
        (f) =>
          (f.endsWith(".json") || f.endsWith(".yaml") || f.endsWith(".yml")) &&
          !f.startsWith("manifest"),
      )
      .sort();

    const blocks: SourceBlock[] = [];
    for (const file of blockFiles) {
      const filePath = join(sourceBlocksDir, file);
      const raw = readFileSync(filePath, "utf8");
      const data = file.endsWith(".json")
        ? JSON.parse(raw)
        : (parseYaml(raw) as Record<string, unknown>);
      if (data && typeof data === "object") {
        blocks.push(data as SourceBlock);
      }
    }

    if (blocks.length === 0) return null;

    // Load translation units
    const units: TranslationUnit[] = [];
    for (const file of translationFiles.sort()) {
      const filePath = join(translationDir, file);
      const raw = readFileSync(filePath, "utf8");
      const data = file.endsWith(".json")
        ? JSON.parse(raw)
        : (parseYaml(raw) as Record<string, unknown>);
      if (data && typeof data === "object") {
        units.push(data as TranslationUnit);
      }
    }

    if (units.length === 0) return null;

    // Optionally load alignment: content/alignments/${paperId}.yaml / .json
    let alignment: Alignment | undefined;
    const alignYamlPath = join(rootDir, `content/alignments/${paperId}.yaml`);
    const alignJsonPath = join(rootDir, `content/alignments/${paperId}.json`);
    if (existsSync(alignYamlPath)) {
      try {
        alignment = parseYaml(readFileSync(alignYamlPath, "utf8")) as Alignment;
      } catch {
        // Alignment remains undefined
      }
    } else if (existsSync(alignJsonPath)) {
      try {
        alignment = JSON.parse(readFileSync(alignJsonPath, "utf8")) as Alignment;
      } catch {
        // Alignment remains undefined
      }
    }

    return {
      paper,
      blocks,
      units,
      ...(alignment ? { alignment } : {}),
    };
  } catch {
    return null;
  }
}
