import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_MODALITY_CLASSES,
  getModalityClasses,
  isModalityClass,
  loadGlossConventions,
  parseModalityClassesFromContent,
} from "../../content/schemas/glossConventions.ts";

describe("glossModality: modality classes loading, fallback, and validation", () => {
  test("falls back to default [konjunktiv-i, konjunktiv-ii] with recorded warning when file is missing", () => {
    const nonExistentPath = path.resolve(process.cwd(), "docs/editorial/NON_EXISTENT_GLOSS_CONVENTIONS.md");
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
    }).toThrow(/\[GLOSS_CONVENTIONS\.md -> source\.ts\] Class "made-up-fake-class" in modalityClasses is not a valid GlossNoteClass/);
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
