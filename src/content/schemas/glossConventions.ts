/**
 * Gloss modality conventions: the filesystem loader.
 *
 * This module reads `docs/editorial/GLOSS_CONVENTIONS.md` and is therefore
 * server-only. Everything that is not I/O -- `DEFAULT_MODALITY_CLASSES`, the
 * `GlossConventions` shape, `parseModalityClassesFromContent`, and the
 * `isModalityClass` predicate -- is declared in `glossConventions.pure.ts` and
 * re-exported here, so a server-side caller keeps one import and a Client
 * Component can reach the pure half without reaching `node:fs`.
 *
 * A Client Component must never import this file. The RSC client boundary gate
 * enforces that. Specification: AGENTS.md. Separation: am-bwnf.
 */

import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_MODALITY_CLASSES,
  type GlossConventions,
  parseModalityClassesFromContent,
} from "./glossConventions.pure.ts";

export {
  DEFAULT_MODALITY_CLASSES,
  type GlossConventions,
  isModalityClass,
  parseModalityClassesFromContent,
} from "./glossConventions.pure.ts";

/**
 * Loads gloss conventions from the filesystem.
 * Falls back to default modality classes with recorded warning if file is missing or lacks modalityClasses.
 */
export function loadGlossConventions(customPath?: string): GlossConventions {
  const resolvedPath =
    customPath ?? path.resolve(process.cwd(), "docs/editorial/GLOSS_CONVENTIONS.md");
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("is not a valid GlossNoteClass")) {
      throw err;
    }
    warnings.push(`Error reading ${resolvedPath}: ${message}`);
    return {
      modalityClasses: DEFAULT_MODALITY_CLASSES,
      warnings: Object.freeze(warnings),
    };
  }
}

let cachedConventions: GlossConventions | null = null;

/**
 * Retrieves the active modality classes for reasoning words.
 *
 * Server-only. A Server Component calls this once and passes the result to the
 * reading faces as data; the faces never resolve the list themselves.
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
