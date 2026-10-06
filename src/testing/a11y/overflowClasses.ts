/**
 * WHICH CLASSES ACTUALLY SET AN OVERFLOW, read from the stylesheets (am-a14x, am-unaudited-scroll-regions-r4jx).
 *
 * The scrollable-regions ratchet decides what to check from AUDITED_SCROLL_CLASSES, a list somebody has
 * to remember to extend. Measured 2026-10-06: 108 stylesheets under src/ carry 64 overflow declarations
 * naming 72 distinct classes, and 20 of them are on that list. The other 52 are invisible to the one gate
 * that exists to catch an unreachable scrolling region, and a class is only added to the list after
 * someone notices - which is the opposite of how a population should be chosen. The bead recorded 47/10/37
 * when it was filed; the list has since grown by hand to 20 and the CSS has grown faster.
 *
 * `src/app/theme/colourChannels.ts` already derives its population from the stylesheets for the contrast
 * sweep, and is the precedent this follows, including its comment handling.
 *
 * THIS MODULE READS CSS, NOT TEXT THAT LOOKS LIKE CSS, and the difference was measured rather than
 * assumed. A first pass matched `\.([A-Za-z_-][\w-]*)` over whole rule preludes and reported `css`, `ts`,
 * `tsx`, `test`, `e2e` and `inline` as overflow classes: those are the tails of file names inside comments
 * and strings. AGENTS.md states the rule for exactly this - a gate that forbids (or counts) a construct
 * must read code, not text - so comment bodies are blanked and string literals are blanked before any
 * class is extracted, both keeping their length so line numbers stay true.
 */

import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { findProjectCssFiles } from "../../app/theme/colourChannels.ts";
import { blankComments, blankCommentsAndStrings } from "../source/comments.ts";

const RULE = /([^{}]*)\{([^{}]*)\}/g;
const OVERFLOW = /(?:^|[\s;])(overflow(?:-x|-y)?)\s*:\s*(auto|scroll)\b/g;
/**
 * A class selector. The leading boundary matters: without it `a.b-c` inside an already-blanked string
 * would still contribute, and more importantly a pseudo-class argument such as `:not(.x)` must contribute
 * `x` while a decimal in `translate(1.5px)` must not.
 */
const CLASS = /\.(-?[A-Za-z_][\w-]*)/g;

export type OverflowRule = Readonly<{
  file: string;
  line: number;
  selector: string;
  property: string;
  value: string;
  /** Every class the selector names. Empty when the rule creates a scroll region with no class at all. */
  classes: readonly string[];
}>;

/**
 * Blanking moved to src/testing/source/comments.ts, which is a SCANNER rather than two regexes.
 *
 * The regex pair here read a double slash inside a string - `"https://example.com"` - as the start of a line
 * comment and blanked the rest of the line, code included. That is a silent miss, and three gates had written
 * the same pair separately. The shared module is tested in both directions and documents the one case it still
 * cannot decide, a regular-expression literal.
 */
export { blankComments } from "../source/comments.ts";

/** Blank comment and string bodies, keeping length and newlines so offsets and lines stay valid. */
export function blankNonCode(css: string): string {
  return blankCommentsAndStrings(css);
}

/**
 * Every double-quoted string in a named `export const <name> = [...]` array, with comments blanked first.
 *
 * Shared because two files need it and both got it wrong the same way: see blankComments.
 */
export function quotedNamesInExport(source: string, exportName: string): string[] {
  const text = blankComments(source);
  const start = text.indexOf(`export const ${exportName}`);
  if (start === -1) return [];
  const close = text.indexOf("\n]", start);
  const block = text.slice(start, close === -1 ? undefined : close);
  return [...block.matchAll(/"([A-Za-z0-9_-]+)"/g)].map((m) => m[1] as string);
}

export function classesInSelector(selector: string): string[] {
  const seen = new Set<string>();
  for (const match of selector.matchAll(CLASS)) {
    const name = match[1];
    if (name !== undefined) seen.add(name);
  }
  return [...seen];
}

export function overflowRulesIn(css: string, file: string): OverflowRule[] {
  const text = blankNonCode(css);
  const rules: OverflowRule[] = [];
  for (const match of text.matchAll(RULE)) {
    const prelude = match[1] ?? "";
    const body = match[2] ?? "";
    const selector = prelude.trim().replace(/\s+/g, " ");
    if (selector.length === 0) continue;
    for (const declaration of body.matchAll(OVERFLOW)) {
      const start = (match.index ?? 0) + (prelude.length - prelude.trimStart().length);
      rules.push({
        file,
        line: text.slice(0, start).split("\n").length,
        selector,
        property: declaration[1] ?? "overflow",
        value: declaration[2] ?? "auto",
        classes: classesInSelector(selector),
      });
    }
  }
  return rules;
}

export function scanOverflowRules(cssRoot: string, repoRoot: string): OverflowRule[] {
  const out: OverflowRule[] = [];
  for (const file of findProjectCssFiles(cssRoot)) {
    const rel = relative(repoRoot, file).split("\\").join("/");
    out.push(...overflowRulesIn(readFileSync(file, "utf8"), rel));
  }
  return out;
}

/** Every class any overflow rule names, sorted. */
export function overflowClasses(rules: readonly OverflowRule[]): string[] {
  const seen = new Set<string>();
  for (const rule of rules) for (const name of rule.classes) seen.add(name);
  return [...seen].sort((a, b) => a.localeCompare(b, "en"));
}

/** Overflow rules whose selector names no class, which a class-based scan can never see. */
export function classlessOverflowRules(rules: readonly OverflowRule[]): OverflowRule[] {
  return rules.filter((rule) => rule.classes.length === 0);
}
