import fs from "node:fs";
import path from "node:path";
import { GLOSS_NOTE_CLASSES } from "./source.ts";

export const DEFAULT_MODALITY_CLASSES: readonly string[] = Object.freeze([
  "konjunktiv-i",
  "konjunktiv-ii",
]);

export interface GlossConventions {
  readonly modalityClasses: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Parses modalityClasses from a markdown/YAML conventions content string.
 */
export function parseModalityClassesFromContent(
  content: string,
  sourcePath = "GLOSS_CONVENTIONS.md",
): { modalityClasses: string[] | null; warnings: string[] } {
  const warnings: string[] = [];

  // Match YAML block or frontmatter: modalityClasses:\n  - item1\n  - item2
  const yamlMatch = content.match(/modalityClasses:\s*\n((?:\s*-\s*[^\n]+\n*)+)/);
  if (yamlMatch && yamlMatch[1]) {
    const rawItems = yamlMatch[1]
      .split("\n")
      .map((line) => line.replace(/^\s*-\s*/, "").trim())
      .filter(Boolean);

    // Validate against GLOSS_NOTE_CLASSES
    for (const item of rawItems) {
      if (!(GLOSS_NOTE_CLASSES as readonly string[]).includes(item)) {
        throw new Error(
          `[${path.basename(sourcePath)} -> source.ts] Class "${item}" in modalityClasses is not a valid GlossNoteClass in GLOSS_NOTE_CLASSES.`,
        );
      }
    }

    return { modalityClasses: rawItems, warnings };
  }

  // Fallback: search for markdown table with modality classes if present
  // e.g. | `konjunktiv-i` | or | konjunktiv-i |
  const tableMatches = content.match(/\|\s*`?([a-z0-9-]+)`?\s*\|\s*[^|]+\|/g);
  if (tableMatches && tableMatches.length > 0) {
    const foundClasses: string[] = [];
    for (const row of tableMatches) {
      const match = row.match(/\|\s*`?([a-z0-9-]+)`?\s*\|/);
      if (match && match[1]) {
        const cls = match[1];
        if ((GLOSS_NOTE_CLASSES as readonly string[]).includes(cls)) {
          if (!foundClasses.includes(cls)) {
            foundClasses.push(cls);
          }
        }
      }
    }
    if (foundClasses.length > 0) {
      return { modalityClasses: foundClasses, warnings };
    }
  }

  warnings.push(
    `${sourcePath} does not define modalityClasses; falling back to default modality classes [${DEFAULT_MODALITY_CLASSES.join(", ")}].`,
  );
  return { modalityClasses: null, warnings };
}

/**
 * Loads gloss conventions from the filesystem.
 * Falls back to default modality classes with recorded warning if file is missing or lacks modalityClasses.
 */
export function loadGlossConventions(customPath?: string): GlossConventions {
  const resolvedPath = customPath ?? path.resolve(process.cwd(), "docs/editorial/GLOSS_CONVENTIONS.md");
  const warnings: string[] = [];

  if (!fs.existsSync(resolvedPath)) {
    warnings.push(
      `Conventions file not found at ${resolvedPath}; falling back to default modality classes [${DEFAULT_MODALITY_CLASSES.join(", ")}].`,
    );
    return {
      modalityClasses: DEFAULT_MODALITY_CLASSES,
      warnings,
    };
  }

  try {
    const content = fs.readFileSync(resolvedPath, "utf8");
    const parsed = parseModalityClassesFromContent(content, resolvedPath);
    if (parsed.modalityClasses && parsed.modalityClasses.length > 0) {
      return {
        modalityClasses: Object.freeze(parsed.modalityClasses),
        warnings: Object.freeze(parsed.warnings),
      };
    }
    return {
      modalityClasses: DEFAULT_MODALITY_CLASSES,
      warnings: Object.freeze([...warnings, ...parsed.warnings]),
    };
  } catch (err: any) {
    if (err.message?.includes("is not a valid GlossNoteClass")) {
      throw err;
    }
    warnings.push(`Error reading ${resolvedPath}: ${err.message}`);
    return {
      modalityClasses: DEFAULT_MODALITY_CLASSES,
      warnings: Object.freeze(warnings),
    };
  }
}

let cachedConventions: GlossConventions | null = null;

/**
 * Retrieves the active modality classes for reasoning words.
 */
export function getModalityClasses(customPath?: string): readonly string[] {
  if (customPath) {
    return loadGlossConventions(customPath).modalityClasses;
  }
  if (!cachedConventions) {
    cachedConventions = loadGlossConventions();
  }
  return cachedConventions.modalityClasses;
}

/**
 * Checks if a note class belongs to the reasoning words modality group.
 */
export function isModalityClass(
  noteClass: string | undefined,
  modalityClasses?: readonly string[],
): boolean {
  if (!noteClass) return false;
  const classes = modalityClasses ?? getModalityClasses();
  return classes.includes(noteClass);
}
