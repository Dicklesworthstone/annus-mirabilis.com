/**
 * THE REFUSAL SITE SCANNER READS CODE, NOT PROSE ABOUT CODE.
 *
 * `scanRefusalThrowSites` matches line by line, so until 2026-10-05 a COMMENT describing a refusal
 * was counted as a refusal site. AGENTS.md states both the rule and the direction of the damage: a
 * gate that forbids or counts a construct must read code rather than text, and the densest prose
 * about a construct is the documentation explaining it, so a gate good enough to explain itself is
 * positioned to miscount on its own explanation.
 *
 * That is what happened, three times, and twice inside this very module:
 *
 *   src/equations/alternateForms.ts:8              alternate-is-rename
 *   src/content/foundations/registry.ts:168        unregistered-record
 *   src/testing/refusals/refusalScanner.ts:298     inventory-complete
 *
 * Measured by running the previous scanner and the current one over the same population (src/ and
 * scripts/, includeTestingDirs, the census's own roots): 2460 sites before, 2457 after, exactly
 * those three removed and NOTHING added. A fourth was created and then removed during this work by
 * a docblock that quoted an example verbatim, which is how the defect was noticed at all.
 *
 * A phantom site is fail-open for the census twice over: it inflates the denominator, and it is then
 * reported tested or untested on no evidence either way. One of the three was being carried as debt
 * in untestedRefusalsBaseline.json, so removing it tightened that baseline from 1 to 0.
 *
 * AGENTS.md also says a stripper must be proved in BOTH directions, because one that removed
 * everything would report a clean surface forever, and it names the four cases. All four are below,
 * against the real scanner rather than only the helper, because the helper being right is not the
 * claim -- the claim is that the scanner's verdict changes.
 */

import { describe, expect, it } from "bun:test";
import { blankCommentText, scanRefusalThrowSites } from "./refusalScanner.ts";

/** The codes a scan reports for a source, with their lines. */
const scan = (source: string) =>
  scanRefusalThrowSites(source, "probe.ts").map((s) => `${s.line}:${s.code}`);

describe("blankCommentText, proved in both directions", () => {
  it("blanks a comment body while keeping length and every newline", () => {
    const source = "const a = 1;\n/* a\n   b */\nconst c = 2; // tail\n";
    const blanked = blankCommentText(source, "probe.ts");
    // Length and newline positions are what every reported line number depends on.
    expect(blanked.length).toBe(source.length);
    expect(blanked.split("\n").length).toBe(source.split("\n").length);
    expect(blanked).toContain("const a = 1;");
    expect(blanked).toContain("const c = 2;");
    expect(blanked).not.toContain("tail");
    expect(blanked).not.toContain("b */");
  });

  it("does NOT treat a comment opener inside a string as a comment", () => {
    // The failure that makes a stripper dangerous: blanking real code. A URL is the everyday case.
    const source = 'const url = "https://example.test/a";\nconst keep = url.length;\n';
    const blanked = blankCommentText(source, "probe.ts");
    expect(blanked).toBe(source);
  });

  it("is not a stripper that removes everything, which would read clean forever", () => {
    const source = "const x = 1;\nconst y = 2;\n";
    expect(blankCommentText(source, "probe.ts")).toBe(source);
  });
});

describe("the four cases AGENTS.md names, against the scanner's own verdict", () => {
  const THROWN = 'throw new ProbeError("alpha-refused");';

  it("1. the construct INSIDE a comment does not match", () => {
    expect(scan(`// ${THROWN}\nconst x = 1;\n`)).toEqual([]);
    expect(scan(`/*\n ${THROWN}\n*/\nconst x = 1;\n`)).toEqual([]);
  });

  it("2. the same construct IN CODE does match, so the rule above is not blanket silence", () => {
    // The positive control. Without it, case 1 passing would say nothing: a scanner that found
    // nothing anywhere would pass case 1 perfectly.
    expect(scan(`${THROWN}\n`)).toEqual(["1:alpha-refused"]);
  });

  it("3. a trailing comment does not swallow the code BEFORE it on the same line", () => {
    expect(scan(`${THROWN} // explained here\n`)).toEqual(["1:alpha-refused"]);
  });

  it("4. a block comment does not swallow the code AFTER it", () => {
    // Both on one line and spanning lines, since the span is where a naive blank loses newlines
    // and merges the code that follows into the comment.
    expect(scan(`/* note */ ${THROWN}\n`)).toEqual(["1:alpha-refused"]);
    expect(scan(`/* note\n   continued */\n${THROWN}\n`)).toEqual(["3:alpha-refused"]);
  });

  it("reports the line the construct is really on, after blanking above it", () => {
    // The reason blanking preserves newlines rather than deleting comments. A shifted line number
    // is a stale citation, and the citation audit in this module reads these numbers.
    const source = `/* one\n   two\n   three */\nconst a = 1;\n${THROWN}\n`;
    expect(scan(source)).toEqual(["5:alpha-refused"]);
  });

  it("a comment naming a code beside a DIFFERENT real site credits only the real one", () => {
    // The shape that cost three phantom sites: prose about one code sitting next to a throw of
    // another. The comment's code must not appear at all.
    const source = `// the "beta-refused" path cannot be driven here\n${THROWN}\n`;
    expect(scan(source)).toEqual(["2:alpha-refused"]);
  });
});
