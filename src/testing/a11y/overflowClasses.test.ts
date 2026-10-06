/**
 * THE POPULATION OF SCROLLABLE REGIONS IS DERIVED FROM THE CSS, NOT FROM A LIST SOMEBODY REMEMBERS
 * (am-a14x, am-unaudited-scroll-regions-r4jx).
 *
 * `scrollableRegions.test.ts` is the one gate that catches a scrolling region a keyboard cannot reach, and
 * it decides what to check from AUDITED_SCROLL_CLASSES - a hand-maintained list. Measured 2026-10-06: the
 * stylesheets under src/ carry 62 overflow declarations naming 62 distinct classes; 20 are on that list, 6
 * are dialog containers excluded by kind, and 36 are on neither, so an overflowing region in any of those
 * 36 is invisible to it. The bead recorded 47/10/37 when it was filed; the list has since grown by hand to
 * 20 and the CSS has grown faster, which is the shape of the problem rather than evidence against it.
 *
 * THIS TEST DOES NOT DEMAND TAB STOPS. It asks a narrower question that can be answered from the
 * stylesheets alone: is every class that sets an overflow KNOWN to the audit, one way or another? Whether a
 * given region actually overflows at 320px, and whether it needs a tab stop or a recorded measurement
 * showing it does not, is browser work and belongs to the ratchet beside it. What this closes is the hole
 * where a new overflow rule is added and no gate ever hears about it.
 *
 * BOTH HALVES, and the second is the one that gets skipped: a class that sets an overflow and is unknown
 * is reported, AND a class that does NOT set an overflow is not demanded of anyone - which is the failure
 * the ratchet's own header warns about, "bulk-applying tabIndex to non-overflowing elements creates useless
 * tab stops".
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  blankComments,
  blankNonCode,
  classesInSelector,
  classlessOverflowRules,
  overflowClasses,
  overflowRulesIn,
  quotedNamesInExport,
  scanOverflowRules,
} from "./overflowClasses.ts";

const ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const RATCHET = "src/testing/a11y/scrollableRegions.test.ts";

/**
 * The two lists the ratchet keeps, read out of its source rather than imported.
 *
 * Importing it would execute its `describe` blocks inside this file's run, which doubles a 1300-line
 * suite and makes a failure there read as a failure here. The lists are plain string arrays, so parsing
 * them is exact; a rename of either export fails the non-vacuity floor below rather than silently
 * yielding an empty set.
 */
const ratchetSource = readFileSync(resolve(ROOT, RATCHET), "utf8");
const AUDITED = new Set(quotedNamesInExport(ratchetSource, "AUDITED_SCROLL_CLASSES"));
const DIALOGS = new Set(quotedNamesInExport(ratchetSource, "DIALOG_CONTAINER_SELECTORS"));

/**
 * THE RECORDED DEBT, measured 2026-10-06: classes whose CSS sets an overflow and which the scrollable-
 * regions ratchet neither audits nor excludes as a dialog container.
 *
 * These are real findings and not exemptions. Each one MAY be a region that overflows at some viewport with
 * no way for a keyboard to reach it, and nothing has measured it; it may equally be a region that never
 * overflows, in which case it belongs in the ratchet's RECORDED_NON_OVERFLOWING with its numbers. Telling
 * those two apart needs a browser at 320px and 1280px, which is the ratchet's own method and not this
 * file's.
 *
 * What this list does is stop the hole widening. THE LIST ONLY EVER COMES DOWN: a class triaged into
 * AUDITED_SCROLL_CLASSES or into RECORDED_NON_OVERFLOWING must be deleted from here, and a NEW overflow
 * class fails outright. Filed on am-a14x.
 */
const UNAUDITED_OVERFLOW_CLASSES: readonly string[] = [
  "camera-results",
  "capstone-math",
  "controlled-comparison",
  "data-panel-table-wrap",
  "encounter-table",
  "eq-step-formula",
  "equation-body",
  "equation-explanation-formula",
  "facsimile-canvas-container",
  "facsimile-stage",
  "genealogy-graph-wrapper",
  "inference-workbench",
  "inline-display",
  "inline-math",
  "kitchen-guide",
  "kitchen-lab",
  "latex-block-wrapper",
  "linear-formula-scroll",
  "low-speed-table",
  "mass-energy-investigation",
  "me-table",
  "missing-step-table",
  "notebook-replay",
  "replay-table",
  "scale-facts-table-wrap",
  "sentence-german-unadorned",
  "show-the-code",
  "source-equation",
  "sources-section",
  "sr-investigation-page",
  "sr07-components",
  "sr07-equation",
  "table-scroll-container",
  "table-wrapper",
  "trajectory-table-scroll",
  "video-observation-scroll",
];

const rules = scanOverflowRules(resolve(ROOT, "src"), ROOT);
const classes = overflowClasses(rules);
const unknown = classes.filter((name) => !AUDITED.has(name) && !DIALOGS.has(name));

describe("every class that sets an overflow is known to the scrollable-regions audit", () => {
  test("the populations are real, and printed beside the verdict", () => {
    // Four floors, each guarding a different way this could pass over nothing: a stylesheet root it cannot
    // read, a ratchet whose exports were renamed so both sets come back empty, and a class extractor that
    // finds nothing. An empty AUDITED would make every class look unknown; an empty `classes` would make
    // none look unknown, which is the quieter failure.
    expect(rules.length).toBeGreaterThan(40);
    expect(classes.length).toBeGreaterThan(40);
    expect(AUDITED.size).toBeGreaterThan(10);
    expect(DIALOGS.size).toBeGreaterThan(3);
    console.log(
      `[overflow classes] ${rules.length} overflow declarations naming ${classes.length} distinct classes; ` +
        `${classes.filter((c) => AUDITED.has(c)).length} audited, ` +
        `${classes.filter((c) => DIALOGS.has(c)).length} dialog containers, ${unknown.length} neither`,
    );
  });

  test("no class sets an overflow without the audit knowing about it, beyond the recorded debt", () => {
    expect(unknown).toEqual(
      [...UNAUDITED_OVERFLOW_CLASSES].sort((a, b) => a.localeCompare(b, "en")),
    );
  });

  test("THE OTHER HALF: every audited class is actually named by an overflow rule", () => {
    // The failure the ratchet's own header warns about, in the opposite direction. A class on the audited
    // list that no longer sets an overflow is a demand for a tab stop on a region that does not scroll, and
    // bulk tab stops on non-scrolling elements degrade keyboard navigation. Green today, which is why it is
    // worth adding now: it is a floor rather than a repair.
    const named = new Set(classes);
    const phantom = [...AUDITED].filter((name) => !named.has(name)).sort();
    expect(phantom).toEqual([]);
  });

  test("an overflow rule with no class in its selector is named, since no class scan can see it", () => {
    // am-unaudited-scroll-regions-r4jx's second criterion. When it was filed, globals.css carried
    // `div:has(> table.data-table) { overflow-x: auto }` - a container with no class of its own - and that
    // rule is gone, replaced by `.table-wrapper`. One classless rule remains and it is an attribute
    // selector on a dialog, excluded by kind rather than by class.
    const classless = classlessOverflowRules(rules);
    expect(classless.map((r) => r.selector)).toEqual(["[data-instrument-clarification-dialog]"]);
    expect(classless[0]?.file).toBe("src/equations/missingStep/missingStep.css");
  });

  test("the recorded debt has no duplicates and names only real classes", () => {
    expect(new Set(UNAUDITED_OVERFLOW_CLASSES).size).toBe(UNAUDITED_OVERFLOW_CLASSES.length);
    for (const name of UNAUDITED_OVERFLOW_CLASSES) expect(classes).toContain(name);
    expect(UNAUDITED_OVERFLOW_CLASSES.length).toBe(36);
  });
});

describe("the scanner reads CSS, not text that looks like CSS", () => {
  test("a class in a selector is found, with its property and value", () => {
    const found = overflowRulesIn(".wrap { overflow-x: auto; margin: 1rem }", "a.css");
    expect(found).toHaveLength(1);
    expect(found[0]?.classes).toEqual(["wrap"]);
    expect(found[0]?.property).toBe("overflow-x");
    expect(found[0]?.value).toBe("auto");
  });

  test("overflow: hidden, visible and clip are not scroll regions", () => {
    for (const value of ["hidden", "visible", "clip", "unset"])
      expect(overflowRulesIn(`.wrap { overflow: ${value} }`, "a.css")).toEqual([]);
  });

  test("THE MEASURED FALSE POSITIVES: a file name in a comment or a string is not a class", () => {
    // A first pass over whole rule preludes reported `css`, `ts`, `tsx`, `test`, `e2e` and `inline` as
    // overflow classes. They are the tails of file names inside comments and `content` strings. AGENTS.md
    // states the rule for exactly this: a gate that counts a construct must read code, not text.
    const css = [
      "/* see src/app/a.test.tsx and b.css */",
      '.wrap::before { content: "x.e2e.ts"; }',
      ".wrap { overflow: auto }",
    ].join("\n");
    const found = overflowRulesIn(css, "a.css");
    expect(found).toHaveLength(1);
    expect(overflowClasses(found)).toEqual(["wrap"]);
  });

  test("a commented-out overflow rule is not a rule", () => {
    expect(overflowRulesIn("/* .old { overflow: auto } */", "a.css")).toEqual([]);
  });

  test("THE CONTROL: blanking keeps length and lines, so a reported line number is real", () => {
    // Without this, a blanker that deleted its matches would shift every line below it and the file:line in
    // a finding would point at the wrong rule - and a blanker that removed everything would report a clean
    // stylesheet for ever.
    const css = "/* one\n   two */\n.wrap { overflow: auto }\n";
    const blanked = blankNonCode(css);
    expect(blanked.length).toBe(css.length);
    expect(blanked.split("\n").length).toBe(css.split("\n").length);
    expect(blanked).toContain(".wrap { overflow: auto }");
    const found = overflowRulesIn(css, "a.css");
    expect(found[0]?.line).toBe(3);
  });

  test("A NAME IN A COMMENT IS NOT A NAME, which is how this file found its own bug", () => {
    // Reading the ratchet's class lists without blanking comments first reported `0` and `region` as
    // audited class names: the comments beside those entries quote `tabIndex={0}` and `role="region"`. The
    // test above went red on two names that are not classes, which is the same read-code-not-text rule the
    // CSS scanner follows, applied to the parser that reads the other gate.
    const source = [
      "export const LIST = [",
      '  // repaired with tabIndex={0} and role="region"',
      '  "real-class",',
      '  /* another mentions aria-label="x" */',
      '  "second-class",',
      "];",
    ].join("\n");
    expect(quotedNamesInExport(source, "LIST")).toEqual(["real-class", "second-class"]);
  });

  test("blankComments handles a line comment without swallowing the code before it", () => {
    const blanked = blankComments('const a = "keep"; // drop "this"\nconst b = "keep2";');
    expect(blanked).toContain('"keep"');
    expect(blanked).toContain('"keep2"');
    expect(blanked).not.toContain('"this"');
  });

  test("an export that does not exist yields nothing rather than throwing", () => {
    // A renamed export must produce an empty set, which the non-vacuity floors above then catch. Silently
    // throwing here would read as a broken test rather than a renamed list.
    expect(quotedNamesInExport("export const OTHER = [];", "MISSING")).toEqual([]);
  });

  test("a selector naming several classes contributes all of them, de-duplicated", () => {
    expect(classesInSelector(".a .b > .c:not(.a)").sort()).toEqual(["a", "b", "c"]);
  });

  test("a decimal inside a function is not a class", () => {
    expect(classesInSelector(".wrap { transform: translate(1.5px) }")).toEqual(["wrap"]);
  });

  test("PLANTED: a new stylesheet with an unknown overflow class is reported by the predicate", () => {
    // Driven through the real predicate with synthetic CSS rather than by writing a file into src/, so the
    // plant cannot be swept into a peer's commit while it is red.
    const planted = overflowRulesIn(".zz-planted-scroll { overflow-y: scroll }", "zz.css");
    const names = overflowClasses(planted);
    expect(names).toEqual(["zz-planted-scroll"]);
    expect(names.filter((n) => !AUDITED.has(n) && !DIALOGS.has(n))).toEqual(["zz-planted-scroll"]);
    // And the control in the same arm: an audited class is NOT reported, so the predicate is not flagging
    // everything handed to it.
    const known = overflowClasses(overflowRulesIn(".table-scroll { overflow-x: auto }", "zz.css"));
    expect(known.filter((n) => !AUDITED.has(n) && !DIALOGS.has(n))).toEqual([]);
  });
});
