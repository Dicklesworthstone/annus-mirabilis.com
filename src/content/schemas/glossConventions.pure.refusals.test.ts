/**
 * Refusal coverage for `invalid-modality-class` (am-muyh, am-16nj).
 *
 * The behaviour is already asserted, in `src/reader/faces/glossModality.test.ts`, which catches the
 * error and checks its code twice. What was missing is the SITE's credit, and the reason is
 * structural rather than an oversight: the refusal is thrown in `glossConventions.pure.ts` and that
 * test reaches it through the re-exporting barrel `glossConventions.ts`. The scanner keys a test
 * block's credit by the source file, and scopes an explicit site citation to the files the test
 * actually imports, deliberately -- its own comment explains that matching a citation by basename
 * alone would let `(session.ts:42)` credit line 42 of all 37 files with that name. So a block that
 * imports the barrel can never credit a site in the pure half, however well it tests it.
 *
 * The same barrel-versus-defining-module split cost a separate false reading today, in the kernel
 * pins, where 14 declared functions looked unpinned because the manifests name the barrel.
 *
 * This file therefore imports the pure module DIRECTLY, which is also the honest thing to test: the
 * pure half exists precisely so a component can reach it without reaching `node:fs`, so driving it
 * without the loader is the shape its own docblock asks for. It is not a duplicate of the other
 * test, which drives the same rule through the file loader.
 */
import { describe, expect, test } from "bun:test";
import {
  GlossConventionsValidationError,
  parseModalityClassesFromContent,
} from "./glossConventions.pure.ts";
// The table itself lives in source.pure.ts; glossConventions.pure.ts imports it and does not
// re-export it, so this is where it has to come from.
import { GLOSS_NOTE_CLASSES } from "./source.pure.ts";

const document = (classes: readonly string[]): string =>
  `# Conventions\n\nmodalityClasses:\n${classes.map((c) => `  - ${c}`).join("\n")}\n`;

describe("invalid-modality-class (glossConventions.pure.ts:85): a class must be in the note-class table", () => {
  test("the accept half: declared classes parse, so the refusals below are about the predicate", () => {
    // Read from GLOSS_NOTE_CLASSES rather than hard-coded, so this cannot drift from the table it
    // is asserting against: a literal pair would keep passing after the table was renamed.
    const admitted = GLOSS_NOTE_CLASSES.slice(0, 2);
    expect(admitted.length).toBe(2);
    const parsed = parseModalityClassesFromContent(document(admitted));
    expect(parsed.modalityClasses).toEqual([...admitted]);
    expect(parsed.warnings).toEqual([]);
  });

  test("a class absent from the table is refused, with the code on the field", () => {
    expect(() => parseModalityClassesFromContent(document(["not-a-gloss-note-class"]))).toThrow(
      GlossConventionsValidationError,
    );
    try {
      parseModalityClassesFromContent(document(["not-a-gloss-note-class"]), "FIXTURE.md");
      throw new Error("parseModalityClassesFromContent must not return for an invalid class");
    } catch (error) {
      expect(error).toBeInstanceOf(GlossConventionsValidationError);
      expect((error as GlossConventionsValidationError).code).toBe("invalid-modality-class");
      // The message names the offending class and both files, so an author is not left searching.
      expect((error as Error).message).toContain("not-a-gloss-note-class");
      expect((error as Error).message).toContain("FIXTURE.md");
      expect((error as Error).message).toContain("source.ts");
    }
  });

  test("one bad class among admitted ones still refuses, so the loop does not stop at the first pass", () => {
    const admitted = GLOSS_NOTE_CLASSES[0] as string;
    expect(() =>
      parseModalityClassesFromContent(document([admitted, "not-a-gloss-note-class"])),
    ).toThrow(GlossConventionsValidationError);
    // And the order does not matter, so it is the membership test failing rather than a position.
    expect(() =>
      parseModalityClassesFromContent(document(["not-a-gloss-note-class", admitted])),
    ).toThrow(GlossConventionsValidationError);
  });

  test("a document with no modalityClasses block is not a refusal, which keeps the refusal specific", () => {
    // Absence is handled elsewhere as a warning and a default, so refusing it here would make the
    // code mean two different things.
    const parsed = parseModalityClassesFromContent("# Conventions\n\nNothing declared here.\n");
    expect(parsed.modalityClasses).toBeNull();
  });
});
