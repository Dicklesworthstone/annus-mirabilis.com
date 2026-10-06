/**
 * WHOSE VOICE IS BEING LINTED (am-dbpk class).
 *
 * The editorial voice rules are about the SITE's prose. AGENTS.md is equally emphatic that a
 * translation must preserve modality - "A heuristic stays a heuristic, an approximation stays
 * approximate" - so a rule written for the house voice cannot be applied to a rendering of Einstein's
 * German without demanding a mistranslation.
 *
 * The runner knew that for `kind: "translation-unit"` and for nothing else. A GLOSS UNIT declares no
 * `kind` at all; it declares `lang: "en"` and `sourceLang: "de"`. So all 542 of them were linted as
 * the site's own prose, and `overclaim` fired at its default severity of ERROR on six strings whose
 * matched word is "proved" - every one of them Einstein's. s4-p8-s1 glosses "bewiesene", the past
 * participle of beweisen, with the note "'the result proved for a polygonal line', the phrase before
 * its noun".
 *
 * A gate that can only be made green by corrupting the content it guards is wrong about its scope, and
 * voice-rules.yaml already carries `translationSeverity` for precisely this distinction.
 *
 * The predicate is keyed on the record's own declaration rather than on a directory, so renaming a
 * path cannot silently withdraw the exemption, and it is a CROSS-language test so a record cannot
 * claim it by declaring the same language twice.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { recordDeclaresTranslation } from "./lint-voice.ts";

describe("a record that says it was translated is treated as a translation", () => {
  it("a gloss unit's own header is enough: lang en, sourceLang de", () => {
    expect(recordDeclaresTranslation({ lang: "en", sourceLang: "de" })).toBe(true);
  });

  it("PLANTED: the same language twice is not a translation", () => {
    // The direction that matters. Without the inequality a record could take the exemption by
    // declaring `sourceLang: "en"` beside `lang: "en"`, which asserts nothing and would exempt the
    // site's own prose from the house voice.
    expect(recordDeclaresTranslation({ lang: "en", sourceLang: "en" })).toBe(false);
  });

  it("PLANTED: a record declaring neither, or only one, is ordinary site prose", () => {
    expect(recordDeclaresTranslation({})).toBe(false);
    expect(recordDeclaresTranslation({ lang: "en" })).toBe(false);
    expect(recordDeclaresTranslation({ sourceLang: "de" })).toBe(false);
  });

  it("PLANTED: a non-string declaration does not qualify", () => {
    // A YAML value that parsed to something else must not be read as a language name.
    expect(recordDeclaresTranslation({ lang: "en", sourceLang: 42 })).toBe(false);
    expect(recordDeclaresTranslation({ lang: null, sourceLang: "de" })).toBe(false);
  });

  it("the corpus this was measured on still has the shape the fix assumes", () => {
    // Non-vacuity, against the real file rather than a fixture: if gloss units stop declaring
    // sourceLang, this predicate silently stops exempting them and the ERRORS come back.
    const t = readFileSync(
      fileURLToPath(
        new URL("../content/gloss-units/special-relativity/s4-p8-s1.yaml", import.meta.url),
      ),
      "utf8",
    );
    expect(t).toContain('lang: "en"');
    expect(t).toContain('sourceLang: "de"');
    // And the specific gloss that was failing, so this test names the content it protects.
    expect(t).toContain('german: "bewiesene"');
    expect(t).toContain('english: "proved"');
  });
});
