/**
 * Gloss modality conventions: the parts that read nothing from disk.
 *
 * This is the client-safe half of `glossConventions.ts`. The reading faces need
 * two things from the conventions layer -- the default modality vocabulary and
 * the predicate that decides whether a gloss note class is a reasoning word --
 * and neither of them is I/O. Keeping them here is what lets `GlossFace`,
 * `GlossSentence` and `GlossPair` be Client Components without pulling
 * `node:fs` and `node:path` into the browser bundle.
 *
 * `glossConventions.ts` keeps the filesystem loader and re-exports everything
 * declared here, so there is one definition of each name.
 *
 * `isModalityClass` takes the resolved class list as a required argument on
 * purpose. The active list comes from `docs/editorial/GLOSS_CONVENTIONS.md`,
 * which only a server may read; a default applied silently in the browser would
 * mark fewer reasoning words than the edition declares and say nothing. The
 * server resolves the list once and threads it through as data.
 *
 * Specification: AGENTS.md and am-cm-schemas-source-1en. Separation: am-bwnf.
 */

import { GLOSS_NOTE_CLASSES } from "./source.pure.ts";

export const DEFAULT_MODALITY_CLASSES: readonly string[] = Object.freeze([
  "konjunktiv-i",
  "konjunktiv-ii",
]);

export interface GlossConventions {
  readonly modalityClasses: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Returns the final segment of a POSIX or Windows path, without `node:path`.
 */
function baseName(sourcePath: string): string {
  const segments = sourcePath.split(/[\\/]/);
  return segments[segments.length - 1] || sourcePath;
}

/**
 * Parses modalityClasses from a markdown/YAML conventions content string.
 */
/**
 * A conventions file that names a class GLOSS_NOTE_CLASSES does not contain.
 *
 * A TYPE, not a sentence (am-jrjy). The loader in ./glossConventions.ts must
 * distinguish a validation failure, which it rethrows, from an IO failure,
 * which it downgrades to a warning and falls back to the defaults. It used to
 * do that by testing whether the caught error's MESSAGE contained "is not a
 * valid GlossNoteClass" - prose produced here, matched there. Rewording this
 * string would have silently turned a validation failure into a warning, and
 * an invalid modality class into the default list, with nothing in either
 * module pointing at the other. `code` is carried as well as the class so the
 * check survives a module being instantiated twice.
 */
export class GlossConventionsValidationError extends Error {
  readonly code = "invalid-modality-class";

  constructor(message: string) {
    super(message);
    this.name = "GlossConventionsValidationError";
  }
}

export function parseModalityClassesFromContent(
  content: string,
  sourcePath = "GLOSS_CONVENTIONS.md",
): { modalityClasses: string[] | null; warnings: string[] } {
  const warnings: string[] = [];

  // Match YAML block or frontmatter: modalityClasses:\n  - item1\n  - item2
  const yamlMatch = content.match(/modalityClasses:\s*\n((?:\s*-\s*[^\n]+\n*)+)/);
  if (yamlMatch?.[1]) {
    const rawItems = yamlMatch[1]
      .split("\n")
      .map((line) => line.replace(/^\s*-\s*/, "").trim())
      .filter(Boolean);

    // Validate against GLOSS_NOTE_CLASSES
    for (const item of rawItems) {
      if (!(GLOSS_NOTE_CLASSES as readonly string[]).includes(item)) {
        throw new GlossConventionsValidationError(
          `[${baseName(sourcePath)} -> source.ts] Class "${item}" in modalityClasses is not a valid GlossNoteClass in GLOSS_NOTE_CLASSES.`,
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
      if (match?.[1]) {
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
 * Checks if a note class belongs to the reasoning words modality group.
 *
 * `modalityClasses` is the list the server resolved for this edition. It is
 * required: there is no browser-side fallback, because a wrong fallback marks
 * the wrong words and reports nothing.
 */
export function isModalityClass(
  noteClass: string | undefined,
  modalityClasses: readonly string[],
): boolean {
  if (!noteClass) return false;
  return modalityClasses.includes(noteClass);
}
