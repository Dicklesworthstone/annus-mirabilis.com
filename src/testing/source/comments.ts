/**
 * BLANKING COMMENTS AND STRINGS, ONCE.
 *
 * AGENTS.md states the rule this serves in its own section: "A gate that forbids a construct must read code,
 * not text", because "the densest prose about a forbidden construct is the documentation explaining why it is
 * forbidden. A gate written well enough to explain itself is a gate positioned to fail on its own
 * explanation, so the better the comment, the likelier the misfire."
 *
 * Three gates learned that separately and two wrote their own blanker:
 *
 *   scripts/check-renamed-refusal-codes.ts  its collector read a docblock quoting a refusal code as a site
 *                                          that throws one, so an invented code entered the real population
 *   src/testing/a11y/overflowClasses.ts     a selector scan reported `css`, `ts`, `tsx`, `test` and `e2e` as
 *                                          overflow classes - the tails of file names in comments and
 *                                          `content` strings - and a parser reading another gate's class list
 *                                          reported `0` and `region`, from comments quoting `tabIndex={0}`
 *                                          and `role="region"`
 *
 * A third copy was about to be written for a refusal-flattening ratchet whose own docblocks quote the
 * expression they forbid. Hence this module: one implementation, one test, and the duplication removed rather
 * than extended.
 *
 * BODIES ARE BLANKED, NOT DELETED, keeping length and newlines, so byte offsets and line numbers stay valid
 * and a finding can still say where it is. A blanker that deleted its matches would shift every line below it
 * and report a real defect at the wrong place.
 */

/**
 * A SINGLE PASS THAT KNOWS WHERE IT IS, rather than two regexes.
 *
 * Both earlier blankers were a block-comment replace followed by a line-comment replace, the second matching
 * a double slash and everything to the end of the line. This module's own test found what that costs: in
 *
 *     const u = "https://example.com/a"; const g = 1;
 *
 * the double slash inside the URL is read as the start of a line comment, so everything after "https:" is
 * blanked INCLUDING the code. The failure direction is a silent MISS - a gate stops seeing a construct
 * because a URL appeared earlier on the line - which is the worse of the two directions and the one this
 * module exists to prevent.
 *
 * (The regexes are described rather than quoted because quoting one here closed this comment: the pattern for
 * a block-comment terminator contains that terminator. The first draft of this docblock did exactly that and
 * the file stopped parsing.)
 *
 * So the scan walks the source once, tracking whether it is in code, a single- or double-quoted string, a
 * template literal, a line comment or a block comment, and honouring backslash escapes.
 *
 * WHAT IT DELIBERATELY DOES NOT HANDLE, said rather than discovered later: a REGULAR-EXPRESSION LITERAL. A
 * slash begins a regex or a division depending on what precedes it, and deciding that needs a tokeniser. A
 * regex containing a double slash would therefore still mislead this scanner, exactly as it misleads the two
 * implementations it replaces. Nothing is made worse, and the common case - a URL in a string - is fixed.
 * A template literal's interpolation is treated as part of the literal, so code inside one is blanked; that
 * is the safe direction for a gate, since it under-counts constructs rather than mis-locating them, and it is
 * the behaviour both predecessors had.
 */

type Mode = "code" | "line-comment" | "block-comment" | "single" | "double" | "template";

function scan(source: string, blankStrings: boolean): string {
  const out: string[] = [];
  let mode: Mode = "code";
  let i = 0;
  const keep = (ch: string) => out.push(ch);
  const blank = (ch: string) => out.push(ch === "\n" ? "\n" : " ");
  while (i < source.length) {
    const ch = source[i] ?? "";
    const next = source[i + 1] ?? "";
    switch (mode) {
      case "code":
        if (ch === "/" && next === "*") {
          mode = "block-comment";
          blank(ch);
          blank(next);
          i += 2;
          continue;
        }
        if (ch === "/" && next === "/") {
          mode = "line-comment";
          blank(ch);
          blank(next);
          i += 2;
          continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") {
          mode = ch === '"' ? "double" : ch === "'" ? "single" : "template";
          // The quote itself is kept even when the body is blanked, so a scan can still see that a string was
          // there and the length is unchanged either way.
          keep(ch);
          i += 1;
          continue;
        }
        keep(ch);
        i += 1;
        continue;
      case "line-comment":
        if (ch === "\n") {
          mode = "code";
          keep(ch);
          i += 1;
          continue;
        }
        blank(ch);
        i += 1;
        continue;
      case "block-comment":
        if (ch === "*" && next === "/") {
          mode = "code";
          blank(ch);
          blank(next);
          i += 2;
          continue;
        }
        blank(ch);
        i += 1;
        continue;
      default: {
        const closer = mode === "double" ? '"' : mode === "single" ? "'" : "`";
        /**
         * A NEWLINE CLOSES A QUOTED STRING, AND THIS IS WHAT MAKES THE SCANNER USABLE.
         *
         * JavaScript forbids a raw newline inside a single- or double-quoted literal, so reaching one means
         * the opening quote was not a string opener at all. In practice it was a quote inside a REGULAR
         * EXPRESSION - `/class="([^"]+)"/` has an unbalanced one in its character class - which is the case
         * this scanner cannot decide.
         *
         * Without this line the desynchronisation runs to the end of the file. Measured: pointing
         * scrollableRegions.test.ts at the scanner left every comment after its first such regex unblanked,
         * which regressed the overflow-class gate and brought back the `0` and `region` false positives that
         * gate exists to refuse. So the failure was not hypothetical and it was worse than the regex pair it
         * replaced.
         *
         * A template literal MAY contain a newline and so is not closed here.
         */
        if (ch === "\n" && mode !== "template") {
          mode = "code";
          keep(ch);
          i += 1;
          continue;
        }
        if (ch === "\\") {
          // An escape and the character it escapes travel together, so a `\"` never ends the literal.
          if (blankStrings) {
            blank(ch);
            blank(next);
          } else {
            keep(ch);
            keep(next);
          }
          i += 2;
          continue;
        }
        if (ch === closer) {
          mode = "code";
          keep(ch);
          i += 1;
          continue;
        }
        if (blankStrings) blank(ch);
        else keep(ch);
        i += 1;
        continue;
      }
    }
  }
  return out.join("");
}

/** Blank every comment body, keeping length and newlines. Serves CSS and TypeScript alike. */
export function blankComments(source: string): string {
  return scan(source, false);
}

/**
 * Blank comment bodies AND the contents of quoted strings, keeping the quotes themselves.
 *
 * Only for a scan whose subject cannot legitimately live in a string. A refusal code DOES live in a string
 * literal, so a gate counting those must use `blankComments` alone; a CSS class selector does not, so a scan
 * for one may blank both.
 */
export function blankCommentsAndStrings(source: string): string {
  return scan(source, true);
}
