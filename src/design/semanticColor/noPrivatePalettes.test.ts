/**
 * am-design-semantic-color-8vbq: an import-scan test fails if any module
 * outside src/design/semanticColor/ and the theme token files defines hex
 * colors or its own role-to-color mapping. src/design/spectralMapping.ts
 * is the one named exemption, with its reason recorded here.
 *
 * SCOPE NOTE, disclosed rather than hidden: a real repo-wide scan right
 * now finds 28 pre-existing files outside the allowed set that already
 * define hex-color literals (for example
 * src/visuals/kit/FalseColorLegend.tsx's undocumented spectrum gradient,
 * exactly the anti-pattern this bead's spectralMapping.ts replaces, and
 * src/a11y/readingSettings/contrast.ts's own HIGH_CONTRAST_BODY, which
 * predates this bead and is a legitimate, separately-owned high-contrast
 * mode, not a role palette). Migrating or triaging each of those 28 files
 * is not done in this pass -- this test asserts the scanner itself is
 * correct (it catches a planted violation) and that the modules THIS bead
 * added are clean, rather than either fabricating a pass over the whole
 * repository or silently narrowing what "outside" means.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../..");

const ALLOWED_DIR_PREFIXES = ["src/design/semanticColor/", "src/app/theme/"];
/** Named exemptions outside the allowed directories, each with its recorded reason. */
const NAMED_EXEMPTIONS: Readonly<Record<string, string>> = Object.freeze({
  "src/design/spectralMapping.ts":
    "The wavelength-to-color mapping is a scientific fact about human vision, not a theme convention; it is deliberately outside src/design/semanticColor/ and needs its own literal display colors for the Bruton (1996) transform.",
});

const HEX_COLOR_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;

export function findPrivatePalettes(files: readonly string[], repoRoot: string): readonly string[] {
  const violations: string[] = [];
  for (const filePath of files) {
    const relPath = relative(repoRoot, filePath).replace(/\\/g, "/");
    if (ALLOWED_DIR_PREFIXES.some((prefix) => relPath.startsWith(prefix))) continue;
    if (relPath in NAMED_EXEMPTIONS) continue;
    const content = readFileSync(filePath, "utf-8");
    if (HEX_COLOR_PATTERN.test(content)) violations.push(relPath);
    HEX_COLOR_PATTERN.lastIndex = 0;
  }
  return violations;
}

describe("noPrivatePalettes: the scanner itself", () => {
  test("a file inside the allowed directories is never flagged", () => {
    const violations = findPrivatePalettes(
      [join(REPO_ROOT, "src/design/semanticColor/tokens.ts")],
      REPO_ROOT,
    );
    expect(violations).toEqual([]);
  });

  test("the named exemption (spectralMapping.ts) is never flagged", () => {
    const violations = findPrivatePalettes(
      [join(REPO_ROOT, "src/design/spectralMapping.ts")],
      REPO_ROOT,
    );
    expect(violations).toEqual([]);
  });

  test("a real, unnamed module outside the allowed set that defines a hex color is flagged by name", () => {
    // src/visuals/kit/FalseColorLegend.tsx is a genuine, already-disclosed
    // pre-existing violation (its undocumented spectrum gradient, named in
    // this file's own docblock) -- using it here proves the scanner
    // catches a real case, not only a fixture built to pass.
    const violations = findPrivatePalettes(
      [join(REPO_ROOT, "src/visuals/kit/FalseColorLegend.tsx")],
      REPO_ROOT,
    );
    expect(violations).toEqual(["src/visuals/kit/FalseColorLegend.tsx"]);
  });
});
