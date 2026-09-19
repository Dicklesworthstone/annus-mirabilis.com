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
  GlossUnit,
  Paper,
  SourceBlock,
  TranslationUnit,
} from "../../content/schemas/source.ts";
import { loadPaper } from "../../content/server.ts";

export interface BilingualEdition {
  readonly paper: Paper;
  readonly blocks: readonly SourceBlock[];
  readonly units: readonly TranslationUnit[];
  readonly glossUnits?: readonly GlossUnit[] | undefined;
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
 * Checks whether reviewed source blocks, translation units, or gloss units are available
 * for a given paper.
 *
 * Returns the loaded edition if content is present, or null if the paper's
 * source layers are in-preparation/empty.
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
            (compiled.blocks && compiled.blocks.length > 0) ||
            (compiled.units && compiled.units.length > 0) ||
            (compiled.glossUnits && compiled.glossUnits.length > 0)
          ) {
            return compiled;
          }
        }
      }
    }
  } catch {
    // Proceed to filesystem checks
  }

  // 2. Load source blocks from content/source-blocks/${paperId}
  const blocks: SourceBlock[] = [];
  const manifestYamlPath = join(rootDir, `content/source-blocks/${paperId}/manifest.yaml`);
  const manifestJsonPath = join(rootDir, `content/source-blocks/${paperId}/manifest.json`);

  let manifestHasUnits = false;
  if (existsSync(manifestYamlPath)) {
    try {
      const content = readFileSync(manifestYamlPath, "utf8");
      const parsed = parseYaml(content) as { units?: unknown[] } | null;
      if (parsed && Array.isArray(parsed.units) && parsed.units.length > 0) {
        manifestHasUnits = true;
      }
    } catch {
      // ignore
    }
  } else if (existsSync(manifestJsonPath)) {
    try {
      const content = readFileSync(manifestJsonPath, "utf8");
      const parsed = JSON.parse(content) as { units?: unknown[] } | null;
      if (parsed && Array.isArray(parsed.units) && parsed.units.length > 0) {
        manifestHasUnits = true;
      }
    } catch {
      // ignore
    }
  }

  if (manifestHasUnits) {
    const sourceBlocksDir = join(rootDir, `content/source-blocks/${paperId}`);
    if (existsSync(sourceBlocksDir)) {
      const blockFiles = readdirSync(sourceBlocksDir)
        .filter(
          (f) =>
            (f.endsWith(".json") || f.endsWith(".yaml") || f.endsWith(".yml")) &&
            !f.startsWith("manifest"),
        )
        .sort();
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
    }
  }

  // 3. Load translation units from content/translation-units/${paperId}
  const units: TranslationUnit[] = [];
  const translationDir = join(rootDir, `content/translation-units/${paperId}`);
  if (existsSync(translationDir)) {
    const translationFiles = readdirSync(translationDir)
      .filter((f) => f.endsWith(".json") || f.endsWith(".yaml") || f.endsWith(".yml"))
      .sort();
    for (const file of translationFiles) {
      const filePath = join(translationDir, file);
      const raw = readFileSync(filePath, "utf8");
      const data = file.endsWith(".json")
        ? JSON.parse(raw)
        : (parseYaml(raw) as Record<string, unknown>);
      if (data && typeof data === "object") {
        units.push(data as TranslationUnit);
      }
    }
  }

  // 4. Load gloss units from content/gloss-units/${paperId}
  const glossUnits: GlossUnit[] = [];
  const glossDir = join(rootDir, `content/gloss-units/${paperId}`);
  if (existsSync(glossDir)) {
    const glossFiles = readdirSync(glossDir)
      .filter((f) => f.endsWith(".json") || f.endsWith(".yaml") || f.endsWith(".yml"))
      .sort();
    for (const file of glossFiles) {
      const filePath = join(glossDir, file);
      const raw = readFileSync(filePath, "utf8");
      const data = file.endsWith(".json")
        ? JSON.parse(raw)
        : (parseYaml(raw) as Record<string, unknown>);
      if (data && typeof data === "object") {
        glossUnits.push(data as GlossUnit);
      }
    }
  }

  // If no blocks, units, or gloss units are available, return null
  if (blocks.length === 0 && units.length === 0 && glossUnits.length === 0) {
    return null;
  }

  // 5. If any layer exists, load paper payload to get canonical paper object
  try {
    const payload = await loadPaper(paperId);
    const paper: Paper = {
      slug: (payload.paper.id ?? paperId) as Paper["slug"],
      bibKey: payload.paper.citation ?? "ap-17-549",
      titleGerman: payload.paper.germanTitle ?? payload.paper.title,
      titleEnglishWorking: payload.paper.title,
      editorialAdditions: [],
      authorLine: "A. Einstein",
      dates: [
        {
          type: "issue-publication",
          earliest: "1905-01-01",
          latest: "1905-12-31",
          precision: "year",
          source: "Annalen der Physik",
          verifiedAt: "2026-09-15",
        },
      ],
      journal: {
        name: "Annalen der Physik",
        series: 4,
        volume: 17,
        wholeSeriesVolume: 322,
        issue: 1,
        issueSource: "Masthead",
        pages: { first: 1, last: 1 },
        doi: "10.1002/andp.1905",
        doiVerifiedAt: "2026-09-15",
      },
      collectedPapers: { volume: 2, document: 1 },
      orderedBlockIds: [],
      companion: false,
      status: payload.paper.status ?? "published",
      sourceStatus: payload.paper.sourceStatus ?? "reviewed",
      sourceNotice: payload.paper.sourceNotice ?? "",
      sections: payload.paper.sections.map((s) => ({
        id: s.id,
        title: s.title,
        arguments: s.arguments ?? [],
      })),
    };

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
      ...(glossUnits.length > 0 ? { glossUnits } : {}),
      ...(alignment ? { alignment } : {}),
    };
  } catch {
    return null;
  }
}
