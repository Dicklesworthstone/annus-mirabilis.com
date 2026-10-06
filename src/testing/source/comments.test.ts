/**
 * THE BLANKER, IN BOTH DIRECTIONS.
 *
 * AGENTS.md names the four cases worth asserting for exactly this helper: "a construct inside a comment (must
 * not match), the same construct in code (must match), a trailing `//` that must not swallow the code before
 * it, and a block comment that must not swallow the code after it." All four are here, plus the length and
 * line-count invariants that let a finding report a true line number.
 *
 * The negative control matters as much as the positives: a blanker that removed everything would report a
 * clean surface for ever, which is the failure mode this helper is supposed to prevent in its callers.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { blankComments, blankCommentsAndStrings } from "./comments.ts";

const ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

describe("blankComments", () => {
  test("a construct inside a block comment does not survive", () => {
    expect(blankComments('/* throw new Error("off-replay-grid") */')).not.toContain(
      "off-replay-grid",
    );
  });

  test("the same construct in code DOES survive, which is the control", () => {
    const code = 'throw new Error("off-replay-grid");';
    expect(blankComments(code)).toBe(code);
  });

  test("a trailing line comment does not swallow the code before it", () => {
    const blanked = blankComments('const a = "keep"; // drop "this"');
    expect(blanked).toContain('const a = "keep";');
    expect(blanked).not.toContain('"this"');
  });

  test("a block comment does not swallow the code after it", () => {
    const blanked = blankComments('/* note */ const a = "keep";');
    expect(blanked).toContain('const a = "keep";');
    expect(blanked).not.toContain("note");
  });

  test("length and line count are preserved, so a reported line number is real", () => {
    const source = "const a = 1; // one\n/*\n two\n*/\nconst b = 2;\n";
    const blanked = blankComments(source);
    expect(blanked.length).toBe(source.length);
    expect(blanked.split("\n").length).toBe(source.split("\n").length);
    // The line of `const b` is unchanged, which is the property that makes offsets usable.
    expect(blanked.split("\n")[4]).toBe("const b = 2;");
  });

  test("a string containing comment markers is NOT treated as a comment", () => {
    // The direction that would silently destroy real code: a URL or a glob in a string.
    const code = 'const u = "https://example.com/a"; const g = "/* not a comment */";';
    expect(blankComments(code)).toContain("https://example.com/a");
  });

  test("it blanks nothing when there is nothing to blank", () => {
    const code = "export const x = 1;\n";
    expect(blankComments(code)).toBe(code);
  });
});

describe("blankCommentsAndStrings", () => {
  test("a quoted file name does not contribute its extension as a token", () => {
    // The measured false positives in overflowClasses.ts: `css`, `ts`, `tsx`, `test`, `e2e`.
    const css = '.wrap::before { content: "a.test.tsx"; }';
    const blanked = blankCommentsAndStrings(css);
    expect(blanked).toContain(".wrap::before");
    expect(blanked).not.toContain("test.tsx");
  });

  test("it keeps the code around a blanked string, with the length unchanged", () => {
    const css = '.a { content: "x" } .b { overflow: auto }';
    const blanked = blankCommentsAndStrings(css);
    expect(blanked.length).toBe(css.length);
    expect(blanked).toContain(".a {");
    expect(blanked).toContain("overflow: auto");
  });

  test("THE NEGATIVE CONTROL: it does not blank everything", () => {
    // A blanker that removed all its input would make every caller report a clean surface for ever.
    const source = 'const a = 1; /* c */ const b = "s"; // d\n';
    const blanked = blankCommentsAndStrings(source);
    expect(blanked).toContain("const a = 1;");
    expect(blanked).toContain("const b =");
    expect(blanked.trim().length).toBeGreaterThan(20);
  });
});

describe("the URL case, which is why this is a scanner and not two regexes", () => {
  test("a double slash inside a string does not start a line comment", () => {
    // The defect in one assertion. With the regex blanker this returned
    // `const u = "https:` followed by blanks, so the code after the URL vanished and a gate scanning for it
    // would have found nothing - a silent miss, which is the worse direction.
    const code = 'const u = "https://example.com/a"; const g = 1;';
    const blanked = blankComments(code);
    expect(blanked).toBe(code);
    expect(blanked).toContain("const g = 1;");
  });

  test("a block-comment opener inside a string does not start a comment", () => {
    const code = 'const g = "/* not a comment */"; const h = 2;';
    expect(blankComments(code)).toBe(code);
  });

  test("an escaped quote does not end the literal", () => {
    const code = 'const a = "he said \\"no\\""; const b = 3;';
    expect(blankComments(code)).toBe(code);
    // And when strings are blanked, the escape goes with its character and the closing quote still closes.
    const blanked = blankCommentsAndStrings(code);
    expect(blanked).toContain("const b = 3;");
    expect(blanked).not.toContain("he said");
    expect(blanked.length).toBe(code.length);
  });

  test("a template literal is a string, and a comment inside one is not a comment", () => {
    const code = "const t = `a // b`; const c = 4;";
    expect(blankComments(code)).toBe(code);
  });

  test("a comment after a string on the same line IS still blanked", () => {
    // The control: fixing the URL case must not stop comments being blanked at all.
    const code = 'const u = "https://x"; // drop me\n';
    const blanked = blankComments(code);
    expect(blanked).toContain('const u = "https://x";');
    expect(blanked).not.toContain("drop me");
    expect(blanked.length).toBe(code.length);
  });

  test("a string inside a comment does not reopen code", () => {
    const code = '/* a "quote" here */ const x = 1;';
    const blanked = blankComments(code);
    expect(blanked).toContain("const x = 1;");
    expect(blanked).not.toContain("quote");
  });
});

describe("a newline closes a quoted string, which is what makes the scanner usable", () => {
  test("an unbalanced quote inside a regex does not swallow the rest of the file", () => {
    // THE CASE THAT MADE THE SCANNER WORSE THAN THE REGEX PAIR BEFORE THIS RULE. A character class like
    // [^"] holds one quote, so a scanner that treated it as a string opener stayed in string mode to the end
    // of the file and blanked no further comment. Measured on scrollableRegions.test.ts: every comment after
    // its first such regex went unblanked, which brought back two false positives the overflow gate exists to
    // refuse.
    const code = ['const re = /class="([^"]+)"/;', "// drop me", "const after = 1;"].join("\n");
    const blanked = blankComments(code);
    expect(blanked).not.toContain("drop me");
    expect(blanked).toContain("const after = 1;");
    expect(blanked.length).toBe(code.length);
  });

  test("a single unbalanced quote on one line does not reach the next", () => {
    const code = "const a = 'unclosed\nconst b = 2;\n";
    const blanked = blankComments(code);
    expect(blanked).toContain("const b = 2;");
  });

  test("a template literal MAY span lines and is not closed at the newline", () => {
    // The exception, and the reason it is not a blanket rule: a template literal legitimately contains a
    // newline, so closing it at one would expose its contents as code.
    const code = "const t = `line one\n// not a comment\nline two`;\nconst after = 3;\n";
    expect(blankComments(code)).toBe(code);
    const blanked = blankCommentsAndStrings(code);
    expect(blanked).toContain("const after = 3;");
    expect(blanked).not.toContain("line one");
  });

  test("the real gate sources are blanked, which is the regression this rule prevents", () => {
    // Not a fixture: the two files whose comments quote the very constructs their gates forbid.
    const real = [
      "src/testing/a11y/scrollableRegions.test.ts",
      "scripts/check-renamed-refusal-codes.ts",
    ];
    for (const rel of real) {
      const source = readFileSync(resolve(ROOT, rel), "utf8");
      const blanked = blankComments(source);
      expect(blanked.length, rel).toBe(source.length);
      // Every `//` comment body is blank: no line retains text after its first unquoted double slash.
      const leaked: string[] = [];
      blanked.split("\n").forEach((line, i) => {
        const at = line.indexOf("//");
        if (at !== -1 && line.slice(at + 2).trim().length > 0) leaked.push(`${rel}:${i + 1}`);
      });
      expect(leaked, `comment bodies survived blanking in ${rel}`).toEqual([]);
    }
  });
});
