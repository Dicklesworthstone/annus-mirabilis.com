import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DEFAULT_MODALITY_CLASSES,
  GlossConventionsValidationError,
  isModalityClass,
  loadGlossConventions,
  parseModalityClassesFromContent,
} from "../../content/schemas/glossConventions.ts";

describe("glossModality: modality classes loading, fallback, and validation", () => {
  test("falls back to default [konjunktiv-i, konjunktiv-ii] with recorded warning when file is missing", () => {
    const nonExistentPath = path.resolve(
      process.cwd(),
      "docs/editorial/NON_EXISTENT_GLOSS_CONVENTIONS.md",
    );
    const result = loadGlossConventions(nonExistentPath);

    expect(result.modalityClasses).toEqual(DEFAULT_MODALITY_CLASSES);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("falling back to default modality classes");
  });

  test("fixture conventions file without modalityClasses falls back to konjunktiv-i and konjunktiv-ii with warning", () => {
    const emptyContent = "# Gloss Conventions\n\nNo modalityClasses block here.";
    const result = parseModalityClassesFromContent(emptyContent, "FIXTURE_CONVENTIONS.md");

    expect(result.modalityClasses).toBeNull();
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("FIXTURE_CONVENTIONS.md does not define modalityClasses");
  });

  test("fixture conventions file with valid modalityClasses loads them correctly", () => {
    const yamlContent = `
# Editorial Conventions
modalityClasses:
  - konjunktiv-i
  - konjunktiv-ii
  - hedge
  - necessity
  - condition
  - consequence
  - restriction
`;
    const result = parseModalityClassesFromContent(yamlContent, "GLOSS_CONVENTIONS.md");
    expect(result.modalityClasses).toEqual([
      "konjunktiv-i",
      "konjunktiv-ii",
      "hedge",
      "necessity",
      "condition",
      "consequence",
      "restriction",
    ]);
  });

  test("a class named in modalityClasses but absent from note-class table fails naming both files", () => {
    const invalidContent = `
modalityClasses:
  - konjunktiv-i
  - made-up-fake-class
`;
    expect(() => {
      parseModalityClassesFromContent(invalidContent, "GLOSS_CONVENTIONS.md");
    }).toThrow(
      /\[GLOSS_CONVENTIONS\.md -> source\.ts\] Class "made-up-fake-class" in modalityClasses is not a valid GlossNoteClass/,
    );
  });

  test("isModalityClass returns true for declared modality classes and false for non-modality classes", () => {
    const customClasses = ["konjunktiv-i", "konjunktiv-ii", "consequence"];
    expect(isModalityClass("konjunktiv-i", customClasses)).toBe(true);
    expect(isModalityClass("consequence", customClasses)).toBe(true);
    expect(isModalityClass("compound", customClasses)).toBe(false);
    expect(isModalityClass("separable-verb", customClasses)).toBe(false);
    expect(isModalityClass(undefined, customClasses)).toBe(false);
  });
});

describe("loadGlossConventions tells validation from IO structurally (am-jrjy)", () => {
  // The loader must RETHROW a validation failure and DOWNGRADE an IO failure to
  // a warning. It used to decide by testing whether the caught error's message
  // contained "is not a valid GlossNoteClass" - prose produced in
  // glossConventions.pure.ts and matched in glossConventions.ts. Rewording the
  // string in one module would have silently downgraded a validation failure in
  // the other, substituting the default modality classes for an invalid file,
  // and nothing in either module pointed at the other.

  const scratch = (): string => mkdtempSync(path.join(tmpdir(), "am-jrjy-gloss-"));

  test("a validation failure still rethrows, as a typed error carrying its code", () => {
    const dir = scratch();
    const file = path.join(dir, "GLOSS_CONVENTIONS.md");
    writeFileSync(file, "modalityClasses:\n  - konjunktiv-i\n  - made-up-fake-class\n");

    let caught: unknown;
    try {
      loadGlossConventions(file);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(GlossConventionsValidationError);
    expect((caught as GlossConventionsValidationError).code).toBe("invalid-modality-class");
  });

  test("an IO failure still downgrades to a warning and the default classes", () => {
    // A directory exists, so it passes the existsSync guard and readFileSync
    // throws EISDIR: a real IO failure, not a synthetic one.
    const dir = scratch();
    const asDirectory = path.join(dir, "GLOSS_CONVENTIONS.md");
    mkdirSync(asDirectory);

    const result = loadGlossConventions(asDirectory);
    expect(result.modalityClasses).toEqual(DEFAULT_MODALITY_CLASSES);
    expect(result.warnings.some((w) => w.includes("Error reading"))).toBe(true);
  });

  // The argument, not just the behaviour: the classification must not depend on
  // the wording. A validation error whose message no longer contains the old
  // sentence is still a validation error.
  test("rewording the message does not downgrade a validation failure", () => {
    const reworded = new GlossConventionsValidationError(
      "modalityClasses names a class the note-class table does not define",
    );
    expect(reworded.message.includes("is not a valid GlossNoteClass")).toBe(false);
    expect(reworded).toBeInstanceOf(GlossConventionsValidationError);
    expect(reworded.code).toBe("invalid-modality-class");
  });
});
